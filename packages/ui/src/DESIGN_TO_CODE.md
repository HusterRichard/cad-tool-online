# .pen → Vanilla TS 翻译规则

本文档定义了从 Pencil (.pen) 设计稿到 CadToolOnline vanilla TypeScript 组件的映射规则。

## 节点类型映射

| Pencil (.pen) 概念 | Vanilla TS 对应 |
|-------------------|----------------|
| `frame` (layout: vertical) | `div` + `display: flex; flex-direction: column` |
| `frame` (layout: horizontal) | `div` + `display: flex; flex-direction: row` |
| `frame` (placeholder: true) | 容器 `div`，子元素的 `parentId` 目标 |
| `text` node | `span` / `p` / `h1-h6`（按语义选择） |
| `ref` (component instance) | TypeScript class 实例化 `new Component()` |
| `reusable: true` | TypeScript class（可复用组件） |
| `fill_container` | `flex: 1` 或 `width: 100%` |
| `fit_content` | `width: fit-content` |
| `gap: N` | `gap: Npx` |
| `padding: N` | `padding: Npx` |
| `cornerRadius: [N]` | `border-radius: Npx` |
| `fill: "#HEX"` | `background-color: var(--color-xxx)` (映射到 token) |
| `textColor: "#HEX"` | `color: var(--color-xxx)` (映射到 token) |
| `strokeColor + strokeThickness` | `border: Npx solid var(--color-xxx)` |
| descendants override | 构造函数参数 / `update()` 方法 |

## 颜色映射到 CSS 变量

所有 .pen 中的颜色值应映射到 `tokens.ts` 中定义的 CSS 变量：

| .pen 颜色值 | CSS 变量 | 用途 |
|-------------|---------|------|
| `#1e1e1e` | `--color-bg-base` | 页面背景 |
| `#252526` | `--color-bg-surface` | 面板/侧边栏背景 |
| `#2d2d2d` | `--color-bg-elevated` | 头部/工具栏背景 |
| `#333333` | `--color-bg-input` | 输入框背景 |
| `#3e3e3e` | `--color-bg-hover` | hover 状态 |
| `#094771` | `--color-bg-active` | 选中/激活状态 |
| `#3c3c3c` | `--color-border` | 通用边框 |
| `#4e4e4e` | `--color-border-hover` | hover 边框 |
| `#007acc` | `--color-accent` | 主强调色 |
| `#cccccc` | `--color-text-primary` | 主要文字 |
| `#aaaaaa` | `--color-text-secondary` | 次要文字 |
| `#888888` | `--color-text-muted` | 辅助文字 |
| `#666666` | `--color-text-disabled` | 禁用文字 |
| `#4CAF50` | `--color-node-group` | MBS 分组节点 |
| `#2196F3` | `--color-node-parts` | MBS 零件节点 |
| `#FF9800` | `--color-node-joint` | MBS 关节节点 |
| `#9C27B0` | `--color-node-motion` | MBS 驱动节点 |
| `#00BCD4` | `--color-node-frame` | MBS 标架节点 |

## 组件生成模板

每个 `.pen` 中的 `reusable: true` 组件对应一个 TypeScript class：

```typescript
export interface ComponentNameOptions {
    // 从 .pen descendants override 提取的可配置属性
    title?: string;
    onAction?: (action: string) => void;
}

export class ComponentName {
    private element: HTMLElement;

    constructor(options: ComponentNameOptions = {}) {
        this.element = document.createElement('div');
        this.element.className = 'component-name';
        this.addStyles();
        this.build(options);
    }

    private addStyles(): void {
        const styleId = 'component-name-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .component-name {
                /* 使用 CSS 变量，带 fallback */
                display: flex;
                background: var(--color-bg-surface, #252526);
                border: 1px solid var(--color-border, #3c3c3c);
                border-radius: var(--radius-md, 4px);
            }
        `;
        document.head.appendChild(style);
    }

    private build(options: ComponentNameOptions): void {
        // DOM 构建逻辑
    }

    getElement(): HTMLElement {
        return this.element;
    }

    dispose(): void {
        this.element.remove();
    }
}
```

## 命名约定

| 类型 | 规则 | 示例 |
|------|------|------|
| TypeScript class | PascalCase | `PropertyPanel` |
| 文件名 | kebab-case | `property-panel.ts` |
| CSS class | kebab-case | `.property-panel` |
| CSS 变量 | `--category-name` | `--color-bg-surface` |
| style element ID | `kebab-case-styles` | `property-panel-styles` |

## 布局翻译规则

### .pen frame → CSS flex

```
frame { layout: "vertical", gap: 8, padding: 12 }
  →
div { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
```

### 尺寸约束

| .pen 属性 | CSS |
|-----------|-----|
| `width: "fill_container"` | `flex: 1` 或 `width: 100%` |
| `width: "fit_content"` | `width: fit-content` |
| `width: N` (数字) | `width: Npx` |
| `height: "fill_container"` | `flex: 1` 或 `height: 100%` |
| `height: N` (数字) | `height: Npx` |
| `minWidth: N` | `min-width: Npx` |
| `maxWidth: N` | `max-width: Npx` |

## 逐屏适配工作流

对于 .pen 中的每个设计屏，执行以下步骤：

### Step 1 - 提取设计规范
```
batch_get → 获取目标 frame 完整节点树 (readDepth: 5+)
get_screenshot → 视觉参考截图
snapshot_layout → 精确布局尺寸
```

### Step 2 - 识别可复用组件
- 列出 frame 中所有 `ref` 引用的 reusable 组件
- 用 `batch_get(patterns: [{reusable: true}])` 获取组件定义
- 检查现有代码中是否已有对应组件

### Step 3 - 生成参考代码
- 按 Pencil code guidelines 构建 React 参考实现
- 提取关键信息：布局结构、样式值、组件层级、文案内容

### Step 4 - 翻译为 Vanilla TS
- 按本文档的映射规则转写为 vanilla TS class
- 样式内嵌在 `addStyles()` 中，使用 CSS 变量 + fallback
- 事件通过 `addEventListener` + 回调接口处理
- 遵循命名约定

### Step 5 - 集成与验证
- 在 `packages/ui/src/panels/` 中创建组件
- 更新 `index.ts` 导出
- 在 `CadEditorPanel.ts` 中集成
- 用 `get_screenshot` 对比设计稿

## 首次实操案例：MB_RIGHT → PartPropertyPanel

### 设计稿提取结果

**节点**: `MB_RIGHT` (280px宽, fill_container 高)

**主题发现**: 设计稿使用浅色主题，与代码中 VSCode 暗色主题不同。
tokens.ts 已扩展为双主题支持 (`COLOR_LIGHT` / `COLOR_DARK`)。

**设计稿颜色系统 (浅色)**:
- 背景: `#F2F2F2` → `#F5F5F5` → `#ECECEC` → `#FFFFFF`
- 文字: `#1F2937`(标题) → `#374151`(正文) → `#6B7280`(label) → `#9CA3AF`(禁用)
- 强调: `#2563EB`(蓝) / `#1774D0`(状态栏) / `#2F7ACB`(面板标题)
- 功能: `#22C55E`(成功) / `#F59E0B`(警告) / `#EF4444`(错误) / `#3B82F6`(信息)
- 字体: `Microsoft YaHei` (所有文本)

**结构映射**:

| .pen 节点 | TS 组件 | 说明 |
|-----------|---------|------|
| `MB_RIGHT` | `PartPropertyPanel` | 零件属性面板容器 |
| `MB_RIGHT_H` | `.ppp-header` | 面板标题 "属性-零件" |
| `MB_SEC_*` | `.ppp-section` | 分组标题 "基本属性" "物理属性" "导出" |
| `MB_P_NAME` | `.ppp-row` + `.ppp-input` | 名称输入行 |
| `MB_P_TYPE` | `.ppp-row` + `.ppp-value` | 类型只读行 |
| `MB_P_VIS` | `.ppp-row` + `.ppp-checkbox` | 可见性复选框 |
| `MB_P_COLOR` | `.ppp-row` + `.ppp-color-swatch` | 颜色选择器 |
| `MB_P_COM` | `.ppp-vector-row` | 3D 向量显示行 |
| `MB_P_I1/I2/I3` | `.ppp-vector-row` | 3x3 惯性张量矩阵行 |
| `MB_SEP*` | `.ppp-separator` | 1px 分隔线 |

**文件**: `packages/ui/src/panels/PartPropertyPanel.ts`

