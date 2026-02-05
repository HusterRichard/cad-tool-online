#!/bin/bash
# Build script for chili-geo WASM module
# Prerequisites: Emscripten SDK installed and activated

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
OUTPUT_DIR="${SCRIPT_DIR}/../wasm"

echo "=== Building chili-geo WASM module ==="

# Check Emscripten
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten not found. Please install and activate emsdk first."
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk && ./emsdk install latest && ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

# Create build directory
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

# Configure with CMake
echo "Configuring..."
emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release

# Build
echo "Building..."
emmake make -j$(nproc 2>/dev/null || echo 4)

# Copy output
echo "Copying output files..."
mkdir -p "${OUTPUT_DIR}"
cp chili-geo.js chili-geo.wasm "${OUTPUT_DIR}/"

echo "=== Build completed ==="
echo "Output files:"
echo "  ${OUTPUT_DIR}/chili-geo.js"
echo "  ${OUTPUT_DIR}/chili-geo.wasm"
