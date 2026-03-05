export type MaterialMode = 'matcap' | 'pbr' | 'flat' | 'phong';
export type VisualPreset = 'cad' | 'cinematic';
export type PrecisionPreset = 'coarse' | 'balanced' | 'fine';

export interface RenderConfigState {
    visualPreset: VisualPreset;
    materialMode: MaterialMode;
    postProcessing: boolean;
    edgeLayerVisible: boolean;
    precisionPreset: PrecisionPreset;
}

export const DEFAULT_RENDER_CONFIG: RenderConfigState = {
    visualPreset: 'cad',
    materialMode: 'phong',
    postProcessing: false,
    edgeLayerVisible: true,
    precisionPreset: 'balanced'
};

export function isMaterialMode(value: unknown): value is MaterialMode {
    return value === 'matcap' || value === 'pbr' || value === 'flat' || value === 'phong';
}

export function isVisualPreset(value: unknown): value is VisualPreset {
    return value === 'cad' || value === 'cinematic';
}

export function isPrecisionPreset(value: unknown): value is PrecisionPreset {
    return value === 'coarse' || value === 'balanced' || value === 'fine';
}

function safeRead<T>(reader: () => T): T | undefined {
    try {
        return reader();
    } catch {
        return undefined;
    }
}

export function normalizeRenderConfig(config: Partial<RenderConfigState> | null | undefined): RenderConfigState {
    const candidate = (config && typeof config === 'object')
        ? config
        : {};

    const visualPreset = safeRead(() => candidate.visualPreset);
    const materialMode = safeRead(() => candidate.materialMode);
    const postProcessing = safeRead(() => candidate.postProcessing);
    const edgeLayerVisible = safeRead(() => candidate.edgeLayerVisible);
    const precisionPreset = safeRead(() => candidate.precisionPreset);

    return {
        visualPreset: isVisualPreset(visualPreset) ? visualPreset : DEFAULT_RENDER_CONFIG.visualPreset,
        materialMode: isMaterialMode(materialMode) ? materialMode : DEFAULT_RENDER_CONFIG.materialMode,
        postProcessing: typeof postProcessing === 'boolean' ? postProcessing : DEFAULT_RENDER_CONFIG.postProcessing,
        edgeLayerVisible: typeof edgeLayerVisible === 'boolean'
            ? edgeLayerVisible
            : DEFAULT_RENDER_CONFIG.edgeLayerVisible,
        precisionPreset: isPrecisionPreset(precisionPreset)
            ? precisionPreset
            : DEFAULT_RENDER_CONFIG.precisionPreset
    };
}
