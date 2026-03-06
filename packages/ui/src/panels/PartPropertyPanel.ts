/**
 * PartPropertyPanel - 零件属性面板
 *
 * 从 cadtoolonline.pen MB_RIGHT 节点翻译而来。
 * 显示选中零件的基本属性、物理属性和导出设置。
 */

// ============================================================================
// 数据接口
// ============================================================================

export interface PartBasicInfo {
    name: string;
    type: string;
    visible: boolean;
    color: string;
    transparent: boolean;
}

export interface PartPhysicsInfo {
    partsCount: number;
    material: string;
    density: string;
    totalMass: string;
    volume: string;
    centerOfMass: [string, string, string];
    inertiaTensor: [
        [string, string, string],
        [string, string, string],
        [string, string, string],
    ];
}

export interface PartExportInfo {
    meshPrecision: 'coarse' | 'balanced' | 'fine';
}

export interface PartPropertyData {
    basic: PartBasicInfo;
    physics: PartPhysicsInfo;
    export: PartExportInfo;
}

export interface PartPropertyPanelCallbacks {
    onNameChange?: (name: string) => void;
    onVisibilityChange?: (visible: boolean) => void;
    onColorChange?: (color: string) => void;
    onTransparencyChange?: (transparent: boolean) => void;
    onMaterialChange?: (material: string) => void;
    onMeshPrecisionChange?: (precision: string) => void;
}

// ============================================================================
// 组件
// ============================================================================

export class PartPropertyPanel {
    private element: HTMLElement;
    private callbacks: PartPropertyPanelCallbacks;

    constructor(callbacks: PartPropertyPanelCallbacks = {}) {
        this.callbacks = callbacks;
        this.element = document.createElement('div');
        this.element.className = 'part-property-panel';
        this.addStyles();
        this.buildEmpty();
    }

    private addStyles(): void {
        const styleId = 'part-property-panel-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .part-property-panel {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--color-bg-surface, #F5F5F5);
                font-family: var(--font-family, 'Microsoft YaHei', sans-serif);
                overflow-y: auto;
            }

