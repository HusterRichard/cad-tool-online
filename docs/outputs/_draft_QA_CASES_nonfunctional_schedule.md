# CadToolOnline 非功能与发布门禁测试用例草稿（含4周排期）

更新时间：`2026-03-05`  
适用版本：`0.1.x`

> 列结构沿用功能草稿：`用例ID | 模块 | 测试点 | 优先级 | 前置条件 | 执行步骤 | 预期结果 | 自动化建议 | 门禁阶段`

## 1. 非功能与发布门禁详细用例（至少20条）

| 用例ID | 模块 | 测试点 | 优先级 | 前置条件 | 执行步骤 | 预期结果 | 自动化建议 | 门禁阶段 |
|---|---|---|---|---|---|---|---|---|
| NF-PERF-001 | 构建性能 | `pnpm lint`耗时基线 | P0 | 依赖安装完成，工作区干净 | 执行`pnpm lint`，记录总耗时 | 命令成功；耗时稳定（建议基线`<=90s`） | CI每次PR执行并记录趋势 | PR Gate |
| NF-PERF-002 | 构建性能 | `pnpm exec tsc -p tsconfig.extension.json --noEmit`耗时基线 | P0 | 同上 | 执行类型检查命令并记录耗时 | 命令成功；无TS错误；耗时稳定（建议`<=60s`） | CI每次PR执行 | PR Gate |
| NF-PERF-003 | 构建性能 | `pnpm build:extension`耗时与产物体积 | P0 | 同上 | 执行`pnpm build:extension`；记录`dist/extension.cjs`大小 | 构建成功；产物存在；体积无异常突增（相对近3次均值`<20%`） | CI产物归档+阈值告警 | PR Gate |
| NF-PERF-004 | 构建性能 | `pnpm build:webview`耗时与产物体积 | P0 | 同上 | 执行`pnpm build:webview`；记录`dist`主要产物体积 | 构建成功；体积无异常突增（`<20%`） | CI产物归档+阈值告警 | PR Gate |
| NF-PERF-005 | 大文件性能 | STEP `50MB` 导入可用性与首屏时间 | P0 | 准备`50MB`样例STEP，已打开编辑器 | 导入文件并记录“开始导入->模型可操作”时间 | 可成功导入；无崩溃；首屏时间满足目标（建议`<=30s`） | 夜间回归脚本采样 | Nightly |
| NF-PERF-006 | 大文件性能 | STEP `100MB` 导入时间与交互延迟 | P0 | 准备`100MB`样例STEP | 导入后执行模型树选择、视图旋转 | 导入成功；核心交互可用；无卡死（单次交互冻结`<3s`） | 夜间回归脚本+人工抽检 | Nightly |
| NF-PERF-007 | 大文件性能 | STEP `200MB` 压力导入稳定性 | P1 | 准备`200MB`样例STEP，机器资源达标 | 连续导入2次并清场1次（`clearScene`） | 无崩溃；失败时有明确错误提示；进程可恢复 | 周回归专项执行 | RC Gate |
| NF-PERF-008 | 全量构建性能 | `pnpm build:all`总耗时 | P0 | WASM依赖已就绪 | 执行`pnpm build:all`并记录耗时 | 全量构建成功；耗时稳定（建议`<=20min`） | RC流水线执行 | RC Gate |
| NF-STAB-001 | 稳定性 | 60分钟连续操作稳定性 | P0 | 打开Webview并加载中等模型 | 60分钟内循环：选择/创建动作/导入导出配置 | 无崩溃、无白屏、无阻断错误弹窗 | 半自动脚本+人工观察 | Nightly |
| NF-STAB-002 | 稳定性 | 100次消息往返稳定性（Extension↔Webview） | P0 | 扩展可正常激活 | 连续触发导入/导出/刷新索引命令100次 | 消息无丢失；成功率`>=99%`；失败可重试 | 集成测试脚本化 | PR Gate |
| NF-STAB-003 | 稳定性 | 重复导入导出闭环20轮 | P0 | 准备合法`cadtool.config.json`与STEP样例 | 执行“导出->清场->导入”20轮并比对对象数量 | 每轮对象计数一致；无内存/状态污染 | Nightly固定套件 | Nightly |
| NF-STAB-004 | 稳定性 | 异常输入恢复能力 | P0 | 准备损坏JSON与缺字段JSON | 执行`Import CADTool Config`导入异常文件 | 不崩溃；给出warning/error；可继续正常导入合法文件 | PR轻量回归 + RC全量 | PR Gate |
| NF-STAB-005 | 稳定性 | 激活事件回归（activationEvents） | P0 | 安装扩展，清理缓存 | 在`json/jsonc/modelica`场景和命令场景触发激活 | 扩展可按预期激活；关键命令可执行 | 自动化命令探测脚本 | PR Gate |
| NF-BLD-001 | 构建 | `pnpm build`多包构建完整性 | P0 | 依赖安装完成 | 执行`pnpm build` | 所有workspace包构建成功；无阻断错误 | CI必跑 | PR Gate |
| NF-BLD-002 | 构建 | `pnpm build:wasm`（release）可重复成功 | P1 | CMake环境已安装，`setup:wasm`完成 | 执行`pnpm build:wasm`两次 | 两次均成功；无新增编译错误 | 周期性专项任务 | RC Gate |
| NF-BLD-003 | 构建 | `pnpm build:wasm:debug`调试构建可用 | P2 | 同上 | 执行`pnpm build:wasm:debug` | 构建成功；调试产物可供本地排错 | 手工按需 | Backlog/专项 |
| NF-BLD-004 | 构建 | `pnpm vscode:prepublish`一致性 | P1 | 工作区干净 | 执行`pnpm vscode:prepublish` | 与`build:all`结果一致，无遗漏步骤 | RC流水线固定检查 | RC Gate |
| NF-PKG-001 | 打包 | `pnpm package`产出VSIX | P0 | `vsce`可用、构建环境可用 | 执行`pnpm package` | 成功生成`.vsix`；命名/版本正确 | RC流水线必跑 | RC Gate |
| NF-PKG-002 | 打包 | VSIX干净环境安装与启动 | P0 | 使用全新VSCode Profile | 安装VSIX，执行`Open CAD Editor` | 扩展可激活；编辑器面板可正常打开 | RC手工验收 | RC Gate |
| NF-PKG-003 | 打包 | 打包前后命令可见性一致 | P1 | 本地开发安装+VSIX安装均可用 | 对比命令面板中的5个贡献命令 | 命令集合一致，无缺失 | 半自动对比脚本 | RC Gate |
| NF-COMP-001 | 兼容性 | Node `18.x`兼容构建 | P0 | 切换到Node 18环境 | 运行`pnpm lint` + `pnpm build:extension` + `pnpm build:webview` | 全部成功 | CI矩阵 | PR Gate |
| NF-COMP-002 | 兼容性 | Node `20.x`兼容构建 | P0 | 切换到Node 20环境 | 同上 | 全部成功 | CI矩阵 | PR Gate |
| NF-COMP-003 | 兼容性 | VSCode `1.80.x`安装运行兼容 | P1 | 准备1.80.x环境 | 安装VSIX并执行核心命令 | 核心命令可用；无版本阻断报错 | RC手工 | RC Gate |
| NF-COMP-004 | 兼容性 | 最新稳定版VSCode兼容 | P0 | 准备最新稳定版VSCode | 安装VSIX并执行核心命令 | 核心命令可用；Webview交互正常 | RC手工 | RC Gate |
| NF-COMP-005 | 兼容性 | OS兼容（Windows 11 / Ubuntu 22.04） | P1 | 双OS环境可用 | 在两套OS各执行PR Gate命令与核心命令冒烟 | 两端均可构建与运行 | CI+手工补充 | RC Gate |
| NF-SEC-001 | 安全基础 | 依赖漏洞基础扫描 | P1 | 网络可访问npm registry | 执行`pnpm audit --prod`并归档结果 | 无`critical`漏洞；`high`有处置记录 | Nightly执行+阈值告警 | Nightly |
| NF-SEC-002 | 安全基础 | 配置导入字段白名单/Schema约束 | P0 | 准备越权字段/类型错误JSON | 导入异常配置并观察行为 | 非法字段不应导致执行异常；校验错误可见 | PR轻量回归 | PR Gate |
| NF-SEC-003 | 安全基础 | Webview消息输入健壮性 | P0 | 可模拟异常消息payload | 注入超长/缺字段/非法类型消息 | 不崩溃；消息被拒绝或降级处理 | 集成测试脚本化 | PR Gate |
| NF-SEC-004 | 安全基础 | 命令路径参数安全（导入/导出） | P1 | 准备特殊字符路径、长路径 | 执行导入/导出命令并验证行为 | 无命令注入/路径穿越副作用；报错可控 | RC手工+脚本 | RC Gate |
| NF-SEC-005 | 安全基础 | 打包产物敏感信息检查 | P1 | 已生成VSIX | 检查产物中是否包含密钥/本地绝对路径/调试残留 | 不包含敏感信息；仅发布必要文件 | RC脚本扫描 | RC Gate |

