# Group Design 方案与开发计划

日期: 2026-03-09
项目: CadToolOnline
主题: 分组设计（Group Parts）

## 1. 背景

根据帮助文档 `HowToUseCADToolBox/GroupParts.html`，分组设计不是单一的“创建分组”按钮能力，而是一整套工作流，包含：

- 组合零件
- 移动零件
- 分解分组
- 清理空分组
- 添加默认分组
- 删除零件/分组

并且该工作流依赖以下基础能力：

- 模型浏览器多选
- 右键菜单
- 拖拽移动
- 分组命名校验
- 删除后的撤销/重做
- 与 Marker / RefFrame / DesignPoint / Joint / Motion 的联动

## 2. 当前实现现状

当前在线版已有的分组相关能力主要是：

- `createGroup`
- `createChildGroup`
- `createDefaultGroup`
- `cleanGroup`
- `groupProperties`

但整体仍停留在“轻量对象记录”层，尚未形成完整分组设计闭环。

### 2.1 已有能力

- Webview 中存在 `MbsGroupEntity`，字段包括 `id/name/parentGroupId/memberShapeIds/createdAt`
- 支持通过选项面板创建分组
- 支持默认分组入口
- 支持查看最后一个分组的属性
- 配置导入导出中存在扁平 `group` 数据

### 2.2 关键缺口

- 模型树不显示 group 节点，只显示 shape / connection / motion 等节点
- 当前主选择模型仍然是单选 `selectedShapeId`，不具备真正多选能力
- `createChildGroup` 的父子关系没有真实落库
- `createDefaultGroup` 会把全部 leaf parts 一次性并入，不符合“仅处理未分组零件”的要求
- `cleanGroup` 当前实现是“清空所有分组”，不是“清理空分组”
- 不支持拖拽移动零件/分组
- 不支持分解分组
- 不支持删除零件/分组闭环
- 组属性没有质量、质心、惯量等聚合信息
- Marker / RefFrame / DesignPoint 仍然直接挂 shape，不是真正挂 group
- 导入导出 schema 不能表达组层级、顺序、默认组类型和依赖关系

## 3. 设计目标

### 3.1 业务目标

在在线版中补齐与帮助文档一致的分组设计工作流，使用户能够：

- 从模型树或三维视图选择多个零件并组成新组
- 在组之间移动零件
- 将已有组分解回父层级
- 清理空分组
- 对未分组零件自动生成默认分组
- 删除零件或分组，并保证依赖关系安全

### 3.2 技术目标

- 分组从“附加记录”升级为“多体设计主对象”
- 分组树成为多体浏览器的数据源之一
- 分组变更可驱动后续 Marker / DesignPoint / Joint / Motion 的归属关系
- 导入导出支持层级结构
- 关键操作可撤销/重做

## 4. 总体设计

### 4.1 双树模型

建议保留两套树：

- CAD 原始装配树
  - 反映 STEP / CAD 导入后的原始装配层级
  - 主要用于几何浏览、可见性控制、零件定位
- MBS 分组树
  - 反映多体设计后的组层级
  - 作为后续多体对象归属关系的数据源

在线版当前模型浏览器更接近 CAD 原始树。分组设计补齐后，应在多体对象视图中引入真正的 Group 树。

### 4.2 分组状态模型

建议把分组状态从当前 `Map<string, MbsGroupEntity>` 升级为标准化结构：

```ts
interface GroupNode {
  id: string;
  name: string;
  parentGroupId: string | null;
  childGroupIds: string[];
  memberPartIds: string[];
  kind: 'manual' | 'default' | 'imported';
  order: number;
  createdAt: string;
  deletedAt?: string;
}

interface GroupDesignState {
  groupsById: Record<string, GroupNode>;
  rootGroupIds: string[];
  ungroupedPartIds: string[];
  selectedNodeIds: string[];
  activeMode: 'idle' | 'group-create' | 'move' | 'delete';
}
```

### 4.3 命令模型

建议所有分组相关操作统一为命令对象：

- `CreateGroupCommand`
- `MoveNodesCommand`
- `UngroupCommand`
- `CleanEmptyGroupsCommand`
- `CreateDefaultGroupsCommand`
- `DeleteNodesCommand`
- `RenameGroupCommand`

这样可以统一解决：

- UI 与状态分离
- undo / redo
- 导入恢复后的继续编辑
- 复杂依赖校验前后的一致性

## 5. 详细方案

### 5.1 组合零件

#### 目标

将多个不产生相对运动的零件组合为一个新分组。

#### 交互

