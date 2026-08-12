#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/go-whatsapp-web-multidevice/src"

echo "Run / Build Go WhatsApp (no Docker)"

if ! command -v go >/dev/null 2>&1; then
  echo "Error: 'go' is not installed or not in PATH. Install Go 1.24+ and retry." >&2
  exit 2
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Warning: 'ffmpeg' not found. Media processing may fail." >&2
fi

cd "$SRC_DIR"

case "${1-}" in
  build)
    echo "Building binary..."
    go build -o whatsapp
    echo "Built: $SRC_DIR/whatsapp"
    exit 0
    ;;
  *)
    # Default: run in REST mode. Pass extra args through.
    if [ -x ./whatsapp ]; then
      echo "Starting existing binary: ./whatsapp rest ${*:1}"
      exec ./whatsapp rest "${@:1}"
    else
      echo "No binary found; running with 'go run'"
      exec go run . rest "${@:1}"
    fi
    ;;
esac
