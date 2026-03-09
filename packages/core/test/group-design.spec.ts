import { describe, expect, it } from 'vitest';

import {
    cleanEmptyGroups,
    createGroupNode,
    createEmptyGroupDesignState,
    createGroupDesignState,
    deleteGroups,
    exportGroupSchema,
    getGroupNode,
    getOrderedChildGroupIds,
    getPartOwnerGroupMap,
    getUniqueGroupName,
    importGroupSchema,
    listGroupNodes,
    moveGroupNodes,
    renameGroupNode,
    resolvePartOwnerGroupId,
    sanitizeGroupName,
    ungroupGroup
} from '../src/groupDesign';

describe('groupDesign', () => {
    it('creates an empty state with explicit ungrouped parts', () => {
        const state = createEmptyGroupDesignState(['p1', 'p2']);

        expect(state).toEqual({
            groupsById: {},
            rootGroupIds: [],
            ungroupedPartIds: ['p1', 'p2'],
            selectedNodeIds: [],
            activeMode: 'idle'
        });
    });

    it('rebuilds hierarchy and derives ungrouped parts', () => {
        const state = createGroupDesignState({
            allPartIds: ['p1', 'p2', 'p3'],
            groups: [
                {
                    id: 'g-parent',
                    name: 'Parent',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['p1'],
                    kind: 'manual',
                    order: 20,
                    createdAt: '2026-03-09T00:00:00.000Z'
                },
                {
                    id: 'g-child',
                    name: 'Child',
                    parentGroupId: 'g-parent',
                    childGroupIds: [],
                    memberPartIds: ['p2', 'p2'],
                    kind: 'default',
                    order: 10,
                    createdAt: '2026-03-09T00:00:01.000Z'
                }
            ]
        });

        expect(listGroupNodes(state).map((group) => group.id)).toEqual(['g-child', 'g-parent']);
        expect(getOrderedChildGroupIds(state, null)).toEqual(['g-parent']);
        expect(getOrderedChildGroupIds(state, 'g-parent')).toEqual(['g-child']);
        expect(getGroupNode(state, 'g-child')?.memberPartIds).toEqual(['p2']);
        expect(state.ungroupedPartIds).toEqual(['p3']);
    });

    it('builds a part owner map and resolves owner groups', () => {
        const state = createGroupDesignState({
            groups: [
                {
                    id: 'g1',
                    name: 'Base',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['part-a'],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:00.000Z'
                },
                {
                    id: 'g2',
                    name: 'Arm',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['part-b'],
                    kind: 'manual',
                    order: 2,
                    createdAt: '2026-03-09T00:00:00.000Z'
                }
            ]
        });

        expect(getPartOwnerGroupMap(state)).toEqual({
            'part-a': 'g1',
            'part-b': 'g2'
        });
        expect(resolvePartOwnerGroupId(state, 'part-b')).toBe('g2');
        expect(resolvePartOwnerGroupId(state, 'missing')).toBeNull();
    });

    it('normalizes names for modelica-safe group identifiers', () => {
        const state = createGroupDesignState({
            groups: [
                {
                    id: 'g1',
                    name: 'Arm_Group',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: [],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:00.000Z'
                }
            ]
        });

        expect(sanitizeGroupName(' 9 arm group ')).toBe('_9_arm_group');
        expect(getUniqueGroupName(state, 'Arm Group')).toBe('Arm_Group_1');
    });

    it('creates groups with unique names and rehomes existing members', () => {
        const initial = createGroupDesignState({
            allPartIds: ['p1', 'p2', 'p3'],
            groups: [
                {
                    id: 'g-existing',
                    name: 'Arm',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['p1'],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:00.000Z'
                }
            ]
        });

        const { state, group } = createGroupNode(initial, {
            id: 'g-new',
            name: 'Arm',
            memberPartIds: ['p1', 'p2', 'p2'],
            parentGroupId: null,
            createdAt: '2026-03-09T00:00:01.000Z'
        });

        expect(group.name).toBe('Arm_1');
        expect(getGroupNode(state, 'g-existing')?.memberPartIds).toEqual([]);
        expect(getGroupNode(state, 'g-new')?.memberPartIds).toEqual(['p1', 'p2']);
        expect(state.ungroupedPartIds).toEqual(['p3']);
    });

    it('renames groups with normalization and collision handling', () => {
        const initial = createGroupDesignState({
            groups: [
                {
                    id: 'g1',
                    name: 'Arm_Group',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: [],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:00.000Z'
                },
                {
                    id: 'g2',
                    name: 'Base',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: [],
                    kind: 'manual',
                    order: 2,
                    createdAt: '2026-03-09T00:00:01.000Z'
                }
            ]
        });

        const renamed = renameGroupNode(initial, 'g2', 'Arm Group');
        expect(getGroupNode(renamed, 'g2')?.name).toBe('Arm_Group_1');
        expect(() => renameGroupNode(initial, 'missing', 'Next')).toThrow('does not exist');
    });

    it('moves parts and groups while preventing descendant-invalid targets', () => {
        const initial = createGroupDesignState({
            allPartIds: ['p1', 'p2', 'p3', 'p4'],
            groups: [
                {
                    id: 'g-parent',
                    name: 'Parent',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['p1'],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:00.000Z'
                },
                {
                    id: 'g-child',
                    name: 'Child',
                    parentGroupId: 'g-parent',
                    childGroupIds: [],
                    memberPartIds: ['p2'],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:01.000Z'
                },
                {
                    id: 'g-target',
                    name: 'Target',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['p3'],
                    kind: 'manual',
                    order: 2,
                    createdAt: '2026-03-09T00:00:02.000Z'
                }
            ]
        });

        expect(() => moveGroupNodes(initial, {
            groupIds: ['g-parent'],
            targetGroupId: 'g-child'
        })).toThrow('Invalid move target');

        const movedToRoot = moveGroupNodes(initial, {
            partIds: ['p4'],
            groupIds: ['g-child'],
            targetGroupId: null
        });

        expect(movedToRoot.movedParts).toBe(1);
        expect(movedToRoot.movedGroups).toBe(1);
        expect(getGroupNode(movedToRoot.state, 'g-child')?.parentGroupId).toBeNull();
        expect(movedToRoot.state.ungroupedPartIds).toContain('p4');

        const movedToTarget = moveGroupNodes(movedToRoot.state, {
            partIds: ['p4'],
            groupIds: ['g-child'],
            targetGroupId: 'g-target'
        });

        expect(getGroupNode(movedToTarget.state, 'g-child')?.parentGroupId).toBe('g-target');
        expect(getGroupNode(movedToTarget.state, 'g-target')?.memberPartIds).toEqual(['p3', 'p4']);
        expect(movedToTarget.state.ungroupedPartIds).toEqual([]);
    });

    it('ungroups groups by lifting members and children to the parent level', () => {
        const initial = createGroupDesignState({
            allPartIds: ['p1', 'p2', 'p3', 'p4'],
            groups: [
                {
                    id: 'g-root',
                    name: 'Root',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['p1', 'p4'],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:00.000Z'
                },
                {
                    id: 'g-mid',
                    name: 'Mid',
                    parentGroupId: 'g-root',
                    childGroupIds: [],
                    memberPartIds: ['p2'],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:01.000Z'
                },
                {
                    id: 'g-leaf',
                    name: 'Leaf',
                    parentGroupId: 'g-mid',
                    childGroupIds: [],
                    memberPartIds: ['p3'],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:02.000Z'
                }
            ]
        });

        expect(() => ungroupGroup(initial, 'g-mid', (groupId) => groupId === 'g-mid')).toThrow('referenced by design entities');

        const rootResult = ungroupGroup(initial, 'g-root');

        expect(rootResult.parentGroupId).toBeNull();
        expect(rootResult.movedParts).toBe(2);
        expect(rootResult.movedGroups).toBe(1);
        expect(getGroupNode(rootResult.state, 'g-root')).toBeUndefined();
        expect(getGroupNode(rootResult.state, 'g-mid')?.parentGroupId).toBeNull();
        expect(rootResult.state.ungroupedPartIds).toEqual(['p1', 'p4']);

        const result = ungroupGroup(initial, 'g-mid');

        expect(result.movedParts).toBe(1);
        expect(result.movedGroups).toBe(1);
        expect(getGroupNode(result.state, 'g-mid')).toBeUndefined();
        expect(getGroupNode(result.state, 'g-root')?.memberPartIds).toEqual(['p1', 'p4', 'p2']);
        expect(getGroupNode(result.state, 'g-leaf')?.parentGroupId).toBe('g-root');
    });

    it('cleans only empty unreferenced groups and deletes only empty safe groups', () => {
        const initial = createGroupDesignState({
            allPartIds: ['p1'],
            groups: [
                {
                    id: 'g-root',
                    name: 'Root',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: [],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:00.000Z'
                },
                {
                    id: 'g-empty',
                    name: 'Empty',
                    parentGroupId: 'g-root',
                    childGroupIds: [],
                    memberPartIds: [],
                    kind: 'manual',
                    order: 1,
                    createdAt: '2026-03-09T00:00:01.000Z'
                },
                {
                    id: 'g-blocked',
                    name: 'Blocked',
                    parentGroupId: 'g-root',
                    childGroupIds: [],
                    memberPartIds: [],
                    kind: 'manual',
                    order: 2,
                    createdAt: '2026-03-09T00:00:02.000Z'
                },
                {
                    id: 'g-non-empty',
                    name: 'NonEmpty',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['p1'],
                    kind: 'manual',
                    order: 2,
                    createdAt: '2026-03-09T00:00:03.000Z'
                }
            ]
        });

        const cleaned = cleanEmptyGroups(initial, (groupId) => groupId === 'g-blocked');

        expect(cleaned.removedGroupIds).toEqual(['g-empty']);
        expect(cleaned.blockedGroupIds).toEqual(['g-blocked']);
        expect(getGroupNode(cleaned.state, 'g-empty')).toBeUndefined();
        expect(getGroupNode(cleaned.state, 'g-blocked')).toBeDefined();

        const parentDelete = deleteGroups(cleaned.state, ['g-root', 'g-blocked', 'g-non-empty'], (groupId) => groupId === 'g-blocked');

        expect(parentDelete.deletedGroupIds).toEqual([]);
        expect(parentDelete.blockedMessages).toEqual([
            'Group "Root" still has child groups.',
            'Group "NonEmpty" still has members.'
        ]);

        const blockedDelete = deleteGroups(cleaned.state, ['g-blocked'], (groupId) => groupId === 'g-blocked');

        expect(blockedDelete.deletedGroupIds).toEqual([]);
        expect(blockedDelete.blockedMessages).toEqual([
            'Group "Blocked" is referenced by design entities.'
        ]);
    });

    it('round-trips hierarchical group schema for continued editing', () => {
        const initial = createGroupDesignState({
            allPartIds: ['part-a', 'part-b', 'part-c'],
            groups: [
                {
                    id: 'g-root',
                    name: 'Root',
                    parentGroupId: null,
                    childGroupIds: [],
                    memberPartIds: ['part-a'],
                    kind: 'manual',
                    order: 2,
                    createdAt: '2026-03-09T00:00:00.000Z'
                },
                {
                    id: 'g-child',
                    name: 'Child',
                    parentGroupId: 'g-root',
                    childGroupIds: [],
                    memberPartIds: ['part-b'],
                    kind: 'default',
                    order: 1,
                    createdAt: '2026-03-09T00:00:01.000Z'
                }
            ]
        });

        const exported = exportGroupSchema(initial, (partId) => ({
            'part-a': 'PartA',
            'part-b': 'PartB',
            'part-c': 'PartC'
        }[partId] ?? partId));

        expect(exported).toEqual([
            {
                name: 'Child',
                parts: ['PartB'],
                parentRef: 'Root',
                kind: 'default',
                order: 1
            },
            {
                name: 'Root',
                parts: ['PartA'],
                parentRef: null,
                kind: 'manual',
                order: 2
            }
        ]);

        const imported = importGroupSchema({
            records: exported,
            allPartIds: ['part-a', 'part-b', 'part-c'],
            resolvePartRef: (partRef) => ({
                PartA: 'part-a',
                PartB: 'part-b',
                PartC: 'part-c'
            }[partRef] ?? partRef),
            createGroupId: (index) => `imported-${index + 1}`,
            now: () => '2026-03-09T12:00:00.000Z'
        });

        expect(listGroupNodes(imported).map((group) => group.name)).toEqual(['Child', 'Root']);
        expect(getGroupNode(imported, 'imported-1')?.parentGroupId).toBe('imported-2');
        expect(getGroupNode(imported, 'imported-2')?.memberPartIds).toEqual(['part-a']);
        expect(getGroupNode(imported, 'imported-1')?.memberPartIds).toEqual(['part-b']);
        expect(imported.ungroupedPartIds).toEqual(['part-c']);

        const moved = moveGroupNodes(imported, {
            partIds: ['part-c'],
            targetGroupId: 'imported-2'
        });

        expect(getGroupNode(moved.state, 'imported-2')?.memberPartIds).toEqual(['part-a', 'part-c']);
    });
});
