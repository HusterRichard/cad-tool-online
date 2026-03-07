import type { MassProperties } from '@cadtool-online/geo';

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
export type TaskScheduler = (task: () => void) => void;

export type MassPropertiesRequestResult =
    | { state: 'none' }
    | { state: 'scheduled' }
    | { state: 'cached'; massProperties: MassProperties | null };

export class MassPropertiesCoordinator {
    private readonly cache = new Map<string, MassProperties | null>();
    private requestVersion = 0;
    private readonly schedule: TaskScheduler;

    constructor(schedule: TaskScheduler = createAfterRenderScheduler()) {
        this.schedule = schedule;
    }

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

        this.schedule(() => {
            if (requestVersion !== this.requestVersion) {
                return;
            }

            let massProperties: MassProperties | null = null;
            try {
                massProperties = deps.getMass(kernelShapeId, density);
            } catch {
                massProperties = null;
            }

            this.cache.set(cacheKey, massProperties);

            if (requestVersion !== this.requestVersion) {
                return;
            }

            onResolved(target.uiShapeId, massProperties);
        });

        return { state: 'scheduled' };
    }

    cancelPending(): void {
        this.requestVersion += 1;
    }

    clear(): void {
        this.cache.clear();
        this.requestVersion += 1;
    }
}

export function createAfterRenderScheduler(): TaskScheduler {
    return (task) => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => {
                setTimeout(task, 0);
            });
            return;
        }
        setTimeout(task, 0);
    };
}
