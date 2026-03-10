import { describe, expect, it } from 'vitest';

import {
    resolveMarkerOwnerRef,
    resolveTopLevelMarkerOwnerId,
    validateReferenceMarkerCreation
} from '../src/markerDesign';

describe('markerDesign', () => {
    it('uses owning group as marker owner when part is grouped', () => {
        expect(resolveMarkerOwnerRef('part-1', 'group-a')).toEqual({
            id: 'group-a',
            kind: 'group'
        });
    });

    it('falls back to part owner when part is ungrouped', () => {
        expect(resolveMarkerOwnerRef('part-1', null)).toEqual({
            id: 'part-1',
            kind: 'part'
        });
    });

    it('resolves nested groups to their top-level owner', () => {
        const groupsById = {
            root: { id: 'root', parentGroupId: null },
            child: { id: 'child', parentGroupId: 'root' },
            leaf: { id: 'leaf', parentGroupId: 'child' }
        };

        expect(resolveTopLevelMarkerOwnerId('leaf', groupsById)).toBe('root');
        expect(resolveTopLevelMarkerOwnerId('child', groupsById)).toBe('root');
        expect(resolveTopLevelMarkerOwnerId('part-1', groupsById)).toBe('part-1');
    });

    it('rejects creating a reference marker in the same top-level group', () => {
        const groupsById = {
            root: { id: 'root', parentGroupId: null },
            left: { id: 'left', parentGroupId: 'root' },
            right: { id: 'right', parentGroupId: 'root' }
        };

        expect(validateReferenceMarkerCreation('left', 'right', groupsById)).toEqual({
            valid: false,
            reason: '参考标架无法添加到基本标架所在同一顶层组中。'
        });
    });

    it('allows creating a reference marker across different top-level groups', () => {
        const groupsById = {
            rootA: { id: 'rootA', parentGroupId: null },
            childA: { id: 'childA', parentGroupId: 'rootA' },
            rootB: { id: 'rootB', parentGroupId: null }
        };

        expect(validateReferenceMarkerCreation('childA', 'rootB', groupsById)).toEqual({
            valid: true
        });
    });

    it('rejects using the same ungrouped part as both base and target owner', () => {
        expect(validateReferenceMarkerCreation('part-1', 'part-1', {})).toEqual({
            valid: false,
            reason: '参考标架无法添加到基本标架所在同一顶层组中。'
        });
    });
});
