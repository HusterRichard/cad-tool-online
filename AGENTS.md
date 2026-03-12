# CadToolOnline 的 AGENTS.md 说明

## Skills

### 可用项目技能

- `cad-scene-delivery`：CadToolOnline 单场景端到端交付流程。当用户提供 `SC01`、`SC12` 这类场景 ID，说“做 SCxx / 继续 SCxx”，或要求把某个场景从全局 PRD 一路推进到场景 PRD、场景计划、QA 计划、实现代码和测试时，使用该 skill。（文件：`./.codex/skills/cad-scene-delivery/SKILL.md`）

### 使用规则

- 触发规则：如果用户消息只有一个 `SCxx` 场景 ID，将其视为完整场景交付请求，并使用 `cad-scene-delivery`。
- Markdown 规则：项目内所有 `.md` 交付文档，包括 `PRD / PLAN / QA / traceability / summary` 等，统一使用简体中文书写，并以 UTF-8 保存。
- 默认范围：默认创建或更新该场景的 PRD、PLAN、QA、实现代码、回归测试和定向验证。
- 缩小范围：如果用户明确要求只做文档、只做计划或只做代码，则只执行对应子集。
- 现有文件：若场景已有同类文件，优先更新最新版本，而不是重复创建新的日期文件；除非用户明确要求新建修订版。
- 协同规则：当需要修改代码且 `tdd-workflow` 可用时，如果该变更适合 red-green-refactor，则一并使用；无论是否启用该 skill，结束前都要补回归覆盖。
- 渐进式读取：在大范围搜索仓库前，先运行 `python .codex/skills/cad-scene-delivery/scripts/lookup_scene.py SCxx`，并阅读 `.codex/skills/cad-scene-delivery/references/repo-conventions.md`。
