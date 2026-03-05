# PRD: VSCode 插件实现 CADTool 自动完成能力（2026a）

## 1. 文档信息

- 文档名称：`PRD_VSCode_CADTool_Autocomplete_2026a`
- 产品版本：`v1.0`
- 创建日期：`2026-03-05`
- 适用范围：Sysplorer `2026a` 对应 CAD 工具（CAD Tool）
- 目标形态：VSCode Extension + Language Server

说明：
- 本次原计划使用 Exa MCP 进行抓取，但 Exa 接口在当前环境持续返回 `400`；最终采用官方文档页面直采与结构化分析。
- 数据来源均为同元官方文档链接（见文末“参考来源”）。

## 2. 背景与问题定义

CAD Tool 是三维 CAD 模型到系统仿真模型（Modelica）的自动化桥梁。当前工作流以图形化交互为主，工程师在以下环节缺少“编辑期智能辅助”：

- 对设计对象名称、参数、类型和范围的记忆成本高。
- 多体/流体对象属性复杂，手动输入易出错。
- 生成 Modelica 后再维护 `.mo` 文件时，CAD 语义与模型参数脱节。
- 常见错误码、导入限制、参数约束信息分散在文档中，难以实时提示。

因此需要在 VSCode 内提供面向 CADTool 语义的自动完成（IntelliSense）与诊断能力，降低建模门槛与错误率，提升从 CAD 到 Modelica 的开发效率。

## 3. 产品目标

### 3.1 目标（Goals）

1. 在 VSCode 中提供 CADTool 领域语义自动完成（对象、类型、属性、参数、枚举值）。
2. 提供基于上下文的参数范围校验和错误提示，并可一键修复常见问题。
3. 打通 CADTool 导出工件与 Modelica 编辑场景，实现跨文件符号补全与跳转。
4. 将关键文档知识内置到 Hover/文档卡片，减少离开编辑器查文档次数。

### 3.2 非目标（Non-Goals）

1. 不在 VSCode 内重建 CADTool 三维建模界面（不做几何拾取与三维交互替代）。
2. 不替代 Sysplorer/CADTool 的求解内核与模型生成流程。
3. 不在 v1 中实现 CAD 解析器调用与 CAD 文件导入执行。

## 4. CADTool 功能全景（完整功能映射）

### 4.1 主流程

`CAD 文件 -> CAD Tool（多体/流体设计）-> 自动生成 Modelica -> Sysplorer 多领域建模与仿真`

### 4.2 功能模块清单

| 一级模块 | 二级模块 | 关键能力 |
|---|---|---|
| 模型导入 | 工具入口、导入 CAD、模型浏览器、三维视图 | 支持多种 CAD 格式导入；浏览/交互 |
| 多体设计 | 分组、标架/参考标架、设计点、连接、未知运动副修改、驱动、接触、属性、材料 | 完成多体结构与约束设计 |
| 流体设计 | 简单油箱切片、油箱切片、肋板切片、流体端口、流体属性 | 完成油箱与端口建模 |
| 设计工具 | 测量、爆炸视图、曲面加厚、平面环处理 | 辅助建模与修复 |
| 模型导出 | 保存模型、生成 Modelica、管理 CAD 文件 | 输出可仿真模型与工件 |
| 迭代设计 | 整体迭代、局部迭代 | 生成后回流设计 |
| FAQ 与错误码 | 导入、视图交互、建模、动画、迁移、错误码 | 问题定位与处理依据 |

### 4.3 关键术语与对象

物体、子物体、分组、标架、参考标架、设计点、连接（运动副）、驱动、接触、油箱切片、流体端口、介质、重力。

### 4.4 关键约束（用于补全与诊断）

| 约束项 | 规则 |
|---|---|
| 名称规则 | 以字母或下划线开头，仅包含字母/数字/下划线，且全局不重名 |
| 图标大小 | 整数，`1~50000` |
| 位置 | 浮点，`-1000~+1000` |
| 方向 | 浮点，`-180~+180` |
| 常见导入格式 | `.step/.stp`、`.iges/.igs`、`.CATProduct`、`.sldasm`、`.ty3d` |
| 建议导入规模 | `step/iges <= 200M 且 <= 2000零件`；`CATProduct/sldasm <= 300M 且 <= 500零件` |

## 5. 用户与核心场景

### 5.1 目标用户

1. 多体/流体系统建模工程师（主要用户）
2. Modelica 工程师（生成后维护）
3. 仿真平台集成工程师（工程迁移、版本维护）