- 支持模型树 Ctrl 多选
- 支持三维视图 Ctrl 多选
- 支持右键菜单“组合”
- 支持 Ribbon 按钮“组合”

#### 规则

- 至少选择 1 个零件
- 若选择项都属于同一父级，则新组挂到该父级下
- 若跨父级选择，则挂到最近公共父级
- 名称必须满足 Modelica 命名规范
- 若名称重复，自动规范化为 `Name_1`、`Name_2`

#### 输出

- 创建新 group 节点
- 被选零件从原父节点移除，加入新 group
- 属性面板展示该 group 信息
- 后续 Marker / DesignPoint 可引用该 group

### 5.2 移动零件

#### 目标

将零件从一个分组移动到另一个分组，或拖回根节点成为未分组零件。

#### 交互

- 模型树右键“移动到...”
- 模型树拖拽移动

#### 规则

- 允许 part -> group
- 允许 part -> root
- 允许 group -> group
- 禁止 group 移动到自身或其后代
- 禁止无效拖拽目标

#### 输出

- 更新源分组成员
- 更新目标分组成员
- 必要时更新 `ungroupedPartIds`
- 脏化受影响组及祖先组的聚合属性缓存

### 5.3 分解分组

#### 目标

将一个分组拆开，把其下零件和子分组平铺回父级。

#### 交互

- Ribbon “分解分组”
- 模型树右键“分解”

#### 规则

- 仅允许对非根 group 执行
- 若 group 被 Marker / RefFrame / DesignPoint / Joint / Motion 引用，需要先阻止并提示
- 分解后保留原有顺序

#### 输出

- 子节点回挂到父级
- 删除该 group 节点

### 5.4 清理空分组

#### 目标

删除没有零件、没有子组的空 group。

#### 规则

- 只删除空 group
- 被设计元素引用的空 group 不删除，提示 warning
- 不影响非空组

#### 注意

当前实现必须被替换，不能继续使用“全部 clear”

### 5.5 添加默认分组

#### 目标

为未分组零件自动创建默认分组。

#### 规则

- 仅处理 `ungroupedPartIds`
- 默认组可按父层级分批创建
- 默认组类型标记为 `kind = default`
- 导入商用 CAD 或自动识别场景时可复用此机制

#### 输出

- 根节点或父节点下生成默认组
- 未分组零件迁入默认组

### 5.6 删除零件 / 分组

#### 目标

支持删除零件和分组，并确保状态一致。

#### 交互

- Delete 键
- 模型树右键“删除”
- 三维视图右键“删除”

#### 规则

- 删除零件时需要同步：
  - viewer mesh
  - mass cache
  - shape map
  - group membership
  - 导出引用
- 删除 group 前检查：
  - 是否有子组
  - 是否有成员
  - 是否被设计元素引用

#### 建议

- 采用软删除 + history command
- 首版支持撤销/重做

## 6. 分组与后续多体设计联动

### 6.1 当前问题

Marker / RefFrame / DesignPoint 当前仍使用 `selectedShape.id` 作为 group 归属，这会导致：

- 用户创建了 group，但设计元素没有真正挂到 group
- 后续导出时 group 语义不完整

### 6.2 建议改造

- 新增 `partOwnerGroupMap`
- 在三维视图中点选零件创建 Marker / DesignPoint 时，先解析该零件所属 group
- 若零件未分组：
  - 可以阻止创建，并提示先分组
  - 或允许挂到“临时未分组对象”，但不建议

### 6.3 属性聚合

组属性面板至少应显示：

- ID
- Name
- Parent
- Children Count
- Members
- Mass
- Center of Mass
- Inertia Matrix
- Created Time
- Group Type

质量属性可以复用现有单零件 mass worker 结果做聚合。

## 7. 导入导出方案

### 7.1 现状

当前导出 group 结构为：

```json
{
  "group": [
    {
      "name": "Group1",
      "parts": ["PartA", "PartB"]
    }
  ]
}
```

该结构无法表达：

- 父子关系
- 节点顺序
- 默认组类型
- 删除状态

### 7.2 新格式建议

```json
{
  "group": [
    {
      "name": "Base",
      "parentRef": null,
      "kind": "manual",
      "parts": ["body_frame", "bolt_1"],
      "order": 10
    },
    {
      "name": "MotorAssembly",
      "parentRef": "Base",
      "kind": "manual",
      "parts": ["motor_1"],
      "order": 20
    }
  ]
}
```

### 7.3 兼容策略

- 读：兼容旧格式
- 写：优先输出新格式
- 导入旧格式时，默认视为 `parentRef = null`

## 8. UI 设计建议

