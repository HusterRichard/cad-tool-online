# CadToolOnline 项目开发指南

## 项目概述

CadToolOnline 是一个 VSCode 插件项目，目标是将桌面版 CADToolbox（Qt/C++ 应用）转换为在线版本。该插件支持导入 STEP 格式的三维 CAD 模型，提供多体动力学设计能力，并能生成 MxGraph 格式的拓扑关系图。

## 技术背景

### 输入项目

1. **CADToolbox**（参考项目：`C:\11.gitlab\CadToolOnline`）
   - 技术栈：Qt 5.14.2 + OCCT 7.7.0
   - 功能：三维 CAD 图形设计环境，支持多体动力学建模
   - 依赖：Sysplorer SDK 2024a

2. **chili3d**（参考项目：`C:\code\chili3d`）
   - 技术栈：OCCT + three.js + WebAssembly
   - 功能：在线版三维 CAD，通过 WASM 调用 OCCT 内核

### 输出目标

- 形态：VSCode 插件（Extension）
- 显示：three.js 渲染三维模型
- 几何内核：OCCT（编译为 WebAssembly）
- 拓扑图：MxGraph 显示多体动力学关系

## 实现方案

### 方案一：完整 WASM 移植（不推荐）

将 CADToolbox 的 C++ 代码完整编译成 WebAssembly。

**优点：**
- 代码复用率高
- 功能一致性好

**缺点：**
- 需要移除 Sysplorer SDK 依赖，工作量大
- WASM 文件体积可能过大
- 调试困难

### 方案二：OCCT WASM + JS 重写（推荐）

仅将 OCCT 编译成 WebAssembly，应用层代码用 TypeScript/JavaScript 重写。

**优点：**
- WASM 文件体积可控
- 前端代码易于调试和维护
- 可利用现有的 OCCT WASM 构建（如 opencascade.js）

**缺点：**
- 需要重写应用层逻辑
- 需要深入理解原有 C++ 代码的业务逻辑

## 核心功能模块

基于 CADToolbox 的架构，需要实现以下核心模块：

### 1. 分组设计（Group Design）

管理 CAD 模型的分组结构，计算组的物理属性。

**参考代码：**
- `CADToolbox/src/cad_mbs_model/src/model/factory/mbs_group_factory.h`
- `CADToolbox/src/cad_mbs_model/src/model/body/mbs_group_connection.h`
- `CADToolbox/src/cad_mbs_model/src/model/group_attribute_calculator.h`

**功能要点：**
- 创建/编辑/删除分组
- 计算分组的质量、质心、惯性矩阵
- 管理分组之间的连接关系

### 2. 标架设计（Frame Design）

定义刚体的局部坐标系和变换关系。

**参考代码：**
- `CADToolbox/src/mw_cad_toolbox/src/exchanger/mo_builder/mo_body/mo_frame.h`
- `CADToolbox/src/mw_cad_toolbox/src/exchanger/mo_builder/mo_body/mo_rigid_transform.h`

**功能要点：**
- 创建标架（Frame/Marker）
- 定义标架的位置和方向
- 支持 iMarker 和 jMarker 的配对

### 3. 关节设计（Joint Design）

定义刚体之间的运动约束关系。

**参考代码：**
- `CADToolbox/src/cad_mbs_model/src/model/factory/mbs_joint_motion_factory.h`
- `CADToolbox/src/cad_mbs_model/src/model/motion/mbs_joint_motion_base.h`
- `CADToolbox/src/mw_cad_toolbox/src/exchanger/mo_builder/mo_connector/`

**支持的关节类型：**
- Revolute（转动副）
- Prismatic（棱柱副/移动副）
- Cylindrical（圆柱副）
- Spherical（球副）
- Universal（万向节）
- Planar（平面副）
- Fixed（固定副）

### 4. 驱动设计（Drive/Motion Design）

定义关节的运动驱动。

**参考代码：**
- `CADToolbox/src/mw_cad_toolbox/src/exchanger/mo_builder/mo_motion/`
- `CADToolbox/src/mw_cad_toolbox/src/exchanger/mo_builder/mo_force/`

