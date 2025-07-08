#!/usr/bin/env bash

set -e

# echo "[*] Updating package list..."
# sudo apt update

echo "[*] Installing required packages..."
sudo apt install -y \
  build-essential \
  cmake \
  qtbase5-dev \
  qt6-base-dev \
  libgumbo-dev \
  nlohmann-json3-dev \
  pkg-config

if ! command -v albert &> /dev/null; then
  echo "[!] Albert is not installed."
  echo "    Please install Albert from: https://albertlauncher.github.io/docs/installing/"
else
  echo "[*] Albert is already installed."
fi

echo "[✓] All dependencies installed."

. build.sh