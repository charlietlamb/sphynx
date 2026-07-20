#!/usr/bin/env bash
set -euo pipefail

KEEP=${1:-15}

bunx vercel@latest vcr image ls server --limit 100 --format json 2>/dev/null |
  python3 -c "
import json, sys
raw = sys.stdin.read()
data = json.loads(raw[raw.index('{'):])
images = sorted(data.get('images') or [], key=lambda image: image['createdAt'], reverse=True)
for image in images[int('$KEEP'):]:
    print(image['id'])
" |
  while read -r id; do
    bunx vercel@latest vcr image rm server "$id" --yes
  done