**支持的驱动类型：**
- Displacement（位移驱动）
- Velocity（速度驱动）
- Acceleration（加速度驱动）
- Angular（角度驱动）
- Force/Torque（力/力矩驱动）

## 项目结构建议

```
CadToolOnline/
├── src/
│   ├── extension.ts              # VSCode 插件入口
│   ├── webview/                  # WebView 相关代码
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css
│   ├── core/                     # 核心业务逻辑
│   │   ├── model/                # 数据模型
│   │   │   ├── Group.ts
│   │   │   ├── Frame.ts
│   │   │   ├── Joint.ts
│   │   │   └── Motion.ts
│   │   ├── geometry/             # 几何计算（调用 OCCT WASM）
│   │   │   ├── OcctWrapper.ts
│   │   │   ├── StepReader.ts
│   │   │   └── PropertyCalculator.ts
│   │   └── export/               # 导出功能
│   │       └── MxGraphExporter.ts
│   ├── viewer/                   # 三维视图
│   │   ├── ThreeViewer.ts
│   │   ├── SelectionManager.ts
│   │   └── TransformControls.ts
│   └── graph/                    # 拓扑图视图
│       ├── MxGraphView.ts
│       └── TopologyBuilder.ts
├── wasm/                         # OCCT WebAssembly 文件
│   └── opencascade.wasm
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## 技术栈建议

- **语言**：TypeScript
- **构建工具**：Webpack / esbuild
- **三维渲染**：three.js
- **几何内核**：opencascade.js（OCCT 的 WebAssembly 版本）
- **拓扑图**：mxGraph 或 @maxgraph/core
- **UI 框架**：可选 React / Vue / 原生 Web Components

## 开发注意事项

### OCCT 精度常量

```typescript
const OCCT_MIN_ACCURACY = 1e-6;
const OCCT_MAX_ACCURACY = 1e+6;
```

### STEP 文件处理

使用 OCCT 的 STEPControl_Reader 读取 STEP 文件，提取：
- 几何形状（TopoDS_Shape）
- 拓扑结构（Solid、Shell、Face、Edge、Vertex）
- 物理属性（质量、质心、惯性矩阵）

### 坐标系约定

- 使用右手坐标系
- 默认 Z 轴向上
- 角度单位：弧度

## 参考资源

- [opencascade.js](https://github.com/nicholasdavies/opencascade.js) - OCCT 的 WebAssembly 版本
- [three.js](https://threejs.org/) - 三维渲染库
- [mxGraph](https://github.com/jgraph/mxgraph) - 图形可视化库
- [VSCode Extension API](https://code.visualstudio.com/api) - VSCode 插件开发文档

## 开发流程建议

1. **环境搭建**：配置 VSCode 插件开发环境，集成 Webpack
2. **OCCT 集成**：引入 opencascade.js，实现 STEP 文件读取
3. **三维视图**：使用 three.js 实现基本的三维模型显示
4. **分组功能**：实现分组的创建、编辑、属性计算
5. **标架功能**：实现标架的创建和可视化
6. **关节功能**：实现各类关节的创建和约束定义
7. **驱动功能**：实现运动驱动的定义
8. **拓扑图**：使用 mxGraph 生成多体动力学关系图
9. **导出功能**：实现模型导出为 Modelica 格式

## 测试用例参考

CADToolbox 项目包含多个测试用例，可作为功能验证参考：
- 四连杆机构（four_bar_linkage）
- 曲柄摇杆机构（crank_rocker）
- 着陆架机构（landing_gear）
- 机械臂（robot_arm）

测试用例位置：`CADToolbox/src/python/test_use_case/`

---

# 方案一：完整 WASM 移植 - 详细设计任务书

## 1. 方案概述

采用方案一，参考 [chili3d](https://github.com/xiangechen/chili3d) 项目的技术架构，将 CADToolbox 的核心 C++ 代码编译成 WebAssembly，实现在线版 CAD 多体动力学设计工具。

### 1.1 技术栈版本（参考 chili3d）

| 技术组件 | 版本 | 说明 |
|---------|------|------|
| OCCT | V8_0_0_rc3 | OpenCASCADE 几何内核（来源：chili3d/scripts/setup_wasm_deps.mjs） |
| three.js | ^0.170.0 | 三维渲染引擎 |
| Emscripten | 3.1.x | C++ 到 WebAssembly 编译器 |
| TypeScript | ^5.x | 前端开发语言 |
| Vite | ^5.x | 构建工具 |

### 1.2 核心目标

1. 将 CADToolbox 的 MBS（多体系统）核心模块编译为 WASM
2. 移除 Sysplorer SDK 依赖，保持 WASM 文件体积可控
3. 使用 three.js 替代 Qt 的 OpenGL 渲染
4. 实现 VSCode 插件形态的在线 CAD 工具

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      VSCode Extension Host                       │
├─────────────────────────────────────────────────────────────────┤
│                         WebView Panel                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Frontend (TypeScript)                     ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │  UI Layer    │  │ Three.js     │  │  MxGraph View    │  ││
│  │  │  (Commands)  │  │ (3D Render)  │  │  (Topology)      │  ││
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  ││
│  │         │                 │                    │            ││
│  │  ┌──────┴─────────────────┴────────────────────┴─────────┐  ││
│  │  │              TypeScript Binding Layer                  │  ││
│  │  │         (Embind / WebIDL Generated API)                │  ││
│  │  └────────────────────────┬───────────────────────────────┘  ││
│  │                           │                                  ││
│  │  ┌────────────────────────┴───────────────────────────────┐  ││
│  │  │                  WebAssembly Module                     │  ││
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │  ││
│  │  │  │ OCCT Core   │  │ MBS Model   │  │ Geometry Utils  │ │  ││
│  │  │  │ (V8_0_0_rc3)│  │ (C++ Core)  │  │ (C++ Core)      │ │  ││
│  │  │  └─────────────┘  └─────────────┘  └─────────────────┘ │  ││
│  │  └────────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

```
CadToolOnline/
├── packages/
│   ├── chili-core/              # 核心数据模型（TypeScript）
│   │   ├── src/
│   │   │   ├── model/           # MBS 数据模型
│   │   │   ├── command/         # 命令系统
│   │   │   ├── history/         # 撤销/重做
│   │   │   └── event/           # 事件系统
│   │   └── package.json
│   │
│   ├── chili-geo/               # 几何计算模块（C++ → WASM）
│   │   ├── cpp/
│   │   │   ├── src/
│   │   │   │   ├── occt/        # OCCT 封装
│   │   │   │   ├── mbs/         # MBS 几何计算
│   │   │   │   └── binding/     # Embind 绑定
│   │   │   ├── CMakeLists.txt
│   │   │   └── build_wasm.sh
│   │   ├── src/                 # TypeScript 接口
│   │   └── package.json
│   │
│   ├── chili-three/             # Three.js 渲染模块
│   │   ├── src/
│   │   │   ├── viewer/          # 3D 视图
│   │   │   ├── controls/        # 交互控制
│   │   │   ├── materials/       # 材质系统
│   │   │   └── helpers/         # 辅助显示
│   │   └── package.json
│   │
│   ├── chili-ui/                # UI 组件
│   │   ├── src/
│   │   │   ├── panels/          # 面板组件
│   │   │   ├── toolbar/         # 工具栏
│   │   │   ├── tree/            # 模型树
│   │   │   └── property/        # 属性面板
│   │   └── package.json
│   │
│   └── chili-vscode/            # VSCode 插件入口
│       ├── src/
│       │   ├── extension.ts
│       │   └── webview/
│       └── package.json
│
├── wasm/                        # 编译输出的 WASM 文件
│   ├── chili-geo.wasm
│   └── chili-geo.js
│
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

