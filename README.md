# CadToolOnline

> 基于 Web 技术的在线 CAD 多体动力学建模工具

[![License](https://img.shields.io/badge/license-Internal-blue.svg)](LICENSE)
[![VSCode](https://img.shields.io/badge/VSCode-≥1.85.0-blue.svg)](https://code.visualstudio.com/)
[![Node.js](https://img.shields.io/badge/Node.js-≥20.0.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

CadToolOnline 是一个运行在 VSCode 中的在线 CAD 工具，专注于多体动力学（MBS）系统的设计与建模。通过 WebAssembly 技术将 OpenCASCADE 几何内核移植到浏览器，实现了无服务器依赖的 STEP 文件导入、3D 可视化、刚体组定义、运动副创建等功能，并支持导出为 Modelica 仿真代码。

---

## 📚 项目文档

- **[结项报告](report/01-final-report.md)** - 项目概述、技术架构、核心功能、进度规划
- **[架构设计](report/02-architecture.md)** - 详细的系统架构和模块设计
- **[演示材料](demo/)** - 演示视频和截图
- **[Prompt 记录](prompts/prompts.md)** - AI 辅助开发的 Prompt 汇总
- **[API 设计](ai-artifacts/design/api-design.md)** - API 接口文档
- **[需求分析](ai-artifacts/design/requirements.md)** - 功能需求和验收标准

---

## ✨ 项目特性

- 🎯 **STEP 文件导入**: 基于 OpenCASCADE WASM 实现浏览器端 STEP 文件解析
- 🎨 **3D 可视化**: 使用 Three.js 进行高性能 3D 渲染
- 🔧 **多体动力学建模**: 支持刚体组、运动副（7种类型）、驱动等 MBS 元素定义
- 🔌 **VSCode 集成**: 作为 VSCode 插件运行，与 Modelica 开发环境无缝集成
- 🌐 **跨平台**: 支持 Windows、macOS、Linux 三大平台
- ⚡ **高性能**: WebAssembly 实现几何计算，接近原生性能

---

## 📁 项目结构

```
CadToolOnline/
├── README.md                    # 项目说明文档
├── report/                      # 报告目录
│   ├── 01-final-report.md      # 结项报告
│   └── 02-architecture.md      # 架构设计文档
├── packages/                    # 源代码目录（模块化）
│   ├── core/                   # 核心数据模型和类型定义
│   ├── geo/                    # 几何计算模块 (OCCT WASM)
│   ├── three/                  # Three.js 渲染模块
│   ├── ui/                     # UI 组件
│   └── vscode/                 # VSCode 插件入口
├── scripts/                     # 脚本目录
│   ├── run.sh / run.bat        # 一键运行脚本
│   ├── test.sh / test.bat      # 测试脚本
│   ├── requirements.txt        # 依赖说明
│   └── setup_wasm_deps.mjs     # WASM 依赖安装
├── demo/                        # 演示材料
│   ├── demo.mp4                # 演示视频（待录制）
│   └── screenshots/            # 截图目录
├── prompts/                     # Prompt 记录
│   └── prompts.md              # Prompt 汇总及迭代记录
├── ai-artifacts/                # AI 产物目录
│   ├── design/                 # 设计文档
│   └── outputs/                # AI 输出结果示例
├── tests/                       # 测试代码
│   ├── unit/                   # 单元测试
│   ├── integration/            # 集成测试
│   └── fixtures/               # 测试数据
├── data/                        # 样例数据
│   ├── step-files/             # 示例 STEP 文件
│   └── modelica-examples/      # Modelica 代码示例
├── .env.example                 # 环境变量示例
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

---

## 🚀 快速开始

### 方式一：一键运行（推荐）

```bash
# Linux/macOS
./scripts/run.sh

# Windows
scripts\run.bat
```

一键脚本会自动完成：依赖安装 → WASM 检查 → 项目构建 → 准备调试

### 方式二：手动运行

#### 1. 环境要求

**必需环境**:
- Node.js >= 20.0.0
- pnpm >= 8.0.0
- VSCode >= 1.85.0

**可选环境**（仅用于 WASM 编译）:
- CMake >= 3.30
- Ninja 构建系统
- Git

详见 [scripts/requirements.txt](scripts/requirements.txt)

#### 2. 安装依赖

```bash
# 安装 pnpm（如未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

#### 3. 构建项目

```bash
# 全量构建（WASM + TypeScript，首次构建或 WASM 有变更时使用）
pnpm build:all

# 仅构建 TypeScript 模块（WASM 无变更时使用）
pnpm build

# 或单独构建某个模块
pnpm --filter @cadtool-online/core build
```

#### 4. 调试插件

1. 在 VSCode 中打开本项目
2. 按 `F5` 启动调试（或点击"运行和调试"面板中的"Run Extension"）
3. 将自动打开一个新的 VSCode 窗口（Extension Development Host）
4. 在新窗口中按 `Ctrl+Shift+P`，输入 `CadToolOnline: Open CAD Editor` 启动插件

#### 5. 开发模式

```bash
# 启动所有模块的监听模式
pnpm dev
```

---

## 🧪 测试

### 运行测试

```bash
# 使用测试脚本（推荐）
./scripts/test.sh             # Linux/macOS
scripts\test.bat              # Windows

# 或使用 pnpm
pnpm test                     # 运行所有测试
pnpm test:coverage            # 生成覆盖率报告
```

### 测试覆盖率要求

| 模块 | 目标覆盖率 |
|------|------------|
| Core | >80% |
| Geo | >80% |
| Three | >60% |
| UI | >60% |

详见 [tests/README.md](tests/README.md)

---

## 📦 打包与发布

### 打包 VSIX

```bash
pnpm --filter cadtool-online package
```

打包完成后，将在 `packages/vscode/` 目录生成 `cadtool-online-x.x.x.vsix` 文件。

### 安装 VSIX

- **方式一**: 在 VSCode 中按 `Ctrl+Shift+P`，输入 `Extensions: Install from VSIX...`，选择生成的 .vsix 文件
- **方式二**: 命令行执行 `code --install-extension cadtool-online-x.x.x.vsix`

---

## 🔧 高级配置

### 环境变量

复制 `.env.example` 为 `.env` 并根据需要修改配置：

```bash
cp .env.example .env
```

主要配置项：
- `MAX_STEP_FILE_SIZE` - STEP 文件最大大小（默认 100MB）
- `LOG_LEVEL` - 日志级别（debug/info/warn/error）
- `ENABLE_PERFORMANCE_MONITORING` - 性能监控开关

详见 [.env.example](.env.example)

### 代码检查与格式化

```bash
# ESLint 检查
pnpm lint

# Prettier 格式化
pnpm format
```

---

## 🏗️ WASM 模块编译（可选）

几何计算模块使用 OpenCASCADE V8_0_0_rc3 编译为 WebAssembly。

### 安装 WASM 依赖

```bash
pnpm setup:wasm
```

此命令会自动：
1. 克隆 Emscripten SDK (v4.0.8)
2. 克隆 OCCT V8_0_0_rc3 源码
3. 安装并激活 Emscripten

### 编译 WASM

```bash
# Release 构建（推荐）
pnpm build:wasm

# Debug 构建
pnpm build:wasm:debug
```

编译产物输出到 `packages/geo/wasm/` 目录。详见 [架构设计文档](report/02-architecture.md)

---

## 📦 模块说明

### packages/core

核心数据模型，包含：
- `MbsGroup`: 刚体组定义
- `MbsFrame` / `MbsMarker`: 坐标系和标记点
- `MbsJoint`: 运动副（转动副、移动副、圆柱副等）
- `MbsMotion`: 驱动定义

### packages/geo

几何计算模块，封装 OpenCASCADE WASM：
- STEP 文件读取
- 网格生成（三角化）
- 质量属性计算（质量、质心、惯性矩阵）

### packages/three

Three.js 渲染模块：
- 3D 场景管理
- 网格渲染
- 相机控制（OrbitControls）

### packages/ui

UI 组件：
- 模型树面板
- 属性面板
- 工具栏

### packages/vscode

VSCode 插件：
- WebView 面板管理
- 与 VSCode API 交互
- 文件系统访问

---

## 🛠️ 技术栈

| 层次 | 技术 | 版本 |
|------|------|------|
| 开发语言 | TypeScript | 5.3.3 |
| 几何内核 | OpenCASCADE (WASM) | V8_0_0_rc3 |
| 3D 渲染 | Three.js | 0.170.0 |
| 构建工具 | Vite | 5.0.0 |
| 包管理 | pnpm (monorepo) | >= 8.0.0 |
| IDE 集成 | VSCode Extension API | >= 1.85.0 |
| 编译工具 | Emscripten | 4.0.8 |

---

## 🎯 开发路线

- [x] **阶段一：基础设施搭建**
  - [x] Monorepo 架构
  - [x] TypeScript 配置
  - [x] 代码规范（ESLint + Prettier）

- [x] **阶段二：OCCT WASM 编译与集成**
  - [x] WASM 编译环境搭建
  - [x] STEP 文件导入
  - [x] 网格生成

- [ ] **阶段三：核心功能实现**
  - [x] 刚体组建模
  - [ ] 运动副定义（7种类型）
  - [ ] 质量属性计算
  - [ ] Modelica 导出

- [ ] **阶段四：VSCode 插件完善**
  - [x] WebView 面板
  - [x] Ribbon 菜单
  - [ ] 命令面板集成
  - [ ] 配置管理

- [ ] **阶段五：测试与优化**
  - [ ] 单元测试覆盖率 >80%
  - [ ] 集成测试
  - [ ] 性能优化
  - [ ] 文档完善

---

## 🎬 演示材料

- **演示视频**: [demo/demo.mp4](demo/demo.mp4) - 待录制
- **截图**: [demo/screenshots/](demo/screenshots/) - 至少 5 张关键功能截图

详见 [demo/README.md](demo/README.md)

---

## 🤖 AI 辅助开发

本项目使用 Claude AI 辅助开发，关键 Prompt 记录在 [prompts/prompts.md](prompts/prompts.md)。

AI 生成的设计文档和产物存放在 [ai-artifacts/](ai-artifacts/) 目录。

---

## 📊 项目统计

| 指标 | 数值 |
|------|------|
| 代码行数 | ~10,000+ |
| 模块数量 | 5 个 |
| 依赖包数量 | ~50 |
| WASM 体积 | ~15MB |
| 支持的运动副类型 | 7 种 |

---

## 🔗 相关链接

### 参考项目
- [chili3d](https://github.com/xiangechen/chili3d) - OCCT WASM 编译参考
- [CADToolbox](../CADToolbox) - 原桌面版项目

### 技术文档
- [OpenCASCADE](https://www.opencascade.com/) - 几何内核官网
- [Three.js](https://threejs.org/) - 3D 渲染库
- [VSCode Extension API](https://code.visualstudio.com/api) - 插件开发文档
- [Emscripten](https://emscripten.org/) - WebAssembly 编译工具

### 行业标准
- [STEP 文件格式](https://en.wikipedia.org/wiki/ISO_10303) - ISO 10303
- [Modelica Language](https://modelica.org/) - 仿真建模语言

---

## 📄 许可证

内部项目，仅供内部使用。

---

## 👥 贡献指南

详见项目文档：
- [编码规范](.claude/rules/coding-style.md)
- [Git 工作流](.claude/rules/git-workflow.md)
- [安全规则](.claude/rules/security.md)
- [测试规则](.claude/rules/testing.md)

---

## 📮 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue（内部 GitLab）
- 项目负责人：[待填写]

---

**最后更新**: 2026-02-06
