# SC36 QA Plan: 生成 Modelica 模型

## 1. 文档信息

- 场景 ID: `SC36`
- 场景名称: 生成 Modelica 模型
- 项目: `CadToolOnline`
- 文档版本: `v1.0`
- 最近更新: `2026-05-08`

## 2. QA 目标

1. 验证 `接受并退出` 已改为 `SC36` 导出主链路，而不是配置导出。
2. 验证包名输入、目录创建、`Visualizers` 资源输出和 `mb.json` 契约落盘可用。
3. 验证当前 MVP 边界明确，不把“完整 Modelica 工程生成”误报为已完成。

## 3. 测试范围

### 3.1 In Scope

- Ribbon `接受并退出`
- 包名输入框
- 模型包目录创建
- `Visualizers` 子目录创建
- 分组图片输出
- 分组 `dxf` 输出
- `mb.json`
- `group / marker / connector / motion` 数据落盘

### 3.2 Out of Scope

- `package.mo` 与 `*_main` 工程生成
- 快速预览与预览设置弹窗
- 平台内自动打开导出模型
- 帮助页截图级视觉一致性

## 4. 进入 / 退出标准

### 4.1 准入

- 已导入一个包含多个零件的 CAD 模型
- 至少完成一个分组
- 至少可选地完成标架、连接、驱动中的任意一项
- `SC36` 代码改动已完成并可构建

### 4.2 准出

- 关键路径全部通过
- `mb.json` 字段与 PRD 一致
- 无路径越界、空目录未创建、文件名错误等阻断问题

## 5. 测试环境

| 维度 | 范围 |
|---|---|
| OS | Windows 11 |
| VSCode | 1.80+ |
| Node | 18.x / 20.x |
| 构建 | `pnpm build:webview`、`pnpm build:extension` |
| 单测 | core + extension 定向测试 |

## 6. 测试数据

- 一个已导入的 STEP 装配模型
- 至少两个分组
- 至少一个标架
- 至少一个连接
- 至少一个驱动

## 7. 关键测试场景

### 7.1 入口行为

1. 点击 Ribbon `接受并退出`
   - 期望：弹出模型包名输入框
   - 期望：不再直接导出 `cadtool.config.json`

### 7.2 包名输入

1. 输入合法包名，例如 `ExcavatorArm`
   - 期望：可继续导出
2. 输入包含空格或非法字符的包名，例如 `Excavator Arm`
   - 期望：系统按 Modelica 规则规整后保存
3. 取消输入
   - 期望：不创建任何新目录和文件

### 7.3 目录结构

1. 导出完成后检查工作区根目录
   - 期望：存在 `<packageName>` 文件夹
2. 打开 `<packageName>`
   - 期望：存在 `mb.json`
   - 期望：存在 `Visualizers` 子目录

### 7.4 分组资源输出

1. 检查每个分组
   - 期望：`Visualizers` 中存在同名 `.png`
   - 期望：`Visualizers` 中存在同名 `.dxf`
2. 检查 `mb.json.group`
   - 期望：每个分组都包含 `name / totalMass / inertiaTensor / imageFile / dxfFile`
   - 期望：`imageFile / dxfFile` 指向真实存在的文件

### 7.5 标架导出

1. 在导出前创建普通标架和参考标架
2. 检查 `mb.json.marker`
   - 期望：包含 `name / groupRef / position / direction`
   - 期望：至少能看到已创建标架记录

### 7.6 连接导出

1. 创建一个普通连接
2. 检查 `mb.json.connector`
   - 期望：包含 `name / connectorType / groupRef1 / groupRef2 / position / direction`
3. 对固定副连接 `Ground`
   - 期望：相关分组引用可退化为 `Ground`

### 7.7 驱动导出

1. 创建一个驱动
2. 检查 `mb.json.motion`
   - 期望：包含 `name / motionType / connectorRef`

### 7.8 异常路径

1. 未加载模型时点击 `接受并退出`
   - 期望：阻止导出并提示错误
2. 工作区不存在或不可写
   - 期望：提示导出失败
3. 资源路径越界
   - 期望：extension 阻止写入并报错

## 8. 自动化验证

- core 导出契约:
  - `pnpm --filter @cadtool-online/core test:run -- modelica-export.spec.ts`
- extension 落盘链路:
  - `pnpm test:root:run -- cad-editor-panel.spec.ts`
- 构建验证:
  - `pnpm build:webview`
  - `pnpm build:extension`

## 9. 已执行验证

本次实现已执行以下命令：

```powershell
pnpm --filter @cadtool-online/core test:run -- modelica-export.spec.ts
pnpm test:root:run -- cad-editor-panel.spec.ts
pnpm build:webview
pnpm build:extension
```

## 10. 已知差异

- 当前不会生成完整 `package.mo` 或 `*_main` 模型。
- 当前分组图片为当前三维视图隔离截图，不保证与帮助页示例视角一致。
- 当前 `dxf` 为基础 `LINE` 实体导出，不保证与专业 CAD 导出器等价。

## 11. 通过标准

- `接受并退出` 已变为真实导出入口
- 模型包目录、`Visualizers`、`mb.json` 均成功生成
- `mb.json` 四类数据字段齐全
- 自动化命令全部通过

## 12. 结论

`SC36 MVP` 的 QA 重点不是验证完整 Modelica 工程生成，而是验证目录、文件和数据契约闭环是否成立。只要包名输入、目录落盘、分组资源输出和 `mb.json` 契约成立，就可以认为本次 `SC36` 达到最小可验收状态。