## 3. C++ 代码移植计划

### 3.1 需要移植的模块

从 CADToolbox 项目中提取以下核心模块：

| 源模块 | 目标模块 | 说明 |
|--------|----------|------|
| `cad_mbs_model` | `chili-geo/cpp/src/mbs` | MBS 数据模型核心 |
| `cad_util` | `chili-geo/cpp/src/util` | 工具函数 |
| `CBACORE/CBABase` | `chili-geo/cpp/src/math` | 数学库 |

### 3.2 需要移除的依赖

| 依赖 | 处理方式 |
|------|----------|
| Sysplorer SDK | 完全移除，用 TypeScript 重写 UI 层 |
| Qt | 完全移除，用 Web 技术替代 |
| mw_* 系列库 | 完全移除 |
| Boost | 保留必要的 header-only 部分 |
| Eigen | 保留，用于矩阵计算 |

### 3.3 核心类移植清单

#### 3.3.1 MBS 模型类

```cpp
// 需要移植到 WASM 的核心类
namespace mbs {
    // 刚体和分组
    class MbsBody;              // 刚体基类
    class MbsGroup;             // 分组
    class MbsGroupConnection;   // 分组连接
    class GroupAttributeCalculator; // 属性计算器

    // 标架
    class MbsFrame;             // 标架
    class MbsMarker;            // 标记点

    // 关节
    class MbsJointBase;         // 关节基类
    class MbsRevolute;          // 转动副
    class MbsPrismatic;         // 棱柱副
    class MbsCylindrical;       // 圆柱副
    class MbsSpherical;         // 球副
    class MbsUniversal;         // 万向节
    class MbsPlanar;            // 平面副
    class MbsFixed;             // 固定副

    // 驱动
    class MbsMotionBase;        // 驱动基类
    class MbsRotational;        // 旋转驱动
    class MbsTranslational;     // 平移驱动

    // 工厂
    class MbsGroupFactory;      // 分组工厂
    class MbsJointMotionFactory; // 关节驱动工厂
}
```

