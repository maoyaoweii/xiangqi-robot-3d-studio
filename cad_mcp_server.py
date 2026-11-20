"""Local MCP-style bridge for the 光赛一 parametric CAD studio.

The bridge uses JSON-RPC over HTTP so a local AI client or the browser workbench
can create, edit, snap and export custom CAD parts without an external service.
It intentionally uses only Python's standard library.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


HOST = os.environ.get("CAD_MCP_HOST", "127.0.0.1")
PORT = int(os.environ.get("CAD_MCP_PORT", "8786"))

TEMPLATES = {
    "plate": {"width": 0.120, "length": 0.180, "height": 0.006, "thickness": 0.006, "massKg": 0.08, "color": "#2d9279"},
    "bracket": {"width": 0.080, "length": 0.090, "height": 0.060, "thickness": 0.006, "massKg": 0.07, "color": "#4d98e0"},
    "funnel": {"width": 0.160, "length": 0.120, "height": 0.050, "thickness": 0.005, "massKg": 0.09, "color": "#e0a943"},
    "connector": {"width": 0.060, "length": 0.060, "height": 0.030, "thickness": 0.008, "massKg": 0.04, "color": "#a56bd6"},
    "block": {"width": 0.080, "length": 0.080, "height": 0.050, "thickness": 0.010, "massKg": 0.10, "color": "#7d8c99"},
}

PARTS: list[dict[str, Any]] = []
LOCK = threading.Lock()


def _number(text: str, patterns: list[str], fallback: float) -> float:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return float(match.group(1))
    return fallback


def _template_from_prompt(prompt: str) -> str:
    if re.search(r"支架|相机|电机", prompt):
        return "bracket"
    if re.search(r"漏斗|收集|导向|侧翼", prompt):
        return "funnel"
    if re.search(r"连接|快拆|定位销|拼图", prompt):
        return "connector"
    if re.search(r"板|底板|隔板", prompt):
        return "plate"
    return "block"


def create_template(arguments: dict[str, Any]) -> dict[str, Any]:
    prompt = str(arguments.get("prompt", "")).strip()
    template = str(arguments.get("template", ""))
    if template not in TEMPLATES:
        template = _template_from_prompt(prompt)
    defaults = TEMPLATES[template]
    explicit = arguments.get("part") if isinstance(arguments.get("part"), dict) else {}
    part = {
        "id": f"mcp-{int(time.time() * 1000)}",
        "name": str(explicit.get("name") or arguments.get("name") or prompt[:24] or f"AI {template}件"),
        "template": template,
        "role": str(explicit.get("role") or ("collector" if re.search(r"收集|推送|铲|漏斗", prompt) else "structure")),
        "width": float(explicit.get("width", _number(prompt, [r"(?:宽|width)\s*[:：]?\s*(\d+(?:\.\d+)?)"], defaults["width"] * 1000) * 0.001)),
        "length": float(explicit.get("length", _number(prompt, [r"(?:长|length|深)\s*[:：]?\s*(\d+(?:\.\d+)?)"], defaults["length"] * 1000) * 0.001)),
        "height": float(explicit.get("height", _number(prompt, [r"(?:高|height)\s*[:：]?\s*(\d+(?:\.\d+)?)"], defaults["height"] * 1000) * 0.001)),
        "thickness": float(explicit.get("thickness", _number(prompt, [r"(?:厚|thickness)\s*[:：]?\s*(\d+(?:\.\d+)?)"], defaults["thickness"] * 1000) * 0.001)),
        "massKg": float(explicit.get("massKg", _number(prompt, [r"(?:质量|重量|mass)\s*[:：]?\s*(\d+(?:\.\d+)?)"], defaults["massKg"]))),
        "color": str(explicit.get("color") or defaults["color"]),
        "x": float(explicit.get("x", 0)),
        "y": float(explicit.get("y", 0.115)),
        "z": float(explicit.get("z", 0)),
        "yaw": float(explicit.get("yaw", 0)),
        "slotId": "",
        "connected": False,
        "locked": False,
        "connectors": explicit.get("connectors") if isinstance(explicit.get("connectors"), list) else (["male", "female", "pin", "slot"] if re.search(r"定位销|连接|快拆|拼图", prompt) else ["male", "female"]),
    }
    return {"part": part, "template": template, "message": "已生成参数化 CAD 模板"}


def tool_definitions() -> list[dict[str, Any]]:
    return [
        {"name": "cad.create_template", "description": "根据自然语言或尺寸参数创建一个参数化 CAD 拼图零件", "inputSchema": {"type": "object", "properties": {"prompt": {"type": "string"}, "template": {"type": "string"}, "part": {"type": "object"}}, "required": ["prompt"]}},
        {"name": "cad.update_part", "description": "按零件 id 更新尺寸、坐标、颜色或连接器", "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}, "patch": {"type": "object"}}, "required": ["id", "patch"]}},
        {"name": "cad.snap_connect", "description": "把零件连接到标准顶板、工具座、相机桅杆或电池舱接口", "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}, "slotId": {"type": "string"}}, "required": ["id"]}},
        {"name": "cad.list_parts", "description": "返回当前 MCP 会话中的自定义零件", "inputSchema": {"type": "object", "properties": {}}},
        {"name": "cad.export_bom", "description": "导出当前 MCP 会话的自定义零件 BOM", "inputSchema": {"type": "object", "properties": {}}},
    ]


def call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "cad.create_template":
        created = create_template(arguments)
        with LOCK:
            PARTS.append(created["part"])
        return created
    if name == "cad.list_parts":
        with LOCK:
            return {"parts": list(PARTS), "count": len(PARTS)}
    if name == "cad.update_part":
        with LOCK:
            part = next((item for item in PARTS if item["id"] == arguments.get("id")), None)
            if part is None:
                raise ValueError("找不到指定零件")
            patch = arguments.get("patch") if isinstance(arguments.get("patch"), dict) else {}
            part.update(patch)
            return {"part": part}
    if name == "cad.snap_connect":
        with LOCK:
            part = next((item for item in PARTS if item["id"] == arguments.get("id")), None)
            if part is None:
                raise ValueError("找不到指定零件")
            part["slotId"] = str(arguments.get("slotId") or "deck-top-center")
            part["connected"] = True
            return {"part": part, "slotId": part["slotId"]}
    if name == "cad.export_bom":
        with LOCK:
            return {"schemaVersion": 1, "parts": list(PARTS), "massKg": sum(float(item.get("massKg", 0)) for item in PARTS)}
    raise ValueError(f"未知工具 {name}")


def rpc_result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def rpc_error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


class Handler(BaseHTTPRequestHandler):
    server_version = "GuangsaiCADMCP/1.0"

    def _headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Content-Type", "application/json; charset=utf-8")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") in {"", "/health"}:
            body = {"ok": True, "name": "guangsai-cad-mcp", "version": "1.0", "tools": len(tool_definitions())}
            self.send_response(200)
            self._headers()
            self.end_headers()
            self.wfile.write(json.dumps(body, ensure_ascii=False).encode("utf-8"))
            return
        self.send_response(404)
        self._headers()
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length) or b"{}")
            request_id = request.get("id")
            method = request.get("method")
            if method == "initialize":
                result = {"protocolVersion": "2025-06-18", "serverInfo": {"name": "guangsai-cad-mcp", "version": "1.0"}, "capabilities": {"tools": {}}}
            elif method == "tools/list":
                result = {"tools": tool_definitions()}
            elif method == "tools/call":
                params = request.get("params") or {}
                result = call_tool(str(params.get("name")), params.get("arguments") or {})
                result = {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}], "structuredContent": result}
            elif method == "ping":
                result = {}
            else:
                raise ValueError(f"未知 JSON-RPC 方法 {method}")
            response = rpc_result(request_id, result)
        except ValueError as error:
            response = rpc_error(request.get("id") if isinstance(locals().get("request"), dict) else None, -32602, str(error))
        except Exception as error:  # pragma: no cover - defensive HTTP boundary
            response = rpc_error(None, -32603, str(error))
        raw = json.dumps(response, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self._headers()
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[CAD-MCP] {format % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"CAD MCP bridge listening on http://{HOST}:{PORT}/mcp")
    print("Tools: " + ", ".join(item["name"] for item in tool_definitions()))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
