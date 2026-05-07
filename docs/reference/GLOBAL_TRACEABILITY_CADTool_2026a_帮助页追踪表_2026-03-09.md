# CADTool 2026a 帮助页追踪表

日期：2026-03-09  
项目：CadToolOnline  
基线：`docs/reference/GLOBAL_INDEX_CADTool_2026a_帮助文档页面索引_2026-03-09.md`

状态定义：

- `已落地`：已有明确代码入口，且已有自动化测试或专项交付文档支撑
- `部分落地`：已有入口或局部实现，但未形成帮助页级闭环
- `入口级`：按钮、菜单或基础数据结构已存在，但缺少完整工作流
- `未开始`：尚未发现明确实现证据

## 1. 总览与导航

| 页面 | 工作包 | 状态 | 代码/文档证据 | 测试/QA 证据 | 备注 |
|---|---|---|---|---|---|
| `CADToolBox.html` | WP-BASE | 部分落地 | `src/extension.ts` 打开文档命令 | `QA_CASES_IMPORT_2026-03-05.csv` `CMD-003` | 主要是宿主入口 |
| `CADOverview.html` | WP-BASE | 部分落地 | `README.md`、`plan.md` | - | 需要补产品内概述入口 |
| `GettingStartedCADToolBox.html` | WP-BASE | 部分落地 | `plan.md` | - | 入门导航已纳入计划，未单独产品化 |
| `HowToUseCADToolBox.html` | WP-BASE | 部分落地 | `plan.md` | - | 作为主能力目录基线 |
| `FaqOverview.html` | WP-ERR | 未开始 | `docs/reference/GLOBAL_INDEX_CADTool_2026a_帮助文档页面索引_2026-03-09.md` | - | 仅文档索引层 |
| `ApplicationCases.html` | WP-CASE | 未开始 | `plan.md` | - | 案例验收尚未启动 |

## 2. 入门与官方案例

| 页面 | 工作包 | 状态 | 代码/文档证据 | 测试/QA 证据 | 备注 |
|---|---|---|---|---|---|
| `SimpleNewtonCradle.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |
| `SimpleTank.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |
| `SliderCrankMechanism.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |
| `Bulldozer.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |
| `DoubleSlider.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |
| `PickAndPlace.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |
| `Robot.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |
| `RobotGrabBall.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |
| `Tank.html` | WP-CASE | 未开始 | `plan.md` | - | 待建立案例脚本 |

## 3. 导入、浏览与视图

| 页面 | 工作包 | 状态 | 代码/文档证据 | 测试/QA 证据 | 备注 |
|---|---|---|---|---|---|
| `ToolBoxEntry.html` | WP-IMP | 部分落地 | `src/extension.ts`、`src/panels/CadEditorPanel.ts` | `CMD-001` `CMD-002` | 已有编辑器入口 |
| `ImportCAD.html` | WP-IMP | 部分落地 | `src/webview/main.ts` `loadStepFile` | `WV-002` `WV-003` | 中性格式链路可用，帮助页全量细节未对齐 |
| `ImportNeutralCAD.html` | WP-IMP | 部分落地 | `packages/geo` STEP 读取、`src/webview/main.ts` | `WV-003` | 以 STEP 为主 |
| `ImportCommercialCAD.html` | WP-IMP | 入口级 | `plan.md`、PRD 场景映射 | - | 商业 CAD 解析链路未工程化 |
| `ImportCustomCAD.html` | WP-IMP | 入口级 | `plan.md`、PRD 场景映射 | - | 仅预留规划 |
| `CommericalCADParserUse.html` | WP-IMP | 未开始 | `plan.md` | - | 无独立实现证据 |
| `ManageCADFiles.html` | WP-EXP | 入口级 | Ribbon 文件组、导入导出命令 | - | 尚未形成文件浏览器级闭环 |
| `ModelImport.html` | WP-EXP | 部分落地 | `importCadtoolConfig` | `CFG-003` | 配置导入可用 |
| `ModelExport.html` | WP-EXP | 部分落地 | `exportCadtoolConfig`、`exportModel` | `CFG-003` | 产物契约待细化 |
| `ModelTreeBrowser.html` | WP-IMP | 部分落地 | `buildModelBrowserTree`、`src/webview/main.ts` | `WV-004` `WV-005` `packages/core/test/model-browser.spec.ts` | 基础树和选中联动存在 |
| `MultibodyModelBrowser.html` | WP-MB | 部分落地 | 组节点树、上下文菜单、拖拽 | `SC13_PRD_对零件进行分组_2026-03-11.md` | 已支持 group 节点 |
| `FluidModelBrowser.html` | WP-FL | 入口级 | `fluidSlices` / `fluidPorts` 数据源 | - | 浏览器行为未闭环 |
| `ViewInteractions.html` | WP-IMP | 部分落地 | `ThreeViewer`、`src/webview/main.ts` | `WV-005` `WV-006` `WV-008` | 三维视图基本交互已落地 |
| `Measure.html` | WP-TOOL | 部分落地 | `measureTool` | `RIB-016` `RIB-017` | 基础测量已通 |
| `ProcessIntroduction.html` | WP-BASE | 部分落地 | `plan.md` | - | 流程说明已进入主计划，未形成产品页 |

