import { describe, expect, it } from 'vitest';

import { MbsDesignPoint, MbsMarker, MbsRefMarker } from '../src/model';

describe('MbsMarker', () => {
    it('tracks related reference markers without duplicates', () => {
        const marker = new MbsMarker('m1', 'Marker1', 'g1');

        marker.appendRefMarker('ref1');
        marker.appendRefMarker('ref1');
        marker.appendRefMarker('ref2');

        expect(marker.relatedRefMarkerIds).toEqual(['ref1', 'ref2']);

        marker.removeRefMarker('ref1');
        expect(marker.relatedRefMarkerIds).toEqual(['ref2']);
    });

    it('is independent only when manual and without ref markers', () => {
        const marker = new MbsMarker('m1', 'Marker1', 'g1');

        expect(marker.isIndependentMarker()).toBe(false);

        marker.setManual(true);
        expect(marker.isIndependentMarker()).toBe(true);

        marker.appendRefMarker('ref1');
        expect(marker.isIndependentMarker()).toBe(false);

        marker.removeRefMarker('ref1');
        expect(marker.isIndependentMarker()).toBe(true);
    });
});

describe('MbsRefMarker', () => {
    it('is independent only when manual and not bound to basic marker', () => {
        const refMarker = new MbsRefMarker('r1', 'Ref1', 'g1');

        expect(refMarker.isIndependentMarker()).toBe(false);

        refMarker.setManual(true);
        expect(refMarker.isIndependentMarker()).toBe(true);

        refMarker.setRelatedMarker('m1');
        expect(refMarker.isIndependentMarker()).toBe(false);

        refMarker.setRelatedMarker(undefined);
        expect(refMarker.isIndependentMarker()).toBe(true);
    });
});

describe('MbsDesignPoint', () => {
    it('updates basic attributes through setters', () => {
        const point = new MbsDesignPoint('p1', 'Point1', 'g1');

        point.setPosition(1, 2, 3);
        point.setSize(12);
        point.setDirection({ x: 0, y: 0, z: 1 });
        point.setMarkerRef('m1');
        point.setDirectionReverse(true);
        point.setOffsetValue(2.5);

        expect(point.position).toEqual({ x: 1, y: 2, z: 3 });
        expect(point.size).toBe(12);
        expect(point.direction).toEqual({ x: 0, y: 0, z: 1 });
        expect(point.markerRefId).toBe('m1');
        expect(point.isDirectionReverse).toBe(true);
        expect(point.offsetValue).toBe(2.5);

        point.setDirection(undefined);
        expect(point.direction).toBeUndefined();
    });
});
