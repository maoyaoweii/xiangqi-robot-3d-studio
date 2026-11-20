pub mod desktop;

use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;
use xiangqi_core::cad_kernel::{Hole2D, Point2D, SketchProfile};
use xiangqi_core::{AssemblyGraph, ModuleKind, PuzzleNode};
use xiangqi_sim::{optimize_assembly, run_headless_match, PhysicsEnv};

const EMBEDDED_STUDIO_HTML: &[u8] = include_bytes!("../../../../studio.html");
const EMBEDDED_3D_HTML: &[u8] = include_bytes!("../../../../3d.html");
const EMBEDDED_3D_CSS: &[u8] = include_bytes!("../../../../3d.css");
const EMBEDDED_3D_JS: &[u8] = include_bytes!("../../../../3d.js");
const EMBEDDED_INDEX_HTML: &[u8] = include_bytes!("../../../../index.html");
const EMBEDDED_STYLES_CSS: &[u8] = include_bytes!("../../../../styles.css");
const EMBEDDED_APP_JS: &[u8] = include_bytes!("../../../../app.js");
const EMBEDDED_FAVICON_SVG: &[u8] = include_bytes!("../assets/app.svg");
const EMBEDDED_FAVICON_ICO: &[u8] = include_bytes!("../assets/app.ico");
const EMBEDDED_PHYSICS_WASM: &[u8] = include_bytes!("../assets/xiangqi_wasm.wasm");

pub const ENGINE_VERSION: &str = "0.3.0";

fn embedded_asset(rel: &str) -> Option<(&'static str, &'static [u8])> {
    match rel {
        "studio.html" => Some(("text/html; charset=utf-8", EMBEDDED_STUDIO_HTML)),
        "3d.html" => Some(("text/html; charset=utf-8", EMBEDDED_3D_HTML)),
        "3d.css" => Some(("text/css; charset=utf-8", EMBEDDED_3D_CSS)),
        "3d.js" => Some(("application/javascript; charset=utf-8", EMBEDDED_3D_JS)),
        "index.html" => Some(("text/html; charset=utf-8", EMBEDDED_INDEX_HTML)),
        "styles.css" => Some(("text/css; charset=utf-8", EMBEDDED_STYLES_CSS)),
        "app.js" => Some(("application/javascript; charset=utf-8", EMBEDDED_APP_JS)),
        "favicon.svg" => Some(("image/svg+xml", EMBEDDED_FAVICON_SVG)),
        "favicon.ico" => Some(("image/x-icon", EMBEDDED_FAVICON_ICO)),
        "xiangqi_wasm.wasm" => Some(("application/wasm", EMBEDDED_PHYSICS_WASM)),
        _ => None,
    }
}

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "application/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "wasm" => "application/wasm",
        "stl" => "model/stl",
        "dxf" => "application/dxf",
        _ => "application/octet-stream",
    }
}

fn send_response_with_headers(stream: &mut TcpStream, status: &str, ctype: &str, extra_headers: &str, body: &[u8]) {
    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type\r\nAccess-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n{extra_headers}Connection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn send_response(stream: &mut TcpStream, status: &str, ctype: &str, body: &[u8]) {
    send_response_with_headers(stream, status, ctype, "", body);
}

fn send_json(stream: &mut TcpStream, status: &str, v: &Value) {
    let body = serde_json::to_vec(v).unwrap_or_else(|_| b"{}".to_vec());
    send_response(stream, status, "application/json; charset=utf-8", &body);
}

fn parse_query_param<'a>(query: &'a str, key: &str) -> Option<&'a str> {
    query.split('&').find_map(|pair| {
        let mut it = pair.splitn(2, '=');
        if it.next()? == key { it.next() } else { None }
    })
}

