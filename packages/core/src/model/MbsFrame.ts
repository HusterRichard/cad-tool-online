import type { Mat3, Vec3 } from '../types';

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
        this.orientation = { m: [...matrix.m] };
    }

    setParentId(parentId: string | undefined): void {
        this.parentId = parentId;
    }
}

export interface IMbsMarkerBase extends IMbsFrame {
    groupId: string;
    size: number;
    visible: boolean;
    relatedConnectorIds: string[];
    isManual: boolean;
}

export class MbsMarkerBase extends MbsFrame implements IMbsMarkerBase {
    groupId: string;
    size = -1;
    visible = true;
    relatedConnectorIds: string[] = [];
    isManual = false;

    constructor(id: string, name: string, groupId: string) {
        super(id, name);
        this.groupId = groupId;
    }

    setSize(size: number): void {
        this.size = size;
    }

    setVisible(visible: boolean): void {
        this.visible = visible;
    }

    setManual(isManual: boolean): void {
        this.isManual = isManual;
    }

    appendRelatedConnectorId(connectorId: string): void {
        if (!this.relatedConnectorIds.includes(connectorId)) {
            this.relatedConnectorIds.push(connectorId);
        }
    }

    removeRelatedConnectorId(connectorId: string): void {
        this.relatedConnectorIds = this.relatedConnectorIds.filter((id) => id !== connectorId);
    }

    clearRelatedConnectorIds(): void {
        this.relatedConnectorIds = [];
    }
}

export class MbsMarker extends MbsMarkerBase {
    relatedRefMarkerIds: string[] = [];

    appendRefMarker(refMarkerId: string): void {
        if (!this.relatedRefMarkerIds.includes(refMarkerId)) {
            this.relatedRefMarkerIds.push(refMarkerId);
        }
    }

    removeRefMarker(refMarkerId: string): void {
        this.relatedRefMarkerIds = this.relatedRefMarkerIds.filter((id) => id !== refMarkerId);
    }

    isIndependentMarker(): boolean {
        return this.isManual && this.relatedRefMarkerIds.length === 0;
    }
}

export class MbsRefMarker extends MbsMarkerBase {
    relatedMarkerId?: string;

    constructor(id: string, name: string, groupId: string, relatedMarkerId?: string) {
        super(id, name, groupId);
        this.relatedMarkerId = relatedMarkerId;
    }

    setRelatedMarker(markerId: string | undefined): void {
        this.relatedMarkerId = markerId;
    }

    isIndependentMarker(): boolean {
        return this.isManual && !this.relatedMarkerId;
    }
}
