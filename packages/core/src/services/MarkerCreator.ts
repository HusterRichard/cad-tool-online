import { MbsMarker } from '../model/MbsFrame';
import type { Vec3, Mat3 } from '../types';

export interface MarkerCreationParams {
    position: Vec3;
    normal: Vec3;
    groupId: string;
    name?: string;
}

export class MarkerCreator {
    private markerCounter = 0;

    /**
     * 从法向量创建标架的方向矩阵
     * Z轴沿法向向外，自动计算X和Y轴
     */
    private createOrientationFromNormal(normal: Vec3): Mat3 {
        // Normalize the normal vector (Z-axis)
        const nLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        const zAxis = {
            x: normal.x / nLen,
            y: normal.y / nLen,
            z: normal.z / nLen
        };

        // Create a temporary X-axis by finding a vector perpendicular to Z
        // If Z is mostly vertical, use X = (1, 0, 0), otherwise use X = (0, 0, 1)
        let tempX: Vec3;
        if (Math.abs(zAxis.z) > 0.9) {
            // Z is mostly vertical, use X = (1, 0, 0)
            tempX = { x: 1, y: 0, z: 0 };
        } else {
            // Z is mostly horizontal, use X = (0, 0, 1)
            tempX = { x: 0, y: 0, z: 1 };
        }

        // Y = Z × tempX (cross product)
        const yAxis = {
            x: zAxis.y * tempX.z - zAxis.z * tempX.y,
            y: zAxis.z * tempX.x - zAxis.x * tempX.z,
            z: zAxis.x * tempX.y - zAxis.y * tempX.x
        };

        // Normalize Y
        const yLen = Math.sqrt(yAxis.x * yAxis.x + yAxis.y * yAxis.y + yAxis.z * yAxis.z);
        yAxis.x /= yLen;
        yAxis.y /= yLen;
        yAxis.z /= yLen;

        // X = Y × Z (cross product to ensure right-hand system)
        const xAxis = {
            x: yAxis.y * zAxis.z - yAxis.z * zAxis.y,
            y: yAxis.z * zAxis.x - yAxis.x * zAxis.z,
            z: yAxis.x * zAxis.y - yAxis.y * zAxis.x
        };

        // Return column-major 3x3 matrix: [X Y Z]
        return {
            m: [
                xAxis.x, xAxis.y, xAxis.z,  // Column 0: X-axis
                yAxis.x, yAxis.y, yAxis.z,  // Column 1: Y-axis
                zAxis.x, zAxis.y, zAxis.z   // Column 2: Z-axis
            ]
        };
    }

    /**
     * 创建标架
     */
    createMarker(params: MarkerCreationParams): MbsMarker {
        const { position, normal, groupId, name } = params;

        // Generate unique ID and name
        const id = `marker_${Date.now()}_${++this.markerCounter}`;
        const markerName = name || `Marker${this.markerCounter}`;

        // Create marker instance
        const marker = new MbsMarker(id, markerName, groupId);

        // Set position
        marker.setPosition(position.x, position.y, position.z);

        // Set orientation from normal
        const orientation = this.createOrientationFromNormal(normal);
        marker.setOrientation(orientation);

        return marker;
    }

    /**
     * 重置计数器（用于测试或清理）
     */
    reset(): void {
        this.markerCounter = 0;
    }
}

export const markerCreator = new MarkerCreator();
