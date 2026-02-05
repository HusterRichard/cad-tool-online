/**
 * MBS (Multi-Body System) TypeScript 接口定义
 * 对应 C++ mbs 命名空间中的类型
 */

import type { Vec3, Mat3 } from '@cadtool-online/core';

// ============================================================================
// 枚举类型
// ============================================================================

/** 关节类型 */
export enum MbsJointType {
    Revolute = 0,     // 旋转关节 (1 DOF)
    Prismatic = 1,    // 移动关节 (1 DOF)
    Cylindrical = 2,  // 圆柱关节 (2 DOF)
    Spherical = 3,    // 球关节 (3 DOF)
    Universal = 4,    // 万向关节 (2 DOF)
    Planar = 5,       // 平面关节 (3 DOF)
    Fixed = 6,        // 固定关节 (0 DOF)
}

/** 驱动类型 */
export enum MbsMotionType {
    Rotational = 0,    // 旋转驱动
    Translational = 1, // 平移驱动
}

/** 实体类型 */
export enum MbsEntityType {
    Group = 0,     // 分组
    Parts = 1,     // 零件
    Marker = 2,    // 标记点
    Frame = 3,     // 参考坐标系
    Connector = 4, // 连接器/关节
    Motion = 5,    // 驱动
}

/** 驱动函数类型 */
export enum MbsMotionFunctionType {
    Constant = 0,   // 常量
    Step = 1,       // 阶跃
    Ramp = 2,       // 斜坡
    Harmonic = 3,   // 谐波 (正弦)
    Expression = 4, // 表达式
}

// ============================================================================
// 基础类型
// ============================================================================

/** MBS 变换矩阵 */
export interface MbsTransform {
    rotation: Mat3;
    translation: Vec3;
    apply(point: Vec3): Vec3;
    applyInverse(point: Vec3): Vec3;
    inverse(): MbsTransform;
}

// ============================================================================
// 实体接口
// ============================================================================

/** MBS 实体基类接口 */
export interface IMbsEntityBase {
    getId(): number;
    getType(): MbsEntityType;
    getName(): string;
    setName(name: string): void;
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
    delete(): void;
}

/** MBS 标记点接口 */
export interface IMbsMarker extends IMbsEntityBase {
    getPosition(): Vec3;
    setPosition(pos: Vec3): void;
    getOrientation(): Mat3;
    setOrientation(orient: Mat3): void;
    setOrientationFromZAxis(zAxis: Vec3): void;
    getXAxis(): Vec3;
    getYAxis(): Vec3;
    getZAxis(): Vec3;
    getLocalTransform(): MbsTransform;
    getGlobalTransform(): MbsTransform;
    toLocal(globalPoint: Vec3): Vec3;
    toGlobal(localPoint: Vec3): Vec3;
}

/** MBS 参考坐标系接口 */
export interface IMbsFrame extends IMbsMarker {
    getConnectorId(): number;
    setConnectorId(id: number): void;
    isPrimaryFrame(): boolean;
    setPrimaryFrame(primary: boolean): void;
}

/** MBS 刚体零件接口 */
export interface IMbsParts extends IMbsEntityBase {
    getMass(): number;
    setMass(mass: number): void;
    getCenterOfMass(): Vec3;
    setCenterOfMass(com: Vec3): void;
    getInertiaMatrix(): Mat3;
    setInertiaMatrix(inertia: Mat3): void;
    setInertia(ixx: number, iyy: number, izz: number, ixy?: number, ixz?: number, iyz?: number): void;
    getPosition(): Vec3;
    setPosition(pos: Vec3): void;
    getOrientation(): Mat3;
    setOrientation(orient: Mat3): void;
    getLocalTransform(): MbsTransform;
    getGlobalTransform(): MbsTransform;
    addShapeId(shapeId: string): void;
    removeShapeId(shapeId: string): void;
    clearShapeIds(): void;
    getMarkerCount(): number;
    getFrameCount(): number;
    addMarker(name?: string): IMbsMarker;
    addFrame(name?: string): IMbsFrame;
    getMarker(name: string): IMbsMarker | null;
    getFrame(name: string): IMbsFrame | null;
    isGround(): boolean;
    setGround(ground: boolean): void;
    calculatePropertiesFromShapes(): void;
}

// ============================================================================
// 关节接口
// ============================================================================

/** MBS 关节基类接口 */
export interface IMbsConnectorBase extends IMbsEntityBase {
    getJointType(): MbsJointType;
    getDof(): number;
    getIFrame(): IMbsFrame | null;
    setIFrame(frame: IMbsFrame): void;
    getJFrame(): IMbsFrame | null;
    setJFrame(frame: IMbsFrame): void;
    getRelativeTransform(): MbsTransform;
    getJointPosition(): number[];
    getJointVelocity(): number[];
    setJointPosition(pos: number[]): void;
    setJointVelocity(vel: number[]): void;
}

/** 旋转关节接口 */
export interface IMbsRevolute extends IMbsConnectorBase {
    // 继承自 IMbsConnectorBase
}

/** 移动关节接口 */
export interface IMbsPrismatic extends IMbsConnectorBase {
    // 继承自 IMbsConnectorBase
}

/** 圆柱关节接口 */
export interface IMbsCylindrical extends IMbsConnectorBase {
    // 继承自 IMbsConnectorBase
}

/** 球关节接口 */
export interface IMbsSpherical extends IMbsConnectorBase {
    setEulerAngles(alpha: number, beta: number, gamma: number): void;
}

