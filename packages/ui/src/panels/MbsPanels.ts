import { Panel, type PanelOptions } from './index';

// 关节类型枚举 (与 @cadtool-online/geo 中的 MbsJointType 对应)
export enum MbsJointType {
    Revolute = 0,
    Prismatic = 1,
    Cylindrical = 2,
    Spherical = 3,
    Universal = 4,
    Planar = 5,
    Fixed = 6,
}

// MbsGroup 接口 (简化版，用于 UI)
export interface IMbsGroupLite {
    getId(): number;
    getName(): string;
    getPartsCount(): number;
    getConnectorCount(): number;
    getMotionCount(): number;
}

// ============================================================================
// 事件类型
// ============================================================================

export interface MbsTreeNodeClickEvent {
    nodeType: 'group' | 'parts' | 'joint' | 'motion' | 'frame';
    nodeId: string;
    nodeName: string;
}

export type MbsTreeNodeClickCallback = (event: MbsTreeNodeClickEvent) => void;

// ============================================================================
// MBS 模型树面板
// ============================================================================

export interface MbsModelTreePanelOptions extends PanelOptions {
    onNodeClick?: MbsTreeNodeClickCallback;
    onNodeDoubleClick?: MbsTreeNodeClickCallback;
}

/**
 * MBS 模型树面板 - 显示多体系统的层级结构
 */
export class MbsModelTreePanel extends Panel {
    private treeContainer: HTMLElement;
    private onNodeClick?: MbsTreeNodeClickCallback;
    private onNodeDoubleClick?: MbsTreeNodeClickCallback;
    private selectedNodeId: string | null = null;

    constructor(options: MbsModelTreePanelOptions = { title: 'MBS Model' }) {
        super({
            title: options.title ?? 'MBS Model',
            collapsible: options.collapsible ?? true,
            defaultCollapsed: options.defaultCollapsed
        });

        this.onNodeClick = options.onNodeClick;
        this.onNodeDoubleClick = options.onNodeDoubleClick;

        this.element.classList.add('mbs-model-tree-panel');

        this.treeContainer = document.createElement('div');
        this.treeContainer.className = 'mbs-tree-container';
        this.content.appendChild(this.treeContainer);

        this.addStyles();
    }

