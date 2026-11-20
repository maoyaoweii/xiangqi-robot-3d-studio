use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
use xiangqi_core::cad_kernel::{Hole2D, Point2D, SketchProfile};
use xiangqi_core::AssemblyGraph;
use xiangqi_sim::{optimize_assembly, run_headless_match, PhysicsEnv};

pub fn tool_definitions() -> Value {
    json!([
        {
            "name": "get_assembly_graph",
            "description": "Get the full puzzle-piece robotic assembly graph, resolved kinematics, 3D CG, inertia, and diagnostics.",
            "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false }
        },
        {
            "name": "update_module_params",
            "description": "Update parameters or enable/disable any independent robot module node without restrictions.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "node_id": { "type": "string", "description": "e.g. chassis_main, motor_drive, wheel_mecanum, device_scoop, wing_pair, camera_main" },
                    "params": { "type": "object", "description": "Key-value parameter overrides (SI units: m, kg, deg, rpm)" },
                    "mass_kg": { "type": "number" },
                    "enabled": { "type": "boolean" }
                },
                "required": ["node_id"]
            }
        },
        {
            "name": "create_custom_cad_part",
            "description": "Create and extrude a parametric 3D CAD part from a 2D sketch or preset (chamfered_rect / u_scoop / l_bracket / hex_plate / gear_wheel / ring_flange / u_channel / polygon), auto-compute volume/mass, and snap it onto a chassis/scoop port.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "part_id": { "type": "string" },
                    "name": { "type": "string" },
                    "kind": { "type": "string", "enum": ["chamfered_rect", "u_scoop", "l_bracket", "hex_plate", "gear_wheel", "ring_flange", "u_channel", "polygon"] },
                    "parent_id": { "type": "string", "default": "chassis_main" },
                    "port_id": { "type": "string", "default": "top_deck" },
                    "offset": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
                    "thickness": { "type": "number", "default": 0.005 },
                    "density_kg_m3": { "type": "number", "default": 1550.0 },
                    "width": { "type": "number" },
                    "length": { "type": "number" },
                    "chamfer": { "type": "number" },
                    "arm_w": { "type": "number" },
                    "teeth": { "type": "integer" },
                    "outline": { "type": "array", "items": { "type": "object", "properties": { "x": { "type": "number" }, "z": { "type": "number" } } } },
                    "holes": { "type": "array", "items": { "type": "object", "properties": { "cx": { "type": "number" }, "cz": { "type": "number" }, "radius": { "type": "number" } } } }
                },
                "required": ["part_id", "name", "kind"]
            }
        },
        {
            "name": "export_cad_stl",
            "description": "Export a module's extruded 3D CAD mesh as an ASCII .STL string (millimeters, ready for 3D printing).",
            "inputSchema": {
                "type": "object",
                "properties": { "node_id": { "type": "string", "default": "chassis_main" } }
            }
        },
        {
            "name": "export_cad_dxf",
            "description": "Export a module's 2D CAD sketch outline and mounting holes as .DXF (millimeters, ready for CNC/laser cutting).",
            "inputSchema": {
                "type": "object",
                "properties": { "node_id": { "type": "string", "default": "chassis_main" } }
            }
        },
        {
            "name": "run_physics_simulation",
            "description": "Run deterministic pure-vision rigid-body simulation under standard, slippery, bouncy, or heavy physics.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "preset": { "type": "string", "enum": ["standard", "slippery", "bouncy", "heavy"], "default": "standard" },
                    "seed": { "type": "integer", "default": 42 },
                    "duration_s": { "type": "number", "default": 120.0 }
                }
            }
        },
        {
            "name": "optimize_best_design",
            "description": "Sweep candidate mechanical & asymmetric wing designs across multiple seeds to find the highest-scoring solution.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "preset": { "type": "string", "default": "standard" },
                    "seeds": { "type": "array", "items": { "type": "integer" } }
                }
            }
        }
    ])
}