#### 3.3.2 几何计算类

```cpp
// OCCT 相关封装
namespace geo {
    class StepReader;           // STEP 文件读取
    class ShapeAnalyzer;        // 形状分析
    class MassPropertyCalculator; // 质量属性计算
    class BRepMesher;           // 网格化（用于 three.js 显示）
}
```

## 4. Embind 绑定设计

### 4.1 绑定示例

```cpp
// chili-geo/cpp/src/binding/mbs_binding.cpp
#include <emscripten/bind.h>
#include "mbs/MbsGroup.h"
#include "mbs/MbsJoint.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(mbs_module) {
    // 向量和矩阵
    value_array<std::array<double, 3>>("Vec3")
        .element(emscripten::index<0>())
        .element(emscripten::index<1>())
        .element(emscripten::index<2>());

    value_array<std::array<double, 9>>("Mat3")
        .element(emscripten::index<0>())
        // ... 其他元素
        ;

    // MbsGroup 类
    class_<MbsGroup>("MbsGroup")
        .constructor<const std::string&>()
        .function("getName", &MbsGroup::getName)
        .function("setName", &MbsGroup::setName)
        .function("getMass", &MbsGroup::getMass)
        .function("getCenterOfMass", &MbsGroup::getCenterOfMass)
        .function("getInertiaMatrix", &MbsGroup::getInertiaMatrix)
        .function("addShape", &MbsGroup::addShape)
        .function("calculateProperties", &MbsGroup::calculateProperties);

    // MbsFrame 类
    class_<MbsFrame>("MbsFrame")
        .constructor<>()
        .function("getPosition", &MbsFrame::getPosition)
        .function("setPosition", &MbsFrame::setPosition)
        .function("getOrientation", &MbsFrame::getOrientation)
        .function("setOrientation", &MbsFrame::setOrientation);

    // 关节类型枚举
    enum_<JointType>("JointType")
        .value("Revolute", JointType::Revolute)
        .value("Prismatic", JointType::Prismatic)
        .value("Cylindrical", JointType::Cylindrical)
        .value("Spherical", JointType::Spherical)
        .value("Universal", JointType::Universal)
        .value("Planar", JointType::Planar)
        .value("Fixed", JointType::Fixed);

    // MbsJoint 基类
    class_<MbsJointBase>("MbsJointBase")
        .function("getType", &MbsJointBase::getType)
        .function("getIMarker", &MbsJointBase::getIMarker)
        .function("getJMarker", &MbsJointBase::getJMarker);

    // STEP 文件读取
    class_<StepReader>("StepReader")
        .constructor<>()
        .function("read", &StepReader::read)
        .function("getShapes", &StepReader::getShapes)
        .function("getMeshData", &StepReader::getMeshData);
}
```

### 4.2 TypeScript 接口定义

