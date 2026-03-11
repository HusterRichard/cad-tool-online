# CadToolOnline Development Plan（对齐 CADTool 2026a 帮助文档）

日期：2026-03-09  
项目：CadToolOnline

## 1. 计划基线

本计划以以下资料为基线，后续范围判断、优先级排序和验收口径统一以这些文档为准：

- `docs/outputs/GLOBAL_INDEX_CADTool_2026a_帮助文档页面索引_2026-03-09.md`
- `docs/outputs/GLOBAL_TRACEABILITY_CADTool_2026a_帮助页追踪表_2026-03-09.md`
- `docs/outputs/SC13_PLAN_对零件进行分组_2026-03-09.md`
- `docs/outputs/SC13_PRD_对零件进行分组_2026-03-11.md`
- 当前仓库代码、测试和 README

`GLOBAL_INDEX_CADTool_2026a_帮助文档页面索引_2026-03-09.md` 共索引 74 页，覆盖：

- 概述 / 新手入门 / 如何操作
- CAD 导入、模型浏览、三维视图、文件管理
- 多体设计
- 流体设计
- 设计工具
- 保存与导出
- 迭代设计
- FAQ / 错误码
- 官方案例与验收场景

结论：旧版 `plan.md` 主要按早期 PRD 粗粒度组织，且文件编码已损坏；新版计划改为“按官方帮助目录分层 + 按当前代码证据标记状态”的结构。

## 2. 总体目标

目标不是抽象地“做一个 CAD Webview”，而是按官方帮助文档中的核心工作流，逐步补齐 CadToolOnline 的在线能力闭环：

1. 完成 CAD 导入、浏览、选择、编辑、保存、导出、再导入的基本闭环。
2. 让多体设计对象与流体设计对象具备可创建、可编辑、可追踪、可导出的工程能力。
3. 将 FAQ、错误码、案例验收从“文档知识”落到“产品行为”。
4. 建立文档页到功能模块、测试、验收脚本之间的可追踪关系。

## 3. 按文档目录重组后的工作包

### WP-BASE 文档基线与导航

对应页面：

- `CADOverview.html`
- `GettingStartedCADToolBox.html`
- `HowToUseCADToolBox.html`
- `FaqOverview.html`
- `ApplicationCases.html`

交付目标：

- 建立“帮助页 -> 模块 -> 命令入口 -> 测试 -> 验收”追踪表
- 将帮助目录作为产品范围基线，而不是只跟随早期 PRD
- 为后续案例验收提供标准入口

当前状态：`进行中`

### WP-IMP 导入、浏览与三维交互

对应页面：

- `ToolBoxEntry.html`
- `ImportCAD.html`
- `ImportNeutralCAD.html`
- `ImportCommercialCAD.html`
- `ImportCustomCAD.html`
- `ManageCADFiles.html`
- `ModelBrowser.html`
- `MultibodyModelBrowser.html`
- `FluidModelBrowser.html`
- `ViewInteractions.html`
- `Measure.html`

交付目标：

- STEP / 中性格式导入闭环
- 模型树、对象树、属性面板、三维视图联动
- 拾取、过滤、搜索、右键菜单、拖拽等交互完成闭环
- 为后续多体 / 流体对象创建提供稳定的选择基础

当前状态：`进行中`

已确认的仓库证据：

- README 已明确 STEP 导入、Three.js 展示、基础建模为当前能力
- `src/webview/main.ts` 已有导入、对象树、选中对象、上下文菜单等实现
- `packages/core/test/model-browser.spec.ts` 已覆盖组节点在模型浏览器中的组织

### WP-MB 多体设计

对应页面：

- `GroupParts.html`
- `BuildMarkers.html`
- `BuildDesignPoints.html`
- `BuildConnectors.html`
- `ModifyUnknownConnectors.html`
- `BuildMotions.html`
- `BuildContacts.html`
- `ObjectAttribute.html`
- `MaterialModify.html`
- `PlanarLoopConstraints.html`
- `MultiBodyDesign.html`

交付目标：

