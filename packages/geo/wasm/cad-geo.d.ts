// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
interface WasmModule {
}

type EmbindString = ArrayBuffer|Uint8Array|Uint8ClampedArray|Int8Array|string;
export interface ClassHandle {
  isAliasOf(other: ClassHandle): boolean;
  delete(): void;
  deleteLater(): this;
  isDeleted(): boolean;
  clone(): this;
}
export interface VectorDouble extends ClassHandle {
  size(): number;
  get(_0: number): number | undefined;
  push_back(_0: number): void;
  resize(_0: number, _1: number): void;
  set(_0: number, _1: number): boolean;
}

export interface MbsJointTypeValue<T extends number> {
  value: T;
}
export type MbsJointType = MbsJointTypeValue<0>|MbsJointTypeValue<1>|MbsJointTypeValue<2>|MbsJointTypeValue<3>|MbsJointTypeValue<4>|MbsJointTypeValue<5>|MbsJointTypeValue<6>;

export interface MbsMotionTypeValue<T extends number> {
  value: T;
}
export type MbsMotionType = MbsMotionTypeValue<0>|MbsMotionTypeValue<1>;

export interface MbsEntityTypeValue<T extends number> {
  value: T;
}
export type MbsEntityType = MbsEntityTypeValue<0>|MbsEntityTypeValue<1>|MbsEntityTypeValue<2>|MbsEntityTypeValue<3>|MbsEntityTypeValue<4>|MbsEntityTypeValue<5>;

export interface MbsMotionFunctionTypeValue<T extends number> {
  value: T;
}
export type MbsMotionFunctionType = MbsMotionFunctionTypeValue<0>|MbsMotionFunctionTypeValue<1>|MbsMotionFunctionTypeValue<2>|MbsMotionFunctionTypeValue<3>|MbsMotionFunctionTypeValue<4>;

export interface MbsMat3 extends ClassHandle {
  transposed(): MbsMat3;
  getData(): any;
}

export interface MbsTransform extends ClassHandle {
  rotation: MbsMat3;
  translation: MbsVec3;
  inverse(): MbsTransform;
  apply(_0: MbsVec3): MbsVec3;
  applyInverse(_0: MbsVec3): MbsVec3;
}

export interface MbsEntityBase extends ClassHandle {
  getType(): MbsEntityType;
  isEnabled(): boolean;
  setEnabled(_0: boolean): void;
  getId(): bigint;
  getName(): string;
  setName(_0: EmbindString): void;
}

export interface MbsMarker extends MbsEntityBase {
  getOrientation(): MbsMat3;
  getLocalTransform(): MbsTransform;
  getGlobalTransform(): MbsTransform;
  setOrientation(_0: MbsMat3): void;
  getPosition(): MbsVec3;
  setPosition(_0: MbsVec3): void;
  setOrientationFromZAxis(_0: MbsVec3): void;
  getXAxis(): MbsVec3;
  getYAxis(): MbsVec3;
  getZAxis(): MbsVec3;
  toLocal(_0: MbsVec3): MbsVec3;
  toGlobal(_0: MbsVec3): MbsVec3;
}

export interface MbsFrame extends MbsMarker {
  isPrimaryFrame(): boolean;
  setPrimaryFrame(_0: boolean): void;
  getConnectorId(): bigint;
  setConnectorId(_0: bigint): void;
}

export interface MbsParts extends MbsEntityBase {
  getInertiaMatrix(): MbsMat3;
  getOrientation(): MbsMat3;
  getLocalTransform(): MbsTransform;
  getGlobalTransform(): MbsTransform;
  setInertiaMatrix(_0: MbsMat3): void;
  setOrientation(_0: MbsMat3): void;
  clearShapeIds(): void;
  calculatePropertiesFromShapes(): void;
  isGround(): boolean;
  setGround(_0: boolean): void;
  getMarkerCount(): number;
  getFrameCount(): number;
  getCenterOfMass(): MbsVec3;
  setCenterOfMass(_0: MbsVec3): void;
  getPosition(): MbsVec3;
  setPosition(_0: MbsVec3): void;
  getMass(): number;
  setMass(_0: number): void;
  setInertia(_0: number, _1: number, _2: number, _3: number, _4: number, _5: number): void;
  addShapeId(_0: EmbindString): void;
  removeShapeId(_0: EmbindString): void;
  addMarker(_0: EmbindString): MbsMarker | null;
  addFrame(_0: EmbindString): MbsFrame | null;
  getMarker(_0: EmbindString): MbsMarker | null;
  getFrame(_0: EmbindString): MbsFrame | null;
}

export interface MbsConnectorBase extends MbsEntityBase {
  getJointType(): MbsJointType;
  getIFrame(): MbsFrame | null;
  getJFrame(): MbsFrame | null;
  getRelativeTransform(): MbsTransform;
  setIFrame(_0: MbsFrame | null): void;
  setJFrame(_0: MbsFrame | null): void;
  getDof(): number;
}

export interface MbsRevolute extends MbsConnectorBase {
  getJointPosition(): VectorDouble;
  getJointVelocity(): VectorDouble;
  setJointPosition(_0: VectorDouble): void;
  setJointVelocity(_0: VectorDouble): void;
}

