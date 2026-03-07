import type { Vec3 } from '../types';

export interface IMbsDesignPoint {
    id: string;
    name: string;
    groupId: string;
    position: Vec3;
    size: number;
    direction?: Vec3;
    markerRefId?: string;
    isDirectionReverse: boolean;
    offsetValue: number;
}

export class MbsDesignPoint implements IMbsDesignPoint {
    id: string;
    name: string;
    groupId: string;
    position: Vec3 = { x: 0, y: 0, z: 0 };
    size = -1;
    direction?: Vec3;
    markerRefId?: string;
    isDirectionReverse = false;
    offsetValue = 0;

    constructor(id: string, name: string, groupId: string) {
        this.id = id;
        this.name = name;
        this.groupId = groupId;
    }

    setPosition(x: number, y: number, z: number): void {
        this.position = { x, y, z };
    }

    setSize(size: number): void {
        this.size = size;
    }

    setDirection(direction: Vec3 | undefined): void {
        this.direction = direction ? { ...direction } : undefined;
    }

    setMarkerRef(markerRefId: string | undefined): void {
        this.markerRefId = markerRefId;
    }

    setDirectionReverse(isDirectionReverse: boolean): void {
        this.isDirectionReverse = isDirectionReverse;
    }

    setOffsetValue(offsetValue: number): void {
        this.offsetValue = offsetValue;
    }
}