- 分组、标架、参考标架、设计点、连接、驱动、接触形成完整工作流
- 属性面板能正确展示并编辑多体对象
- 多体对象能参与导入导出与后续生成流程
- 分组关系不只是 UI 记录，而是多体对象归属基础

当前状态：`部分完成`

已完成并有较强证据支撑的子项：

- `GroupParts` 已形成独立方案与 PRD 文档
- 分组层级状态、模型树组节点、多选、右键菜单、拖拽、重命名、分解、清理、默认分组、导入导出层级字段已落地
- `packages/core/test/group-design.spec.ts`
- `packages/core/test/model-browser.spec.ts`
- `packages/core/test/mass-aggregation.spec.ts`

当前已知缺口：

- `SC13_PRD_对零件进行分组_2026-03-11.md` 已明确：Joint / Motion 的归属仍偏向 part，而非完整 group-oriented
- 缺少专门的 Webview 集成回归套件
- `BuildContacts`、`ModifyUnknownConnectors`、`PlanarLoopConstraints` 尚无完整闭环验收证据

### WP-FL 流体设计

对应页面：

- `FluidDesign.html`
- `SimpleTankSlice.html`
- `TankSlice.html`
- `RibSlice.html`
- `BuildFluidPorts.html`
- `FluidObjectAttribute.html`
- `FluidModelBrowser.html`

交付目标：

- 切片、肋板切片、流体端口、介质、重力、对象属性形成闭环
- 流体对象能导入导出并在对象树中可追踪

当前状态：`部分完成`

已确认的仓库证据：

- `src/webview/main.ts` 存在 `fluidSlices`、`fluidPorts`、配置导入导出字段
- Ribbon 已暴露流体相关入口

当前已知缺口：

- `gravity`、`medium` 在导入导出结构中仍为空数组
- 流体对象浏览器、属性编辑和完整交互尚无独立验收文档
- 官方帮助页中的“标准模式 / 闪电模式 / 参数查看 / 删除”等细节尚未系统对齐

### WP-TOOL 设计工具

对应页面：

- `Measure.html`
- `ExplodedView.html`
- `SurfaceThickening.html`
- `PlanarLoopConstraints.html`
- `DesignTool.html`

交付目标：

- 测量、爆炸视图、曲面加厚、平面环处理具备稳定入口、属性反馈与结果可见性

当前状态：`部分完成`

已确认的仓库证据：

- Ribbon 已包含测量、爆炸视图、曲面加厚、平面环入口
- `src/webview/main.ts` 已有测量与曲面加厚相关处理分支

当前已知缺口：

- 缺少针对这些工具的独立测试与文档对齐验收
- 帮助页中描述的操作选项、范围编辑和参数修改尚未逐项核对

### WP-EXP 保存、导出与生成

对应页面：

- `SaveModel.html`
- `ModelExport.html`
- `ModelImport.html`
- `ToModelicaModel.html`

交付目标：

- 保存 / 另存 / 打开已保存模型
- 导出结构稳定，支持继续导入编辑
- 明确生成结果目录、文件契约与快速预览能力

当前状态：`进行中`

已确认的仓库证据：

- VSCode 命令已包含 `exportCadtoolConfig` / `importCadtoolConfig`
- Webview 已具备配置导入导出逻辑

当前已知缺口：

- 帮助页要求的 `main.mo`、group mo、sys3d、csv、log、dxf 等导出产物契约未在计划中拆开
- `SaveModel` 页中的自动保存、另存为、打开保存文件尚未形成独立闭环说明
- `ToModelicaModel` 的“快速预览”和“结果说明”尚未与实现逐项对齐

### WP-ITR 迭代设计

对应页面：

- `IterativeDesign.html`
- `PartiallyIterativeDesign.html`
- `WhollyIterativeDesign.html`

交付目标：

- 整体迭代与局部迭代具备入口、范围限制、冲突检查和用户提示

当前状态：`未完成`

说明：

- 旧版计划把迭代设计列为主工作包，但当前仓库中缺少足够的实现与验收证据
- 该工作包应在导入 / 多体 / 保存导出基础稳定后推进

### WP-ERR FAQ、错误码与问题定位

对应页面：

