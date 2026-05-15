#!/usr/bin/env bash
# Scan scratch/upscale-out/ for completed upscales, generate review-size
# previews (1200w JPEG, ~500KB) of each variant, and write a manifest.json
# that the standalone review page reads.
set -e
cd "$(dirname "$0")/.."

OUT=scratch/upscale-out
REVIEW=scratch/upscale-review
mkdir -p "$REVIEW"

# Collect (basename, dirname) pairs, then bucket by basename so multiple
# timestamped dirs for the same piece are listed together with newest first.
MANIFEST="$REVIEW/manifest.json"
echo '{ "pieces": [' > "$MANIFEST"

# Discover unique base names from output dirs (strip the timestamp suffix)
# Format of dir name: "IMG_1222-2026-05-14T22-58-05" → base "IMG_1222"
SEEN=""
FIRST=1
for piece_dir in $(ls -dt "$OUT"/*/ 2>/dev/null); do
  dirname=$(basename "$piece_dir")
  # Strip trailing -YYYY-MM-DDTHH-MM-SS
  base=$(echo "$dirname" | sed -E 's/-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}$//')
  case " $SEEN " in *" $base "*) continue ;; esac
  SEEN="$SEEN $base"

  # Find variant PNGs
  variants=()
  for v in "$piece_dir"variant-*.png; do
    [[ -f "$v" ]] || continue
    base_v=$(basename "$v" .png)
    review="$piece_dir${base_v}_review.jpg"
    if [[ ! -f "$review" ]] || [[ "$v" -nt "$review" ]]; then
      sips -Z 1200 -s formatOptions 85 -s format jpeg "$v" --out "$review" >/dev/null 2>&1 || true
    fi
    variants+=("\"$(echo "$review" | sed "s|^$OUT/||")\"")
  done

  # Find original source (search content/images for any extension)
  source_ext=""
  for ext in WEBP webp PNG png JPG jpg JPEG jpeg; do
    if [[ -f "content/images/${base}.${ext}" ]]; then
      source_ext="${base}.${ext}"
      break
    fi
  done
  src_review=""
  if [[ -n "$source_ext" ]]; then
    src_path="content/images/$source_ext"
    src_rev_file="$REVIEW/originals/${base}_source.jpg"
    mkdir -p "$REVIEW/originals"
    if [[ ! -f "$src_rev_file" ]] || [[ "$src_path" -nt "$src_rev_file" ]]; then
      sips -Z 1200 -s formatOptions 85 -s format jpeg "$src_path" --out "$src_rev_file" >/dev/null 2>&1 || true
    fi
    src_review="originals/${base}_source.jpg"
  fi

  if [[ ${#variants[@]} -eq 0 ]]; then continue; fi

  if [[ $FIRST -eq 0 ]]; then echo "," >> "$MANIFEST"; fi
  FIRST=0

  # The review HTML lives in scratch/upscale-review/, so paths to variants
  # need ../upscale-out/... prefix and paths to source-review stay relative.
  prefixed=()
  for v in "${variants[@]}"; do
    stripped=${v//\"/}
    prefixed+=("\"../upscale-out/$stripped\"")
  done
  variants_joined=$(IFS=,; echo "${prefixed[*]}")

  cat >> "$MANIFEST" <<EOF
  { "name": "$base", "source": "$src_review", "variants": [$variants_joined] }
EOF
done

echo ']}' >> "$MANIFEST"
echo "wrote $MANIFEST"
echo ""
echo "open: $REVIEW/index.html"
echo "      or run: python3 -m http.server -d $REVIEW 8000   (then http://localhost:8000)"
