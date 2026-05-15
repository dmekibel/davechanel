#!/usr/bin/env bash
# Batch-run upscale-gpt2.mjs on the remaining 7 pieces (IMG_9675 already done).
# Logs each run to scratch/upscale-out/batch.log
set -e
cd "$(dirname "$0")/.."

LOG=scratch/upscale-out/batch.log
mkdir -p scratch/upscale-out
echo "=== batch start $(date) ===" > "$LOG"

TARGETS=(
  content/images/IMG_1222.JPG
  content/images/IMG_1267.JPG
  content/images/IMG_1268.JPG
  content/images/IMG_1270.JPG
  content/images/IMG_9670.JPG
  content/images/IMG_9739.JPG
)

for i in "${!TARGETS[@]}"; do
  f="${TARGETS[$i]}"
  n=$((i + 1))
  echo "" | tee -a "$LOG"
  echo "[$n/${#TARGETS[@]}] $(basename "$f")" | tee -a "$LOG"
  echo "" | tee -a "$LOG"
  node scripts/upscale-gpt2.mjs "$f" 2>&1 | tee -a "$LOG"
done

echo "" | tee -a "$LOG"
echo "=== batch done $(date) ===" | tee -a "$LOG"
