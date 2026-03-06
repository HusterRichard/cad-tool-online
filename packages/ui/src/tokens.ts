/**
 * 设计令牌 (Design Tokens)
 *
 * 从 cadtoolonline.pen 设计稿提取的统一设计变量。
 * 设计稿为浅色主题，代码同时支持深色（VSCode）和浅色两套主题。
 *
 * 使用方式：
 * - CSS 变量注入：调用 generateCssVariables() 获取 :root 声明
 * - TS 引用：直接导入常量
 */

// ============================================================================
// 主题色板 - 浅色 (来自 cadtoolonline.pen 设计稿)
// ============================================================================

export const COLOR_LIGHT = {
    // 背景层级
    bgBase: '#F2F2F2',           // 页面背景
    bgSurface: '#F5F5F5',        // 侧边栏背景
    bgElevated: '#ECECEC',        // ribbon bar / panel header
    bgInput: '#FFFFFF',           // 输入框/编辑区

    // 交互状态
    bgHover: '#E5E7EB',          // hover
    bgActive: '#CCE5FF',         // 选中/激活
    bgSelected: '#2F7ACB',       // 面板标题选中 (模型浏览器 header)

    // 边框
    border: '#D1D5DB',           // 通用边框
    borderHover: '#C8C8C8',      // hover 边框 / ribbon 分隔线
    borderFocus: '#2563EB',      // 聚焦边框
    borderSubtle: '#E5E7EB',     // 微弱分隔线

    // 文本
    textPrimary: '#1F2937',      // 主要文字 (标题)
    textSecondary: '#374151',    // 正文/图标文字
    textMuted: '#6B7280',        // label / 辅助文字
    textDisabled: '#9CA3AF',     // 占位符/禁用
    textOnAccent: '#FFFFFF',     // accent 背景上的文字

    // 强调色
    accent: '#2563EB',           // 主强调色 (设计稿蓝)
    accentBg: '#1774D0',         // 状态栏蓝
    accentHeader: '#2F7ACB',     // 面板标题蓝

    // 功能色 (来自设计稿)
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
} as const;

// ============================================================================
// 主题色板 - 深色 (VSCode dark theme)
// ============================================================================

export const COLOR_DARK = {
    bgBase: '#1e1e1e',
    bgSurface: '#252526',
    bgElevated: '#2d2d2d',
    bgInput: '#333333',

    bgHover: '#3e3e3e',
    bgActive: '#094771',
    bgSelected: '#094771',

    border: '#3c3c3c',
    borderHover: '#4e4e4e',
    borderFocus: '#007acc',
    borderSubtle: '#4a4a4a',

    textPrimary: '#cccccc',
    textSecondary: '#aaaaaa',
    textMuted: '#888888',
    textDisabled: '#666666',
    textOnAccent: '#ffffff',

    accent: '#007acc',
    accentBg: '#094771',
    accentHeader: '#094771',

    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
} as const;

// ============================================================================
// 语义色 - MBS 节点类型 (主题无关)
// ============================================================================

export const NODE_COLORS = {
    group: '#4CAF50',        // 分组 (绿)
    parts: '#2196F3',        // 零件 (蓝)
    joint: '#FF9800',        // 关节 (橙)
    motion: '#9C27B0',       // 驱动 (紫)
    frame: '#00BCD4',        // 标架 (青)
} as const;

// 当前默认使用深色主题（VSCode webview 环境）
export const COLOR = COLOR_DARK;

// ============================================================================
// 排版令牌 (从设计稿 fontSize 提取: 8, 9, 10, 11, 12, 13, 14, 16)
// ============================================================================

export const TYPOGRAPHY = {
    fontFamily: "'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: 'monospace',

    fontSizeXxs: 8,
    fontSizeXs: 10,   // ribbon tab label, 搜索框
    fontSizeSm: 11,   // ribbon group label, 按钮文字
    fontSizeMd: 12,   // 属性标签, 模型树节点, 状态栏
    fontSizeLg: 13,   // tab text, 属性section title
    fontSizeXl: 14,   // 树展开按钮, 部分图标
    fontSizeXxl: 16,  // ribbon 大图标
} as const;

// ============================================================================
// 间距令牌 (从设计稿 gap/padding 提取: 0, 2, 4, 6, 8, 10, 12, 14, 16, 20)
// ============================================================================

export const SPACING = {
    none: 0,
    xs: 2,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 10,
    xxl: 12,
    xxxl: 16,
    xxxxl: 20,
} as const;

// ============================================================================
// 圆角令牌 (从设计稿 cornerRadius 提取: 2, 3, 4, 5, 6, 12, 15)
// ============================================================================

export const RADIUS = {
    xs: 2,
    sm: 3,
    md: 4,
    lg: 6,
    xl: 12,
    full: 15,
} as const;

// ============================================================================
// 阴影令牌
// ============================================================================

export const SHADOW = {
    dropdown: '0 4px 12px rgba(0, 0, 0, 0.15)',
    dropdownDeep: '0 4px 12px rgba(0, 0, 0, 0.3)',
} as const;

// ============================================================================
// 布局令牌 (从设计稿 MB_SCREEN 提取)
// ============================================================================

