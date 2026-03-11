# PRD：CADToolOnline 三维建模界面重建（基于本地帮助文档重构）

## 1. 文档信息

- 文档版本：v3.0
- 更新日期：2026-03-06
- 数据来源：
  - `ref/Docs/CADToolBox/index.html`
  - `ref/Docs/CADToolBox/pageData/page-data-list.json`

## 2. 重构目标

1. 以帮助文档操作页为唯一事实来源，重建可指导开发的 UI 原型体系。
2. PRD 与 `.pen` 画板一一映射，消除“文档-原型”差异。
3. 覆盖模型导入、多体设计、流体设计、设计工具、导出、迭代、FAQ/错误码、三维交互全流程。

## 3. 功能范围与页面统计

- 文档操作页（HowToUse）纳入：40 页
- FAQ/错误码页纳入：20 页
- 原型场景页（不含主界面）：60 页
- 画板总数（含主界面多体/流体）：62 页

### 3.1 模块统计

| 模块 | 页面数 |
|---|---:|
| 错误码 | 13 |
| 模型导入 | 12 |
| 多体设计 | 10 |
| 流体设计 | 6 |
| 设计工具 | 5 |
| 模型导出 | 4 |
| 迭代设计 | 3 |
| 流程介绍 | 1 |
| 生成 Modelica 模型 | 1 |
| 建模 | 1 |
| 动画 | 1 |
| 工程复制和移植 | 1 |
| 视图与交互 | 1 |
| 其它 | 1 |

## 4. 原型场景映射（文档页 -> 画板）

