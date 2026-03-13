# AI 编程七步法：CadToolOnline 项目实践分享

> 分享时长：15-20 分钟
> 项目：CadToolOnline — 将桌面版 CADToolbox 迁移为 VSCode 在线 CAD 插件
> 关键词：工业软件 Web 化、OCCT WebAssembly、场景化交付、AI 工程协作

---

## 一、开场：这次分享要解决什么问题

我们今天讨论的核心问题不是"AI 能不能帮我写代码"，而是：

**面对一个复杂的工业软件迁移项目，如何用一套方法把 AI 从问答助手变成工程交付的协作者？**

CadToolOnline 项目就是我们实践这个问题的载体。它不是一个普通的 Web 应用，而是一个从 C++/Qt 桌面体系向 Web 技术栈迁移的工业 CAD 工具。这个过程中，我们逐步沉淀出一套"七步法"，把 AI 编程嵌入从创意到交付的完整链路。

---

## 二、项目背景

### 2.1 原始产品：CADToolbox

CADToolbox 是一个桌面版三维 CAD 工具，技术栈为 Qt 5.14.2 + OCCT 7.7.0，支持：

- 读取 STEP 格式三维模型
- 分组设计、标架设计、关节设计、驱动设计
- 自动提取几何信息和物理属性
- 生成多体动力学系统模型与约束关系拓扑图

![CADToolbox 桌面版界面](./cadtool.png)

> 图注：CADToolbox 界面包含 (1) 工具栏 (2) Ribbon 功能区 (3) 模型树 (4) 三维视图 (5) 属性面板

### 2.2 目标产品：CadToolOnline

将 CADToolbox 的核心能力迁移到 VSCode 插件形态，在 Web 技术栈中实现三维 CAD 查看与多体动力学建模。

### 2.3 核心挑战

| 挑战维度 | 具体表现 |
|----------|----------|
| 几何内核迁移 | OCCT 原属 C++ 体系，需编译为 WebAssembly 才能在浏览器端调用 |
| 交互复杂度 | 三维拾取、对象树、属性面板、Ribbon 入口、导入导出全链路联动 |
| 领域知识密集 | 分组、标架、关节（7 种）、驱动、接触、流体对象均为专业概念 |
| 场景规模大 | 全局 PRD 拆出 SC01-SC60 共 60 个原型场景，无法一次性开发 |

> 来源：`TASK.md`、`CLAUDE.md`

---

## 三、七步法总览

![AI 编程七步法](./7-phase.png)

七步法将 AI 编程过程拆为七个阶段：

| 步骤 | 名称 | 核心问题 |
|------|------|----------|
| 1 | **Idea** | 把问题定义清楚 |
| 2 | **Research** | 把技术可行性跑通 |
| 3 | **Prototype** | 把界面和交互变成可视化事实 |
| 4 | **PRD** | 把复杂系统切成可交付的最小场景 |
| 5 | **Kanban** | 把目标、依赖和进度管理起来 |
| 6 | **Execute** | 按场景最小闭环推进代码实现 |
| 7 | **QA** | 让测试从第一天就进入主链路 |

**关键认知**：前 3 步偏顺序执行，解决不确定性；从第 4 步开始，PRD / Kanban / Execute / QA 四步强并行迭代，解决可交付性。

---

## 四、七步法在项目中的具体实践

### 4.1 Idea — 从任务书出发，把真正的问题暴露出来

**输入**：`TASK.md`

任务书定义了两个输入项目（CADToolbox、chili3d）和一个输出目标（CadToolOnline），并给出了两种可选技术方案：

- **方案一**：将 CADToolbox 全部 C++ 代码编译成 WASM — 依赖 Sysplorer SDK，体积不可控
- **方案二**：只将 OCCT 编译成 WASM，应用层用 TypeScript 重写 — 体积可控，可调试

这一步的关键产出不是答案，而是**让问题变得具体**：

- Web 化的最大障碍不是写页面，而是几何引擎能不能在浏览器跑起来
- 如果几何能力无法落地，后面的 UI、PRD、执行都没有意义

> AI 在这一步的角色：问题澄清器 — 帮助从模糊想法收敛到明确的工程命题

### 4.2 Research — 找到技术锚点，证明路线可行

