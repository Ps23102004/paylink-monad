#!/bin/sh
# Copies the shared design system (CSS, fonts, real UI captures) into each HyperFrames project.
# HyperFrames refuses asset paths above a project root, so each project carries its own copy.
set -eu
cd "$(dirname "$0")"
for p in launch walkthrough stills/hero stills/social; do
  [ -d "$p" ] || continue
  mkdir -p "$p/assets/ui" "$p/assets/fonts"
  cp shared/paylink.css shared/grain.png "$p/assets/"
  cp shared/fonts/*.woff2 "$p/assets/fonts/"
  cp shared/ui/*.png "$p/assets/ui/"
  [ -f "$p/sfx-cues.json" ] && python3 shared/sfx.py "$p/sfx-cues.json" "$p/assets/sfx.wav" "$(python3 -c "import re;print(re.search(r'data-duration=\"([0-9.]+)\"', open('$p/index.html').read()).group(1))")"
  true
done