- `FAQ/ErrorReference.html`
- `FAQ/ErrorReference/Error1.html` ~ `Error12.html`
- `faq_Animation.html`
- `faq_GenerateMo.html`
- `faq_ImportCAD.html`
- `faq_Modeling.html`
- `faq_ReplicationOrMigration.html`
- `faq_ViewInteractions.html`

交付目标：

- 将 13 个错误码落成统一字典、触发条件、用户提示和恢复建议
- 将 FAQ 转化为产品告警、帮助提示、空状态和排障入口

当前状态：`部分完成`

已确认的仓库证据：

- `src/language/cadtoolKnowledge.ts` 中已存在错误码知识项和补全内容

当前已知缺口：

- 仍缺少统一的运行时错误码框架
- 错误页尚未映射到具体导入、建模、导出、渲染场景
- FAQ 目前主要停留在文档层，没有形成产品内排障闭环

### WP-CASE 官方案例验收

对应页面：

- `SimpleNewtonCradle.html`
- `SimpleTank.html`
- `SliderCrankMechanism.html`
- `Bulldozer.html`
- `DoubleSlider.html`
- `PickAndPlace.html`
- `Robot.html`
- `RobotGrabBall.html`
- `Tank.html`

交付目标：

- 以官方案例作为最终验收样例
- 每个案例至少验证“导入 -> 建模 -> 导出 / 生成 -> 结果检查”的主链路

当前状态：`未完成`

说明：

- 这是最能反映“是否真正对齐帮助文档”的验收层，但目前还没有成体系落地

## 4. 当前状态快照（2026-03-09）

### 已有明确代码与测试证据的能力

- STEP 导入与 3D 展示
- 基础工作台 / Ribbon / Webview 交互框架
- 分组设计主闭环
- 分组层级导入导出
- 组聚合质量属性计算
- 标架 / 参考标架 / 设计点 / 关节 / 驱动 / 流体对象的命令入口或数据结构基础

### 已有入口但尚未完成帮助页级闭环验收的能力

- 测量
- 爆炸视图
- 曲面加厚
- 平面环处理
- 流体切片 / 端口
- 保存 / 另存 / 打开模型
- 导出与生成结果说明

### 当前最明显的不一致

- 计划结构仍旧按旧 PRD，而不是按 74 页官方帮助目录
- 多体设计中“分组”推进较深，但其它对象线没有被同样粒度地拆开
- FAQ / 错误码 / 案例验收尚未进入主计划的硬里程碑
- `plan.md` 文本本身已经乱码，不适合作为持续维护基线

## 5. 修订后的阶段计划

### Phase A：文档对齐与能力盘点

目标：

- 完成 74 页帮助目录到工作包的重新映射
- 为每页标记 `已完成 / 部分完成 / 未开始`
- 以案例和 FAQ 补齐旧版计划缺失维度

退出标准：

- `plan.md`、帮助页追踪表、验收口径一致
- 后续每个迭代都能明确指向帮助页来源

状态：`已完成`

阶段产物：

- `docs/outputs/GLOBAL_TRACEABILITY_CADTool_2026a_帮助页追踪表_2026-03-09.md`

### Phase B：多体设计闭环补齐

目标：

- 在已完成分组设计的基础上，补齐标架、参考标架、设计点、连接、驱动、接触、对象属性联动
- 把 group ownership 向 joint / motion / contact 等对象继续传递

本阶段优先项：

- `BuildMarkers`
- `BuildDesignPoints`
- `BuildConnectors`
- `ModifyUnknownConnectors`
- `BuildMotions`
- `BuildContacts`
- `ObjectAttribute`

退出标准：

- 多体对象可创建、可编辑、可删除、可导出、可再导入
- 核心多体对象具备最小自动化回归与手工验收脚本

状态：`进行中`

### Phase C：流体设计与设计工具闭环

目标：

- 补齐切片、肋板切片、流体端口、介质、重力、流体浏览器
- 补齐测量、爆炸视图、曲面加厚、平面环处理的帮助页能力

本阶段优先项：

- `TankSlice` / `RibSlice` / `BuildFluidPorts`
- `FluidObjectAttribute`
- `Measure`
- `ExplodedView`
- `SurfaceThickening`
- `PlanarLoopConstraints`

