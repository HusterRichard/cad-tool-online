# CadToolOnline 技术架构分析（2026-03-07）

## 总体判断
这是一个“VSCode 扩展宿主 + Webview 厚前端 + OCCT WASM 几何内核”的本地 CAD/MBS 插件架构，不是传统前后端分离 Web 系统。

## 分层架构
- 扩展层（Node 进程）：负责命令注册、文件对话框、读写本地文件、Webview 生命周期。`src/extension.ts` `src/panels/CadEditorPanel.ts`
- Webview 应用层（浏览器上下文）：承担主要业务流程（STEP 导入、树/属性面板、MBS 操作、导入导出、渲染配置）。`src/webview/main.ts`
- 渲染层：`ThreeViewer` 封装 Three.js（网格/选中/边线/后处理/关节与坐标系可视化）。`packages/three/src/ThreeViewer.ts`
- 几何层：`OcctWrapper` 动态加载 `cad-geo.wasm`，提供 STEP 解析、批量网格、边线、质量属性、面法向计算。`packages/geo/src/OcctWrapper.ts`
- 领域模型层：`core` 提供 MBS 基础类型与模型浏览树构建，但 Webview 里又维护了一套运行时实体（存在重复建模）。`packages/core/src/*` `src/webview/main.ts`
- 语言能力层：JSON/JSONC 诊断、补全、QuickFix，以及 Modelica 侧引用补全索引。`src/language/*`

## 关键调用链
- STEP 导入：扩展读取本地文件字节并 `postMessage` 给 Webview，Webview 调 OCCT 批量网格化后喂给 ThreeViewer。
- 渲染精度切换：Webview 改 preset 后触发 remesh（批量 `getMeshes` + `getBrepEdges`）。
- 配置导入导出：数据在 Webview 组装/解析，扩展层仅负责文件选择与保存。

## 技术栈与构建
- Monorepo：`pnpm workspace` 管理 `core/geo/three/ui`。
- 扩展打包：`esbuild`；Webview 打包：`vite`；WASM 构建：`cmake+emscripten`。
- Vite 构建后复制 `cad-geo.js/.wasm/.d.ts` 到 `dist/wasm` 供 Webview 加载。

## 架构现状与风险点
- Webview 过重：`main.ts` 约 3892 行、`CadEditorPanel.ts` 约 1703 行，UI/状态/业务/协议耦合高。
- 设计文档与实现不一致：架构文档写 React，但当前实现是原生 DOM/TS。
- `ui` 包能力未充分接入：扩展侧只用了 `generateCssVariables`，面板组件未在主链使用。
- 消息通道存在“半废弃路径”：Webview 发 `selectShape`，扩展用 `_loadedShapes.get` 处理，但未看到 `_loadedShapes.set` 路径。
- 测试分层不清：`geo` 包测试直接引用 `src/webview` 代码，包边界被穿透。

## 建议下一步（可选）
1. 拆分 `main.ts` 为 `import-flow / mbs-domain / ui-render / message-bus` 四个模块。
2. 明确 `core` 与 Webview 运行时实体的单一真相（SSOT），消除重复建模。
3. 清理消息协议，移除无效命令链路并补充类型约束。
4. 把跨包测试依赖从 `geo -> webview` 调整为共享公共模块。
