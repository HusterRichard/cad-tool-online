import * as THREE from 'three';
import type { Vec3 } from '@cadtool-online/core';

export interface MotionVisualizerOptions {
    motionSize?: number;
}

export interface MotionData {
    id: string;
    name: string;
    motionType: 'translational' | 'rotational';
    position: Vec3;
    axis: Vec3;
    size?: number;
    selected?: boolean;
    displayState?: 'draft' | 'created';
}

export class MotionVisualizer {
    private scene: THREE.Scene;
    private motions: Map<string, THREE.Group> = new Map();
    private options: Required<MotionVisualizerOptions>;

    private static readonly MOTION_DRAFT_COLOR = 0xffffff;
    private static readonly MOTION_CREATED_COLOR = 0xff5559;
    private static readonly MOTION_SELECTED_LINE_COLOR = 0xff5559;
    private static readonly MOTION_DRAFT_OPACITY = 0.94;
    private static readonly MOTION_CREATED_OPACITY = 0.98;

    constructor(scene: THREE.Scene, options: MotionVisualizerOptions = {}) {
        this.scene = scene;
        this.options = {
            motionSize: options.motionSize ?? 10
        };
    }

    private getMotionSize(data: MotionData): number {
        return data.size && data.size > 0 ? data.size : this.options.motionSize;
    }

    private resolveStrokeColor(data: MotionData): number {
        return data.displayState === 'draft'
            ? MotionVisualizer.MOTION_DRAFT_COLOR
            : MotionVisualizer.MOTION_CREATED_COLOR;
    }

    private resolveStrokeOpacity(data: MotionData): number {
        return data.displayState === 'draft'
            ? MotionVisualizer.MOTION_DRAFT_OPACITY
            : MotionVisualizer.MOTION_CREATED_OPACITY;
    }

    private createStrokeMaterial(data: MotionData): THREE.LineBasicMaterial {
        const material = new THREE.LineBasicMaterial({
            color: this.resolveStrokeColor(data),
            transparent: true,
            opacity: this.resolveStrokeOpacity(data),
            depthTest: false
        });
        material.depthWrite = false;
        material.toneMapped = false;
        material.userData.baseColor = this.resolveStrokeColor(data);
        material.userData.baseOpacity = this.resolveStrokeOpacity(data);
        return material;
    }

    private attachRole<T extends THREE.Object3D>(object: T, role: string): T {
        object.userData.jointRole = role;
        return object;
    }

    private createPolyline(points: THREE.Vector3[], data: MotionData, role: string): THREE.Line {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = this.attachRole(
            new THREE.Line(geometry, this.createStrokeMaterial(data)),
            role
        );
        line.renderOrder = 44;
        return line;
    }

    private createLoop(points: THREE.Vector3[], data: MotionData, role: string): THREE.LineLoop {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = this.attachRole(
            new THREE.LineLoop(geometry, this.createStrokeMaterial(data)),
            role
        );
        line.renderOrder = 44;
        return line;
    }

    private createArc(
        radius: number,
        startAngle: number,
        endAngle: number,
        data: MotionData,
        role: string,
        segments = 48
    ): THREE.Line {
        const points: THREE.Vector3[] = [];
        for (let index = 0; index <= segments; index += 1) {
            const angle = startAngle + ((endAngle - startAngle) * index) / segments;
            points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
        }
        return this.createPolyline(points, data, role);
    }

    private createTranslationalMotion(data: MotionData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getMotionSize(data);
        const halfLength = size * 1.62;
        const tailHalfWidth = size * 0.42;
        const headHalfWidth = size * 0.92;
        const headBaseZ = size * 0.36;
        const tailSkew = size * 0.16;

        group.add(
            this.createLoop(
                [
                    new THREE.Vector3(-tailHalfWidth, 0, -halfLength + tailSkew),
                    new THREE.Vector3(tailHalfWidth, 0, -halfLength),
                    new THREE.Vector3(tailHalfWidth, 0, headBaseZ),
                    new THREE.Vector3(headHalfWidth, 0, headBaseZ),
                    new THREE.Vector3(0, 0, halfLength),
                    new THREE.Vector3(-headHalfWidth, 0, headBaseZ),
                    new THREE.Vector3(-tailHalfWidth, 0, headBaseZ)
                ],
                data,
                'motion-translational-outline'
            )
        );
        return group;
    }

