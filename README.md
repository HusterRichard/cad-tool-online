# CadToolOnline

基于 Web 技术的在线 CAD 工具，专注于多体动力学（MBS）设计与仿真。作为 VSCode 插件运行，提供 STEP 文件导入、3D 可视化、刚体组定义、运动副创建等功能。

## 项目特性

- **STEP 文件导入**: 基于 OpenCASCADE WASM 实现浏览器端 STEP 文件解析
- **3D 可视化**: 使用 Three.js 进行高性能 3D 渲染
- **多体动力学建模**: 支持刚体组、运动副、驱动等 MBS 元素定义
- **VSCode 集成**: 作为 VSCode 插件运行，与 Modelica 开发环境无缝集成

## 项目结构

```
CadToolOnline/
├── packages/
│   ├── core/                 # 核心数据模型和类型定义
│   ├── geo/                  # 几何计算模块 (OCCT WASM)
│   ├── three/                # Three.js 渲染模块
│   ├── ui/                   # UI 组件
│   └── vscode/               # VSCode 插件入口
├── scripts/                  # 构建脚本
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

## 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- VSCode >= 1.85.0

### WASM 编译（可选）

如需重新编译 OCCT WASM 模块：
- Emscripten SDK (emsdk)
- CMake >= 3.20

## 快速开始

### 1. 安装依赖

```bash
# 安装 pnpm（如未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 2. 构建项目

```bash
# 构建所有模块
pnpm build

# 或单独构建某个模块
pnpm --filter @cadtool-online/core build
```

### 3. 开发模式

```bash
# 启动所有模块的监听模式
pnpm dev
```

### 4. 代码检查与格式化

```bash
# ESLint 检查
pnpm lint

# Prettier 格式化
pnpm format
```

### 5. 调试插件

1. 在 VSCode 中打开本项目
2. 按 `F5` 启动调试（或点击"运行和调试"面板中的"Run Extension"）
3. 将自动打开一个新的 VSCode 窗口（Extension Development Host）
4. 在新窗口中按 `Ctrl+Shift+P`，输入 `CadToolOnline: Open CAD Editor` 启动插件

### 6. 打包 VSIX

```bash
pnpm --filter cadtool-online package
```

打包完成后，将在 `packages/vscode/` 目录生成 `cadtool-online-x.x.x.vsix` 文件。

安装 VSIX 文件：
- 方式一：在 VSCode 中按 `Ctrl+Shift+P`，输入 `Extensions: Install from VSIX...`，选择生成的 .vsix 文件
- 方式二：命令行执行 `code --install-extension cadtool-online-x.x.x.vsix`

## WASM 模块编译

几何计算模块使用 OpenCASCADE 编译为 WebAssembly。

### 1. 安装 Emscripten

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh  # Windows: emsdk_env.bat
```

### 2. 安装 WASM 依赖

```bash
pnpm run setup:wasm-deps
```

### 3. 编译 WASM

```bash
cd packages/geo/cpp

# Linux/macOS
./build_wasm.sh

# Windows
build_wasm.bat
```

编译产物将输出到 `packages/geo/wasm/` 目录。

## VSCode 插件使用

1. 在 VSCode 中打开项目
2. 按 `F5` 启动调试
3. 在新窗口中按 `Ctrl+Shift+P`，输入 `CadToolOnline: Open CAD Editor`

## 模块说明

### core

核心数据模型，包含：
- `MbsGroup`: 刚体组定义
- `MbsFrame` / `MbsMarker`: 坐标系和标记点
- `MbsJoint`: 运动副（转动副、移动副、圆柱副等）
- `MbsMotion`: 驱动定义

### geo

几何计算模块，封装 OpenCASCADE WASM：
- STEP 文件读取
- 网格生成（三角化）
- 质量属性计算（质量、质心、惯性矩阵）

### three

Three.js 渲染模块：
- 3D 场景管理
- 网格渲染
- 相机控制（OrbitControls）

### ui

UI 组件：
- 模型树面板
- 属性面板
- 工具栏

### vscode

VSCode 插件：
- WebView 面板管理
- 与 VSCode API 交互
- 文件系统访问

## 技术栈

- **语言**: TypeScript
- **构建工具**: Vite, tsc
- **包管理**: pnpm (monorepo)
- **3D 渲染**: Three.js
- **几何内核**: OpenCASCADE (WASM)
- **IDE 集成**: VSCode Extension API

## 开发路线

- [x] 阶段一：基础设施搭建
- [ ] 阶段二：OCCT WASM 编译与集成
- [ ] 阶段三：核心功能实现
- [ ] 阶段四：VSCode 插件完善
- [ ] 阶段五：测试与优化

## 许可证

内部项目，仅供内部使用。

## 相关项目

- [chili3d](https://github.com/nicholasdavies/chili3d) - 参考项目
- [OpenCASCADE](https://www.opencascade.com/) - 几何内核
- [Three.js](https://threejs.org/) - 3D 渲染库
