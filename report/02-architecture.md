# CadToolOnline 架构设计文档

## 1. 整体架构

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      VSCode Extension Host                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              VSCode Extension (Node.js)               │  │
│  │  - 命令注册                                           │  │
│  │  - WebView 管理                                       │  │
│  │  - 文件系统访问                                       │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │                                      │
│                       │ postMessage                          │
│                       ▼                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           WebView Panel (Browser Context)             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │   UI Layer  │  │ Three.js    │  │  OCCT WASM   │  │  │
│  │  │  (React)    │──│  Renderer   │──│  (Geo Core)  │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  │         │                │                 │           │  │
│  │         └────────────────┴─────────────────┘           │  │
│  │                          │                              │  │
│  │                  ┌───────▼───────┐                      │  │
│  │                  │  Core Models  │                      │  │
│  │                  │  (TypeScript) │                      │  │
│  │                  └───────────────┘                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层次 | 技术 | 用途 |
|------|------|------|
| 插件层 | VSCode Extension API | IDE 集成、文件系统访问 |
| UI层 | React + TypeScript | 用户界面组件 |
| 渲染层 | Three.js | 3D 可视化 |
| 计算层 | OpenCASCADE (WASM) | 几何计算、STEP 解析 |
| 数据层 | TypeScript 类型系统 | 数据模型定义 |
| 构建层 | Vite + pnpm | 模块打包、依赖管理 |

## 2. 模块设计

### 2.1 packages/core - 核心数据模型

**职责**: 定义多体动力学系统的数据结构和类型

**核心类型**:

```typescript
// 刚体组
interface MbsGroup {
  id: string;
  name: string;
  shapes: ShapeData[];      // 几何形状
  mass?: number;            // 质量
  centerOfMass?: Vector3;   // 质心
  inertia?: Matrix3x3;      // 惯性张量
}

// 坐标系
interface MbsFrame {
  id: string;
  groupId: string;
  position: Vector3;
  orientation: Quaternion;
}

// 运动副
interface MbsJoint {
  id: string;
  type: JointType;  // Revolute, Prismatic, etc.
  frame1: string;   // 参考坐标系1
  frame2: string;   // 参考坐标系2
}

// 7种运动副类型
enum JointType {
  Revolute,      // 转动副
  Prismatic,     // 移动副
  Cylindrical,   // 圆柱副
  Spherical,     // 球副
  Universal,     // 万向节
  Planar,        // 平面副
  Fixed          // 固定副
}
```

**设计原则**:
- 纯数据结构，不包含业务逻辑
- 所有类型导出为 `readonly` 接口
- 使用严格的 TypeScript 类型检查

### 2.2 packages/geo - 几何计算模块

**职责**: 封装 OpenCASCADE WASM，提供几何计算能力

**目录结构**:
```
geo/
├── cpp/                    # C++ 源码
│   ├── src/
│   │   └── geo/
│   │       ├── geo_binding.cpp      # Embind 绑定
│   │       ├── step_reader.cpp      # STEP 读取
│   │       └── mass_properties.cpp  # 质量属性计算
│   ├── CMakeLists.txt
│   └── build_wasm.sh
├── wasm/                   # 编译产物
│   ├── cad-geo.wasm
│   ├── cad-geo.js
│   └── cad-geo.d.ts
└── src/                    # TypeScript 封装
    ├── types.ts
    └── index.ts
```

**核心功能**:
- `readStepFile(data: Uint8Array)` - STEP 文件解析
- `tesselate(shape)` - 网格生成（三角化）
- `computeMassProperties(shapes)` - 质量属性计算

**WASM 编译**:
- 使用 Emscripten v4.0.8
- 目标: `-O3` 优化，生成 ES6 模块
- 包含 OCCT 模块: TKernel, TKMath, TKSTEP, TKMesh 等

### 2.3 packages/three - 渲染模块

**职责**: 封装 Three.js，提供 3D 可视化能力

**核心类**:

```typescript
class ThreeViewer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;

  // 渲染网格
  renderMesh(geometry: MeshData): void;

  // 适配视图
  fitView(boundingBox: Box3): void;

  // 选择高亮
  highlightObject(id: string): void;
}
```

**渲染配置**:
- 坐标系: 右手系，Z 轴向上 (与 OCCT 一致)
- 光照: 环境光 + 方向光
- 材质: PBR (物理渲染)

### 2.4 packages/ui - UI 组件

**职责**: 可复用的 React 组件

**组件结构**:
```
ui/
├── components/
│   ├── ModelTree/       # 模型树
│   ├── PropertyPanel/   # 属性面板
│   ├── Toolbar/         # 工具栏
│   └── RibbonMenu/      # Ribbon 菜单
└── hooks/
    ├── useSelection.ts
    └── useCamera.ts
```

