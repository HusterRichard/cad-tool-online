# 仓库约定

## 规范输入

- 全局场景映射：`docs/prd/global/GLOBAL_PRD_CADToolOnline_三维建模界面重建_2026-03-06.md`
- 帮助页索引：`ref/Docs/CADToolBox/pageData/page-data-list.json`
- 帮助页 HTML 根目录：`ref/Docs/CADToolBox/`
- 追踪基线：`docs/reference/GLOBAL_TRACEABILITY_CADTool_2026a_帮助页追踪表_2026-03-09.md`

## 输出路径

- PRD：`docs/prd/scenarios/SCxx_PRD_场景名_YYYY-MM-DD.md`
- PLAN：`docs/plan/scenarios/SCxx_PLAN_场景名_YYYY-MM-DD.md`
- QA：`docs/qa/plans/SCxx_QA_场景名_YYYY-MM-DD.md`

如果场景已经存在对应文档，优先更新最新文件。只有在找不到匹配文件，或用户明确要求新修订版时，才创建新的日期文件。

## Markdown 语言与编码

- 项目内所有 `.md` 交付文档统一使用简体中文。
- 项目 Markdown 文件统一保存为 UTF-8。
- 文件命名继续沿用 `docs/prd/scenarios`、`docs/plan/scenarios`、`docs/qa/plans` 下现有的中文命名模式。

## 文档期望

### PRD

- 包含场景元数据和信息来源。
- 明确区分帮助页目标行为与当前 MVP / 当前仓库边界。
- 写清 `In Scope` 与 `Out of Scope`。
- 定义 FR 和验收标准。
- 当仓库尚未达到帮助页目标态时，记录已知差距。

### PLAN

- 说明目标和现状摘要。
- 定义实施范围和技术方案。
- 按阶段拆分工作。
- 记录风险与应对。
- 以完成定义和验证命令收尾。

### QA

- 明确 QA 目标、范围、准入准出、环境与测试数据。
- 覆盖关键路径、负向用例、导入导出行为，以及与键盘或右键菜单相关的交互。
- 在文末附近列出自动化验证命令。

## 高信号基线场景

- `SC01`：接触工作流基线
- `SC02`：连接工作流基线
- `SC04`：设计点工作流基线
- `SC06`：驱动工作流基线
- `SC12`：导入工作流基线
- `SC13`：分组工作流基线

优先读取一到两个相邻基线，不要把所有场景都扫一遍。

## 实现锚点

- Ribbon 与扩展入口：`src/panels/CadEditorPanel.ts`、`src/extension.ts`
- Webview UI、状态与交互主链路：`src/webview/main.ts`
- Core 数据模型与共享逻辑：`packages/core/src`
- Core 回归测试：`packages/core/test`
- 应用层回归测试：`test`、`tests`

## 常用搜索模式

- `rg -n "SC06|motion|createMotion|motionProperties" src packages test tests docs`
- `rg -n "SC04|design point|createDesignPoint" src packages test tests docs`
- `rg -n "BuildMotions|BuildConnectors|BuildContacts" docs ref`
- `rg --files docs/prd/scenarios docs/plan/scenarios docs/qa/plans | rg "SC06_"`

将其中的 `SC06` 和关键词替换为当前目标场景。

## 验证规范

- 优先运行定向 `node --test ...` 命令。
- 变更 webview 时运行 `pnpm build:webview`。
- 变更 extension 侧时运行 `pnpm build:extension`。
- 只有当 TypeScript 改动面足够大时，再运行 `pnpm lint`。
- 如果当前 Windows 环境需要校验包含中文的 `SKILL.md`，使用 UTF-8 模式运行校验脚本，例如 `$env:PYTHONUTF8='1'; python ...`。
- 如果缺少有意义的自动化验证，必须明确说明仍然存在的人工验证缺口。

## 追踪表更新规则

只有当某个场景的实现状态或证据发生实质变化时，才更新 `docs/reference/GLOBAL_TRACEABILITY_CADTool_2026a_帮助页追踪表_2026-03-09.md`。
