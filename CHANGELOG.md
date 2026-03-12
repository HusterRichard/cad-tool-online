# Changelog

All notable changes to this project will be documented in this file.

## 2026-03-12

### Added

- Added package-level Three.js visualizer tests and root `tests/` runners for extension, webview, and STEP import coverage.
- Added shared STEP/WASM integration helpers and real fixture-based color and hierarchy regression tests under `tests/integration/step-import/`.

### Changed

- Changed the test layout to keep package-owned unit tests near source code while moving cross-package and fixture-heavy tests into the root `tests/` tree.
- Changed test documentation and root package scripts to document and execute package-local plus root-level automated test suites together.

## 2026-03-11

### Added

- Added circular-edge hover snapping so marker placement prefers circle centers and renders circular guide overlays.
- Added cylindrical hover guides with explicit axis span, snap circle center, and runtime coverage for OCCT face picking metadata.

### Changed

- Changed marker and frame editing hover handling to reuse inferred placement guides while suppressing normal scene selection during interactive placement.
- Changed frame visualization tests and viewer guide rendering to cover higher-contrast marker helper overlays.

### Fixed

- Fixed frame edit mode so marker/reference marker repositioning keeps the same assisted hover behavior as marker creation.
