import * as THREE from 'three';
import type { ConnectorTypeValue, Vec3 } from '@cadtool-online/core';
import { MbsJointType } from '@cadtool-online/geo';

export interface JointVisualizerOptions {
    jointSize?: number;
    showAxis?: boolean;
    showLimits?: boolean;
    iconBaseUrl?: string;
    preferSceneIcons?: boolean;
}

export interface JointData {
    id: string;
    name: string;
    type: MbsJointType;
    connectorType?: ConnectorTypeValue;
    position: Vec3;
    axis: Vec3;
    size?: number;
    selected?: boolean;
    displayState?: 'draft' | 'created';
    currentValue?: number[];
    limits?: { lower: number[]; upper: number[] };
}

/**
 * 关节可视化器 - 显示不同类型的关节
 */
export class JointVisualizer {
    private scene: THREE.Scene;
    private joints: Map<string, THREE.Group> = new Map();
    private options: {
        jointSize: number;
        showAxis: boolean;
        showLimits: boolean;
        iconBaseUrl?: string;
        preferSceneIcons: boolean;
    };
    private textureLoader: THREE.TextureLoader | null;
    private iconTextureCache = new Map<string, THREE.Texture>();

    private static readonly JOINT_DRAFT_COLOR = 0xffffff;
    private static readonly JOINT_CREATED_COLOR = 0x74c9ff;
    private static readonly JOINT_SELECTED_LINE_COLOR = 0x38bdf8;
    private static readonly JOINT_SELECTED_EMISSIVE = 0x58a6ff;
    private static readonly JOINT_DRAFT_OPACITY = 0.94;
    private static readonly JOINT_CREATED_OPACITY = 0.98;

    constructor(scene: THREE.Scene, options: JointVisualizerOptions = {}) {
        this.scene = scene;
        this.options = {
            jointSize: options.jointSize ?? 10,
            showAxis: options.showAxis ?? true,
            showLimits: options.showLimits ?? false,
            iconBaseUrl: options.iconBaseUrl,
            preferSceneIcons: options.preferSceneIcons ?? false
        };
        this.textureLoader =
            this.options.iconBaseUrl && typeof document !== 'undefined'
                ? new THREE.TextureLoader()
                : null;
    }

    private getJointSize(data: JointData): number {
        return data.size && data.size > 0 ? data.size : this.options.jointSize;
    }

    private resolveConnectorType(data: JointData): ConnectorTypeValue {
        if (data.connectorType) {
            return data.connectorType;
        }

        switch (data.type) {
            case MbsJointType.Fixed:
                return 'fixed';
            case MbsJointType.Prismatic:
                return 'prismatic';
            case MbsJointType.Cylindrical:
                return 'cylindrical';
            case MbsJointType.Spherical:
                return 'spherical';
            case MbsJointType.Universal:
                return 'universal';
            case MbsJointType.Planar:
                return 'planar';
            case MbsJointType.Revolute:
            default:
                return 'revolute';
        }
    }

    private resolveStrokeColor(data: JointData): number {
        return data.displayState === 'draft'
            ? JointVisualizer.JOINT_DRAFT_COLOR
            : JointVisualizer.JOINT_CREATED_COLOR;
    }

    private resolveStrokeOpacity(data: JointData): number {
        return data.displayState === 'draft'
            ? JointVisualizer.JOINT_DRAFT_OPACITY
            : JointVisualizer.JOINT_CREATED_OPACITY;
    }