fn read_http_request(stream: &mut TcpStream) -> Option<(String, String, String, String)> {
    let mut raw = Vec::with_capacity(8192);
    let mut chunk = [0u8; 8192];
    let header_end;
    let sep_len;
    loop {
        let n = stream.read(&mut chunk).ok()?;
        if n == 0 {
            return None;
        }
        raw.extend_from_slice(&chunk[..n]);
        if let Some(pos) = raw.windows(4).position(|w| w == b"\r\n\r\n") {
            header_end = pos;
            sep_len = 4;
            break;
        }
        if let Some(pos) = raw.windows(2).position(|w| w == b"\n\n") {
            header_end = pos;
            sep_len = 2;
            break;
        }
        if raw.len() > 65536 {
            return None;
        }
    }

    let head_str = String::from_utf8_lossy(&raw[..header_end]).to_string();
    let content_length = head_str
        .lines()
        .find_map(|line| {
            let (k, v) = line.split_once(':')?;
            if k.trim().eq_ignore_ascii_case("content-length") {
                v.trim().parse::<usize>().ok()
            } else {
                None
            }
        })
        .unwrap_or(0)
        .min(4 * 1024 * 1024);

    let body_start = header_end + sep_len;
    while raw.len() < body_start + content_length {
        let n = stream.read(&mut chunk).ok()?;
        if n == 0 {
            break;
        }
        raw.extend_from_slice(&chunk[..n]);
    }

    let body_end = (body_start + content_length).min(raw.len());
    let body_str = String::from_utf8_lossy(&raw[body_start..body_end]).to_string();
    let first = head_str.lines().next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let method = parts.next().unwrap_or("GET").to_string();
    let target = parts.next().unwrap_or("/");
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    Some((method, path.to_string(), query.to_string(), body_str))
}

fn rebuild_dynamic_sketches(g: &mut AssemblyGraph) {
    let lw_d = g.nodes.iter().find(|n| n.id == "wing_pair").and_then(|n| n.params["left_wing_depth"].as_f64()).unwrap_or(0.02);
    let lw_s = g.nodes.iter().find(|n| n.id == "wing_pair").and_then(|n| n.params["left_wing_splay"].as_f64()).unwrap_or(10.0);
    let rw_d = g.nodes.iter().find(|n| n.id == "wing_pair").and_then(|n| n.params["right_wing_depth"].as_f64()).unwrap_or(0.02);
    let rw_s = g.nodes.iter().find(|n| n.id == "wing_pair").and_then(|n| n.params["right_wing_splay"].as_f64()).unwrap_or(10.0);
    for n in &mut g.nodes {
        if n.id == "chassis_main" {
            let cw = n.params["width"].as_f64().unwrap_or(0.215);
            let cl = n.params["length"].as_f64().unwrap_or(0.235);
            let ch = n.params["front_chamfer"].as_f64().unwrap_or(0.016);
            n.custom_sketch = Some(SketchProfile::chamfered_rect(
                "chassis_deck", cw, cl, ch, 0.005, 1550.0,
                vec![Hole2D { cx: -cw * 0.28, cz: 0.0, radius: 0.012 }, Hole2D { cx: cw * 0.28, cz: 0.0, radius: 0.012 }],
            ));
        } else if n.id == "device_scoop" {
            let dw = n.params["device_width"].as_f64().unwrap_or(0.180);
            n.custom_sketch = Some(SketchProfile::u_scoop(
                "device_scoop", dw, 0.006, lw_d, lw_s, rw_d, rw_s, 0.056, 1380.0,
            ));
        }
    }
}

struct ServerContext {
    state: Mutex<AssemblyGraph>,
    web_root: Option<PathBuf>,
    mode: String,
    port: u16,
    allow_shutdown: bool,
    shutdown: Arc<AtomicBool>,
}

