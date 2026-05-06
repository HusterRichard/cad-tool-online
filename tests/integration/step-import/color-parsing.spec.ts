import { describe, expect, it } from 'vitest';

import {
    HEX_COLOR_PATTERN,
    collectStepColors,
    collectStepNodes,
    readStoredShapeMesh,
    readStepFixture
} from '../../helpers/stepFixtures';

describe('STEP color parsing', () => {
    it.each([
        ['ref/model/PickAndPlaceMaterial.STEP', 'pick-and-place-material'],
        ['ref/model/PickAndPlace.step', 'pick-and-place']
    ])('extracts valid color metadata from %s', async (fixturePath, baseId) => {
        const result = await readStepFixture(fixturePath, baseId);
        const colors = collectStepColors(result.rootNodes);

        expect(result.success).toBe(true);
        expect(result.rootNodes?.length).toBeGreaterThan(0);
        expect(colors.length).toBeGreaterThan(10);
        colors.forEach((color) => {
            expect(color).toMatch(HEX_COLOR_PATTERN);
        });

        expect(new Set(colors).size).toBeGreaterThan(4);
    });

    it('keeps different colors across the imported hierarchy', async () => {
        const result = await readStepFixture('ref/model/PickAndPlaceMaterial.STEP', 'pick-and-place-hierarchy');
        const allNodes = collectStepNodes(result.rootNodes);
        const parentWithChildColorOverride = allNodes.find((node) =>
            node.children?.some((child) => child.color && child.color !== node.color)
        );

        expect(result.success).toBe(true);
        expect(parentWithChildColorOverride).toBeDefined();
    });

    it('preserves referenced instance colors in PickAndPlaceGroup.STEP', async () => {
        const result = await readStepFixture('ref/model/PickAndPlaceGroup.STEP', 'pick-and-place-group');
        const allNodes = collectStepNodes(result.rootNodes);
        const frame = allNodes.find((node) => node.name.toLowerCase() === 'frame');

        expect(result.success).toBe(true);
        expect(frame).toBeDefined();
        expect(frame?.color).toBe('#0000FF');
    });

    it('converts PickAndPlaceGroup.STEP display colors back to sRGB for UI rendering', async () => {
        const result = await readStepFixture('ref/model/PickAndPlaceGroup.STEP', 'pick-and-place-group-srgb');
        const allNodes = collectStepNodes(result.rootNodes);
        const gearMotor = allNodes.find((node) => node.name.toLowerCase() === 'gear motor');
        const pickUpPlate = allNodes.find((node) => node.name.toLowerCase() === 'pick up plate');

        expect(result.success).toBe(true);
        expect(gearMotor?.color).toBe('#A69E96');
        expect(pickUpPlate?.color).toBe('#C0C000');
    });

    it('preserves multi-face colors for the gear motor mesh in PickAndPlaceGroup.STEP', async () => {
        const result = await readStepFixture('ref/model/PickAndPlaceGroup.STEP', 'pick-and-place-group-mesh');
        const allNodes = collectStepNodes(result.rootNodes);
        const gearMotor = allNodes.find((node) => node.name.toLowerCase() === 'gear motor');

        expect(result.success).toBe(true);
        expect(gearMotor?.shapeId).toBeDefined();

        const mesh = await readStoredShapeMesh(gearMotor!.shapeId!);
        const uniqueColors = new Set<string>();
        let hasBlueFace = false;

        expect(mesh).not.toBeNull();
        expect(mesh?.colors).toBeDefined();

        for (let i = 0; i < (mesh?.colors?.length ?? 0); i += 3) {
            const r = mesh!.colors![i];
            const g = mesh!.colors![i + 1];
            const b = mesh!.colors![i + 2];
            uniqueColors.add(`${r.toFixed(3)}:${g.toFixed(3)}:${b.toFixed(3)}`);
            if (r < 0.05 && g < 0.05 && b > 0.95) {
                hasBlueFace = true;
            }
        }

        expect(uniqueColors.size).toBeGreaterThan(1);
        expect(hasBlueFace).toBe(true);
    });
});