    private createStrokeMaterial(data: JointData): THREE.LineBasicMaterial {
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

    private createPolyline(points: THREE.Vector3[], data: JointData, role: string): THREE.Line {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return this.attachRole(
            new THREE.Line(geometry, this.createStrokeMaterial(data)),
            role
        );
    }

    private createLoop(points: THREE.Vector3[], data: JointData, role: string): THREE.LineLoop {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return this.attachRole(
            new THREE.LineLoop(geometry, this.createStrokeMaterial(data)),
            role
        );
    }

    private createRectOutline(
        width: number,
        height: number,
        data: JointData,
        role: string
    ): THREE.LineLoop {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        return this.createLoop(
            [
                new THREE.Vector3(-halfWidth, -halfHeight, 0),
                new THREE.Vector3(halfWidth, -halfHeight, 0),
                new THREE.Vector3(halfWidth, halfHeight, 0),
                new THREE.Vector3(-halfWidth, halfHeight, 0)
            ],
            data,
            role
        );
    }

    private getSceneIconPath(connectorType: ConnectorTypeValue): string | null {
        if (!this.options.iconBaseUrl || !this.options.preferSceneIcons) {
            return null;
        }
        return `${this.options.iconBaseUrl}/joint_scene_${connectorType}.svg`;
    }

    private getSceneIconTexture(connectorType: ConnectorTypeValue): THREE.Texture | null {
        const path = this.getSceneIconPath(connectorType);
        if (!path || !this.textureLoader) {
            return null;
        }

        const cached = this.iconTextureCache.get(path);
        if (cached) {
            return cached;
        }

        const texture = this.textureLoader.load(path);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        this.iconTextureCache.set(path, texture);
        return texture;
    }

    private getSceneIconDimensions(
        connectorType: ConnectorTypeValue,
        size: number
    ): { width: number; height: number } {
        switch (connectorType) {
            case 'prismatic':
            case 'cylindrical':
                return { width: size * 2.05, height: size * 2.8 };
            case 'screw':
                return { width: size * 2.35, height: size * 3.1 };
            case 'planar':
                return { width: size * 3, height: size * 2.6 };
            case 'fixed':
                return { width: size * 2.35, height: size * 2.45 };
            case 'revolute':
            case 'spherical':
            case 'universal':
            default:
                return { width: size * 2.8, height: size * 2.8 };
        }
    }

    private createSceneIconJoint(
        data: JointData,
        connectorType: ConnectorTypeValue
    ): THREE.Group | null {
        const texture = this.getSceneIconTexture(connectorType);
        if (!texture) {
            return null;
        }

        const size = this.getJointSize(data);
        const dimensions = this.getSceneIconDimensions(connectorType, size);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            color: this.resolveStrokeColor(data),
            transparent: true,
            opacity: this.resolveStrokeOpacity(data),
            side: THREE.DoubleSide,
            alphaTest: 0.05,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        material.userData.baseColor = this.resolveStrokeColor(data);
        material.userData.baseOpacity = this.resolveStrokeOpacity(data);
        material.userData.isSceneIconMaterial = true;

        const plane = this.attachRole(
            new THREE.Mesh(
                new THREE.PlaneGeometry(dimensions.width, dimensions.height),
                material
            ),
            'icon'
        );
        plane.renderOrder = 40;

        const group = new THREE.Group();
        group.add(plane);
        return group;
    }

    private createWireBox(
        width: number,
        height: number,
        depth: number,
        data: JointData,
        role: string
    ): THREE.LineSegments {
        const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
        return this.attachRole(
            new THREE.LineSegments(geometry, this.createStrokeMaterial(data)),
            role
        );
    }

    private createWireCylinder(
        radius: number,
        height: number,
        data: JointData,
        role: string
    ): THREE.Group {
        const group = this.attachRole(new THREE.Group(), role);
        const top = this.createCircle(radius, data, `${role}-ring`);
        top.position.z = height / 2;
        group.add(top);

        const bottom = this.createCircle(radius, data, `${role}-ring`);
        bottom.position.z = -height / 2;
        group.add(bottom);

        for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            group.add(
                this.createPolyline(
                    [
                        new THREE.Vector3(x, y, -height / 2),
                        new THREE.Vector3(x, y, height / 2)
                    ],
                    data,
                    `${role}-side`
                )
            );
        }

        return group;
    }

