# Group Design Baseline
Date: 2026-03-09
Project: CadToolOnline

## ADR

- Decision: keep the imported CAD assembly tree and the editable MBS group tree as separate structures.
- Reason: the CAD tree reflects source geometry hierarchy, while group design needs an editable ownership tree for multi-body design objects.
- Consequence: all grouping actions operate on `GroupDesignState`, and the model browser composes the visible Objects tree from group nodes plus ungrouped parts.

## State Model

```text
idle
  -> group-create
  -> move
  -> delete
  -> idle
```

```ts
interface GroupDesignState {
  groupsById: Record<string, GroupNode>;
  rootGroupIds: string[];
  ungroupedPartIds: string[];
  selectedNodeIds: string[];
  activeMode: 'idle' | 'group-create' | 'move' | 'delete';
}

interface GroupNode {
  id: string;
  name: string;
  parentGroupId: string | null;
  childGroupIds: string[];
  memberPartIds: string[];
  kind: 'manual' | 'default' | 'imported';
  order: number;
  createdAt: string;
}
```

## Command Model

- `createGroup`: create a manual group from selected parts and rehome members from previous owners.
- `createChildGroup`: same command shape as `createGroup`, with the current group as `parentGroupId`.
- `renameGroup`: normalize to a Modelica-safe identifier and resolve collisions with `_1`, `_2`, ... suffixes.
- `moveToGroup`: supports `part -> group`, `part -> root`, `group -> group`, and blocks self/descendant targets.
- `ungroupGroup`: lifts direct members and child groups to the parent level, while blocking referenced groups.
- `cleanGroup`: removes empty leaf groups only, skipping referenced groups.
- `createDefaultGroup`: creates default groups from `ungroupedPartIds` only.
- `deleteSelection`: deletes safe parts and empty unreferenced groups only, while cleaning runtime caches and selections.

## Import / Export Schema

Legacy schema remains readable:

```json
{
  "group": [
    { "name": "Group1", "parts": ["PartA", "PartB"] }
  ]
}
```

Current export schema adds hierarchy metadata:

```json
{
  "group": [
    {
      "name": "RootGroup",
      "parts": ["PartA"],
      "parentRef": null,
      "kind": "manual",
      "order": 1
    },
    {
      "name": "ChildGroup",
      "parts": ["PartB"],
      "parentRef": "RootGroup",
      "kind": "default",
      "order": 1
    }
  ]
}
```

Compatibility rules:

- Import accepts both legacy flat records and hierarchical records.
- `parentRef` is resolved by exported group name during import.
- `kind` defaults to `imported` when absent.
- `order` defaults to import order when absent.
- `parts` are resolved through current shape references before the group tree is rebuilt.
