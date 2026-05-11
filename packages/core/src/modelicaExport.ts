import type { EdgeData, Mat3, Vec3 } from './types';

export interface MbJsonGroupRecord {
    name: string;
    totalMass: number;
    inertiaTensor: Mat3;
    imageFile: string;
    dxfFile: string;
}

export interface MbJsonMarkerRecord {
    name: string;
    groupRef: string;
    position: Vec3;
    direction: Vec3;
}

export interface MbJsonConnectorRecord {
    name: string;
    connectorType: string;
    groupRef1: string;
    groupRef2: string;
    position: Vec3;
    direction: Vec3;
}

export interface MbJsonMotionRecord {
    name: string;
    motionType: string;
    connectorRef: string;
}

export interface BuildMbJsonDocumentInput {
    packageName: string;
    group: MbJsonGroupRecord[];
    marker: MbJsonMarkerRecord[];
    connector: MbJsonConnectorRecord[];
    motion: MbJsonMotionRecord[];
}

export interface MbJsonDocument {
    packageName: string;
    group: MbJsonGroupRecord[];
    marker: MbJsonMarkerRecord[];
    connector: MbJsonConnectorRecord[];
    motion: MbJsonMotionRecord[];
}

function cloneVec3(value: Vec3): Vec3 {
    return { x: value.x, y: value.y, z: value.z };
}

function cloneMat3(value: Mat3): Mat3 {
    return { m: [...value.m] };
}

function formatDxfNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return '0';
    }

    const normalized = Object.is(value, -0) ? 0 : value;
    return Number.isInteger(normalized) ? `${normalized}` : `${normalized}`.replace(/\.?0+$/, '');
}

export function buildMbJsonDocument(input: BuildMbJsonDocumentInput): MbJsonDocument {
    return {
        packageName: input.packageName,
        group: input.group.map(group => ({
            name: group.name,
            totalMass: group.totalMass,
            inertiaTensor: cloneMat3(group.inertiaTensor),
            imageFile: group.imageFile,
            dxfFile: group.dxfFile
        })),
        marker: input.marker.map(marker => ({
            name: marker.name,
            groupRef: marker.groupRef,
            position: cloneVec3(marker.position),
            direction: cloneVec3(marker.direction)
        })),
        connector: input.connector.map(connector => ({
            name: connector.name,
            connectorType: connector.connectorType,
            groupRef1: connector.groupRef1,
            groupRef2: connector.groupRef2,
            position: cloneVec3(connector.position),
            direction: cloneVec3(connector.direction)
        })),
        motion: input.motion.map(motion => ({
            name: motion.name,
            motionType: motion.motionType,
            connectorRef: motion.connectorRef
        }))
    };
}

export function buildDxfDocument(edgeDataItems: Array<Pick<EdgeData, 'vertices'>>): string {
    const lines: string[] = ['0', 'SECTION', '2', 'ENTITIES'];

    edgeDataItems.forEach(edgeData => {
        const vertices = edgeData.vertices;
        for (let index = 0; index + 5 < vertices.length; index += 6) {
            lines.push(
                '0',
                'LINE',
                '8',
                '0',
                '10',
                formatDxfNumber(vertices[index]),
                '20',
                formatDxfNumber(vertices[index + 1]),
                '30',
                formatDxfNumber(vertices[index + 2]),
                '11',
                formatDxfNumber(vertices[index + 3]),
                '21',
                formatDxfNumber(vertices[index + 4]),
                '31',
                formatDxfNumber(vertices[index + 5])
            );
        }
    });

    lines.push('0', 'ENDSEC', '0', 'EOF');
    return `${lines.join('\n')}\n`;
}