### 5.2 核心场景

1. 编写或维护 CADTool 语义配置时，快速完成对象和参数填写。
2. 维护 `.mo` 文件时，自动补全与 CADTool 相关的组件、参数、命名。
3. 处理导入或转换失败时，实时看到错误码含义和处理建议。

## 6. 产品方案定义

## 6.1 形态

VSCode 插件由三部分组成：

1. Extension UI（命令、设置、文档面板）
2. Language Server（补全、Hover、诊断、Code Action）
3. CADTool 知识库（对象、枚举、参数、约束、错误码）

### 6.2 文件支持范围（v1）

1. `.mo`（Modelica 文件）
2. `cadtool.config.json`（建议新增的 CADTool 语义配置文件，用于静态补全与校验）
3. `Data/*.csv`、`Log/cad_toolbox.log`（只读解析，用于补全上下文和诊断增强）

说明：官方文档主要是 GUI 操作说明，无公开脚本 DSL；v1 通过 `cadtool.config.json` 承载可编辑的 CADTool 语义对象，实现 IDE 自动完成与校验能力。

## 7. 详细功能需求（FR）

### FR-001 上下文感知自动完成

- 在不同对象块中显示不同候选项：
  - 多体对象块：`group/marker/designPoint/connector/motion/contact/gravity/material`
  - 流体对象块：`tankSlice/ribSlice/fluidPort/medium/gravity`
  - 导出对象块：`packageName/outputMode/previewEnabled`
- 验收：错误上下文下不出现无关候选。

### FR-002 枚举值补全

- 连接类型：`固定副/球副/平面副/转动副/移动副/圆柱副/万向节/螺旋副`
- 驱动类型：`角度/角速度/角加速度`
- 端口类型：`可变油箱气体孔口/可变油箱液体孔口/可变油箱填充孔口`
- 重力类型：
  - 多体：`Uniform gravity field/No gravity field/Point gravity field`
  - 流体：`常数/表格数据`

### FR-003 参数补全 + 范围约束提示

- 输入参数名自动补全。
- 输入参数值时显示合法范围与单位提示。
- 对数值超界、类型不匹配、空值等即时报错。

重点参数（示例）：
- 通用：`name/iconSize/visibility/position/direction`
- 连接：`phi_rel_fixed/phi_rel_0/om_rel_fixed/om_rel_0/StateSelect`
- 驱动：`phi.start/w.start`
- 接触：`k/d/n1/n2/p_max/mue_k/mue_s/mue_r/k_v/v_e1/v_e2`
- 流体端口/肋板：`Lambda_Crit/Cqmax/Cq_Gas/Sigmin/Sigmax`
- 重力：`g/n/mu`（多体）、`gType/gConst/gTable/extrapolation/timeScale`（流体）

### FR-004 模板片段（Snippets）

- 提供可直接落地的模板：
  - `cadtool-multibody-basic`
  - `cadtool-fluid-basic`
  - `cadtool-connector`
  - `cadtool-motion`
  - `cadtool-contact`
  - `cadtool-fluid-port`
  - `cadtool-gravity-uniform`
  - `cadtool-gravity-table`

### FR-005 跨符号引用补全

- 在 `connector.part1/part2` 中补全可选零件或分组名。
- 在 `motion.connectorRef` 中补全已有连接名。
- 在 `contact.partA/partB` 中补全可选对象。
- 在 `.mo` 中补全由 CADTool 生成的模型/组名称。

### FR-006 诊断与快速修复（Code Action）

- 诊断项：
  - 重名冲突
  - 缺失必填字段
  - 数值越界
  - 不支持的参数组合
  - 非法命名格式
- 快速修复：
  - 自动重命名（追加后缀）
  - 自动补齐缺失字段默认值
  - 数值裁剪到合法区间

### FR-007 文档悬浮与跳转

- Hover 展示：定义、限制、单位、示例。
- 支持 “Open CADTool Docs” 跳转到对应官方章节。

### FR-008 错误码知识库补全

- 输入错误码前缀时补全并显示含义与处理建议。
- 覆盖已知导入错误码（如：`ERR_CAD_SOFTWARE_NOT_INSTALLED` 等）。

### FR-009 导出工件感知

- 自动索引导出产物：
  - `*_main.mo`
  - `[group].mo`
  - `Cad/*.sys3d`
  - `Data/*.csv`
  - `Log/cad_toolbox.log`
  - `Visualizers/*.dxf`
- 在编辑时提示相关文件是否缺失或命名不一致。

