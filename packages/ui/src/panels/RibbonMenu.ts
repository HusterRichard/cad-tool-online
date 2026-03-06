/**
 * Ribbon 菜单组件
 * 提供核心功能入口：分组设计、标架设计、关节设计、驱动设计
 */

export interface RibbonMenuItem {
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    children?: RibbonMenuItem[];
}

export interface RibbonMenuGroup {
    id: string;
    label: string;
    icon: string;
    items: RibbonMenuItem[];
}

export type RibbonActionCallback = (action: string, params?: Record<string, unknown>) => void;

/**
 * Ribbon 菜单配置 - MBS 核心功能
 */
export const MBS_RIBBON_CONFIG: RibbonMenuGroup[] = [
    {
        id: 'group',
        label: '分组设计',
        icon: '📁',
        items: [
            { id: 'createGroup', label: '新建分组', icon: '➕' },
            { id: 'createChildGroup', label: '添加子分组', icon: '📂' },
            { id: 'groupProperties', label: '分组属性', icon: '⚙️' },
        ]
    },
    {
        id: 'frame',
        label: '标架设计',
        icon: '📐',
        items: [
            { id: 'createFrame', label: '新建标架', icon: '➕' },
            { id: 'editFrame', label: '编辑标架', icon: '✏️' },
            { id: 'deleteFrame', label: '删除标架', icon: '🗑️' },
        ]
    },
    {
        id: 'joint',
        label: '关节设计',
        icon: '🔗',
        items: [
            { id: 'createJoint_revolute', label: 'Revolute（旋转）', icon: '🔄' },
            { id: 'createJoint_prismatic', label: 'Prismatic（移动）', icon: '↔️' },
            { id: 'createJoint_cylindrical', label: 'Cylindrical（圆柱）', icon: '🔵' },
            { id: 'createJoint_spherical', label: 'Spherical（球）', icon: '⚪' },
            { id: 'createJoint_universal', label: 'Universal（万向）', icon: '✚' },
            { id: 'createJoint_planar', label: 'Planar（平面）', icon: '▭' },
            { id: 'createJoint_fixed', label: 'Fixed（固定）', icon: '🔒' },
        ]
    },
    {
        id: 'motion',
        label: '驱动设计',
        icon: '⚡',
        items: [
            { id: 'createMotion_rotational', label: '旋转驱动', icon: '🔄' },
            { id: 'createMotion_translational', label: '平移驱动', icon: '➡️' },
            { id: 'motionProperties', label: '驱动属性', icon: '⚙️' },
        ]
    },
];

/**
 * Ribbon 菜单组件
 */
export class RibbonMenu {
    private element: HTMLElement;
    private onAction?: RibbonActionCallback;
    private config: RibbonMenuGroup[];

    constructor(config: RibbonMenuGroup[] = MBS_RIBBON_CONFIG, onAction?: RibbonActionCallback) {
        this.config = config;
        this.onAction = onAction;
        this.element = this.createRibbonElement();
        this.addStyles();
        this.setupDocumentClickHandler();
    }

    private createRibbonElement(): HTMLElement {
        const ribbon = document.createElement('div');
        ribbon.className = 'ribbon-menu';

        for (const group of this.config) {
            const groupEl = this.createMenuGroup(group);
            ribbon.appendChild(groupEl);
        }

        return ribbon;
    }

