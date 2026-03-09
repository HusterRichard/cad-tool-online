import { describe, expect, it } from 'vitest';

import {
    buildModelBrowserTree,
    collectLeafShapeIds,
    flattenTopLevelAssemblyShapes
} from '../src/modelBrowser';

describe('buildModelBrowserTree', () => {
    it('builds fixed categories and puts Ground + shape hierarchy under objects', () => {
        const tree = buildModelBrowserTree({
            shapes: [
                {
                    id: 's-root',
                    name: 'as1',
                    type: 'assembly',
                    children: [
                        { id: 's-1', name: 'rod-assembly_1', type: 'part' },
                        { id: 's-2', name: 'l-bracket-assembly_1', type: 'part' },
                        { id: 's-3', name: 'plate_1', type: 'part' }
                    ]
                }
            ]
        });

        expect(tree.map((node) => node.label)).toEqual([
            '\u7269\u4f53',
            '\u8fde\u63a5',
            '\u9a71\u52a8',
            '\u529b',
            '\u6750\u6599'
        ]);

        const objects = tree[0];
        expect(objects.children?.[0]).toMatchObject({
            kind: 'ground',
            label: 'Ground'
        });

        const rootAssembly = objects.children?.[1];
        expect(rootAssembly).toMatchObject({
            kind: 'assembly',
            shapeId: 's-root',
            label: 'as1'
        });
        expect(rootAssembly?.children?.map((node) => node.label)).toEqual([
            'rod assembly 1',
            'l bracket assembly 1',
            'plate 1'
        ]);
    });

    it('maps non-shape entities into dedicated categories', () => {
        const tree = buildModelBrowserTree({
            shapes: [],
            includeGround: false,
            connections: [{ id: 'j1', name: 'rev_1' }],
            motions: [{ id: 'm1', name: 'rot_drive_1' }],
            forces: [{ id: 'f1', name: 'contact_force_1' }],
            materials: [{ id: 'mat1', name: 'steel_q235' }]
        });

        expect(tree[1].children).toEqual([
            expect.objectContaining({ kind: 'connection', label: 'rev 1' })
        ]);
        expect(tree[2].children).toEqual([
            expect.objectContaining({ kind: 'motion', label: 'rot drive 1' })
        ]);
        expect(tree[3].children).toEqual([
            expect.objectContaining({ kind: 'force', label: 'contact force 1' })
        ]);
        expect(tree[4].children).toEqual([
            expect.objectContaining({ kind: 'material', label: 'steel q235' })
        ]);
    });

    it('supports hierarchical group nodes as first-class object nodes', () => {
        const tree = buildModelBrowserTree({
            includeGround: false,
            objects: [
                {
                    id: 'g-root',
                    name: 'Base_Assembly',
                    type: 'group',
                    children: [
                        {
                            id: 'g-child',
                            name: 'Motor_Group',
                            type: 'group',
                            children: [
                                { id: 'p-1', name: 'motor_shell', type: 'part' }
                            ]
                        },
                        { id: 'p-2', name: 'base_plate', type: 'part' }
                    ]
                }
            ]
        });

        const objects = tree[0];
        expect(objects.children).toEqual([
            expect.objectContaining({
                kind: 'group',
                groupId: 'g-root',
                label: 'Base Assembly',
                children: [
                    expect.objectContaining({
                        kind: 'group',
                        groupId: 'g-child',
                        label: 'Motor Group'
                    }),
                    expect.objectContaining({
                        kind: 'part',
                        shapeId: 'p-2',
                        label: 'base plate'
                    })
                ]
            })
        ]);
    });

    it('flattens only top-level assembly nodes for tree entry display', () => {
        const flattened = flattenTopLevelAssemblyShapes([
            {
                id: 'root-asm',
                name: 'root',
                type: 'assembly' as const,
                children: [
                    {
                        id: 'sub-asm',
                        name: 'sub',
                        type: 'assembly' as const,
                        children: [
                            { id: 'part-1', name: 'part_1', type: 'part' as const }
                        ]
                    },
                    { id: 'part-2', name: 'part_2', type: 'part' as const }
                ]
            },
            { id: 'loose-part', name: 'loose', type: 'part' as const }
        ]);

        expect(flattened.map((node) => node.id)).toEqual(['sub-asm', 'part-2', 'loose-part']);
        expect(flattened[0].children?.map((node) => node.id)).toEqual(['part-1']);
    });

    it('collects all leaf part ids for nested assembly selection', () => {
        const leafIds = collectLeafShapeIds({
            id: 'root-asm',
            name: 'root',
            type: 'assembly' as const,
            children: [
                {
                    id: 'sub-asm',
                    name: 'sub',
                    type: 'assembly' as const,
                    children: [
                        { id: 'part-1', name: 'part_1', type: 'part' as const },
                        { id: 'part-2', name: 'part_2', type: 'part' as const }
                    ]
                },
                { id: 'part-3', name: 'part_3', type: 'part' as const }
            ]
        });

        expect(leafIds).toEqual(['part-1', 'part-2', 'part-3']);
    });

});
