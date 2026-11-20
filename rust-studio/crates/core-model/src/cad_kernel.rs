use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hole2D {
    pub cx: f64,
    pub cz: f64,
    pub radius: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SketchProfile {
    pub name: String,
    /// 2D polygon vertices in meters (XZ plane, CCW).
    pub outline: Vec<Point2D>,
    /// Circular cutouts (lightening holes / M3 mounting bores) in meters.
    #[serde(default)]
    pub holes: Vec<Hole2D>,
    /// Extrusion thickness along +Y in meters.
    pub thickness: f64,
    /// Material density in kg/m^3 (e.g. 3K Carbon = 1550, Al6061 = 2700, POM = 1410, PLA = 1240).
    #[serde(default = "default_density")]
    pub density_kg_m3: f64,
}

fn default_density() -> f64 {
    1550.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadMesh {
    pub name: String,
    pub vertices: Vec<[f64; 3]>,
    pub triangles: Vec<[usize; 3]>,
    pub area_m2: f64,
    pub volume_m3: f64,
    pub mass_kg: f64,
    pub bounds_min: [f64; 3],
    pub bounds_max: [f64; 3],
}

impl SketchProfile {
    pub fn chamfered_rect(
        name: impl Into<String>,
        width: f64,
        length: f64,
        chamfer: f64,
        thickness: f64,
        density_kg_m3: f64,
        holes: Vec<Hole2D>,
    ) -> Self {
        let hw = (width * 0.5).max(0.005);
        let hl = (length * 0.5).max(0.005);
        let ch = chamfer.clamp(0.0, hw.min(hl) * 0.8);
        let mut outline = vec![
            Point2D { x: -hw, z: -hl },
            Point2D { x: hw, z: -hl },
        ];
        if ch > 1e-4 {
            outline.push(Point2D { x: hw, z: hl - ch });
            outline.push(Point2D { x: hw - ch, z: hl });
            outline.push(Point2D { x: -hw + ch, z: hl });
            outline.push(Point2D { x: -hw, z: hl - ch });
        } else {
            outline.push(Point2D { x: hw, z: hl });
            outline.push(Point2D { x: -hw, z: hl });
        }
        Self {
            name: name.into(),
            outline,
            holes,
            thickness: thickness.max(0.001),
            density_kg_m3: density_kg_m3.max(100.0),
        }
    }

    pub fn u_scoop(
        name: impl Into<String>,
        width: f64,
        wall_t: f64,
        left_wing: f64,
        left_splay_deg: f64,
        right_wing: f64,
        right_splay_deg: f64,
        height: f64,
        density_kg_m3: f64,
    ) -> Self {
        let hw = (width * 0.5).max(0.01);
        let t = wall_t.clamp(0.002, 0.03);
        let ls = (left_splay_deg * PI) / 180.0;
        let rs = (right_splay_deg * PI) / 180.0;
        let lx_tip = -hw - left_wing * ls.sin();
        let lz_tip = left_wing * ls.cos();
        let rx_tip = hw + right_wing * rs.sin();
        let rz_tip = right_wing * rs.cos();

        let outline = vec![
            Point2D { x: -hw - t * 0.5, z: -t },
            Point2D { x: hw + t * 0.5, z: -t },
            Point2D { x: rx_tip + t * 0.5, z: rz_tip },
            Point2D { x: rx_tip - t * 0.5, z: rz_tip },
            Point2D { x: hw - t * 0.5, z: 0.0 },
            Point2D { x: -hw + t * 0.5, z: 0.0 },
            Point2D { x: lx_tip + t * 0.5, z: lz_tip },
            Point2D { x: lx_tip - t * 0.5, z: lz_tip },
        ];
        Self {
            name: name.into(),
            outline,
            holes: Vec::new(),
            thickness: height.max(0.004),
            density_kg_m3: density_kg_m3.max(100.0),
        }
    }

    pub fn l_bracket(
        name: impl Into<String>,
        leg_a: f64,
        leg_b: f64,
        arm_w: f64,
        thickness: f64,
        density_kg_m3: f64,
    ) -> Self {
        let a = leg_a.max(0.02);
        let b = leg_b.max(0.02);
        let w = arm_w.clamp(0.006, a.min(b) * 0.65);
        let outline = vec![
            Point2D { x: -a * 0.5, z: -b * 0.5 },
            Point2D { x: a * 0.5, z: -b * 0.5 },
            Point2D { x: a * 0.5, z: -b * 0.5 + w },
            Point2D { x: -a * 0.5 + w, z: -b * 0.5 + w },
            Point2D { x: -a * 0.5 + w, z: b * 0.5 },
            Point2D { x: -a * 0.5, z: b * 0.5 },
        ];
        Self {
            name: name.into(),
            outline,
            holes: vec![
                Hole2D { cx: a * 0.25, cz: -b * 0.5 + w * 0.5, radius: 0.003 },
                Hole2D { cx: -a * 0.5 + w * 0.5, cz: b * 0.25, radius: 0.003 },
            ],
            thickness: thickness.max(0.001),
            density_kg_m3: density_kg_m3.max(100.0),
        }
    }

    pub fn hex_plate(
        name: impl Into<String>,
        width: f64,
        length: f64,
        thickness: f64,
        density_kg_m3: f64,
    ) -> Self {
        let rx = (width * 0.5).max(0.015);
        let rz = (length * 0.5).max(0.015);
        let mut outline = Vec::with_capacity(6);
        for i in 0..6 {
            let ang = (i as f64) * PI / 3.0;
            outline.push(Point2D { x: rx * ang.cos(), z: rz * ang.sin() });
        }
        Self {
            name: name.into(),
            outline,
            holes: vec![Hole2D { cx: 0.0, cz: 0.0, radius: rx.min(rz) * 0.18 }],
            thickness: thickness.max(0.001),
            density_kg_m3: density_kg_m3.max(100.0),
        }
    }

    pub fn gear_wheel(
        name: impl Into<String>,
        outer_diameter: f64,
        teeth: usize,
        thickness: f64,
        density_kg_m3: f64,
    ) -> Self {
        let r_out = (outer_diameter * 0.5).max(0.012);
        let r_in = r_out * 0.80;
        let t = teeth.clamp(6, 24);
        let steps = t * 4;
        let mut outline = Vec::with_capacity(steps);
        for i in 0..steps {
            let ang = (i as f64) * 2.0 * PI / (steps as f64);
            let phase = i % 4;
            let r = if phase == 1 || phase == 2 { r_out } else { r_in };
            outline.push(Point2D { x: r * ang.cos(), z: r * ang.sin() });
        }
        Self {
            name: name.into(),
            outline,
            holes: vec![Hole2D { cx: 0.0, cz: 0.0, radius: r_in * 0.28 }],
            thickness: thickness.max(0.001),
            density_kg_m3: density_kg_m3.max(100.0),
        }
    }

    pub fn ring_flange(
        name: impl Into<String>,
        outer_diameter: f64,
        thickness: f64,
        density_kg_m3: f64,
    ) -> Self {
        let r_out = (outer_diameter * 0.5).max(0.012);
        let segs = 20;
        let mut outline = Vec::with_capacity(segs);
        for i in 0..segs {
            let ang = (i as f64) * 2.0 * PI / (segs as f64);
            outline.push(Point2D { x: r_out * ang.cos(), z: r_out * ang.sin() });
        }
        Self {
            name: name.into(),
            outline,
            holes: vec![Hole2D { cx: 0.0, cz: 0.0, radius: r_out * 0.58 }],
            thickness: thickness.max(0.001),
            density_kg_m3: density_kg_m3.max(100.0),
        }
    }

    pub fn u_channel(
        name: impl Into<String>,
        width: f64,
        length: f64,
        wall: f64,
        thickness: f64,
        density_kg_m3: f64,
    ) -> Self {
        let hw = (width * 0.5).max(0.012);
        let hl = (length * 0.5).max(0.012);
        let w = wall.clamp(0.004, hw.min(hl) * 0.65);
        let outline = vec![
            Point2D { x: -hw, z: -hl },
            Point2D { x: hw, z: -hl },
            Point2D { x: hw, z: hl },
            Point2D { x: hw - w, z: hl },
            Point2D { x: hw - w, z: -hl + w },
            Point2D { x: -hw + w, z: -hl + w },
            Point2D { x: -hw + w, z: hl },
            Point2D { x: -hw, z: hl },
        ];
        Self {
            name: name.into(),
            outline,
            holes: vec![],
            thickness: thickness.max(0.001),
            density_kg_m3: density_kg_m3.max(100.0),
        }
    }

    pub fn polygon_area_m2(&self) -> f64 {
        let n = self.outline.len();
        if n < 3 {
            return 0.0;
        }
        let mut sum = 0.0;
        for i in 0..n {
            let a = &self.outline[i];
            let b = &self.outline[(i + 1) % n];
            sum += a.x * b.z - b.x * a.z;
        }
        let hole_area: f64 = self.holes.iter().map(|h| PI * h.radius.max(0.0).powi(2)).sum();
        (sum.abs() * 0.5 - hole_area).max(1e-7)
    }

    pub fn extrude(&self) -> CadMesh {
        let n = self.outline.len();
        let area_m2 = self.polygon_area_m2();
        let h = self.thickness.max(0.001);
        let volume_m3 = area_m2 * h;
        let mass_kg = (volume_m3 * self.density_kg_m3).max(0.001);

        if n < 3 {
            return CadMesh {
                name: self.name.clone(),
                vertices: vec![],
                triangles: vec![],
                area_m2,
                volume_m3,
                mass_kg,
                bounds_min: [0.0; 3],
                bounds_max: [0.0; 3],
            };
        }

        // Ensure CCW order for consistent outward normals
        let mut pts = self.outline.clone();
        let signed: f64 = (0..n)
            .map(|i| {
                let a = &pts[i];
                let b = &pts[(i + 1) % n];
                a.x * b.z - b.x * a.z
            })
            .sum();
        if signed < 0.0 {
            pts.reverse();
        }

        let tris_2d = triangulate_ear_clipping(&pts);
        let mut vertices = Vec::with_capacity(n * 2);
        for p in &pts {
            vertices.push([p.x, 0.0, p.z]);
        }
        for p in &pts {
            vertices.push([p.x, h, p.z]);
        }

        let mut triangles = Vec::with_capacity(tris_2d.len() * 2 + n * 2);
        // Bottom cap (Y = 0, normal -Y)
        for [a, b, c] in &tris_2d {
            triangles.push([*a, *c, *b]);
        }
        // Top cap (Y = h, normal +Y)
        for [a, b, c] in &tris_2d {
            triangles.push([n + *a, n + *b, n + *c]);
        }
        // Side walls
        for i in 0..n {
            let j = (i + 1) % n;
            triangles.push([i, j, n + j]);
            triangles.push([i, n + j, n + i]);
        }

        let mut bmin = [f64::INFINITY; 3];
        let mut bmax = [f64::NEG_INFINITY; 3];
        for v in &vertices {
            for k in 0..3 {
                bmin[k] = bmin[k].min(v[k]);
                bmax[k] = bmax[k].max(v[k]);
            }
        }

        CadMesh {
            name: self.name.clone(),
            vertices,
            triangles,
            area_m2,
            volume_m3,
            mass_kg,
            bounds_min: bmin,
            bounds_max: bmax,
        }
    }

    /// Exports 2D CNC/Laser-cut DXF (in millimeters).
    pub fn to_dxf_mm(&self) -> String {
        let mut out = String::from("0\nSECTION\n2\nENTITIES\n");
        let n = self.outline.len();
        for i in 0..n {
            let a = &self.outline[i];
            let b = &self.outline[(i + 1) % n];
            out.push_str(&format!(
                "0\nLINE\n8\nOUTLINE\n10\n{:.3}\n20\n{:.3}\n30\n0.0\n11\n{:.3}\n21\n{:.3}\n31\n0.0\n",
                a.x * 1000.0,
                a.z * 1000.0,
                b.x * 1000.0,
                b.z * 1000.0
            ));
        }
        for h in &self.holes {
            out.push_str(&format!(
                "0\nCIRCLE\n8\nHOLES\n10\n{:.3}\n20\n{:.3}\n30\n0.0\n40\n{:.3}\n",
                h.cx * 1000.0,
                h.cz * 1000.0,
                h.radius * 1000.0
            ));
        }
        out.push_str("0\nENDSEC\n0\nEOF\n");
        out
    }
}

impl CadMesh {
    /// Exports ASCII STL (in millimeters for standard 3D printing slicers).
    pub fn to_stl_ascii_mm(&self) -> String {
        let safe_name = self.name.replace(|c: char| !c.is_ascii_alphanumeric() && c != '_', "_");
        let mut out = format!("solid {safe_name}\n");
        for &[i0, i1, i2] in &self.triangles {
            let v0 = self.vertices[i0];
            let v1 = self.vertices[i1];
            let v2 = self.vertices[i2];
            let ux = v1[0] - v0[0];
            let uy = v1[1] - v0[1];
            let uz = v1[2] - v0[2];
            let vx = v2[0] - v0[0];
            let vy = v2[1] - v0[1];
            let vz = v2[2] - v0[2];
            let nx = uy * vz - uz * vy;
            let ny = uz * vx - ux * vz;
            let nz = ux * vy - uy * vx;
            let nlen = (nx * nx + ny * ny + nz * nz).sqrt().max(1e-12);
            out.push_str(&format!(
                "  facet normal {:.6} {:.6} {:.6}\n    outer loop\n      vertex {:.4} {:.4} {:.4}\n      vertex {:.4} {:.4} {:.4}\n      vertex {:.4} {:.4} {:.4}\n    endloop\n  endfacet\n",
                nx / nlen, ny / nlen, nz / nlen,
                v0[0] * 1000.0, v0[1] * 1000.0, v0[2] * 1000.0,
                v1[0] * 1000.0, v1[1] * 1000.0, v1[2] * 1000.0,
                v2[0] * 1000.0, v2[1] * 1000.0, v2[2] * 1000.0,
            ));
        }
        out.push_str(&format!("endsolid {safe_name}\n"));
        out
    }
}

fn triangulate_ear_clipping(pts: &[Point2D]) -> Vec<[usize; 3]> {
    let n = pts.len();
    if n < 3 {
        return vec![];
    }
    if n == 3 {
        return vec![[0, 1, 2]];
    }
    let mut indices: Vec<usize> = (0..n).collect();
    let mut tris = Vec::with_capacity(n - 2);
    let mut guard = 0;

    while indices.len() > 3 && guard < n * n {
        guard += 1;
        let m = indices.len();
        let mut clipped = false;
        for i in 0..m {
            let prev = indices[(i + m - 1) % m];
            let curr = indices[i];
            let next = indices[(i + 1) % m];
            let a = &pts[prev];
            let b = &pts[curr];
            let c = &pts[next];
            if cross_2d(a, b, c) <= 1e-10 {
                continue;
            }
            let contains = indices.iter().any(|&idx| {
                idx != prev && idx != curr && idx != next && point_in_tri(&pts[idx], a, b, c)
            });
            if !contains {
                tris.push([prev, curr, next]);
                indices.remove(i);
                clipped = true;
                break;
            }
        }
        if !clipped {
            break;
        }
    }
    if indices.len() == 3 {
        tris.push([indices[0], indices[1], indices[2]]);
    }
    tris
}

fn cross_2d(a: &Point2D, b: &Point2D, c: &Point2D) -> f64 {
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}

fn point_in_tri(p: &Point2D, a: &Point2D, b: &Point2D, c: &Point2D) -> bool {
    let c1 = cross_2d(a, b, p);
    let c2 = cross_2d(b, c, p);
    let c3 = cross_2d(c, a, p);
    c1 >= -1e-10 && c2 >= -1e-10 && c3 >= -1e-10
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extrude_chamfered_plate_and_export() {
        let sk = SketchProfile::chamfered_rect(
            "chassis_plate",
            0.220,
            0.240,
            0.020,
            0.005,
            1550.0,
            vec![Hole2D { cx: 0.0, cz: 0.0, radius: 0.015 }],
        );
        let mesh = sk.extrude();
        assert!(mesh.triangles.len() >= 16);
        assert!(mesh.mass_kg > 0.30 && mesh.mass_kg < 0.50);
        let stl = mesh.to_stl_ascii_mm();
        assert!(stl.starts_with("solid chassis_plate"));
        assert!(stl.contains("endsolid chassis_plate"));
        let dxf = sk.to_dxf_mm();
        assert!(dxf.contains("CIRCLE"));
        assert!(dxf.contains("OUTLINE"));
    }
}
