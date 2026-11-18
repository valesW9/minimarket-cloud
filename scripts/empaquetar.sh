#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/minimarket-cloud.zip
zip -qr dist/minimarket-cloud.zip src public database infrastructure monitoring docs scripts tests package.json buildspec.yml README.md .github .gitignore -x '*.pem' '.env' '*.key' '*/node_modules/*' '*/.aws/*'
echo "Archivo listo en dist/minimarket-cloud.zip"
