import { Vec3, Mat3 } from '../types';

export interface IMbsGroup {
    id: string;
    name: string;
    mass: number;
    centerOfMass: Vec3;
    inertiaMatrix: Mat3;
    shapeIds: string[];
}

export class MbsGroup implements IMbsGroup {
    id: string;
    name: string;
    mass: number = 0;
    centerOfMass: Vec3 = { x: 0, y: 0, z: 0 };
    inertiaMatrix: Mat3 = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
    shapeIds: string[] = [];

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    addShape(shapeId: string): void {
        if (!this.shapeIds.includes(shapeId)) {
            this.shapeIds.push(shapeId);
        }
    }

    removeShape(shapeId: string): void {
        const index = this.shapeIds.indexOf(shapeId);
        if (index !== -1) {
            this.shapeIds.splice(index, 1);
        }
    }
}
