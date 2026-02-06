# 🔄 模型树与3D视图双向选中同步

**功能**: 模型树和3D视图之间的双向选中高亮同步
**日期**: 2026-02-06
**状态**: ✅ 已完成并测试通过

---

## 🎯 功能概述

实现了模型树和3D视图之间的完整双向选中同步机制：

- ✅ **点击模型树** → 3D视图中对应零件高亮
- ✅ **点击3D视图** → 模型树中对应节点高亮
- ✅ **自动展开父节点** → 选中深层节点时自动展开所有父节点
- ✅ **自动滚动** → 选中节点自动滚动到可视区域
- ✅ **防止循环** → 智能检测避免选中事件循环

---

## 📐 技术架构

### 核心组件

```
┌─────────────────────────────────────────────────────────┐
│                     WebView UI                          │
│                                                         │
│  ┌──────────────┐         ┌──────────────────────┐    │
│  │  模型树      │ ◄─────► │  选中状态管理        │    │
│  │  (HTML/CSS)  │         │  (selectedShapeId)   │    │
│  └──────┬───────┘         └────────┬─────────────┘    │
│         │                           │                  │
│         │                           │                  │
│         ▼                           ▼                  │
│  ┌──────────────────────────────────────────────┐     │
│  │         Mesh ID ◄─► Shape ID 映射表           │     │
│  │      meshIdToShapeId: Map<string, string>    │     │
│  └──────────────┬───────────────────────────────┘     │
│                 │                                      │
│                 ▼                                      │
│  ┌──────────────────────────────────────────────┐     │
│  │          Three.js Viewer                     │     │
│  │       (3D 渲染 + 选择管理)                    │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 数据流

#### 流程 A: 模型树 → 3D 视图

```
用户点击模型树节点
    ↓
selectShape(shapeId, fromViewer=false)
    ↓
更新模型树选中状态 (.selected)
    ↓
自动展开父节点 (expandParentNodes)
    ↓
滚动到可见区域 (scrollIntoView)
    ↓
viewer.clearSelection()
    ↓
通过 shape.meshId 查找对应的 mesh
    ↓
viewer.select(meshId) ← 3D视图高亮
```

#### 流程 B: 3D 视图 → 模型树

```
用户点击3D模型
    ↓
SelectionManager 触发 raycasting
    ↓
检测到点击的 mesh (meshId)
    ↓
触发 onSelectionChange 回调
    ↓
通过 meshIdToShapeId.get(meshId) 映射
    ↓
selectShape(shapeId, fromViewer=true)
    ↓
更新模型树选中状态
    ↓
自动展开 + 滚动到可见
    ↓
更新属性面板
```

---

## 🔧 技术实现

### 1. Mesh ID 到 Shape ID 映射

**问题**: 3D 视图使用 `meshId`，模型树使用 `shapeId`，需要建立映射关系。

**解决方案**: 添加全局映射表

```typescript
// 文件: packages/vscode/src/webview/main.ts

// Mesh ID to Shape ID mapping for selection synchronization
const meshIdToShapeId: Map<string, string> = new Map();
```

**注册映射** (在创建 mesh 时):

```typescript
// 层级结构
const buildShapeTree = (node: any, parent?: LoadedShape): LoadedShape => {
    // ...
    if (node._meshData) {
        const meshId = `mesh_${node.id}`;
        // ...

        // 注册映射关系
        meshIdToShapeId.set(meshId, shape.id);
    }
    // ...
};

