import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';

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
export type SelectionFilter = (id: string, object: THREE.Object3D) => boolean;

type MaterialObject3D = THREE.Object3D & {
    material: THREE.Material | THREE.Material[];
};

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

    private originalMaterials: Map<string, Map<string, THREE.Material | THREE.Material[]>> =
        new Map();
    private highlightMaterial: THREE.MeshPhongMaterial;
    private hoverMaterial: THREE.MeshPhongMaterial;
    private highlightLineMaterial: LineMaterial;
    private hoverLineMaterial: LineMaterial;

    private callbacks: SelectionCallback[] = [];
    private enabled: boolean = true;
    private hoverEnabled: boolean = true;
    private selectionFilter: SelectionFilter | null = null;

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
        this.highlightMaterial = new THREE.MeshPhongMaterial({
            color: options.highlightColor ?? 0x58a6ff,
            emissive: options.highlightColor ?? 0x58a6ff,
            emissiveIntensity: 0.22,
            transparent: true,
            opacity: options.highlightOpacity ?? 0.32,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide
        });

        // 悬停材质
        this.hoverMaterial = new THREE.MeshPhongMaterial({
            color: 0x87c8ff,
            emissive: 0x87c8ff,
            emissiveIntensity: 0.1,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide
        });

        this.highlightLineMaterial = this.createOverlayLineMaterial(
            options.highlightColor ?? 0x58a6ff,
            0.95
        );

        this.hoverLineMaterial = this.createOverlayLineMaterial(0x87c8ff, 0.75);

        this.onClickHandler = this.onClick.bind(this);
        this.onMouseMoveHandler = this.onMouseMove.bind(this);
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.domElement.addEventListener('click', this.onClickHandler);
        this.domElement.addEventListener('mousemove', this.onMouseMoveHandler);
    }

    private createOverlayLineMaterial(color: number, opacity: number): LineMaterial {
        const material = new LineMaterial({
            color,
            linewidth: 2,
            transparent: true,
            opacity,
            depthWrite: false,
            depthTest: false,
            toneMapped: false,
            worldUnits: false
        });
        this.setLineMaterialResolution(material);
        return material;
    }

    private setLineMaterialResolution(material: LineMaterial): void {
        material.resolution.set(
            Math.max(this.domElement.clientWidth, 1),
            Math.max(this.domElement.clientHeight, 1)
        );
    }

    private isMaterialObject(child: THREE.Object3D): child is MaterialObject3D {
        return 'material' in child;
    }

    private updateMouse(event: MouseEvent): void {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private updateMouseFromScreenPoint(x: number, y: number): void {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
    }

    private raycast(): THREE.Intersection[] {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const objects = Array.from(this.selectableObjects.values());
        return this.raycaster.intersectObjects(objects, true);
    }

    private resolveIntersectedObjectId(intersects: THREE.Intersection[]): string | null {
        for (const intersect of intersects) {
            const objectId = this.findObjectId(intersect.object);
            if (!objectId) {
                continue;
            }

            const object = this.selectableObjects.get(objectId);
            if (!object) {
                continue;
            }

            if (this.selectionFilter && !this.selectionFilter(objectId, object)) {
                continue;
            }

            return objectId;
        }

        return null;
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
        const objectId = this.resolveIntersectedObjectId(this.raycast());

        if (objectId) {
            if (event.ctrlKey || event.metaKey) {
                // 多选模式
                this.toggleSelection(objectId);
            } else {
                // 单选模式
                this.clearSelection();
                this.select(objectId);
            }
        } else if (!event.ctrlKey && !event.metaKey) {
            this.clearSelection();
        }
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.enabled || !this.hoverEnabled) return;

        this.updateMouse(event);
        const newHoveredId = this.resolveIntersectedObjectId(this.raycast());
        this.setHoveredIdInternal(newHoveredId);

        if (false && newHoveredId !== this.hoveredId) {
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
                object: newHoveredId ? (this.selectableObjects.get(newHoveredId) ?? null) : null
            });
        }
    }

    private applyHighlightMaterial(id: string): void {
        const object = this.selectableObjects.get(id);
        if (!object) return;
        if (object.userData.selectionAppearance === 'frame') {
            return;
        }

        const cachedMaterials =
            this.originalMaterials.get(id) ?? new Map<string, THREE.Material | THREE.Material[]>();
        if (!this.originalMaterials.has(id)) {
            this.originalMaterials.set(id, cachedMaterials);
        }

        object.traverse(child => {
            if (
                (child instanceof LineSegments2 || child.userData.viewerEdgeOverlay) &&
                this.isMaterialObject(child)
            ) {
                if (!cachedMaterials.has(child.uuid)) {
                    cachedMaterials.set(child.uuid, child.material);
                }
                child.material = this.highlightLineMaterial;
                return;
            }

            if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
                if (!cachedMaterials.has(child.uuid)) {
                    cachedMaterials.set(child.uuid, child.material);
                }

                if (child instanceof THREE.Mesh) {
                    child.material = this.highlightMaterial;
                } else {
                    child.material = this.highlightLineMaterial;
                }
            }
        });
    }

    private applyHoverMaterial(id: string): void {
        const object = this.selectableObjects.get(id);
        if (!object) return;
        if (object.userData.selectionAppearance === 'frame') {
            return;
        }

        const cachedMaterials =
            this.originalMaterials.get(id) ?? new Map<string, THREE.Material | THREE.Material[]>();
        if (!this.originalMaterials.has(id)) {
            this.originalMaterials.set(id, cachedMaterials);
        }

        object.traverse(child => {
            if (
                (child instanceof LineSegments2 || child.userData.viewerEdgeOverlay) &&
                this.isMaterialObject(child)
            ) {
                if (!cachedMaterials.has(child.uuid)) {
                    cachedMaterials.set(child.uuid, child.material);
                }
                child.material = this.hoverLineMaterial;
                return;
            }

            if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
                if (!cachedMaterials.has(child.uuid)) {
                    cachedMaterials.set(child.uuid, child.material);
                }

                if (child instanceof THREE.Mesh) {
                    child.material = this.hoverMaterial;
                } else {
                    child.material = this.hoverLineMaterial;
                }
            }
        });
    }

    private restoreMaterial(id: string): void {
        const object = this.selectableObjects.get(id);
        const originalMaterials = this.originalMaterials.get(id);
        if (!object) return;
        if (object.userData.selectionAppearance === 'frame') {
            this.originalMaterials.delete(id);
            return;
        }
        if (!originalMaterials) return;

        object.traverse(child => {
            if (
                (child instanceof LineSegments2 ||
                    child.userData.viewerEdgeOverlay ||
                    child instanceof THREE.Mesh ||
                    child instanceof THREE.LineSegments) &&
                this.isMaterialObject(child)
            ) {
                const originalMaterial = originalMaterials.get(child.uuid);
                if (originalMaterial) {
                    child.material = originalMaterial;
                }
            }
        });
        this.originalMaterials.delete(id);
    }

    private emitEvent(event: SelectionEvent): void {
        this.callbacks.forEach(cb => cb(event));
    }

    private setHoveredIdInternal(id: string | null): void {
        if (this.hoveredId === id) {
            return;
        }

        if (this.hoveredId && !this.selectedIds.has(this.hoveredId)) {
            this.restoreMaterial(this.hoveredId);
        }

        let nextHoveredId: string | null = null;
        if (id) {
            const hoveredObject = this.selectableObjects.get(id);
            if (
                hoveredObject &&
                (!this.selectionFilter || this.selectionFilter(id, hoveredObject))
            ) {
                nextHoveredId = id;
                if (!this.selectedIds.has(nextHoveredId)) {
                    this.applyHoverMaterial(nextHoveredId);
                }
            }
        }

        this.hoveredId = nextHoveredId;
        this.emitEvent({
            type: 'hover',
            objectId: nextHoveredId,
            object: nextHoveredId ? (this.selectableObjects.get(nextHoveredId) ?? null) : null
        });
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

    /**
     * 批量选中多个对象，只触发一次事件回调
     */
    selectMany(ids: string[]): void {
        const added: string[] = [];
        for (const id of ids) {
            if (!this.selectableObjects.has(id) || this.selectedIds.has(id)) continue;
            this.selectedIds.add(id);
            this.applyHighlightMaterial(id);
            added.push(id);
        }
        if (added.length > 0) {
            this.emitEvent({
                type: 'select',
                objectId: added[added.length - 1],
                object: this.selectableObjects.get(added[added.length - 1]) ?? null
            });
        }
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

    /**
     * 替换当前选中集合，只对差异部分做材质操作，不触发事件（由调用方统一处理）
     */
    replaceSelection(newIds: string[]): void {
        const newSet = new Set(newIds.filter(id => this.selectableObjects.has(id)));

        // 恢复不再选中的
        for (const id of this.selectedIds) {
            if (!newSet.has(id)) {
                this.restoreMaterial(id);
            }
        }

        // 高亮新增选中的
        for (const id of newSet) {
            if (!this.selectedIds.has(id)) {
                this.applyHighlightMaterial(id);
            }
        }

        this.selectedIds = newSet;
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

    pickObjectIdAtScreenPoint(x: number, y: number): string | null {
        this.updateMouseFromScreenPoint(x, y);
        return this.resolveIntersectedObjectId(this.raycast());
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
            this.setHoveredIdInternal(null);
        }
    }

    setHoveredId(id: string | null): void {
        this.setHoveredIdInternal(id);
    }

    setSelectionFilter(filter: SelectionFilter | null): void {
        this.selectionFilter = filter;
        if (!this.hoveredId) {
            return;
        }

        const hoveredObject = this.selectableObjects.get(this.hoveredId);
        if (!hoveredObject || (filter && !filter(this.hoveredId, hoveredObject))) {
            this.setHoveredIdInternal(null);
        }
    }

    setViewportSize(width: number, height: number): void {
        this.highlightLineMaterial.resolution.set(Math.max(width, 1), Math.max(height, 1));
        this.hoverLineMaterial.resolution.set(Math.max(width, 1), Math.max(height, 1));
    }

    dispose(): void {
        this.domElement.removeEventListener('click', this.onClickHandler);
        this.domElement.removeEventListener('mousemove', this.onMouseMoveHandler);
        this.highlightMaterial.dispose();
        this.hoverMaterial.dispose();
        this.highlightLineMaterial.dispose();
        this.hoverLineMaterial.dispose();
        this.selectableObjects.clear();
        this.selectedIds.clear();
        this.originalMaterials.clear();
        this.callbacks = [];
    }
}
