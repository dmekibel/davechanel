#!/usr/bin/env bash
# fetch-image.sh — pull an image from a public URL into content/images/.
# Supports raw URLs, Google Drive share links, and Dropbox share links.
# Then re-runs process-images.sh so the new piece appears on the site.
#
# Usage:
#   ./scripts/fetch-image.sh <url> [optional-filename]
#
# Google Drive: make the file "Anyone with the link → Viewer" before
# sending the URL. The script handles the large-file confirm dance.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$ROOT/content/images"
mkdir -p "$DEST_DIR"

URL="${1:-}"
NAME="${2:-}"

if [ -z "$URL" ]; then
  echo "Usage: $0 <url> [optional-filename]"
  exit 1
fi

case "$URL" in
  *drive.google.com/file/d/*)
    FILE_ID="$(echo "$URL" | sed -E 's#.*/file/d/([^/]+).*#\1#')"
    DL_URL="https://drive.google.com/uc?export=download&id=$FILE_ID"
    ;;
  *drive.google.com/uc*)
    DL_URL="$URL"
    FILE_ID="$(echo "$URL" | sed -E 's#.*[?&]id=([^&]+).*#\1#')"
    ;;
  *dropbox.com/*)
    # Force direct download
    DL_URL="${URL/dl=0/dl=1}"
    [[ "$DL_URL" == *dl=* ]] || DL_URL="${URL}?dl=1"
    FILE_ID=""
    ;;
  *)
    DL_URL="$URL"
    FILE_ID=""
    ;;
esac

# Determine filename
if [ -z "$NAME" ]; then
  NAME="$(basename "${URL%%[?#]*}")"
  case "$NAME" in
    *.jpg|*.jpeg|*.png|*.tif|*.tiff|*.JPG|*.JPEG|*.PNG) : ;;
    *) NAME="downloaded-$(date +%s).jpg" ;;
  esac
fi

OUT="$DEST_DIR/$NAME"

if [ -n "$FILE_ID" ]; then
  # Two-step: first GET sets a confirm token cookie for large files.
  COOKIE_JAR="$(mktemp)"
  trap 'rm -f "$COOKIE_JAR"' EXIT
  TOKEN="$(curl -sLc "$COOKIE_JAR" "$DL_URL" \
    | sed -nE 's/.*confirm=([0-9A-Za-z_-]+).*/\1/p' | head -n1)"
  if [ -n "$TOKEN" ]; then
    DL_URL="${DL_URL}&confirm=${TOKEN}"
  fi
  echo "Downloading from Google Drive → $OUT"
  curl -sL -b "$COOKIE_JAR" -o "$OUT" "$DL_URL"
else
  echo "Downloading → $OUT"
  curl -sL -o "$OUT" "$DL_URL"
fi

# Verify it actually looks like an image (not an HTML error page).
mime="$(file -b --mime-type "$OUT" || true)"
case "$mime" in
  image/*) echo "Got: $mime ($(du -h "$OUT" | cut -f1))" ;;
  *)
    echo "Looks like the download returned $mime — not an image."
    echo "If this was a Google Drive link, make sure the share is set to"
    echo "\"Anyone with the link\". Removing the bad file."
    rm -f "$OUT"
    exit 2
    ;;
esac

# Trigger the derivative pipeline.
"$ROOT/scripts/process-images.sh"

echo
echo "Done. To ship:"
echo "  git add content/images js/fine-art-manifest.js"
echo "  git commit -m \"add fine art: $NAME\""
echo "  git push"
