#!/usr/bin/env bash

set -e

# echo "[*] Updating package list..."
# sudo apt update

ENV_FILE="api/.env"

if [[ -e $ENV_FILE ]]; then
  echo "Error: $ENV_FILE already exists. Move or remove it first." >&2
  exit 1
fi

echo "[*] Creating $ENV_FILE with your Workflowy credentials."
echo "[-] Input is hidden for all secret fields."
echo

prompt_secret() {
  local var="$1" prompt="$2"
  local value
  while :; do
    read -r -s -p "$prompt: " value
    echo
    if [[ -n $value ]]; then
      printf -v "$var" '%s' "$value"
      break
    fi
    echo "Value cannot be empty. Please try again." >&2
  done
}

prompt_secret WORKFLOWY_API_KEY   "WORKFLOWY_API_KEY"
prompt_secret CLIENT_EMAIL        "CLIENT_EMAIL (your Gmail address)"
prompt_secret GMAIL_APP_PASSWORD  "GMAIL_APP_PASSWORD (16-char app password - issued by google)"
prompt_secret WORKFLOWY_TOTP_SECRET "WORKFLOWY_TOTP_SECRET (Base32 - MFA code entered in 2FA apps)"

umask 177
tmp=$(mktemp "${ENV_FILE}.XXXX")

{
  printf 'WORKFLOWY_API_KEY=%s\n'   "$WORKFLOWY_API_KEY"
  printf 'CLIENT_EMAIL=%s\n'        "$CLIENT_EMAIL"
  printf 'GMAIL_APP_PASSWORD=%s\n'  "$GMAIL_APP_PASSWORD"
  printf 'WORKFLOWY_TOTP_SECRET=%s\n' "$WORKFLOWY_TOTP_SECRET"
} > "$tmp"

mv "$tmp" "$ENV_FILE"
echo "$ENV_FILE created with permissions 600."

echo "[*] Installing required packages..."
sudo apt install -y \
  build-essential \
  cmake \
  qtbase5-dev \
  qt6-base-dev \
  libgumbo-dev \
  nlohmann-json3-dev \
  pkg-config

cd api && npm i && cd ..

if ! command -v albert &> /dev/null; then
  echo "[!] Albert is not installed."
  echo "    Please install Albert from: https://albertlauncher.github.io/docs/installing/"
else
  echo "[*] Albert is already installed."
fi

echo "[✓] All dependencies installed and files created."

. build.sh