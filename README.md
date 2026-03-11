# CadToolOnline

> 面向多体动力学（MBS）建模场景的 VSCode CAD 插件：在本地完成 STEP 导入、3D 可视化与基础建模操作。

[![VSCode](https://img.shields.io/badge/VSCode-%5E1.80.0-blue.svg)](https://code.visualstudio.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

## 产品介绍

CadToolOnline 是一个运行在 VSCode 内的 CAD 工具，目标是将桌面端 CADToolbox 的核心能力迁移到 Web 技术栈，支持工程人员在统一开发环境中进行几何查看与多体系统建模。

核心价值：
- 降低环境门槛：基于 VSCode 插件形态，避免重型本地 GUI 应用部署。
- 提升协作效率：代码、模型、脚本、仿真准备工作在一个工作区完成。
- 兼顾性能与可移植：通过 WebAssembly 复用 OpenCASCADE 几何能力。

## 当前能力

- STEP 文件导入与层级读取（`packages/geo` + OCCT WASM）
- Three.js 3D 场景展示与交互（`packages/three`）
- 标架/参考标架的智能 hover 吸附与辅助线预览（圆线圆心、柱面轴线）
- 基础 MBS 数据结构（Group/Frame/Marker/Joint/Motion，位于 `packages/core`）
- VSCode 命令入口与 Webview 编辑面板（`src/extension.ts`、`src/webview/main.ts`）
- 零件颜色读取与应用（含颜色工具函数与测试）

## 适用与边界

适用场景：
- MBS 前处理
- STEP 模型浏览与结构检查
- 在 VSCode 中联动进行模型与代码开发

当前边界（进行中）：
- 完整关节类型与约束编辑体验仍在完善
- Modelica 导出能力处于持续开发阶段
- 大模型文件性能优化仍有提升空间

## 快速开始

### 1. 环境要求

- Node.js >= 18
- pnpm >= 8
- VSCode >= 1.80

### 2. 安装依赖

```bash
pnpm install
```

### 3. 构建

```bash
# 常规构建（TS/包）
pnpm build

# 全量构建（含 WASM）
pnpm build:all
```

### 4. 启动调试

1. 用 VSCode 打开本仓库。
2. 按 `F5` 启动 Extension Development Host。
3. 在新窗口执行命令 `Open CAD Editor`（命令 ID: `cadtool-online.openEditor`）。

## 常用命令

```bash
pnpm dev               # 多包并行开发
pnpm lint              # 代码检查
pnpm format            # 代码格式化
pnpm build:extension   # 构建 VSCode Extension 入口
pnpm build:webview     # 构建 Webview
pnpm package           # 生成 VSIX 包
pnpm setup:git-rules   # 安装提交规则与 commit 模板
```

## 提交规范

首次克隆仓库后执行一次：

```bash
pnpm setup:git-rules
```

该命令会为当前仓库配置：

- `core.hooksPath=.githooks`
- `commit.template=.gitmessage.txt`
- 提交流程默认遵循 `.claude/rules/git-workflow.md`

提交标题格式统一为：

```text
<type>: <task id><简要描述>
```

完整规范见 [.claude/rules/git-workflow.md](.claude/rules/git-workflow.md)。

## WASM 构建（可选）

仅在需要重新编译几何内核时使用：

```bash
pnpm setup:wasm
pnpm build:wasm
# 或 Debug
pnpm build:wasm:debug
```

产物位置：`packages/geo/wasm/`。

## 项目结构

```text
CadToolOnline/
├─ packages/
│  ├─ core/      # MBS 领域模型与类型
│  ├─ geo/       # OpenCASCADE WASM 封装、STEP 读取、颜色工具
│  ├─ three/     # Three.js 可视化
│  └─ ui/        # UI 组件
├─ src/
│  ├─ extension.ts          # VSCode 扩展入口
│  ├─ panels/               # Webview 面板管理
│  └─ webview/main.ts       # 前端入口
├─ scripts/                 # run/test/setup 脚本
├─ tests/                   # 测试说明与夹具
├─ report/                  # 结项与架构文档
└─ ai-artifacts/            # 设计与实现过程文档
```

## 文档导航

- [结项报告](report/01-final-report.md)
- [架构设计](report/02-architecture.md)
- [快速上手（颜色功能）](QUICK_START.md)
- [颜色功能总览](README_COLOR_FEATURE.md)
- [测试说明](tests/README.md)

## 相关项目与技术

- [CADToolbox](../CADToolbox)
- [OpenCASCADE](https://www.opencascade.com/)
- [Three.js](https://threejs.org/)
- [VSCode Extension API](https://code.visualstudio.com/api)
- [Emscripten](https://emscripten.org/)

## 许可证

内部项目，仅供内部使用。
