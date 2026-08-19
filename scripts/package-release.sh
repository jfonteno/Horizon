#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -p "JSON.parse(require('fs').readFileSync('${project_root}/package.json','utf8')).version")"
output_dir="${project_root}/releases"
archive="${output_dir}/Horizon_Shattered_Reach_Playtest_${version}.zip"

mkdir -p "${output_dir}"
rm -f "${archive}"
(
  cd "${project_root}"
  zip -q -r "${archive}" . \
    -x 'node_modules/*' 'dist/*' '.next/*' '.sites-runtime/*' \
       '.wrangler/*' '.git/*' 'releases/*' '*.log'
)
unzip -tq "${archive}"
echo "${archive}"