    private createCircle(
        radius: number,
        data: JointData,
        role: string,
        segments = 48
    ): THREE.LineLoop {
        const points: THREE.Vector3[] = [];
        for (let index = 0; index < segments; index += 1) {
            const angle = (index / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
        }
        return this.createLoop(points, data, role);
    }

    private createArc(
        radius: number,
        startAngle: number,
        endAngle: number,
        data: JointData,
        role: string,
        segments = 32
    ): THREE.Line {
        const points: THREE.Vector3[] = [];
        for (let index = 0; index <= segments; index += 1) {
            const angle = startAngle + ((endAngle - startAngle) * index) / segments;
            points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
        }
        return this.createPolyline(points, data, role);
    }

    private createAxisGuide(length: number, data: JointData, role = 'axis'): THREE.Line | null {
        if (!this.options.showAxis) {
            return null;
        }
        return this.createPolyline(
            [
                new THREE.Vector3(0, 0, -length / 2),
                new THREE.Vector3(0, 0, length / 2)
            ],
            data,
            role
        );
    }

    private createHelix(
        radius: number,
        height: number,
        turns: number,
        data: JointData,
        role: string,
        segments = 96
    ): THREE.Line {
        const points: THREE.Vector3[] = [];
        for (let index = 0; index <= segments; index += 1) {
            const t = index / segments;
            const angle = turns * Math.PI * 2 * t;
            points.push(
                new THREE.Vector3(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    height * (t - 0.5)
                )
            );
        }
        return this.createPolyline(points, data, role);
    }

    private createFixedJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getJointSize(data);

        const bodyWidth = size * 1.92;
        const bodyHeight = size * 1.18;
        const bodyCenterY = -size * 0.18;

        const body = this.attachRole(new THREE.Group(), 'body');
        body.position.y = bodyCenterY;
        body.add(this.createRectOutline(bodyWidth, bodyHeight, data, 'body-outline'));

        const keyholeHead = this.createCircle(size * 0.18, data, 'keyhole-head');
        keyholeHead.position.set(0, size * 0.05, 0);
        body.add(keyholeHead);
        body.add(
            this.createLoop(
                [
                    new THREE.Vector3(-size * 0.06, -size * 0.12, 0),
                    new THREE.Vector3(-size * 0.18, -size * 0.36, 0),
                    new THREE.Vector3(0, -size * 0.40, 0),
                    new THREE.Vector3(size * 0.18, -size * 0.36, 0),
                    new THREE.Vector3(size * 0.06, -size * 0.12, 0)
                ],
                data,
                'keyhole-tail'
            )
        );
        group.add(body);

        const bodyTopY = bodyCenterY + bodyHeight / 2;
        const shackleOuterRadius = size * 0.60;
        const shackleInnerRadius = size * 0.42;
        const shackleCenterY = bodyTopY + size * 0.05;

        const outerArc = this.createArc(shackleOuterRadius, 0, Math.PI, data, 'outer-shackle');
        outerArc.position.y = shackleCenterY;
        group.add(outerArc);

        const innerArc = this.createArc(shackleInnerRadius, 0, Math.PI, data, 'inner-shackle');
        innerArc.position.y = shackleCenterY;
        group.add(innerArc);

        for (const direction of [-1, 1]) {
            group.add(
                this.createPolyline(
                    [
                        new THREE.Vector3(direction * shackleOuterRadius, shackleCenterY, 0),
                        new THREE.Vector3(direction * shackleOuterRadius, bodyTopY, 0)
                    ],
                    data,
                    'outer-shackle-leg'
                )
            );
            group.add(
                this.createPolyline(
                    [
                        new THREE.Vector3(direction * shackleInnerRadius, shackleCenterY, 0),
                        new THREE.Vector3(direction * shackleInnerRadius, bodyTopY, 0)
                    ],
                    data,
                    'inner-shackle-leg'
                )
            );
        }

        return group;
    }

    private createRevoluteJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getJointSize(data);

        const leaf = this.createLoop(
            [
                new THREE.Vector3(-size * 0.5, -size * 1.34, 0),
                new THREE.Vector3(size * 0.78, -size * 1.18, 0),
                new THREE.Vector3(size * 0.78, size * 1.32, 0),
                new THREE.Vector3(-size * 0.5, size * 1.16, 0)
            ],
            data,
            'leaf-outline'
        );
        group.add(leaf);