    private createMenuGroup(group: RibbonMenuGroup): HTMLElement {
        const container = document.createElement('div');
        container.className = 'ribbon-group';
        container.dataset.groupId = group.id;

        const button = document.createElement('button');
        button.className = 'ribbon-group-btn';
        button.innerHTML = `<span class="ribbon-icon">${group.icon}</span><span class="ribbon-label">${group.label}</span><span class="ribbon-arrow">▼</span>`;

        const dropdown = document.createElement('div');
        dropdown.className = 'ribbon-dropdown';
        dropdown.style.display = 'none';

        for (const item of group.items) {
            const itemEl = this.createMenuItem(item);
            dropdown.appendChild(itemEl);
        }

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(dropdown, button);
        });

        container.appendChild(button);
        container.appendChild(dropdown);

        return container;
    }

    private createMenuItem(item: RibbonMenuItem): HTMLElement {
        const menuItem = document.createElement('div');
        menuItem.className = 'ribbon-menu-item';
        if (item.disabled) {
            menuItem.classList.add('disabled');
        }
        menuItem.dataset.actionId = item.id;

        const icon = document.createElement('span');
        icon.className = 'ribbon-menu-item-icon';
        icon.textContent = item.icon || '';

        const label = document.createElement('span');
        label.className = 'ribbon-menu-item-label';
        label.textContent = item.label;

        menuItem.appendChild(icon);
        menuItem.appendChild(label);

        if (!item.disabled) {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAction(item.id);
                this.closeAllDropdowns();
            });
        }

        return menuItem;
    }

    private toggleDropdown(dropdown: HTMLElement, button: HTMLElement): void {
        const isOpen = dropdown.style.display !== 'none';

        this.closeAllDropdowns();

        if (!isOpen) {
            dropdown.style.display = 'block';
            button.classList.add('active');
        }
    }

    private closeAllDropdowns(): void {
        const dropdowns = this.element.querySelectorAll('.ribbon-dropdown');
        dropdowns.forEach(d => {
            (d as HTMLElement).style.display = 'none';
        });

        const buttons = this.element.querySelectorAll('.ribbon-group-btn');
        buttons.forEach(b => b.classList.remove('active'));
    }

    private setupDocumentClickHandler(): void {
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });
    }

    private handleAction(actionId: string): void {
        // 解析 action ID，提取参数
        const params: Record<string, unknown> = {};

        if (actionId.startsWith('createJoint_')) {
            const jointType = actionId.replace('createJoint_', '');
            params.jointType = jointType;
        } else if (actionId.startsWith('createMotion_')) {
            const motionType = actionId.replace('createMotion_', '');
            params.motionType = motionType;
        }

        this.onAction?.(actionId, params);
    }

    private addStyles(): void {
        const styleId = 'ribbon-menu-styles';
        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .ribbon-menu {
                display: flex;
                gap: 2px;
                padding: 4px 8px;
                background-color: var(--color-bg-elevated, #2d2d2d);
                border-bottom: 1px solid var(--color-border, #3c3c3c);
            }

            .ribbon-group {
                position: relative;
            }

            .ribbon-group-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background-color: transparent;
                border: 1px solid transparent;
                border-radius: var(--radius-sm, 3px);
                color: var(--color-text-primary, #cccccc);
                cursor: pointer;
                font-size: var(--font-size-lg, 13px);
                font-family: inherit;
            }

            .ribbon-group-btn:hover {
                background-color: var(--color-bg-hover, #3e3e3e);
                border-color: var(--color-border-hover, #4e4e4e);
            }

            .ribbon-group-btn.active {
                background-color: var(--color-bg-active, #094771);
                border-color: var(--color-accent, #007acc);
            }

            .ribbon-icon {
                font-size: var(--font-size-xl, 14px);
            }

            .ribbon-label {
                font-weight: 500;
            }

            .ribbon-arrow {
                font-size: 8px;
                opacity: 0.7;
                margin-left: 2px;
            }

            .ribbon-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                min-width: 180px;
                background-color: var(--color-bg-surface, #252526);
                border: 1px solid var(--color-border, #3c3c3c);
                border-radius: var(--radius-md, 4px);
                box-shadow: var(--shadow-dropdown, 0 4px 12px rgba(0, 0, 0, 0.3));
                z-index: 1000;
                padding: 4px 0;
            }

            .ribbon-menu-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                cursor: pointer;
                font-size: var(--font-size-lg, 13px);
                color: var(--color-text-primary, #cccccc);
            }

            .ribbon-menu-item:hover {
                background-color: var(--color-bg-active, #094771);
            }

            .ribbon-menu-item.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .ribbon-menu-item.disabled:hover {
                background-color: transparent;
            }

            .ribbon-menu-item-icon {
                width: 20px;
                text-align: center;
                font-size: var(--font-size-xl, 14px);
            }

            .ribbon-menu-item-label {
                flex: 1;
            }

            .ribbon-separator {
                height: 1px;
                background-color: var(--color-border, #3c3c3c);
                margin: 4px 8px;
            }
        `;
        document.head.appendChild(style);
    }

    getElement(): HTMLElement {
        return this.element;
    }

    setActionCallback(callback: RibbonActionCallback): void {
        this.onAction = callback;
    }

    setItemDisabled(actionId: string, disabled: boolean): void {
        const item = this.element.querySelector(`[data-action-id="${actionId}"]`);
        if (item) {
            if (disabled) {
                item.classList.add('disabled');
            } else {
                item.classList.remove('disabled');
            }
        }
    }

    setGroupDisabled(groupId: string, disabled: boolean): void {
        const group = this.element.querySelector(`[data-group-id="${groupId}"]`);
        if (group) {
            const btn = group.querySelector('.ribbon-group-btn') as HTMLButtonElement;
            if (btn) {
                btn.disabled = disabled;
                if (disabled) {
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                } else {
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }
            }
        }
    }
}

/**
 * 生成 Ribbon 菜单的 HTML 字符串（用于 Webview）
 */
export function generateRibbonHtml(config: RibbonMenuGroup[] = MBS_RIBBON_CONFIG): string {
    let html = '<div class="ribbon-menu">';

    for (const group of config) {
        html += `
            <div class="ribbon-group" data-group-id="${group.id}">
                <button class="ribbon-group-btn">
                    <span class="ribbon-icon">${group.icon}</span>
                    <span class="ribbon-label">${group.label}</span>
                    <span class="ribbon-arrow">▼</span>
                </button>
                <div class="ribbon-dropdown" style="display: none;">`;

        for (const item of group.items) {
            html += `
                    <div class="ribbon-menu-item" data-action-id="${item.id}">
                        <span class="ribbon-menu-item-icon">${item.icon || ''}</span>
                        <span class="ribbon-menu-item-label">${item.label}</span>
                    </div>`;
        }

        html += `
                </div>
            </div>`;
    }

    html += '</div>';
    return html;
}

/**
 * 生成 Ribbon 菜单的 CSS 字符串（用于 Webview）
 */
export function generateRibbonCss(): string {
    return `
        .ribbon-menu {
            display: flex;
            gap: 2px;
            padding: 4px 8px;
            background-color: var(--color-bg-elevated, #2d2d2d);
            border-bottom: 1px solid var(--color-border, #3c3c3c);
        }

        .ribbon-group {
            position: relative;
        }

        .ribbon-group-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background-color: transparent;
            border: 1px solid transparent;
            border-radius: var(--radius-sm, 3px);
            color: var(--color-text-primary, #cccccc);
            cursor: pointer;
            font-size: var(--font-size-lg, 13px);
            font-family: inherit;
        }

        .ribbon-group-btn:hover {
            background-color: var(--color-bg-hover, #3e3e3e);
            border-color: var(--color-border-hover, #4e4e4e);
        }

        .ribbon-group-btn.active {
            background-color: var(--color-bg-active, #094771);
            border-color: var(--color-accent, #007acc);
        }

        .ribbon-icon {
            font-size: var(--font-size-xl, 14px);
        }

        .ribbon-label {
            font-weight: 500;
        }

        .ribbon-arrow {
            font-size: 8px;
            opacity: 0.7;
            margin-left: 2px;
        }

        .ribbon-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            min-width: 180px;
            background-color: var(--color-bg-surface, #252526);
            border: 1px solid var(--color-border, #3c3c3c);
            border-radius: var(--radius-md, 4px);
            box-shadow: var(--shadow-dropdown, 0 4px 12px rgba(0, 0, 0, 0.3));
            z-index: 1000;
            padding: 4px 0;
        }

        .ribbon-menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: var(--font-size-lg, 13px);
            color: var(--color-text-primary, #cccccc);
        }

        .ribbon-menu-item:hover {
            background-color: var(--color-bg-active, #094771);
        }

        .ribbon-menu-item.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .ribbon-menu-item.disabled:hover {
            background-color: transparent;
        }

        .ribbon-menu-item-icon {
            width: 20px;
            text-align: center;
            font-size: var(--font-size-xl, 14px);
        }

        .ribbon-menu-item-label {
            flex: 1;
        }
    `;
}

/**
 * 生成 Ribbon 菜单的事件处理 JavaScript（用于 Webview）
 */
export function generateRibbonScript(): string {
    return `
        // Ribbon 菜单事件处理
        (function() {
            let activeDropdown = null;

            // 点击菜单组按钮
            document.querySelectorAll('.ribbon-group-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const group = btn.parentElement;
                    const dropdown = group.querySelector('.ribbon-dropdown');
                    const isOpen = dropdown.style.display !== 'none';

                    closeAllDropdowns();

                    if (!isOpen) {
                        dropdown.style.display = 'block';
                        btn.classList.add('active');
                        activeDropdown = dropdown;
                    }
                });
            });

            // 点击菜单项
            document.querySelectorAll('.ribbon-menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (item.classList.contains('disabled')) {
                        return;
                    }
                    const actionId = item.dataset.actionId;
                    handleRibbonAction(actionId);
                    closeAllDropdowns();
                });
            });

            // 点击文档关闭下拉菜单
            document.addEventListener('click', () => {
                closeAllDropdowns();
            });

            function closeAllDropdowns() {
                document.querySelectorAll('.ribbon-dropdown').forEach(d => {
                    d.style.display = 'none';
                });
                document.querySelectorAll('.ribbon-group-btn').forEach(b => {
                    b.classList.remove('active');
                });
                activeDropdown = null;
            }

            function handleRibbonAction(actionId) {
                const params = {};

                if (actionId.startsWith('createJoint_')) {
                    params.jointType = actionId.replace('createJoint_', '');
                } else if (actionId.startsWith('createMotion_')) {
                    params.motionType = actionId.replace('createMotion_', '');
                }

                // 发送消息到 VSCode Extension
                vscode.postMessage({
                    command: 'ribbonAction',
                    action: actionId,
                    params: params
                });
            }
        })();
    `;
}
