import { describe, expect, it } from 'vitest';

import {
    DEFAULT_CONNECTOR_DIRECTION,
    isGroundConnectorParticipant,
    normalizeConnectorType,
    resolveConnectorDirection,
    validateConnectorParticipants
} from '../src/connectorDesign';

describe('connectorDesign', () => {
    it('normalizes connector types to lower-case canonical values', () => {
        expect(normalizeConnectorType('Revolute')).toBe('revolute');
        expect(normalizeConnectorType('SCREW')).toBe('screw');
        expect(normalizeConnectorType('')).toBe('revolute');
        expect(normalizeConnectorType('unknown', 'fixed')).toBe('fixed');
    });

    it('recognizes ground participant aliases', () => {
        expect(isGroundConnectorParticipant('Ground')).toBe(true);
        expect(isGroundConnectorParticipant('__ground__')).toBe(true);
        expect(isGroundConnectorParticipant('part-1')).toBe(false);
    });

    it('validates connector participants', () => {
        expect(validateConnectorParticipants('', 'part-2')).toEqual({
            valid: false,
            reason: '请先选择零件 1。'
        });
        expect(validateConnectorParticipants('part-1', '')).toEqual({
            valid: false,
            reason: '请再选择零件 2。'
        });
        expect(validateConnectorParticipants('Ground', 'part-2')).toEqual({
            valid: false,
            reason: 'Ground 只能作为零件 2。'
        });
        expect(validateConnectorParticipants('part-1', 'part-1')).toEqual({
            valid: false,
            reason: '零件 1 和零件 2 不能是同一个对象。'
        });
        expect(validateConnectorParticipants('part-1', 'Ground')).toEqual({
            valid: true
        });
    });

    it('falls back to world +Z when inference is disabled', () => {
        expect(resolveConnectorDirection({
            inferenceEnabled: false,
            pickedDirection: { x: 1, y: 0, z: 0 }
        })).toEqual(DEFAULT_CONNECTOR_DIRECTION);
    });

    it('normalizes and optionally reverses inferred directions', () => {
        expect(resolveConnectorDirection({
            inferenceEnabled: true,
            pickedDirection: { x: 0, y: 0, z: 5 }
        })).toEqual({ x: 0, y: 0, z: 1 });

        expect(resolveConnectorDirection({
            inferenceEnabled: true,
            pickedDirection: { x: 0, y: 2, z: 0 },
            reverseDirection: true
        })).toEqual({ x: 0, y: -1, z: 0 });
    });
});