pub fn handle_tool_call(graph: &mut AssemblyGraph, name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "get_assembly_graph" => {
            let resolved = graph.resolve_kinematics();
            Ok(json!({ "graph": graph, "resolved": resolved }))
        }
        "update_module_params" => {
            let node_id = args.get("node_id").and_then(|v| v.as_str()).ok_or("Missing node_id")?;
            let node = graph.nodes.iter_mut().find(|n| n.id == node_id).ok_or_else(|| format!("Node '{node_id}' not found"))?;
            if let Some(m) = args.get("mass_kg").and_then(|v| v.as_f64()) {
                node.mass_kg = m.max(0.001);
            }
            if let Some(en) = args.get("enabled").and_then(|v| v.as_bool()) {
                node.enabled = en;
            }
            if let Some(obj) = args.get("params").and_then(|v| v.as_object()) {
                if let Some(dst) = node.params.as_object_mut() {
                    for (k, v) in obj {
                        dst.insert(k.clone(), v.clone());
                    }
                }
            }
            Ok(json!({ "ok": true, "resolved": graph.resolve_kinematics() }))
        }
        "create_custom_cad_part" => {
            let part_id = args.get("part_id").and_then(|v| v.as_str()).ok_or("Missing part_id")?.to_string();
            let pname = args.get("name").and_then(|v| v.as_str()).unwrap_or("custom_part").to_string();
            let kind = args.get("kind").and_then(|v| v.as_str()).unwrap_or("chamfered_rect");
            let thickness = args.get("thickness").and_then(|v| v.as_f64()).unwrap_or(0.005);
            let density = args.get("density_kg_m3").and_then(|v| v.as_f64()).unwrap_or(1550.0);
            let holes: Vec<Hole2D> = args
                .get("holes")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();

            let sketch = match kind {
                "u_scoop" => {
                    let w = args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.20);
                    let lw = args.get("left_wing").and_then(|v| v.as_f64()).unwrap_or(0.05);
                    let ls = args.get("left_splay_deg").and_then(|v| v.as_f64()).unwrap_or(18.0);
                    let rw = args.get("right_wing").and_then(|v| v.as_f64()).unwrap_or(0.05);
                    let rs = args.get("right_splay_deg").and_then(|v| v.as_f64()).unwrap_or(18.0);
                    SketchProfile::u_scoop(pname, w, 0.006, lw, ls, rw, rs, thickness, density)
                }
                "l_bracket" => SketchProfile::l_bracket(
                    pname,
                    args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.12),
                    args.get("length").and_then(|v| v.as_f64()).unwrap_or(0.08),
                    args.get("arm_w").and_then(|v| v.as_f64()).unwrap_or(0.024),
                    thickness,
                    density,
                ),
                "hex_plate" => SketchProfile::hex_plate(
                    pname,
                    args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.18),
                    args.get("length").and_then(|v| v.as_f64()).unwrap_or(0.18),
                    thickness,
                    density,
                ),
                "gear_wheel" => SketchProfile::gear_wheel(
                    pname,
                    args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.09),
                    args.get("teeth").and_then(|v| v.as_u64()).unwrap_or(12) as usize,
                    thickness,
                    density,
                ),
                "ring_flange" => SketchProfile::ring_flange(
                    pname,
                    args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.11),
                    thickness,
                    density,
                ),
                "u_channel" => SketchProfile::u_channel(
                    pname,
                    args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.12),
                    args.get("length").and_then(|v| v.as_f64()).unwrap_or(0.09),
                    args.get("arm_w").and_then(|v| v.as_f64()).unwrap_or(0.016),
                    thickness,
                    density,
                ),
                "polygon" => {
                    let outline: Vec<Point2D> = args
                        .get("outline")
                        .and_then(|v| serde_json::from_value(v.clone()).ok())
                        .ok_or("Missing outline points for polygon CAD")?;
                    SketchProfile { name: pname, outline, holes, thickness, density_kg_m3: density }
                }
                _ => {
                    let w = args.get("width").and_then(|v| v.as_f64()).unwrap_or(0.20);
                    let l = args.get("length").and_then(|v| v.as_f64()).unwrap_or(0.22);
                    let ch = args.get("chamfer").and_then(|v| v.as_f64()).unwrap_or(0.015);
                    SketchProfile::chamfered_rect(pname, w, l, ch, thickness, density, holes)
                }
            };
            let parent_id = args.get("parent_id").and_then(|v| v.as_str()).unwrap_or("chassis_main");
            let port_id = args.get("port_id").and_then(|v| v.as_str()).unwrap_or("top_deck");
            let offset: [f64; 3] = args
                .get("offset")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or([0.0, 0.0, 0.0]);
            let mesh = graph.add_custom_cad_part(part_id, sketch, parent_id, port_id, offset)?;
            Ok(json!({ "mesh": mesh, "resolved": graph.resolve_kinematics() }))
        }
        "export_cad_stl" => {
            let node_id = args.get("node_id").and_then(|v| v.as_str()).unwrap_or("chassis_main");
            let node = graph.nodes.iter().find(|n| n.id == node_id).ok_or_else(|| format!("Node '{node_id}' not found"))?;
            let sk = node.custom_sketch.as_ref().ok_or("Selected node has no parametric CAD sketch")?;
            let mesh = sk.extrude();
            Ok(json!({ "stl": mesh.to_stl_ascii_mm(), "facets": mesh.triangles.len(), "mass_kg": mesh.mass_kg }))
        }
        "export_cad_dxf" => {
            let node_id = args.get("node_id").and_then(|v| v.as_str()).unwrap_or("chassis_main");
            let node = graph.nodes.iter().find(|n| n.id == node_id).ok_or_else(|| format!("Node '{node_id}' not found"))?;
            let sk = node.custom_sketch.as_ref().ok_or("Selected node has no parametric CAD sketch")?;
            Ok(json!({ "dxf": sk.to_dxf_mm() }))
        }
        "run_physics_simulation" => {
            let preset = args.get("preset").and_then(|v| v.as_str()).unwrap_or("standard");
            let seed = args.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);
            let dur = args.get("duration_s").and_then(|v| v.as_f64()).unwrap_or(120.0);
            let built = graph.resolve_kinematics();
            let summary = run_headless_match(&built, PhysicsEnv::preset(preset), seed, dur);
            Ok(json!({ "summary": summary, "resolved": built }))
        }
        "optimize_best_design" => {
            let preset = args.get("preset").and_then(|v| v.as_str()).unwrap_or("standard");
            let seeds: Vec<u64> = args
                .get("seeds")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_else(|| vec![42, 101, 202]);
            let results = optimize_assembly(graph, PhysicsEnv::preset(preset), &seeds);
            Ok(json!({ "candidates": results }))
        }
        _ => Err(format!("Unknown tool: {name}")),
    }
}