export interface MbsPrismatic extends MbsConnectorBase {
  getJointPosition(): VectorDouble;
  getJointVelocity(): VectorDouble;
  setJointPosition(_0: VectorDouble): void;
  setJointVelocity(_0: VectorDouble): void;
}

export interface MbsCylindrical extends MbsConnectorBase {
  getJointPosition(): VectorDouble;
  getJointVelocity(): VectorDouble;
  setJointPosition(_0: VectorDouble): void;
  setJointVelocity(_0: VectorDouble): void;
}

export interface MbsSpherical extends MbsConnectorBase {
  getJointPosition(): VectorDouble;
  getJointVelocity(): VectorDouble;
  setJointPosition(_0: VectorDouble): void;
  setJointVelocity(_0: VectorDouble): void;
  setEulerAngles(_0: number, _1: number, _2: number): void;
}

export interface MbsUniversal extends MbsConnectorBase {
  getJointPosition(): VectorDouble;
  getJointVelocity(): VectorDouble;
  setJointPosition(_0: VectorDouble): void;
  setJointVelocity(_0: VectorDouble): void;
}

export interface MbsPlanar extends MbsConnectorBase {
  getJointPosition(): VectorDouble;
  getJointVelocity(): VectorDouble;
  setJointPosition(_0: VectorDouble): void;
  setJointVelocity(_0: VectorDouble): void;
}

export interface MbsFixed extends MbsConnectorBase {
}

export interface MbsJointMotionBase extends MbsEntityBase {
  getMotionType(): MbsMotionType;
  getConnector(): MbsConnectorBase | null;
  getFunctionType(): MbsMotionFunctionType;
  setConnector(_0: MbsConnectorBase | null): void;
  setFunctionType(_0: MbsMotionFunctionType): void;
  isEnabled(): boolean;
  setEnabled(_0: boolean): void;
  getDofIndex(): number;
  setDofIndex(_0: number): void;
  evaluate(_0: number): number;
  evaluateDerivative(_0: number): number;
}

export interface MbsRotationalMotion extends MbsJointMotionBase {
  getInitialAngle(): number;
  setInitialAngle(_0: number): void;
  getInitialAngularVelocity(): number;
  setInitialAngularVelocity(_0: number): void;
  getConstantValue(): number;
  setConstantValue(_0: number): void;
  getAmplitude(): number;
  setAmplitude(_0: number): void;
  getFrequency(): number;
  setFrequency(_0: number): void;
  getPhase(): number;
  setPhase(_0: number): void;
  getSlope(): number;
  setSlope(_0: number): void;
  getOffset(): number;
  setOffset(_0: number): void;
  getStepTime(): number;
  setStepTime(_0: number): void;
  getStepValue(): number;
  setStepValue(_0: number): void;
}

export interface MbsTranslationalMotion extends MbsJointMotionBase {
  getInitialDisplacement(): number;
  setInitialDisplacement(_0: number): void;
  getInitialVelocity(): number;
  setInitialVelocity(_0: number): void;
  getConstantValue(): number;
  setConstantValue(_0: number): void;
  getAmplitude(): number;
  setAmplitude(_0: number): void;
  getFrequency(): number;
  setFrequency(_0: number): void;
  getPhase(): number;
  setPhase(_0: number): void;
  getSlope(): number;
  setSlope(_0: number): void;
  getOffset(): number;
  setOffset(_0: number): void;
  getStepTime(): number;
  setStepTime(_0: number): void;
  getStepValue(): number;
  setStepValue(_0: number): void;
}

export interface MbsGroup extends MbsEntityBase {
  getInertiaMatrix(): MbsMat3;
  getOrientation(): MbsMat3;
  getLocalTransform(): MbsTransform;
  getGlobalTransform(): MbsTransform;
  getParentGroup(): MbsGroup | null;
  setOrientation(_0: MbsMat3): void;
  setParentGroup(_0: MbsGroup | null): void;
  calculateAggregateProperties(): void;
  calculateProperties(): void;
  isRoot(): boolean;
  getPartsCount(): number;
  getConnectorCount(): number;
  getMotionCount(): number;
  getPartsById(_0: bigint): MbsParts | null;
  getConnectorById(_0: bigint): MbsConnectorBase | null;
  getCenterOfMass(): MbsVec3;
  getPosition(): MbsVec3;
  setPosition(_0: MbsVec3): void;
  getTotalMass(): number;
  getMass(): number;
  addParts(_0: EmbindString): MbsParts | null;
  getParts(_0: EmbindString): MbsParts | null;
  removeParts(_0: EmbindString): void;
  getConnector(_0: EmbindString): MbsConnectorBase | null;
  getMotion(_0: EmbindString): MbsJointMotionBase | null;
  addShapeId(_0: EmbindString): void;
  removeShapeId(_0: EmbindString): void;
}

export type MbsVec3 = {
  x: number,
  y: number,
  z: number
};

export type Domain = {
  start: number,
  end: number
};

export type UV = {
  u: number,
  v: number
};

