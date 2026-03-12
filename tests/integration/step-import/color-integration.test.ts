import { describe, expect, it } from 'vitest';

import {
    HEX_COLOR_PATTERN,
    collectStepColors,
    readStepFixture
} from '../../helpers/stepFixtures';

describe('STEP color integration', () => {
    it('preserves extracted color data through JSON serialization', async () => {
        const result = await readStepFixture('ref/model/PickAndPlaceMaterial.STEP', 'pick-and-place-serialize');
        const serialized = JSON.stringify(result);
        const parsed = JSON.parse(serialized) as typeof result;
        const colors = collectStepColors(parsed.rootNodes);

        expect(parsed.success).toBe(true);
        expect(colors.length).toBeGreaterThan(10);
        colors.forEach((color) => {
            expect(color).toMatch(HEX_COLOR_PATTERN);
        });
    });

    it('converts imported colors to Three.js-compatible numeric values', async () => {
        const result = await readStepFixture('ref/model/PickAndPlace.step', 'pick-and-place-three');
        const colors = collectStepColors(result.rootNodes);
        const numbers = colors.map((color) => parseInt(color.replace('#', ''), 16));

        expect(result.success).toBe(true);
        expect(numbers.length).toBeGreaterThan(10);
        numbers.forEach((value) => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(0xFFFFFF);
        });
    });
});