## 2. 4周优先级执行排期（含入口/退出标准）

| 周次 | 周目标 | 本周优先级范围 | 用例范围（按ID） | 入口条件（Entry） | 退出条件（Exit） |
|---|---|---|---|---|---|
| 第1周 | 建立PR门禁基线，先稳住“能构建、能激活、不崩溃” | P0 | `NF-PERF-001~004`、`NF-STAB-002/004/005`、`NF-BLD-001`、`NF-COMP-001/002`、`NF-SEC-002/003` | 代码冻结到可测试分支；CI可运行`pnpm`命令；测试数据到位 | PR Gate用例通过率`>=95%`；P0阻断缺陷清零；形成首版耗时/体积基线 |
| 第2周 | 覆盖大文件性能与长稳，建立夜间回归节奏 | P0+P1 | `NF-PERF-005/006`、`NF-STAB-001/003`、`NF-SEC-001`、`NF-COMP-005`（Windows优先） | 第1周P0基线稳定；夜间任务可调度 | Nightly连续5天可运行；大文件100MB链路可稳定通过；输出性能趋势图 |
| 第3周 | 进入RC前构建/打包闭环，补齐兼容矩阵 | P0+P1 | `NF-PERF-008`、`NF-BLD-002/004`、`NF-PKG-001/002/003`、`NF-COMP-003/004/005`、`NF-SEC-004/005` | RC候选分支创建；版本号与发布信息确定 | RC Gate主流程全绿；VSIX安装验证通过；跨版本VSCode兼容通过 |
| 第4周 | 风险收敛与发布决策支持，处理残余P1/P2 | P1+P2（P0回归） | `NF-PERF-007`、`NF-BLD-003` + 全量P0回归抽样 | RC Gate已基本稳定；遗留缺陷已分级 | 发布建议评审通过；P0/P1为0；非阻断问题有明确延期与规避措施 |