            .ppp-header {
                display: flex;
                align-items: center;
                padding: 3px 8px;
                height: 24px;
                background: var(--color-bg-elevated, #F3F3F3);
                font-size: var(--font-size-md, 12px);
                font-weight: 600;
                color: var(--color-text-secondary, #374151);
                flex-shrink: 0;
            }

            .ppp-section {
                display: flex;
                align-items: center;
                padding: 4px 8px;
                height: 24px;
                background: var(--color-bg-elevated, #F3F4F6);
                font-size: var(--font-size-lg, 13px);
                font-weight: 600;
                color: var(--color-text-primary, #1F2937);
                flex-shrink: 0;
            }

            .ppp-separator {
                height: 1px;
                background: var(--color-border-subtle, #E5E7EB);
                flex-shrink: 0;
            }

            .ppp-row {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                height: 26px;
                flex-shrink: 0;
            }

            .ppp-label {
                width: 64px;
                flex-shrink: 0;
                font-size: var(--font-size-md, 12px);
                color: var(--color-text-muted, #6B7280);
            }

            .ppp-value {
                flex: 1;
                font-size: var(--font-size-md, 12px);
                color: var(--color-text-primary, #111827);
                min-width: 0;
            }

            .ppp-input {
                flex: 1;
                height: 22px;
                padding: 2px 6px;
                border: none;
                border-radius: var(--radius-sm, 3px);
                background: var(--color-bg-input, #FFFFFF);
                color: var(--color-text-primary, #111827);
                font-size: var(--font-size-md, 12px);
                font-family: inherit;
                min-width: 0;
            }

            .ppp-input:focus {
                outline: 1px solid var(--color-border-focus, #2563EB);
            }

            .ppp-select {
                flex: 1;
                height: 22px;
                padding: 2px 6px;
                border: none;
                border-radius: var(--radius-sm, 3px);
                background: var(--color-bg-input, #FFFFFF);
                color: var(--color-text-primary, #111827);
                font-size: var(--font-size-md, 12px);
                font-family: inherit;
                cursor: pointer;
                min-width: 0;
            }

            .ppp-checkbox {
                width: 16px;
                height: 16px;
                border-radius: var(--radius-sm, 3px);
                cursor: pointer;
                accent-color: var(--color-accent, #2563EB);
            }

            .ppp-color-swatch {
                width: 50px;
                height: 18px;
                border-radius: var(--radius-sm, 3px);
                cursor: pointer;
                border: 1px solid var(--color-border, #D1D5DB);
            }

            .ppp-sub-header {
                padding: 2px 8px;
                font-size: var(--font-size-md, 12px);
                font-weight: 600;
                color: var(--color-text-muted, #6B7280);
            }

            .ppp-vector-row {
                display: flex;
                align-items: center;
                gap: 2px;
                padding: 2px 8px;
                height: 26px;
                flex-shrink: 0;
            }

            .ppp-vector-label {
                width: 64px;
                flex-shrink: 0;
                font-size: var(--font-size-md, 12px);
                color: var(--color-text-muted, #6B7280);
            }

            .ppp-vector-cell {
                flex: 1;
                height: 20px;
                padding: 1px 3px;
                border-radius: var(--radius-xs, 2px);
                background: var(--color-bg-input, #FFFFFF);
                font-size: var(--font-size-xs, 10px);
                color: var(--color-text-primary, #111827);
                display: flex;
                align-items: center;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .ppp-vector-unit {
                flex-shrink: 0;
                font-size: var(--font-size-xs, 10px);
                color: var(--color-text-disabled, #9CA3AF);
                margin-left: 4px;
            }

            .ppp-empty {
                padding: 20px;
                text-align: center;
                color: var(--color-text-disabled, #9CA3AF);
                font-size: var(--font-size-md, 12px);
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    private buildEmpty(): void {
        this.element.innerHTML = '';
        this.element.innerHTML = `
            <div class="ppp-header">属性</div>
            <div class="ppp-empty">选择对象以查看属性</div>
        `;
    }

    update(data: PartPropertyData): void {
        this.element.innerHTML = '';

        // Header
        this.element.appendChild(this.createHeader(`属性-${data.basic.type}`));

        // 基本属性 section
        this.element.appendChild(this.createSection('基本属性'));
        this.element.appendChild(this.createInputRow('名称', data.basic.name, (v) => this.callbacks.onNameChange?.(v)));
        this.element.appendChild(this.createTextRow('类型', data.basic.type));
        this.element.appendChild(this.createCheckboxRow('可见性', data.basic.visible, (v) => this.callbacks.onVisibilityChange?.(v)));
        this.element.appendChild(this.createColorRow('颜色', data.basic.color, (v) => this.callbacks.onColorChange?.(v)));
        this.element.appendChild(this.createCheckboxRow('半透明', data.basic.transparent, (v) => this.callbacks.onTransparencyChange?.(v)));

        // 分隔线
        this.element.appendChild(this.createSeparator());

        // 物理属性 section
        this.element.appendChild(this.createSection('物理属性'));
        this.element.appendChild(this.createInputRow('零件个数', String(data.physics.partsCount)));
        this.element.appendChild(this.createSelectRow('材料', data.physics.material, [
            { value: 'steel', label: '钢:7800kg/m³' },
            { value: 'aluminum', label: '铝:2700kg/m³' },
            { value: 'custom', label: '自定义' },
        ], (v) => this.callbacks.onMaterialChange?.(v)));
        this.element.appendChild(this.createTextRow('密度', data.physics.density));
        this.element.appendChild(this.createTextRow('总质量', data.physics.totalMass));
        this.element.appendChild(this.createTextRow('体积', data.physics.volume));

        // 质心
        this.element.appendChild(this.createSubHeader('  质心'));
        this.element.appendChild(this.createVectorRow('', data.physics.centerOfMass, 'm'));

        // 惯性张量
        this.element.appendChild(this.createSubHeader('  惯性张量'));
        this.element.appendChild(this.createVectorRow('', data.physics.inertiaTensor[0]));
        this.element.appendChild(this.createVectorRow('', data.physics.inertiaTensor[1]));
        this.element.appendChild(this.createVectorRow('', data.physics.inertiaTensor[2], 'kg\u00B7m\u00B2'));

        // 分隔线
        this.element.appendChild(this.createSeparator());

        // 导出 section
        this.element.appendChild(this.createSection('导出'));
        this.element.appendChild(this.createSelectRow('网格精度', data.export.meshPrecision, [
            { value: 'coarse', label: '粗' },
            { value: 'balanced', label: '中' },
            { value: 'fine', label: '精' },
        ], (v) => this.callbacks.onMeshPrecisionChange?.(v)));
    }

    clear(): void {
        this.buildEmpty();
    }

    getElement(): HTMLElement {
        return this.element;
    }

    dispose(): void {
        this.element.remove();
    }

    // ========================================================================
    // DOM 构建工具方法
    // ========================================================================

    private createHeader(text: string): HTMLElement {
        const el = document.createElement('div');
        el.className = 'ppp-header';
        el.textContent = text;
        return el;
    }

    private createSection(text: string): HTMLElement {
        const el = document.createElement('div');
        el.className = 'ppp-section';
        el.textContent = text;
        return el;
    }

    private createSeparator(): HTMLElement {
        const el = document.createElement('div');
        el.className = 'ppp-separator';
        return el;
    }

    private createSubHeader(text: string): HTMLElement {
        const el = document.createElement('div');
        el.className = 'ppp-sub-header';
        el.textContent = text;
        return el;
    }

    private createTextRow(label: string, value: string): HTMLElement {
        const row = document.createElement('div');
        row.className = 'ppp-row';
        row.innerHTML = `<span class="ppp-label">${label}</span><span class="ppp-value">${value}</span>`;
        return row;
    }

    private createInputRow(label: string, value: string, onChange?: (v: string) => void): HTMLElement {
        const row = document.createElement('div');
        row.className = 'ppp-row';

        const lbl = document.createElement('span');
        lbl.className = 'ppp-label';
        lbl.textContent = label;

        const input = document.createElement('input');
        input.className = 'ppp-input';
        input.type = 'text';
        input.value = value;
        if (onChange) {
            input.addEventListener('change', () => onChange(input.value));
        }

        row.appendChild(lbl);
        row.appendChild(input);
        return row;
    }

    private createCheckboxRow(label: string, checked: boolean, onChange?: (v: boolean) => void): HTMLElement {
        const row = document.createElement('div');
        row.className = 'ppp-row';

        const lbl = document.createElement('span');
        lbl.className = 'ppp-label';
        lbl.textContent = label;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'ppp-checkbox';
        cb.checked = checked;
        if (onChange) {
            cb.addEventListener('change', () => onChange(cb.checked));
        }

        row.appendChild(lbl);
        row.appendChild(cb);
        return row;
    }

    private createColorRow(label: string, color: string, onChange?: (v: string) => void): HTMLElement {
        const row = document.createElement('div');
        row.className = 'ppp-row';

        const lbl = document.createElement('span');
        lbl.className = 'ppp-label';
        lbl.textContent = label;

        const swatch = document.createElement('div');
        swatch.className = 'ppp-color-swatch';
        swatch.style.background = color;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = color;
        colorInput.style.display = 'none';

        swatch.addEventListener('click', () => colorInput.click());
        colorInput.addEventListener('input', () => {
            swatch.style.background = colorInput.value;
            onChange?.(colorInput.value);
        });

        row.appendChild(lbl);
        row.appendChild(swatch);
        row.appendChild(colorInput);
        return row;
    }

    private createSelectRow(
        label: string,
        value: string,
        options: Array<{ value: string; label: string }>,
        onChange?: (v: string) => void,
    ): HTMLElement {
        const row = document.createElement('div');
        row.className = 'ppp-row';

        const lbl = document.createElement('span');
        lbl.className = 'ppp-label';
        lbl.textContent = label;

        const select = document.createElement('select');
        select.className = 'ppp-select';
        for (const opt of options) {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === value || opt.label === value) option.selected = true;
            select.appendChild(option);
        }
        if (onChange) {
            select.addEventListener('change', () => onChange(select.value));
        }

        row.appendChild(lbl);
        row.appendChild(select);
        return row;
    }

    private createVectorRow(label: string, values: [string, string, string], unit?: string): HTMLElement {
        const row = document.createElement('div');
        row.className = 'ppp-vector-row';

        const lbl = document.createElement('span');
        lbl.className = 'ppp-vector-label';
        lbl.textContent = label;
        row.appendChild(lbl);

        for (const v of values) {
            const cell = document.createElement('span');
            cell.className = 'ppp-vector-cell';
            cell.textContent = v;
            row.appendChild(cell);
        }

        if (unit) {
            const u = document.createElement('span');
            u.className = 'ppp-vector-unit';
            u.textContent = unit;
            row.appendChild(u);
        }

        return row;
    }
}
