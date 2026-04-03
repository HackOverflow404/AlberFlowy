#!/usr/bin/env bash
set -euo pipefail

# ---- SAFETY GUARD ----------------------------------------------------------
if [[ "$EUID" -eq 0 ]]; then
  echo "ERROR: Do NOT run install.sh as root. The script uses sudo only for the commands that need it."
  exit 1
fi
# ---------------------------------------------------------------------------

echo "[*] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y \
  build-essential \
  cmake \
  pkg-config \
  qt6-base-dev \
  libgumbo-dev \
  nlohmann-json3-dev \
  qcoro-qt6-dev

if ! command -v node >/dev/null 2>&1; then
  echo "[*] Node.js not found. Installing via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo

ENV_FILE="api/.env"

prompt_secret() {
  local var="$1" prompt="$2"
  local val
  while :; do
    read -srp "$prompt: " val
    echo
    [[ -n $val ]] && { printf -v "$var" '%s' "$val"; break; }
    echo "Cannot be empty." >&2
  done
}

if [[ ! -f "$ENV_FILE" ]]; then
  prompt_secret WORKFLOWY_API_KEY     "WORKFLOWY_API_KEY (can be created at https://workflowy.com/api-key/)"
  prompt_secret WORKFLOWY_TOTP_SECRET "WORKFLOWY_TOTP_SECRET (the secret key entered into TOTP apps)"
  prompt_secret CLIENT_EMAIL          "CLIENT_EMAIL (your WorkFlowy account email)"

  umask 177
  tmp=$(mktemp "${ENV_FILE}.XXXX")
  {
    printf 'WORKFLOWY_API_KEY=%s\n'     "$WORKFLOWY_API_KEY"
    printf 'WORKFLOWY_TOTP_SECRET=%s\n' "$WORKFLOWY_TOTP_SECRET"
    printf 'CLIENT_EMAIL=%s\n'          "$CLIENT_EMAIL"
  } > "$tmp"
  mv "$tmp" "$ENV_FILE"
  umask 022
  echo "[✓] Created $ENV_FILE with 600 perms."
else
  echo "[*] Existing $ENV_FILE found – skipping secret prompts."
fi

if ! command -v albert >/dev/null 2>&1; then
  echo "[!] Albert not found; install from https://albertlauncher.github.io/"
else
  echo "[✓] Albert detected."
fi

chmod +x build.sh
echo "[*] Running build.sh..."
./build.sh