**输入**：开源项目 `chili3d`（github.com/xiangechen/chili3d）

chili3d 给出了最关键的技术验证：

- OCCT 可以通过 Emscripten 编译为 WebAssembly
- 浏览器端可直接调用几何引擎完成 STEP 读取、网格化、属性计算
- 三维显示层由 three.js 承接

基于这一研究结论，项目在 `CLAUDE.md` 和 `.claude/agents/project-context.md` 中沉淀出可执行的技术架构：

| 层级 | 技术选型 |
|------|----------|
| 几何内核 | OCCT V8_0_0_rc3（WebAssembly） |
| 三维渲染 | three.js ^0.170.0 |
| 拓扑图 | @maxgraph/core |
| 工程形态 | VSCode Extension + Webview |
| 构建 | Vite + pnpm workspace |
| 应用层 | TypeScript 重写（方案二） |

![CadToolOnline 技术架构图](./cadtoolonline-technical-architecture.svg)

> AI 在这一步的角色：技术侦察兵 — 把"看起来能做"变成"知道该怎么做"

### 4.3 Prototype — 用原型把产品知识变成可视化事实

**输入**：CADToolbox 产品帮助文档（`ref/Docs/CADToolBox/`）
**输出**：`cadtoolonline.pen`（Pencil 格式 UI/UX 全量原型）

这一步做了两件关键的事：

**第一，生成全量原型。** 不是手工画几张线框图，而是基于帮助文档直接生成覆盖全部功能的高保真 UI 原型。原型文件 `cadtoolonline.pen` 包含主界面（多体/流体两种模式）和 60 个场景画板。

**第二，搭建真实骨架。** 原型阶段不只停留在图纸层面，同步搭起了软件架构：

```text
packages/
  core/      → MBS 领域模型（Group/Frame/Marker/Joint/Motion）
  geo/       → OCCT WASM 封装、STEP 读取、颜色工具
  three/     → Three.js 可视化与交互
  ui/        → UI 组件（Ribbon、模型树、属性面板）
src/
  extension.ts     → VSCode 扩展入口
  webview/main.ts  → 前端入口
```

**当前已具备的能力**（来自 `README.md`）：

- STEP 文件导入与层级读取
- Three.js 3D 场景展示与交互
- 标架/参考标架的智能 hover 吸附与辅助线预览
- 基础 MBS 数据结构
- 零件颜色读取与应用

> AI 在这一步的角色：原型生成器 — 把帮助文档从文字说明升级为可视化设计资产

### 4.4 PRD — 把六十个场景切出来，让复杂系统可以逐个交付

**输入**：CADToolbox 帮助文档（40 个操作页 + 20 个 FAQ/错误码页）
**输出**：两层 PRD 体系

**第一层：全局 PRD**

文件：`docs/prd/global/GLOBAL_PRD_CADToolOnline_三维建模界面重建_2026-03-06.md`

它完成了三件事：

1. 把帮助文档的 60 个操作页映射为 SC01-SC60 场景
2. 每个场景对应一个 `.pen` 画板，建立"文档-原型-PRD"的一一对应
3. 按模块统计功能范围：模型导入 12 页、多体设计 10 页、流体设计 6 页、设计工具 5 页...

**第二层：场景 PRD**

以 SC01（添加接触）为例，一份场景 PRD 包含：

- 信息来源追溯（帮助页、原型画板、当前代码）
- 帮助页目标态 vs 当前 MVP 边界
- 功能规格（In Scope / Out of Scope）
- 验收标准与已知差距

目前已输出 7 份场景 PRD（SC01/SC02/SC04/SC05/SC06/SC12/SC13）。

**更关键的是，我为场景交付创建了一个 skill。**

文件：`.codex/skills/cad-scene-delivery/SKILL.md`

当输入一个场景 ID（如 `SC01`），skill 会沿固定链路推进：

```
查场景映射 → 读全局 PRD 和帮助页 → 更新场景 PRD → 更新场景 PLAN
→ 更新场景 QA → 实现代码 → 补回归测试 → 运行验证
```

> AI 在这一步的角色：系统拆解器 — 当产品复杂到无法整体开发时，先切成可交付场景