| 场景ID | 模块 | 帮助页面 | 文档路径 | 画板ID |
|---|---|---|---|---|
| SC01 | 多体设计 | 添加接触 | `/Doc/CADToolBox/HowToUseCADToolBox/BuildContacts.html` | SC01_SCREEN |
| SC02 | 多体设计 | 添加连接 | `/Doc/CADToolBox/HowToUseCADToolBox/BuildConnectors.html` | SC02_SCREEN |
| SC03 | 流体设计 | 添加流体端口 | `/Doc/CADToolBox/HowToUseCADToolBox/BuildFluidPorts.html` | SC03_SCREEN |
| SC04 | 多体设计 | 添加设计点 | `/Doc/CADToolBox/HowToUseCADToolBox/BuildDesignPoints.html` | SC04_SCREEN |
| SC05 | 多体设计 | 添加标架及参考标架 | `/Doc/CADToolBox/HowToUseCADToolBox/BuildMarkers.html` | SC05_SCREEN |
| SC06 | 多体设计 | 添加驱动 | `/Doc/CADToolBox/HowToUseCADToolBox/BuildMotions.html` | SC06_SCREEN |
| SC07 | 设计工具 | 设计工具 | `/Doc/CADToolBox/HowToUseCADToolBox/DesignTool.html` | SC07_SCREEN |
| SC08 | 模型导入 | 商业 CAD 解析器独立使用 | `/Doc/CADToolBox/HowToUseCADToolBox/CommericalCADParserUse.html` | SC08_SCREEN |
| SC09 | 设计工具 | 爆炸视图 | `/Doc/CADToolBox/HowToUseCADToolBox/ExplodedView.html` | SC09_SCREEN |
| SC10 | 模型导入 | 流体模型浏览器 | `/Doc/CADToolBox/HowToUseCADToolBox/FluidModelBrowser.html` | SC10_SCREEN |
| SC11 | 流体设计 | 流体设计 | `/Doc/CADToolBox/HowToUseCADToolBox/FluidDesign.html` | SC11_SCREEN |
| SC12 | 模型导入 | 导入中性格式 CAD 模型 | `/Doc/CADToolBox/HowToUseCADToolBox/ImportNeutralCAD.html` | SC12_SCREEN |
| SC13 | 多体设计 | 对零件进行分组 | `/Doc/CADToolBox/HowToUseCADToolBox/GroupParts.html` | SC13_SCREEN |
| SC14 | 模型导入 | 导入自定义格式 CAD 模型 | `/Doc/CADToolBox/HowToUseCADToolBox/ImportCustomCAD.html` | SC14_SCREEN |
| SC15 | 模型导入 | 导入 CAD 模型 | `/Doc/CADToolBox/HowToUseCADToolBox/ImportCAD.html` | SC15_SCREEN |
| SC16 | 流体设计 | 设置对象的属性 | `/Doc/CADToolBox/HowToUseCADToolBox/FluidObjectAttribute.html` | SC16_SCREEN |
| SC17 | 模型导出 | 管理 CAD 文件 | `/Doc/CADToolBox/HowToUseCADToolBox/ManageCADFiles.html` | SC17_SCREEN |
| SC18 | 迭代设计 | 迭代设计 | `/Doc/CADToolBox/HowToUseCADToolBox/IterativeDesign.html` | SC18_SCREEN |
| SC19 | 模型导入 | 导入商用格式 CAD 模型 | `/Doc/CADToolBox/HowToUseCADToolBox/ImportCommercialCAD.html` | SC19_SCREEN |
| SC20 | 多体设计 | 修改材料 | `/Doc/CADToolBox/HowToUseCADToolBox/MaterialModify.html` | SC20_SCREEN |
| SC21 | 模型导出 | 模型导出 | `/Doc/CADToolBox/HowToUseCADToolBox/ModelExport.html` | SC21_SCREEN |
| SC22 | 模型导入 | 模型导入 | `/Doc/CADToolBox/HowToUseCADToolBox/ModelImport.html` | SC22_SCREEN |
| SC23 | 设计工具 | 测量 | `/Doc/CADToolBox/HowToUseCADToolBox/Measure.html` | SC23_SCREEN |
| SC24 | 模型导入 | 模型浏览器 | `/Doc/CADToolBox/HowToUseCADToolBox/ModelTreeBrowser.html` | SC24_SCREEN |
| SC25 | 多体设计 | 修改未知类型运动副 | `/Doc/CADToolBox/HowToUseCADToolBox/ModifyUnknownConnectors.html` | SC25_SCREEN |
| SC26 | 模型导入 | 多体模型浏览器 | `/Doc/CADToolBox/HowToUseCADToolBox/MultibodyModelBrowser.html` | SC26_SCREEN |
| SC27 | 多体设计 | 多体设计 | `/Doc/CADToolBox/HowToUseCADToolBox/MultiBodyDesign.html` | SC27_SCREEN |
| SC28 | 多体设计 | 设置对象的属性 | `/Doc/CADToolBox/HowToUseCADToolBox/ObjectAttribute.html` | SC28_SCREEN |
| SC29 | 迭代设计 | 局部迭代设计 | `/Doc/CADToolBox/HowToUseCADToolBox/PartiallyIterativeDesign.html` | SC29_SCREEN |
| SC30 | 流程介绍 | 流程介绍 | `/Doc/CADToolBox/HowToUseCADToolBox/ProcessIntroduction.html` | SC30_SCREEN |
| SC31 | 流体设计 | 油箱肋板切片 | `/Doc/CADToolBox/HowToUseCADToolBox/RibSlice.html` | SC31_SCREEN |
| SC32 | 设计工具 | 平面环处理 | `/Doc/CADToolBox/HowToUseCADToolBox/PlanarLoopConstraints.html` | SC32_SCREEN |
| SC33 | 模型导出 | 保存模型 | `/Doc/CADToolBox/HowToUseCADToolBox/SaveModel.html` | SC33_SCREEN |
| SC34 | 流体设计 | 简单油箱切片 | `/Doc/CADToolBox/HowToUseCADToolBox/SimpleTankSlice.html` | SC34_SCREEN |
| SC35 | 设计工具 | 曲面加厚 | `/Doc/CADToolBox/HowToUseCADToolBox/SurfaceThickening.html` | SC35_SCREEN |
| SC36 | 模型导出 | 生成 Modelica 模型 | `/Doc/CADToolBox/HowToUseCADToolBox/ToModelicaModel.html` | SC36_SCREEN |
| SC37 | 模型导入 | 三维视图 | `/Doc/CADToolBox/HowToUseCADToolBox/ViewInteractions.html` | SC37_SCREEN |
| SC38 | 流体设计 | 油箱切片 | `/Doc/CADToolBox/HowToUseCADToolBox/TankSlice.html` | SC38_SCREEN |
| SC39 | 模型导入 | 工具入口 | `/Doc/CADToolBox/HowToUseCADToolBox/ToolBoxEntry.html` | SC39_SCREEN |
| SC40 | 迭代设计 | 整体迭代设计 | `/Doc/CADToolBox/HowToUseCADToolBox/WhollyIterativeDesign.html` | SC40_SCREEN |
| SC41 | 错误码 | ERRCADSOFTWARENOTINSTALLED | `/Doc/CADToolBox/FAQ/ErrorReference/Error1.html` | SC41_SCREEN |
| SC42 | 错误码 | PARSERPATHINVALID | `/Doc/CADToolBox/FAQ/ErrorReference/Error10.html` | SC42_SCREEN |
| SC43 | 错误码 | 错误码 | `/Doc/CADToolBox/FAQ/ErrorReference.html` | SC43_SCREEN |
| SC44 | 错误码 | ERRDATAEXCHANGE_FAILED | `/Doc/CADToolBox/FAQ/ErrorReference/Error12.html` | SC44_SCREEN |
| SC45 | 错误码 | ERRCADVERSIONTOOLOW | `/Doc/CADToolBox/FAQ/ErrorReference/Error2.html` | SC45_SCREEN |
| SC46 | 错误码 | ERROPENCADFILEFAILED | `/Doc/CADToolBox/FAQ/ErrorReference/Error4.html` | SC46_SCREEN |
| SC47 | 错误码 | ERRCREATEPROCESS_FAILED | `/Doc/CADToolBox/FAQ/ErrorReference/Error11.html` | SC47_SCREEN |
| SC48 | 错误码 | CADFILEIS_EMPTY | `/Doc/CADToolBox/FAQ/ErrorReference/Error5.html` | SC48_SCREEN |
| SC49 | 错误码 | ERROPENCADSOFTWAREFAILED | `/Doc/CADToolBox/FAQ/ErrorReference/Error3.html` | SC49_SCREEN |
| SC50 | 错误码 | ERREXPORTSTEP_FAILED | `/Doc/CADToolBox/FAQ/ErrorReference/Error7.html` | SC50_SCREEN |
| SC51 | 错误码 | PARSEFILEFAILED | `/Doc/CADToolBox/FAQ/ErrorReference/Error6.html` | SC51_SCREEN |
| SC52 | 错误码 | ERR_RUNTIME | `/Doc/CADToolBox/FAQ/ErrorReference/Error9.html` | SC52_SCREEN |
| SC53 | 错误码 | ERRGENERATEFILE_FAILED | `/Doc/CADToolBox/FAQ/ErrorReference/Error8.html` | SC53_SCREEN |
| SC54 | 生成 Modelica 模型 | 生成 Modelica 模型 | `/Doc/CADToolBox/FAQ/faq_GenerateMo.html` | SC54_SCREEN |
| SC55 | 模型导入 | 模型导入 | `/Doc/CADToolBox/FAQ/faq_ImportCAD.html` | SC55_SCREEN |
| SC56 | 建模 | 建模 | `/Doc/CADToolBox/FAQ/faq_Modeling.html` | SC56_SCREEN |
| SC57 | 动画 | 动画 | `/Doc/CADToolBox/FAQ/faq_Animation.html` | SC57_SCREEN |
| SC58 | 工程复制和移植 | 工程复制和移植 | `/Doc/CADToolBox/FAQ/faq_ReplicationOrMigration.html` | SC58_SCREEN |
| SC59 | 视图与交互 | 视图与交互 | `/Doc/CADToolBox/FAQ/faq_ViewInteractions.html` | SC59_SCREEN |
| SC60 | 其它 | 常见问题 | `/Doc/CADToolBox/FaqOverview.html` | SC60_SCREEN |

## 5. 关键交互约束（来自帮助文档）

1. 统一退出交互：多数建模态支持再次点击功能按钮或 `Esc` 退出。
2. 闪电模式与标准模式：连接、驱动、接触、流体端口等需双模式支持。
3. 三维拾取一致性：点/线/面拾取规则必须与文档说明一致，并支持高亮联动。
4. 参数侧边栏：进入操作态后右侧必须出现对应“选项-xxx”面板。
5. 导入/导出/迭代关键流程须提供状态提示、异常提示与日志定位入口。

## 6. 验收标准

1. 所有纳入文档页在 `.pen` 中均有对应画板。
2. 任一画板必须包含：页面标题、流程模块、关键步骤、状态提示。
3. PRD 场景映射表中的每一行，都可在 `cadtoolonline.pen` 顶层画板中定位到对应 ID。
4. 开发人员可基于画板直接建立页面与交互任务，无需回溯原始文档才能理解流程。