pub fn handle_json_rpc(graph: &mut AssemblyGraph, req: &Value) -> Option<Value> {
    let id = req.get("id").cloned();
    let method = req.get("method").and_then(|v| v.as_str()).unwrap_or("");
    let params = req.get("params").cloned().unwrap_or_else(|| json!({}));

    if method.starts_with("notifications/") {
        return None;
    }

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "xiangqi-cad-mcp", "version": "0.3.0" }
        })),
        "tools/list" => Ok(json!({ "tools": tool_definitions() })),
        "tools/call" => {
            let tname = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let targs = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            match handle_tool_call(graph, tname, &targs) {
                Ok(val) => Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&val).unwrap_or_default() }]
                })),
                Err(err) => Ok(json!({
                    "isError": true,
                    "content": [{ "type": "text", "text": err }]
                })),
            }
        }
        _ => Err((-32601, format!("Method not found: {method}"))),
    };

    id.map(|req_id| match result {
        Ok(res) => json!({ "jsonrpc": "2.0", "id": req_id, "result": res }),
        Err((code, msg)) => json!({ "jsonrpc": "2.0", "id": req_id, "error": { "code": code, "message": msg } }),
    })
}

pub fn run_stdio_mcp_loop() {
    let mut graph = AssemblyGraph::default_competition_robot();
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    for line in stdin.lock().lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(req) = serde_json::from_str::<Value>(trimmed) {
            if let Some(resp) = handle_json_rpc(&mut graph, &req) {
                let _ = writeln!(stdout, "{}", resp);
                let _ = stdout.flush();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_initialize_and_cad_pipeline() {
        let mut graph = AssemblyGraph::default_competition_robot();
        let init = handle_json_rpc(&mut graph, &json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize" })).unwrap();
        assert_eq!(init["result"]["serverInfo"]["name"], "xiangqi-cad-mcp");

        let create = handle_json_rpc(&mut graph, &json!({
            "jsonrpc": "2.0", "id": 2, "method": "tools/call",
            "params": {
                "name": "create_custom_cad_part",
                "arguments": { "part_id": "wing_guard_x", "name": "wing_guard_x", "kind": "u_scoop", "width": 0.22 }
            }
        })).unwrap();
        assert!(create["result"]["isError"].is_null());

        let gear = handle_json_rpc(&mut graph, &json!({
            "jsonrpc": "2.0", "id": 3, "method": "tools/call",
            "params": {
                "name": "create_custom_cad_part",
                "arguments": { "part_id": "drive_gear_1", "name": "drive_gear_1", "kind": "gear_wheel", "width": 0.08, "teeth": 14 }
            }
        })).unwrap();
        assert!(gear["result"]["isError"].is_null());

        let stl = handle_json_rpc(&mut graph, &json!({
            "jsonrpc": "2.0", "id": 4, "method": "tools/call",
            "params": { "name": "export_cad_stl", "arguments": { "node_id": "wing_guard_x" } }
        })).unwrap();
        let txt = stl["result"]["content"][0]["text"].as_str().unwrap();
        assert!(txt.contains("solid wing_guard_x"));
    }
}
