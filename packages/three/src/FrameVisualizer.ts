import * as THREE from 'three';
import type { Mat3, Vec3 } from '@cadtool-online/core';

export interface FrameVisualizerOptions {
    axisLength?: number;
    axisWidth?: number;
    showLabels?: boolean;
    labelSize?: number;
}

export interface FrameData {
    id: string;
    name: string;
    position: Vec3;
    orientation: Mat3;
    size?: number;
    visible?: boolean;
    isPrimary?: boolean;
}

export class FrameVisualizer {
    private scene: THREE.Scene;
    private frames: Map<string, THREE.Group> = new Map();
    private options: Required<FrameVisualizerOptions>;

    private static readonly COLORS = {
        xAxis: 0xff0000,
        yAxis: 0x00ff00,
        zAxis: 0x0000ff,
        primary: 0xffff00,
        secondary: 0x00ffff
    };

    constructor(scene: THREE.Scene, options: FrameVisualizerOptions = {}) {
        this.scene = scene;
        this.options = {
            axisLength: options.axisLength ?? 20,
            axisWidth: options.axisWidth ?? 2,
            showLabels: options.showLabels ?? true,
            labelSize: options.labelSize ?? 5
        };
    }

    private createAxis(
        direction: THREE.Vector3,
        color: number,
        length: number
    ): THREE.ArrowHelper {
        return new THREE.ArrowHelper(
            direction.normalize(),
            new THREE.Vector3(0, 0, 0),
            length,
            color,
            length * 0.2,
            length * 0.1
        );
    }

    private createFrameGroup(data: FrameData): THREE.Group {
        const group = new THREE.Group();
        group.name = `frame_${data.id}`;

        const length = typeof data.size === 'number' && data.size > 0
            ? data.size
            : this.options.axisLength;

        const m = data.orientation.m;
        const xAxis = new THREE.Vector3(m[0], m[3], m[6]);
        const yAxis = new THREE.Vector3(m[1], m[4], m[7]);
        const zAxis = new THREE.Vector3(m[2], m[5], m[8]);

        group.add(this.createAxis(xAxis, FrameVisualizer.COLORS.xAxis, length));
        group.add(this.createAxis(yAxis, FrameVisualizer.COLORS.yAxis, length));
        group.add(this.createAxis(zAxis, FrameVisualizer.COLORS.zAxis, length));

        const sphereGeometry = new THREE.SphereGeometry(length * 0.08, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: data.isPrimary
                ? FrameVisualizer.COLORS.primary
                : FrameVisualizer.COLORS.secondary
        });
        group.add(new THREE.Mesh(sphereGeometry, sphereMaterial));

        group.position.set(data.position.x, data.position.y, data.position.z);
        group.visible = data.visible ?? true;
        group.userData = {
            frameId: data.id,
            frameName: data.name,
            isPrimary: data.isPrimary,
            orientation: { m: [...data.orientation.m] },
            size: data.size,
            visible: data.visible ?? true
        };

        return group;
    }

    addFrame(data: FrameData): THREE.Group {
        if (this.frames.has(data.id)) {
            this.removeFrame(data.id);
        }

        const group = this.createFrameGroup(data);
        this.scene.add(group);
        this.frames.set(data.id, group);
        return group;
    }

    updateFrame(data: FrameData): void {
        this.removeFrame(data.id);
        this.addFrame(data);
    }

    removeFrame(id: string): void {
        const group = this.frames.get(id);
        if (!group) {
            return;
        }

        this.scene.remove(group);
        group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (child.material instanceof THREE.Material) {
                    child.material.dispose();
                }
            }
        });
        this.frames.delete(id);
    }

    getFrame(id: string): THREE.Group | undefined {
        return this.frames.get(id);
    }

    getAllFrameIds(): string[] {
        return Array.from(this.frames.keys());
    }

    setFrameVisible(id: string, visible: boolean): void {
        const group = this.frames.get(id);
        if (group) {
            group.visible = visible;
            group.userData.visible = visible;
        }
    }

    setAllFramesVisible(visible: boolean): void {
        this.frames.forEach((group) => {
            group.visible = visible;
            group.userData.visible = visible;
        });
    }

    setAxisLength(length: number): void {
        this.options.axisLength = length;
        const frameDataList: FrameData[] = [];

        this.frames.forEach((group, id) => {
            frameDataList.push({
                id,
                name: group.userData.frameName as string,
                position: {
                    x: group.position.x,
                    y: group.position.y,
                    z: group.position.z
                },
                orientation: group.userData.orientation as Mat3,
                size: group.userData.size as number | undefined,
                visible: group.userData.visible as boolean | undefined,
                isPrimary: group.userData.isPrimary as boolean | undefined
            });
        });

        this.clear();
        frameDataList.forEach((data) => this.addFrame(data));
    }

    clear(): void {
        const ids = Array.from(this.frames.keys());
        ids.forEach((id) => this.removeFrame(id));
    }

    dispose(): void {
        this.clear();
    }
}
