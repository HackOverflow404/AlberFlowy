#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="AlberFlowy"
BUILD_DIR="build"
ASSET_DIR="assets"
API_DIR="api"
DEST_DIR="/usr/lib/x86_64-linux-gnu/albert"
DEST_DEPENDENCIES_DIR="${DEST_DIR}/${PLUGIN_NAME}"
TARGET_FILE="${PLUGIN_NAME}.so"
TARGET_PATH="${DEST_DIR}/${TARGET_FILE}"

for cmd in cmake make npm albert; do
  command -v "$cmd" >/dev/null || { echo "ERROR: '$cmd' not found in PATH"; exit 1; }
done

echo "[*] Cleaning previous build…"
umask 022
rm -rf "${BUILD_DIR}"
mkdir -p -m 755 "${BUILD_DIR}"
cd "${BUILD_DIR}"

echo "[*] Running CMake…"
cmake ..

echo "[*] Building plugin…"
make -j"$(nproc)"
cd ..

echo "[*] Installing plugin dependencies…"
sudo mkdir -p "${DEST_DEPENDENCIES_DIR}"
cd "${API_DIR}" && npm i && npm install -g . && cd - > /dev/null

echo "[*] Copying assets and .so…"
sudo cp "${ASSET_DIR}"/* "${DEST_DEPENDENCIES_DIR}/"
sudo cp "${BUILD_DIR}/${TARGET_FILE}" "${TARGET_PATH}"

echo "[✓] Plugin installed to ${TARGET_PATH}"

touch api/.wfconfig.json
workflowy auth

echo "[*] Launching Albert with QML debugger…"
albert --qmljsdebugger port:5555,block