export const LAYOUT = {
    screenWidth: 1366,
    screenHeight: 768,
    sidebarLeftWidth: 265,     // MB_LEFT
    sidebarRightWidth: 280,    // MB_RIGHT
    titleBarHeight: 30,        // MB_TITLE
    tabBarHeight: 24,          // MB_TAB
    ribbonHeight: 100,         // MB_RIBBON
    statusBarHeight: 24,       // MB_STATUS
    treeRowHeight: 24,
    propertyRowHeight: 26,
    sectionHeaderHeight: 24,
    treeIndent: 20,            // padding-left for children
    iconSize: 16,
    ribbonGroupMinWidth: 50,
    ribbonDividerWidth: 1,
    dropdownMinWidth: 180,
} as const;

// ============================================================================
// 聚合导出
// ============================================================================

export const TOKENS = {
    color: COLOR,
    colorLight: COLOR_LIGHT,
    colorDark: COLOR_DARK,
    nodeColors: NODE_COLORS,
    typography: TYPOGRAPHY,
    spacing: SPACING,
    radius: RADIUS,
    shadow: SHADOW,
    layout: LAYOUT,
} as const;

// ============================================================================
// CSS 变量生成器
// ============================================================================

export type ThemeMode = 'light' | 'dark';

/**
 * 生成 CSS 自定义属性声明，用于注入 :root
 *
 * @param theme - 'light' 使用设计稿浅色方案, 'dark' 使用 VSCode 暗色方案
 */
export function generateCssVariables(theme: ThemeMode = 'dark'): string {
    const c = theme === 'light' ? COLOR_LIGHT : COLOR_DARK;

    return `:root {
    /* Colors - Background */
    --color-bg-base: ${c.bgBase};
    --color-bg-surface: ${c.bgSurface};
    --color-bg-elevated: ${c.bgElevated};
    --color-bg-input: ${c.bgInput};

    /* Colors - Interactive */
    --color-bg-hover: ${c.bgHover};
    --color-bg-active: ${c.bgActive};
    --color-bg-selected: ${c.bgSelected};

    /* Colors - Border */
    --color-border: ${c.border};
    --color-border-hover: ${c.borderHover};
    --color-border-focus: ${c.borderFocus};
    --color-border-subtle: ${c.borderSubtle};

    /* Colors - Text */
    --color-text-primary: ${c.textPrimary};
    --color-text-secondary: ${c.textSecondary};
    --color-text-muted: ${c.textMuted};
    --color-text-disabled: ${c.textDisabled};
    --color-text-on-accent: ${c.textOnAccent};

    /* Colors - Accent */
    --color-accent: ${c.accent};
    --color-accent-bg: ${c.accentBg};
    --color-accent-header: ${c.accentHeader};

    /* Colors - Semantic */
    --color-success: ${c.success};
    --color-warning: ${c.warning};
    --color-error: ${c.error};
    --color-info: ${c.info};

    /* Colors - MBS Node Types */
    --color-node-group: ${NODE_COLORS.group};
    --color-node-parts: ${NODE_COLORS.parts};
    --color-node-joint: ${NODE_COLORS.joint};
    --color-node-motion: ${NODE_COLORS.motion};
    --color-node-frame: ${NODE_COLORS.frame};

    /* Typography */
    --font-family: ${TYPOGRAPHY.fontFamily};
    --font-family-mono: ${TYPOGRAPHY.fontFamilyMono};
    --font-size-xxs: ${TYPOGRAPHY.fontSizeXxs}px;
    --font-size-xs: ${TYPOGRAPHY.fontSizeXs}px;
    --font-size-sm: ${TYPOGRAPHY.fontSizeSm}px;
    --font-size-md: ${TYPOGRAPHY.fontSizeMd}px;
    --font-size-lg: ${TYPOGRAPHY.fontSizeLg}px;
    --font-size-xl: ${TYPOGRAPHY.fontSizeXl}px;
    --font-size-xxl: ${TYPOGRAPHY.fontSizeXxl}px;

    /* Spacing */
    --spacing-xs: ${SPACING.xs}px;
    --spacing-sm: ${SPACING.sm}px;
    --spacing-md: ${SPACING.md}px;
    --spacing-lg: ${SPACING.lg}px;
    --spacing-xl: ${SPACING.xl}px;
    --spacing-xxl: ${SPACING.xxl}px;

    /* Radius */
    --radius-xs: ${RADIUS.xs}px;
    --radius-sm: ${RADIUS.sm}px;
    --radius-md: ${RADIUS.md}px;
    --radius-lg: ${RADIUS.lg}px;

    /* Shadow */
    --shadow-dropdown: ${SHADOW.dropdown};

    /* Layout */
    --layout-sidebar-left: ${LAYOUT.sidebarLeftWidth}px;
    --layout-sidebar-right: ${LAYOUT.sidebarRightWidth}px;
    --layout-statusbar-height: ${LAYOUT.statusBarHeight}px;
    --layout-ribbon-height: ${LAYOUT.ribbonHeight}px;
    --layout-titlebar-height: ${LAYOUT.titleBarHeight}px;
    --layout-tree-indent: ${LAYOUT.treeIndent}px;
}`;
}