        for (const [x, y] of [
            [-0.18, 0.85],
            [0.18, 0.92],
            [0.55, 0.99],
            [-0.18, -0.99],
            [0.18, -0.92],
            [0.55, -0.85]
        ]) {
            const hole = this.createCircle(size * 0.085, data, 'leaf-hole');
            hole.position.set(size * x, size * y, 0);
            group.add(hole);
        }

        const pinStart = new THREE.Vector3(-size * 0.94, -size * 0.13, 0);
        const pinEnd = new THREE.Vector3(size * 0.94, size * 0.13, 0);
        group.add(this.createPolyline([pinStart, pinEnd], data, 'hinge-pin'));

        const barrelHalfW = size * 0.13;
        const barrelHalfH = size * 0.20;
        for (const t of [0.11, 0.37, 0.63, 0.89]) {
            const center = pinStart.clone().lerp(pinEnd, t);
            const barrel = this.createLoop(
                [
                    new THREE.Vector3(center.x - barrelHalfW, center.y - barrelHalfH, 0),
                    new THREE.Vector3(center.x + barrelHalfW, center.y - barrelHalfH, 0),
                    new THREE.Vector3(center.x + barrelHalfW, center.y + barrelHalfH, 0),
                    new THREE.Vector3(center.x - barrelHalfW, center.y + barrelHalfH, 0)
                ],
                data,
                'hinge-knuckle'
            );
            group.add(barrel);
        }

        const arcCenter = new THREE.Vector3(-size * 0.05, 0, 0);
        const arcRadius = size * 0.62;
        const arcStart = Math.PI / 3;
        const arcEnd = Math.PI * 5 / 3;
        const arcSegments = 48;
        const arcPoints: THREE.Vector3[] = [];
        for (let index = 0; index <= arcSegments; index += 1) {
            const angle = arcStart + (arcEnd - arcStart) * (index / arcSegments);
            arcPoints.push(
                new THREE.Vector3(
                    arcCenter.x + Math.cos(angle) * arcRadius,
                    arcCenter.y + Math.sin(angle) * arcRadius,
                    0
                )
            );
        }
        group.add(this.createPolyline(arcPoints, data, 'rotation'));

        const tip = arcPoints[arcPoints.length - 1]!.clone();
        const tangent = new THREE.Vector3(
            -Math.sin(arcEnd),
            Math.cos(arcEnd),
            0
        ).normalize();
        const perp = new THREE.Vector3(-tangent.y, tangent.x, 0);
        const headSize = size * 0.26;
        group.add(
            this.createPolyline(
                [
                    tip
                        .clone()
                        .addScaledVector(tangent, -headSize)
                        .addScaledVector(perp, headSize * 0.5),
                    tip,
                    tip
                        .clone()
                        .addScaledVector(tangent, -headSize)
                        .addScaledVector(perp, -headSize * 0.5)
                ],
                data,
                'rotation-head'
            )
        );