## 4. 多体设计

| 页面 | 工作包 | 状态 | 代码/文档证据 | 测试/QA 证据 | 备注 |
|---|---|---|---|---|---|
| `MultiBodyDesign.html` | WP-MB | 部分落地 | Ribbon 多体命令组、`src/webview/main.ts` | `GLOBAL_QA_CASES_CadToolOnline_2026-03-05.md` 多体条目 | 功能已分散落地 |
| `GroupParts.html` | WP-MB | 已落地 | `packages/core/src/groupDesign.ts`、`src/webview/main.ts` | `packages/core/test/group-design.spec.ts`、`SC13_PRD_对零件进行分组_2026-03-11.md` | 当前完成度最高 |
| `BuildMarkers.html` | WP-MB | 部分落地 | `createFrame` / `createRefFrame` / `editFrame` / `deleteFrame` | `RIB-004` ~ `RIB-007` | 仍需按帮助页校对模式与属性流程 |
| `BuildDesignPoints.html` | WP-MB | 部分落地 | `createDesignPoint` | `SC13_PRD_对零件进行分组_2026-03-11.md`、QA 文档 | 已能创建并挂组 |
| `BuildConnectors.html` | WP-MB | 已落地 | `createJoint_*`、`src/webview/main.ts`、`packages/core/src/connectorDesign.ts`、`packages/three/src/ThreeViewer.ts`、`packages/three/src/JointVisualizer.ts`、`SC02_PRD/PLAN/QA` | `packages/three/test/JointVisualizer.spec.ts`、`packages/core/test/connector-design.spec.ts`、`test/sc02-connector-workflow.test.mjs`、`SC02_QA_添加连接_2026-03-11.md` | 已补 8 类连接独立 shape、白色草稿 / 浅蓝落地色态、`零件 1` 锚定、固定副通过三维空白处 / 模型树 `Ground` 直达大地固定、模型树 Ribbon 同款图标与连接名称分类编号；完整点/线/面规则矩阵、万向节双叉第二方向语义、红蓝双色高亮仍待帮助页级对齐 |
| `ModifyUnknownConnectors.html` | WP-MB | 未开始 | `plan.md` | - | 尚无明确实现证据 |
| `BuildMotions.html` | WP-MB | 部分落地 | `createMotion_*` | `RIB-011` `RIB-012` `RIB-013` | 已有基本驱动对象 |
| `BuildContacts.html` | WP-MB | 部分落地 | `src/panels/CadEditorPanel.ts`、`src/webview/main.ts`、`docs/prd/scenarios/SC01_PRD_添加接触_2026-03-11.md` | `tests/unit/extension/cad-editor-panel.spec.ts` `tests/unit/webview/contact-workflow-source.spec.ts` `docs/qa/plans/SC01_QA_添加接触_2026-03-11.md` | 已具备接触创建、属性、删除、导入导出与入口拦截；严格几何规则与运行级交互自动化仍待补齐 |
| `ObjectAttribute.html` | WP-MB | 部分落地 | Properties 面板、group aggregation | `SC13_PRD_对零件进行分组_2026-03-11.md` | group 属性较完整，其它对象待补齐 |
| `MaterialModify.html` | WP-MB | 入口级 | `selectedDensityByShapeId`、质量计算协调器 | `packages/core/test/mass-aggregation.spec.ts` | 用户工作流未形成 |
| `PlanarLoopConstraints.html` | WP-TOOL | 入口级 | `planarRingProcess` 入口 | `RIB-020` | 仅入口和提示 |

## 5. 流体设计

| 页面 | 工作包 | 状态 | 代码/文档证据 | 测试/QA 证据 | 备注 |
|---|---|---|---|---|---|
| `FluidDesign.html` | WP-FL | 部分落地 | Ribbon 流体入口、配置导入导出 | `RIB-014` `RIB-015` | 主工作流未完整对齐 |
| `SimpleTankSlice.html` | WP-FL | 入口级 | `fluidTankSlice` -> `FluidSliceEntity` | `RIB-014` | 只有基础创建 |
| `TankSlice.html` | WP-FL | 入口级 | `fluidTankSlice` | `RIB-014` | 复杂参数尚未对齐 |
| `RibSlice.html` | WP-FL | 入口级 | `fluidSlices` 数据结构 | `RIB-014` | 命名更接近 rib slice |
| `BuildFluidPorts.html` | WP-FL | 部分落地 | `fluidPort`、配置导入导出字段 | `RIB-015` | 端口对象基础已通 |
| `FluidObjectAttribute.html` | WP-FL | 入口级 | Properties 面板流体对象项 | - | 介质/重力仍为空实现 |
| `FluidModelBrowser.html` | WP-FL | 入口级 | `fluidSlices` / `fluidPorts` 映射 | - | 浏览器层未闭环 |

## 6. 设计工具与保存导出

