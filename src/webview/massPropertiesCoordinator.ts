import type { MassProperties } from '@cadtool-online/geo';
import type { MassPropertiesWorkerClient } from './massPropertiesWorkerClient';

export interface MassPropertiesRequestTarget {
    uiShapeId: string;
    kernelShapeId?: string;
    density?: number;
}

export interface MassPropertiesRequestDeps {
    hasShape: (shapeId: string) => boolean;
    getMass: (shapeId: string, density: number) => MassProperties | null;
}

export type MassPropertiesResolutionCallback = (uiShapeId: string, massProperties: MassProperties | null) => void;

export type MassPropertiesRequestResult =
    | { state: 'none' }
    | { state: 'scheduled' }
    | { state: 'cached'; massProperties: MassProperties | null };

export class MassPropertiesCoordinator {
    private readonly cache = new Map<string, MassProperties | null>();
    private requestVersion = 0;

    constructor(private readonly workerClient: MassPropertiesWorkerClient) {}

    request(
        target: MassPropertiesRequestTarget,
        deps: MassPropertiesRequestDeps | null,
        onResolved: MassPropertiesResolutionCallback
    ): MassPropertiesRequestResult {
        this.requestVersion += 1;
        const requestVersion = this.requestVersion;

        const kernelShapeId = target.kernelShapeId;
        const density = Number.isFinite(target.density) ? Number(target.density) : 7850;
        if (!kernelShapeId || !deps) {
            return { state: 'none' };
        }
        const cacheKey = `${kernelShapeId}@${density.toFixed(6)}`;

        let shapeExists = false;
        try {
            shapeExists = deps.hasShape(kernelShapeId);
        } catch {
            shapeExists = false;
        }

        if (!shapeExists) {
            return { state: 'none' };
        }

        if (this.cache.has(cacheKey)) {
            return {
                state: 'cached',
                massProperties: this.cache.get(cacheKey) ?? null
            };
        }

        this.workerClient
            .requestMass(kernelShapeId, density)
            .then((massProperties) => {
                if (requestVersion !== this.requestVersion) {
                    return;
                }

                if (massProperties) {
                    this.cache.set(cacheKey, massProperties);
                    onResolved(target.uiShapeId, massProperties);
                    return;
                }

                const fallbackMass = this.safeGetMass(deps, kernelShapeId, density);
                this.cache.set(cacheKey, fallbackMass);
                onResolved(target.uiShapeId, fallbackMass);
            })
            .catch(() => {
                if (requestVersion !== this.requestVersion) {
                    return;
                }

                const fallbackMass = this.safeGetMass(deps, kernelShapeId, density);
                this.cache.set(cacheKey, fallbackMass);
                onResolved(target.uiShapeId, fallbackMass);
            });

        return { state: 'scheduled' };
    }

    cancelPending(): void {
        this.requestVersion += 1;
    }

    clear(): void {
        this.cache.clear();
        this.requestVersion += 1;
        this.workerClient.clear();
    }

    private safeGetMass(deps: MassPropertiesRequestDeps, shapeId: string, density: number): MassProperties | null {
        try {
            return deps.getMass(shapeId, density);
        } catch {
            return null;
        }
    }
}
