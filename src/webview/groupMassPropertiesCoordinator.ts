import { aggregateMassProperties, type Mat3, type Vec3 } from '@cadtool-online/core';
import type { MassProperties } from '@cadtool-online/geo';

const DEFAULT_DENSITY = 7850;

export interface GroupMassSummary {
    totalPartCount: number;
    computedPartCount: number;
    missingPartIds: string[];
    volume: number;
    mass: number;
    density: number;
    centerOfMass: Vec3;
    inertiaMatrix: Mat3;
}

export interface GroupMassRequestPartTarget {
    partId: string;
    kernelShapeId?: string;
    density?: number;
}

export interface GroupMassPropertiesRequestTarget {
    groupId: string;
    parts: GroupMassRequestPartTarget[];
}

export interface GroupMassPropertiesRequestDeps {
    hasShape: (shapeId: string) => boolean;
    getMass: (shapeId: string, density: number) => MassProperties | null;
}

export interface GroupMassWorkerClient {
    requestMass(mainShapeId: string, density: number): Promise<MassProperties | null>;
}

export type GroupMassPropertiesResolutionCallback = (
    groupId: string,
    massSummary: GroupMassSummary | null
) => void;

export type GroupMassPropertiesRequestResult =
    | { state: 'none' }
    | { state: 'scheduled' }
    | { state: 'cached'; massSummary: GroupMassSummary | null };

type ResolvedGroupPart = {
    partId: string;
    massProperties: MassProperties | null;
};

function createZeroSummary(
    totalPartCount: number,
    computedPartCount: number,
    missingPartIds: string[]
): GroupMassSummary {
    return {
        totalPartCount,
        computedPartCount,
        missingPartIds,
        volume: 0,
        mass: 0,
        density: 0,
        centerOfMass: { x: 0, y: 0, z: 0 },
        inertiaMatrix: { m: [0, 0, 0, 0, 0, 0, 0, 0, 0] }
    };
}

function toResolvedDensity(density: number | undefined): number {
    return Number.isFinite(density) && Number(density) > 0 ? Number(density) : DEFAULT_DENSITY;
}

function createCacheKey(target: GroupMassPropertiesRequestTarget): string {
    const partKey = target.parts
        .map(
            part =>
                `${part.partId}:${part.kernelShapeId ?? ''}:${toResolvedDensity(part.density).toFixed(6)}`
        )
        .sort()
        .join('|');
    return `${target.groupId}|${partKey}`;
}

function summarizeGroupMass(
    totalPartCount: number,
    resolvedParts: ResolvedGroupPart[]
): GroupMassSummary | null {
    const partMasses: MassProperties[] = [];
    const missingPartIds: string[] = [];

    resolvedParts.forEach(part => {
        if (!part.massProperties) {
            missingPartIds.push(part.partId);
            return;
        }
        partMasses.push(part.massProperties);
    });

    if (partMasses.length === 0) {
        return createZeroSummary(totalPartCount, 0, missingPartIds);
    }

    const aggregate = aggregateMassProperties(partMasses);
    if (!aggregate) {
        return null;
    }

    return {
        totalPartCount,
        computedPartCount: partMasses.length,
        missingPartIds,
        volume: aggregate.volume,
        mass: aggregate.mass,
        density: aggregate.density,
        centerOfMass: aggregate.centerOfMass,
        inertiaMatrix: aggregate.inertiaMatrix
    };
}

export class GroupMassPropertiesCoordinator {
    private readonly cache = new Map<string, GroupMassSummary | null>();
    private requestVersion = 0;

    constructor(private readonly workerClient: GroupMassWorkerClient) {}

    request(
        target: GroupMassPropertiesRequestTarget,
        deps: GroupMassPropertiesRequestDeps | null,
        onResolved: GroupMassPropertiesResolutionCallback
    ): GroupMassPropertiesRequestResult {
        this.requestVersion += 1;
        const requestVersion = this.requestVersion;

        if (target.parts.length === 0) {
            return {
                state: 'cached',
                massSummary: createZeroSummary(0, 0, [])
            };
        }

        if (!deps) {
            return { state: 'none' };
        }

        const cacheKey = createCacheKey(target);
        if (this.cache.has(cacheKey)) {
            return {
                state: 'cached',
                massSummary: this.cache.get(cacheKey) ?? null
            };
        }

        void Promise.all(target.parts.map(part => this.resolvePartMass(part, deps))).then(
            resolvedParts => {
                if (requestVersion !== this.requestVersion) {
                    return;
                }

                const massSummary = summarizeGroupMass(target.parts.length, resolvedParts);
                this.cache.set(cacheKey, massSummary);
                onResolved(target.groupId, massSummary);
            }
        );

        return { state: 'scheduled' };
    }

    cancelPending(): void {
        this.requestVersion += 1;
    }

    clear(): void {
        this.cache.clear();
        this.requestVersion += 1;
    }

    private async resolvePartMass(
        part: GroupMassRequestPartTarget,
        deps: GroupMassPropertiesRequestDeps
    ): Promise<ResolvedGroupPart> {
        const kernelShapeId = part.kernelShapeId;
        const density = toResolvedDensity(part.density);
        if (!kernelShapeId) {
            return { partId: part.partId, massProperties: null };
        }

        let shapeExists = false;
        try {
            shapeExists = deps.hasShape(kernelShapeId);
        } catch {
            shapeExists = false;
        }

        if (!shapeExists) {
            return { partId: part.partId, massProperties: null };
        }

        try {
            const asyncMass = await this.workerClient.requestMass(kernelShapeId, density);
            if (asyncMass) {
                return { partId: part.partId, massProperties: asyncMass };
            }
        } catch {
            // Fall through to main-thread fallback for compatibility.
        }

        return {
            partId: part.partId,
            massProperties: this.safeGetMass(deps, kernelShapeId, density)
        };
    }

    private safeGetMass(
        deps: GroupMassPropertiesRequestDeps,
        shapeId: string,
        density: number
    ): MassProperties | null {
        try {
            return deps.getMass(shapeId, density);
        } catch {
            return null;
        }
    }
}