export type Vector3 = {
  x: number,
  y: number,
  z: number
};

export type PointAndParameter = {
  point: Vector3,
  parameter: number
};

export type Ax1 = {
  location: Vector3,
  direction: Vector3
};

export type Ax2 = {
  location: Vector3,
  direction: Vector3,
  xDirection: Vector3
};

export type Ax3 = {
  location: Vector3,
  direction: Vector3,
  xDirection: Vector3
};

export type Pln = {
  location: Vector3,
  direction: Vector3,
  xDirection: Vector3
};

export type ProjectPointResult = {
  point: Vector3,
  distance: number,
  parameter: number
};

export type ExtremaCCResult = {
  distance: number,
  p1: Vector3,
  p2: Vector3,
  isParallel: boolean,
  u1: number,
  u2: number
};

interface EmbindModule {
  VectorDouble: {
    new(): VectorDouble;
  };
  MbsJointType: {Revolute: MbsJointTypeValue<0>, Prismatic: MbsJointTypeValue<1>, Cylindrical: MbsJointTypeValue<2>, Spherical: MbsJointTypeValue<3>, Universal: MbsJointTypeValue<4>, Planar: MbsJointTypeValue<5>, Fixed: MbsJointTypeValue<6>};
  MbsMotionType: {Rotational: MbsMotionTypeValue<0>, Translational: MbsMotionTypeValue<1>};
  MbsEntityType: {Group: MbsEntityTypeValue<0>, Parts: MbsEntityTypeValue<1>, Marker: MbsEntityTypeValue<2>, Frame: MbsEntityTypeValue<3>, Connector: MbsEntityTypeValue<4>, Motion: MbsEntityTypeValue<5>};
  MbsMotionFunctionType: {Constant: MbsMotionFunctionTypeValue<0>, Step: MbsMotionFunctionTypeValue<1>, Ramp: MbsMotionFunctionTypeValue<2>, Harmonic: MbsMotionFunctionTypeValue<3>, Expression: MbsMotionFunctionTypeValue<4>};
  MbsMat3: {
    new(): MbsMat3;
    identity(): MbsMat3;
    fromAxisAngle(_0: MbsVec3, _1: number): MbsMat3;
  };
  MbsTransform: {
    new(): MbsTransform;
    new(_0: MbsMat3, _1: MbsVec3): MbsTransform;
    identity(): MbsTransform;
  };
  MbsEntityBase: {};
  MbsMarker: {
    new(_0: EmbindString): MbsMarker;
  };
  MbsFrame: {
    new(_0: EmbindString): MbsFrame;
  };
  MbsParts: {
    new(_0: EmbindString): MbsParts;
  };
  MbsConnectorBase: {};
  MbsRevolute: {
    new(_0: EmbindString): MbsRevolute;
  };
  MbsPrismatic: {
    new(_0: EmbindString): MbsPrismatic;
  };
  MbsCylindrical: {
    new(_0: EmbindString): MbsCylindrical;
  };
  MbsSpherical: {
    new(_0: EmbindString): MbsSpherical;
  };
  MbsUniversal: {
    new(_0: EmbindString): MbsUniversal;
  };
  MbsPlanar: {
    new(_0: EmbindString): MbsPlanar;
  };
  MbsFixed: {
    new(_0: EmbindString): MbsFixed;
  };
  MbsJointMotionBase: {};
  MbsRotationalMotion: {
    new(_0: EmbindString): MbsRotationalMotion;
  };
  MbsTranslationalMotion: {
    new(_0: EmbindString): MbsTranslationalMotion;
  };
  MbsGroup: {
    new(_0: EmbindString): MbsGroup;
  };
  makeBox(_0: number, _1: number, _2: number, _3: EmbindString): string;
  makeBoxAt(_0: number, _1: number, _2: number, _3: number, _4: number, _5: number, _6: EmbindString): string;
  makeCylinder(_0: number, _1: number, _2: EmbindString): string;
  makeCylinderAt(_0: number, _1: number, _2: number, _3: number, _4: number, _5: number, _6: number, _7: number, _8: EmbindString): string;
  makeSphere(_0: number, _1: EmbindString): string;
  makeSphereAt(_0: number, _1: number, _2: number, _3: number, _4: EmbindString): string;
  makeCone(_0: number, _1: number, _2: number, _3: EmbindString): string;
  booleanFuse(_0: EmbindString, _1: EmbindString, _2: EmbindString): string;
  booleanCut(_0: EmbindString, _1: EmbindString, _2: EmbindString): string;
  booleanCommon(_0: EmbindString, _1: EmbindString, _2: EmbindString): string;
  removeShape(_0: EmbindString): void;
  hasShape(_0: EmbindString): boolean;
  clearShapes(): void;
  getShapeCount(): number;
  readStepFromBuffer(_0: EmbindString, _1: EmbindString): string;
  meshShape(_0: EmbindString, _1: number, _2: number): string;
  meshShapeDefault(_0: EmbindString): string;
  calculateMassProperties(_0: EmbindString, _1: number): string;
  calculateMassPropertiesDefault(_0: EmbindString): string;
}

export type MainModule = WasmModule & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
