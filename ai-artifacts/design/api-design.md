# API 设计文档

**生成工具**: Claude Sonnet 4.5
**生成日期**: 2026-02-06
**版本**: v1.0

---

## 1. Geo 模块 API (WASM)

### 1.1 STEP 文件读取

#### readStepFile

```typescript
function readStepFile(
  data: Uint8Array,
  onProgress?: (progress: number) => void
): Promise<ShapeData[]>
```

**参数**:
- `data`: STEP 文件的二进制数据
- `onProgress`: 进度回调 (0-100)

**返回**:
- `ShapeData[]`: 解析出的形状数据数组

**示例**:
```typescript
const fileData = await vscode.workspace.fs.readFile(uri);
const shapes = await readStepFile(new Uint8Array(fileData), (progress) => {
  console.log(`Loading: ${progress}%`);
});
```

### 1.2 网格生成

#### tesselate

```typescript
function tesselate(
  shape: OcctShape,
  linearDeflection?: number,
  angularDeflection?: number
): MeshData
```

**参数**:
- `shape`: OCCT 形状对象
- `linearDeflection`: 线性偏差 (默认: 0.1)
- `angularDeflection`: 角度偏差 (默认: 0.5)

**返回**:
```typescript
interface MeshData {
  vertices: Float32Array;  // [x,y,z, x,y,z, ...]
  indices: Uint32Array;    // [i1,i2,i3, ...]
  normals: Float32Array;   // [nx,ny,nz, ...]
}
```

### 1.3 质量属性计算

#### computeMassProperties

```typescript
function computeMassProperties(
  shapes: OcctShape[],
  density: number
): MassProperties
```

**参数**:
- `shapes`: 形状数组
- `density`: 密度 (kg/m³)

**返回**:
```typescript
interface MassProperties {
  mass: number;              // kg
  centerOfMass: [number, number, number];  // [x, y, z]
  inertia: number[][];       // 3x3 惯性张量
}
```

---

## 2. Core 模块 API

### 2.1 MbsGroup (刚体组)

#### 创建刚体组

```typescript
class MbsDocument {
  createGroup(name: string, shapes: ShapeData[]): MbsGroup;
}
```

#### MbsGroup 接口

```typescript
interface MbsGroup {
  readonly id: string;
  name: string;
  shapes: ShapeData[];

  // 质量属性
  mass?: number;
  centerOfMass?: Vector3;
  inertia?: Matrix3x3;

  // 方法
  setMassProperties(props: MassProperties): void;
  addShape(shape: ShapeData): void;
  removeShape(shapeId: string): void;
}
```

### 2.2 MbsFrame (坐标系)

#### 创建坐标系

```typescript
class MbsGroup {
  createFrame(name: string, transform: Transform): MbsFrame;
}
```

#### MbsFrame 接口

```typescript
interface MbsFrame {
  readonly id: string;
  readonly groupId: string;
  name: string;

  // 位姿
  position: Vector3;
  orientation: Quaternion;

  // 方法
  setTransform(transform: Transform): void;
  getWorldTransform(): Transform;
}
```

### 2.3 MbsJoint (运动副)

#### 创建运动副

```typescript
class MbsDocument {
  createJoint(
    type: JointType,
    frame1: MbsFrame,
    frame2: MbsFrame,
    params?: JointParameters
  ): MbsJoint;
}
```

#### JointType 枚举

```typescript
enum JointType {
  Revolute = 'revolute',
  Prismatic = 'prismatic',
  Cylindrical = 'cylindrical',
  Spherical = 'spherical',
  Universal = 'universal',
  Planar = 'planar',
  Fixed = 'fixed'
}
```

#### MbsJoint 接口

```typescript
interface MbsJoint {
  readonly id: string;
  name: string;
  type: JointType;
  frame1Id: string;
  frame2Id: string;
  parameters: JointParameters;

  // 方法
  setParameter(key: string, value: any): void;
  validate(): ValidationResult;
}
```

### 2.4 MbsDocument (文档)

```typescript
class MbsDocument {
  // 集合
  readonly groups: Map<string, MbsGroup>;
  readonly joints: Map<string, MbsJoint>;

  // CRUD 操作
  createGroup(name: string, shapes: ShapeData[]): MbsGroup;
  getGroup(id: string): MbsGroup | undefined;
  deleteGroup(id: string): void;

  createJoint(...): MbsJoint;
  getJoint(id: string): MbsJoint | undefined;
  deleteJoint(id: string): void;

  // 导出
  toModelica(): string;
  toJSON(): object;
}
```

---

## 3. Three 模块 API

### 3.1 ThreeViewer

#### 初始化

```typescript
class ThreeViewer {
  constructor(container: HTMLElement);

  // 生命周期
  initialize(): void;
  dispose(): void;
  resize(width: number, height: number): void;
}
```

#### 渲染方法

```typescript
class ThreeViewer {
  // 渲染网格
  renderMesh(id: string, meshData: MeshData, material?: MaterialOptions): void;

  // 移除对象
  removeMesh(id: string): void;

  // 清空场景
  clear(): void;

  // 视图控制
  fitView(boundingBox?: Box3): void;
  setCamera(position: Vector3, target: Vector3): void;

  // 选择
  selectObject(id: string): void;
  clearSelection(): void;
}
```

