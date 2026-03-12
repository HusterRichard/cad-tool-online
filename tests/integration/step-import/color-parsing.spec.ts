import { describe, expect, it } from 'vitest';

import {
    HEX_COLOR_PATTERN,
    collectStepColors,
    collectStepNodes,
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
});
