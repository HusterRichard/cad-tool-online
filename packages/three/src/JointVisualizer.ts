import * as THREE from 'three';
import type { Vec3 } from '@cadtool-online/core';
import { MbsJointType } from '@cadtool-online/geo';

export interface JointVisualizerOptions {
    jointSize?: number;
    showAxis?: boolean;
    showLimits?: boolean;
}

export interface JointData {
    id: string;
    name: string;
    type: MbsJointType;
    position: Vec3;
    axis: Vec3;
    size?: number;
    selected?: boolean;
    currentValue?: number[];
    limits?: { lower: number[]; upper: number[] };
}

/**
 * 关节可视化器 - 显示不同类型的关节
 */
export class JointVisualizer {
    private scene: THREE.Scene;
    private joints: Map<string, THREE.Group> = new Map();
    private options: Required<JointVisualizerOptions>;

    // 关节类型颜色
    private static readonly JOINT_COLORS: Record<MbsJointType, number> = {
        [MbsJointType.Revolute]: 0xff6600,     // 橙色 - 旋转
        [MbsJointType.Prismatic]: 0x0066ff,   // 蓝色 - 移动
        [MbsJointType.Cylindrical]: 0x9900ff, // 紫色 - 圆柱
        [MbsJointType.Spherical]: 0xff0066,   // 粉色 - 球
        [MbsJointType.Universal]: 0x00ff66,   // 青绿 - 万向
        [MbsJointType.Planar]: 0xffff00,      // 黄色 - 平面
        [MbsJointType.Fixed]: 0x666666,       // 灰色 - 固定
    };
    private static readonly JOINT_SELECTED_EMISSIVE = 0x58a6ff;

    constructor(scene: THREE.Scene, options: JointVisualizerOptions = {}) {
        this.scene = scene;
        this.options = {
            jointSize: options.jointSize ?? 10,
            showAxis: options.showAxis ?? true,
            showLimits: options.showLimits ?? false
        };
    }

    /**
     * 创建旋转关节可视化
     */
    private createRevoluteJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = data.size && data.size > 0 ? data.size : this.options.jointSize;
        const color = JointVisualizer.JOINT_COLORS[MbsJointType.Revolute];

