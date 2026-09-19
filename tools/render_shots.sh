#!/usr/bin/env bash
# Render store screenshots from store/shots/*.html at exact store sizes.
# Needs: Chrome, Python+Pillow, and the project served on localhost:8778
#   (python -m http.server 8778 --directory <project root>)
# Headless Chrome counts window chrome in --window-size, so each page is
# rendered 200px taller and then cropped to the exact size, then flattened to
# 24-bit RGB: the Chrome Web Store rejects PNGs with an alpha channel.
set -e
cd "$(dirname "$0")/.."
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROF="C:/Users/$USERNAME/AppData/Local/Temp/thm-shots-profile"
OUT="$(pwd -W 2>/dev/null || pwd)/store/screenshots"
mkdir -p store/screenshots
render() {  # page width height outfile
  "$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROF" \
    --window-size=$2,$(( $3 + 200 )) --virtual-time-budget=6000 \
    --screenshot="$OUT/$4" "http://localhost:8778/store/shots/$1" >/dev/null 2>&1
  python -c "from PIL import Image; p='store/screenshots/$4'; Image.open(p).crop((0,0,$2,$3)).convert('RGB').save(p); im=Image.open(p); print('$4', im.size, im.mode)"
}
render picker.html  1280 800 1-picker.png
render gallery.html 1280 800 2-gallery.png
render promo.html   440  280 promo-440x280.png
render marquee.html 1400 560 marquee-1400x560.png
