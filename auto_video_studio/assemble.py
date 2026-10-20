#!/usr/bin/env python3
"""Auto Video Studio V1: assemble real video clips into a 9:16 MP4.
Requires Python 3.9+ and FFmpeg/ffprobe on PATH. No cloud account.
This tool does NOT synthesize AI video: create motion clips separately in ComfyUI.
"""
import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

def run(cmd):
    subprocess.run(cmd, check=True)

def main():
    p = argparse.ArgumentParser(description="Automotive reel assembler")
    p.add_argument("project", type=Path, help="Path to project.json")
    p.add_argument("--output", type=Path, default=Path("fahrzeugvideo.mp4"))
    args = p.parse_args()
    for binary in ("ffmpeg", "ffprobe"):
        if not shutil.which(binary):
            p.error(f"{binary} not found. Install FFmpeg and add it to PATH.")
    config = json.loads(args.project.read_text(encoding="utf-8"))
    clips = config.get("clips", [])
    if not clips:
        p.error("project.json needs at least one video clip")
    if not 20 <= sum(float(c.get("seconds", 0)) for c in clips) <= 30:
        p.error("Total configured clip length must be 20–30 seconds")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        parts = []
        for i, clip in enumerate(clips):
            src = (args.project.parent / clip["file"]).resolve()
            if not src.is_file() or src.suffix.lower() not in (".mp4", ".mov", ".mkv", ".webm"):
                p.error(f"Missing video clip: {src}")
            dest = Path(td) / f"scene_{i:02d}.mp4"
            vf = ("fps=30,scale=1080:1920:force_original_aspect_ratio=increase,"
                  "crop=1080:1920,setsar=1,format=yuv420p")
            run(["ffmpeg", "-y", "-i", str(src), "-t", str(float(clip["seconds"])),
                 "-an", "-vf", vf, "-c:v", "libx264", "-preset", "medium",
                 "-crf", "19", "-movflags", "+faststart", str(dest)])
            parts.append(dest)
        concat = Path(td) / "list.txt"
        concat.write_text("".join(f"file '{x.as_posix()}'\n" for x in parts), encoding="utf-8")
        silent = Path(td) / "silent.mp4"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
             "-c", "copy", str(silent)])
        music = config.get("music")
        if music:
            audio = (args.project.parent / music).resolve()
            if not audio.is_file():
                p.error(f"Missing music file: {audio}")
            run(["ffmpeg", "-y", "-i", str(silent), "-stream_loop", "-1",
                 "-i", str(audio), "-map", "0:v:0", "-map", "1:a:0",
                 "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                 "-af", "volume=0.35,afade=t=in:st=0:d=0.7",
                 "-shortest", "-movflags", "+faststart", str(args.output)])
        else:
            shutil.copyfile(silent, args.output)
    print(f"Video erstellt: {args.output.resolve()}")

if __name__ == "__main__":
    main()