        // 圆环表示旋转
        const torusGeometry = new THREE.TorusGeometry(size, size * 0.15, 16, 32);
        const torusMaterial = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.8
        });
        const torus = new THREE.Mesh(torusGeometry, torusMaterial);
        group.add(torus);

        // 旋转轴
        if (this.options.showAxis) {
            const axisArrow = new THREE.ArrowHelper(
                new THREE.Vector3(data.axis.x, data.axis.y, data.axis.z).normalize(),
                new THREE.Vector3(0, 0, 0),
                size * 1.5,
                color
            );
            group.add(axisArrow);
        }

        return group;
    }

    /**
     * 创建移动关节可视化
     */
    private createPrismaticJoint(data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = data.size && data.size > 0 ? data.size : this.options.jointSize;
        const color = JointVisualizer.JOINT_COLORS[MbsJointType.Prismatic];

        // 双箭头表示平移
        const axis = new THREE.Vector3(data.axis.x, data.axis.y, data.axis.z).normalize();

        const arrow1 = new THREE.ArrowHelper(
            axis,
            new THREE.Vector3(0, 0, 0),
            size,
            color
        );
        const arrow2 = new THREE.ArrowHelper(
            axis.clone().negate(),
            new THREE.Vector3(0, 0, 0),
            size,
            color
        );
        group.add(arrow1);
        group.add(arrow2);

        // 滑块
        const boxGeometry = new THREE.BoxGeometry(size * 0.4, size * 0.4, size * 0.8);
        const boxMaterial = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.8
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        group.add(box);

        return group;
    }

    /**
     * 创建圆柱关节可视化
     */
    private createCylindricalJoint(_data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = _data.size && _data.size > 0 ? _data.size : this.options.jointSize;
        const color = JointVisualizer.JOINT_COLORS[MbsJointType.Cylindrical];

        // 圆柱体
        const cylinderGeometry = new THREE.CylinderGeometry(
            size * 0.5, size * 0.5, size * 1.2, 32
        );
        const cylinderMaterial = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.6
        });
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        group.add(cylinder);

        // 旋转环
        const torusGeometry = new THREE.TorusGeometry(size * 0.6, size * 0.08, 16, 32);
        const torusMaterial = new THREE.MeshPhongMaterial({ color });
        const torus = new THREE.Mesh(torusGeometry, torusMaterial);
        torus.rotation.x = Math.PI / 2;
        group.add(torus);

        return group;
    }

    /**
     * 创建球关节可视化
     */
    private createSphericalJoint(_data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = _data.size && _data.size > 0 ? _data.size : this.options.jointSize;
        const color = JointVisualizer.JOINT_COLORS[MbsJointType.Spherical];

        // 球体
        const sphereGeometry = new THREE.SphereGeometry(size * 0.5, 32, 32);
        const sphereMaterial = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.6
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        group.add(sphere);

        // 三个旋转环
        const ringColors = [0xff0000, 0x00ff00, 0x0000ff];
        const rotations = [
            { x: 0, y: 0, z: 0 },
            { x: Math.PI / 2, y: 0, z: 0 },
            { x: 0, y: Math.PI / 2, z: 0 }
        ];

        ringColors.forEach((ringColor, i) => {
            const ringGeometry = new THREE.TorusGeometry(size * 0.7, size * 0.05, 16, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({ color: ringColor });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.set(rotations[i].x, rotations[i].y, rotations[i].z);
            group.add(ring);
        });

        return group;
    }

    /**
     * 创建万向关节可视化
     */
    private createUniversalJoint(_data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = _data.size && _data.size > 0 ? _data.size : this.options.jointSize;
        const color = JointVisualizer.JOINT_COLORS[MbsJointType.Universal];

        // 十字形
        const crossGeometry = new THREE.BoxGeometry(size * 0.2, size, size * 0.2);
        const crossMaterial = new THREE.MeshPhongMaterial({ color });

        const cross1 = new THREE.Mesh(crossGeometry, crossMaterial);
        const cross2 = new THREE.Mesh(crossGeometry.clone(), crossMaterial);
        cross2.rotation.z = Math.PI / 2;

        group.add(cross1);
        group.add(cross2);

        // 两个旋转环
        const ring1Geometry = new THREE.TorusGeometry(size * 0.6, size * 0.08, 16, 32);
        const ring1Material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const ring1 = new THREE.Mesh(ring1Geometry, ring1Material);
        ring1.rotation.y = Math.PI / 2;
        group.add(ring1);

        const ring2Geometry = new THREE.TorusGeometry(size * 0.6, size * 0.08, 16, 32);
        const ring2Material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const ring2 = new THREE.Mesh(ring2Geometry, ring2Material);
        ring2.rotation.x = Math.PI / 2;
        group.add(ring2);

        return group;
    }

    /**
     * 创建平面关节可视化
     */
    private createPlanarJoint(_data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = _data.size && _data.size > 0 ? _data.size : this.options.jointSize;
        const color = JointVisualizer.JOINT_COLORS[MbsJointType.Planar];

        // 平面
        const planeGeometry = new THREE.PlaneGeometry(size * 2, size * 2);
        const planeMaterial = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        group.add(plane);

        // XY 方向箭头
        const xArrow = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-size * 0.8, 0, 0),
            size * 1.6,
            0xff0000
        );
        const yArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -size * 0.8, 0),
            size * 1.6,
            0x00ff00
        );
        group.add(xArrow);
        group.add(yArrow);

        // 旋转符号
        const arcGeometry = new THREE.TorusGeometry(size * 0.3, size * 0.05, 8, 16, Math.PI * 1.5);
        const arcMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        const arc = new THREE.Mesh(arcGeometry, arcMaterial);
        arc.position.z = 0.1;
        group.add(arc);

        return group;
    }

    /**
     * 创建固定关节可视化
     */
    private createFixedJoint(_data: JointData): THREE.Group {
        const group = new THREE.Group();
        const size = _data.size && _data.size > 0 ? _data.size : this.options.jointSize;
        const color = JointVisualizer.JOINT_COLORS[MbsJointType.Fixed];

        // 立方体表示固定
        const boxGeometry = new THREE.BoxGeometry(size * 0.6, size * 0.6, size * 0.6);
        const boxMaterial = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.8
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        group.add(box);

        // 锁定符号 (X)
        const linesMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line1Points = [
            new THREE.Vector3(-size * 0.4, -size * 0.4, size * 0.31),
            new THREE.Vector3(size * 0.4, size * 0.4, size * 0.31)
        ];
        const line2Points = [
            new THREE.Vector3(-size * 0.4, size * 0.4, size * 0.31),
            new THREE.Vector3(size * 0.4, -size * 0.4, size * 0.31)
        ];

        const line1Geometry = new THREE.BufferGeometry().setFromPoints(line1Points);
        const line2Geometry = new THREE.BufferGeometry().setFromPoints(line2Points);

        const line1 = new THREE.Line(line1Geometry, linesMaterial);
        const line2 = new THREE.Line(line2Geometry, linesMaterial);

        group.add(line1);
        group.add(line2);

        return group;
    }

    private applySelectionAppearance(group: THREE.Group, selected: boolean): void {
        group.scale.setScalar(selected ? 1.12 : 1);
        group.traverse((child) => {
            const material = (child as THREE.Mesh).material;
            if (material instanceof THREE.MeshPhongMaterial) {
                material.emissive.setHex(selected ? JointVisualizer.JOINT_SELECTED_EMISSIVE : 0x000000);
                material.opacity = selected ? 0.95 : Math.min(material.opacity, 0.8);
                material.transparent = material.opacity < 1;
            } else if (material instanceof THREE.MeshBasicMaterial) {
                material.opacity = selected ? 0.95 : 0.8;
                material.transparent = material.opacity < 1;
            }
        });
        group.userData.jointSelected = selected;
    }

    /**
     * 创建关节可视化
     */
    private createJointGroup(data: JointData): THREE.Group {
        let group: THREE.Group;

        switch (data.type) {
            case MbsJointType.Revolute:
                group = this.createRevoluteJoint(data);
                break;
            case MbsJointType.Prismatic:
                group = this.createPrismaticJoint(data);
                break;
            case MbsJointType.Cylindrical:
                group = this.createCylindricalJoint(data);
                break;
            case MbsJointType.Spherical:
                group = this.createSphericalJoint(data);
                break;
            case MbsJointType.Universal:
                group = this.createUniversalJoint(data);
                break;
            case MbsJointType.Planar:
                group = this.createPlanarJoint(data);
                break;
            case MbsJointType.Fixed:
                group = this.createFixedJoint(data);
                break;
            default:
                group = new THREE.Group();
        }

        group.name = `joint_${data.id}`;
        group.position.set(data.position.x, data.position.y, data.position.z);

        // 根据轴方向旋转
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
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (child.material instanceof THREE.Material) {
                        child.material.dispose();
                    }
                }
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