### 4.5 Kanban — 让开发从"知道做什么"变成"知道先做什么"

**输出**：两类计划资产

**全局计划**：`docs/plan/global/` 下的全局开发计划，按帮助文档目录分层组织工作包：

| 工作包 | 内容 |
|--------|------|
| WP-BASE | 文档基线与导航 |
| WP-IMP | 导入、浏览与三维交互 |
| WP-MBS | 多体设计对象 |
| WP-FLUID | 流体设计对象 |
| WP-TOOL | 设计工具 |
| WP-EXPORT | 保存与导出 |

**场景计划**：目前已输出 6 份场景 PLAN（SC01/SC02/SC04/SC05/SC06/SC13），每份包含：

- 当前实现现状
- 技术方案与实施阶段
- 风险识别
- 完成定义与验证命令

看板在这里解决的核心问题是：**AI 会给你很多正确建议，但不会替你管理顺序和依赖。**

> AI 在这一步的角色：计划生成器 — 把阶段目标拆成有优先级、有依赖关系的任务

### 4.6 Execute — 按场景最小闭环迭代，把流程固化为技能

**核心模式**：PRD 文档、Plan 文档与代码实现同步迭代

这不是"先写完文档再写代码"的瀑布模式，而是三者在每个场景内并行演进：

```
PRD 描述不准确 → 修正 PRD → 调整 Plan → 更新代码 → 补充测试 → 再次验证
```

**一个关键规律**：当 PRD 文档已经能够准确描述产品功能时，代码开发通常也接近完成。文档和代码的同步程度，本身就是交付质量的信号。

这一流程已固化为 skill（`.codex/skills/cad-scene-delivery`），使得每个场景都能按统一标准推进，而不是每次从零开始。

此外，项目还沉淀了多个领域 skill 支撑开发执行：

| Skill | 用途 |
|-------|------|
| `mbs-domain` | 多体动力学领域知识 |
| `threejs-patterns` | Three.js 渲染模式 |
| `embind-patterns` | Emscripten Embind 绑定模式 |
| `tdd-workflow` | 测试驱动开发工作流 |

> AI 在这一步的角色：流程执行器 — 从"会回答"变成"会按流程交付"

### 4.7 QA — 测试不是收尾动作，而是迭代的稳定器

**核心原则**：QA 与第 4-6 步同步推进，不是最后补一轮。

当前测试体系（来自 `tests/README.md`）：

```text
包内单元测试（贴近代码）         根 tests/（跨包、集成、回归）
├─ packages/core/test/          ├─ tests/unit/extension/
├─ packages/geo/src/__tests__/  ├─ tests/unit/webview/
└─ packages/three/test/         ├─ tests/integration/step-import/
                                └─ tests/helpers/
```

运行方式：

```bash
pnpm test              # 全量：core + geo + three + root tests
pnpm test:root:run     # 仅跨包/集成测试
```

场景级 QA 计划目前已输出 4 份（SC01/SC02/SC04/SC06），每份包含：

- 测试范围（In Scope / Out of Scope）
- 关键路径与边界场景
- 自动化验证命令
- 帮助页目标态与 MVP 的可接受差异

**两个关键实践**：

1. 测试不是开发完成后的证明，而是开发过程中的护栏
2. 每次修改代码后，执行对应影响范围内的测试，保证改动可验证、可回归

> AI 在这一步的角色：质量守门员 — 在持续修改中维持可控性

---

## 五、七步法为什么有效

### 5.1 它先建立事实源，再让 AI 工作

| 事实源 | 文件 | 作用 |
|--------|------|------|
| 问题定义 | `TASK.md` | 锚定工程命题 |
| 技术方案 | `CLAUDE.md` + `project-context.md` | 锚定架构决策 |
| 可视化原型 | `cadtoolonline.pen` | 锚定交互设计 |
| 产品拆解 | 全局 PRD + 60 个场景 | 锚定功能边界 |
| 执行流程 | `cad-scene-delivery` skill | 锚定交付标准 |
| 验证规范 | `tests/README.md` + QA 计划 | 锚定质量基线 |

事实源越清楚，AI 的产出越稳定、越可验证。

### 5.2 它把复杂系统切成了可交付单元

