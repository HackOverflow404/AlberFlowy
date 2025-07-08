#!/usr/bin/env bash

set -euo pipefail

PLUGIN_NAME="AlberFlowy"
BUILD_DIR="build"
DEST_DIR="/usr/lib/x86_64-linux-gnu/albert"
TARGET_FILE="${PLUGIN_NAME}.so"
TARGET_PATH="${DEST_DIR}/${TARGET_FILE}"

echo "[*] Cleaning previous build..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

echo "[*] Running CMake..."
cmake ..

echo "[*] Building plugin..."
make -j"$(nproc)"

echo "[*] Copying ${TARGET_FILE} to Albert plugin directory..."
sudo cp "${TARGET_FILE}" "${TARGET_PATH}"

echo "[✓] Plugin installed to ${TARGET_PATH}"

echo "[*] Launching Albert with QML debugger on port 5555..."
albert --qmljsdebugger port:5555[,block]