# SC36 PLAN: 生成 Modelica 模型

## 1. 文档信息

- 场景 ID: `SC36`
- 场景名称: 生成 Modelica 模型
- 日期: `2026-05-08`
- 项目: `CadToolOnline`

## 2. 目标摘要

将当前 `接受并退出` 从“导出 `cadtool.config.json`”改为 `SC36` 导出闭环：

- 输入模型包名
- 创建模型包目录
- 创建 `Visualizers`
- 导出每个分组的图片和 `dxf`
- 生成 `mb.json`

## 3. 现状摘要

### 3.1 已有基础

- `src/webview/main.ts`
  - 已有 `exportModel()` 和 `exportCadtoolConfig()` 两套导出入口
  - 已有分组、标架、连接、驱动的数据状态
  - 已有分组质量聚合基础
  - 已有 `shape.meshData / shape.edgeData`
- `src/panels/CadEditorPanel.ts`
  - 已具备从 webview 收消息并在本地文件系统写文件的能力
- `packages/core`
  - 已具备质量聚合逻辑

### 3.2 当前缺口

- `btn-accept-exit` 仍然只触发 `exportCadtoolConfig()`
- 没有包名输入框
- 没有模型包目录 / `Visualizers` 目录创建
- 没有 `mb.json` 专用契约
- 没有分组图片与 `dxf` 导出

## 4. 技术方案

### 4.1 导出数据分层

1. `packages/core/src/modelicaExport.ts`
   - 提供 `mb.json` 纯函数构建器
   - 提供 `dxf` 文本构建器
2. `src/webview/main.ts`
   - 汇总当前设计状态
   - 聚合分组质量与惯量
   - 生成分组截图
   - 生成分组 `dxf`
   - 发送 `exportModelicaPackage` 消息
3. `src/panels/CadEditorPanel.ts`
   - 接收导出请求
   - 弹出包名输入框
   - 创建目录并落盘 `mb.json` 与资源文件

### 4.2 `mb.json` 顶层结构

```json
{
  "packageName": "<PackageName>",
  "group": [],
  "marker": [],
  "connector": [],
  "motion": []
}
```

### 4.3 分组图片方案

- 以分组递归包含的零件集合为截图对象
- 临时隐藏其他零件
- `fitToView()`
- 从当前三维 canvas 导出 PNG 数据
- 恢复原可见性

### 4.4 分组 DXF 方案

- 复用当前 `shape.edgeData`
- 将边线段转换为基础 DXF `LINE` 实体
- 每个分组输出一个 `.dxf`

### 4.5 包名与路径安全

- 包名按 `sanitizeGroupName()` 规整
- 资源文件统一使用相对路径
- extension 侧校验相对路径不得逃逸模型包目录

## 5. 实施阶段

### Phase 1: 纯函数导出契约

- 新增 `modelicaExport.ts`
- 新增 core 单测

完成定义:

- `mb.json` 和 `dxf` 纯函数测试通过

### Phase 2: webview 导出请求

- 新增 `exportModelicaPackage()`
- 汇总 `group / marker / connector / motion`
- 生成分组图片与 `dxf`
- 修改 `btn-accept-exit`

完成定义:

- webview 可发出完整 `SC36` 导出载荷

### Phase 3: extension 落盘

- 新增 `exportModelicaPackage` 消息处理
- 输入模型包名
- 创建目录并写文件
- 成功后关闭面板

完成定义:

- 工作区根目录可见包目录、`Visualizers`、`mb.json`

### Phase 4: 文档与追踪

- 新增 `SC36 PRD / PLAN / QA`
- 更新全局追踪表

完成定义:

- 文档与实现边界一致

## 6. 风险与应对

### 6.1 风险：WebGL 截图不稳定

- 说明：部分环境下 `toDataURL()` 可能因渲染时机返回空图
- 应对：
  - 导出前显式 `fitToView()`
  - 等待渲染帧后再截图
  - 使用最小占位 PNG 作为兜底，保证目录结构完整

### 6.2 风险：DXF 语义过于基础

- 说明：当前仅能稳定导出边线段，无法表达更复杂的 CAD 标注语义
- 应对：
  - 在 PRD / QA 中明确 MVP 边界
  - 后续如需要再引入更完整的 OCCT 导出器

### 6.3 风险：帮助页期望与 MVP 存在差距

- 说明：帮助页目标态包含完整 Modelica 工程生成与快速预览
- 应对：
  - 在 PRD、追踪表中明确标记为 `部分落地`
  - 先交付目录和数据导出闭环

## 7. 完成定义

- `packages/core/test/modelica-export.spec.ts` 通过
- `tests/unit/extension/cad-editor-panel.spec.ts` 通过
- `pnpm build:webview` 通过
- `pnpm build:extension` 通过
- `SC36` 文档与追踪表已同步

## 8. 验证命令

```powershell
pnpm --filter @cadtool-online/core test:run -- modelica-export.spec.ts
pnpm test:root:run -- cad-editor-panel.spec.ts
pnpm build:webview
pnpm build:extension
```

## 9. 结论

`SC36` 的最小可行实现应优先保证“接受并退出”真的能把多体设计信息落成目录与文件，而不是继续停留在入口按钮或通用配置导出阶段。当前方案在不引入新后端与不改动整体架构的前提下，可以形成可测试、可交付的 MVP 闭环。