### FR-010 配置与开关

- 用户可配置：
  - 是否启用实时诊断
  - 自动完成触发延迟
  - 文档语言（中/英）
  - 是否启用 `.mo` 深度索引

## 8. 非功能需求（NFR）

| 编号 | 要求 |
|---|---|
| NFR-001 | 自动完成首屏返回 `<= 80ms`（冷启动除外） |
| NFR-002 | 中等工程（500 文件）初次索引 `<= 15s` |
| NFR-003 | 增量更新（单文件）`<= 1s` |
| NFR-004 | 插件空闲内存占用 `< 300MB` |
| NFR-005 | 离线可用（知识库本地化） |
| NFR-006 | 不上传用户 CAD/Modelica 内容（默认无遥测） |

## 9. 信息架构与数据模型

### 9.1 核心数据结构

1. `cadtool.schema.json`
2. `cadtool.enums.json`
3. `cadtool.constraints.json`
4. `cadtool.error-codes.json`
5. `cadtool.docs-map.json`

### 9.2 索引模型

1. Symbol Index：对象名与引用关系
2. Type Index：对象类型与参数集合
3. Artifact Index：导出文件与模型映射

## 10. 技术架构

1. 客户端：VSCode Extension（TypeScript）
2. 服务端：LSP Server（Node.js）
3. Parser：
   - JSON Schema parser（`cadtool.config.json`）
   - Modelica parser（轻量 AST，用于名称/引用）
4. Cache：
   - Workspace 索引缓存
   - 文档知识库缓存

## 11. 交互与体验要求

1. 触发字符：`.`、`"`、`:`、`/`
2. 候选排序优先级：
   - 上下文匹配 > 最近使用 > 文档推荐 > 字母序
3. 补全项展示：
   - Label（参数名）
   - Type（数据类型）
   - Detail（合法范围）
   - Doc（简述 + 来源章节）

## 12. 里程碑与发布计划

### M1（2 周）：MVP

1. `cadtool.config.json` 基础补全
2. 基础参数校验
3. Snippets（多体/流体基础模板）
4. 文档 Hover（核心字段）

### M2（2 周）：增强

1. 跨符号引用补全
2. 错误码补全与解释
3. `.mo` 轻量索引与补全联动
4. 快速修复（重命名/补齐/裁剪）

### M3（2 周）：可发布

1. 工件感知（Cad/Data/Log/Visualizers）
2. 性能优化与稳定性测试
3. 用户设置项完善
4. 发布文档与示例工程

## 13. 验收标准（Acceptance Criteria）

1. 完成率：至少覆盖文档中的核心对象、类型、参数与错误码。
2. 正确率：
   - 枚举补全准确率 >= 98%
   - 参数约束诊断准确率 >= 95%
3. 效率指标：
   - 典型建模配置编写时间降低 >= 30%
   - 参数类错误提交前发现率 >= 70%
4. 稳定性：
   - 连续 8 小时编辑无崩溃
   - 大工程索引失败率 < 1%

## 14. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 官方无公开脚本 DSL | 插件对象模型定义争议 | 使用 `cadtool.config.json` 作为插件标准输入，后续兼容官方格式 |
| CAD 几何语义无法在 VSCode 直接校验 | 无法做几何级校验 | v1 做参数级和引用级校验，几何校验交由 CADTool 执行 |
| 版本升级导致参数漂移 | 补全失真 | 建立 `2026a/2026b` 版本化知识库 |
| 大工程索引性能问题 | 卡顿影响体验 | 增量索引 + debounce + 缓存分层 |

## 15. 待确认事项（Open Questions）

1. 是否接受 `cadtool.config.json` 作为 v1 编辑入口？
2. `.mo` 语义补全需要覆盖到哪一层（仅 CADTool 生成模型，还是全量 Modelica）？
3. 是否需要直接集成 CADTool 日志解析实时告警面板？
4. 发布范围：仅内部团队使用，还是 VSCode Marketplace 公共发布？

## 16. 参考来源（官方文档）

- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/CADOverview.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/GettingStartedCADToolBox.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/MultiBodyDesign.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/FluidDesign.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/BuildConnectors.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/BuildFluidPorts.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/ObjectAttribute.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/FluidObjectAttribute.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/ToModelicaModel.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/ManageCADFiles.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/ApplicationCases.html
- https://www.tongyuan.cc/docs/sysplorer/2026a/Help/CADToolBox/Doc/CADToolBox/FaqOverview.html
