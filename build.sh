#!/usr/bin/env bash
set -Eeuo pipefail

PLUGIN_NAME="AlberFlowy"
BUILD_DIR="build"
ASSET_DIR="assets"
API_DIR="api"
DEST_DIR="/usr/lib/x86_64-linux-gnu/albert"
DEST_DEPENDENCIES_DIR="${DEST_DIR}/${PLUGIN_NAME}"

echo "[*] Installing JS dependencies..."
cd "$API_DIR"
npm ci --prefer-offline --no-audit --no-fund --quiet

echo "[*] Installing workflowy CLI..."
if npm install -g . --quiet 2>/dev/null; then
  echo "[✓] Installed workflowy CLI (user prefix)"
else
  sudo npm install -g . --quiet
  echo "[✓] Installed workflowy CLI (system prefix)"
fi
cd - >/dev/null

echo "[*] Installing system files..."
sudo mkdir -p "$DEST_DEPENDENCIES_DIR"
sudo cp "$ASSET_DIR"/* "$DEST_DEPENDENCIES_DIR/"

echo "[*] Building C++ plugin..."
rm -rf "$BUILD_DIR"
cmake -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
cmake --build "$BUILD_DIR" --parallel "$(nproc)"
sudo cmake --install "$BUILD_DIR"

CONFIG_FILE="$API_DIR/.wfconfig.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "{}" > "$CONFIG_FILE"
  workflowy auth
else
  echo "[*] Existing .wfconfig.json found – skipping auth."
fi

echo "[✓] Build complete. Launching Albert..."
albert
