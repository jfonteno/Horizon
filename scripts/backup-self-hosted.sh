#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_dir="${HORIZON_DATA_DIR:-${project_root}/data/rooms}"
data_root="${HORIZON_DATA_ROOT:-$(dirname "${data_dir}")}"
content_dir="${HORIZON_CONTENT_DIR:-${data_root}/content}"
account_dir="${HORIZON_ACCOUNT_DIR:-${data_root}/accounts}"
operations_dir="$(dirname "${HORIZON_OPERATIONS_PATH:-${data_root}/operations/settings.json}")"
backup_dir="${HORIZON_BACKUP_DIR:-${project_root}/backups}"
retention_days="${HORIZON_BACKUP_RETENTION_DAYS:-14}"

if [[ ! "${retention_days}" =~ ^[0-9]+$ ]]; then
  echo "HORIZON_BACKUP_RETENTION_DAYS must be a non-negative integer." >&2
  exit 64
fi
if [[ ! -d "${data_dir}" ]]; then
  echo "Room data directory does not exist: ${data_dir}" >&2
  exit 66
fi
if [[ "$(dirname "${content_dir}")" != "${data_root}" ]]; then
  echo "HORIZON_CONTENT_DIR must be directly beneath HORIZON_DATA_ROOT for atomic backups." >&2
  exit 64
fi
if [[ "$(dirname "${account_dir}")" != "${data_root}" ]]; then
  echo "HORIZON_ACCOUNT_DIR must be directly beneath HORIZON_DATA_ROOT for atomic backups." >&2
  exit 64
fi
if [[ "$(dirname "${operations_dir}")" != "${data_root}" ]]; then
  echo "HORIZON_OPERATIONS_PATH must be within a directory directly beneath HORIZON_DATA_ROOT for atomic backups." >&2
  exit 64
fi

mkdir -p "${backup_dir}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${backup_dir}/horizon-data-${timestamp}.tar.gz"
members=("$(basename "${data_dir}")")
if [[ -d "${content_dir}" ]]; then members+=("$(basename "${content_dir}")"); fi
if [[ -d "${account_dir}" ]]; then members+=("$(basename "${account_dir}")"); fi
if [[ -d "${operations_dir}" ]]; then members+=("$(basename "${operations_dir}")"); fi
if [[ -f "${data_root}/auth-secret" ]]; then members+=("auth-secret"); fi
tar -C "${data_root}" -czf "${archive}" "${members[@]}"
find "${backup_dir}" -maxdepth 1 -type f \( -name 'horizon-data-*.tar.gz' -o -name 'horizon-rooms-*.tar.gz' \) -mtime "+${retention_days}" -delete
echo "${archive}"
