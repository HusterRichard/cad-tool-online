// UI Panels

export interface PanelOptions {
    title: string;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
}

export class Panel {
    protected element: HTMLElement;
    protected title: string;
    protected content: HTMLElement;
    protected collapsed: boolean;

    constructor(options: PanelOptions) {
        this.title = options.title;
        this.collapsed = options.defaultCollapsed ?? false;

        this.element = document.createElement('div');
        this.element.className = 'panel';

        const header = document.createElement('div');
        header.className = 'panel-header';
        header.textContent = this.title;

        if (options.collapsible) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => this.toggle());
        }

        this.content = document.createElement('div');
        this.content.className = 'panel-content';

        this.element.appendChild(header);
        this.element.appendChild(this.content);

        if (this.collapsed) {
            this.content.style.display = 'none';
        }
    }

    toggle(): void {
        this.collapsed = !this.collapsed;
        this.content.style.display = this.collapsed ? 'none' : 'block';
    }

    getElement(): HTMLElement {
        return this.element;
    }

    setContent(html: string): void {
        this.content.innerHTML = html;
    }

    appendContent(element: HTMLElement): void {
        this.content.appendChild(element);
    }
}

export class ModelTreePanel extends Panel {
    constructor() {
        super({
            title: 'Model Tree',
            collapsible: true
        });
        this.element.classList.add('model-tree-panel');
    }
}

export class PropertyPanel extends Panel {
    constructor() {
        super({
            title: 'Properties',
            collapsible: true
        });
        this.element.classList.add('property-panel');
    }
}

// MBS Panels
export * from './MbsPanels';

// Ribbon Menu
export * from './RibbonMenu';