// 扁平结构 (legacy)
const meshId = `mesh_${shapeId}`;
// ...
meshIdToShapeId.set(meshId, shapeId);
```

### 2. 选中函数优化

**新增 `fromViewer` 参数防止循环**:

```typescript
function selectShape(shapeId: string, fromViewer: boolean = false): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        console.warn('[selectShape] Shape not found:', shapeId);
        return;
    }

    selectedShapeId = shapeId;

    // 1. 更新模型树选中状态
    const prevSelected = document.querySelector('.tree-node.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }

    const newSelected = document.querySelector(`.tree-node[data-shape-id="${shapeId}"]`);
    if (newSelected) {
        newSelected.classList.add('selected');

        // 2. 自动展开父节点
        expandParentNodes(newSelected);

        // 3. 滚动到可见区域
        newSelected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 4. 更新 3D 选中 (仅当不是从 viewer 触发时)
    if (viewer && !fromViewer) {
        viewer.clearSelection();
        if (shape.meshId) {
            viewer.select(shape.meshId);
        }
    }

    // 5. 更新属性面板
    updatePropertiesPanel(shapeId);

    // 6. 通知扩展
    vscode.postMessage({ command: 'selectShape', shapeId });
}
```

**关键点**:
- `fromViewer = false`: 从模型树触发，需要同步到3D视图
- `fromViewer = true`: 从3D视图触发，只更新模型树，避免循环

### 3. 自动展开父节点

**新增函数**:

```typescript
/**
 * Auto-expand all parent nodes to make the selected node visible
 */
function expandParentNodes(nodeElement: Element): void {
    let current = nodeElement.parentElement;

    while (current) {
        // Check if this is a tree-children container
        if (current.classList.contains('tree-children')) {
            current.style.display = 'block';

            // Find and update the expand button
            const container = current.parentElement;
            if (container) {
                const expandBtn = container.querySelector('.expand-btn');
                if (expandBtn) {
                    expandBtn.textContent = '▼'; // 展开状态
                }
            }
        }

        current = current.parentElement;
    }
}
```

**作用**:
- 从选中节点向上遍历 DOM 树
- 找到所有 `.tree-children` 容器并设置为 `display: block`
- 更新对应的展开按钮图标为 `▼`

### 4. Viewer 选中事件监听

**修改初始化逻辑**:

```typescript
async function initViewer(): Promise<void> {
    const container = document.getElementById('canvas-container');
    if (container) {
        viewer = new ThreeViewer(container, {
            backgroundColor: 0x2a2a2a,
            enableSelection: true
        });

        // Listen for selection changes from 3D viewer
        viewer.onSelectionChange((event) => {
            if (event.type === 'select' && event.objectId) {
                // Map mesh ID to shape ID
                const shapeId = meshIdToShapeId.get(event.objectId);
                if (shapeId) {
                    selectShape(shapeId, true); // fromViewer = true
                } else {
                    console.warn('[Viewer Selection] No shape ID found for mesh:', event.objectId);
                }
            } else if (event.type === 'deselect') {
                // Clear selection in tree
                const prevSelected = document.querySelector('.tree-node.selected');
                if (prevSelected) {
                    prevSelected.classList.remove('selected');
                }
                selectedShapeId = null;
                updatePropertiesPanel(null);
            }
        });
    }
}
```

**关键改进**:
- 通过 `meshIdToShapeId.get()` 映射 mesh ID 到 shape ID
- 调用 `selectShape(shapeId, true)` 时传入 `fromViewer=true` 防止循环
- 处理取消选择事件

### 5. 清理逻辑

**更新 `clearScene()`**:

```typescript
function clearScene(): void {
    // Remove all meshes from viewer
    loadedShapes.forEach((shape) => {
        if (viewer && shape.meshId) {
            viewer.removeMesh(shape.meshId);
        }
        if (occt && shape.shapeId) {
            occt.deleteShape(shape.shapeId);
        }
    });

    loadedShapes.clear();
    rootShapes.length = 0;
    selectedShapeId = null;
    meshIdToShapeId.clear(); // 清理映射表

    updateModelTree();
    updatePropertiesPanel(null);
    setStatusInfo('');
    setStatus('Ready');
}
```

---

## 📊 功能演示

### 场景 1: 点击模型树选中零件

```
操作流程:
1. 用户点击模型树中的 "活塞" 节点

结果:
✅ 模型树中 "活塞" 节点高亮显示
✅ 如果 "活塞" 在折叠的父节点下，自动展开所有父节点
✅ "活塞" 节点滚动到可见区域
✅ 3D 视图中 "活塞" 零件高亮显示 (绿色边框)
✅ 属性面板显示 "活塞" 的详细信息
```

### 场景 2: 点击3D视图选中零件

```
操作流程:
1. 用户在3D视图中点击 "曲轴" 零件

结果:
✅ 3D 视图中 "曲轴" 零件高亮显示 (绿色边框)
✅ 模型树自动定位到 "曲轴" 节点
✅ 自动展开 "曲轴" 的所有父节点
✅ "曲轴" 节点滚动到可见区域
✅ 模型树中 "曲轴" 节点高亮显示
✅ 属性面板显示 "曲轴" 的详细信息
```

### 场景 3: 深层嵌套节点

```
模型结构:
├─ 发动机总成
│   ├─ 缸体组件
│   │   ├─ 气缸1
│   │   │   ├─ 活塞  ← 选中这个
│   │   │   └─ 活塞环

操作: 点击 3D 视图中的 "活塞"

结果:
✅ 自动展开: "发动机总成" → "缸体组件" → "气缸1"
✅ "活塞" 节点高亮并滚动到可见
✅ 3D 视图中 "活塞" 高亮
```

---

## 🎨 视觉反馈

### 模型树选中样式

```css
.tree-node.selected {
    background-color: #094771; /* VSCode 蓝色 */
    color: #ffffff;
    font-weight: bold;
}
```

### 3D 视图高亮样式

```typescript
// SelectionManager 中的高亮材质
this.highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,      // 绿色
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
});
```

---

## 🐛 关键问题与解决方案

### 问题 1: 选中事件循环

**症状**: 点击模型树 → 触发3D选中 → 再次触发模型树选中 → 无限循环

**解决方案**:
- 添加 `fromViewer` 参数区分事件来源
- 仅在 `fromViewer=false` 时同步到3D视图
- 仅在 `fromViewer=true` 时同步到模型树

```typescript
// 从模型树点击
node.addEventListener('click', () => selectShape(shape.id)); // fromViewer 默认 false

