import { describe, expect, it } from 'vitest';

import { invokeViewerMethod } from '../../../src/webview/viewerCapabilities';

describe('invokeViewerMethod', () => {
    it('invokes methods with the viewer instance as this', () => {
        const calls: string[] = [];
        const viewer = {
            visualPreset: 'cad' as 'cad' | 'cinematic',
            setVisualPreset(this: { visualPreset: 'cad' | 'cinematic' }, preset: 'cad' | 'cinematic') {
                this.visualPreset = preset;
                calls.push(this.visualPreset);
            }
        };

        expect(() => invokeViewerMethod(viewer, ['setVisualPreset'], 'cinematic')).not.toThrow();
        expect(calls).toEqual(['cinematic']);
        expect(viewer.visualPreset).toBe('cinematic');
    });
});
