import { Vec3, Mat3 } from '../types';

export interface IMbsFrame {
    id: string;
    name: string;
    position: Vec3;
    orientation: Mat3;
    parentId?: string;
}

export class MbsFrame implements IMbsFrame {
    id: string;
    name: string;
    position: Vec3 = { x: 0, y: 0, z: 0 };
    orientation: Mat3 = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
    parentId?: string;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    setPosition(x: number, y: number, z: number): void {
        this.position = { x, y, z };
    }

    setOrientation(matrix: Mat3): void {
        this.orientation = matrix;
    }
}

export class MbsMarker extends MbsFrame {
    groupId: string;

    constructor(id: string, name: string, groupId: string) {
        super(id, name);
        this.groupId = groupId;
    }
}