    private addStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .mbs-tree-container {
                font-family: monospace;
                font-size: 12px;
                padding: 8px;
            }
            .mbs-tree-node {
                padding: 4px 8px;
                cursor: pointer;
                border-radius: 3px;
                margin: 2px 0;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .mbs-tree-node:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            .mbs-tree-node.selected {
                background: rgba(0, 120, 215, 0.3);
            }
            .mbs-tree-node-icon {
                width: 16px;
                height: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .mbs-tree-children {
                margin-left: 16px;
                border-left: 1px solid rgba(255, 255, 255, 0.2);
            }
            .mbs-tree-node-group .mbs-tree-node-icon { color: #4CAF50; }
            .mbs-tree-node-parts .mbs-tree-node-icon { color: #2196F3; }
            .mbs-tree-node-joint .mbs-tree-node-icon { color: #FF9800; }
            .mbs-tree-node-motion .mbs-tree-node-icon { color: #9C27B0; }
            .mbs-tree-node-frame .mbs-tree-node-icon { color: #00BCD4; }
        `;
        document.head.appendChild(style);
    }

    private createTreeNode(
        type: 'group' | 'parts' | 'joint' | 'motion' | 'frame',
        id: string,
        name: string,
        children?: HTMLElement
    ): HTMLElement {
        const node = document.createElement('div');
        node.className = `mbs-tree-node mbs-tree-node-${type}`;
        node.dataset.nodeType = type;
        node.dataset.nodeId = id;

        const icon = document.createElement('span');
        icon.className = 'mbs-tree-node-icon';
        icon.textContent = this.getNodeIcon(type);

        const label = document.createElement('span');
        label.textContent = name;

        node.appendChild(icon);
        node.appendChild(label);

        node.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(id);
            this.onNodeClick?.({ nodeType: type, nodeId: id, nodeName: name });
        });

        node.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.onNodeDoubleClick?.({ nodeType: type, nodeId: id, nodeName: name });
        });

        const wrapper = document.createElement('div');
        wrapper.appendChild(node);

        if (children) {
            const childContainer = document.createElement('div');
            childContainer.className = 'mbs-tree-children';
            childContainer.appendChild(children);
            wrapper.appendChild(childContainer);
        }

        return wrapper;
    }

    private getNodeIcon(type: string): string {
        switch (type) {
            case 'group': return '📁';
            case 'parts': return '🔷';
            case 'joint': return '🔗';
            case 'motion': return '⚡';
            case 'frame': return '📐';
            default: return '•';
        }
    }

    selectNode(id: string): void {
        // 取消之前的选择
        const prevSelected = this.treeContainer.querySelector('.mbs-tree-node.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }

        // 选择新节点
        const node = this.treeContainer.querySelector(`[data-node-id="${id}"]`);
        if (node) {
            node.classList.add('selected');
            this.selectedNodeId = id;
        }
    }

    /**
     * 从 MbsGroup 构建树
     */
    buildTreeFromGroup(group: IMbsGroupLite): void {
        this.treeContainer.innerHTML = '';

        const buildGroupNode = (g: IMbsGroupLite): HTMLElement => {
            const children = document.createDocumentFragment();

            // 添加零件
            const partsCount = g.getPartsCount();
            for (let i = 0; i < partsCount; i++) {
                // 需要通过索引获取，这里简化处理
            }

            // 添加连接器
            const connectorCount = g.getConnectorCount();
            for (let i = 0; i < connectorCount; i++) {
                // 需要通过索引获取
            }

            // 添加驱动
            const motionCount = g.getMotionCount();
            for (let i = 0; i < motionCount; i++) {
                // 需要通过索引获取
            }

            const childrenEl = document.createElement('div');
            childrenEl.appendChild(children);

            return this.createTreeNode(
                'group',
                g.getId().toString(),
                g.getName(),
                childrenEl.children.length > 0 ? childrenEl : undefined
            );
        };

        const rootNode = buildGroupNode(group);
        this.treeContainer.appendChild(rootNode);
    }

    /**
     * 手动添加节点
     */
    addNode(
        parentId: string | null,
        type: 'group' | 'parts' | 'joint' | 'motion' | 'frame',
        id: string,
        name: string
    ): void {
        const node = this.createTreeNode(type, id, name);

        if (parentId) {
            const parentNode = this.treeContainer.querySelector(`[data-node-id="${parentId}"]`);
            if (parentNode) {
                let childContainer = parentNode.parentElement?.querySelector('.mbs-tree-children');
                if (!childContainer) {
                    childContainer = document.createElement('div');
                    childContainer.className = 'mbs-tree-children';
                    parentNode.parentElement?.appendChild(childContainer);
                }
                childContainer.appendChild(node);
                return;
            }
        }

        this.treeContainer.appendChild(node);
    }

    /**
     * 移除节点
     */
    removeNode(id: string): void {
        const node = this.treeContainer.querySelector(`[data-node-id="${id}"]`);
        if (node) {
            node.parentElement?.remove();
        }
    }

    /**
     * 清空树
     */
    clearTree(): void {
        this.treeContainer.innerHTML = '';
        this.selectedNodeId = null;
    }

    getSelectedNodeId(): string | null {
        return this.selectedNodeId;
    }
}

// ============================================================================
// 关节属性面板
// ============================================================================

export interface JointPropertyData {
    id: string;
    name: string;
    type: MbsJointType;
    typeName: string;
    dof: number;
    position: number[];
    velocity: number[];
    limits?: { lower: number[]; upper: number[] };
    iFrameName?: string;
    jFrameName?: string;
}

export type JointPropertyChangeCallback = (jointId: string, property: string, value: number) => void;

/**
 * 关节属性面板 - 显示和编辑关节属性
 */
export class JointPropertyPanel extends Panel {
    private propertyContainer: HTMLElement;
    private currentJointId: string | null = null;
    private onPropertyChange?: JointPropertyChangeCallback;

    constructor(onPropertyChange?: JointPropertyChangeCallback) {
        super({
            title: 'Joint Properties',
            collapsible: true
        });

        this.onPropertyChange = onPropertyChange;
        this.element.classList.add('joint-property-panel');

        this.propertyContainer = document.createElement('div');
        this.propertyContainer.className = 'joint-property-container';
        this.content.appendChild(this.propertyContainer);

        this.addStyles();
        this.showEmpty();
    }

    private addStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .joint-property-container {
                padding: 8px;
                font-size: 12px;
            }
            .joint-property-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .joint-property-label {
                color: #aaa;
            }
            .joint-property-value {
                color: #fff;
                font-family: monospace;
            }
            .joint-property-input {
                width: 80px;
                padding: 2px 4px;
                background: #333;
                border: 1px solid #555;
                color: #fff;
                font-family: monospace;
            }
            .joint-property-section {
                margin-top: 12px;
                padding-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
            }
            .joint-property-section-title {
                font-weight: bold;
                color: #4CAF50;
                margin-bottom: 8px;
            }
            .joint-property-empty {
                color: #666;
                text-align: center;
                padding: 20px;
            }
        `;
        document.head.appendChild(style);
    }

    private createPropertyRow(label: string, value: string | number, editable: boolean = false, property?: string): HTMLElement {
        const row = document.createElement('div');
        row.className = 'joint-property-row';

        const labelEl = document.createElement('span');
        labelEl.className = 'joint-property-label';
        labelEl.textContent = label;

        if (editable && property) {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'joint-property-input';
            input.value = String(value);
            input.step = '0.01';
            input.addEventListener('change', () => {
                if (this.currentJointId && this.onPropertyChange) {
                    this.onPropertyChange(this.currentJointId, property, parseFloat(input.value));
                }
            });
            row.appendChild(labelEl);
            row.appendChild(input);
        } else {
            const valueEl = document.createElement('span');
            valueEl.className = 'joint-property-value';
            valueEl.textContent = String(value);
            row.appendChild(labelEl);
            row.appendChild(valueEl);
        }

        return row;
    }

    private createSection(title: string): HTMLElement {
        const section = document.createElement('div');
        section.className = 'joint-property-section';

        const titleEl = document.createElement('div');
        titleEl.className = 'joint-property-section-title';
        titleEl.textContent = title;
        section.appendChild(titleEl);

        return section;
    }

    showEmpty(): void {
        this.propertyContainer.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'joint-property-empty';
        empty.textContent = 'Select a joint to view properties';
        this.propertyContainer.appendChild(empty);
        this.currentJointId = null;
    }

    showJointProperties(data: JointPropertyData): void {
        this.propertyContainer.innerHTML = '';
        this.currentJointId = data.id;

        // 基本信息
        const basicSection = this.createSection('Basic Info');
        basicSection.appendChild(this.createPropertyRow('Name', data.name));
        basicSection.appendChild(this.createPropertyRow('Type', data.typeName));
        basicSection.appendChild(this.createPropertyRow('DOF', data.dof));
        this.propertyContainer.appendChild(basicSection);

        // 连接信息
        if (data.iFrameName || data.jFrameName) {
            const connectionSection = this.createSection('Connection');
            if (data.iFrameName) {
                connectionSection.appendChild(this.createPropertyRow('I-Frame', data.iFrameName));
            }
            if (data.jFrameName) {
                connectionSection.appendChild(this.createPropertyRow('J-Frame', data.jFrameName));
            }
            this.propertyContainer.appendChild(connectionSection);
        }

        // 位置
        if (data.position.length > 0) {
            const posSection = this.createSection('Position');
            data.position.forEach((val, i) => {
                const label = data.dof === 1 ? 'Value' : `DOF ${i + 1}`;
                posSection.appendChild(this.createPropertyRow(label, val.toFixed(4), true, `position_${i}`));
            });
            this.propertyContainer.appendChild(posSection);
        }

        // 速度
        if (data.velocity.length > 0) {
            const velSection = this.createSection('Velocity');
            data.velocity.forEach((val, i) => {
                const label = data.dof === 1 ? 'Value' : `DOF ${i + 1}`;
                velSection.appendChild(this.createPropertyRow(label, val.toFixed(4)));
            });
            this.propertyContainer.appendChild(velSection);
        }

        // 限位
        if (data.limits) {
            const limitsSection = this.createSection('Limits');
            data.limits.lower.forEach((val, i) => {
                limitsSection.appendChild(this.createPropertyRow(`Lower ${i + 1}`, val.toFixed(4)));
            });
            data.limits.upper.forEach((val, i) => {
                limitsSection.appendChild(this.createPropertyRow(`Upper ${i + 1}`, val.toFixed(4)));
            });
            this.propertyContainer.appendChild(limitsSection);
        }
    }
}

// ============================================================================
// 运动控制面板
// ============================================================================

export interface MotionControlData {
    id: string;
    name: string;
    jointName: string;
    functionType: string;
    enabled: boolean;
    parameters: Record<string, number>;
}

export type MotionControlCallback = (motionId: string, action: 'play' | 'pause' | 'reset' | 'enable' | 'disable') => void;
export type MotionParameterChangeCallback = (motionId: string, parameter: string, value: number) => void;

/**
 * 运动控制面板 - 控制关节驱动
 */
export class MotionControlPanel extends Panel {
    private controlContainer: HTMLElement;
    private motionList: HTMLElement;
    private onControl?: MotionControlCallback;

    // 动画状态
    private isPlaying: boolean = false;
    private currentTime: number = 0;

    constructor(
        onControl?: MotionControlCallback,
        _onParameterChange?: MotionParameterChangeCallback
    ) {
        super({
            title: 'Motion Control',
            collapsible: true
        });

        this.onControl = onControl;
        this.element.classList.add('motion-control-panel');

        this.controlContainer = document.createElement('div');
        this.controlContainer.className = 'motion-control-container';

        // 全局控制按钮
        const globalControls = this.createGlobalControls();
        this.controlContainer.appendChild(globalControls);

        // 时间显示
        const timeDisplay = this.createTimeDisplay();
        this.controlContainer.appendChild(timeDisplay);

        // 运动列表
        this.motionList = document.createElement('div');
        this.motionList.className = 'motion-list';
        this.controlContainer.appendChild(this.motionList);

        this.content.appendChild(this.controlContainer);
        this.addStyles();
    }

    private addStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .motion-control-container {
                padding: 8px;
            }
            .motion-global-controls {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }
            .motion-control-btn {
                padding: 6px 12px;
                background: #444;
                border: 1px solid #666;
                color: #fff;
                cursor: pointer;
                border-radius: 3px;
                font-size: 14px;
            }
            .motion-control-btn:hover {
                background: #555;
            }
            .motion-control-btn.active {
                background: #4CAF50;
            }
            .motion-time-display {
                font-family: monospace;
                font-size: 14px;
                padding: 8px;
                background: #222;
                border-radius: 3px;
                margin-bottom: 12px;
                text-align: center;
            }
            .motion-list {
                max-height: 300px;
                overflow-y: auto;
            }
            .motion-item {
                padding: 8px;
                margin-bottom: 8px;
                background: #333;
                border-radius: 3px;
            }
            .motion-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .motion-item-name {
                font-weight: bold;
            }
            .motion-item-toggle {
                cursor: pointer;
            }
            .motion-item-params {
                font-size: 11px;
                color: #aaa;
            }
        `;
        document.head.appendChild(style);
    }

    private createGlobalControls(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'motion-global-controls';

        const playBtn = document.createElement('button');
        playBtn.className = 'motion-control-btn';
        playBtn.textContent = '▶ Play';
        playBtn.addEventListener('click', () => {
            this.isPlaying = !this.isPlaying;
            playBtn.textContent = this.isPlaying ? '⏸ Pause' : '▶ Play';
            playBtn.classList.toggle('active', this.isPlaying);
        });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'motion-control-btn';
        resetBtn.textContent = '⏹ Reset';
        resetBtn.addEventListener('click', () => {
            this.currentTime = 0;
            this.updateTimeDisplay();
        });

        container.appendChild(playBtn);
        container.appendChild(resetBtn);

        return container;
    }

    private createTimeDisplay(): HTMLElement {
        const display = document.createElement('div');
        display.className = 'motion-time-display';
        display.id = 'motion-time-display';
        display.textContent = 'Time: 0.000 s';
        return display;
    }

    private updateTimeDisplay(): void {
        const display = document.getElementById('motion-time-display');
        if (display) {
            display.textContent = `Time: ${this.currentTime.toFixed(3)} s`;
        }
    }

    addMotion(data: MotionControlData): void {
        const item = document.createElement('div');
        item.className = 'motion-item';
        item.dataset.motionId = data.id;

        const header = document.createElement('div');
        header.className = 'motion-item-header';

        const name = document.createElement('span');
        name.className = 'motion-item-name';
        name.textContent = `${data.name} → ${data.jointName}`;

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'motion-item-toggle';
        toggle.checked = data.enabled;
        toggle.addEventListener('change', () => {
            this.onControl?.(data.id, toggle.checked ? 'enable' : 'disable');
        });

        header.appendChild(name);
        header.appendChild(toggle);

        const params = document.createElement('div');
        params.className = 'motion-item-params';
        params.textContent = `Type: ${data.functionType}`;

        item.appendChild(header);
        item.appendChild(params);

        this.motionList.appendChild(item);
    }

    removeMotion(id: string): void {
        const item = this.motionList.querySelector(`[data-motion-id="${id}"]`);
        if (item) {
            item.remove();
        }
    }

    clearMotions(): void {
        this.motionList.innerHTML = '';
    }

    setTime(time: number): void {
        this.currentTime = time;
        this.updateTimeDisplay();
    }

    isAnimationPlaying(): boolean {
        return this.isPlaying;
    }
}
