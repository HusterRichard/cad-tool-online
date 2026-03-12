import { describe, expect, it } from 'vitest';

import {
    DEFAULT_RENDER_CONFIG,
    normalizeRenderConfig,
    type RenderConfigState
} from '../../../src/webview/renderConfig';

describe('normalizeRenderConfig', () => {
    it('does not crash when visualPreset getter is unstable', () => {
        let readCount = 0;
        const config: Partial<RenderConfigState> = {};
        Object.defineProperty(config, 'visualPreset', {
            get() {
                readCount += 1;
                if (readCount === 1) {
                    return 'cad';
                }
                throw new TypeError("Cannot read properties of undefined (reading 'visualPreset')");
            },
            enumerable: true
        });

        expect(() => normalizeRenderConfig(config)).not.toThrow();
        expect(normalizeRenderConfig(config).visualPreset).toBe('cad');
    });

    it('falls back to defaults for invalid input', () => {
        const normalized = normalizeRenderConfig(undefined);
        expect(normalized).toEqual(DEFAULT_RENDER_CONFIG);
    });
});
