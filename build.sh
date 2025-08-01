#!/usr/bin/env bash
# set -Eeuo pipefail
# trap 'echo "❌  Error on line $LINENO: $BASH_COMMAND"; exit 1' ERR
# set -o xtrace   # comment out when it’s stable

PLUGIN_NAME="AlberFlowy"
BUILD_DIR="build"
ASSET_DIR="assets"
API_DIR="api"
DEST_DIR="/usr/lib/x86_64-linux-gnu/albert"
DEST_DEPENDENCIES_DIR="${DEST_DIR}/${PLUGIN_NAME}"
TARGET_FILE="${PLUGIN_NAME}.so"
TARGET_PATH="${DEST_DIR}/${TARGET_FILE}"
CONFIG_FILE="${API_DIR}/.wfconfig.json"

echo "[*] Installing plugin dependencies…"
sudo mkdir -p "${DEST_DEPENDENCIES_DIR}"
cd "${API_DIR}" && npm i && sudo npm install -g .
cd - > /dev/null

echo "[*] Copying assets and .so…"
sudo cp "${ASSET_DIR}"/* "${DEST_DEPENDENCIES_DIR}/"

echo "[*] Cleaning previous build…"
rm -rf "${BUILD_DIR}"
echo "[*] Running CMake…"
cmake -B "${BUILD_DIR}" -DCMAKE_BUILD_TYPE=Release
echo "[*] Building plugin…"
cmake --build "${BUILD_DIR}" --parallel
echo "[*] Installing plugin…"
sudo cmake --install "${BUILD_DIR}"

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "[*] Initialising Workflowy config and running auth…"
  echo "{}" | tee "${CONFIG_FILE}" >/dev/null
  workflowy auth
else
  echo "[*] Existing .wfconfig.json found – skipping auth."
fi

echo "[*] Launching Albert"
albert