### 8.1 模型浏览器

至少增加：

- group 节点图标
- 多选高亮
- 右键菜单
- 拖拽占位提示
- 非法落点禁用样式

### 8.2 右键菜单

不同节点建议菜单如下：

- part
  - 组合
  - 移动到...
  - 删除
  - 属性
- group
  - 新建子组
  - 分解
  - 重命名
  - 删除
  - 属性
  - 清理空子组

### 8.3 选项面板

分组侧边栏建议提供：

- 名称输入
- 目标父组显示
- 已选成员列表
- “分组后隐藏”预留项
- 确认 / 取消

## 9. 风险与难点

### 9.1 多选基础设施不足

当前主选择模型是单选，必须先补齐多选机制，否则分组设计无法自然落地。

### 9.2 模型树与三维视图同步复杂

拖拽、删除、移动后需要同时保证：

- 树节点一致
- 3D 高亮一致
- 属性面板一致
- 导出数据一致

### 9.3 依赖传播

组变更会影响：

- Marker
- RefFrame
- DesignPoint
- Joint
- Motion
- 导出 Modelica

因此必须建立依赖校验，而不能只做 UI 层面的“改数组”。

## 10. 开发计划 Plan

### Phase 0: 方案基线

周期: 1 天

交付物：

- 分组设计 ADR
- 状态图
- 命令模型说明
- 导入导出 schema 升级说明

### Phase 1: 状态模型重构

周期: 2 到 3 天

交付物：

- `GroupDesignState`
- `groupsById/rootGroupIds/ungroupedPartIds`
- group selectors
- group ownership resolver

验收标准：

- 不依赖旧 `memberShapeIds` 扁平逻辑即可表达层级分组

### Phase 2: 模型浏览器重构

周期: 3 到 4 天

交付物：

- group 节点显示
- 多选状态
- 右键菜单
- 拖拽基础能力

验收标准：

- 树中可以看到 group 层级
- 零件和组可区分
- 支持 Ctrl 多选和拖拽反馈

### Phase 3: 核心分组命令

周期: 4 到 5 天

交付物：

- 组合零件
- 移动零件/组
- 分解分组
- 清理空分组
- 添加默认分组
- 删除零件/分组
- 重命名

验收标准：

- 六个文档要求动作全部可执行

### Phase 4: 属性与依赖联动

周期: 2 到 3 天

交付物：

- 组属性面板
- 组质量聚合
- 依赖检查
- Marker / RefFrame / DesignPoint 挂组改造

验收标准：

- 创建 group 后，后续设计元素归属 group
- 组属性可显示物理信息

### Phase 5: 导入导出兼容

周期: 2 天

交付物：

- 新旧 group schema 双读
- 导出新 schema
- 导入恢复层级关系

验收标准：

- “导出 -> 清空 -> 导入”后 group 树保持一致

### Phase 6: QA 与文档对齐

周期: 2 到 3 天

交付物：

- 分组专项测试用例
- 回归用例
- 用户文档对齐说明

验收标准：

- 覆盖“创建-移动-分解-清理-删除-导出-导入”闭环

## 11. 测试计划

### 11.1 功能测试

- 单零件创建组
- 多零件创建组
- 同父级创建子组
- 跨父级创建组
- 拖拽移动 part -> group
- 拖拽移动 part -> root
- 拖拽移动 group -> group
- 分解 group
- 清理空 group
- 默认分组仅处理未分组零件
- 删除零件
- 删除空组
- 删除被依赖组的阻止提示

### 11.2 回归测试

- 分组后创建 Marker
- 分组后创建 RefFrame
- 分组后创建 DesignPoint
- 分组后导出配置
- 导入后继续编辑

### 11.3 兼容测试

- 旧版 group config 导入
- 新版 group config 导入
- 新版导出再导入

## 12. 建议的验收口径

- 能从模型树或三维视图多选零件创建组
- 能通过拖拽和右键移动零件/组
- 能分解组并保持父层级结构正确
- 清理空分组不会误删非空组和被引用组
- 默认分组只处理未分组零件
- 删除支持撤销/重做
- 组属性能显示成员、父组、质量、质心、惯量
- 导出再导入后，分组树和设计元素引用保持一致

## 13. 附加建议

- 分组模块开发前，建议先收紧 `tsconfig` 的 `exclude`，排除 `packages/geo/cpp/build` 和 `ref/` 中的非源码文件，否则全量类型检查噪音过大
- 分组能力不建议继续基于当前“最后一个 group”式属性查看逻辑扩展，应尽快转成基于真实选中 group 节点的状态驱动