    private createRotationalMotion(data: MotionData): THREE.Group {
        const group = this.attachRole(new THREE.Group(), 'motion-rotational-outline');
        const size = this.getMotionSize(data);
        const outerRadius = size * 1.5;
        const innerRadius = size * 0.85;
        const flareOuterRadius = size * 1.82;
        const flareInnerRadius = size * 0.55;
        const tipExtension = size * 0.95;
        const topAngle = THREE.MathUtils.degToRad(90);
        const endAngle = THREE.MathUtils.degToRad(315);

        const cosEnd = Math.cos(endAngle);
        const sinEnd = Math.sin(endAngle);
        const tangentX = -Math.sin(endAngle);
        const tangentY = Math.cos(endAngle);
        const midRadius = (flareOuterRadius + flareInnerRadius) / 2;

        const outerTop = new THREE.Vector3(
            Math.cos(topAngle) * outerRadius,
            Math.sin(topAngle) * outerRadius,
            0
        );
        const innerTop = new THREE.Vector3(
            Math.cos(topAngle) * innerRadius,
            Math.sin(topAngle) * innerRadius,
            0
        );
        const outerEnd = new THREE.Vector3(cosEnd * outerRadius, sinEnd * outerRadius, 0);
        const innerEnd = new THREE.Vector3(cosEnd * innerRadius, sinEnd * innerRadius, 0);
        const baseOuter = new THREE.Vector3(cosEnd * flareOuterRadius, sinEnd * flareOuterRadius, 0);
        const baseInner = new THREE.Vector3(cosEnd * flareInnerRadius, sinEnd * flareInnerRadius, 0);
        const tip = new THREE.Vector3(
            cosEnd * midRadius + tangentX * tipExtension,
            sinEnd * midRadius + tangentY * tipExtension,
            0
        );

        group.add(this.createArc(outerRadius, topAngle, endAngle, data, 'motion-rotational-outer-arc', 56));
        group.add(this.createPolyline([outerEnd, baseOuter], data, 'motion-rotational-head-base-outer'));
        group.add(this.createPolyline([baseOuter, tip], data, 'motion-rotational-head-top'));
        group.add(this.createPolyline([tip, baseInner], data, 'motion-rotational-head-bottom'));
        group.add(this.createPolyline([baseInner, innerEnd], data, 'motion-rotational-head-base-inner'));
        group.add(this.createArc(innerRadius, topAngle, endAngle, data, 'motion-rotational-inner-arc', 40));
        group.add(this.createPolyline([innerTop, outerTop], data, 'motion-rotational-top-cap'));
        return group;
    }

    private createMotionQuaternion(
        axisRaw: THREE.Vector3,
        motionType: MotionData['motionType']
    ): THREE.Quaternion {
        const defaultAxis = new THREE.Vector3(0, 0, 1);
        const axis =
            axisRaw.lengthSq() > 1e-8 ? axisRaw.clone().normalize() : defaultAxis.clone();

        if (motionType !== 'rotational') {
            return new THREE.Quaternion().setFromUnitVectors(defaultAxis, axis);
        }

        const topCandidates = [
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 1)
        ];

        for (const candidate of topCandidates) {
            const top = candidate
                .clone()
                .sub(axis.clone().multiplyScalar(candidate.dot(axis)));
            if (top.lengthSq() <= 1e-8) {
                continue;
            }

            top.normalize();
            const right = top.clone().cross(axis).normalize();
            const correctedTop = axis.clone().cross(right).normalize();
            const basis = new THREE.Matrix4().makeBasis(right, correctedTop, axis);
            return new THREE.Quaternion().setFromRotationMatrix(basis);
        }