### 周执行规则（统一）
- 每周一：更新优先级和缺陷看板，确认本周“必过ID列表”。
- 每周三：执行中期回顾，若P0回归失败，立即回滚到“仅P0修复+回归”策略。
- 每周五：输出周报（通过率、失败TOP、平均耗时、体积变化、风险变化）。

## 3. 基于风险的测试执行顺序（建议）

1. **发布阻断链路优先**：先跑`PR Gate`命令链（`lint`、`tsc --noEmit`、`build:extension`、`build:webview`、`build`），对应`NF-PERF-001~004`、`NF-BLD-001`、`NF-COMP-001/002`。  
2. **协议与稳定性次优先**：覆盖Extension↔Webview消息、异常输入恢复、激活事件，避免“功能看似存在但不可用”，对应`NF-STAB-002/004/005`、`NF-SEC-003`。  
3. **核心用户体感风险**：执行大文件导入与60分钟稳定性，优先`50MB/100MB`，再到`200MB`，对应`NF-PERF-005/006/007`、`NF-STAB-001/003`。  
4. **发布落地风险**：验证`build:all`、`vscode:prepublish`、`package`与VSIX安装闭环，确保“可交付”，对应`NF-PERF-008`、`NF-BLD-004`、`NF-PKG-001/002/003`。  
5. **环境差异风险**：补齐VSCode版本、OS矩阵，避免发布后环境不兼容，对应`NF-COMP-003/004/005`。  
6. **安全基础风险**：依赖漏洞、输入校验、路径安全与产物泄漏检查，作为RC前清底动作，对应`NF-SEC-001/002/004/005`。  

## 4. 发布门禁建议（可直接落地到CI）

- **PR Gate（必须）**  
  - `pnpm lint`  
  - `pnpm exec tsc -p tsconfig.extension.json --noEmit`  
  - `pnpm build:extension`  
  - `pnpm build:webview`  
  - 通过条件：以上命令全通过 + `NF-STAB-002/004/005`无P0缺陷

- **Nightly（建议）**  
  - `pnpm build`  
  - 大文件与长稳套件：`NF-PERF-005/006`、`NF-STAB-001/003`、`NF-SEC-001`  
  - 通过条件：连续5天无阻断；性能趋势无显著劣化（耗时/体积单日波动不超过20%）

- **RC Gate（必须）**  
  - `pnpm build:all`  
  - `pnpm package`  
  - VSIX安装冒烟 + 兼容矩阵关键项（`NF-PKG-001/002`、`NF-COMP-003/004`）  
  - 通过条件：P0/P1为0，门禁用例100%通过
