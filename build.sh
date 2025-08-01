#!/usr/bin/env bash
set -Eeuo pipefail

PLUGIN_NAME="AlberFlowy"
BUILD_DIR="build"
ASSET_DIR="assets"
API_DIR="api"
DEST_DIR="/usr/lib/x86_64-linux-gnu/albert"
DEST_DEPENDENCIES_DIR="${DEST_DIR}/${PLUGIN_NAME}"

echo "[*] Installing JS dependencies locally…"
cd "$API_DIR"
npm ci --quiet               # never use sudo here
npm link                      # creates a *user-level* symlink for cli testing
cd - >/dev/null

echo "[*] Installing system files…"
sudo mkdir -p "$DEST_DEPENDENCIES_DIR"
sudo cp "$ASSET_DIR"/* "$DEST_DEPENDENCIES_DIR/"

echo "[*] Building C++ plugin…"
rm -rf "$BUILD_DIR"
cmake -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD_DIR" --parallel
sudo cmake --install "$BUILD_DIR"

CONFIG_FILE="$API_DIR/.wfconfig.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "{}" > "$CONFIG_FILE"
  workflowy auth         # uses local dotenv & node_modules
else
  echo "[*] Existing .wfconfig.json found – skipping auth."
fi

echo "[*] Launching Albert"
albert