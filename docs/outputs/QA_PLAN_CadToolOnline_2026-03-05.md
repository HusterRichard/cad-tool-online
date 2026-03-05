# CadToolOnline QA Plan

## 1. 文档信息
- 项目：`CadToolOnline`
- 版本范围：`0.1.x`（当前主分支）
- 文档版本：`v1.0`
- 创建日期：`2026-03-05`
- 适用阶段：Phase 3（核心建模）到 Phase 5（测试/发布）

## 2. QA 目标
1. 保证核心链路可用：`STEP 导入 -> 3D 可视化 -> MBS/Fluid 操作 -> 配置导入导出`。
2. 保证扩展质量基线：构建稳定、无阻断级缺陷、关键命令可回归。
3. 建立自动化回归能力：PR 门禁 + 夜间回归 + 发布门禁。

## 3. 质量指标（KPI）
- 构建成功率：PR 分支 `>= 98%`。
- 阻断/严重缺陷（P0/P1）：发布前必须 `0`。
- 关键链路通过率：`>= 95%`。
- `cadtool.config.json` 语言能力准确率（补全/诊断关键规则）：`>= 95%`。
- Webview 核心操作稳定性（连续 1 小时无崩溃）：`100%`。

## 4. 测试范围

### 4.1 In Scope
- VSCode 扩展激活、命令注册、Webview 消息链路。
- Webview 关键交互：导入 STEP、模型树选择、MBS/Fluid 动作、导入/导出 CADTool 配置。
- Language Features：`cadtool.config.json` 补全、Hover、诊断、Quick Fix；`*.mo` 引用补全。
- Schema 与 snippets 一致性验证。
- 打包链路：`build`、`build:webview`、`build:extension`、`package`。

### 4.2 Out of Scope（当前计划）
- 全量 CAD 内核精度验证（由 OCCT/C++ 核心专项承担）。
- 云端协作、多人并发。
- 非 STEP 的企业级格式全覆盖。

## 5. 风险优先级
1. 高风险：Webview 与 Extension 消息协议失配导致功能无响应。
2. 高风险：`cadtool.config.json` 导入导出与 schema 不一致。
3. 中风险：大模型文件导入性能退化。
4. 中风险：中文/编码导致文档与提示文本异常。
5. 中风险：命令入口齐全但未激活（activationEvents 漏配）。

## 6. 测试分层策略

### L0 静态质量（每次提交）
- `pnpm lint`
- `pnpm exec tsc -p tsconfig.extension.json --noEmit`
- `pnpm build:extension`
- `pnpm build:webview`

### L1 单元测试（模块级）
- `packages/core`：实体与规则函数（命名、范围、状态转换）。
- `src/language`：解析、补全、诊断、Quick Fix 逻辑（可做纯函数单测）。
- 目标：关键规则函数覆盖率 `>= 80%`。

### L2 集成测试（进程内）
- Extension 命令 -> Panel -> Webview 的消息往返。
- 配置导入导出闭环一致性（导出后再导入，核心对象数量一致）。

### L3 E2E 场景测试（手工 + 自动化脚本）
- 打开编辑器、导入 STEP、操作 Ribbon、导出模型/配置、重新导入配置。
- 验证 UI 状态、提示信息、文件产物。

### L4 非功能测试
- 大文件性能基线：导入 `50MB/100MB/200MB` STEP。
- 稳定性：持续操作 60 分钟，观察内存增长和异常。

## 7. 测试环境矩阵

| 维度 | 必测 | 选测 |
|---|---|---|
| OS | Windows 11 | Ubuntu 22.04 |
| VSCode | 1.80.x, 1.90+ | Insiders |
| Node | 18.x, 20.x | 22.x |
| pnpm | 8.x | 9.x |

## 8. 测试数据准备
- STEP 样例集：
  - `small.step`（< 5MB，单装配）
  - `medium.step`（10~50MB，多层级）
  - `large.step`（100MB+，复杂装配）
