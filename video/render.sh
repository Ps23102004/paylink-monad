#!/bin/sh
# Rebuilds every launch asset in docs/media from the sources in video/.
# Needs: Node 22+, the hyperframes CLI (pinned 0.8.147), ffmpeg, python3 with numpy + scipy.
# The UI screenshots and transcripts are already captured (shared/ui, capture/out); see capture/run.sh to redo them.
set -eu
cd "$(dirname "$0")"
export HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1
OUT=../docs/media
mkdir -p "$OUT"
./sync.sh                                   # copy CSS/fonts/UI captures into each project, synthesize SFX
for p in launch walkthrough; do (cd "$p" && npx hyperframes check); done
(cd launch && npx hyperframes render --quality high --output "../$OUT/paylink-launch-20s.mp4")
(cd walkthrough && npx hyperframes render --crf 20 --output "../$OUT/paylink-walkthrough.mp4")
for p in hero social; do (cd "stills/$p" && rm -rf snapshots && npx hyperframes snapshot --at 0.5 --no-end); done
cp stills/hero/snapshots/frame-00-at-0.5s.png "$OUT/hero.png"
cp stills/social/snapshots/frame-00-at-0.5s.png "$OUT/social-card.png"
# README GIF: 10 s loop of the one-URL / two-payers beat (3.3 s to 13.4 s of the launch cut), 720 px, 15 fps
pal="$(mktemp -d)/pal.png"
ffmpeg -v error -y -ss 3.3 -t 10.1 -i "$OUT/paylink-launch-20s.mp4" -vf "fps=15,scale=720:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" "$pal"
ffmpeg -v error -y -ss 3.3 -t 10.1 -i "$OUT/paylink-launch-20s.mp4" -i "$pal" -lavfi "fps=15,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 "$OUT/launch.gif"
ls -la "$OUT"