        return new THREE.Quaternion().setFromUnitVectors(defaultAxis, axis);
    }

    private applySelectionAppearance(group: THREE.Group, selected: boolean): void {
        group.scale.setScalar(selected ? 1.12 : 1);
        group.traverse((child) => {
            const renderable = child as THREE.Object3D & {
                material?: THREE.Material | THREE.Material[];
            };
            const materials = Array.isArray(renderable.material)
                ? renderable.material
                : renderable.material
                  ? [renderable.material]
                  : [];

            materials.forEach((material) => {
                const baseOpacity =
                    typeof material.userData.baseOpacity === 'number'
                        ? material.userData.baseOpacity
                        : 1;
                const baseColor =
                    typeof material.userData.baseColor === 'number'
                        ? material.userData.baseColor
                        : MotionVisualizer.MOTION_CREATED_COLOR;

                if (material instanceof THREE.LineBasicMaterial) {
                    material.color.setHex(
                        selected ? MotionVisualizer.MOTION_SELECTED_LINE_COLOR : baseColor
                    );
                    material.opacity = selected ? Math.min(1, baseOpacity + 0.12) : baseOpacity;
                    material.transparent = material.opacity < 1;
                }
            });
        });
        group.userData.motionSelected = selected;
    }

    private createMotionGroup(data: MotionData): THREE.Group {
        const group =
            data.motionType === 'translational'
                ? this.createTranslationalMotion(data)
                : this.createRotationalMotion(data);

        group.name = `motion_${data.id}`;
        group.position.set(data.position.x, data.position.y, data.position.z);

        const axis = new THREE.Vector3(data.axis.x, data.axis.y, data.axis.z);
        const quaternion = this.createMotionQuaternion(axis, data.motionType);
        group.quaternion.copy(quaternion);

        group.userData = {
            ...group.userData,
            motionId: data.id,
            motionName: data.name,
            motionType: data.motionType,
            motionDisplayState: data.displayState ?? 'created',
            motionSelected: Boolean(data.selected),
            selectionAppearance: 'joint'
        };
        this.applySelectionAppearance(group, Boolean(data.selected));

        return group;
    }

    addMotion(data: MotionData): THREE.Group {
        if (this.motions.has(data.id)) {
            this.removeMotion(data.id);
        }

        const group = this.createMotionGroup(data);
        this.scene.add(group);
        this.motions.set(data.id, group);
        return group;
    }

    updateMotion(data: MotionData): void {
        this.removeMotion(data.id);
        this.addMotion(data);
    }

    removeMotion(id: string): void {
        const group = this.motions.get(id);
        if (!group) {
            return;
        }

        this.scene.remove(group);
        group.traverse((child) => {
            const renderable = child as THREE.Object3D & {
                geometry?: THREE.BufferGeometry;
                material?: THREE.Material | THREE.Material[];
            };

            if (renderable.geometry) {
                renderable.geometry.dispose();
            }

            const materials = Array.isArray(renderable.material)
                ? renderable.material
                : renderable.material
                  ? [renderable.material]
                  : [];
            materials.forEach(material => material.dispose());
        });
        this.motions.delete(id);
    }

    getMotion(id: string): THREE.Group | undefined {
        return this.motions.get(id);
    }

    getAllMotionIds(): string[] {
        return Array.from(this.motions.keys());
    }

    setMotionVisible(id: string, visible: boolean): void {
        const group = this.motions.get(id);
        if (group) {
            group.visible = visible;
        }
    }

    setMotionSelected(id: string, selected: boolean): void {
        const group = this.motions.get(id);
        if (group) {
            this.applySelectionAppearance(group, selected);
        }
    }

    setAllMotionsVisible(visible: boolean): void {
        this.motions.forEach(group => {
            group.visible = visible;
        });
    }

    clear(): void {
        const ids = Array.from(this.motions.keys());
        ids.forEach(id => this.removeMotion(id));
    }

    dispose(): void {
        this.clear();
    }
}
