import { describe, expect, it } from 'vitest';

import {
    analyzeCircularPolyline,
    computeCylinderGuideGeometry,
    findNearestCircularEdge,
    polylineToEdgeData,
    sampleCirclePolyline
} from '../src/markerSnapGeometry';

describe('markerSnapGeometry', () => {
    it('recognizes sampled circle edges and returns their center', () => {
        const polyline = sampleCirclePolyline(
            { x: 10, y: -4, z: 2 },
            { x: 0, y: 0, z: 1 },
            6,
            48
        );

        const feature = analyzeCircularPolyline(polyline);
        expect(feature).toBeTruthy();
        expect(feature?.center.x).toBeCloseTo(10, 5);
        expect(feature?.center.y).toBeCloseTo(-4, 5);
        expect(feature?.center.z).toBeCloseTo(2, 5);
        expect(feature?.radius).toBeCloseTo(6, 5);
    });

    it('finds the nearest circular edge candidate around the hovered edge', () => {
        const polyline = sampleCirclePolyline(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            12,
            64
        );

        const candidate = findNearestCircularEdge(
            polylineToEdgeData(polyline),
            { x: 12, y: 0, z: 0.4 },
            { proximityTolerance: 1.5 }
        );

        expect(candidate).toBeTruthy();
        expect(candidate?.center.x).toBeCloseTo(0, 5);
        expect(candidate?.center.y).toBeCloseTo(0, 5);
        expect(candidate?.center.z).toBeCloseTo(0, 5);
        expect(candidate?.normal.y).toBeCloseTo(1, 5);
    });

    it('builds cylinder helper rails perpendicular to the current view', () => {
        const guide = computeCylinderGuideGeometry(
            { x: 0, y: 0, z: -10 },
            { x: 0, y: 0, z: 10 },
            5,
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 0, z: 2 }
        );

        expect(guide).toBeTruthy();
        expect(guide?.railAStart.y).toBeCloseTo(5, 5);
        expect(guide?.railAEnd.y).toBeCloseTo(5, 5);
        expect(guide?.railBStart.y).toBeCloseTo(-5, 5);
        expect(guide?.railBEnd.y).toBeCloseTo(-5, 5);
        expect(guide?.snapCircleCenter?.z).toBeCloseTo(2, 5);
    });
});