```typescript
// chili-geo/src/types.ts
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Mat3 {
    m: number[]; // 9 elements, row-major
}

export interface MeshData {
    vertices: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
}

export interface MbsGroupInterface {
    getName(): string;
    setName(name: string): void;
    getMass(): number;
    getCenterOfMass(): Vec3;
    getInertiaMatrix(): Mat3;
    addShape(shapePtr: number): void;
    calculateProperties(): void;
    delete(): void;
}

export enum JointType {
    Revolute = 0,
    Prismatic = 1,
    Cylindrical = 2,
    Spherical = 3,
    Universal = 4,
    Planar = 5,
    Fixed = 6
}
```

## 5. WASM 编译配置

### 5.1 CMakeLists.txt

```cmake
# chili-geo/cpp/CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(chili-geo)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# OCCT 配置
set(OCCT_VERSION "8.0.0")
set(OCCT_ROOT "${CMAKE_SOURCE_DIR}/third_party/occt-${OCCT_VERSION}")

# 包含 OCCT 头文件
include_directories(
    ${OCCT_ROOT}/include/opencascade
    ${CMAKE_SOURCE_DIR}/src
    ${CMAKE_SOURCE_DIR}/third_party/eigen
)

# 源文件
file(GLOB_RECURSE SOURCES
    "src/mbs/*.cpp"
    "src/geo/*.cpp"
    "src/util/*.cpp"
    "src/binding/*.cpp"
)

# OCCT 库（预编译的 WASM 版本）
set(OCCT_LIBS
    TKernel TKMath TKG3d TKGeomBase TKBRep
    TKTopAlgo TKGeomAlgo TKPrim TKBO
    TKMesh TKSTL TKXSBase TKSTEP TKSTEPBase
    TKSTEPAttr TKIGES
)

# Emscripten 编译选项
if(EMSCRIPTEN)
    set(CMAKE_EXECUTABLE_SUFFIX ".js")

    add_executable(chili-geo ${SOURCES})

    target_link_libraries(chili-geo ${OCCT_LIBS})

    set_target_properties(chili-geo PROPERTIES
        LINK_FLAGS "\
            -s WASM=1 \
            -s MODULARIZE=1 \
            -s EXPORT_NAME='ChiliGeo' \
            -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
            -s ALLOW_MEMORY_GROWTH=1 \
            -s MAXIMUM_MEMORY=2GB \
            -s ENVIRONMENT='web,worker' \
            --bind \
            -O3 \
            -flto \
        "
    )
endif()
```

### 5.2 编译脚本

```bash
#!/bin/bash
# chili-geo/cpp/build_wasm.sh

set -e

# 设置 Emscripten 环境
source /path/to/emsdk/emsdk_env.sh

# 创建构建目录
mkdir -p build
cd build

# 配置
emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DOCCT_ROOT=/path/to/occt-wasm

# 编译
emmake make -j$(nproc)

# 复制输出文件
cp chili-geo.js chili-geo.wasm ../../wasm/

echo "Build completed!"
```

## 6. Three.js 集成

### 6.1 渲染器封装

```typescript
// packages/chili-three/src/viewer/ThreeViewer.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';

export class ThreeViewer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private transformControls: TransformControls;

    constructor(container: HTMLElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a2a2a);

        this.camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            10000
        );
        this.camera.position.set(100, 100, 100);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);

        this.setupLights();
        this.setupGrid();
        this.animate();
    }

    // 从 WASM 获取的网格数据创建 Three.js 对象
    addMeshFromWasm(meshData: MeshData, material?: THREE.Material): THREE.Mesh {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
        geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

        const mat = material || new THREE.MeshPhongMaterial({
            color: 0x808080,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, mat);
        this.scene.add(mesh);
        return mesh;
    }

    // ... 其他方法
}
```

### 6.2 标架可视化

