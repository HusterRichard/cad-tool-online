export interface ViewerCapabilityMethods {
    setVisualPreset: (preset: 'cad' | 'cinematic') => void;
    setMaterialMode: (mode: 'matcap' | 'pbr' | 'flat' | 'phong') => void;
    setPostProcessingEnabled: (enabled: boolean) => void;
    setOutlineEnabled: (enabled: boolean) => void;
    setEdgeLayerVisible: (visible: boolean) => void;
    setEdgesVisible: (visible: boolean) => void;
    setEdgeVisibility: (visible: boolean) => void;
}

export function invokeViewerMethod(
    viewer: object | null,
    methodNames: Array<keyof ViewerCapabilityMethods>,
    ...args: unknown[]
): boolean {
    if (!viewer) {
        return false;
    }

    const target = viewer as Record<string, unknown>;
    for (const methodName of methodNames) {
        const method = target[methodName as string];
        if (typeof method === 'function') {
            Reflect.apply(method as (...fnArgs: unknown[]) => void, viewer, args);
            return true;
        }
    }

    return false;
}