- 配置样例集：
  - `cadtool.config.valid.json`（全对象）
  - `cadtool.config.partial.json`（缺字段）
  - `cadtool.config.invalid.json`（类型/引用错误）
- Modelica 样例：
  - `main.mo`（含 `groupRef/connectorRef/part1` 等引用）

## 9. 关键测试场景（优先执行）

### 9.1 命令与激活
1. 执行 `Open CAD Editor` 能打开面板。
2. 执行 `Export CADTool Config` 在面板打开时可保存文件。
3. 执行 `Import CADTool Config` 可选择文件并触发 Webview 导入。
4. 未打开面板时执行导入/导出命令能给出明确提示。

### 9.2 Webview 核心链路
1. 导入 STEP 后，模型树可见且可选择，属性面板联动更新。
2. `createGroup/createJoint/createMotion/fluidPort` 动作可触发并更新状态。
3. `measureTool/surfaceThicken/planarRingProcess` 至少有可观测提示和状态反馈。
4. `clearScene` 后状态清空（形体、选择、MBS/Fluid 缓存、Marker）。

### 9.3 配置导入导出闭环
1. 执行导出，生成 `cadtool.config.json`。
2. 清空场景后再导入，核心统计数（group/marker/connector/motion/ribSlice/fluidPort）与导出前一致。
3. 导入含坏数据文件时：跳过无效项，给出 warnings，不崩溃。

### 9.4 Language Features
1. `cadtool.config.json` 中键名补全、枚举补全、引用补全可用。
2. Hover 能显示字段说明。
3. 诊断可发现非法命名、缺失必填、范围错误、未解析引用。
4. Quick Fix 能修复典型问题（名称规范化、补字段、数值裁剪、引用替换）。

## 10. 自动化执行计划

### 10.1 PR 门禁（必须）
1. `pnpm lint`
2. `pnpm exec tsc -p tsconfig.extension.json --noEmit`
3. `pnpm build:extension`
4. `pnpm build:webview`

### 10.2 Nightly（建议）
1. 全量构建：`pnpm build` + `pnpm build:extension` + `pnpm build:webview`
2. 关键场景脚本（导入/导出/配置闭环）回归
3. 产出日报：失败用例、性能趋势、缺陷变更

### 10.3 Release Candidate（必须）
1. `pnpm package` 成功生成 VSIX
2. 安装验证（干净 VSCode 环境）
3. 回归清单 100% 通过

## 11. 缺陷分级与处理时效
- P0：阻断发布/数据损坏/崩溃，24 小时内修复并回归。
- P1：核心功能不可用，48 小时内修复并回归。
- P2：功能可替代或部分异常，版本内修复。
- P3：体验优化类，进入 backlog 排期。

## 12. 准入/准出标准

### 准入（开始测试前）
1. 需求冻结并有变更记录。
2. 构建通过，测试数据可用。
3. 测试环境版本确认。

### 准出（发布前）
1. P0/P1 缺陷为 `0`。
2. 关键用例通过率 `>= 95%`。
3. PR 门禁与 RC 门禁全部通过。
4. 发布说明与已知问题清单已更新。

## 13. 角色分工
- 开发：单元测试、问题修复、技术支持。
- QA：测试设计、执行、缺陷流转、回归确认。
- 负责人（TL/PM）：发布决策、风险兜底、范围裁剪。

## 14. 近期两周落地计划
1. Week 1：
   - 建立 L0 门禁脚本并固化到 CI。
   - 完成关键手工回归清单（命令、链路、配置闭环）。
   - 补齐 `src/language` 关键规则单测骨架。
2. Week 2：
   - 引入集成测试（Extension <-> Webview 消息协议）。
   - 建立 nightly 回归任务与报告模板。
   - 形成 RC 发布清单并试跑一次。

## 15. 交付物
- QA Plan 文档（本文件）
- 回归用例清单（建议后续文件：`docs/outputs/QA_CASES_CadToolOnline.md`）
- 缺陷模板与日报模板（建议后续文件：`docs/outputs/QA_DEFECT_TEMPLATE.md`）

