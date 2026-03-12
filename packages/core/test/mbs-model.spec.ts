import { describe, expect, it } from 'vitest';

import {
    MbsDesignPoint,
    MbsFixed,
    MbsFrame,
    MbsMarker,
    MbsMarkerBase,
    MbsPlanar,
    MbsPrismatic,
    MbsRefMarker,
    MbsRevolute,
    MbsSpherical,
    MbsUniversal,
    MbsCylindrical
} from '../src/model';
import { JointType, type Mat3 } from '../src/types';

describe('MbsFrame', () => {
    it('starts with origin position, identity orientation and no parent, then updates via setters', () => {
        const frame = new MbsFrame('f1', 'Frame1');

        expect(frame.position).toEqual({ x: 0, y: 0, z: 0 });
        expect(frame.orientation).toEqual({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
        expect(frame.parentId).toBeUndefined();

        frame.setPosition(1, 2, 3);
        frame.setOrientation({ m: [0, -1, 0, 1, 0, 0, 0, 0, 1] });
        frame.setParentId('parent-1');

        expect(frame.position).toEqual({ x: 1, y: 2, z: 3 });
        expect(frame.orientation).toEqual({ m: [0, -1, 0, 1, 0, 0, 0, 0, 1] });
        expect(frame.parentId).toBe('parent-1');
    });

    it('copies orientation arrays defensively and can clear its parent id', () => {
        const frame = new MbsFrame('f1', 'Frame1');
        const orientation: Mat3 = { m: [0, 1, 0, -1, 0, 0, 0, 0, 1] };

        frame.setOrientation(orientation);
        frame.setParentId('parent-1');

        orientation.m[0] = 99;
        frame.setParentId(undefined);

        expect(frame.orientation).toEqual({ m: [0, 1, 0, -1, 0, 0, 0, 0, 1] });
        expect(frame.parentId).toBeUndefined();
    });
});

describe('MbsMarkerBase', () => {
    it('tracks related connector ids without duplicates and supports remove/clear', () => {
        const markerBase = new MbsMarkerBase('mb1', 'MarkerBase1', 'g1');

        markerBase.appendRelatedConnectorId('joint-1');
        markerBase.appendRelatedConnectorId('joint-1');
        markerBase.appendRelatedConnectorId('joint-2');

        expect(markerBase.relatedConnectorIds).toEqual(['joint-1', 'joint-2']);

        markerBase.removeRelatedConnectorId('joint-1');
        expect(markerBase.relatedConnectorIds).toEqual(['joint-2']);

        markerBase.clearRelatedConnectorIds();
        expect(markerBase.relatedConnectorIds).toEqual([]);
    });
});

describe('MbsJoint subclasses', () => {
    it.each([
        ['revolute', MbsRevolute, JointType.Revolute],
        ['prismatic', MbsPrismatic, JointType.Prismatic],
        ['cylindrical', MbsCylindrical, JointType.Cylindrical],
        ['spherical', MbsSpherical, JointType.Spherical],
        ['universal', MbsUniversal, JointType.Universal],
        ['planar', MbsPlanar, JointType.Planar],
        ['fixed', MbsFixed, JointType.Fixed]
    ])('keeps ids and binds %s joints to the correct JointType', (_label, JointCtor, type) => {
        const joint = new JointCtor('j1', 'Joint1', 'marker-i', 'marker-j');

        expect(joint.id).toBe('j1');
        expect(joint.name).toBe('Joint1');
        expect(joint.type).toBe(type);
        expect(joint.iMarkerId).toBe('marker-i');
        expect(joint.jMarkerId).toBe('marker-j');
    });
});

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