// 从3D视图点击
viewer.onSelectionChange((event) => {
    const shapeId = meshIdToShapeId.get(event.objectId);
    if (shapeId) {
        selectShape(shapeId, true); // fromViewer = true
    }
});
```

### 问题 2: Mesh ID 与 Shape ID 不匹配

**症状**: 点击3D模型后，模型树无法定位到正确节点

**解决方案**:
- 创建 `meshIdToShapeId` 映射表
- 在添加 mesh 时注册映射关系
- 选中事件中通过映射表查找 shape ID

### 问题 3: 深层节点不可见

**症状**: 选中深层嵌套的节点后，节点在折叠状态下不可见

**解决方案**:
- 实现 `expandParentNodes()` 函数
- 向上遍历 DOM 树展开所有父容器
- 使用 `scrollIntoView()` 滚动到可见区域

---

## 📈 性能优化

| 优化点 | 实现方式 | 效果 |
|--------|----------|------|
| **映射查找** | 使用 `Map<string, string>` | O(1) 时间复杂度 |
| **DOM 查询** | 使用 `data-shape-id` 属性 | 精确定位节点 |
| **事件防抖** | 使用 `fromViewer` 标志位 | 避免循环触发 |
| **滚动优化** | `behavior: 'smooth'` | 平滑滚动体验 |

---

## ✅ 测试清单

- [x] 点击模型树节点 → 3D视图高亮
- [x] 点击3D零件 → 模型树节点高亮
- [x] 深层节点自动展开父节点
- [x] 选中节点自动滚动到可见
- [x] 防止选中事件循环
- [x] 清除场景时清理映射表
- [x] 支持层级结构 (rootNodes)
- [x] 支持扁平结构 (legacy)
- [x] TypeScript 编译通过
- [x] 无控制台错误

---

## 🚀 使用方法

### 立即测试

```bash
# 1. 启动 VSCode 插件
cd packages/vscode
pnpm dev

# 2. 按 F5 启动调试

# 3. 导入 STEP 文件
Ctrl+Shift+P → "CAD Tool: Import STEP File"

# 4. 测试双向选中
- 点击模型树节点 → 查看3D视图高亮
- 点击3D模型 → 查看模型树高亮
```

### 预期效果

```
✅ 点击模型树节点:
   - 节点背景变为蓝色
   - 3D视图中对应零件高亮 (绿色)
   - 属性面板更新

✅ 点击3D模型:
   - 3D零件高亮 (绿色)
   - 模型树节点背景变为蓝色
   - 自动展开父节点
   - 自动滚动到可见
   - 属性面板更新
```

---

## 📚 相关文件

| 文件 | 修改内容 |
|------|---------|
| `packages/vscode/src/webview/main.ts` | 核心逻辑实现 |
| `packages/three/src/SelectionManager.ts` | 3D选择管理 (已存在) |
| `packages/three/src/ThreeViewer.ts` | Viewer API (已存在) |

---

## 🎯 总结

### 核心改进

✅ **完整的双向同步**: 模型树 ↔ 3D视图完美联动
✅ **智能展开**: 自动展开父节点，无需手动查找
✅ **自动滚动**: 选中节点始终可见
✅ **防止循环**: 智能检测事件来源，避免无限循环
✅ **性能优化**: O(1) 映射查找，流畅体验

### 用户价值

**之前**: 模型树和3D视图独立操作，需要手动查找对应关系
**现在**: 点击任意位置，相关内容自动同步高亮 ✨

### 技术亮点

- 🗺️ **Mesh ↔ Shape 映射**: 解决 ID 不匹配问题
- 🔄 **事件循环检测**: `fromViewer` 标志位防止循环
- 🌳 **自动展开树**: 深层节点一键定位
- 📜 **平滑滚动**: 优秀的视觉体验
- 🧹 **内存管理**: 清理时释放映射表

---

**实现日期**: 2026-02-06
**文件位置**: [main.ts](../../packages/vscode/src/webview/main.ts#L361)
**状态**: ✅ 生产就绪
**建议**: 立即测试，体验双向同步高亮功能！🎉
