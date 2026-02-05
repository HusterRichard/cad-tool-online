#!/bin/bash
# Build script for cad-geo WASM module
# Prerequisites: Run setup_wasm_deps.mjs first

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
EMSDK_DIR="${BUILD_DIR}/emsdk"

echo "=== Building cad-geo WASM module ==="

# Check if dependencies are set up
if [ ! -d "${EMSDK_DIR}" ]; then
    echo "Error: Emscripten SDK not found. Please run setup first:"
    echo "  pnpm setup:wasm"
    exit 1
fi

if [ ! -d "${BUILD_DIR}/occt" ]; then
    echo "Error: OCCT not found. Please run setup first:"
    echo "  pnpm setup:wasm"
    exit 1
fi

# Activate Emscripten
echo "Activating Emscripten..."
source "${EMSDK_DIR}/emsdk_env.sh"

cd "${SCRIPT_DIR}"

# Build type (default: release)
BUILD_TYPE="${1:-release}"

echo "Building ${BUILD_TYPE} configuration..."

# Configure and build using CMake presets
cmake --preset "${BUILD_TYPE}"
cmake --build --preset "${BUILD_TYPE}"

echo "=== Build completed ==="
echo "Output files in: ${SCRIPT_DIR}/../wasm/"
ls -la "${SCRIPT_DIR}/../wasm/"
