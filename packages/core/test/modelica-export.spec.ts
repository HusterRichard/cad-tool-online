import { describe, expect, it } from 'vitest';

import { buildDxfDocument, buildMbJsonDocument } from '../src/modelicaExport';

describe('buildMbJsonDocument', () => {
    it('preserves the SC36 mb.json contract for groups, markers, connectors, and motions', () => {
        const document = buildMbJsonDocument({
            packageName: 'ExcavatorArm',
            group: [
                {
                    name: 'Base',
                    totalMass: 12.5,
                    inertiaTensor: { m: [1, 0, 0, 0, 2, 0, 0, 0, 3] },
                    imageFile: 'Visualizers/Base.png',
                    dxfFile: 'Visualizers/Base.dxf'
                }
            ],
            marker: [
                {
                    name: 'Frame1',
                    groupRef: 'Base',
                    position: { x: 1, y: 2, z: 3 },
                    direction: { x: 0, y: 0, z: 1 }
                }
            ],
            connector: [
                {
                    name: 'Joint1',
                    connectorType: 'revolute',
                    groupRef1: 'Base',
                    groupRef2: 'Arm',
                    position: { x: 4, y: 5, z: 6 },
                    direction: { x: 0, y: 1, z: 0 }
                }
            ],
            motion: [
                {
                    name: 'Drive1',
                    motionType: 'translational',
                    connectorRef: 'Joint1'
                }
            ]
        });

        expect(document).toEqual({
            packageName: 'ExcavatorArm',
            group: [
                {
                    name: 'Base',
                    totalMass: 12.5,
                    inertiaTensor: { m: [1, 0, 0, 0, 2, 0, 0, 0, 3] },
                    imageFile: 'Visualizers/Base.png',
                    dxfFile: 'Visualizers/Base.dxf'
                }
            ],
            marker: [
                {
                    name: 'Frame1',
                    groupRef: 'Base',
                    position: { x: 1, y: 2, z: 3 },
                    direction: { x: 0, y: 0, z: 1 }
                }
            ],
            connector: [
                {
                    name: 'Joint1',
                    connectorType: 'revolute',
                    groupRef1: 'Base',
                    groupRef2: 'Arm',
                    position: { x: 4, y: 5, z: 6 },
                    direction: { x: 0, y: 1, z: 0 }
                }
            ],
            motion: [
                {
                    name: 'Drive1',
                    motionType: 'translational',
                    connectorRef: 'Joint1'
                }
            ]
        });
    });
});

describe('buildDxfDocument', () => {
    it('serializes edge line segments into a minimal DXF LINE document', () => {
        const dxf = buildDxfDocument([
            {
                vertices: new Float32Array([
                    0, 0, 0,
                    1, 0, 0,
                    1, 0, 0,
                    1, 1, 0
                ])
            }
        ]);

        expect(dxf).toContain('SECTION');
        expect(dxf).toContain('ENTITIES');
        expect(dxf).toContain('LINE');
        expect(dxf.match(/\nLINE\n/g)?.length).toBe(2);
        expect(dxf).toContain('\n10\n0\n20\n0\n30\n0\n');
        expect(dxf).toContain('\n11\n1\n21\n0\n31\n0\n');
        expect(dxf).toContain('\n11\n1\n21\n1\n31\n0\n');
        expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    });
});