/** 万向关节接口 */
export interface IMbsUniversal extends IMbsConnectorBase {
    // 继承自 IMbsConnectorBase
}

/** 平面关节接口 */
export interface IMbsPlanar extends IMbsConnectorBase {
    // 继承自 IMbsConnectorBase
}

/** 固定关节接口 */
export interface IMbsFixed extends IMbsConnectorBase {
    // 继承自 IMbsConnectorBase
}

// ============================================================================
// 驱动接口
// ============================================================================

/** MBS 驱动基类接口 */
export interface IMbsJointMotionBase extends IMbsEntityBase {
    getMotionType(): MbsMotionType;
    getConnector(): IMbsConnectorBase | null;
    setConnector(connector: IMbsConnectorBase): void;
    getDofIndex(): number;
    setDofIndex(index: number): void;
    getFunctionType(): MbsMotionFunctionType;
    setFunctionType(type: MbsMotionFunctionType): void;
    evaluate(time: number): number;
    evaluateDerivative(time: number): number;
}

/** 旋转驱动接口 */
export interface IMbsRotationalMotion extends IMbsJointMotionBase {
    getInitialAngle(): number;
    setInitialAngle(angle: number): void;
    getInitialAngularVelocity(): number;
    setInitialAngularVelocity(vel: number): void;
    getConstantValue(): number;
    setConstantValue(value: number): void;
    getAmplitude(): number;
    setAmplitude(amp: number): void;
    getFrequency(): number;
    setFrequency(freq: number): void;
    getPhase(): number;
    setPhase(phase: number): void;
    getSlope(): number;
    setSlope(slope: number): void;
    getOffset(): number;
    setOffset(offset: number): void;
    getStepTime(): number;
    setStepTime(time: number): void;
    getStepValue(): number;
    setStepValue(value: number): void;
}

/** 平移驱动接口 */
export interface IMbsTranslationalMotion extends IMbsJointMotionBase {
    getInitialDisplacement(): number;
    setInitialDisplacement(disp: number): void;
    getInitialVelocity(): number;
    setInitialVelocity(vel: number): void;
    getConstantValue(): number;
    setConstantValue(value: number): void;
    getAmplitude(): number;
    setAmplitude(amp: number): void;
    getFrequency(): number;
    setFrequency(freq: number): void;
    getPhase(): number;
    setPhase(phase: number): void;
    getSlope(): number;
    setSlope(slope: number): void;
    getOffset(): number;
    setOffset(offset: number): void;
    getStepTime(): number;
    setStepTime(time: number): void;
    getStepValue(): number;
    setStepValue(value: number): void;
}

// ============================================================================
// 分组接口
// ============================================================================

/** MBS 分组接口 */
export interface IMbsGroup extends IMbsEntityBase {
    getTotalMass(): number;
    getCenterOfMass(): Vec3;
    getInertiaMatrix(): Mat3;
    getPosition(): Vec3;
    setPosition(pos: Vec3): void;
    getOrientation(): Mat3;
    setOrientation(orient: Mat3): void;
    getLocalTransform(): MbsTransform;
    getGlobalTransform(): MbsTransform;
    addParts(name?: string): IMbsParts;
    getParts(name: string): IMbsParts | null;
    getPartsById(id: number): IMbsParts | null;
    getPartsCount(): number;
    removeParts(name: string): void;
    getConnector(name: string): IMbsConnectorBase | null;
    getConnectorById(id: number): IMbsConnectorBase | null;
    getConnectorCount(): number;
    getMotion(name: string): IMbsJointMotionBase | null;
    getMotionCount(): number;
    getParentGroup(): IMbsGroup | null;
    setParentGroup(parent: IMbsGroup): void;
    isRoot(): boolean;
    calculateAggregateProperties(): void;
    // 兼容旧接口
    getMass(): number;
    addShapeId(shapeId: string): void;
    removeShapeId(shapeId: string): void;
    calculateProperties(): void;
}

// ============================================================================
// 工厂函数类型
// ============================================================================

/** 关节工厂函数类型 */
export type JointFactory = {
    createRevolute(name?: string): IMbsRevolute;
    createPrismatic(name?: string): IMbsPrismatic;
    createCylindrical(name?: string): IMbsCylindrical;
    createSpherical(name?: string): IMbsSpherical;
    createUniversal(name?: string): IMbsUniversal;
    createPlanar(name?: string): IMbsPlanar;
    createFixed(name?: string): IMbsFixed;
};

/** 驱动工厂函数类型 */
export type MotionFactory = {
    createRotational(name?: string): IMbsRotationalMotion;
    createTranslational(name?: string): IMbsTranslationalMotion;
};

// ============================================================================
// 关节自由度信息
// ============================================================================

/** 关节自由度信息 */
export const JOINT_DOF_INFO: Record<MbsJointType, { dof: number; description: string }> = {
    [MbsJointType.Revolute]: { dof: 1, description: '绕 Z 轴旋转' },
    [MbsJointType.Prismatic]: { dof: 1, description: '沿 Z 轴平移' },
    [MbsJointType.Cylindrical]: { dof: 2, description: '绕 Z 轴旋转 + 沿 Z 轴平移' },
    [MbsJointType.Spherical]: { dof: 3, description: '三轴旋转 (ZYX 欧拉角)' },
    [MbsJointType.Universal]: { dof: 2, description: '绕 X 轴和 Y 轴旋转' },
    [MbsJointType.Planar]: { dof: 3, description: 'XY 平面平移 + 绕 Z 轴旋转' },
    [MbsJointType.Fixed]: { dof: 0, description: '固定连接' },
};
