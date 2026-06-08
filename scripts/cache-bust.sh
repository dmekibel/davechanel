#!/usr/bin/env bash
# Stamp a fresh version onto index.html assets and every relative ES-module import
# so browsers always fetch the latest files (no-build site, no bundler).
# Usage: scripts/cache-bust.sh [version]   (defaults to a timestamp)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
V="${1:-$(date +%s)}"

# index.html: bump ?v= on local css/js asset links
perl -0pi -e "s{(href|src)=\"((?:css|js)/[^\"?]+\.(?:css|js))(?:\?v=[^\"]*)?\"}{\$1=\"\$2?v=$V\"}g" index.html

# browser ES modules (exclude *.test.js so Node tests still resolve): version relative .js imports
while IFS= read -r f; do
  perl -0pi -e "s{((?:from\s+|import\(\s*)[\"'])(\.\.?/[^\"']+?\.js)(?:\?v=[^\"']*)?([\"'])}{\$1\$2?v=$V\$3}g" "$f"
done < <(find js -name '*.js' -not -name '*.test.js')

echo "cache-busted to v=$V"
