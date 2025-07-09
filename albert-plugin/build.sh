#!/usr/bin/env bash

set -euo pipefail

PLUGIN_NAME="AlberFlowy"

BUILD_DIR="build"
API_DIR="api"
ASSET_DIR="assets"
DIST_DIR="dist"
CONFIG_FILE=".wfconfig.json"

DEST_DIR="/usr/lib/x86_64-linux-gnu/albert"
DEST_DEPENDENCIES_DIR="${DEST_DIR}/${PLUGIN_NAME}"

TARGET_FILE="${PLUGIN_NAME}.so"
TARGET_PATH="${DEST_DIR}/${TARGET_FILE}"

echo "[*] Bundling JS"
npx esbuild api/workflowy-cli.js --bundle --platform=node --format=esm --external:fs --external:dotenv --outfile=dist/workflowy-cli.bundle.js

echo "[*] Cleaning previous build..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

echo "[*] Running CMake..."
cmake ..

echo "[*] Building plugin..."
make -j"$(nproc)"
cd ..

echo "[*] Copying ${TARGET_FILE} and dependencies to Albert plugin directory..."
sudo mkdir -p "${DEST_DEPENDENCIES_DIR}"
sudo cp ${API_DIR}/* "${DEST_DEPENDENCIES_DIR}/"
sudo cp "${API_DIR}/${CONFIG_FILE}" "${DEST_DEPENDENCIES_DIR}/"
sudo cp ${ASSET_DIR}/* "${DEST_DEPENDENCIES_DIR}/"
sudo cp ${DIST_DIR}/* "${DEST_DEPENDENCIES_DIR}/"
sudo cp "${BUILD_DIR}/${TARGET_FILE}" "${TARGET_PATH}"

echo "[✓] Plugin installed to ${TARGET_PATH}"

echo "[*] Launching Albert with QML debugger on port 5555..."
albert --qmljsdebugger port:5555[,block]
