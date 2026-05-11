# SC36 PRD: 生成 Modelica 模型

## 1. 文档信息

- 场景 ID: `SC36`
- 场景名称: 生成 Modelica 模型
- 对应画板: `SC36_SCREEN`
- 文档版本: `v1.0`
- 整理日期: `2026-05-08`
- 项目: `CadToolOnline`

## 2. 信息来源

- 全局场景映射:
  - `docs/prd/global/GLOBAL_PRD_CADToolOnline_三维建模界面重建_2026-03-06.md`
- 官方帮助页:
  - `ref/Docs/CADToolBox/Doc/CADToolBox/HowToUseCADToolBox/ToModelicaModel.html`
  - `ref/Docs/CADToolBox/pageData/page-data-list.js`
- 关联案例:
  - `ref/Docs/CADToolBox/Doc/CADToolBox/ApplicationCases/Bulldozer.html`
  - `ref/Docs/CADToolBox/Doc/CADToolBox/ApplicationCases/PickAndPlace.html`
- 当前实现与测试:
  - `src/webview/main.ts`
  - `src/panels/CadEditorPanel.ts`
  - `src/standalone/browserHost.ts`
  - `packages/core/src/modelicaExport.ts`
  - `packages/core/test/modelica-export.spec.ts`
  - `tests/unit/extension/cad-editor-panel.spec.ts`

## 3. 背景与目标

帮助页中的 `SC36` 表示多体设计完成后，用户通过 Ribbon `接受并退出` 进入导出流程，输入模型包名后，系统在工程目录下生成可继续用于后续建模的导出产物。

本次 `SC36 MVP` 的目标不是一次性补齐完整 `package.mo / main 模型 / 快速预览 / 平台内自动打开模型` 全链路，而是先落地当前仓库可自证的导出闭环：

- 以模型包名创建导出目录
- 生成 `Visualizers` 子目录
- 为每个分组导出图片与 `dxf`
- 在模型包目录下生成 `mb.json`
- 将标架、连接、驱动等多体设计信息纳入 `mb.json`

## 4. 目标用户

- 已在 CADToolOnline 中完成分组、标架、连接、驱动设计的建模工程师
- 需要把当前多体设计结果导出为可落盘文件的仿真工程师

## 5. 范围定义

### 5.1 In Scope

- Ribbon `接受并退出`
- 输入模型包名
- 在工作区根目录下创建模型包目录
- 创建 `Visualizers` 子目录
- 为每个分组生成图片文件
- 为每个分组生成 `dxf` 文件
- 生成 `mb.json`
- `mb.json` 中导出：
  - 分组
  - 标架
  - 连接
  - 驱动

### 5.2 Out of Scope

- 生成完整 `package.mo`
- 生成 `*_main`、组件模型和信号源模型
- 平台内自动打开导出的 Modelica 模型
- 快速预览入口与预览设置弹窗
- 生成模型类型切换（本次固定为多体）
- 帮助页截图级视觉一致性

## 6. 目标态交互

### 6.1 主流程

1. 用户完成多体设计。
2. 用户点击 Ribbon `检查`，处理必要问题。
3. 用户点击 Ribbon `接受并退出`。
4. 系统弹出输入框，要求用户输入模型包名。
5. 用户确认后，系统在当前工作区根目录下创建同名文件夹。
6. 系统在该文件夹下创建 `Visualizers` 子目录。
7. 系统输出每个分组的图片和 `dxf` 文件。
8. 系统在模型包目录根部输出 `mb.json`。

### 6.2 导出后的目录结构

```text
<packageName>/
  mb.json
  Visualizers/
    <GroupA>.png
    <GroupA>.dxf
    <GroupB>.png
    <GroupB>.dxf
```

## 7. 功能需求

### 7.1 FR-01 包名输入

- 系统必须在 `接受并退出` 后弹出包名输入框。
- 系统必须按 Modelica 命名规则规范化包名。
- 当用户取消输入时，系统不得创建任何导出文件。

### 7.2 FR-02 导出目录创建

- 系统必须在工作区根目录下创建模型包目录。
- 系统必须在模型包目录下创建 `Visualizers` 子目录。
- 系统必须允许覆盖同名导出文件。

### 7.3 FR-03 分组图片

- 系统必须为每个分组生成一张图片。
- 图片文件必须保存到 `Visualizers` 目录。
- 图片文件名必须与分组名一一对应，并进行合法文件名规整。

### 7.4 FR-04 分组 DXF

- 系统必须为每个分组生成一个 `dxf` 文件。
- `dxf` 必须保存到 `Visualizers` 目录。
- 当前 MVP 中，`dxf` 以分组下几何边线段导出为基础 `LINE` 实体。

### 7.5 FR-05 `mb.json` 顶层结构

- 系统必须在模型包目录根部生成 `mb.json`。
- `mb.json` 顶层至少包含：
  - `packageName`
  - `group`
  - `marker`
  - `connector`
  - `motion`

