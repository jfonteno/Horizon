#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
archive="${1:-}"
data_dir="${HORIZON_DATA_DIR:-${project_root}/data/rooms}"
data_root="${HORIZON_DATA_ROOT:-$(dirname "${data_dir}")}"
content_dir="${HORIZON_CONTENT_DIR:-${data_root}/content}"

if [[ -z "${archive}" || ! -f "${archive}" ]]; then
  echo "Usage: HORIZON_RESTORE_CONFIRM=YES npm run restore:self-hosted -- /path/to/backup.tar.gz" >&2
  exit 64
fi
if [[ "${HORIZON_RESTORE_CONFIRM:-}" != "YES" ]]; then
  echo "Restore refused. Stop Horizon, then set HORIZON_RESTORE_CONFIRM=YES." >&2
  exit 77
fi
if [[ "$(dirname "${content_dir}")" != "${data_root}" ]]; then
  echo "HORIZON_CONTENT_DIR must be directly beneath HORIZON_DATA_ROOT for restore." >&2
  exit 64
fi

parent="${data_root}"
name="$(basename "${data_dir}")"
content_name="$(basename "${content_dir}")"
if ! tar -tzf "${archive}" >/dev/null; then
  echo "Backup is not a readable gzip archive." >&2
  exit 65
fi

valid_archive=true
while IFS= read -r entry; do
  if [[ "${entry}" != "${name}" && "${entry}" != "${name}/" && "${entry}" != "${name}/"* &&
        "${entry}" != "${content_name}" && "${entry}" != "${content_name}/" && "${entry}" != "${content_name}/"* ]] ||
     [[ "${entry}" == "../"* || "${entry}" == *"/../"* || "${entry}" == *"/.." ]]; then
    valid_archive=false
    break
  fi
done < <(tar -tzf "${archive}")
while IFS= read -r listing; do
  kind="${listing:0:1}"
  if [[ "${kind}" != "-" && "${kind}" != "d" ]]; then
    valid_archive=false
    break
  fi
done < <(tar -tvzf "${archive}")

if [[ "${valid_archive}" != "true" ]]; then
  echo "Backup contains paths outside the expected ${name}/ and ${content_name}/ directories." >&2
  exit 65
fi

mkdir -p "${parent}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
for current in "${data_dir}" "${content_dir}"; do
  if [[ -d "${current}" ]]; then
    previous="${current}.pre-restore.${timestamp}"
    mv "${current}" "${previous}"
    echo "Existing data preserved at ${previous}"
  fi
done
tar -C "${parent}" -xzf "${archive}"
echo "Restored ${archive} to ${data_root}"