fn handle_client(mut stream: TcpStream, ctx: Arc<ServerContext>) {
    let Some((method, path, query, body_str)) = read_http_request(&mut stream) else {
        return;
    };

    if method == "OPTIONS" {
        send_response(&mut stream, "204 No Content", "text/plain", b"");
        return;
    }

    match (method.as_str(), path.as_str()) {
        ("GET", "/api/health") => {
            send_json(&mut stream, "200 OK", &json!({
                "ok": true,
                "engine": "xiangqi_studio_rust",
                "version": ENGINE_VERSION,
                "mode": ctx.mode,
                "port": ctx.port,
                "embedded_assets": true
            }));
        }
        ("POST", "/api/shutdown") => {
            if ctx.allow_shutdown {
                ctx.shutdown.store(true, Ordering::SeqCst);
                send_json(&mut stream, "200 OK", &json!({ "ok": true, "shutting_down": true }));
                let port = ctx.port;
                thread::spawn(move || {
                    let _ = TcpStream::connect(("127.0.0.1", port));
                });
            } else {
                send_json(&mut stream, "403 Forbidden", &json!({ "ok": false, "error": "Shutdown disabled" }));
            }
        }
        ("GET", "/api/assembly") => {
            let g = ctx.state.lock().unwrap();
            let custom_meshes: HashMap<String, _> = g
                .nodes
                .iter()
                .filter(|n| n.kind == ModuleKind::CustomCad)
                .filter_map(|n| n.custom_sketch.as_ref().map(|sk| (n.id.clone(), sk.extrude())))
                .collect();
            send_json(&mut stream, "200 OK", &json!({
                "graph": &*g,
                "resolved": g.resolve_kinematics(),
                "custom_meshes": custom_meshes
            }));
        }
        ("POST", "/api/assembly/snap") => {
            let payload: Value = serde_json::from_str(&body_str).unwrap_or_default();
            if let (Some(node), Some(parent_id), Some(port_id)) = (
                payload.get("node").and_then(|v| serde_json::from_value::<PuzzleNode>(v.clone()).ok()),
                payload.get("parent_id").and_then(|v| v.as_str()),
                payload.get("port_id").and_then(|v| v.as_str()),
            ) {
                let offset: [f64; 3] = payload.get("offset").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or([0.0; 3]);
                let mut g = ctx.state.lock().unwrap();
                match g.snap_module(node, parent_id, port_id, offset) {
                    Ok(()) => send_json(&mut stream, "200 OK", &json!({ "ok": true, "graph": &*g, "resolved": g.resolve_kinematics() })),
                    Err(e) => send_json(&mut stream, "400 Bad Request", &json!({ "ok": false, "error": e })),
                }
            } else {
                send_json(&mut stream, "400 Bad Request", &json!({ "ok": false, "error": "Invalid snap payload" }));
            }
        }
        ("POST", "/api/cad/extrude") => {
            let payload: Value = serde_json::from_str(&body_str).unwrap_or_default();
            let part_id = payload.get("part_id").and_then(|v| v.as_str()).unwrap_or("custom_cad_1").to_string();
            let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("参数化自定义件").to_string();
            let kind = payload.get("kind").and_then(|v| v.as_str()).unwrap_or("chamfered_rect");
            let thickness = payload.get("thickness").and_then(|v| v.as_f64()).unwrap_or(0.005);
            let density = payload.get("density_kg_m3").and_then(|v| v.as_f64()).unwrap_or(1550.0);
            let holes: Vec<Hole2D> = payload.get("holes").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default();
            let sketch = match kind {
                "u_scoop" => SketchProfile::u_scoop(
                    name,
                    payload.get("width").and_then(|v| v.as_f64()).unwrap_or(0.20),
                    0.006,
                    payload.get("left_wing").and_then(|v| v.as_f64()).unwrap_or(0.05),
                    payload.get("left_splay_deg").and_then(|v| v.as_f64()).unwrap_or(18.0),
                    payload.get("right_wing").and_then(|v| v.as_f64()).unwrap_or(0.05),
                    payload.get("right_splay_deg").and_then(|v| v.as_f64()).unwrap_or(18.0),
                    thickness,
                    density,
                ),
                "l_bracket" => SketchProfile::l_bracket(
                    name,
                    payload.get("width").and_then(|v| v.as_f64()).unwrap_or(0.12),
                    payload.get("length").and_then(|v| v.as_f64()).unwrap_or(0.08),
                    payload.get("arm_w").and_then(|v| v.as_f64()).unwrap_or(0.024),
                    thickness,
                    density,
                ),
                "hex_plate" => SketchProfile::hex_plate(
                    name,
                    payload.get("width").and_then(|v| v.as_f64()).unwrap_or(0.18),
                    payload.get("length").and_then(|v| v.as_f64()).unwrap_or(0.18),
                    thickness,
                    density,
                ),
                "gear_wheel" => SketchProfile::gear_wheel(
                    name,
                    payload.get("width").and_then(|v| v.as_f64()).unwrap_or(0.09),
                    payload.get("teeth").and_then(|v| v.as_u64()).unwrap_or(12) as usize,
                    thickness,
                    density,
                ),
                "ring_flange" => SketchProfile::ring_flange(
                    name,
                    payload.get("width").and_then(|v| v.as_f64()).unwrap_or(0.11),
                    thickness,
                    density,
                ),
                "u_channel" => SketchProfile::u_channel(
                    name,
                    payload.get("width").and_then(|v| v.as_f64()).unwrap_or(0.12),
                    payload.get("length").and_then(|v| v.as_f64()).unwrap_or(0.09),
                    payload.get("arm_w").and_then(|v| v.as_f64()).unwrap_or(0.016),
                    thickness,
                    density,
                ),
                "polygon" => {
                    let outline: Vec<Point2D> = payload.get("outline").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default();
                    SketchProfile { name, outline, holes, thickness, density_kg_m3: density }
                }
                _ => SketchProfile::chamfered_rect(
                    name,
                    payload.get("width").and_then(|v| v.as_f64()).unwrap_or(0.20),
                    payload.get("length").and_then(|v| v.as_f64()).unwrap_or(0.22),
                    payload.get("chamfer").and_then(|v| v.as_f64()).unwrap_or(0.015),
                    thickness,
                    density,
                    holes,
                ),
            };
            let parent_id = payload.get("parent_id").and_then(|v| v.as_str()).unwrap_or("chassis_main");
            let port_id = payload.get("port_id").and_then(|v| v.as_str()).unwrap_or("top_deck");
            let offset: [f64; 3] = payload.get("offset").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or([0.0; 3]);
            let color = payload.get("color").and_then(|v| v.as_str()).unwrap_or("#2d9279").to_string();
            let yaw_deg = payload.get("yaw_deg").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let mut g = ctx.state.lock().unwrap();
            match g.add_custom_cad_part(part_id.clone(), sketch, parent_id, port_id, offset) {
                Ok(mesh) => {
                    if let Some(node) = g.nodes.iter_mut().find(|n| n.id == part_id) {
                        node.params["color"] = json!(color);
                        node.params["yaw_deg"] = json!(yaw_deg);
                        node.rotation_deg[1] = yaw_deg;
                    }
                    send_json(&mut stream, "200 OK", &json!({ "ok": true, "mesh": mesh, "graph": &*g, "resolved": g.resolve_kinematics() }))
                }
                Err(e) => send_json(&mut stream, "400 Bad Request", &json!({ "ok": false, "error": e })),
            }
        }
        ("POST", "/api/cad/delete") | ("DELETE", "/api/cad/part") => {
            let payload: Value = serde_json::from_str(&body_str).unwrap_or_default();
            let part_id = payload
                .get("part_id")
                .and_then(|v| v.as_str())
                .or_else(|| parse_query_param(&query, "id"))
                .unwrap_or("");
            if part_id.is_empty() {
                send_json(&mut stream, "400 Bad Request", &json!({ "ok": false, "error": "Missing part_id" }));
            } else {
                let mut g = ctx.state.lock().unwrap();
                let removed = g.remove_node(part_id);
                send_json(&mut stream, "200 OK", &json!({ "ok": true, "removed": removed, "graph": &*g, "resolved": g.resolve_kinematics() }));
            }
        }
        ("POST", "/api/assembly/sync") => {
            let payload: Value = serde_json::from_str(&body_str).unwrap_or_default();
            let mut g = ctx.state.lock().unwrap();
            for n in &mut g.nodes {
                if let Some(patch) = payload.get(&n.id).and_then(|v| v.as_object()) {
                    for (k, v) in patch {
                        n.params[k] = v.clone();
                    }
                }
            }
            rebuild_dynamic_sketches(&mut g);
            send_json(&mut stream, "200 OK", &json!({ "ok": true, "resolved": g.resolve_kinematics() }));
        }
        ("GET", "/api/assembly/export.json") => {
            let g = ctx.state.lock().unwrap();
            let doc = json!({ "graph": &*g, "resolved": g.resolve_kinematics() });
            let body = serde_json::to_vec_pretty(&doc).unwrap_or_else(|_| b"{}".to_vec());
            let disp = "Content-Disposition: attachment; filename=\"xiangqi_assembly_graph.json\"\r\n";
            send_response_with_headers(&mut stream, "200 OK", "application/json; charset=utf-8", disp, &body);
        }
        ("GET", "/api/cad/export.stl") => {
            let nid = parse_query_param(&query, "node").unwrap_or("chassis_main");
            let g = ctx.state.lock().unwrap();
            if let Some(sk) = g.nodes.iter().find(|n| n.id == nid).and_then(|n| n.custom_sketch.as_ref()) {
                let stl = sk.extrude().to_stl_ascii_mm();
                let disp = format!("Content-Disposition: attachment; filename=\"{nid}.stl\"\r\n");
                send_response_with_headers(&mut stream, "200 OK", "model/stl", &disp, stl.as_bytes());
            } else {
                send_json(&mut stream, "404 Not Found", &json!({ "error": "CAD sketch not found on node" }));
            }
        }
        ("GET", "/api/cad/export.dxf") => {
            let nid = parse_query_param(&query, "node").unwrap_or("chassis_main");
            let g = ctx.state.lock().unwrap();
            if let Some(sk) = g.nodes.iter().find(|n| n.id == nid).and_then(|n| n.custom_sketch.as_ref()) {
                let dxf = sk.to_dxf_mm();
                let disp = format!("Content-Disposition: attachment; filename=\"{nid}.dxf\"\r\n");
                send_response_with_headers(&mut stream, "200 OK", "application/dxf", &disp, dxf.as_bytes());
            } else {
                send_json(&mut stream, "404 Not Found", &json!({ "error": "CAD sketch not found on node" }));
            }
        }
        ("POST", "/api/sim/run") => {
            let payload: Value = serde_json::from_str(&body_str).unwrap_or_default();
            let preset = payload.get("preset").and_then(|v| v.as_str()).unwrap_or("standard");
            let seed = payload.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);
            let dur = payload.get("duration_s").and_then(|v| v.as_f64()).unwrap_or(120.0);
            let g = ctx.state.lock().unwrap().clone();
            let built = g.resolve_kinematics();
            let summary = run_headless_match(&built, PhysicsEnv::preset(preset), seed, dur);
            send_json(&mut stream, "200 OK", &json!({ "summary": summary, "resolved": built }));
        }
        ("POST", "/api/sim/optimize") => {
            let payload: Value = serde_json::from_str(&body_str).unwrap_or_default();
            let preset = payload.get("preset").and_then(|v| v.as_str()).unwrap_or("standard");
            let seeds: Vec<u64> = payload.get("seeds").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_else(|| vec![42, 101, 202, 303]);
            let g = ctx.state.lock().unwrap().clone();
            let t0 = Instant::now();
            let results = optimize_assembly(&g, PhysicsEnv::preset(preset), &seeds);
            let elapsed_ms = t0.elapsed().as_millis() as u64;
            send_json(&mut stream, "200 OK", &json!({ "candidates": results, "elapsed_ms": elapsed_ms, "seeds_count": seeds.len() }));
        }
        ("GET", "/api/mcp/schema") => {
            send_json(&mut stream, "200 OK", &json!({
                "mcpServerName": "xiangqi-cad-mcp",
                "command": "XiangqiMcpServer.exe (or XiangqiRustCLI.exe mcp)",
                "tools": [
                    "get_assembly_graph", "update_module_params", "create_custom_cad_part",
                    "export_cad_stl", "export_cad_dxf", "run_physics_simulation", "optimize_best_design"
                ]
            }));
        }
        ("POST", "/api/mcp/call") => {
            let payload: Value = serde_json::from_str(&body_str).unwrap_or_default();
            let tool = payload.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let args = payload.get("arguments").cloned().unwrap_or_else(|| json!({}));
            match tool {
                "get_assembly_graph" => {
                    let g = ctx.state.lock().unwrap();
                    send_json(&mut stream, "200 OK", &json!({ "ok": true, "graph": &*g, "resolved": g.resolve_kinematics() }));
                }
                "update_module_params" => {
                    let nid = args.get("node_id").and_then(|v| v.as_str()).unwrap_or("");
                    let mut g = ctx.state.lock().unwrap();
                    if let Some(node) = g.nodes.iter_mut().find(|n| n.id == nid) {
                        if let Some(en) = args.get("enabled").and_then(|v| v.as_bool()) { node.enabled = en; }
                        if let Some(m) = args.get("mass_kg").and_then(|v| v.as_f64()) { node.mass_kg = m.max(0.001); }
                        if let Some(obj) = args.get("params").and_then(|v| v.as_object()) {
                            for (k, v) in obj { node.params[k] = v.clone(); }
                        }
                        rebuild_dynamic_sketches(&mut g);
                        send_json(&mut stream, "200 OK", &json!({ "ok": true, "resolved": g.resolve_kinematics() }));
                    } else {
                        send_json(&mut stream, "404 Not Found", &json!({ "ok": false, "error": format!("Node not found: {nid}") }));
                    }
                }
                "create_custom_cad_part" => {
                    let part_id = args.get("part_id").and_then(|v| v.as_str()).unwrap_or("mcp_cad_part").to_string();
                    let name = args.get("name").and_then(|v| v.as_str()).unwrap_or("AI定制CAD件").to_string();
                    let kind = args.get("kind").and_then(|v| v.as_str()).unwrap_or("chamfered_rect");
                    let thickness = args.get("thickness").and_then(|v| v.as_f64()).unwrap_or(0.005);
                    let density = args.get("density_kg_m3").and_then(|v| v.as_f64()).unwrap_or(1550.0);
                    let sketch = match kind {
                        "u_scoop" => SketchProfile::u_scoop(
                            name, args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.20), 0.006,
                            0.045, 16.0, 0.045, 16.0, thickness, density,
                        ),
                        "l_bracket" => SketchProfile::l_bracket(
                            name, args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.12),
                            args.get("length").and_then(|v| v.as_f64()).unwrap_or(0.08),
                            args.get("arm_w").and_then(|v| v.as_f64()).unwrap_or(0.024), thickness, density,
                        ),
                        "hex_plate" => SketchProfile::hex_plate(
                            name, args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.18),
                            args.get("length").and_then(|v| v.as_f64()).unwrap_or(0.18), thickness, density,
                        ),
                        "gear_wheel" => SketchProfile::gear_wheel(
                            name, args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.09),
                            args.get("teeth").and_then(|v| v.as_u64()).unwrap_or(12) as usize, thickness, density,
                        ),
                        "ring_flange" => SketchProfile::ring_flange(
                            name, args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.11), thickness, density,
                        ),
                        "u_channel" => SketchProfile::u_channel(
                            name, args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.12),
                            args.get("length").and_then(|v| v.as_f64()).unwrap_or(0.09),
                            args.get("arm_w").and_then(|v| v.as_f64()).unwrap_or(0.016), thickness, density,
                        ),
                        _ => SketchProfile::chamfered_rect(
                            name, args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.16),
                            args.get("length").and_then(|v| v.as_f64()).unwrap_or(0.08),
                            args.get("chamfer").and_then(|v| v.as_f64()).unwrap_or(0.012),
                            thickness, density, vec![],
                        ),
                    };
                    let parent_id = args.get("parent_id").and_then(|v| v.as_str()).unwrap_or("chassis_main");
                    let port_id = args.get("port_id").and_then(|v| v.as_str()).unwrap_or("top_deck");
                    let offset: [f64; 3] = args.get("offset").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or([0.0, 0.006, 0.0]);
                    let mut g = ctx.state.lock().unwrap();
                    match g.add_custom_cad_part(part_id, sketch, parent_id, port_id, offset) {
                        Ok(mesh) => send_json(&mut stream, "200 OK", &json!({ "ok": true, "mesh": mesh, "resolved": g.resolve_kinematics() })),
                        Err(e) => send_json(&mut stream, "400 Bad Request", &json!({ "ok": false, "error": e })),
                    }
                }
                "export_cad_stl" => {
                    let nid = args.get("node_id").and_then(|v| v.as_str()).unwrap_or("chassis_main");
                    let g = ctx.state.lock().unwrap();
                    if let Some(sk) = g.nodes.iter().find(|n| n.id == nid).and_then(|n| n.custom_sketch.as_ref()) {
                        send_json(&mut stream, "200 OK", &json!({ "ok": true, "stl": sk.extrude().to_stl_ascii_mm() }));
                    } else {
                        send_json(&mut stream, "404 Not Found", &json!({ "ok": false, "error": "Sketch not found" }));
                    }
                }
                "export_cad_dxf" => {
                    let nid = args.get("node_id").and_then(|v| v.as_str()).unwrap_or("chassis_main");
                    let g = ctx.state.lock().unwrap();
                    if let Some(sk) = g.nodes.iter().find(|n| n.id == nid).and_then(|n| n.custom_sketch.as_ref()) {
                        send_json(&mut stream, "200 OK", &json!({ "ok": true, "dxf": sk.to_dxf_mm() }));
                    } else {
                        send_json(&mut stream, "404 Not Found", &json!({ "ok": false, "error": "Sketch not found" }));
                    }
                }
                "run_physics_simulation" => {
                    let preset = args.get("preset").and_then(|v| v.as_str()).unwrap_or("standard");
                    let seed = args.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);
                    let dur = args.get("duration_s").and_then(|v| v.as_f64()).unwrap_or(120.0);
                    let g = ctx.state.lock().unwrap().clone();
                    let summary = run_headless_match(&g.resolve_kinematics(), PhysicsEnv::preset(preset), seed, dur);
                    send_json(&mut stream, "200 OK", &json!({ "ok": true, "summary": summary }));
                }
                "optimize_best_design" => {
                    let preset = args.get("preset").and_then(|v| v.as_str()).unwrap_or("standard");
                    let seeds: Vec<u64> = args.get("seeds").and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_else(|| vec![42, 101, 202]);
                    let g = ctx.state.lock().unwrap().clone();
                    let candidates = optimize_assembly(&g, PhysicsEnv::preset(preset), &seeds);
                    send_json(&mut stream, "200 OK", &json!({ "ok": true, "candidates": candidates }));
                }
                _ => send_json(&mut stream, "400 Bad Request", &json!({ "ok": false, "error": format!("Unsupported HTTP MCP tool: {tool}") })),
            }
        }
        ("GET", _) => {
            let rel = if path == "/" { "studio.html" } else { path.trim_start_matches('/') };
            if rel.contains("..") {
                send_response(&mut stream, "403 Forbidden", "text/plain", b"Forbidden");
                return;
            }
            if let Some(root) = ctx.web_root.as_ref() {
                let full = root.join(rel);
                if let Ok(bytes) = fs::read(&full) {
                    send_response(&mut stream, "200 OK", content_type(&full), &bytes);
                    return;
                }
            }
            if let Some((ctype, bytes)) = embedded_asset(rel) {
                send_response(&mut stream, "200 OK", ctype, bytes);
            } else {
                send_response(&mut stream, "404 Not Found", "text/plain", b"Not Found");
            }
        }
        _ => send_response(&mut stream, "405 Method Not Allowed", "text/plain", b"Method Not Allowed"),
    }
}

