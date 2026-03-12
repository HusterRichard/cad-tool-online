import type { Vec3 } from './types';

export const CONNECTOR_TYPE_VALUES = [
    'fixed',
    'revolute',
    'prismatic',
    'cylindrical',
    'spherical',
    'universal',
    'screw',
    'planar'
] as const;

export type ConnectorTypeValue = typeof CONNECTOR_TYPE_VALUES[number];

export const DEFAULT_CONNECTOR_DIRECTION: Vec3 = { x: 0, y: 0, z: 1 };

export interface ConnectorParticipantValidationResult {
    valid: boolean;
    reason?: string;
}

export interface ResolveConnectorDirectionInput {
    inferenceEnabled: boolean;
    pickedDirection?: Vec3 | null;
    reverseDirection?: boolean;
}

const CONNECTOR_TYPE_LOOKUP = new Set<string>(CONNECTOR_TYPE_VALUES);
const GROUND_TOKENS = new Set(['ground', '__ground__']);

export function normalizeConnectorType(
    rawValue: string | null | undefined,
    fallback: ConnectorTypeValue = 'revolute'
): ConnectorTypeValue {
    const normalized = rawValue?.trim().toLowerCase();
    if (normalized && CONNECTOR_TYPE_LOOKUP.has(normalized)) {
        return normalized as ConnectorTypeValue;
    }
    return fallback;
}

export function isGroundConnectorParticipant(rawValue: string | null | undefined): boolean {
    const normalized = rawValue?.trim().toLowerCase();
    return Boolean(normalized && GROUND_TOKENS.has(normalized));
}

export function validateConnectorParticipants(
    part1: string | null | undefined,
    part2: string | null | undefined
): ConnectorParticipantValidationResult {
    if (!part1 || part1.trim().length === 0) {
        return {
            valid: false,
            reason: '请先选择零件 1。'
        };
    }

    if (!part2 || part2.trim().length === 0) {
        return {
            valid: false,
            reason: '请再选择零件 2。'
        };
    }

    if (isGroundConnectorParticipant(part1)) {
        return {
            valid: false,
            reason: 'Ground 只能作为零件 2。'
        };
    }

    if (!isGroundConnectorParticipant(part2) && part1 === part2) {
        return {
            valid: false,
            reason: '零件 1 和零件 2 不能是同一个对象。'
        };
    }

    return { valid: true };
}

export function resolveConnectorDirection(input: ResolveConnectorDirectionInput): Vec3 {
    const baseDirection = input.inferenceEnabled && input.pickedDirection
        ? normalizeDirection(input.pickedDirection) ?? DEFAULT_CONNECTOR_DIRECTION
        : DEFAULT_CONNECTOR_DIRECTION;

    return normalizeNegativeZero(
        input.reverseDirection
            ? { x: -baseDirection.x, y: -baseDirection.y, z: -baseDirection.z }
            : baseDirection
    );
}

function normalizeDirection(direction: Vec3 | null | undefined): Vec3 | null {
    if (!direction) {
        return null;
    }

    const length = Math.sqrt(
        direction.x * direction.x
        + direction.y * direction.y
        + direction.z * direction.z
    );
    if (!Number.isFinite(length) || length <= 1e-9) {
        return null;
    }

    return {
        x: direction.x / length,
        y: direction.y / length,
        z: direction.z / length
    };
}

function normalizeNegativeZero(direction: Vec3): Vec3 {
    return {
        x: Object.is(direction.x, -0) ? 0 : direction.x,
        y: Object.is(direction.y, -0) ? 0 : direction.y,
        z: Object.is(direction.z, -0) ? 0 : direction.z
    };
}
