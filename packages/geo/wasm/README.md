# WASM Output Directory

This directory contains the compiled WebAssembly files for the geometry module.

## Files

- `cad-geo.js` - ES6 module loader for the WASM module
- `cad-geo.wasm` - WebAssembly binary
- `cad-geo.d.ts` - TypeScript type definitions

## Building

### Prerequisites

- CMake >= 3.30
- Ninja build system
- Git

### Setup Dependencies

First, setup Emscripten SDK and OCCT source:

```bash
pnpm setup:wasm
```

This will:
1. Clone Emscripten SDK (v4.0.8)
2. Clone OCCT V8_0_0_rc3 source code
3. Install and activate Emscripten

### Build WASM Module

**Release build (recommended):**
```bash
pnpm build:wasm
```

**Debug build:**
```bash
pnpm build:wasm:debug
```

Or manually:
```bash
cd packages/geo/cpp
cmake --preset release
cmake --build --preset release
```

### Using Build Scripts

**Windows:**
```cmd
cd packages\geo\cpp
build_wasm.bat release
```

**Linux/macOS:**
```bash
cd packages/geo/cpp
./build_wasm.sh release
```

## OCCT Modules Included

The following OCCT toolkits are compiled into the WASM module:

- **FoundationClasses**: TKernel, TKMath
- **ModelingData**: TKG2d, TKG3d, TKGeomBase, TKBRep
- **ModelingAlgorithms**: TKGeomAlgo, TKTopAlgo, TKPrim, TKBO, TKBool, TKHLR, TKFillet, TKOffset, TKFeat, TKMesh, TKShHealing
- **Visualization**: TKService, TKV3d
- **ApplicationFramework**: TKCDF, TKLCAF, TKCAF, TKStdL, TKStd, TKVCAF, TKBin, TKBinL
- **DataExchange**: TKDE, TKXSBase, TKXCAF, TKDESTEP, TKDEIGES, TKDESTL

## Memory Configuration

- Stack size: 8MB
- Initial heap: 64MB
- Maximum memory: 4GB
- Memory growth: Enabled

## Note

The WASM files are not committed to the repository due to their size.
They need to be built locally or downloaded from releases.
