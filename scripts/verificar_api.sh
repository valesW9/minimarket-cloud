#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:3000}"
printf 'Salud: ';curl -fsS "${BASE}/health";printf '\nProductos: ';curl -fsS "${BASE}/api/products";printf '\n'