        return group;
    }

    private createPrismaticJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getJointSize(data);

        const middle = this.createWireBox(size * 1.86, size * 1.28, size * 1.34, data, 'carriage');
        middle.position.z = size * 0.04;
        group.add(middle);

        const upper = this.createWireBox(size * 1.18, size * 1.18, size * 1.1, data, 'carriage');
        upper.position.z = size * 0.98;
        group.add(upper);

        const lower = this.createWireBox(size * 1.18, size * 1.18, size * 1.1, data, 'carriage');
        lower.position.z = -size * 0.98;
        group.add(lower);

        const axisGuide = this.createAxisGuide(size * 3.35, data);
        if (axisGuide) {
            group.add(axisGuide);
        }

        return group;
    }

    private createCylindricalJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getJointSize(data);

        const outer = this.createWireCylinder(size * 0.72, size * 1.48, data, 'shell');
        outer.position.z = -size * 0.14;
        group.add(outer);

        const inner = this.createWireCylinder(size * 0.44, size * 2.48, data, 'shell');
        inner.position.z = size * 0.52;
        group.add(inner);

        const axisGuide = this.createAxisGuide(size * 3.35, data);
        if (axisGuide) {
            group.add(axisGuide);
        }

        return group;
    }

    private createSphericalJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getJointSize(data);

        const xyRing = this.createCircle(size * 0.94, data, 'ring');
        group.add(xyRing);

        const yzRing = this.createCircle(size * 0.94, data, 'ring');
        yzRing.rotation.y = Math.PI / 2;
        group.add(yzRing);

        const xzRing = this.createCircle(size * 0.94, data, 'ring');
        xzRing.rotation.x = Math.PI / 2;
        group.add(xzRing);

        const axisGuide = this.createAxisGuide(size * 2.2, data);
        if (axisGuide) {
            group.add(axisGuide);
        }

        return group;
    }

    private createUniversalJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getJointSize(data);

        const firstYoke = this.createCircle(size * 1.46, data, 'yoke');
        firstYoke.rotation.y = Math.PI / 2;
        group.add(firstYoke);

        const secondYoke = this.createCircle(size * 1.18, data, 'yoke');
        secondYoke.rotation.x = Math.PI / 2;
        group.add(secondYoke);

        const topBridge = this.createRectOutline(size * 1.32, size * 0.34, data, 'yoke-arm');
        topBridge.position.y = size * 1.26;
        group.add(topBridge);

        const bottomBridge = this.createRectOutline(size * 1.32, size * 0.34, data, 'yoke-arm');
        bottomBridge.position.y = -size * 1.26;
        group.add(bottomBridge);

        const hub = this.createRectOutline(size * 0.62, size * 0.62, data, 'hub');
        hub.rotation.z = Math.PI / 4;
        group.add(hub);

        const axisGuide = this.createAxisGuide(size * 2.2, data);
        if (axisGuide) {
            group.add(axisGuide);
        }

        return group;
    }

    private createPlanarJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getJointSize(data);

        const lower = this.createWireBox(size * 2.34, size * 1.52, size * 0.7, data, 'plane');
        lower.position.set(-size * 0.2, -size * 0.08, -size * 0.62);
        lower.rotation.z = -Math.PI / 8;
        group.add(lower);

        const upper = this.createWireBox(size * 2.34, size * 1.52, size * 0.7, data, 'plane');
        upper.position.set(size * 0.28, size * 0.12, size * 0.62);
        upper.rotation.z = Math.PI / 12;
        group.add(upper);

        group.add(
            this.createPolyline(
                [
                    new THREE.Vector3(-size * 2.08, -size * 1.24, -size * 1.08),
                    new THREE.Vector3(size * 2.08, size * 1.24, size * 1.08)
                ],
                data,
                'plane-axis'
            )
        );

        const axisGuide = this.createAxisGuide(size * 3.2, data);
        if (axisGuide) {
            group.add(axisGuide);
        }

        return group;
    }

    private createScrewJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = this.getJointSize(data);

        const body = this.createWireBox(size * 1.82, size * 1.42, size * 1.08, data, 'nut');
        body.position.set(-size * 0.12, 0, -size * 0.18);
        group.add(body);

        const helix = this.createHelix(size * 0.72, size * 3.45, 4.2, data, 'helix');
        group.add(helix);

        const axisGuide = this.createAxisGuide(size * 3.4, data);
        if (axisGuide) {
            group.add(axisGuide);
        }

        return group;
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
                        : JointVisualizer.JOINT_CREATED_COLOR;

                if (material instanceof THREE.MeshPhongMaterial) {
                    material.emissive.setHex(
                        selected ? JointVisualizer.JOINT_SELECTED_EMISSIVE : 0x000000
                    );
                }
                if (
                    material instanceof THREE.MeshPhongMaterial ||
                    material instanceof THREE.MeshBasicMaterial ||
                    material instanceof THREE.LineBasicMaterial
                ) {
                    if (
                        material instanceof THREE.MeshBasicMaterial &&
                        material.userData.isSceneIconMaterial === true
                    ) {
                        material.color.setHex(
                            selected ? JointVisualizer.JOINT_SELECTED_LINE_COLOR : baseColor
                        );
                    }
                    if (material instanceof THREE.LineBasicMaterial) {
                        material.color.setHex(
                            selected ? JointVisualizer.JOINT_SELECTED_LINE_COLOR : baseColor
                        );
                    }
                    material.opacity = selected ? Math.min(1, baseOpacity + 0.12) : baseOpacity;
                    material.transparent = material.opacity < 1;
                }
            });
        });
        group.userData.jointSelected = selected;
    }

    /**
     * 创建关节可视化
     */
    private createJointGroup(data: JointData): THREE.Group {
        let group: THREE.Group;
        const connectorType = this.resolveConnectorType(data);
        const sceneIconGroup = this.createSceneIconJoint(data, connectorType);

        if (sceneIconGroup) {
            group = sceneIconGroup;
        } else {
            switch (connectorType) {
                case 'fixed':
                    group = this.createFixedJoint(data);
                    break;
                case 'prismatic':
                    group = this.createPrismaticJoint(data);
                    break;
                case 'cylindrical':
                    group = this.createCylindricalJoint(data);
                    break;
                case 'spherical':
                    group = this.createSphericalJoint(data);
                    break;
                case 'universal':
                    group = this.createUniversalJoint(data);
                    break;
                case 'screw':
                    group = this.createScrewJoint(data);
                    break;
                case 'planar':
                    group = this.createPlanarJoint(data);
                    break;
                case 'revolute':
                default:
                    group = this.createRevoluteJoint(data);
                    break;
            }
        }

        group.name = `joint_${data.id}`;
        group.position.set(data.position.x, data.position.y, data.position.z);

        if (data.axis) {
            const axis = new THREE.Vector3(data.axis.x, data.axis.y, data.axis.z).normalize();
            const defaultAxis = new THREE.Vector3(0, 0, 1);
            const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultAxis, axis);
            group.quaternion.copy(quaternion);
        }

        group.userData = {
            jointId: data.id,
            jointName: data.name,
            jointType: data.type,
            jointConnectorType: connectorType,
            jointDisplayState: data.displayState ?? 'created',
            jointSelected: Boolean(data.selected)
        };
        this.applySelectionAppearance(group, Boolean(data.selected));

        return group;
    }

    /**
     * 添加关节
     */
    addJoint(data: JointData): THREE.Group {
        if (this.joints.has(data.id)) {
            this.removeJoint(data.id);
        }

        const group = this.createJointGroup(data);
        this.scene.add(group);
        this.joints.set(data.id, group);

        return group;
    }

    /**
     * 更新关节
     */
    updateJoint(data: JointData): void {
        this.removeJoint(data.id);
        this.addJoint(data);
    }

    /**
     * 移除关节
     */
    removeJoint(id: string): void {
        const group = this.joints.get(id);
        if (group) {
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
                materials.forEach((material) => material.dispose());
            });
            this.joints.delete(id);
        }
    }

    /**
     * 获取关节
     */
    getJoint(id: string): THREE.Group | undefined {
        return this.joints.get(id);
    }

    /**
     * 获取所有关节 ID
     */
    getAllJointIds(): string[] {
        return Array.from(this.joints.keys());
    }

    /**
     * 设置关节可见性
     */
    setJointVisible(id: string, visible: boolean): void {
        const group = this.joints.get(id);
        if (group) {
            group.visible = visible;
        }
    }

    setJointSelected(id: string, selected: boolean): void {
        const group = this.joints.get(id);
        if (group) {
            this.applySelectionAppearance(group, selected);
        }
    }

    /**
     * 设置所有关节可见性
     */
    setAllJointsVisible(visible: boolean): void {
        this.joints.forEach(group => {
            group.visible = visible;
        });
    }

    /**
     * 按类型设置可见性
     */
    setJointTypeVisible(type: MbsJointType, visible: boolean): void {
        this.joints.forEach(group => {
            if (group.userData.jointType === type) {
                group.visible = visible;
            }
        });
    }

    /**
     * 清除所有关节
     */
    clear(): void {
        const ids = Array.from(this.joints.keys());
        ids.forEach(id => this.removeJoint(id));
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.clear();
    }
}