#[derive(Clone, Debug)]
pub struct ServerConfig {
    pub host: String,
    pub preferred_port: u16,
    pub web_root: Option<PathBuf>,
    pub mode: String,
    pub allow_shutdown: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            preferred_port: 8124,
            web_root: None,
            mode: "server".to_string(),
            allow_shutdown: true,
        }
    }
}

pub struct StudioServerHandle {
    pub host: String,
    pub port: u16,
    shutdown: Arc<AtomicBool>,
    join: Option<thread::JoinHandle<()>>,
}

impl StudioServerHandle {
    pub fn url(&self, page: &str) -> String {
        let host_display = if self.host == "0.0.0.0" { "127.0.0.1" } else { self.host.as_str() };
        format!("http://{}:{}/{}", host_display, self.port, page.trim_start_matches('/'))
    }

    pub fn stop(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(("127.0.0.1", self.port));
        if let Some(handle) = self.join.take() {
            let _ = handle.join();
        }
    }

    pub fn wait(mut self) {
        if let Some(handle) = self.join.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for StudioServerHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn bind_listener(host: &str, preferred_port: u16) -> std::io::Result<(TcpListener, u16)> {
    if preferred_port == 0 {
        let l = TcpListener::bind((host, 0))?;
        let p = l.local_addr()?.port();
        return Ok((l, p));
    }
    if let Ok(l) = TcpListener::bind((host, preferred_port)) {
        let p = l.local_addr()?.port();
        return Ok((l, p));
    }
    for offset in 1..=64u16 {
        if let Some(cand) = preferred_port.checked_add(offset) {
            if let Ok(l) = TcpListener::bind((host, cand)) {
                let p = l.local_addr()?.port();
                return Ok((l, p));
            }
        }
    }
    let l = TcpListener::bind((host, 0))?;
    let p = l.local_addr()?.port();
    Ok((l, p))
}

pub fn spawn_studio_server(cfg: ServerConfig) -> std::io::Result<StudioServerHandle> {
    let (listener, actual_port) = bind_listener(&cfg.host, cfg.preferred_port)?;
    let shutdown = Arc::new(AtomicBool::new(false));
    let ctx = Arc::new(ServerContext {
        state: Mutex::new(AssemblyGraph::default_competition_robot()),
        web_root: cfg.web_root,
        mode: cfg.mode,
        port: actual_port,
        allow_shutdown: cfg.allow_shutdown,
        shutdown: Arc::clone(&shutdown),
    });

    let join = thread::spawn(move || {
        for conn in listener.incoming() {
            if ctx.shutdown.load(Ordering::SeqCst) {
                break;
            }
            if let Ok(stream) = conn {
                if ctx.shutdown.load(Ordering::SeqCst) {
                    break;
                }
                let c = Arc::clone(&ctx);
                thread::spawn(move || handle_client(stream, c));
            }
        }
    });

    Ok(StudioServerHandle {
        host: cfg.host,
        port: actual_port,
        shutdown,
        join: Some(join),
    })
}

pub fn start_studio_server_with_mode(addr: &str, web_root: Option<PathBuf>, mode: &str) -> std::io::Result<()> {
    let listener = TcpListener::bind(addr)?;
    let actual_port = listener.local_addr()?.port();
    let ctx = Arc::new(ServerContext {
        state: Mutex::new(AssemblyGraph::default_competition_robot()),
        web_root,
        mode: mode.to_string(),
        port: actual_port,
        allow_shutdown: false,
        shutdown: Arc::new(AtomicBool::new(false)),
    });
    println!("Xiangqi Rust Engineering Studio listening on http://{addr}/studio.html");
    for conn in listener.incoming() {
        if let Ok(stream) = conn {
            let c = Arc::clone(&ctx);
            thread::spawn(move || handle_client(stream, c));
        }
    }
    Ok(())
}

pub fn start_studio_server(addr: &str, web_root: Option<PathBuf>) -> std::io::Result<()> {
    start_studio_server_with_mode(addr, web_root, "server")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn http_request(port: u16, raw_req: &str) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", port)).expect("connect");
        s.write_all(raw_req.as_bytes()).expect("write");
        let mut out = Vec::new();
        s.read_to_end(&mut out).expect("read");
        String::from_utf8_lossy(&out).to_string()
    }

    #[test]
    fn test_embedded_standalone_server_and_apis() {
        let mut handle = spawn_studio_server(ServerConfig {
            host: "127.0.0.1".to_string(),
            preferred_port: 0,
            web_root: None,
            mode: "desktop".to_string(),
            allow_shutdown: true,
        })
        .expect("spawn server");
        let port = handle.port;

        // Embedded pages and icons serve 200 OK with zero disk web_root
        let studio = http_request(port, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(studio.starts_with("HTTP/1.1 200 OK"));
        assert!(studio.contains("光电象棋 · Rust 真3D工程工坊"));

        let adv = http_request(port, "GET /3d.html HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(adv.starts_with("HTTP/1.1 200 OK"));
        assert!(adv.contains("3d.js"));

        let css = http_request(port, "GET /3d.css HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(css.starts_with("HTTP/1.1 200 OK"));

        let js = http_request(port, "GET /3d.js HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(js.starts_with("HTTP/1.1 200 OK"));

        let fav = http_request(port, "GET /favicon.svg HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(fav.starts_with("HTTP/1.1 200 OK"));
        assert!(fav.contains("<svg"));

        let wasm = http_request(port, "GET /xiangqi_wasm.wasm HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(wasm.starts_with("HTTP/1.1 200 OK"));
        assert!(wasm.contains("application/wasm"));

        // Health endpoint
        let health = http_request(port, "GET /api/health HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(health.contains("\"mode\":\"desktop\""));
        assert!(health.contains("\"embedded_assets\":true"));

        // CAD extrude gear_wheel
        let body = r#"{"part_id":"test_gear","name":"测试齿轮","kind":"gear_wheel","width":0.09,"teeth":14,"thickness":0.006}"#;
        let req = format!(
            "POST /api/cad/extrude HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            body.len(),
            body
        );
        let extrude = http_request(port, &req);
        assert!(extrude.starts_with("HTTP/1.1 200 OK"));
        assert!(extrude.contains("\"ok\":true"));

        // STL export
        let stl = http_request(port, "GET /api/cad/export.stl?node=test_gear HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(stl.starts_with("HTTP/1.1 200 OK"));
        assert!(stl.contains("solid "));

        // Clean shutdown via API
        let shut = http_request(port, "POST /api/shutdown HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\n\r\n");
        assert!(shut.contains("\"shutting_down\":true"));
        handle.stop();
    }

    #[test]
    fn test_auto_port_fallback() {
        let blocker = TcpListener::bind(("127.0.0.1", 0)).expect("bind blocker");
        let busy_port = blocker.local_addr().unwrap().port();
        let (_listener, picked_port) = bind_listener("127.0.0.1", busy_port).expect("fallback bind");
        assert_ne!(picked_port, busy_port);
        drop(blocker);
    }
}
