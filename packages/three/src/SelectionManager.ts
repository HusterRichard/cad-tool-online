import * as THREE from 'three';

export interface SelectionOptions {
    highlightColor?: number;
    highlightOpacity?: number;
    outlineEnabled?: boolean;
}

export interface SelectionEvent {
    type: 'select' | 'deselect' | 'hover';
    objectId: string | null;
    object: THREE.Object3D | null;
}

export type SelectionCallback = (event: SelectionEvent) => void;

/**
 * 选择管理器 - 处理 3D 对象的选择和高亮
 */
export class SelectionManager {
    private camera: THREE.Camera;
    private domElement: HTMLElement;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;

    private selectableObjects: Map<string, THREE.Object3D> = new Map();
    private selectedIds: Set<string> = new Set();
    private hoveredId: string | null = null;

    private originalMaterials: Map<string, THREE.Material | THREE.Material[]> = new Map();
    private highlightMaterial: THREE.MeshBasicMaterial;
    private hoverMaterial: THREE.MeshBasicMaterial;

    private callbacks: SelectionCallback[] = [];
    private enabled: boolean = true;
    private hoverEnabled: boolean = true;

    private readonly onClickHandler: (event: MouseEvent) => void;
    private readonly onMouseMoveHandler: (event: MouseEvent) => void;

    constructor(
        _scene: THREE.Scene,
        camera: THREE.Camera,
        domElement: HTMLElement,
        options: SelectionOptions = {}
    ) {
        this.camera = camera;
        this.domElement = domElement;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // 高亮材质
        this.highlightMaterial = new THREE.MeshBasicMaterial({
            color: options.highlightColor ?? 0x00ff00,
            transparent: true,
            opacity: options.highlightOpacity ?? 0.8,
            side: THREE.DoubleSide
        });

        // 悬停材质
        this.hoverMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        this.onClickHandler = this.onClick.bind(this);
        this.onMouseMoveHandler = this.onMouseMove.bind(this);
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.domElement.addEventListener('click', this.onClickHandler);
        this.domElement.addEventListener('mousemove', this.onMouseMoveHandler);
    }

    private updateMouse(event: MouseEvent): void {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private raycast(): THREE.Intersection[] {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const objects = Array.from(this.selectableObjects.values());
        return this.raycaster.intersectObjects(objects, true);
    }

    private findObjectId(object: THREE.Object3D): string | null {
        for (const [id, obj] of this.selectableObjects) {
            if (obj === object || this.isDescendant(obj, object)) {
                return id;
            }
        }
        return null;
    }

    private isDescendant(parent: THREE.Object3D, child: THREE.Object3D): boolean {
        let current: THREE.Object3D | null = child;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }

    private onClick(event: MouseEvent): void {
        if (!this.enabled) return;

        this.updateMouse(event);
        const intersects = this.raycast();

        if (intersects.length > 0) {
            const objectId = this.findObjectId(intersects[0].object);
            if (objectId) {
                if (event.ctrlKey || event.metaKey) {
                    // 多选模式
                    this.toggleSelection(objectId);
                } else {
                    // 单选模式
                    this.clearSelection();
                    this.select(objectId);
                }
            }
        } else if (!event.ctrlKey && !event.metaKey) {
            this.clearSelection();
        }
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.enabled || !this.hoverEnabled) return;

        this.updateMouse(event);
        const intersects = this.raycast();

        const newHoveredId = intersects.length > 0
            ? this.findObjectId(intersects[0].object)
            : null;

        if (newHoveredId !== this.hoveredId) {
            // 取消之前的悬停
            if (this.hoveredId && !this.selectedIds.has(this.hoveredId)) {
                this.restoreMaterial(this.hoveredId);
            }

            // 设置新的悬停
            if (newHoveredId && !this.selectedIds.has(newHoveredId)) {
                this.applyHoverMaterial(newHoveredId);
            }

            this.hoveredId = newHoveredId;
            this.emitEvent({
                type: 'hover',
                objectId: newHoveredId,
                object: newHoveredId ? this.selectableObjects.get(newHoveredId) ?? null : null
            });
        }
    }

    private applyHighlightMaterial(id: string): void {
        const object = this.selectableObjects.get(id);
        if (!object) return;

        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (!this.originalMaterials.has(id)) {
                    this.originalMaterials.set(id, child.material);
                }
                child.material = this.highlightMaterial;
            }
        });
    }

    private applyHoverMaterial(id: string): void {
        const object = this.selectableObjects.get(id);
        if (!object) return;

        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (!this.originalMaterials.has(id)) {
                    this.originalMaterials.set(id, child.material);
                }
                child.material = this.hoverMaterial;
            }
        });
    }

    private restoreMaterial(id: string): void {
        const object = this.selectableObjects.get(id);
        const originalMaterial = this.originalMaterials.get(id);
        if (!object || !originalMaterial) return;

        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = originalMaterial;
            }
        });
        this.originalMaterials.delete(id);
    }

    private emitEvent(event: SelectionEvent): void {
        this.callbacks.forEach(cb => cb(event));
    }

    // 公共 API

    registerObject(id: string, object: THREE.Object3D): void {
        this.selectableObjects.set(id, object);
    }

    unregisterObject(id: string): void {
        this.deselect(id);
        this.selectableObjects.delete(id);
        this.originalMaterials.delete(id);
    }

    select(id: string): void {
        if (!this.selectableObjects.has(id)) return;
        if (this.selectedIds.has(id)) return;

        this.selectedIds.add(id);
        this.applyHighlightMaterial(id);
        this.emitEvent({
            type: 'select',
            objectId: id,
            object: this.selectableObjects.get(id) ?? null
        });
    }

    deselect(id: string): void {
        if (!this.selectedIds.has(id)) return;

        this.selectedIds.delete(id);
        this.restoreMaterial(id);
        this.emitEvent({
            type: 'deselect',
            objectId: id,
            object: this.selectableObjects.get(id) ?? null
        });
    }

    toggleSelection(id: string): void {
        if (this.selectedIds.has(id)) {
            this.deselect(id);
        } else {
            this.select(id);
        }
    }

    clearSelection(): void {
        const ids = Array.from(this.selectedIds);
        ids.forEach(id => this.deselect(id));
    }

    getSelectedIds(): string[] {
        return Array.from(this.selectedIds);
    }

    isSelected(id: string): boolean {
        return this.selectedIds.has(id);
    }

    onSelectionChange(callback: SelectionCallback): void {
        this.callbacks.push(callback);
    }

    removeCallback(callback: SelectionCallback): void {
        const index = this.callbacks.indexOf(callback);
        if (index !== -1) {
            this.callbacks.splice(index, 1);
        }
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    setHoverEnabled(enabled: boolean): void {
        if (this.hoverEnabled === enabled) {
            return;
        }

        this.hoverEnabled = enabled;
        if (!enabled) {
            if (this.hoveredId && !this.selectedIds.has(this.hoveredId)) {
                this.restoreMaterial(this.hoveredId);
            }
            this.hoveredId = null;
        }
    }

    dispose(): void {
        this.domElement.removeEventListener('click', this.onClickHandler);
        this.domElement.removeEventListener('mousemove', this.onMouseMoveHandler);
        this.highlightMaterial.dispose();
        this.hoverMaterial.dispose();
        this.selectableObjects.clear();
        this.selectedIds.clear();
        this.originalMaterials.clear();
        this.callbacks = [];
    }
}