| 页面 | 工作包 | 状态 | 代码/文档证据 | 测试/QA 证据 | 备注 |
|---|---|---|---|---|---|
| `DesignTool.html` | WP-TOOL | 部分落地 | Ribbon 工具组 | `RIB-016` ~ `RIB-020` | 已有入口矩阵 |
| `ExplodedView.html` | WP-TOOL | 部分落地 | `isExploded` / `explodeDistance` | `WV-009` `WV-010` | 爆炸视图可用 |
| `SurfaceThickening.html` | WP-TOOL | 部分落地 | `surfaceThicken` | `RIB-018` `RIB-019` | 只有目标选择与状态反馈 |
| `SaveModel.html` | WP-EXP | 入口级 | 文件组按钮、配置导入导出 | - | 自动保存/另存为/打开保存文件待闭环 |
| `ToModelicaModel.html` | WP-EXP | 未开始 | `plan.md` | - | 缺少生成与预览主链路 |

## 7. 迭代设计

| 页面 | 工作包 | 状态 | 代码/文档证据 | 测试/QA 证据 | 备注 |
|---|---|---|---|---|---|
| `IterativeDesign.html` | WP-ITR | 未开始 | `plan.md` | - | 尚无明确入口 |
| `PartiallyIterativeDesign.html` | WP-ITR | 未开始 | `plan.md` | - | 尚无明确入口 |
| `WhollyIterativeDesign.html` | WP-ITR | 未开始 | `plan.md` | - | 尚无明确入口 |

## 8. FAQ 与错误码

| 页面 | 工作包 | 状态 | 代码/文档证据 | 测试/QA 证据 | 备注 |
|---|---|---|---|---|---|
| `ErrorReference.html` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 本次新增统一错误码字典 |
| `Error1.html` `ERR_CAD_SOFTWARE_NOT_INSTALLED` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 字典已建立，触发场景待接入 |
| `Error2.html` `ERR_CAD_VERSION_TOO_LOW` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 同上 |
| `Error3.html` `ERR_OPEN_CAD_SOFTWARE_FAILED` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 同上 |
| `Error4.html` `ERR_OPEN_CAD_FILE_FAILED` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts`、`src/panels/CadEditorPanel.ts` | `packages/core/test/cadtool-errors.spec.ts` | 已接入部分文件读取失败场景 |
| `Error5.html` `CAD_FILE_IS_EMPTY` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 触发场景待接入 |
| `Error6.html` `PARSE_FILE_FAILED` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts`、`src/webview/main.ts` | `packages/core/test/cadtool-errors.spec.ts` | 已接入 STEP 载入失败和配置解析失败场景 |
| `Error7.html` `ERR_EXPORT_STEP_FAILED` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 触发场景待接入 |
| `Error8.html` `ERR_GENERATE_FILE_FAILED` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts`、`src/webview/main.ts`、`src/panels/CadEditorPanel.ts` | `packages/core/test/cadtool-errors.spec.ts` | 已接入导出失败场景 |
| `Error9.html` `ERR_RUNTIME` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 保留为兜底 |
| `Error10.html` `PARSER_PATH_INVALID` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 触发场景待接入 |
| `Error11.html` `ERR_CREATE_PROCESS_FAILED` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 触发场景待接入 |
| `Error12.html` `ERR_DATA_EXCHANGE_FAILED` | WP-ERR | 部分落地 | `packages/core/src/cadtoolErrors.ts` | `packages/core/test/cadtool-errors.spec.ts` | 触发场景待接入 |
| `faq_Animation.html` | WP-ERR | 未开始 | `plan.md` | - | 产品内帮助未接入 |
| `faq_GenerateMo.html` | WP-ERR | 未开始 | `plan.md` | - | 依赖 ToModelicaModel 能力 |
| `faq_ImportCAD.html` | WP-ERR | 部分落地 | 导入链路、QA 导入用例 | `WV-002` `WV-003` | 需要转成产品内排障提示 |
| `faq_Modeling.html` | WP-ERR | 未开始 | `plan.md` | - | 缺建模异常规则 |
| `faq_ReplicationOrMigration.html` | WP-ERR | 未开始 | `plan.md` | - | 缺工程复制与移植能力 |
| `faq_ViewInteractions.html` | WP-ERR | 部分落地 | 视图与选择基础链路 | `WV-005` `WV-006` `WV-009` `WV-010` | 黑屏、统一尺寸修改等 FAQ 未转产品行为 |

## 9. 当前结论

- 当前完成度最高的帮助页是 `GroupParts.html`。
- 当前最需要继续推进的帮助页簇是：
  - `BuildMarkers.html`
  - `BuildDesignPoints.html`
  - `BuildConnectors.html`
  - `BuildMotions.html`
  - `BuildFluidPorts.html`
  - `SaveModel.html`
  - `ToModelicaModel.html`
  - `ErrorReference.html`
- 当前缺口最大的区域是：
  - 迭代设计
  - 官方案例验收
  - FAQ 的产品内排障闭环
  - Webview 集成自动化回归
