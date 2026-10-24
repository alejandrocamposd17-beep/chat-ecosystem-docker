#!/usr/bin/env bash
# ===========================================================
# Compara las imagenes basicas (una etapa) contra las optimizadas
# (multi-stage): tamano, numero de capas, tiempo de build en frio
# y tiempo de rebuild despues de cambiar el codigo.
#
# Uso:   ./compare-images.sh
# Salida: tabla en consola y en image-comparison.md
# Nota:  hace 8 builds; puede tardar varios minutos.
# ===========================================================
set -euo pipefail
cd "$(dirname "$0")"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000/api}"
MARKER=".cache-test"
RESULTS=()

# Construye una imagen y devuelve los segundos que tardo
build_time() {
  local tag=$1 dockerfile=$2 context=$3; shift 3
  local start end
  start=$(date +%s)
  docker build -q -t "$tag" -f "$context/$dockerfile" "$@" "$context" >/dev/null
  end=$(date +%s)
  echo $(( end - start ))
}

measure() {
  local label=$1 tag=$2 dockerfile=$3 context=$4; shift 4

  echo ">> [$label] build en frio (sin cache)..." >&2
  local cold
  cold=$(build_time "$tag" "$dockerfile" "$context" --no-cache "$@")

  # Simula un cambio en el codigo fuente sin tocar archivos del proyecto
  echo ">> [$label] rebuild tras un cambio en el codigo..." >&2
  date +%s%N > "$context/$MARKER"
  local warm
  warm=$(build_time "$tag" "$dockerfile" "$context" "$@")
  rm -f "$context/$MARKER"

  local bytes size layers
  bytes=$(docker image inspect -f '{{.Size}}' "$tag")
  size=$(awk -v b="$bytes" 'BEGIN { printf "%.0f MB", b / 1000 / 1000 }')
  layers=$(docker image inspect -f '{{len .RootFS.Layers}}' "$tag")

  RESULTS+=("| $label | \`$tag\` | $size | $layers | ${cold}s | ${warm}s |")
}

trap 'rm -f frontend/$MARKER backend/$MARKER' EXIT

measure "Frontend basico"     chat-web:basic Dockerfile.basic frontend --build-arg "NEXT_PUBLIC_API_URL=$API_URL"
measure "Frontend multi-stage" chat-web:1.0  Dockerfile       frontend --build-arg "NEXT_PUBLIC_API_URL=$API_URL"
measure "Backend basico"      chat-api:basic Dockerfile.basic backend
measure "Backend multi-stage" chat-api:1.0   Dockerfile       backend

{
  echo "| Imagen | Tag | Tamaño | Capas | Build en frío | Rebuild tras cambio de código |"
  echo "|---|---|---|---|---|---|"
  printf '%s\n' "${RESULTS[@]}"
  echo
  echo "_Medido el $(date '+%Y-%m-%d') con $(docker --version)._"
} | tee image-comparison.md

echo
echo "Resultados guardados en image-comparison.md"
