#!/usr/bin/env python3
"""Submit an exported ComfyUI API workflow with an input reference image.

Works with any installed image-to-video graph (including Wan 2.2) that has:
- one LoadImage node
- one text prompt node with inputs.text
- one video-output node that produces a file in ComfyUI history.

ComfyUI must already be running. Uses Python standard library only.
"""
import argparse
import json
import mimetypes
import os
from pathlib import Path
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

def request_json(base, route, payload=None, timeout=30):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        base + route, data=body,
        headers={"Content-Type": "application/json"} if body is not None else {},
        method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)

def upload_image(base, path):
    boundary = "----autovideostudio" + uuid.uuid4().hex
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    header = (f"--{boundary}\r\n"
              f'Content-Disposition: form-data; name="image"; filename="{path.name}"\r\n'
              f"Content-Type: {mime}\r\n\r\n").encode()
    body = header + path.read_bytes() + (f"\r\n--{boundary}--\r\n").encode()
    req = urllib.request.Request(
        base + "/upload/image", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST")
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.load(response)["name"]

def main():
    parser = argparse.ArgumentParser(description="ComfyUI Image-to-Video runner")
    parser.add_argument("--workflow", required=True, type=Path,
                        help="ComfyUI workflow exported as API JSON, not UI workflow JSON")
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--image-node", required=True,
                        help="LoadImage node ID, e.g. 12")
    parser.add_argument("--prompt-node", required=True,
                        help="Text/CLIP prompt node ID with inputs.text")
    parser.add_argument("--server", default="http://127.0.0.1:8188")
    parser.add_argument("--output", type=Path, default=Path("generated_clips"))
    parser.add_argument("--timeout", type=int, default=1800)
    args = parser.parse_args()
    if not args.image.is_file():
        parser.error("Reference image does not exist")
    if args.timeout < 1:
        parser.error("timeout must be positive")
    base = args.server.rstrip("/")
    if not (base.startswith("http://127.0.0.1:") or base.startswith("http://localhost:")):
        parser.error("Only localhost ComfyUI is supported for safety")
    workflow = json.loads(args.workflow.read_text(encoding="utf-8"))
    if "nodes" in workflow:
        parser.error("Export workflow in ComfyUI API format, not UI JSON format")
    for node in (args.image_node, args.prompt_node):
        if node not in workflow or "inputs" not in workflow[node]:
            parser.error(f"Node ID {node} not present in API workflow")
    if "image" not in workflow[args.image_node]["inputs"]:
        parser.error("Image node has no inputs.image field")
    if "text" not in workflow[args.prompt_node]["inputs"]:
        parser.error("Prompt node has no inputs.text field")
    uploaded = upload_image(base, args.image)
    workflow[args.image_node]["inputs"]["image"] = uploaded
    workflow[args.prompt_node]["inputs"]["text"] = args.prompt
    client_id = str(uuid.uuid4())
    queued = request_json(base, "/prompt", {"prompt": workflow, "client_id": client_id})
    prompt_id = queued["prompt_id"]
    print("ComfyUI task:", prompt_id, flush=True)
    deadline = time.monotonic() + args.timeout
    history = None
    while time.monotonic() < deadline:
        item = request_json(base, "/history/" + urllib.parse.quote(prompt_id)).get(prompt_id)
        if item:
            history = item
            break
        time.sleep(3)
    if history is None:
        raise TimeoutError(f"ComfyUI did not finish in {args.timeout}s: {prompt_id}")
    status = history.get("status", {})
    if status.get("status_str") == "error" or not status.get("completed", True):
        raise RuntimeError(f"ComfyUI execution failed: {json.dumps(status, ensure_ascii=False)}")
    files = []
    for node_output in history.get("outputs", {}).values():
        for category in ("gifs", "videos", "images"):
            for entry in node_output.get(category, []):
                filename = entry.get("filename", "")
                if filename.lower().endswith((".mp4", ".webm", ".mov", ".mkv")):
                    files.append(entry)
    if not files:
        raise RuntimeError("No video in ComfyUI history; check that the workflow saves a video file")
    args.output.mkdir(parents=True, exist_ok=True)
    for entry in files:
        params = urllib.parse.urlencode({
            "filename": entry["filename"],
            "subfolder": entry.get("subfolder", ""),
            "type": entry.get("type", "output")})
        safe_name = Path(entry["filename"]).name
        dest = args.output / safe_name
        with urllib.request.urlopen(base + "/view?" + params, timeout=180) as response:
            with dest.open("wb") as f:
                shutil.copyfileobj(response, f)
        print("Saved:", dest.resolve())

if __name__ == "__main__":
    main()