### 2.5 packages/vscode - VSCode 插件

**职责**: VSCode 集成，WebView 管理

**关键实现**:

```typescript
// Extension 端
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('cadtool.openEditor', () => {
      CadEditorPanel.createOrShow(context.extensionUri);
    })
  );
}

// WebView 端通信
class CadEditorPanel {
  private _panel: vscode.WebviewPanel;

  // 处理来自 WebView 的消息
  private _handleMessage(message: any) {
    switch (message.command) {
      case 'openFile':
        this._openStepFile(message.path);
        break;
      case 'saveModel':
        this._saveModelica(message.data);
        break;
    }
  }
}
```

## 3. 数据流设计

### 3.1 STEP 文件导入流程

```
用户操作
  │
  ├─→ VSCode Extension: 打开文件对话框
  │     │
  │     ├─→ 读取文件为 ArrayBuffer
  │     │
  │     └─→ postMessage 发送到 WebView
  │
  └─→ WebView: 接收文件数据
        │
        ├─→ Geo Module: 调用 WASM 解析 STEP
        │     │
        │     ├─→ OCCT: 解析几何拓扑
        │     │
        │     └─→ 返回: ShapeData[]
        │
        ├─→ Core Module: 创建 MbsGroup
        │
        └─→ Three Module: 渲染网格
              │
              └─→ 显示在 Canvas
```

### 3.2 运动副创建流程

```
用户操作
  │
  ├─→ 选择两个 Frame
  │
  ├─→ 选择运动副类型 (Revolute/Prismatic/...)
  │
  └─→ Core Module: 创建 MbsJoint 实例
        │
        ├─→ 验证约束合法性
        │
        ├─→ 更新数据模型
        │
        └─→ UI 更新: 显示在模型树
```

### 3.3 Modelica 导出流程

```
用户触发导出
  │
  ├─→ Core Module: 收集所有 MbsGroup、MbsJoint、MbsMotion
  │
  ├─→ Modelica Builder: 生成 .mo 文件
  │     │
  │     ├─→ 转换质量属性
  │     │
  │     ├─→ 转换运动副定义
  │     │
  │     └─→ 生成连接关系
  │
  └─→ VSCode Extension: 保存文件到磁盘
```

## 4. 坐标系约定

### 4.1 全局约定

- **坐标系**: 右手系，Z 轴向上
- **角度单位**: 弧度
- **长度单位**: 米 (m)

### 4.2 OCCT 与 Three.js 坐标系对齐

```typescript
// OCCT 使用 Z-up 右手系
// Three.js 默认 Y-up 右手系
// 需要在导入时转换

function occtToThree(vertex: [x, y, z]): THREE.Vector3 {
  // OCCT: (X, Y, Z)
  // Three: (X, Z, -Y)  [需根据实际情况调整]
  return new THREE.Vector3(vertex[0], vertex[2], -vertex[1]);
}
```

## 5. 性能优化策略

### 5.1 WASM 性能

- 使用 `-O3` 优化编译
- 开启 SIMD 指令支持
- 最小化 WASM <-> JS 数据传递

### 5.2 渲染性能

- 使用 Instanced Rendering 渲染重复几何体
- 实现 LOD (Level of Detail)
- 大场景使用 Frustum Culling

### 5.3 大文件处理

- Web Worker 异步解析 STEP
- 渐进式网格生成
- 内存池管理 WASM 对象

## 6. 安全性考虑

### 6.1 WASM 安全

- 禁止在 WASM 模块中处理敏感信息
- 所有文件路径验证，防止路径遍历
- STEP 文件大小限制: 100MB

### 6.2 VSCode 集成

- 使用 `vscode.workspace.fs` 安全访问文件
- WebView 内容安全策略 (CSP)

## 7. 测试策略

### 7.1 单元测试

- Core 模块: 数据结构验证
- Geo 模块: WASM 绑定测试
- Three 模块: 渲染逻辑测试

### 7.2 集成测试

- STEP 导入端到端测试
- 运动副创建流程测试
- Modelica 导出正确性测试

### 7.3 测试数据

使用 `../CADToolbox/src/python/test_use_case/` 中的测试模型

## 8. 部署架构

```
Development:
  ├─→ pnpm dev (watch mode)
  └─→ F5 启动 VSCode Extension Development Host

Production:
  ├─→ pnpm build:all (WASM + TypeScript)
  ├─→ pnpm package (生成 .vsix)
  └─→ VSCode Marketplace 发布
```

## 9. 参考资料

- [OpenCASCADE Technology Overview](https://dev.opencascade.org/doc/overview/html/)
- [Emscripten Documentation](https://emscripten.org/docs/)
- [VSCode Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Three.js Manual](https://threejs.org/manual/)
