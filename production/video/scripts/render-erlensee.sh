#!/usr/bin/env bash
set -euo pipefail

# Erlensee GLC Demo renderer
# Input: five 1080x1920 scene images already prepared with text overlays.
# Output: exact 20-second H.264 MP4 at 30 fps.

PROJECT_DIR="${1:-production/video/projects/erlensee-glc-demo}"
ASSET_DIR="$PROJECT_DIR/assets"
WORK_DIR="$PROJECT_DIR/.render"
OUT_DIR="$PROJECT_DIR/output"
mkdir -p "$WORK_DIR" "$OUT_DIR"

SCENE_DURATION="4.28"
TRANSITION="0.35"
OFFSETS=("3.93" "7.86" "11.79" "15.72")

for i in 1 2 3 4 5; do
  ffmpeg -y -loglevel error -loop 1 -i "$ASSET_DIR/scene_${i}.jpg"     -vf "zoompan=z='min(zoom+0.00045,1.055)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=129:s=1080x1920:fps=30,format=yuv420p"     -t "$SCENE_DURATION" -r 30 -c:v libx264 -preset medium -crf 18     "$WORK_DIR/scene_${i}.mp4"
done

ffmpeg -y -loglevel error   -i "$WORK_DIR/scene_1.mp4"   -i "$WORK_DIR/scene_2.mp4"   -i "$WORK_DIR/scene_3.mp4"   -i "$WORK_DIR/scene_4.mp4"   -i "$WORK_DIR/scene_5.mp4"   -filter_complex "[0:v][1:v]xfade=transition=fade:duration=$TRANSITION:offset=${OFFSETS[0]}[v1];[v1][2:v]xfade=transition=fade:duration=$TRANSITION:offset=${OFFSETS[1]}[v2];[v2][3:v]xfade=transition=fade:duration=$TRANSITION:offset=${OFFSETS[2]}[v3];[v3][4:v]xfade=transition=fade:duration=$TRANSITION:offset=${OFFSETS[3]},format=yuv420p[v]"   -map "[v]" -t 20 -r 30 -c:v libx264 -preset medium -crf 18 -movflags +faststart   "$OUT_DIR/erlensee-glc-demo-v1.mp4"

ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate   -of default=noprint_wrappers=1 "$OUT_DIR/erlensee-glc-demo-v1.mp4"