```typescript
// packages/chili-three/src/helpers/FrameHelper.ts
import * as THREE from 'three';

export class FrameHelper extends THREE.Object3D {
    private axisLength: number;

    constructor(axisLength: number = 10) {
        super();
        this.axisLength = axisLength;
        this.createAxes();
    }

    private createAxes(): void {
        // X 轴 - 红色
        const xAxis = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 0),
            this.axisLength,
            0xff0000
        );
        this.add(xAxis);

        // Y 轴 - 绿色
        const yAxis = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 0),
            this.axisLength,
            0x00ff00
        );
        this.add(yAxis);

        // Z 轴 - 蓝色
        const zAxis = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, 0),
            this.axisLength,
            0x0000ff
        );
        this.add(zAxis);
    }

    setFromMbsFrame(frame: MbsFrameInterface): void {
        const pos = frame.getPosition();
        const orient = frame.getOrientation();

        this.position.set(pos.x, pos.y, pos.z);

        const matrix = new THREE.Matrix3();
        matrix.fromArray(orient.m);
        const matrix4 = new THREE.Matrix4();
        matrix4.setFromMatrix3(matrix);
        this.setRotationFromMatrix(matrix4);
    }
}
```

## 7. 开发任务分解

### 7.1 阶段一：基础设施搭建

| 任务 | 描述 | 优先级 |
|------|------|--------|
| T1.1 | 搭建 monorepo 项目结构（pnpm workspace） | P0 |
| T1.2 | 配置 TypeScript、ESLint、Prettier | P0 |
| T1.3 | 配置 Vite 构建系统 | P0 |
| T1.4 | 搭建 VSCode 插件基础框架 | P0 |
| T1.5 | 配置 Emscripten 编译环境 | P0 |

### 7.2 阶段二：OCCT WASM 编译

| 任务 | 描述 | 优先级 |
|------|------|--------|
| T2.1 | 编译 OCCT V8_0_0_rc3 为 WASM（参考 chili3d） | P0 |
| T2.2 | 实现 STEP 文件读取功能 | P0 |
| T2.3 | 实现网格化功能（用于 three.js 显示） | P0 |
| T2.4 | 实现质量属性计算功能 | P1 |

### 7.3 阶段三：MBS 核心移植

| 任务 | 描述 | 优先级 |
|------|------|--------|
| T3.1 | 移植 MbsGroup 类及相关功能 | P0 |
| T3.2 | 移植 MbsFrame/MbsMarker 类 | P0 |
| T3.3 | 移植关节类（7种关节类型） | P0 |
| T3.4 | 移植驱动类 | P1 |
| T3.5 | 实现 Embind 绑定 | P0 |

### 7.4 阶段四：前端开发

| 任务 | 描述 | 优先级 |
|------|------|--------|
| T4.1 | 实现 Three.js 渲染器 | P0 |
| T4.2 | 实现模型选择和高亮 | P0 |
| T4.3 | 实现标架可视化 | P0 |
| T4.4 | 实现关节可视化 | P1 |
| T4.5 | 实现 UI 面板（模型树、属性面板） | P1 |

### 7.5 阶段五：拓扑图功能

| 任务 | 描述 | 优先级 |
|------|------|--------|
| T5.1 | 集成 MxGraph 或 @maxgraph/core | P1 |
| T5.2 | 实现多体动力学拓扑图生成 | P1 |
| T5.3 | 实现拓扑图与 3D 视图的联动 | P2 |

### 7.6 阶段六：导出功能

| 任务 | 描述 | 优先级 |
|------|------|--------|
| T6.1 | 实现 Modelica 代码生成 | P1 |
| T6.2 | 实现项目文件保存/加载 | P1 |

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| WASM 文件体积过大 | 加载慢，用户体验差 | 1. 精简 OCCT 模块 2. 使用代码分割 3. 启用压缩 |
| OCCT WASM 编译失败 | 项目无法进行 | 参考 chili3d 的编译配置，使用已验证的版本 |
| 性能不足 | 大模型卡顿 | 1. 使用 Web Worker 2. 实现 LOD 3. 优化网格化参数 |
| 内存泄漏 | 长时间使用崩溃 | 1. 严格管理 C++ 对象生命周期 2. 使用智能指针 |

## 9. 参考资源

- [chili3d GitHub](https://github.com/xiangechen/chili3d) - 主要参考项目
- [opencascade.js](https://github.com/donalffons/opencascade.js) - OCCT WASM 编译参考
- [Emscripten 文档](https://emscripten.org/docs/) - WASM 编译工具
- [three.js 文档](https://threejs.org/docs/) - 三维渲染
- [VSCode Extension API](https://code.visualstudio.com/api) - 插件开发