#### 事件

```typescript
class ThreeViewer {
  on(event: 'select', callback: (id: string) => void): void;
  on(event: 'hover', callback: (id: string | null) => void): void;
  on(event: 'camera-change', callback: () => void): void;
}
```

---

## 4. VSCode 扩展 API

### 4.1 Extension 端

#### 命令注册

```typescript
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('cadtool.openEditor', () => {
      CadEditorPanel.createOrShow(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cadtool.importStep', async () => {
      const uri = await vscode.window.showOpenDialog({
        filters: { 'STEP Files': ['step', 'stp'] }
      });
      // ...
    })
  );
}
```

#### WebView 消息

```typescript
// Extension → WebView
panel.webview.postMessage({
  command: 'loadStep',
  data: arrayBuffer
});

// WebView → Extension
panel.webview.onDidReceiveMessage(
  message => {
    switch (message.command) {
      case 'saveModelica':
        handleSaveModelica(message.data);
        break;
    }
  }
);
```

### 4.2 WebView 端

#### 消息接收

```typescript
window.addEventListener('message', event => {
  const message = event.data;
  switch (message.command) {
    case 'loadStep':
      handleLoadStep(message.data);
      break;
  }
});
```

#### 消息发送

```typescript
vscode.postMessage({
  command: 'saveModelica',
  data: modelicaCode
});
```

---

## 5. 数据类型定义

### 5.1 基础类型

```typescript
type Vector3 = [number, number, number];
type Quaternion = [number, number, number, number]; // [x, y, z, w]
type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

interface Transform {
  position: Vector3;
  orientation: Quaternion;
}
```

### 5.2 ShapeData

```typescript
interface ShapeData {
  id: string;
  name: string;
  mesh: MeshData;
  boundingBox: Box3;
  volume?: number;
}
```

### 5.3 JointParameters

```typescript
// 各运动副特定参数
interface RevoluteJointParams {
  axis: Vector3;
  limits?: [number, number];  // 角度限制 (rad)
}

interface PrismaticJointParams {
  axis: Vector3;
  limits?: [number, number];  // 位移限制 (m)
}

type JointParameters =
  | RevoluteJointParams
  | PrismaticJointParams
  | /* ... 其他类型 */;
```

---

## 6. 错误处理

### 6.1 错误类型

```typescript
class CadToolError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

enum ErrorCode {
  STEP_PARSE_ERROR = 'STEP_PARSE_ERROR',
  INVALID_GEOMETRY = 'INVALID_GEOMETRY',
  MASS_CALC_ERROR = 'MASS_CALC_ERROR',
  JOINT_CONSTRAINT_VIOLATION = 'JOINT_CONSTRAINT_VIOLATION',
  EXPORT_ERROR = 'EXPORT_ERROR'
}
```

### 6.2 使用示例

```typescript
try {
  const shapes = await readStepFile(data);
} catch (error) {
  if (error instanceof CadToolError) {
    switch (error.code) {
      case ErrorCode.STEP_PARSE_ERROR:
        showError('无法解析 STEP 文件，请检查文件格式');
        break;
      default:
        showError('未知错误');
    }
  }
}
```

---

## 7. 版本控制

### 7.1 API 版本

当前版本: `v1.0.0`

遵循语义化版本控制 (SemVer):
- MAJOR: 不兼容的 API 变更
- MINOR: 向后兼容的功能新增
- PATCH: 向后兼容的问题修复

### 7.2 废弃策略

- 标记为 `@deprecated` 的 API 在下一个 MAJOR 版本移除
- 至少提前 1 个 MINOR 版本通知

---

## 8. 使用示例

### 完整流程示例

```typescript
// 1. 导入 STEP 文件
const fileData = await vscode.workspace.fs.readFile(stepFileUri);
const shapes = await readStepFile(new Uint8Array(fileData));

// 2. 创建文档和刚体组
const doc = new MbsDocument();
const group1 = doc.createGroup('Body1', [shapes[0]]);
const group2 = doc.createGroup('Body2', [shapes[1]]);

// 3. 计算质量属性
const mass1 = computeMassProperties([shapes[0]], 7850); // 钢铁密度
group1.setMassProperties(mass1);

// 4. 创建坐标系
const frame1 = group1.createFrame('ConnectionPoint', {
  position: [0, 0, 0],
  orientation: [0, 0, 0, 1]
});
const frame2 = group2.createFrame('ConnectionPoint', {
  position: [0, 0, 0.1],
  orientation: [0, 0, 0, 1]
});

// 5. 创建运动副
const joint = doc.createJoint(JointType.Revolute, frame1, frame2, {
  axis: [0, 0, 1],
  limits: [-Math.PI, Math.PI]
});

// 6. 渲染
const viewer = new ThreeViewer(container);
shapes.forEach((shape, i) => {
  viewer.renderMesh(`shape-${i}`, shape.mesh);
});
viewer.fitView();

// 7. 导出 Modelica
const modelicaCode = doc.toModelica();
await vscode.workspace.fs.writeFile(
  outputUri,
  new TextEncoder().encode(modelicaCode)
);
```
