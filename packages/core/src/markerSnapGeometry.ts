import type { EdgeData, Vec3 } from './types';

const EPSILON = 1e-6;

export interface CircleFeature {
    center: Vec3;
    normal: Vec3;
    radius: number;
    meanError: number;
    maxError: number;
    closed: boolean;
    pointCount: number;
}

export interface CircularEdgeCandidate extends CircleFeature {
    distanceToHit: number;
}

export interface CylinderGuideGeometry {
    axisStart: Vec3;
    axisEnd: Vec3;
    axisDirection: Vec3;
    radius: number;
    railAStart: Vec3;
    railAEnd: Vec3;
    railBStart: Vec3;
    railBEnd: Vec3;
    snapCircleCenter?: Vec3;
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtractVec3(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scaleVec3(value: Vec3, scalar: number): Vec3 {
    return { x: value.x * scalar, y: value.y * scalar, z: value.z * scalar };
}

function dotVec3(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function crossVec3(a: Vec3, b: Vec3): Vec3 {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function lengthVec3(value: Vec3): number {
    return Math.hypot(value.x, value.y, value.z);
}

function normalizeVec3(value: Vec3): Vec3 | null {
    const magnitude = lengthVec3(value);
    if (!Number.isFinite(magnitude) || magnitude <= EPSILON) {
        return null;
    }
    return scaleVec3(value, 1 / magnitude);
}

function distanceBetweenPoints(a: Vec3, b: Vec3): number {
    return lengthVec3(subtractVec3(a, b));
}

function distanceToSegment(point: Vec3, start: Vec3, end: Vec3): number {
    const segment = subtractVec3(end, start);
    const lengthSq = dotVec3(segment, segment);
    if (lengthSq <= EPSILON) {
        return distanceBetweenPoints(point, start);
    }
    const t = Math.max(0, Math.min(1, dotVec3(subtractVec3(point, start), segment) / lengthSq));
    const closest = addVec3(start, scaleVec3(segment, t));
    return distanceBetweenPoints(point, closest);
}

function arePointsClose(a: Vec3, b: Vec3, tolerance: number): boolean {
    return distanceBetweenPoints(a, b) <= tolerance;
}

function pickPerpendicularBasis(normal: Vec3): Vec3 {
    if (Math.abs(normal.x) < 0.8) {
        return { x: 1, y: 0, z: 0 };
    }
    if (Math.abs(normal.y) < 0.8) {
        return { x: 0, y: 1, z: 0 };
    }
    return { x: 0, y: 0, z: 1 };
}

function buildPlaneBasis(normal: Vec3): { xAxis: Vec3; yAxis: Vec3 } | null {
    const helper = pickPerpendicularBasis(normal);
    const xAxis = normalizeVec3(crossVec3(normal, helper));
    if (!xAxis) {
        return null;
    }
    const yAxis = normalizeVec3(crossVec3(normal, xAxis));
    if (!yAxis) {
        return null;
    }
    return { xAxis, yAxis };
}

function solveLinear3x3(matrix: number[][], vector: number[]): [number, number, number] | null {
    const rows = matrix.map((row, index) => [...row, vector[index]]);

    for (let pivot = 0; pivot < 3; pivot += 1) {
        let bestRow = pivot;
        for (let row = pivot + 1; row < 3; row += 1) {
            if (Math.abs(rows[row][pivot]) > Math.abs(rows[bestRow][pivot])) {
                bestRow = row;
            }
        }

        if (Math.abs(rows[bestRow][pivot]) <= EPSILON) {
            return null;
        }

        if (bestRow !== pivot) {
            const temp = rows[pivot];
            rows[pivot] = rows[bestRow];
            rows[bestRow] = temp;
        }

        const pivotValue = rows[pivot][pivot];
        for (let column = pivot; column < 4; column += 1) {
            rows[pivot][column] /= pivotValue;
        }

        for (let row = 0; row < 3; row += 1) {
            if (row === pivot) {
                continue;
            }
            const factor = rows[row][pivot];
            if (Math.abs(factor) <= EPSILON) {
                continue;
            }
            for (let column = pivot; column < 4; column += 1) {
                rows[row][column] -= factor * rows[pivot][column];
            }
        }
    }

    return [rows[0][3], rows[1][3], rows[2][3]];
}

export function buildEdgePolylines(
    edgeData: EdgeData | undefined,
    options?: { mergeTolerance?: number }
): Vec3[][] {
    const edgeVertices = edgeData?.vertices;
    if (!edgeVertices || edgeVertices.length < 6) {
        return [];
    }

    const tolerance = options?.mergeTolerance ?? 1e-5;
    const polylines: Vec3[][] = [];
    let current: Vec3[] = [];

    for (let index = 0; index + 5 < edgeVertices.length; index += 6) {
        const start = {
            x: edgeVertices[index],
            y: edgeVertices[index + 1],
            z: edgeVertices[index + 2]
        };
        const end = {
            x: edgeVertices[index + 3],
            y: edgeVertices[index + 4],
            z: edgeVertices[index + 5]
        };

        if (current.length === 0) {
            current = [start, end];
            continue;
        }

        const tail = current[current.length - 1];
        if (arePointsClose(tail, start, tolerance)) {
            current.push(end);
            continue;
        }

        polylines.push(current);
        current = [start, end];
    }

    if (current.length > 1) {
        polylines.push(current);
    }

    return polylines;
}

export function sampleCirclePolyline(
    center: Vec3,
    normal: Vec3,
    radius: number,
    segments: number = 48
): Vec3[] {
    const normalized = normalizeVec3(normal);
    if (!normalized || !Number.isFinite(radius) || radius <= EPSILON || segments < 3) {
        return [];
    }
    const basis = buildPlaneBasis(normalized);
    if (!basis) {
        return [];
    }

    const points: Vec3[] = [];
    for (let index = 0; index < segments; index += 1) {
        const angle = (Math.PI * 2 * index) / segments;
        const radial = addVec3(
            scaleVec3(basis.xAxis, Math.cos(angle) * radius),
            scaleVec3(basis.yAxis, Math.sin(angle) * radius)
        );
        points.push(addVec3(center, radial));
    }
    points.push(points[0]);
    return points;
}

export function polylineToEdgeData(points: Vec3[]): EdgeData {
    const vertices = new Float32Array(Math.max(points.length - 1, 0) * 6);
    for (let index = 0; index + 1 < points.length; index += 1) {
        const offset = index * 6;
        vertices[offset] = points[index].x;
        vertices[offset + 1] = points[index].y;
        vertices[offset + 2] = points[index].z;
        vertices[offset + 3] = points[index + 1].x;
        vertices[offset + 4] = points[index + 1].y;
        vertices[offset + 5] = points[index + 1].z;
    }
    return { vertices };
}

export function analyzeCircularPolyline(
    points: Vec3[],
    options?: {
        closureTolerance?: number;
        maxMeanError?: number;
        maxError?: number;
        minPointCount?: number;
    }
): CircleFeature | null {
    const minPointCount = options?.minPointCount ?? 8;
    if (points.length < minPointCount) {
        return null;
    }

    const working = [...points];
    const closureTolerance = options?.closureTolerance ?? 1e-4;
    const closed = arePointsClose(working[0], working[working.length - 1], closureTolerance);
    if (!closed) {
        return null;
    }
    if (working.length >= 2) {
        working.pop();
    }
    if (working.length < minPointCount - 1) {
        return null;
    }

    const centroid = working.reduce(
        (acc, point) => ({
            x: acc.x + point.x,
            y: acc.y + point.y,
            z: acc.z + point.z
        }),
        { x: 0, y: 0, z: 0 }
    );
    const centerHint = scaleVec3(centroid, 1 / working.length);

    let accumulatedNormal: Vec3 = { x: 0, y: 0, z: 0 };
    for (let index = 0; index < working.length; index += 1) {
        const current = subtractVec3(working[index], centerHint);
        const next = subtractVec3(working[(index + 1) % working.length], centerHint);
        accumulatedNormal = addVec3(accumulatedNormal, crossVec3(current, next));
    }
    const normal = normalizeVec3(accumulatedNormal);
    if (!normal) {
        return null;
    }

    const basis = buildPlaneBasis(normal);
    if (!basis) {
        return null;
    }

    const projected = working.map((point) => {
        const relative = subtractVec3(point, centerHint);
        return {
            x: dotVec3(relative, basis.xAxis),
            y: dotVec3(relative, basis.yAxis),
            planeOffset: dotVec3(relative, normal)
        };
    });

    const maxPlaneOffset = projected.reduce((max, point) => Math.max(max, Math.abs(point.planeOffset)), 0);
    const planeTolerance = Math.max(maxPlaneOffset * 2, 1e-4);
    if (maxPlaneOffset > planeTolerance) {
        return null;
    }

    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumYY = 0;
    let sumXY = 0;
    let sumZ = 0;
    let sumXZ = 0;
    let sumYZ = 0;

    projected.forEach((point) => {
        const z = (point.x * point.x) + (point.y * point.y);
        sumX += point.x;
        sumY += point.y;
        sumXX += point.x * point.x;
        sumYY += point.y * point.y;
        sumXY += point.x * point.y;
        sumZ += z;
        sumXZ += point.x * z;
        sumYZ += point.y * z;
    });

    const solution = solveLinear3x3(
        [
            [sumXX, sumXY, sumX],
            [sumXY, sumYY, sumY],
            [sumX, sumY, projected.length]
        ],
        [-sumXZ, -sumYZ, -sumZ]
    );
    if (!solution) {
        return null;
    }

    const [a, b, c] = solution;
    const center2d = { x: -a / 2, y: -b / 2 };
    const radiusSq = (center2d.x * center2d.x) + (center2d.y * center2d.y) - c;
    if (!Number.isFinite(radiusSq) || radiusSq <= EPSILON) {
        return null;
    }

    const radius = Math.sqrt(radiusSq);
    const center = addVec3(
        centerHint,
        addVec3(
            scaleVec3(basis.xAxis, center2d.x),
            scaleVec3(basis.yAxis, center2d.y)
        )
    );

    let totalError = 0;
    let maxError = 0;
    projected.forEach((point) => {
        const radial = Math.hypot(point.x - center2d.x, point.y - center2d.y);
        const error = Math.abs(radial - radius);
        totalError += error;
        maxError = Math.max(maxError, error);
    });

    const meanError = totalError / projected.length;
    const meanTolerance = options?.maxMeanError ?? Math.max(radius * 0.015, 1e-4);
    const pointTolerance = options?.maxError ?? Math.max(radius * 0.035, 2e-4);
    if (meanError > meanTolerance || maxError > pointTolerance) {
        return null;
    }

    return {
        center,
        normal,
        radius,
        meanError,
        maxError,
        closed: true,
        pointCount: projected.length
    };
}

export function findNearestCircularEdge(
    edgeData: EdgeData | undefined,
    hitPosition: Vec3,
    options?: {
        proximityTolerance?: number;
    }
): CircularEdgeCandidate | null {
    const polylines = buildEdgePolylines(edgeData);
    if (polylines.length === 0) {
        return null;
    }

    let best: CircularEdgeCandidate | null = null;
    for (const polyline of polylines) {
        const feature = analyzeCircularPolyline(polyline);
        if (!feature) {
            continue;
        }

        let distanceToHit = Number.POSITIVE_INFINITY;
        for (let index = 0; index + 1 < polyline.length; index += 1) {
            distanceToHit = Math.min(
                distanceToHit,
                distanceToSegment(hitPosition, polyline[index], polyline[index + 1])
            );
        }

        const proximityTolerance = options?.proximityTolerance
            ?? Math.max(feature.radius * 0.18, 0.25);
        if (distanceToHit > proximityTolerance) {
            continue;
        }

        const candidate: CircularEdgeCandidate = {
            ...feature,
            distanceToHit
        };
        if (!best || candidate.distanceToHit < best.distanceToHit) {
            best = candidate;
        }
    }

    return best;
}

export function computeCylinderGuideGeometry(
    axisStart: Vec3,
    axisEnd: Vec3,
    radius: number,
    viewDirection: Vec3,
    snapCircleCenter?: Vec3
): CylinderGuideGeometry | null {
    if (!Number.isFinite(radius) || radius <= EPSILON) {
        return null;
    }

    const axisVector = subtractVec3(axisEnd, axisStart);
    const axisDirection = normalizeVec3(axisVector);
    const view = normalizeVec3(viewDirection);
    if (!axisDirection || !view) {
        return null;
    }

    const viewParallel = scaleVec3(axisDirection, dotVec3(view, axisDirection));
    let projectedView = subtractVec3(view, viewParallel);
    if (lengthVec3(projectedView) <= EPSILON) {
        const fallback = pickPerpendicularBasis(axisDirection);
        projectedView = crossVec3(axisDirection, fallback);
    }

    const railOffsetDirection = normalizeVec3(crossVec3(axisDirection, projectedView));
    if (!railOffsetDirection) {
        return null;
    }

    const railOffset = scaleVec3(railOffsetDirection, radius);
    return {
        axisStart,
        axisEnd,
        axisDirection,
        radius,
        railAStart: addVec3(axisStart, railOffset),
        railAEnd: addVec3(axisEnd, railOffset),
        railBStart: subtractVec3(axisStart, railOffset),
        railBEnd: subtractVec3(axisEnd, railOffset),
        snapCircleCenter
    };
}
