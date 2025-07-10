#!/usr/bin/env bash

set -euo pipefail

PLUGIN_NAME="AlberFlowy"

BUILD_DIR="build"
ASSET_DIR="assets"
API_DIR="api/workflowy-cli.js"

DEST_DIR="/usr/lib/x86_64-linux-gnu/albert"
DEST_DEPENDENCIES_DIR="${DEST_DIR}/${PLUGIN_NAME}"

TARGET_FILE="${PLUGIN_NAME}.so"
TARGET_PATH="${DEST_DIR}/${TARGET_FILE}"

printf "[*] Cleaning previous build..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

printf "\n\n\n[*] Running CMake...\n\n\n"
cmake ..

printf "\n\n\n[*] Building plugin...\n\n\n"
make -j"$(nproc)"
cd ..

printf "\n\n\n[*] Copying ${TARGET_FILE} and dependencies to Albert plugin directory...\n\n\n"
sudo mkdir -p "${DEST_DEPENDENCIES_DIR}"
cd ${API_DIR} && npm install -g . && cd - > /dev/null
sudo cp ${ASSET_DIR}/* "${DEST_DEPENDENCIES_DIR}/"
sudo cp "${BUILD_DIR}/${TARGET_FILE}" "${TARGET_PATH}"

printf "\n\n\n[✓] Plugin installed to ${TARGET_PATH}"

printf "\n\n\n[*] Launching Albert with QML debugger on port 5555...\n\n\n"
albert --qmljsdebugger port:5555[,block]