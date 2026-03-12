# Changelog

All notable changes to this project will be documented in this file.

## 2026-03-12

### Changed

- Changed group ungrouping so selected groups now lift their parts and child groups back to the root `物体` node.
- Changed the model tree after STEP import so all nodes start collapsed and imported assemblies are materialized as selectable `imported` groups.

### Fixed

- Fixed default grouping so it only collects currently ungrouped parts instead of reparenting parts that already belong to other groups.
- Fixed group property rendering so selected groups use the `属性-零件` panel title and show `类型=分组`.
- Fixed group cleanup so Ribbon `清理` only removes empty unreferenced groups while `分解` handles deleting the selected group.

## 2026-03-11

### Added

- Added circular-edge hover snapping so marker placement prefers circle centers and renders circular guide overlays.
- Added cylindrical hover guides with explicit axis span, snap circle center, and runtime coverage for OCCT face picking metadata.

### Changed

- Changed marker and frame editing hover handling to reuse inferred placement guides while suppressing normal scene selection during interactive placement.
- Changed frame visualization tests and viewer guide rendering to cover higher-contrast marker helper overlays.

### Fixed

- Fixed frame edit mode so marker/reference marker repositioning keeps the same assisted hover behavior as marker creation.