退出标准：

- 工具和流体对象都具备“入口 + 操作 + 属性 + 导入导出或持久化”的闭环

状态：`待启动`

### Phase D：保存、导出、迭代设计、错误体系

目标：

- 明确保存与导出产物契约
- 对齐 `ToModelicaModel`、`SaveModel`、`ModelExport`、`ModelImport`
- 建立 13 个错误码及 FAQ 的运行时映射
- 启动整体迭代 / 局部迭代设计能力

本阶段优先项：

- `SaveModel`
- `ToModelicaModel`
- `ErrorReference`
- `faq_ImportCAD`
- `faq_Modeling`
- `faq_ViewInteractions`
- `PartiallyIterativeDesign`
- `WhollyIterativeDesign`

退出标准：

- 导入 / 建模 / 导出 / 再导入 / 报错定位形成完整工程闭环

状态：`待启动`

### Phase E：官方案例验收

目标：

- 以入门案例和应用案例作为最终验收场景

退出标准：

- 至少完成 3 个入门案例和 3 个应用案例的端到端走通
- 每个案例都能映射到对应帮助页与回归清单

状态：`待启动`

## 6. 下一迭代重点

下一迭代不再继续泛化扩张范围，而是优先补齐最影响文档对齐质量的缺口：

- [ ] 建立“74 页帮助目录追踪表”，逐页标记实现状态、代码位置、测试位置
- [ ] 将多体设计从“分组已完成”扩展到“标架 / 参考标架 / 设计点 / 连接 / 驱动”同粒度闭环
- [ ] 补齐错误码字典与运行时提示框架，覆盖 13 个错误码
- [ ] 明确保存、导出、导入的文件契约和回归脚本
- [ ] 新增一组 Webview 层冒烟 / 集成回归，避免只有 `packages/core` 有测试证据

## 7. 验收口径

### 功能验收

每个帮助页映射的能力至少满足以下其一：

1. 有自动化测试与代码入口。
2. 有明确的 UI 入口、可复现操作步骤和手工验收脚本。
3. 能参与导入导出或案例闭环，而不是只停留在占位按钮。

### 里程碑验收

每个阶段完成时必须同时满足：

1. 帮助页映射已更新。
2. 计划状态已更新。
3. 自动化测试或手工验收清单已同步。
4. 已知限制与残余风险已写明。

### 案例验收

优先采用帮助目录中的官方案例：

- 简单牛顿摆
- 简单油箱
- 曲柄滑块
- 机械臂
- 拾取放置
- 铲斗机构
- 油箱带肋板

## 8. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 帮助页覆盖面远大于当前实现深度 | 计划看似完整，实际不可验收 | 先建立逐页追踪表，禁止只写模块名不写页面来源 |
| 分组设计推进快于其它多体对象 | 多体链路局部成熟、整体不闭环 | 下一阶段以对象归属、属性、导入导出为统一主线推进 |
| 错误码只存在于知识库补全 | 用户无法定位真实问题 | 将错误码纳入运行时消息、导入统计、诊断面板 |
| 只有 core 层测试，Webview 回归薄弱 | UI 交互容易回退 | 增加冒烟与集成测试，至少覆盖导入、分组、导出主链路 |
| 流体与工具页入口多、闭环弱 | 帮助页看似已覆盖，实际只有占位按钮 | 逐页对照帮助文档，标记“入口级 / 工作流级 / 验收级”成熟度 |

## 9. 维护机制

- 每次 Sprint 结束更新一次 `plan.md`
- 每次更新必须同时修改“当前状态快照”和“下一迭代重点”
- 新增能力时，必须补充其对应帮助页来源
- 不能再新增脱离帮助目录的独立工作包命名

## 10. 本次修订结论

本次修订完成了三件事：

1. 修复 `plan.md` 编码损坏问题。
2. 将计划基线从旧 PRD 切换为 `GLOBAL_INDEX_CADTool_2026a_帮助文档页面索引_2026-03-09.md` 的 74 页帮助目录。
3. 明确把“分组设计已形成交付证据，但整体验收仍未完成”的真实状态写入主计划。
