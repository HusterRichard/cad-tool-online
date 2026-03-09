# Group Design Delivery Status
Date: 2026-03-09
Project: CadToolOnline

## Completed By Phase

### Phase 1
- Hierarchical group state is active in the webview.
- Group data now tracks parent/child relations, ungrouped parts, selected nodes, and group kind/order.
- Group ownership resolution is no longer based only on the last created group.

### Phase 2
- Model tree shows real group nodes.
- Tree supports Ctrl multi-select for parts and groups.
- Tree supports right-click actions for create group, move, ungroup, delete, and properties.
- Tree supports drag and drop:
  - part -> group
  - group -> group
  - part/group -> root objects category

### Phase 3
- Implemented commands:
  - create group
  - create child group
  - rename group
  - create default group for ungrouped parts only
  - clean empty groups only
  - move selected parts/groups
  - ungroup selected group
  - delete selected parts/groups with dependency checks
- Ribbon routes the main group commands; tree context menu routes hierarchy/edit commands; Delete key routes delete.

### Phase 4
- Group properties panel now shows:
  - id
  - name
  - parent
  - child count
  - direct member count
  - total part count
  - total mass
  - volume
  - derived density
  - center of mass
  - inertia matrix
- Marker / RefFrame / DesignPoint creation resolves owning group before storing `groupId`.
- Group delete is blocked when referenced by marker/ref frame/design point.
- Part delete is blocked when referenced by marker/ref frame/design point/joint/fluid objects.

### Phase 5
- Export writes hierarchical group fields:
  - `parentRef`
  - `kind`
  - `order`
- Import supports both:
  - legacy flat group schema
  - hierarchical group schema
- Import/export keeps group tree structure for continued editing.

### Phase 6
- Added unit coverage in `packages/core` for:
  - group state reconstruction
  - name normalization and rename
  - group command workflow:
    - create
    - move
    - ungroup
    - clean empty
    - safe delete
  - group schema export/import round-trip
  - model browser group nodes
  - mass aggregation math
- Added baseline ADR/schema documentation and QA alignment notes for current implementation status.

## Manual QA Checklist

- Load a STEP model and confirm group tree appears under the Objects category.
- Ctrl-select multiple parts in the tree and create a new group.
- Select a group and create a child group.
- Rename a selected group from the tree context menu.
- Use Move To from the tree context menu or drag and drop and move:
  - part -> group
  - group -> group
  - selection -> root
- Drag selected part/group nodes to another group.
- Drag selected part/group nodes to the Objects root category.
- Ungroup a group and verify members move to the parent level, or to ungrouped/root when the group is at the root.
- Create default groups and confirm only ungrouped parts are affected.
- Clean groups and confirm only empty groups are removed.
- Delete an empty unreferenced group.
- Attempt to delete a referenced group and confirm deletion is blocked.
- Attempt to delete a referenced part and confirm deletion is blocked.
- Export config, clear scene, import config, and confirm:
  - group hierarchy is restored
  - marker/ref frame/design point group references are preserved
  - move/ungroup/delete still work after re-import
- Select a group and verify aggregated mass, center of mass, and inertia are shown.

## Known Limits

- Group physical aggregation currently computes synchronously from per-part OCCT mass properties. It is accurate enough for UI usage, but not yet batched through the mass worker cache.
- Group deletion only supports empty groups. Non-empty group delete-to-parent flattening is not implemented.
- Joint and motion ownership are still part-oriented, not fully group-oriented.
- There is no dedicated automated webview integration test suite yet. Current regression coverage is concentrated in `packages/core`.
