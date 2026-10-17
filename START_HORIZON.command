#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Horizon requires Node.js 22 or newer. Install it from https://nodejs.org and try again."
  exit 1
fi
if [ ! -d node_modules ]; then npm install || exit 1; fi
export HORIZON_STANDALONE=1
node scripts/ensure-local-build.mjs || exit 1
export HOST=127.0.0.1
export PORT=3000
node scripts/open-horizon-when-ready.mjs &
npm run start:self-hosted
