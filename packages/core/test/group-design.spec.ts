import { describe, expect, it } from 'vitest';

import {
    createEmptyGroupDesignState,
    createGroupDesignState,
    getGroupNode,
    getOrderedChildGroupIds,
    getPartOwnerGroupMap,
    listGroupNodes,
    resolvePartOwnerGroupId
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
});
