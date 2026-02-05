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
export interface MbsMat3 extends ClassHandle {
  getData(): any;
}

export interface MbsGroup extends ClassHandle {
  getInertiaMatrix(): MbsMat3;
  calculateProperties(): void;
  getCenterOfMass(): MbsVec3;
  getMass(): number;
  getName(): string;
  setName(_0: EmbindString): void;
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
  MbsMat3: {
    new(): MbsMat3;
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
}

export type MainModule = WasmModule & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
