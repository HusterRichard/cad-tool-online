# CadToolOnline 功能 QA 用例草案（Draft）

## Assumptions
- 测试环境：Windows 11，VS Code >= 1.90，Node.js >= 18，已安装当前分支构建的 CadToolOnline 扩展。
- 测试数据：准备 1 个可成功导入且包含至少 2 个零件的 STEP 文件（示例名：`qa-data/valid-2parts.step`）。
- 配置数据：准备 `qa-data/valid-cadtool.config.json`、`qa-data/invalid-json-syntax.json`、`qa-data/invalid-root-array.json`、`qa-data/invalid-missing-fields.json`、`qa-data/invalid-ribslice-ref.json`、`qa-data/duplicate-group.json`。
- 语言特性数据：工作区可创建/编辑 `cadtool.config.json`、`.cadtoolrc.json`、`qa-data/main.mo`。
- 分层口径：L0=命令/激活冒烟，L1=语言特性，L2=Extension 与 Webview 集成，L3=端到端场景。

| Case ID | Priority (P0/P1/P2) | Layer(L0/L1/L2/L3) | Preconditions | Steps | Expected | Automation(Yes/No) | Owner(Role) |
|---|---|---|---|---|---|---|---|
| CMD-001 | P0 | L0 | 扩展已安装并启用 | 1. `Ctrl+Shift+P` 打开命令面板。<br>2. 执行 `CadToolOnline: Open CAD Editor`。 | 打开标题为 `CAD Editor` 的 Webview；状态从 `Initializing...` 变为 `Ready`。 | Yes | SDET |
| CMD-002 | P1 | L0 | 已执行 CMD-001 | 1. 再次执行 `CadToolOnline: Open CAD Editor`。 | 不新增第二个 CAD Editor 面板，现有面板被激活/置前。 | Yes | SDET |
| CMD-003 | P1 | L0 | 扩展已安装 | 1. 执行 `CadToolOnline: Open CADTool Docs`。 | 系统浏览器打开官方文档 URL，地址包含 `CADToolBox.html`；无失败提示。 | No | QA手工 |
| CMD-004 | P0 | L0 | 未打开 CAD Editor 面板 | 1. 执行 `CadToolOnline: Export CADTool Config`。 | 弹出信息：`Please open CAD Editor first, then export CADTool config.` | Yes | SDET |
| CMD-005 | P0 | L0 | 未打开 CAD Editor 面板 | 1. 执行 `CadToolOnline: Import CADTool Config`。 | 弹出信息：`Please open CAD Editor first, then import CADTool config.` | Yes | SDET |
| CMD-006 | P1 | L0 | 工作区存在 `cadtool.config.json` | 1. 执行 `CadToolOnline: Refresh CADTool Index`。 | 弹出提示：`CADTool index refreshed`。 | Yes | SDET |
| CMD-007 | P1 | L0 | 扩展已安装 | 1. 打开命令面板并输入 `CadToolOnline`。 | 命令列表包含 `Open CAD Editor`、`Open CADTool Docs`、`Refresh CADTool Index`、`Export CADTool Config`、`Import CADTool Config`。 | Yes | SDET |
| CMD-008 | P1 | L0 | 新开工作区窗口 | 1. 新建文件 `cadtool.config.json` 并打开。<br>2. 在 JSON 中输入 `"` 触发补全。 | 无需手工先执行激活命令，已出现 CADTool 相关字段补全（如 `group`、`marker`）。 | Yes | SDET |
| WV-001 | P0 | L2 | 执行 CMD-001 | 1. 观察面板底部状态栏。 | Webview 初始化完成后显示 `Ready`，无 `Initialization failed`。 | No | Webview QA |
| WV-002 | P1 | L2 | 已打开 CAD Editor | 1. 点击 Ribbon `IMP`。<br>2. 在文件选择框点击取消。 | 不报错；模型树仍为 `No model loaded`；状态保持 `Ready`。 | No | Webview QA |
| WV-003 | P0 | L3 | 已打开 CAD Editor，准备好 `qa-data/valid-2parts.step` | 1. 点击 Ribbon `IMP`。<br>2. 选择有效 STEP 文件导入。 | 3D 视图加载模型；模型树出现节点；状态最终回到 `Ready`。 | No | Webview QA |
| WV-004 | P0 | L2 | 已导入模型 | 1. 在模型树点击任一零件节点。 | 该节点高亮选中；右侧 Properties 面板显示对应对象信息。 | No | Webview QA |
| WV-005 | P1 | L2 | 已导入模型 | 1. 在 3D 视图点击可选中实体。 | 模型树同步到对应节点；Properties 面板同步更新（避免选择环路）。 | No | Webview QA |
| WV-006 | P1 | L2 | 已导入模型且已手动旋转/平移视角 | 1. 点击 Ribbon `FIT`。 | 模型重新居中并完整进入视口。 | No | Webview QA |
| WV-007 | P0 | L2 | 已导入模型并产生过选择 | 1. 点击 Ribbon `CLR`。 | 模型树恢复 `No model loaded`；Properties 恢复默认提示；状态 `Ready`；历史选择被清空。 | No | Webview QA |
| WV-008 | P1 | L2 | 已导入模型 | 1. 切到其他编辑器标签页。<br>2. 返回 `CAD Editor`。 | 由于 `retainContextWhenHidden=true`，模型与 UI 状态保留，不会自动清空。 | No | Webview QA |
| WV-009 | P1 | L2 | 当前场景为空 | 1. 点击 Ribbon `X`（爆炸视图）。 | 弹出提示 `Please load a model first`；不进入爆炸模式。 | No | Webview QA |
| WV-010 | P1 | L2 | 已导入模型 | 1. 点击 Ribbon `X`。<br>2. 拖动爆炸滑块到 `50%`。<br>3. 再关闭爆炸模式。 | 进入爆炸模式时出现滑块；拖动后模型分离；退出后滑块回 `0%` 且模型复位。 | No | Webview QA |
| RIB-001 | P0 | L3 | 已导入模型并选中 1 个零件 | 1. 点击 Ribbon `createGroup`。 | 状态信息包含 `Group created`；Properties 出现 `Group Properties`；成员包含当前选中零件。 | No | Webview QA |
| RIB-002 | P1 | L2 | 已完成 RIB-001 | 1. 点击 Ribbon `createChildGroup`。 | 新建子组成功；Properties 中 `Parent` 指向上一组 ID。 | No | Webview QA |
| RIB-003 | P1 | L2 | 场景已清空，且没有任何 group | 1. 点击 Ribbon `groupProperties`。 | 弹出提示 `No group available. Please create a group first.` | No | Webview QA |
| RIB-004 | P0 | L2 | 已导入模型但未选中零件 | 1. 点击 Ribbon `createFrame`。 | 弹出提示 `Please select a part first to create a marker`。 | No | Webview QA |
| RIB-005 | P0 | L3 | 已导入模型并选中零件 | 1. 点击 Ribbon `createFrame`。<br>2. 在模型可见面上单击一次。 | 光标变十字后进入打点模式；点击面后创建 `MarkerN`，状态回 `Ready`，并提示创建成功。 | No | Webview QA |
| RIB-006 | P1 | L2 | 当前无 marker | 1. 点击 Ribbon `deleteFrame`。 | 弹出提示 `No markers to delete`。 | No | Webview QA |
| RIB-007 | P1 | L2 | 至少已创建 1 个 marker | 1. 点击 Ribbon `deleteFrame`。 | 删除最后创建的 marker；提示 `Marker "xxx" deleted`；状态信息更新。 | No | Webview QA |
| RIB-008 | P0 | L2 | 已导入模型，但选择历史不足 2 个不同零件 | 1. 点击任一关节动作（如 `createJoint_revolute`）。 | 弹出提示 `Need at least two selected parts to create a joint.` | No | Webview QA |
| RIB-009 | P0 | L3 | 已导入包含 2+ 零件模型，已依次选中两个不同零件 | 1. 点击 `createJoint_revolute`。 | 成功创建关节；Properties 显示 `Joint Properties`，`Type=revolute`，`Part 1/Part 2` 正确。 | No | Webview QA |
| RIB-010 | P1 | L2 | 同 RIB-009 前置 | 1. 点击 `createJoint_prismatic`。 | 成功创建第二个关节；类型为 `prismatic`。 | No | Webview QA |
| RIB-011 | P0 | L2 | 当前无关节 | 1. 点击 `createMotion_translational`。 | 弹出提示 `No joint found. Please create a joint first.` | No | Webview QA |
| RIB-012 | P0 | L3 | 已存在至少 1 个关节 | 1. 点击 `createMotion_translational`。 | 成功创建 motion；Properties 显示 `Motion Type=translational`，`Connector Ref` 指向最新关节名。 | No | Webview QA |
| RIB-013 | P1 | L2 | 已存在至少 1 个 motion | 1. 点击 `motionProperties`。 | Properties 展示最近 motion 的详细字段（ID/Name/Motion Type/Connector Ref）。 | No | Webview QA |
| RIB-014 | P1 | L2 | 已导入模型，可选中零件 | 1. 选中任意零件。<br>2. 点击 `fluidTankSlice`。 | 创建 `RibSliceN` 成功；Properties 显示 `Fluid Slice Properties`。 | No | Webview QA |
| RIB-015 | P1 | L2 | 已完成 RIB-014 | 1. 点击 `fluidPort`。 | 创建 `FluidPortN`；`portType=variableTankGasPort`；`Rib Slice Ref` 自动引用最近 `RibSlice`。 | No | Webview QA |
| RIB-016 | P1 | L2 | 未选中任何零件 | 1. 点击 `measureTool`。 | 弹出提示 `Please select a shape first.` | No | Webview QA |
| RIB-017 | P1 | L2 | 已导入模型并选中带网格数据的零件 | 1. 点击 `measureTool`。 | Properties 显示 `Measurement`，包含 `Size X/Y/Z` 与 `Min/Max`。 | No | Webview QA |
| RIB-018 | P1 | L2 | 未选中任何零件 | 1. 点击 `surfaceThicken`。 | 弹出提示 `Please select a shape before surface thickening.` | No | Webview QA |
| RIB-019 | P1 | L2 | 已选中零件 | 1. 点击 `surfaceThicken`。 | 状态信息显示 `Surface thickening target: <shape>`。 | No | Webview QA |
| RIB-020 | P1 | L2 | 未选中任何零件 | 1. 点击 `planarRingProcess`。 | 弹出提示 `Please select a shape before planar ring processing.` | No | Webview QA |
| CFG-001 | P0 | L2 | 已打开 CAD Editor 且已创建若干 MBS/Fluid 实体 | 1. 执行命令 `CadToolOnline: Export CADTool Config`。<br>2. 保存为 `tmp/exported.cadtool.config.json`。 | 导出成功提示出现；文件存在且是 JSON；包含 `group/marker/connector/motion/fluidPort/ribSlice/gravity/medium` 根键。 | Yes | SDET |
| CFG-002 | P0 | L2 | 已打开 CAD Editor | 1. 执行命令 `CadToolOnline: Import CADTool Config`。<br>2. 选择 `qa-data/valid-cadtool.config.json`。 | 导入完成提示包含统计摘要（groups/markers/connectors/motions/ribSlices/fluidPorts/skipped）。 | Yes | SDET |
| CFG-003 | P0 | L3 | 可创建实体并可读写文件 | 1. 在 Webview 内创建 group、marker、joint、motion、ribSlice、fluidPort。<br>2. 导出配置到文件 A。<br>3. 点击 `CLR` 清空场景。<br>4. 导入文件 A。 | 导入后关键计数与导出前一致（group/marker/connector/motion/ribSlice/fluidPort）。 | No | QA手工 |
| CFG-004 | P1 | L2 | 已打开 CAD Editor | 1. 执行导入命令并选择 `qa-data/invalid-json-syntax.json`。 | 扩展侧报错 `Failed to import CADTool config: ...`，不会导致 Webview 卡死。 | Yes | SDET |
| CFG-005 | P1 | L2 | 已打开 CAD Editor | 1. 导入 `qa-data/invalid-root-array.json`（根节点为数组）。 | 导入失败提示：`CADTool config must be a JSON object.` 或 `payload must be a JSON object.` | Yes | SDET |
| CFG-006 | P1 | L2 | 已打开 CAD Editor | 1. 导入 `qa-data/invalid-missing-fields.json`（含缺失必填字段的 connector/motion/fluidPort）。 | 导入完成但 `skipped>0`；出现 warnings，明确指出缺失字段条目被跳过。 | Yes | SDET |
| CFG-007 | P1 | L2 | 已打开 CAD Editor | 1. 导入 `qa-data/invalid-ribslice-ref.json`（fluidPort 引用不存在 ribSlice）。 | 导入不中断；出现 warning：`references unknown ribSliceRef`；fluidPort 其余字段仍被保留。 | Yes | SDET |
| CFG-008 | P2 | L2 | 已打开 CAD Editor | 1. 导入 `qa-data/duplicate-group.json`（含重复 group 名）。 | 导入完成；warning 包含 `Duplicate group name`，并说明后项覆盖引用。 | Yes | SDET |
| LANG-001 | P0 | L1 | 打开 `cadtool.config.json` | 1. 在根对象内输入 `"` 触发补全。 | 可补全根字段（如 `group`、`marker`、`connector`、`motion`、`fluidPort`）。 | Yes | 语言服务SDET |
| LANG-002 | P0 | L1 | `cadtool.config.json` 中存在 connector 对象 | 1. 在 `"connectorType": ""` 的引号内触发补全。 | 枚举补全包含 `fixed/revolute/prismatic/cylindrical/spherical/universal/planar`。 | Yes | 语言服务SDET |
| LANG-003 | P0 | L1 | 同文件已有 `connector` 名称 `J1` | 1. 在 motion 对象 `"connectorRef": ""` 内触发补全。 | 候选包含现有引用值（如 `J1`）。 | Yes | 语言服务SDET |
| LANG-004 | P1 | L1 | 打开 `cadtool.config.json` | 1. 光标悬停在字段名 `iconSize` 上。 | Hover 显示字段说明，包含范围信息（1~50000）。 | Yes | 语言服务SDET |
| LANG-005 | P0 | L1 | 打开 `cadtool.config.json` | 1. 写入非法名称（如 `"name": "1bad-name"`）。<br>2. 打开 Quick Fix。 | 产生 `invalidName` 诊断；Quick Fix 可用 `Normalize name to ...` 并修复为合法命名。 | Yes | 语言服务SDET |
| LANG-006 | P0 | L1 | 打开 `cadtool.config.json` | 1. 新建 connector 对象，仅填 `name/part1/part2`，缺失 `connectorType`。<br>2. 打开 Quick Fix。 | 产生缺失必填字段诊断；Quick Fix `Add required field "connectorType"` 可插入默认值。 | Yes | 语言服务SDET |
| LANG-007 | P0 | L1 | 打开 `cadtool.config.json`，已有真实 connector 名 `Joint_A` | 1. 在 motion 中设置 `"connectorRef": "NotExist"`。<br>2. 打开 Quick Fix。 | 产生未解析引用诊断；Quick Fix 提供 `Replace with "Joint_A"` 等候选并可一键替换。 | Yes | 语言服务SDET |
| LANG-008 | P1 | L1 | 打开 `cadtool.config.json` | 1. 设置 `"iconSize": 999999` 或 `position` 越界值。<br>2. 打开 Quick Fix。 | 出现范围诊断；Quick Fix `Clip ...` 可将值裁剪到允许区间。 | Yes | 语言服务SDET |
| LANG-009 | P0 | L1 | 工作区有 `cadtool.config.json` 且定义了 group/connector 名称；打开 `qa-data/main.mo` | 1. 在 `.mo` 文件中输入 `connectorRef = "` 后触发补全。<br>2. 修改 `cadtool.config.json` 新增名称并保存。<br>3. 执行 `CadToolOnline: Refresh CADTool Index` 后再次触发补全。 | Modelica 补全可给出配置中的引用名；刷新索引后新名称立即可见。 | Yes | 语言服务SDET |
