import * as THREE from 'three';
import type { Vec3, Mat3 } from '@cadtool-online/core';

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
    isPrimary?: boolean;
}

/**
 * 标架可视化器 - 显示坐标系/参考框架
 */
export class FrameVisualizer {
    private scene: THREE.Scene;
    private frames: Map<string, THREE.Group> = new Map();
    private options: Required<FrameVisualizerOptions>;

    // 颜色定义
    private static readonly COLORS = {
        xAxis: 0xff0000,  // 红色 - X轴
        yAxis: 0x00ff00,  // 绿色 - Y轴
        zAxis: 0x0000ff,  // 蓝色 - Z轴
        primary: 0xffff00, // 黄色 - 主标架
        secondary: 0x00ffff // 青色 - 次标架
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

    /**
     * 创建坐标轴箭头
     */
    private createAxis(
        direction: THREE.Vector3,
        color: number,
        length: number
    ): THREE.ArrowHelper {
        const arrow = new THREE.ArrowHelper(
            direction.normalize(),
            new THREE.Vector3(0, 0, 0),
            length,
            color,
            length * 0.2,  // 箭头头部长度
            length * 0.1   // 箭头头部宽度
        );
        return arrow;
    }

    /**
     * 创建标架组
     */
    private createFrameGroup(data: FrameData): THREE.Group {
        const group = new THREE.Group();
        group.name = `frame_${data.id}`;

        const length = this.options.axisLength;

        // 从 Mat3 提取轴向量
        const m = data.orientation.m;
        const xAxis = new THREE.Vector3(m[0], m[3], m[6]);
        const yAxis = new THREE.Vector3(m[1], m[4], m[7]);
        const zAxis = new THREE.Vector3(m[2], m[5], m[8]);

        // 创建三个坐标轴
        const xArrow = this.createAxis(xAxis, FrameVisualizer.COLORS.xAxis, length);
        const yArrow = this.createAxis(yAxis, FrameVisualizer.COLORS.yAxis, length);
        const zArrow = this.createAxis(zAxis, FrameVisualizer.COLORS.zAxis, length);

        group.add(xArrow);
        group.add(yArrow);
        group.add(zArrow);

        // 添加原点球体
        const sphereGeometry = new THREE.SphereGeometry(length * 0.08, 16, 16);
        const sphereColor = data.isPrimary
            ? FrameVisualizer.COLORS.primary
            : FrameVisualizer.COLORS.secondary;
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: sphereColor });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        group.add(sphere);

        // 设置位置
        group.position.set(data.position.x, data.position.y, data.position.z);

        // 存储元数据
        group.userData = {
            frameId: data.id,
            frameName: data.name,
            isPrimary: data.isPrimary
        };

        return group;
    }

    /**
     * 添加标架
     */
    addFrame(data: FrameData): THREE.Group {
        // 如果已存在，先移除
        if (this.frames.has(data.id)) {
            this.removeFrame(data.id);
        }

        const group = this.createFrameGroup(data);
        this.scene.add(group);
        this.frames.set(data.id, group);

        return group;
    }

    /**
     * 更新标架
     */
    updateFrame(data: FrameData): void {
        const group = this.frames.get(data.id);
        if (!group) {
            this.addFrame(data);
            return;
        }

        // 更新位置
        group.position.set(data.position.x, data.position.y, data.position.z);

        // 重新创建（简单实现，可优化）
        this.removeFrame(data.id);
        this.addFrame(data);
    }

    /**
     * 移除标架
     */
    removeFrame(id: string): void {
        const group = this.frames.get(id);
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
            this.frames.delete(id);
        }
    }

    /**
     * 获取标架
     */
    getFrame(id: string): THREE.Group | undefined {
        return this.frames.get(id);
    }

    /**
     * 获取所有标架 ID
     */
    getAllFrameIds(): string[] {
        return Array.from(this.frames.keys());
    }

    /**
     * 设置标架可见性
     */
    setFrameVisible(id: string, visible: boolean): void {
        const group = this.frames.get(id);
        if (group) {
            group.visible = visible;
        }
    }

    /**
     * 设置所有标架可见性
     */
    setAllFramesVisible(visible: boolean): void {
        this.frames.forEach(group => {
            group.visible = visible;
        });
    }

    /**
     * 设置轴长度
     */
    setAxisLength(length: number): void {
        this.options.axisLength = length;
        // 需要重新创建所有标架
        const frameDataList: FrameData[] = [];
        this.frames.forEach((group, id) => {
            frameDataList.push({
                id,
                name: group.userData.frameName,
                position: {
                    x: group.position.x,
                    y: group.position.y,
                    z: group.position.z
                },
                orientation: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, // 需要从 group 恢复
                isPrimary: group.userData.isPrimary
            });
        });
        this.clear();
        frameDataList.forEach(data => this.addFrame(data));
    }

    /**
     * 清除所有标架
     */
    clear(): void {
        const ids = Array.from(this.frames.keys());
        ids.forEach(id => this.removeFrame(id));
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.clear();
    }
}
