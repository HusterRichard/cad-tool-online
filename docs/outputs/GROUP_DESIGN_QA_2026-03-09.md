# Group Design QA Alignment
Date: 2026-03-09
Project: CadToolOnline

## Automated Coverage

| Flow | Coverage | Location |
|---|---|---|
| State reconstruction and owner lookup | Automated | `packages/core/test/group-design.spec.ts` |
| Name normalization and rename | Automated | `packages/core/test/group-design.spec.ts` |
| Create group and member rehome | Automated | `packages/core/test/group-design.spec.ts` |
| Move part/group and invalid descendant move block | Automated | `packages/core/test/group-design.spec.ts` |
| Ungroup | Automated | `packages/core/test/group-design.spec.ts` |
| Clean empty groups | Automated | `packages/core/test/group-design.spec.ts` |
| Delete empty / blocked groups | Automated | `packages/core/test/group-design.spec.ts` |
| Export / import group schema round-trip | Automated | `packages/core/test/group-design.spec.ts` |
| Group nodes in model browser | Automated | `packages/core/test/model-browser.spec.ts` |
| Group mass aggregation math | Automated | `packages/core/test/mass-aggregation.spec.ts` |

## Manual Regression Checklist

- Load a CAD model and verify the Objects tree shows group nodes and ungrouped parts.
- Ctrl-select parts in the tree, create a group, then rename it.
- Create a child group under an existing group.
- Move `part -> group`, `part -> root`, and `group -> group` from the tree context menu or drag and drop.
- Repeat the same moves with tree drag and drop.
- Ungroup a group and verify direct members and child groups are lifted to the parent level, or to root/ungrouped when the group is a root group.
- Run clean group and verify only empty unreferenced groups are removed.
- Delete an empty group.
- Attempt to delete a referenced group and verify it is blocked.
- Attempt to delete a referenced part and verify it is blocked.
- Create a Marker after grouping and verify it stores the owner group.
- Create a RefFrame after grouping and verify it stores the owner group.
- Create a DesignPoint after grouping and verify it stores the owner group.
- Export config, clear the scene, import config, and verify the group hierarchy, dependencies, and post-import editability remain intact.
- Select a group and verify the properties panel shows aggregated mass, center of mass, and inertia.

## Verification Commands

```powershell
pnpm --filter @cadtool-online/core test:run
pnpm --filter @cadtool-online/core build
pnpm exec vite build
pnpm run build:extension
```
