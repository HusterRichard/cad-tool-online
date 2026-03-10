# 标架及参考标架开发计划

日期: 2026-03-09
对应 PRD: `docs/outputs/MARKER_REF_FRAME_PRD_2026-03-09.md`

## 1. 目标

按帮助文档补齐在线版“添加标架及参考标架”闭环，实现可创建、可查看、可编辑、可保存、可恢复。

## 2. 拆分策略

### 阶段 A: 核心规则

目标:
- 抽离参考标架创建校验与宿主解析规则。
- 为同顶层组限制、宿主解析提供可单测的纯函数。

输出:
- `packages/core` 新增标架设计规则模块。
- 补充对应单元测试。

### 阶段 B: 渲染与选择基础设施

目标:
- 三维视图中的标架对象可被选择。
- 支持每个标架独立图标大小与可见性。

输出:
- `packages/three` 扩展 `FrameData`。
- `ThreeViewer` 注册/注销 frame 为可选对象。

### 阶段 C: Webview 状态机

目标:
- 重构标架/参考标架创建流程。
- 区分闪电模式与标准模式。
- 支持标架草稿与参考标架待创建状态。

输出:
- 创建状态、草稿状态、编辑意图状态。
- `标架` 与 `参考标架` 面板渲染器。

### 阶段 D: 模型树与属性面板

目标:
- 在宿主节点下显示标架/参考标架。
- 选中联动三维视图。
- 属性面板支持基本标架编辑、参考标架只读查看。

输出:
- 新的树节点 kind。
- 新的属性面板渲染与事件绑定。

### 阶段 E: 持久化与验证

目标:
- 导入导出补充 `size`、`visible`。
- 跑通 core 测试、webview 构建。

输出:
- 回归测试。
- 构建通过。

## 3. 任务清单

1. 新增 `packages/core/src/markerDesign.ts`，实现：
   - 宿主类型识别
   - 顶层组解析
   - 参考标架创建校验
2. 新增 `packages/core/test/marker-design.spec.ts`。
3. 扩展 `packages/core/src/model/MbsFrame.ts`，补 `visible` 能力。
4. 扩展 `packages/three/src/FrameVisualizer.ts` 与 `packages/three/src/ThreeViewer.ts`：
   - `FrameData.size`
   - `FrameData.visible`
   - frame 注册为可选对象
5. 在 `src/webview/main.ts` 引入新的选择 key:
   - `marker`
   - `refFrame`
6. 在 `src/webview/main.ts` 新增标架 UI 状态：
   - 创建模式
   - 草稿标架
   - 待创建参考标架
   - 编辑意图
7. 重写 `startMarkerCreation` 与 `startRefFrameCreation` 的面板渲染和交互。
8. 将参考标架创建改为“基本标架 + 目标零件”驱动，不再依赖面拾取放置。
9. 扩展模型树节点生成逻辑，挂载标架/参考标架节点。
10. 扩展属性面板，支持标架编辑和参考标架只读展示。
11. 扩展导入导出 schema，补齐 `size`、`visible`。
12. 执行测试与构建，修正编译或行为问题。

## 4. 测试计划

### 4.1 单元测试

- `packages/core/test/marker-design.spec.ts`
  - 目标零件未分组时，正确回退到零件宿主
  - 基本标架与目标零件同顶层组时，禁止创建参考标架
  - 跨顶层组时允许创建参考标架

### 4.2 构建验证

- `pnpm --filter @cadtool-online/core test:run -- marker-design.spec.ts`
- `pnpm --filter @cadtool-online/core test:run`
- `pnpm build:webview`
- 必要时 `pnpm build:extension`

### 4.3 手工回归

1. 导入 STEP。
2. 选中零件后点击 `标架`，在闪电模式创建 2 个基本标架。
3. 切换到标准模式，创建 1 个基本标架。
4. 在模型树选中基本标架，修改名称、大小、可见性、位置、方向。
5. 点击 `参考标架`，选择基本标架和目标零件创建参考标架。
6. 验证同顶层组限制提示。
7. 保存配置后重新打开，验证标架与参考标架恢复。

## 5. 完成定义

满足以下条件才算完成：
- PRD 范围内功能全部落地。
- core 规则有自动化测试覆盖。
- webview 能正常构建。
- 不破坏现有分组、设计点、连接、驱动的基础流程。
