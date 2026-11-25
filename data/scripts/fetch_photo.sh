#!/bin/sh
# Download one photo into a temp folder, check it is a real image, save it as
# data/images/<plan_id>/<n>.jpg (max 1600 px wide, never upscaled, JPEG q85).
# Usage: fetch_photo.sh <plan_id> <n> <image_url> [referer]
#        fetch_photo.sh -m <image_url> [referer]     (measure only, saves nothing)
# Prints: <source_width> <source_height> [saved path]
set -eu
measure=; [ "$1" = -m ] && { measure=1; shift; set -- - - "$@"; }
pid=$1 n=$2 url=$3 ref=${4:-}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
curl -sSfL --proto =https,http --max-time 40 --max-filesize 40000000 -A "Mozilla/5.0" ${ref:+-e "$ref"} -o "$tmp/img" "$url"
case $(file -b --mime-type "$tmp/img") in
  image/jpeg) fmt=jpeg ;; image/png) fmt=png ;; image/webp) fmt=webp ;; image/avif) fmt=avif ;;
  *) echo "not an image: $(file -b "$tmp/img" | cut -c1-60)" >&2; exit 1 ;;
esac
dims=$(identify -quiet -format '%w %h' "$fmt:$tmp/img[0]")
[ -n "$measure" ] && { echo "$dims"; exit 0; }
out=$(cd "$(dirname "$0")/.." && pwd)/images/$pid
mkdir -p "$out"
convert -quiet "$fmt:$tmp/img[0]" -auto-orient -colorspace sRGB -resize '1600x>' -strip -quality 85 "jpeg:$out/$n.jpg"
echo "$dims $out/$n.jpg"