SC01-SC60 的场景化拆分，让每次 AI 交互的上下文更小、目标更清楚、结果更容易验证。

### 5.3 它让文档、计划、代码、测试同步演化

很多团队的问题不是"AI 写的代码不好"，而是文档和代码脱节、计划和执行脱节、测试和实现脱节。七步法从一开始就把四者放到一个迭代闭环里。

### 5.4 它把 AI 的输出从一次性回答变成可复用的工程资产

单次 prompt 的价值有限。skill、PRD、原型、测试规范、领域 agent 才是可持续复用的工程资产。

### 5.5 它真正减少的是返工成本

复杂项目里最贵的不是写代码，而是返工。七步法让技术路线更早收敛、交互原型更早对齐、场景边界更早明确、回归风险更早暴露。

---

## 六、当前进度一览

| 维度 | 数量 | 说明 |
|------|------|------|
| 全局 PRD | 1 份 | 覆盖 60 场景、62 画板 |
| 场景 PRD | 7 份 | SC01/02/04/05/06/12/13 |
| 场景 PLAN | 6 份 | SC01/02/04/05/06/13 |
| 场景 QA | 4 份 | SC01/02/04/06 |
| 领域 Skill | 5 个 | scene-delivery / mbs / threejs / embind / tdd |
| 已实现能力 | — | STEP 导入、3D 可视化、标架吸附、MBS 数据模型、零件颜色 |

---

## 七、可复用的方法经验

1. **从问题定义开始，不从代码开始。** Idea 没做清楚，后面的代码越多，偏差越大。

2. **研究阶段要找到"可落地的技术锚点"。** 本项目的锚点是 `chili3d + WebAssembly + OCCT`，没有它 Web 化只是口号。

3. **原型是后续开发的事实源，不是附件。** 把帮助文档转成 `.pen` 原型，相当于把产品知识从说明书升级为可执行的设计资产。

4. **复杂产品必须场景化。** 面对六十个场景的工业软件，正确做法不是一口吃掉，而是一次交付一个最小闭环。

5. **QA 必须前置。** 只有每轮修改都伴随测试，AI 才能在持续迭代中保持可控。

---

## 八、结语

> **AI 编程真正适合解决的，不只是"写代码更快"，而是"让复杂工程从模糊走向可验证交付"。**

复杂项目里，AI 最有价值的地方不是替代工程方法，而是放大工程方法。方法一旦正确，AI 就不只是生成器，而能成为可持续协作的交付系统。

---

## 附录：汇报时可展示的仓库材料

| 类别 | 文件 |
|------|------|
| 七步法配图 | [`7-phase.png`](./7-phase.png) |
| 桌面版截图 | [`cadtool.png`](./cadtool.png) |
| 技术架构图 | [`cadtoolonline-technical-architecture.svg`](./cadtoolonline-technical-architecture.svg) |
| 问题定义 | [`TASK.md`](../../../TASK.md) |
| 技术方案 | [`CLAUDE.md`](../../../CLAUDE.md) |
| 项目上下文 | [`.claude/agents/project-context.md`](../../../.claude/agents/project-context.md) |
| 产品说明 | [`README.md`](../../../README.md) |
| UI 原型 | [`cadtoolonline.pen`](../../../cadtoolonline.pen) |
| 全局 PRD | [`GLOBAL_PRD_...2026-03-06.md`](../../prd/global/GLOBAL_PRD_CADToolOnline_三维建模界面重建_2026-03-06.md) |
| 场景 PRD 示例 | [`SC01_PRD_添加接触_2026-03-11.md`](../../prd/scenarios/SC01_PRD_添加接触_2026-03-11.md) |
| 场景 PLAN 示例 | [`SC01_PLAN_添加接触_2026-03-11.md`](../../plan/scenarios/SC01_PLAN_添加接触_2026-03-11.md) |
| 场景 QA 示例 | [`SC01_QA_添加接触_2026-03-11.md`](../../qa/plans/SC01_QA_添加接触_2026-03-11.md) |
| 场景交付 Skill | [`.codex/skills/cad-scene-delivery/SKILL.md`](../../../.codex/skills/cad-scene-delivery/SKILL.md) |
| 测试规范 | [`tests/README.md`](../../../tests/README.md) |