### 7.6 FR-06 分组导出字段

`group` 数组中的每个对象必须包含：

- `name`
- `totalMass`
- `inertiaTensor`
- `imageFile`
- `dxfFile`

其中：

- `totalMass` 为分组递归包含零件的总质量
- `inertiaTensor` 为分组递归包含零件的惯性张量
- `imageFile` / `dxfFile` 为相对于模型包目录的相对路径

### 7.7 FR-07 标架导出字段

`marker` 数组中的每个对象必须包含：

- `name`
- `groupRef`
- `position`
- `direction`

本次导出中，普通标架与参考标架统一按“标架”导出。

### 7.8 FR-08 连接导出字段

`connector` 数组中的每个对象必须包含：

- `name`
- `connectorType`
- `groupRef1`
- `groupRef2`
- `position`
- `direction`

其中 `groupRef1` / `groupRef2` 优先输出所属分组名称；若对象尚未分组，则退化为零件名称或 `Ground`。

### 7.9 FR-09 驱动导出字段

`motion` 数组中的每个对象必须包含：

- `name`
- `motionType`
- `connectorRef`

### 7.10 FR-10 错误处理

- 当当前没有加载 CAD 模型时，系统必须阻止导出并提示错误。
- 当导出载荷非法、路径越界或文件写入失败时，系统必须提示导出失败。

## 8. 数据契约

### 8.1 `mb.json` 示例

```json
{
  "packageName": "ExcavatorArm",
  "group": [
    {
      "name": "Base",
      "totalMass": 12.5,
      "inertiaTensor": {
        "m": [1, 0, 0, 0, 2, 0, 0, 0, 3]
      },
      "imageFile": "Visualizers/Base.png",
      "dxfFile": "Visualizers/Base.dxf"
    }
  ],
  "marker": [
    {
      "name": "Frame1",
      "groupRef": "Base",
      "position": { "x": 0, "y": 0, "z": 0 },
      "direction": { "x": 0, "y": 0, "z": 1 }
    }
  ],
  "connector": [
    {
      "name": "Joint1",
      "connectorType": "revolute",
      "groupRef1": "Base",
      "groupRef2": "Arm",
      "position": { "x": 1, "y": 2, "z": 3 },
      "direction": { "x": 0, "y": 1, "z": 0 }
    }
  ],
  "motion": [
    {
      "name": "Drive1",
      "motionType": "translational",
      "connectorRef": "Joint1"
    }
  ]
}
```

## 9. 验收标准

### 9.1 功能验收

- 点击 `接受并退出` 后可以输入模型包名。
- 工作区根目录下生成模型包目录与 `Visualizers` 子目录。
- 每个分组都生成对应图片与 `dxf` 文件。
- 模型包目录根部生成 `mb.json`。

### 9.2 数据验收

- `mb.json` 中 `group / marker / connector / motion` 四类数据齐全。
- `group` 中的 `imageFile / dxfFile` 路径与实际输出文件一致。
- `group.totalMass / group.inertiaTensor` 来自当前多体设计状态的递归聚合结果。

### 9.3 工程验收

- webview 构建通过
- extension 构建通过
- 定向单测通过

## 10. 当前实现对照

| 模块 | 帮助页目标态 | 当前 MVP | 结论 |
|---|---|---|---|
| `接受并退出` 入口 | 打开导出流程 | 已改为触发 `SC36` 导出流程 | 已落地 |
| 包名输入 | 输入包名并继续导出 | 通过 `showInputBox` 输入包名 | 已落地 |
| 目录创建 | 生成模型包目录 | 已在工作区根目录创建同名目录 | 已落地 |
| `Visualizers` | 输出分组资源 | 已输出分组图片与 `dxf` | 已落地 |
| `mb.json` | 输出多体设计信息 | 已输出组/标架/连接/驱动 | 已落地 |
| 完整 Modelica 包 | 生成平台用户模型 | 尚未生成 `package.mo / main` | 未完成 |
| 快速预览 | 帮助页含快速预览说明 | 当前未实现 | 未完成 |

## 11. 已知差距

- 当前 `SC36 MVP` 只交付导出目录、`Visualizers` 和 `mb.json`，尚未生成完整 Modelica 工程文件。
- 当前分组图片为从当前三维视图隔离分组后的截图结果，不保证与帮助页示意图一致。
- 当前 `dxf` 输出基于已提取边线段生成基础 `LINE` 实体，未覆盖更复杂的 CAD 绘图语义。

## 12. 结论

`SC36` 当前已从“仅有按钮入口 / 仅能导出配置 JSON”推进到“包名输入 + 模型包目录 + `Visualizers` + `mb.json`”的最小可用闭环。

与帮助页完整目标态相比，当前仍缺少完整 `package.mo` 生成、平台内预览和自动打开模型能力，因此本场景应在追踪表中标记为 `部分落地`，而不是 `完全对齐`。
