"""Serve the project's trained Xiangqi YOLO model to the browser simulator.

The browser posts a JSON object containing a PNG data URL to ``/predict``.
This bridge keeps the model in memory, runs one inference per request, and
returns normalized detections that the simulator side panel understands.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("YOLO_CONFIG_DIR", str(ROOT / ".yolo"))

CHINESE = {
    "rook": "车",
    "horse": "马",
    "elephant": "象/相",
    "advisor": "士/仕",
    "general": "将/帅",
    "cannon": "炮",
    "pawn": "兵/卒",
}


def decode_image(payload: dict[str, Any]):
    import cv2
    import numpy as np

    image_data = payload.get("imageData") or payload.get("image") or payload.get("image_base64")
    if not isinstance(image_data, str) or not image_data:
        raise ValueError("request must contain imageData, image, or image_base64")
    encoded = image_data.split(",", 1)[1] if "," in image_data else image_data
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("image data is not valid base64") from exc
    if not raw or len(raw) > 20 * 1024 * 1024:
        raise ValueError("image payload must be between 1 byte and 20 MB")
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("image payload could not be decoded")
    return image


class Detector:
    def __init__(self, weights: Path, conf: float, imgsz: int, device: str | None, max_detections: int):
        from ultralytics import YOLO

        self.weights = weights
        self.conf = conf
        self.imgsz = imgsz
        self.device = device
        self.max_detections = max_detections
        self.model = YOLO(str(weights))
        self.lock = threading.Lock()
        self.frames = 0

    def _name(self, names: Any, class_id: int) -> str:
        if isinstance(names, dict):
            return str(names.get(class_id, class_id))
        if isinstance(names, (list, tuple)) and 0 <= class_id < len(names):
            return str(names[class_id])
        return str(class_id)

    def predict(self, image) -> list[dict[str, Any]]:
        kwargs: dict[str, Any] = {
            "conf": self.conf,
            "imgsz": self.imgsz,
            "agnostic_nms": True,
            "verbose": False,
            "max_det": self.max_detections,
        }
        if self.device:
            kwargs["device"] = self.device
        with self.lock:
            result = self.model.predict(source=image, **kwargs)[0]
            self.frames += 1
        if result.boxes is None:
            return []

        names = result.names or self.model.names
        records: list[dict[str, Any]] = []
        boxes = result.boxes.xyxy.cpu().tolist()
        scores = result.boxes.conf.cpu().tolist()
        classes = result.boxes.cls.cpu().tolist()
        for raw_box, raw_score, raw_class in zip(boxes, scores, classes):
            class_id = int(raw_class)
            x1, y1, x2, y2 = (float(value) for value in raw_box)
            class_name = self._name(names, class_id)
            width = max(0.0, x2 - x1)
            height = max(0.0, y2 - y1)
            records.append(
                {
                    "class_id": class_id,
                    "className": class_name,
                    "piece_type": class_name,
                    "piece_type_cn": CHINESE.get(class_name, class_name),
                    "label": CHINESE.get(class_name, class_name),
                    "confidence": float(raw_score),
                    "bbox": {"x": x1, "y": y1, "width": width, "height": height},
                    "bbox_xyxy": [x1, y1, x2, y2],
                    "center_xy": [x1 + width / 2, y1 + height / 2],
                }
            )
        return records


class Handler(BaseHTTPRequestHandler):
    server_version = "XiangqiYOLOBridge/1.0"

    @property
    def bridge(self):
        return self.server.bridge_state

    def _write_json(self, payload: dict[str, Any], status: int = 200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._write_json({"ok": True})

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            detector = self.bridge.detector
            self._write_json(
                {
                    "ok": True,
                    "model": str(detector.weights),
                    "frames": detector.frames,
                    "conf": detector.conf,
                    "imgsz": detector.imgsz,
                }
            )
            return
        self._write_json(
            {
                "ok": True,
                "service": "xiangqi-yolo-bridge",
                "endpoints": {"health": "/health", "predict": "/predict"},
            }
        )

    def do_POST(self):
        if self.path.rstrip("/") != "/predict":
            self._write_json({"ok": False, "error": "not found"}, status=404)
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 25 * 1024 * 1024:
                raise ValueError("request body must be between 1 byte and 25 MB")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            image = decode_image(payload)
            started = time.perf_counter()
            detections = self.bridge.detector.predict(image)
            latency_ms = (time.perf_counter() - started) * 1000
            height, width = image.shape[:2]
            self._write_json(
                {
                    "detections": detections,
                    "width": width,
                    "height": height,
                    "latency_ms": round(latency_ms, 1),
                    "model": self.bridge.detector.weights.name,
                    "time": payload.get("time"),
                }
            )
        except Exception as exc:
            self._write_json({"ok": False, "error": str(exc)}, status=400)

    def log_message(self, fmt: str, *args):
        print(f"[yolo-bridge] {self.address_string()} - {fmt % args}")


class BridgeState:
    def __init__(self, detector: Detector):
        self.detector = detector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--weights", type=Path, default=ROOT / "weights" / "xiangqi_yolo11s_best.pt")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default=None, help="CPU, CUDA index such as 0, or an Ultralytics device string")
    parser.add_argument("--max-detections", type=int, default=50)
    args = parser.parse_args()
    args.weights = args.weights if args.weights.is_absolute() else ROOT / args.weights
    if not args.weights.exists():
        parser.error(f"weights not found: {args.weights}")
    if not 0 <= args.conf <= 1:
        parser.error("--conf must be between 0 and 1")
    return args


def main():
    args = parse_args()
    detector = Detector(args.weights, args.conf, args.imgsz, args.device, args.max_detections)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.bridge_state = BridgeState(detector)
    print(f"YOLO bridge ready: http://{args.host}:{args.port}")
    print(f"weights: {args.weights}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping YOLO bridge.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
