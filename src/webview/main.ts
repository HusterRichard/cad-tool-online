// WebView entry point
// This file will be bundled by Vite for the WebView

import { ThreeViewer } from '@cadtool-online/three';
import { OcctWrapper, type MassProperties, type StepReadResult } from '@cadtool-online/geo';
import type { EdgeData, Mat3, MeshData, Vec3 } from '@cadtool-online/core';
import {
    aggregateMassProperties,
    buildModelBrowserTree,
    collectLeafShapeIds,
    flattenTopLevelAssemblyShapes,
    getUniqueGroupName as getUniqueGroupNameFromState,
    markerCreator,
    renameGroupNode as renameGroupNodeInState,
    sanitizeGroupName,
    type BrowserNamedEntityInput,
    type MbsMarker,
    type ModelBrowserNode
} from '@cadtool-online/core';
import {
    DEFAULT_RENDER_CONFIG,
    isMaterialMode,
    isPrecisionPreset,
    isVisualPreset,
    normalizeRenderConfig,
    type MaterialMode,
    type PrecisionPreset,
    type RenderConfigState,
    type VisualPreset
} from './renderConfig';
import { invokeViewerMethod } from './viewerCapabilities';
import { MassPropertiesCoordinator } from './massPropertiesCoordinator';
import { MassPropertiesWorkerClient } from './massPropertiesWorkerClient';

declare function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
};

// Extend window for WASM base URL
declare global {
    interface Window {
        WASM_BASE_URL?: string;
        ICONS_32_BASE?: string;
    }
}

const vscode = acquireVsCodeApi();

let viewer: ThreeViewer | null = null;
let occt: OcctWrapper | null = null;
let occtInitPromise: Promise<void> | null = null;
let isInitialized = false;

// Loaded shapes tracking with hierarchy support
interface LoadedShape {
    id: string;
    name: string;
    type: 'assembly' | 'part' | 'solid';
    shapeId?: string;
    meshId?: string;
    meshData?: MeshData;
    edgeData?: EdgeData;
    color?: string;
    children?: LoadedShape[];
    transform?: {
        translation: Vec3;
        rotation: number[];
    };
    visible: boolean;
    parent?: LoadedShape;
}

type RigidTransform = {
    translation: Vec3;
    rotation: number[];
};

const loadedShapes: Map<string, LoadedShape> = new Map();
const rootShapes: LoadedShape[] = [];
let selectedShapeId: string | null = null;
let selectedGroupId: string | null = null;
let activeSelectionKey: string | null = null;
const selectedNodeIds = new Set<string>();
let treeContextMenuEl: HTMLDivElement | null = null;
let isSyncingViewerSelection = false;

// Mesh ID to Shape ID mapping for selection synchronization
const meshIdToShapeId: Map<string, string> = new Map();

// Marker creation state
const createdMarkers: MbsMarker[] = [];
const createdRefFrames = new Map<string, MbsRefFrameEntity>();
const mbsDesignPoints = new Map<string, MbsDesignPointEntity>();
const frameCreationHistory: Array<{ id: string; kind: FrameEntityKind }> = [];
let editingFrameTarget: { id: string; kind: FrameEntityKind } | null = null;

type FrameEntityKind = 'marker' | 'refFrame';
type CanvasInteractionMode = 'none' | 'createMarker' | 'createRefFrame' | 'createDesignPoint' | 'editFrame';
let canvasInteractionMode: CanvasInteractionMode = 'none';

interface MbsRefFrameEntity {
    id: string;
    name: string;
    groupId: string;
    position: Vec3;
    orientation: Mat3;
    relatedMarkerId?: string;
    createdAt: string;
}

interface MbsDesignPointEntity {
    id: string;
    name: string;
    groupId: string;
    position: Vec3;
    direction?: Vec3;
    markerRefId?: string;
    size: number;
    isDirectionReverse: boolean;
    offsetValue: number;
    createdAt: string;
}

interface MbsGroupEntity {
    id: string;
    name: string;
    parentGroupId?: string;
    memberShapeIds: string[];
    createdAt: string;
    kind?: GroupKind;
    order?: number;
}

type GroupKind = 'manual' | 'default' | 'imported';

interface GroupNode {
    id: string;
    name: string;
    parentGroupId: string | null;
    childGroupIds: string[];
    memberPartIds: string[];
    kind: GroupKind;
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

interface ModelTreeNode extends Omit<ModelBrowserNode, 'children'> {
    kind: ModelBrowserNode['kind'] | 'group';
    groupId?: string;
    selectionKey?: string;
    children?: ModelTreeNode[];
}

interface MbsJointEntity {
    id: string;
    name: string;
    jointType: string;
    part1: string;
    part2: string;
    createdAt: string;
}

interface MbsMotionEntity {
    id: string;
    name: string;
    motionType: string;
    connectorRef: string;
    createdAt: string;
}

interface FluidSliceEntity {
    id: string;
    name: string;
    shapeRef?: string;
    createdAt: string;
}

interface FluidPortEntity {
    id: string;
    name: string;
    portType: string;
    shapeRef?: string;
    ribSliceRef?: string;
    createdAt: string;
}

let groupDesignState: GroupDesignState = createEmptyGroupDesignState();
const mbsJoints = new Map<string, MbsJointEntity>();
const mbsMotions = new Map<string, MbsMotionEntity>();
const fluidSlices = new Map<string, FluidSliceEntity>();
const fluidPorts = new Map<string, FluidPortEntity>();
const shapeSelectionHistory: string[] = [];
let externalModelTreeShapes: Array<{ id: string; name: string }> = [];

// Explode view state
let isExploded = false;
let explodeDistance = 0;
interface ExplodeData {
    meshId: string;
    originalPosition: { x: number; y: number; z: number };
    explodeDirection: { x: number; y: number; z: number };
}
const explodeDataMap: Map<string, ExplodeData> = new Map();

let renderConfig: RenderConfigState = loadRenderConfigState();
const massPropertiesWorkerClient = new MassPropertiesWorkerClient(window.WASM_BASE_URL ?? null);
const massPropertiesCoordinator = new MassPropertiesCoordinator(massPropertiesWorkerClient);
const selectedDensityByShapeId = new Map<string, number>();

const mbsGroups = {
    get size(): number {
        return Object.keys(groupDesignState.groupsById).length;
    },
    clear(): void {
        groupDesignState = createEmptyGroupDesignState(getAllLeafPartIds());
    },
    set(id: string, group: MbsGroupEntity): typeof mbsGroups {
        upsertLegacyGroup(group);
        return this;
    },
    get(id: string): MbsGroupEntity | undefined {
        const group = groupDesignState.groupsById[id];
        return group ? toLegacyGroupEntity(group) : undefined;
    },
    delete(id: string): boolean {
        return removeGroupById(id);
    },
    has(id: string): boolean {
        return Boolean(groupDesignState.groupsById[id]);
    },
    values(): IterableIterator<MbsGroupEntity> {
        return listGroupsAsLegacy().values();
    }
};

interface MaterialOption {
    id: string;
    name: string;
    density: number;
}

const DEFAULT_MATERIAL_DENSITY = 7800;
const CUSTOM_MATERIAL_DENSITY = 7850;
const MATERIAL_OPTIONS: MaterialOption[] = [
    { id: 'wood', name: '木制', density: 700 },
    { id: 'water', name: '水', density: 1000 },
    { id: 'abs', name: 'ABS', density: 1060 },
    { id: 'concrete', name: '混凝土', density: 2400 },
    { id: 'glass', name: '玻璃', density: 2600 },
    { id: 'aluminum', name: '铝', density: 2700 },
    { id: 'iron', name: '铁', density: 7870 },
    { id: 'steel', name: '钢', density: 7800 },
    { id: 'titanium', name: '钛', density: 4540 },
    { id: 'brass', name: '黄铜', density: 8600 },
    { id: 'copper', name: '铜', density: 8940 },
    { id: 'silver', name: '银', density: 10500 },
    { id: 'lead', name: '铅', density: 11340 },
    { id: 'gold', name: '黄金', density: 19320 },
    { id: 'custom-default', name: '自定义', density: CUSTOM_MATERIAL_DENSITY }
];

function createEmptyGroupDesignState(ungroupedPartIds: string[] = []): GroupDesignState {
    return {
        groupsById: {},
        rootGroupIds: [],
        ungroupedPartIds: [...ungroupedPartIds],
        selectedNodeIds: [],
        activeMode: 'idle'
    };
}

function toShapeSelectionKey(shapeId: string): string {
    return `shape:${shapeId}`;
}

function toGroupSelectionKey(groupId: string): string {
    return `group:${groupId}`;
}

function parseSelectionKey(selectionKey: string | null): { kind: 'shape' | 'group'; id: string } | null {
    if (!selectionKey) {
        return null;
    }
    const [kind, ...rest] = selectionKey.split(':');
    if ((kind !== 'shape' && kind !== 'group') || rest.length === 0) {
        return null;
    }
    return {
        kind,
        id: rest.join(':')
    };
}

function getAllLeafPartIds(): string[] {
    if (rootShapes.length === 0) {
        return [];
    }
    return Array.from(new Set(collectLeafShapeIds(rootShapes)));
}

function listGroups(): GroupNode[] {
    return Object.values(groupDesignState.groupsById)
        .filter((group) => !group.deletedAt)
        .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

function listGroupsAsLegacy(): MbsGroupEntity[] {
    return listGroups().map(toLegacyGroupEntity);
}

function toLegacyGroupEntity(group: GroupNode): MbsGroupEntity {
    return {
        id: group.id,
        name: group.name,
        parentGroupId: group.parentGroupId ?? undefined,
        memberShapeIds: [...group.memberPartIds],
        createdAt: group.createdAt,
        kind: group.kind,
        order: group.order
    };
}

function buildPartOwnerGroupMap(): Map<string, string> {
    const ownerMap = new Map<string, string>();
    listGroups().forEach((group) => {
        group.memberPartIds.forEach((partId) => ownerMap.set(partId, group.id));
    });
    return ownerMap;
}

function syncUngroupedPartIds(): void {
    const groupedPartIds = new Set<string>();
    listGroups().forEach((group) => {
        group.memberPartIds.forEach((partId) => groupedPartIds.add(partId));
    });
    groupDesignState.ungroupedPartIds = getAllLeafPartIds().filter((partId) => !groupedPartIds.has(partId));
}

function getGroupNode(groupId: string | null | undefined): GroupNode | null {
    if (!groupId) {
        return null;
    }
    return groupDesignState.groupsById[groupId] ?? null;
}

function getOrderedChildGroupIds(parentGroupId: string | null): string[] {
    const groupIds = parentGroupId
        ? (getGroupNode(parentGroupId)?.childGroupIds ?? [])
        : groupDesignState.rootGroupIds;
    return [...groupIds].sort((leftId, rightId) => {
        const left = getGroupNode(leftId);
        const right = getGroupNode(rightId);
        if (!left || !right) {
            return leftId.localeCompare(rightId);
        }
        return left.order - right.order || left.name.localeCompare(right.name);
    });
}

function rebuildGroupIndexes(): void {
    const nextRootIds: string[] = [];
    Object.values(groupDesignState.groupsById).forEach((group) => {
        group.childGroupIds = [];
    });

    listGroups().forEach((group) => {
        if (group.parentGroupId && groupDesignState.groupsById[group.parentGroupId]) {
            groupDesignState.groupsById[group.parentGroupId].childGroupIds.push(group.id);
            return;
        }
        group.parentGroupId = null;
        nextRootIds.push(group.id);
    });

    groupDesignState.rootGroupIds = nextRootIds.sort((leftId, rightId) => {
        const left = getGroupNode(leftId);
        const right = getGroupNode(rightId);
        if (!left || !right) {
            return leftId.localeCompare(rightId);
        }
        return left.order - right.order || left.name.localeCompare(right.name);
    });
    syncUngroupedPartIds();
}

function upsertGroupNode(group: GroupNode): void {
    groupDesignState.groupsById[group.id] = {
        ...group,
        childGroupIds: [...group.childGroupIds],
        memberPartIds: [...group.memberPartIds]
    };
    rebuildGroupIndexes();
}

function upsertLegacyGroup(group: MbsGroupEntity): void {
    const previous = getGroupNode(group.id);
    upsertGroupNode({
        id: group.id,
        name: group.name,
        parentGroupId: group.parentGroupId ?? previous?.parentGroupId ?? null,
        childGroupIds: previous?.childGroupIds ?? [],
        memberPartIds: Array.from(new Set(group.memberShapeIds)),
        kind: group.kind ?? previous?.kind ?? 'manual',
        order: group.order ?? previous?.order ?? listGroups().length + 1,
        createdAt: group.createdAt ?? previous?.createdAt ?? new Date().toISOString(),
        deletedAt: previous?.deletedAt
    });
}

function removeGroupById(groupId: string): boolean {
    if (!groupDesignState.groupsById[groupId]) {
        return false;
    }
    delete groupDesignState.groupsById[groupId];
    selectedNodeIds.delete(toGroupSelectionKey(groupId));
    groupDesignState.selectedNodeIds = Array.from(selectedNodeIds);
    rebuildGroupIndexes();
    if (selectedGroupId === groupId) {
        selectSelection(null);
    }
    return true;
}

function resolveOwningGroupId(shapeId: string | undefined): string | undefined {
    if (!shapeId) {
        return undefined;
    }
    return buildPartOwnerGroupMap().get(shapeId);
}

function getSelectedShapeIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: 'shape' | 'group'; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'shape')
        .map((entry) => entry.id);
}

function getSelectedGroupIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: 'shape' | 'group'; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'group')
        .map((entry) => entry.id);
}

function getActiveGroupId(): string | null {
    const active = parseSelectionKey(activeSelectionKey);
    return active?.kind === 'group' ? active.id : null;
}

function updateTreeSelectionClasses(): void {
    document.querySelectorAll<HTMLElement>('.tree-node[data-selection-key]').forEach((node) => {
        const selectionKey = node.dataset.selectionKey ?? '';
        node.classList.toggle('selected', selectedNodeIds.has(selectionKey));
    });
}

function collectMeshBackedShapeIds(shape: LoadedShape): string[] {
    if (shape.meshId) {
        return [shape.id];
    }
    if (!shape.children || shape.children.length === 0) {
        return [shape.id];
    }
    return shape.children.flatMap((child) => collectMeshBackedShapeIds(child));
}

function syncViewerSelectionFromState(): void {
    if (!viewer) {
        return;
    }

    const targetMeshIds = new Set(
        Array.from(new Set(
            getSelectedShapeIds()
                .flatMap((shapeId) => {
                    const shape = loadedShapes.get(shapeId);
                    return shape ? collectMeshBackedShapeIds(shape) : [shapeId];
                })
        ))
            .map((shapeId) => loadedShapes.get(shapeId)?.meshId)
            .filter((meshId): meshId is string => Boolean(meshId))
    );
    const currentMeshIds = new Set(viewer.getSelectedIds());
    isSyncingViewerSelection = true;
    try {
        currentMeshIds.forEach((meshId) => {
            if (!targetMeshIds.has(meshId)) {
                viewer.deselect(meshId);
            }
        });
        targetMeshIds.forEach((meshId) => {
            if (!currentMeshIds.has(meshId)) {
                viewer.select(meshId);
            }
        });
    } finally {
        isSyncingViewerSelection = false;
    }
}

type GroupMassSummary = {
    totalPartCount: number;
    computedPartCount: number;
    missingPartIds: string[];
    volume: number;
    mass: number;
    density: number;
    centerOfMass: Vec3;
    inertiaMatrix: Mat3;
};

function collectGroupPartIdsRecursive(groupId: string, collected: Set<string> = new Set<string>()): Set<string> {
    const group = getGroupNode(groupId);
    if (!group) {
        return collected;
    }

    group.memberPartIds.forEach((partId) => collected.add(partId));
    group.childGroupIds.forEach((childGroupId) => collectGroupPartIdsRecursive(childGroupId, collected));
    return collected;
}

function aggregateGroupMassProperties(groupId: string): GroupMassSummary | null {
    if (!occt) {
        return null;
    }

    const partIds = Array.from(collectGroupPartIdsRecursive(groupId));
    if (partIds.length === 0) {
        return {
            totalPartCount: 0,
            computedPartCount: 0,
            missingPartIds: [],
            volume: 0,
            mass: 0,
            density: 0,
            centerOfMass: { x: 0, y: 0, z: 0 },
            inertiaMatrix: { m: [0, 0, 0, 0, 0, 0, 0, 0, 0] }
        };
    }

    const partMasses: MassProperties[] = [];
    const missingPartIds: string[] = [];

    partIds.forEach((partId) => {
        const shape = loadedShapes.get(partId);
        if (!shape?.shapeId || !occt.hasShape(shape.shapeId)) {
            missingPartIds.push(partId);
            return;
        }

        try {
            const density = getMaterialDensity(partId);
            const mass = occt.getMassProperties(shape.shapeId, density);
            if (!mass) {
                missingPartIds.push(partId);
                return;
            }
            partMasses.push(mass);
        } catch {
            missingPartIds.push(partId);
        }
    });

    if (partMasses.length === 0) {
        return {
            totalPartCount: partIds.length,
            computedPartCount: 0,
            missingPartIds,
            volume: 0,
            mass: 0,
            density: 0,
            centerOfMass: { x: 0, y: 0, z: 0 },
            inertiaMatrix: { m: [0, 0, 0, 0, 0, 0, 0, 0, 0] }
        };
    }

    const aggregate = aggregateMassProperties(partMasses);
    if (!aggregate) {
        return null;
    }

    return {
        totalPartCount: partIds.length,
        computedPartCount: partMasses.length,
        missingPartIds,
        volume: aggregate.volume,
        mass: aggregate.mass,
        density: aggregate.density,
        centerOfMass: aggregate.centerOfMass,
        inertiaMatrix: aggregate.inertiaMatrix
    };
}

function renderSelectedGroupProperties(groupId: string): void {
    const group = getGroupNode(groupId);
    if (!group) {
        updatePropertiesPanel(null);
        return;
    }

    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) {
        return;
    }

    const partIds = Array.from(collectGroupPartIdsRecursive(groupId));
    const massSummary = aggregateGroupMassProperties(groupId);
    const missingText = massSummary && massSummary.missingPartIds.length > 0
        ? massSummary.missingPartIds.map(activeShapeName).join(', ')
        : '(none)';
    const inertiaRows = massSummary
        ? [
            [massSummary.inertiaMatrix.m[0], massSummary.inertiaMatrix.m[1], massSummary.inertiaMatrix.m[2]] as [number, number, number],
            [massSummary.inertiaMatrix.m[3], massSummary.inertiaMatrix.m[4], massSummary.inertiaMatrix.m[5]] as [number, number, number],
            [massSummary.inertiaMatrix.m[6], massSummary.inertiaMatrix.m[7], massSummary.inertiaMatrix.m[8]] as [number, number, number]
        ]
        : null;

    let html = '';
    html += '<div class="property-section-header">基本属性</div>';
    html += createPropertyRow('ID', group.id, { boxed: true });
    html += createPropertyRow('Name', group.name, { boxed: true });
    html += createPropertyRow('Parent', group.parentGroupId ? (getGroupNode(group.parentGroupId)?.name ?? group.parentGroupId) : '(root)');
    html += createPropertyRow('Type', group.kind);
    html += createPropertyRow('Children', group.childGroupIds.length.toString());
    html += createPropertyRow('Direct Members', group.memberPartIds.length.toString());
    html += createPropertyRow('Total Parts', partIds.length.toString());
    html += createPropertyRow('Created', group.createdAt);
    html += '<div class="property-separator"></div>';
    html += '<div class="property-section-header">物理属性</div>';

    if (!massSummary) {
        html += createPropertyRow('状态', '不可用');
    } else {
        html += createPropertyRow('Computed Parts', `${massSummary.computedPartCount}/${massSummary.totalPartCount}`);
        html += createPropertyRow('Missing Parts', missingText);
        html += createPropertyRow('Total Mass', `${formatPhysicsNumber(massSummary.mass, 5)} kg`);
        html += createPropertyRow('Volume', `${formatPhysicsNumber(massSummary.volume, 5)} m^3`);
        html += createPropertyRow('Density', `${formatPhysicsNumber(massSummary.density, 2)} kg/m^3`);
        html += '<div class="property-sub-header">  质心</div>';
        html += createVectorRow([
            massSummary.centerOfMass.x,
            massSummary.centerOfMass.y,
            massSummary.centerOfMass.z
        ], 'm');
        if (inertiaRows) {
            html += '<div class="property-sub-header">  惯性张量</div>';
            html += createVectorRow(inertiaRows[0]);
            html += createVectorRow(inertiaRows[1]);
            html += createVectorRow(inertiaRows[2], 'kg·m²');
        }
    }

    propsEl.innerHTML = html;
}

function updateSelectionPropertiesPanel(): void {
    const active = parseSelectionKey(activeSelectionKey);
    if (!active) {
        updatePropertiesPanel(null);
        return;
    }
    if (active.kind === 'group') {
        renderSelectedGroupProperties(active.id);
        return;
    }
    updatePropertiesPanel(active.id);
}

function selectSelection(
    nextSelection: { kind: 'shape' | 'group'; id: string } | null,
    options?: { additive?: boolean; toggle?: boolean; fromViewer?: boolean }
): void {
    const selectionKey = nextSelection
        ? (nextSelection.kind === 'shape'
            ? toShapeSelectionKey(nextSelection.id)
            : toGroupSelectionKey(nextSelection.id))
        : null;

    if (!options?.additive) {
        selectedNodeIds.clear();
    }

    if (selectionKey && options?.toggle && selectedNodeIds.has(selectionKey)) {
        selectedNodeIds.delete(selectionKey);
        activeSelectionKey = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds).at(-1) ?? null : null;
    } else if (selectionKey) {
        selectedNodeIds.add(selectionKey);
        activeSelectionKey = selectionKey;
    } else {
        activeSelectionKey = null;
    }

    const active = parseSelectionKey(activeSelectionKey);
    selectedShapeId = active?.kind === 'shape' ? active.id : null;
    selectedGroupId = active?.kind === 'group' ? active.id : null;
    groupDesignState.selectedNodeIds = Array.from(selectedNodeIds);

    updateTreeSelectionClasses();
    if (!options?.fromViewer) {
        syncViewerSelectionFromState();
    }
    updateSelectionPropertiesPanel();

    if (selectedShapeId) {
        rememberShapeSelection(selectedShapeId);
        vscode.postMessage({ command: 'selectShape', shapeId: selectedShapeId });
    }
}

function syncSelectionFromViewer(activeMeshId: string | null): void {
    const shapeIds = viewer?.getSelectedIds()
        .map((meshId) => meshIdToShapeId.get(meshId))
        .filter((shapeId): shapeId is string => Boolean(shapeId)) ?? [];
    selectedNodeIds.clear();
    shapeIds.forEach((shapeId) => selectedNodeIds.add(toShapeSelectionKey(shapeId)));
    const activeShapeId = activeMeshId ? (meshIdToShapeId.get(activeMeshId) ?? shapeIds.at(-1) ?? null) : (shapeIds.at(-1) ?? null);
    activeSelectionKey = activeShapeId ? toShapeSelectionKey(activeShapeId) : null;
    const active = parseSelectionKey(activeSelectionKey);
    selectedShapeId = active?.kind === 'shape' ? active.id : null;
    selectedGroupId = null;
    groupDesignState.selectedNodeIds = Array.from(selectedNodeIds);
    updateTreeSelectionClasses();
    updateSelectionPropertiesPanel();
    if (selectedShapeId) {
        rememberShapeSelection(selectedShapeId);
        vscode.postMessage({ command: 'selectShape', shapeId: selectedShapeId });
    }
}

function getUniqueGroupName(baseName: string): string {
    return getUniqueGroupNameFromState(groupDesignState, sanitizeGroupName(baseName, `Group${listGroups().length + 1}`));
}

function createGroupFromParts(
    name: string,
    memberShapeIds: string[],
    parentGroupId: string | null,
    kind: GroupKind = 'manual'
): GroupNode {
    const uniquePartIds = Array.from(new Set(memberShapeIds));
    const ownerMap = buildPartOwnerGroupMap();
    uniquePartIds.forEach((partId) => {
        const ownerGroup = getGroupNode(ownerMap.get(partId));
        if (ownerGroup) {
            ownerGroup.memberPartIds = ownerGroup.memberPartIds.filter((memberId) => memberId !== partId);
        }
    });

    const group: GroupNode = {
        id: nextEntityId(kind === 'default' ? 'group_default' : 'group', listGroups().length),
        name: getUniqueGroupName(name),
        parentGroupId,
        childGroupIds: [],
        memberPartIds: uniquePartIds,
        kind,
        order: getOrderedChildGroupIds(parentGroupId).length + 1,
        createdAt: new Date().toISOString()
    };
    upsertGroupNode(group);
    uniquePartIds.forEach((partId) => selectedNodeIds.delete(toShapeSelectionKey(partId)));
    selectSelection({ kind: 'group', id: group.id });
    return group;
}

function renameSelectedGroup(nextName: string): GroupNode {
    const groupId = getActiveGroupId();
    if (!groupId) {
        throw new Error('Select a group first.');
    }

    groupDesignState = renameGroupNodeInState(groupDesignState, groupId, nextName) as GroupDesignState;
    const renamedGroup = getGroupNode(groupId);
    if (!renamedGroup) {
        throw new Error(`Group "${groupId}" no longer exists.`);
    }
    return renamedGroup;
}

function isGroupReferenced(groupId: string): boolean {
    return createdMarkers.some((marker) => marker.groupId === groupId)
        || Array.from(createdRefFrames.values()).some((refFrame) => refFrame.groupId === groupId)
        || Array.from(mbsDesignPoints.values()).some((point) => point.groupId === groupId);
}

function collectDescendantGroupIds(groupId: string, collected: Set<string> = new Set<string>()): Set<string> {
    const group = getGroupNode(groupId);
    if (!group) {
        return collected;
    }

    group.childGroupIds.forEach((childGroupId) => {
        if (collected.has(childGroupId)) {
            return;
        }
        collected.add(childGroupId);
        collectDescendantGroupIds(childGroupId, collected);
    });

    return collected;
}

function getTopLevelSelectedGroupIds(groupIds: string[]): string[] {
    const selectedIds = new Set(groupIds);
    return Array.from(new Set(groupIds)).filter((groupId) => {
        let parentGroupId = getGroupNode(groupId)?.parentGroupId ?? null;
        while (parentGroupId) {
            if (selectedIds.has(parentGroupId)) {
                return false;
            }
            parentGroupId = getGroupNode(parentGroupId)?.parentGroupId ?? null;
        }
        return true;
    });
}

function normalizeSiblingOrders(parentGroupId: string | null): void {
    const siblingIds = getOrderedChildGroupIds(parentGroupId);
    siblingIds.forEach((groupId, index) => {
        const group = getGroupNode(groupId);
        if (group) {
            group.order = index + 1;
        }
    });
    rebuildGroupIndexes();
}

function moveGroupToParent(groupId: string, targetParentGroupId: string | null): void {
    const group = getGroupNode(groupId);
    if (!group) {
        return;
    }

    const previousParentGroupId = group.parentGroupId;
    group.parentGroupId = targetParentGroupId;
    group.order = getOrderedChildGroupIds(targetParentGroupId)
        .filter((siblingGroupId) => siblingGroupId !== groupId)
        .length + 1;
    rebuildGroupIndexes();
    normalizeSiblingOrders(previousParentGroupId);
    if (previousParentGroupId !== targetParentGroupId) {
        normalizeSiblingOrders(targetParentGroupId);
    }
}

function movePartIdsToGroup(partIds: string[], targetGroupId: string | null): number {
    const uniquePartIds = Array.from(new Set(partIds));
    const ownerMap = buildPartOwnerGroupMap();

    uniquePartIds.forEach((partId) => {
        const ownerGroupId = ownerMap.get(partId);
        const ownerGroup = getGroupNode(ownerGroupId);
        if (ownerGroup) {
            ownerGroup.memberPartIds = ownerGroup.memberPartIds.filter((memberPartId) => memberPartId !== partId);
        }
    });

    if (targetGroupId) {
        const targetGroup = getGroupNode(targetGroupId);
        if (targetGroup) {
            const mergedPartIds = new Set(targetGroup.memberPartIds);
            uniquePartIds.forEach((partId) => mergedPartIds.add(partId));
            targetGroup.memberPartIds = Array.from(mergedPartIds);
        }
    }

    syncUngroupedPartIds();
    return uniquePartIds.length;
}

function moveSelectedNodesToGroup(targetGroupId: string | null): { movedGroups: number; movedParts: number } {
    const selectedGroupIds = getTopLevelSelectedGroupIds(getSelectedGroupIds());
    const coveredGroupIds = new Set<string>();
    selectedGroupIds.forEach((groupId) => {
        coveredGroupIds.add(groupId);
        collectDescendantGroupIds(groupId).forEach((descendantGroupId) => coveredGroupIds.add(descendantGroupId));
    });
    const ownerMap = buildPartOwnerGroupMap();
    const selectedPartIds = getSelectedShapeIds().filter((partId) => {
        const ownerGroupId = ownerMap.get(partId);
        return !ownerGroupId || !coveredGroupIds.has(ownerGroupId);
    });

    const invalidGroupId = selectedGroupIds.find((groupId) => {
        if (!targetGroupId) {
            return false;
        }
        if (groupId === targetGroupId) {
            return true;
        }
        return collectDescendantGroupIds(groupId).has(targetGroupId);
    });

    if (invalidGroupId) {
        throw new Error(`Invalid move target for group "${getGroupNode(invalidGroupId)?.name ?? invalidGroupId}".`);
    }

    const movedParts = movePartIdsToGroup(selectedPartIds, targetGroupId);
    selectedGroupIds.forEach((groupId) => moveGroupToParent(groupId, targetGroupId));
    updateTreeSelectionClasses();
    updateSelectionPropertiesPanel();

    return {
        movedGroups: selectedGroupIds.length,
        movedParts
    };
}

function ungroupSelectedGroup(): { movedGroups: number; movedParts: number; parentGroupId: string | null } {
    const groupId = getActiveGroupId();
    const group = getGroupNode(groupId);
    if (!group || !groupId) {
        throw new Error('Select a group first.');
    }
    if (isGroupReferenced(groupId)) {
        throw new Error(`Group "${group.name}" is referenced by design entities.`);
    }

    const parentGroupId = group.parentGroupId ?? null;
    const childGroupIds = getOrderedChildGroupIds(groupId);
    const memberPartIds = [...group.memberPartIds];

    movePartIdsToGroup(memberPartIds, parentGroupId);
    childGroupIds.forEach((childGroupId) => moveGroupToParent(childGroupId, parentGroupId));
    removeGroupById(groupId);
    normalizeSiblingOrders(parentGroupId);
    if (parentGroupId) {
        selectSelection({ kind: 'group', id: parentGroupId });
    } else {
        selectSelection(null);
    }

    return {
        movedGroups: childGroupIds.length,
        movedParts: memberPartIds.length,
        parentGroupId
    };
}

function buildMoveTargetOptions(selectedGroupIds: string[]): Array<{ value: string; text: string }> {
    const blockedGroupIds = new Set<string>();
    selectedGroupIds.forEach((groupId) => {
        blockedGroupIds.add(groupId);
        collectDescendantGroupIds(groupId).forEach((descendantGroupId) => blockedGroupIds.add(descendantGroupId));
    });

    return [
        { value: '__root__', text: '根节点（未分组）' },
        ...listGroups()
            .filter((group) => !blockedGroupIds.has(group.id))
            .map((group) => ({
                value: group.id,
                text: group.name
            }))
    ];
}

function getDraggableSelectionPayload(anchorSelectionKey: string): string[] {
    if (selectedNodeIds.has(anchorSelectionKey)) {
        return Array.from(selectedNodeIds);
    }
    return [anchorSelectionKey];
}

function validateMoveSelectionToGroup(targetGroupId: string | null): { valid: boolean; reason?: string } {
    const selectedGroupIds = getTopLevelSelectedGroupIds(getSelectedGroupIds());
    const selectedShapeIds = getSelectedShapeIds();
    if (selectedGroupIds.length === 0 && selectedShapeIds.length === 0) {
        return { valid: false, reason: 'No selection' };
    }

    const invalidGroupId = selectedGroupIds.find((groupId) => {
        if (!targetGroupId) {
            return false;
        }
        if (groupId === targetGroupId) {
            return true;
        }
        return collectDescendantGroupIds(groupId).has(targetGroupId);
    });

    if (invalidGroupId) {
        return {
            valid: false,
            reason: `Cannot move into "${getGroupNode(invalidGroupId)?.name ?? invalidGroupId}".`
        };
    }

    return { valid: true };
}

function clearTreeDropIndicators(): void {
    document.querySelectorAll<HTMLElement>('.tree-node.drop-target-valid, .tree-node.drop-target-invalid').forEach((node) => {
        node.classList.remove('drop-target-valid', 'drop-target-invalid');
    });
}

function applyTreeDropIndicator(node: HTMLElement, isValid: boolean): void {
    node.classList.toggle('drop-target-valid', isValid);
    node.classList.toggle('drop-target-invalid', !isValid);
}

function syncDragSelection(selectionKeys: string[]): void {
    if (selectionKeys.length === 0) {
        return;
    }

    const activeKey = selectionKeys.at(-1) ?? null;
    selectedNodeIds.clear();
    selectionKeys.forEach((selectionKey) => selectedNodeIds.add(selectionKey));
    activeSelectionKey = activeKey;

    const active = parseSelectionKey(activeSelectionKey);
    selectedShapeId = active?.kind === 'shape' ? active.id : null;
    selectedGroupId = active?.kind === 'group' ? active.id : null;
    groupDesignState.selectedNodeIds = Array.from(selectedNodeIds);
    updateTreeSelectionClasses();
    syncViewerSelectionFromState();
    updateSelectionPropertiesPanel();

    if (selectedShapeId) {
        rememberShapeSelection(selectedShapeId);
        vscode.postMessage({ command: 'selectShape', shapeId: selectedShapeId });
    }
}

function handleTreeDrop(targetGroupId: string | null): void {
    const validation = validateMoveSelectionToGroup(targetGroupId);
    if (!validation.valid) {
        if (validation.reason) {
            vscode.postMessage({ command: 'alert', text: validation.reason });
        }
        return;
    }

    const result = moveSelectedNodesToGroup(targetGroupId);
    updateModelTree();
    setStatusInfo(`Moved ${result.movedParts} part(s) and ${result.movedGroups} group(s).`);
}

function isLeafShape(shape: LoadedShape): boolean {
    return !shape.children || shape.children.length === 0;
}

function removeShapeFromHierarchy(shapeId: string, shapes: LoadedShape[]): LoadedShape | null {
    const index = shapes.findIndex((shape) => shape.id === shapeId);
    if (index >= 0) {
        const [removedShape] = shapes.splice(index, 1);
        return removedShape;
    }

    for (const shape of shapes) {
        if (!shape.children || shape.children.length === 0) {
            continue;
        }
        const removedShape = removeShapeFromHierarchy(shapeId, shape.children);
        if (removedShape) {
            return removedShape;
        }
    }

    return null;
}

function getPartDeletionReferences(shapeId: string): string[] {
    const references: string[] = [];

    createdMarkers.forEach((marker) => {
        if (marker.groupId === shapeId) {
            references.push(`marker:${marker.name}`);
        }
    });
    Array.from(createdRefFrames.values()).forEach((refFrame) => {
        if (refFrame.groupId === shapeId) {
            references.push(`refMarker:${refFrame.name}`);
        }
    });
    Array.from(mbsDesignPoints.values()).forEach((point) => {
        if (point.groupId === shapeId) {
            references.push(`designPoint:${point.name}`);
        }
    });
    Array.from(mbsJoints.values()).forEach((joint) => {
        if (joint.part1 === shapeId || joint.part2 === shapeId) {
            references.push(`joint:${joint.name}`);
        }
    });
    Array.from(fluidSlices.values()).forEach((slice) => {
        if (slice.shapeRef === shapeId) {
            references.push(`ribSlice:${slice.name}`);
        }
    });
    Array.from(fluidPorts.values()).forEach((port) => {
        if (port.shapeRef === shapeId) {
            references.push(`fluidPort:${port.name}`);
        }
    });

    return references;
}

function deletePartById(shapeId: string): { deleted: boolean; name: string; blockedBy: string[] } {
    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        return { deleted: false, name: shapeId, blockedBy: ['missing'] };
    }
    if (!isLeafShape(shape)) {
        return { deleted: false, name: shape.name, blockedBy: ['non-leaf shape'] };
    }

    const blockedBy = getPartDeletionReferences(shapeId);
    if (blockedBy.length > 0) {
        return { deleted: false, name: shape.name, blockedBy };
    }

    const ownerGroupId = resolveOwningGroupId(shapeId);
    const ownerGroup = getGroupNode(ownerGroupId);
    if (ownerGroup) {
        ownerGroup.memberPartIds = ownerGroup.memberPartIds.filter((memberPartId) => memberPartId !== shapeId);
    }

    selectedNodeIds.delete(toShapeSelectionKey(shapeId));
    groupDesignState.selectedNodeIds = Array.from(selectedNodeIds);
    selectedDensityByShapeId.delete(shapeId);
    massPropertiesWorkerClient.notifyShapeDeleted(shapeId);

    if (shape.meshId) {
        meshIdToShapeId.delete(shape.meshId);
        viewer?.removeMesh(shape.meshId);
    }
    if (occt && shape.shapeId) {
        occt.deleteShape(shape.shapeId);
    }

    loadedShapes.delete(shapeId);
    removeShapeFromHierarchy(shapeId, rootShapes);
    syncUngroupedPartIds();

    for (let index = shapeSelectionHistory.length - 1; index >= 0; index -= 1) {
        if (shapeSelectionHistory[index] === shapeId) {
            shapeSelectionHistory.splice(index, 1);
        }
    }

    if (selectedShapeId === shapeId) {
        selectSelection(null);
    } else {
        updateTreeSelectionClasses();
        updateSelectionPropertiesPanel();
    }

    return { deleted: true, name: shape.name, blockedBy: [] };
}

function deleteSelectedGroups(): { deletedCount: number; blockedMessages: string[] } {
    const blockedMessages: string[] = [];
    let deletedCount = 0;

    getTopLevelSelectedGroupIds(getSelectedGroupIds()).forEach((groupId) => {
        const group = getGroupNode(groupId);
        if (!group) {
            return;
        }
        if (group.childGroupIds.length > 0) {
            blockedMessages.push(`Group "${group.name}" still has child groups.`);
            return;
        }
        if (group.memberPartIds.length > 0) {
            blockedMessages.push(`Group "${group.name}" still has members.`);
            return;
        }
        if (isGroupReferenced(group.id)) {
            blockedMessages.push(`Group "${group.name}" is referenced by design entities.`);
            return;
        }
        if (removeGroupById(group.id)) {
            deletedCount += 1;
        }
    });

    return { deletedCount, blockedMessages };
}

function handleDeleteSelection(): void {
    const selectedGroupIds = getTopLevelSelectedGroupIds(getSelectedGroupIds());
    const coveredGroupIds = new Set<string>();
    selectedGroupIds.forEach((groupId) => {
        coveredGroupIds.add(groupId);
        collectDescendantGroupIds(groupId).forEach((descendantGroupId) => coveredGroupIds.add(descendantGroupId));
    });

    const ownerMap = buildPartOwnerGroupMap();
    const selectedPartIds = getSelectedShapeIds().filter((shapeId) => {
        const ownerGroupId = ownerMap.get(shapeId);
        return !ownerGroupId || !coveredGroupIds.has(ownerGroupId);
    });

    if (selectedGroupIds.length === 0 && selectedPartIds.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'Select one or more parts/groups first.'
        });
        return;
    }

    let deletedPartCount = 0;
    const blockedMessages: string[] = [];

    selectedPartIds.forEach((shapeId) => {
        const result = deletePartById(shapeId);
        if (result.deleted) {
            deletedPartCount += 1;
            return;
        }
        blockedMessages.push(`Part "${result.name}" blocked by ${result.blockedBy.join(', ')}.`);
    });

    const groupDeleteResult = deleteSelectedGroups();
    blockedMessages.push(...groupDeleteResult.blockedMessages);

    updateModelTree();
    setStatusInfo(`Deleted ${deletedPartCount} part(s) and ${groupDeleteResult.deletedCount} group(s).`);

    if (blockedMessages.length > 0) {
        const message = blockedMessages.length > 4
            ? `${blockedMessages.slice(0, 4).join(' | ')} | ... and ${blockedMessages.length - 4} more.`
            : blockedMessages.join(' | ');
        vscode.postMessage({
            command: 'alert',
            text: message
        });
    }
}

function loadRenderConfigState(): RenderConfigState {
    try {
        const state = vscode.getState() as { renderConfig?: Partial<RenderConfigState> } | undefined;
        return normalizeRenderConfig(state?.renderConfig);
    } catch (error) {
        console.warn('[render-config] Failed to load persisted state, fallback to defaults:', error);
        return { ...DEFAULT_RENDER_CONFIG };
    }
}

function saveRenderConfigState(): void {
    const currentConfig = normalizeRenderConfig(renderConfig);
    renderConfig = currentConfig;

    const existingStateRaw = vscode.getState();
    const existingState = (
        existingStateRaw !== null
        && typeof existingStateRaw === 'object'
    )
        ? existingStateRaw as Record<string, unknown>
        : {};

    vscode.setState({
        ...existingState,
        renderConfig: currentConfig
    });
}

function applyRenderConfigToViewer(): void {
    const config = normalizeRenderConfig(renderConfig);
    renderConfig = config;

    const presetApplied = invokeViewerMethod(viewer, ['setVisualPreset'], config.visualPreset);
    const materialApplied = invokeViewerMethod(viewer, ['setMaterialMode'], config.materialMode);
    const postApplied =
        invokeViewerMethod(viewer, ['setPostProcessingEnabled'], config.postProcessing)
        || invokeViewerMethod(viewer, ['setOutlineEnabled'], config.postProcessing);
    const edgeApplied =
        invokeViewerMethod(viewer, ['setEdgeLayerVisible'], config.edgeLayerVisible)
        || invokeViewerMethod(viewer, ['setEdgesVisible'], config.edgeLayerVisible)
        || invokeViewerMethod(viewer, ['setEdgeVisibility'], config.edgeLayerVisible);

    if (!presetApplied || !materialApplied || !postApplied || !edgeApplied) {
        const missing: string[] = [];
        if (!presetApplied) missing.push('visual preset');
        if (!materialApplied) missing.push('material');
        if (!postApplied) missing.push('post-processing');
        if (!edgeApplied) missing.push('edge layer');
        setStatusInfo(`Some rendering capabilities are not available: ${missing.join(' / ')}`);
    }
}

function getMeshingParamsFromPreset(preset: PrecisionPreset): { linearDeflection: number; angularDeflection: number } {
    switch (preset) {
        case 'coarse':
            return { linearDeflection: 0.002, angularDeflection: 0.45 };
        case 'fine':
            return { linearDeflection: 0.0002, angularDeflection: 0.1 };
        case 'balanced':
        default:
            return { linearDeflection: 0.0005, angularDeflection: 0.2 };
    }
}

// ============================================================================
// UI Helpers
// ============================================================================

function setStatus(text: string): void {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
        statusEl.textContent = text;
    }
}

function setStatusInfo(text: string): void {
    const infoEl = document.getElementById('status-info');
    if (infoEl) {
        infoEl.textContent = text;
    }
}

function identityRigidTransform(): RigidTransform {
    return {
        translation: { x: 0, y: 0, z: 0 },
        rotation: [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]
    };
}

function isIdentityRigidTransform(transform: RigidTransform | undefined): boolean {
    if (!transform) {
        return true;
    }
    const { translation, rotation } = transform;
    return translation.x === 0
        && translation.y === 0
        && translation.z === 0
        && rotation.length === 9
        && rotation[0] === 1
        && rotation[1] === 0
        && rotation[2] === 0
        && rotation[3] === 0
        && rotation[4] === 1
        && rotation[5] === 0
        && rotation[6] === 0
        && rotation[7] === 0
        && rotation[8] === 1;
}

function normalizeRigidTransform(transform: LoadedShape['transform'] | undefined): RigidTransform {
    if (!transform || !Array.isArray(transform.rotation) || transform.rotation.length !== 9) {
        return identityRigidTransform();
    }

    return {
        translation: {
            x: transform.translation?.x ?? 0,
            y: transform.translation?.y ?? 0,
            z: transform.translation?.z ?? 0
        },
        rotation: transform.rotation.map((value) => Number(value) || 0)
    };
}

function composeRigidTransforms(parent: RigidTransform, local: RigidTransform): RigidTransform {
    const pr = parent.rotation;
    const lr = local.rotation;

    const rotation = [
        pr[0] * lr[0] + pr[1] * lr[3] + pr[2] * lr[6],
        pr[0] * lr[1] + pr[1] * lr[4] + pr[2] * lr[7],
        pr[0] * lr[2] + pr[1] * lr[5] + pr[2] * lr[8],
        pr[3] * lr[0] + pr[4] * lr[3] + pr[5] * lr[6],
        pr[3] * lr[1] + pr[4] * lr[4] + pr[5] * lr[7],
        pr[3] * lr[2] + pr[4] * lr[5] + pr[5] * lr[8],
        pr[6] * lr[0] + pr[7] * lr[3] + pr[8] * lr[6],
        pr[6] * lr[1] + pr[7] * lr[4] + pr[8] * lr[7],
        pr[6] * lr[2] + pr[7] * lr[5] + pr[8] * lr[8]
    ];

    const translation = {
        x: pr[0] * local.translation.x + pr[1] * local.translation.y + pr[2] * local.translation.z + parent.translation.x,
        y: pr[3] * local.translation.x + pr[4] * local.translation.y + pr[5] * local.translation.z + parent.translation.y,
        z: pr[6] * local.translation.x + pr[7] * local.translation.y + pr[8] * local.translation.z + parent.translation.z
    };

    return { translation, rotation };
}

function transformPoint(transform: RigidTransform, x: number, y: number, z: number): [number, number, number] {
    const r = transform.rotation;
    return [
        r[0] * x + r[1] * y + r[2] * z + transform.translation.x,
        r[3] * x + r[4] * y + r[5] * z + transform.translation.y,
        r[6] * x + r[7] * y + r[8] * z + transform.translation.z
    ];
}

function transformDirection(transform: RigidTransform, x: number, y: number, z: number): [number, number, number] {
    const r = transform.rotation;
    return [
        r[0] * x + r[1] * y + r[2] * z,
        r[3] * x + r[4] * y + r[5] * z,
        r[6] * x + r[7] * y + r[8] * z
    ];
}

function applyRigidTransformToMeshData(meshData: MeshData, transform: RigidTransform): MeshData {
    if (isIdentityRigidTransform(transform)) {
        return meshData;
    }

    const vertices = new Float32Array(meshData.vertices.length);
    for (let i = 0; i < meshData.vertices.length; i += 3) {
        const [x, y, z] = transformPoint(transform, meshData.vertices[i], meshData.vertices[i + 1], meshData.vertices[i + 2]);
        vertices[i] = x;
        vertices[i + 1] = y;
        vertices[i + 2] = z;
    }

    const normals = new Float32Array(meshData.normals.length);
    for (let i = 0; i < meshData.normals.length; i += 3) {
        const [nx, ny, nz] = transformDirection(transform, meshData.normals[i], meshData.normals[i + 1], meshData.normals[i + 2]);
        normals[i] = nx;
        normals[i + 1] = ny;
        normals[i + 2] = nz;
    }

    return {
        vertices,
        normals,
        indices: new Uint32Array(meshData.indices)
    };
}

function applyRigidTransformToEdgeData(edgeData: EdgeData | undefined, transform: RigidTransform): EdgeData | undefined {
    if (!edgeData) {
        return undefined;
    }
    if (isIdentityRigidTransform(transform)) {
        return edgeData;
    }

    const vertices = new Float32Array(edgeData.vertices.length);
    for (let i = 0; i < edgeData.vertices.length; i += 3) {
        const [x, y, z] = transformPoint(transform, edgeData.vertices[i], edgeData.vertices[i + 1], edgeData.vertices[i + 2]);
        vertices[i] = x;
        vertices[i + 1] = y;
        vertices[i + 2] = z;
    }

    return { vertices };
}

let ribbonResizeObserver: ResizeObserver | null = null;

function ensureRibbonMoreControls(ribbon: HTMLElement): {
    moreGroup: HTMLElement;
    moreSeparator: HTMLElement;
    moreButton: HTMLButtonElement;
    moreMenu: HTMLElement;
} {
    let moreGroup = document.getElementById('ribbon-more-group') as HTMLElement | null;
    let moreSeparator = document.getElementById('ribbon-more-separator') as HTMLElement | null;

    if (!moreGroup || !moreSeparator) {
        moreSeparator = document.createElement('div');
        moreSeparator.id = 'ribbon-more-separator';
        moreSeparator.className = 'ribbon-separator';

        moreGroup = document.createElement('div');
        moreGroup.id = 'ribbon-more-group';
        moreGroup.className = 'ribbon-tab-group ribbon-more-group';
        moreGroup.innerHTML = `
            <div class="ribbon-tab-content">
                <button class="ribbon-btn has-dropdown ribbon-more-btn" id="btn-ribbon-more" title="更多命令">
                    <span class="ribbon-btn-icon ribbon-more-icon">...</span>
                    <span class="ribbon-btn-text">更多</span>
                    <span class="ribbon-btn-arrow">▼</span>
                </button>
                <div class="ribbon-dropdown" id="ribbon-more-menu"></div>
            </div>
            <div class="ribbon-tab-label">更多</div>
        `;

        ribbon.appendChild(moreSeparator);
        ribbon.appendChild(moreGroup);
    }

    const moreButton = document.getElementById('btn-ribbon-more') as HTMLButtonElement;
    const moreMenu = document.getElementById('ribbon-more-menu') as HTMLElement;

    if (moreButton.dataset.bound !== '1') {
        moreButton.dataset.bound = '1';
        moreButton.addEventListener('click', (event) => {
            event.stopPropagation();
            moreMenu.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            moreMenu.classList.remove('show');
        });
    }

    return { moreGroup, moreSeparator, moreButton, moreMenu };
}

function buildRibbonMoreMenu(menu: HTMLElement, hiddenGroups: HTMLElement[]): void {
    menu.innerHTML = '';

    hiddenGroups.forEach((group) => {
        const groupTitle = group.querySelector('.ribbon-tab-label')?.textContent?.trim() || '命令';
        const buttons = Array.from(group.querySelectorAll('.ribbon-btn')) as HTMLButtonElement[];

        buttons.forEach((sourceBtn) => {
            const actionText =
                sourceBtn.querySelector('.ribbon-btn-text')?.textContent?.trim()
                || sourceBtn.title
                || sourceBtn.id
                || '命令';
            const iconSrc = (sourceBtn.querySelector('.ribbon-btn-icon img') as HTMLImageElement | null)?.src;

            const item = document.createElement('div');
            item.className = 'ribbon-dropdown-item';
            item.innerHTML = `
                <span class="ribbon-dropdown-item-icon">${iconSrc ? `<img src="${iconSrc}" alt="">` : '•'}</span>
                <span class="ribbon-dropdown-item-label">${groupTitle} · ${actionText}</span>
            `;
            item.addEventListener('click', (event) => {
                event.stopPropagation();
                menu.classList.remove('show');
                sourceBtn.click();
            });
            menu.appendChild(item);
        });
    });
}

function updateRibbonSeparators(ribbon: HTMLElement): void {
    const children = Array.from(ribbon.children) as HTMLElement[];
    const isVisibleGroup = (node: HTMLElement): boolean => {
        if (!node.classList.contains('ribbon-tab-group')) return false;
        if (node.classList.contains('ribbon-group-hidden')) return false;
        return node.style.display !== 'none';
    };

    children.forEach((node, index) => {
        if (!node.classList.contains('ribbon-separator')) return;

        let hasPrevVisibleGroup = false;
        let hasNextVisibleGroup = false;

        for (let i = index - 1; i >= 0; i--) {
            if (children[i].classList.contains('ribbon-tab-group')) {
                hasPrevVisibleGroup = isVisibleGroup(children[i]);
                break;
            }
        }
        for (let i = index + 1; i < children.length; i++) {
            if (children[i].classList.contains('ribbon-tab-group')) {
                hasNextVisibleGroup = isVisibleGroup(children[i]);
                break;
            }
        }

        node.classList.toggle('ribbon-separator-hidden', !(hasPrevVisibleGroup && hasNextVisibleGroup));
    });
}

function applyRibbonResponsiveMode(): void {
    const ribbon = document.querySelector('.ribbon-bar') as HTMLElement | null;
    if (!ribbon) return;

    const { moreGroup, moreSeparator, moreMenu } = ensureRibbonMoreControls(ribbon);
    const allGroups = Array.from(ribbon.querySelectorAll('.ribbon-tab-group')) as HTMLElement[];
    const groups = allGroups.filter((group) => group.id !== 'ribbon-more-group');

    groups.forEach((group) => group.classList.remove('ribbon-group-hidden'));
    moreGroup.style.display = 'none';
    moreSeparator.style.display = 'none';
    moreMenu.classList.remove('show');

    const width = ribbon.clientWidth;
    ribbon.classList.toggle('compact', width < 1700);
    ribbon.classList.toggle('icon-only', width < 1360);

    const hideOrder = [9, 8, 7, 5, 4, 3, 2, 1, 6, 0];
    let hideCursor = 0;
    const isOverflowing = (): boolean => ribbon.scrollWidth > ribbon.clientWidth + 1;
    const hideNextGroup = (): boolean => {
        while (hideCursor < hideOrder.length) {
            const target = groups[hideOrder[hideCursor]];
            hideCursor += 1;
            if (target && !target.classList.contains('ribbon-group-hidden')) {
                target.classList.add('ribbon-group-hidden');
                return true;
            }
        }
        return false;
    };

    while (isOverflowing() && hideNextGroup()) {
        // keep hiding low-priority groups until ribbon fits
    }

    let hiddenGroups = groups.filter((group) => group.classList.contains('ribbon-group-hidden'));
    if (hiddenGroups.length > 0) {
        moreGroup.style.display = '';
        moreSeparator.style.display = '';
        while (isOverflowing() && hideNextGroup()) {
            // account for "more" control itself
        }
        hiddenGroups = groups.filter((group) => group.classList.contains('ribbon-group-hidden'));
    }

    if (hiddenGroups.length === 0) {
        moreGroup.style.display = 'none';
        moreSeparator.style.display = 'none';
        moreMenu.classList.remove('show');
    } else {
        buildRibbonMoreMenu(moreMenu, hiddenGroups);
    }

    updateRibbonSeparators(ribbon);
}

function setupRibbonAdaptiveLayout(): void {
    const ribbon = document.querySelector('.ribbon-bar') as HTMLElement | null;
    if (!ribbon) return;

    document.querySelectorAll('.ribbon-btn').forEach((btn) => {
        const el = btn as HTMLElement;
        if (el.title) return;
        const text = el.querySelector('.ribbon-btn-text')?.textContent?.trim();
        if (text) {
            el.title = text;
        }
    });

    applyRibbonResponsiveMode();
    if (typeof ResizeObserver !== 'undefined') {
        ribbonResizeObserver?.disconnect();
        ribbonResizeObserver = new ResizeObserver(() => {
            applyRibbonResponsiveMode();
        });
        ribbonResizeObserver.observe(ribbon);
    } else {
        window.addEventListener('resize', applyRibbonResponsiveMode);
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function setupSidebarResize(): void {
    const mainBody = document.querySelector('.main-body') as HTMLElement | null;
    const leftSidebar = document.querySelector('.sidebar') as HTMLElement | null;
    const rightSidebar = document.querySelector('.sidebar-right') as HTMLElement | null;
    const leftResizer = document.getElementById('left-sidebar-resizer') as HTMLElement | null;
    const rightResizer = document.getElementById('right-sidebar-resizer') as HTMLElement | null;

    if (!mainBody || !leftSidebar || !rightSidebar || !leftResizer || !rightResizer) {
        return;
    }

    const minLeftWidth = 220;
    const maxLeftWidth = 560;
    const minRightWidth = 240;
    const maxRightWidth = 560;
    const minViewportWidth = 420;

    const handleTotalWidth = (): number => leftResizer.offsetWidth + rightResizer.offsetWidth;
    const notifyViewportResize = (): void => {
        window.dispatchEvent(new Event('resize'));
    };
    const getWidth = (el: HTMLElement): number => el.getBoundingClientRect().width;

    const getAllowedLeftMax = (): number => {
        const available = mainBody.clientWidth - getWidth(rightSidebar) - minViewportWidth - handleTotalWidth();
        return Math.max(minLeftWidth, Math.min(maxLeftWidth, available));
    };
    const getAllowedRightMax = (): number => {
        const available = mainBody.clientWidth - getWidth(leftSidebar) - minViewportWidth - handleTotalWidth();
        return Math.max(minRightWidth, Math.min(maxRightWidth, available));
    };

    const applyLeftWidth = (value: number): void => {
        const width = clamp(value, minLeftWidth, getAllowedLeftMax());
        leftSidebar.style.width = `${Math.round(width)}px`;
    };
    const applyRightWidth = (value: number): void => {
        const width = clamp(value, minRightWidth, getAllowedRightMax());
        rightSidebar.style.width = `${Math.round(width)}px`;
    };

    const startDrag = (target: 'left' | 'right', startEvent: PointerEvent): void => {
        startEvent.preventDefault();
        const startX = startEvent.clientX;
        const initialLeft = getWidth(leftSidebar);
        const initialRight = getWidth(rightSidebar);
        const activeHandle = target === 'left' ? leftResizer : rightResizer;

        mainBody.classList.add('resizing');
        activeHandle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';

        const onMove = (moveEvent: PointerEvent): void => {
            const dx = moveEvent.clientX - startX;
            if (target === 'left') {
                applyLeftWidth(initialLeft + dx);
            } else {
                applyRightWidth(initialRight - dx);
            }
            notifyViewportResize();
        };

        const onUp = (): void => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            mainBody.classList.remove('resizing');
            activeHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            notifyViewportResize();
            applyRibbonResponsiveMode();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
    };

    leftResizer.addEventListener('pointerdown', (event) => startDrag('left', event));
    rightResizer.addEventListener('pointerdown', (event) => startDrag('right', event));

    const enforceBounds = (): void => {
        applyLeftWidth(getWidth(leftSidebar));
        applyRightWidth(getWidth(rightSidebar));
        notifyViewportResize();
    };

    enforceBounds();
    window.addEventListener('resize', enforceBounds);
}

function showLoading(text: string = 'Loading...'): void {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function hideLoading(): void {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    // Reset progress bar
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

function showProgress(percent: number, text?: string): void {
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
    if (progressFill) {
        progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (progressText) {
        progressText.textContent = text || `${Math.round(percent)}%`;
    }
}

function toggleRenderConfigPanel(forceVisible?: boolean): void {
    const panel = document.getElementById('render-config-panel');
    if (!panel) return;

    const shouldShow = typeof forceVisible === 'boolean'
        ? forceVisible
        : !panel.classList.contains('show');
    panel.classList.toggle('show', shouldShow);
}

async function remeshLoadedModelWithCurrentPrecision(): Promise<void> {
    if (!viewer || !occt || loadedShapes.size === 0) {
        return;
    }

    renderConfig = normalizeRenderConfig(renderConfig);
    const remeshTargets = Array.from(loadedShapes.values()).filter(
        (shape): shape is LoadedShape & { shapeId: string; meshId: string } => {
            if (!shape.shapeId || !shape.meshId) {
                return false;
            }
            return occt.hasShape(shape.shapeId);
        }
    );

    if (remeshTargets.length === 0) {
        return;
    }

    const { linearDeflection, angularDeflection } = getMeshingParamsFromPreset(renderConfig.precisionPreset);
    showLoading('Updating mesh precision...');
    showProgress(5, 'Preparing remesh...');
    setStatus('Updating mesh precision...');

    await new Promise(resolve => setTimeout(resolve, 0));

    try {
        const shapeIds = remeshTargets.map(shape => shape.shapeId);
        const meshByShapeId = occt.getMeshes(shapeIds, linearDeflection, angularDeflection);
        let updatedCount = 0;

        for (let i = 0; i < remeshTargets.length; i++) {
            const shape = remeshTargets[i];
            const meshData = meshByShapeId.get(shape.shapeId) ?? null;
            const edgeLinearDeflection = Math.max(linearDeflection * 0.35, 1e-6);
            const edgeData = occt.getBrepEdges(shape.shapeId, edgeLinearDeflection);
            if (meshData && meshData.vertices.length > 0) {
                viewer.removeMesh(shape.meshId);
                viewer.addMeshFromData(shape.meshId, meshData, undefined, edgeData ?? undefined);
                viewer.setVisibility(shape.meshId, shape.visible);
                if (shape.color) {
                    const colorHex = parseInt(shape.color.replace('#', ''), 16);
                    viewer.setMeshColor(shape.meshId, colorHex);
                }
                shape.meshData = meshData;
                shape.edgeData = edgeData ?? undefined;
                meshIdToShapeId.set(shape.meshId, shape.id);
                updatedCount++;
            }

            const progress = 10 + ((i + 1) / remeshTargets.length) * 85;
            showProgress(progress, `Remeshing (${i + 1}/${remeshTargets.length})...`);
            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        applyRenderConfigToViewer();
        syncViewerSelectionFromState();
        showProgress(100, 'Complete');
        setStatus('Ready');
        setStatusInfo(`Precision updated: ${updatedCount}/${remeshTargets.length} parts`);
    } catch (error) {
        console.error('Failed to remesh with precision preset:', error);
        setStatus('Mesh precision update failed');
        vscode.postMessage({
            command: 'alert',
            text: `Failed to update mesh precision: ${error}`
        });
    } finally {
        hideLoading();
    }
}

async function applyPrecisionPreset(preset: PrecisionPreset): Promise<void> {
    renderConfig = normalizeRenderConfig(renderConfig);
    if (renderConfig.precisionPreset === preset) {
        return;
    }

    renderConfig.precisionPreset = preset;
    saveRenderConfigState();

    if (loadedShapes.size > 0) {
        await remeshLoadedModelWithCurrentPrecision();
        return;
    }

    setStatusInfo(`Mesh precision preset: ${preset}`);
}

function applyRenderControls(
    updates: Partial<Pick<RenderConfigState, 'visualPreset' | 'materialMode' | 'postProcessing' | 'edgeLayerVisible'>>
): void {
    renderConfig = normalizeRenderConfig({ ...normalizeRenderConfig(renderConfig), ...updates });
    saveRenderConfigState();
    applyRenderConfigToViewer();
}

function setupRenderConfigUI(): void {
    renderConfig = normalizeRenderConfig(renderConfig);
    const presetSelect = document.getElementById('render-visual-preset') as HTMLSelectElement | null;
    const materialSelect = document.getElementById('render-material-mode') as HTMLSelectElement | null;
    const postCheckbox = document.getElementById('render-postprocessing') as HTMLInputElement | null;
    const edgeCheckbox = document.getElementById('render-edge-layer') as HTMLInputElement | null;
    const precisionSelect = document.getElementById('render-precision') as HTMLSelectElement | null;

    if (presetSelect) {
        presetSelect.value = renderConfig.visualPreset;
        presetSelect.addEventListener('change', () => {
            const preset = presetSelect.value;
            if (!isVisualPreset(preset)) {
                return;
            }
            applyRenderControls({ visualPreset: preset });
        });
    }

    if (materialSelect) {
        materialSelect.value = renderConfig.materialMode;
        materialSelect.addEventListener('change', () => {
            const mode = materialSelect.value;
            if (!isMaterialMode(mode)) {
                return;
            }
            applyRenderControls({ materialMode: mode });
        });
    }

    if (postCheckbox) {
        postCheckbox.checked = renderConfig.postProcessing;
        postCheckbox.addEventListener('change', () => {
            applyRenderControls({ postProcessing: postCheckbox.checked });
        });
    }

    if (edgeCheckbox) {
        edgeCheckbox.checked = renderConfig.edgeLayerVisible;
        edgeCheckbox.addEventListener('change', () => {
            applyRenderControls({ edgeLayerVisible: edgeCheckbox.checked });
        });
    }

    if (precisionSelect) {
        precisionSelect.value = renderConfig.precisionPreset;
        precisionSelect.addEventListener('change', () => {
            const preset = precisionSelect.value;
            if (isPrecisionPreset(preset)) {
                void applyPrecisionPreset(preset);
            }
        });
    }

    document.getElementById('btn-render-config')?.addEventListener('click', () => {
        toggleRenderConfigPanel();
    });
    document.getElementById('render-config-close')?.addEventListener('click', () => {
        toggleRenderConfigPanel(false);
    });

    applyRenderConfigToViewer();
}

function updateModelTree(): void {
    const treeEl = document.getElementById('model-tree');
    if (!treeEl) return;

    hideTreeContextMenu();
    const nodes = buildModelTreeNodes();
    if (nodes.length === 0) {
        treeEl.innerHTML = '<div style="color: #808080; font-style: italic;">No model loaded</div>';
        return;
    }

    treeEl.innerHTML = '';
    nodes.forEach((node) => {
        const nodeEl = createTreeNode(node, 0);
        treeEl.appendChild(nodeEl);
    });
    updateTreeSelectionClasses();
}

function toNamedEntityList<T extends { id: string; name: string }>(items: Iterable<T>): BrowserNamedEntityInput[] {
    return Array.from(items, (item) => ({
        id: item.id,
        name: item.name
    }));
}

let resolvedIcons32Base: string | null | undefined;

function resolveIcons32Base(): string | null {
    if (typeof resolvedIcons32Base === 'string' && resolvedIcons32Base.length > 0) {
        return resolvedIcons32Base;
    }

    const fromWindow = typeof window.ICONS_32_BASE === 'string' ? window.ICONS_32_BASE.trim() : '';
    if (fromWindow.length > 0) {
        resolvedIcons32Base = fromWindow;
        return resolvedIcons32Base;
    }

    const fromDataAttr = document.documentElement.getAttribute('data-icons32-base')?.trim() ?? '';
    if (fromDataAttr.length > 0) {
        resolvedIcons32Base = fromDataAttr;
        return resolvedIcons32Base;
    }

    const probeImg = document.querySelector<HTMLImageElement>(
        '.ribbon-btn-icon img, img[src*="icons/png/32/"], img[src*="public/icons/png/32/"]'
    );
    if (probeImg?.src) {
        const idx = probeImg.src.lastIndexOf('/');
        if (idx > 0) {
            resolvedIcons32Base = probeImg.src.slice(0, idx);
            return resolvedIcons32Base;
        }
    }

    return null;
}

function treeIconPath(fileName: string): string | null {
    const base = resolveIcons32Base();
    if (!base) {
        return null;
    }
    return `${base}/${fileName}`;
}

function toGroupTreeShapeNode(shapeId: string): ModelTreeNode | null {
    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        return null;
    }
    return {
        id: `shape_${shape.id}`,
        kind: shape.type,
        label: shape.name,
        shapeId: shape.id,
        selectionKey: toShapeSelectionKey(shape.id)
    };
}

function toFallbackTreeShapeNode(shape: LoadedShape): ModelTreeNode {
    return {
        id: `shape_${shape.id}`,
        kind: shape.type,
        label: shape.name,
        shapeId: shape.id,
        selectionKey: toShapeSelectionKey(shape.id),
        children: shape.children?.map((child) => toFallbackTreeShapeNode(child))
    };
}

function toGroupTreeNode(groupId: string): ModelTreeNode | null {
    const group = getGroupNode(groupId);
    if (!group) {
        return null;
    }

    const children: ModelTreeNode[] = [
        ...getOrderedChildGroupIds(group.id)
            .map((childGroupId) => toGroupTreeNode(childGroupId))
            .filter((node): node is ModelTreeNode => Boolean(node)),
        ...group.memberPartIds
            .map((shapeId) => toGroupTreeShapeNode(shapeId))
            .filter((node): node is ModelTreeNode => Boolean(node))
    ];

    return {
        id: `group_${group.id}`,
        kind: 'group',
        label: group.name,
        groupId: group.id,
        selectionKey: toGroupSelectionKey(group.id),
        children
    };
}

function buildObjectTreeNodes(): ModelTreeNode[] {
    syncUngroupedPartIds();
    const hasExplicitGroups = listGroups().length > 0;
    const groupNodes = getOrderedChildGroupIds(null)
        .map((groupId) => toGroupTreeNode(groupId))
        .filter((node): node is ModelTreeNode => Boolean(node));
    const ungroupedNodes = groupDesignState.ungroupedPartIds
        .map((shapeId) => toGroupTreeShapeNode(shapeId))
        .filter((node): node is ModelTreeNode => Boolean(node));

    if (hasExplicitGroups) {
        return groupNodes.concat(ungroupedNodes);
    }

    return rootShapes.length > 0
        ? flattenTopLevelAssemblyShapes(rootShapes).map((shape) => toFallbackTreeShapeNode(shape))
        : externalModelTreeShapes.map((shape) => ({
            id: `shape_${shape.id}`,
            label: shape.name,
            kind: 'part',
            shapeId: shape.id,
            selectionKey: toShapeSelectionKey(shape.id)
        }));
}

function buildModelTreeNodes(): ModelTreeNode[] {
    const forceEntities: BrowserNamedEntityInput[] = [
        ...Array.from(fluidSlices.values(), (slice) => ({ id: `slice_${slice.id}`, name: slice.name })),
        ...Array.from(fluidPorts.values(), (port) => ({ id: `port_${port.id}`, name: port.name }))
    ];

    const objectNodes = buildObjectTreeNodes();

    const hasEntities = objectNodes.length > 0
        || mbsJoints.size > 0
        || mbsMotions.size > 0
        || forceEntities.length > 0;
    if (!hasEntities) {
        return [];
    }

    const nodes = buildModelBrowserTree({
        shapes: [],
        includeGround: true,
        connections: toNamedEntityList(mbsJoints.values()),
        motions: toNamedEntityList(mbsMotions.values()),
        forces: forceEntities,
        materials: []
    }) as unknown as ModelTreeNode[];

    const objectsCategory = nodes.find((node) => node.id === 'category_objects');
    if (objectsCategory) {
        const groundNode = objectsCategory.children?.find((node) => node.kind === 'ground');
        objectsCategory.children = groundNode ? [groundNode as ModelTreeNode, ...objectNodes] : objectNodes;
    }

    return nodes;
}

function iconForNode(node: ModelTreeNode): string {
    switch (node.kind) {
        case 'category':
            switch (node.id) {
                case 'category_objects':
                    return 'Objects';
                case 'category_connections':
                    return 'Joints';
                case 'category_motions':
                    return 'Motions';
                case 'category_forces':
                    return 'Forces';
                case 'category_materials':
                    return 'Materials';
                default:
                    return 'Category';
            }
        case 'assembly':
            return 'A';
        case 'group':
            return 'G';
        case 'part':
            return 'P';
        case 'solid':
            return 'S';
        case 'ground':
            return 'G';
        case 'connection':
            return 'J';
        case 'motion':
            return 'M';
        case 'force':
            return 'F';
        case 'material':
            return 'T';
        default:
            return '?';
    }
}

function iconAssetForNode(node: ModelTreeNode): string | null {
    switch (node.kind) {
        case 'category':
            switch (node.id) {
                case 'category_objects':
                    return treeIconPath('model_tree_body_dir.png');
                case 'category_connections':
                    return treeIconPath('model_tree_connector_dir.png');
                case 'category_motions':
                    return treeIconPath('model_tree_motion_dir.png');
                case 'category_forces':
                    return treeIconPath('model_tree_force_dir.png');
                case 'category_materials':
                    return treeIconPath('model_tree_material_dir.png');
                default:
                    return treeIconPath('cad_browser.png');
            }
        case 'ground':
            return treeIconPath('model_tree_cad_ground.png');
        case 'assembly':
            return treeIconPath('model_tree_group.png');
        case 'group':
            return treeIconPath('model_tree_group.png');
        case 'part':
            return treeIconPath('model_tree_part.png');
        case 'solid':
            return treeIconPath('model_tree_subbody.png');
        case 'connection':
            return treeIconPath('model_tree_cad_unknown_cnt.png');
        case 'motion':
            return treeIconPath('model_tree_cad_rotational_gray.png');
        case 'force':
            return treeIconPath('force_cad_general_force.png');
        case 'material':
            return treeIconPath('model_tree_material.png');
        default:
            return null;
    }
}

function expandIconPath(expanded: boolean): string | null {
    return treeIconPath(expanded ? 'model_tree_cad_collapse.png' : 'model_tree_cad_expand.png');
}

function setExpandButtonState(expandBtn: HTMLElement, expanded: boolean): void {
    const icon = expandBtn.querySelector('img');
    const iconPath = expandIconPath(expanded);
    if (icon && iconPath) {
        const img = icon as HTMLImageElement;
        img.src = iconPath;
        img.alt = expanded ? 'collapse' : 'expand';
        return;
    }
    expandBtn.textContent = expanded ? 'v' : '>';
}

function visibilityIconPath(visible: boolean): string | null {
    return treeIconPath(visible ? 'menu_menu_show_selected.png' : 'menu_menu_hide_selected.png');
}

function setVisibilityButtonState(visibilityBtn: HTMLElement, visible: boolean): void {
    const icon = visibilityBtn.querySelector('img');
    const iconPath = visibilityIconPath(visible);
    if (icon && iconPath) {
        const img = icon as HTMLImageElement;
        img.src = iconPath;
        img.alt = visible ? 'visible' : 'hidden';
        return;
    }

    if (iconPath) {
        const img = document.createElement('img');
        img.src = iconPath;
        img.alt = visible ? 'visible' : 'hidden';
        img.draggable = false;
        visibilityBtn.textContent = '';
        visibilityBtn.appendChild(img);
        return;
    }

    visibilityBtn.textContent = visible ? 'ON' : 'OFF';
}

function getTreeContextMenu(): HTMLDivElement {
    if (treeContextMenuEl) {
        return treeContextMenuEl;
    }

    treeContextMenuEl = document.createElement('div');
    treeContextMenuEl.style.position = 'fixed';
    treeContextMenuEl.style.zIndex = '2000';
    treeContextMenuEl.style.minWidth = '160px';
    treeContextMenuEl.style.padding = '6px 0';
    treeContextMenuEl.style.background = '#252526';
    treeContextMenuEl.style.border = '1px solid #3c3c3c';
    treeContextMenuEl.style.borderRadius = '6px';
    treeContextMenuEl.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.35)';
    treeContextMenuEl.style.display = 'none';
    document.body.appendChild(treeContextMenuEl);

    document.addEventListener('click', () => {
        if (treeContextMenuEl) {
            treeContextMenuEl.style.display = 'none';
        }
    });

    return treeContextMenuEl;
}

function hideTreeContextMenu(): void {
    if (treeContextMenuEl) {
        treeContextMenuEl.style.display = 'none';
    }
}

function buildTreeContextMenuActions(nodeData: ModelTreeNode): Array<{ label: string; action: string }> {
    if (nodeData.groupId) {
        return [
            { label: '新建子组', action: 'createChildGroup' },
            { label: '重命名', action: 'renameGroup' },
            { label: '移动到...', action: 'moveToGroup' },
            { label: '分解', action: 'ungroupGroup' },
            { label: '删除', action: 'deleteSelection' },
            { label: '属性', action: 'groupProperties' }
        ];
    }

    if (nodeData.shapeId) {
        return [
            { label: '组合', action: 'createGroup' },
            { label: '移动到...', action: 'moveToGroup' },
            { label: '删除', action: 'deleteSelection' }
        ];
    }

    return [];
}

function showTreeContextMenu(x: number, y: number, nodeData: ModelTreeNode): void {
    const actions = buildTreeContextMenuActions(nodeData);
    if (actions.length === 0) {
        return;
    }

    const menu = getTreeContextMenu();
    menu.innerHTML = '';

    actions.forEach((item) => {
        const actionEl = document.createElement('button');
        actionEl.type = 'button';
        actionEl.textContent = item.label;
        actionEl.style.display = 'block';
        actionEl.style.width = '100%';
        actionEl.style.padding = '8px 14px';
        actionEl.style.background = 'transparent';
        actionEl.style.border = 'none';
        actionEl.style.color = '#cccccc';
        actionEl.style.textAlign = 'left';
        actionEl.style.cursor = 'pointer';
        actionEl.addEventListener('mouseenter', () => {
            actionEl.style.background = '#094771';
        });
        actionEl.addEventListener('mouseleave', () => {
            actionEl.style.background = 'transparent';
        });
        actionEl.addEventListener('click', (event) => {
            event.stopPropagation();
            hideTreeContextMenu();
            handleMbsAction(item.action, {});
        });
        menu.appendChild(actionEl);
    });

    menu.style.display = 'block';
    const { innerWidth, innerHeight } = window;
    const menuWidth = 180;
    const menuHeight = actions.length * 38 + 12;
    menu.style.left = `${Math.min(x, innerWidth - menuWidth - 12)}px`;
    menu.style.top = `${Math.min(y, innerHeight - menuHeight - 12)}px`;
}

function createTreeNode(nodeData: ModelTreeNode, level: number): HTMLElement {
    const container = document.createElement('div');
    container.className = 'tree-node-container';
    container.style.marginLeft = `${level * 16}px`;

    const node = document.createElement('div');
    node.className = 'tree-node';
    if (nodeData.selectionKey && selectedNodeIds.has(nodeData.selectionKey)) {
        node.classList.add('selected');
    }
    if (nodeData.shapeId) {
        node.dataset.shapeId = nodeData.shapeId;
    }
    if (nodeData.groupId) {
        node.dataset.groupId = nodeData.groupId;
    }
    if (nodeData.selectionKey) {
        node.dataset.selectionKey = nodeData.selectionKey;
    }
    if (nodeData.groupId || nodeData.id === 'category_objects') {
        node.dataset.dropTarget = nodeData.groupId ?? '__root__';
    }

    if (nodeData.children && nodeData.children.length > 0) {
        const expandedByDefault = nodeData.kind === 'category' || nodeData.kind === 'assembly' || nodeData.kind === 'group';
        const expandBtn = document.createElement('span');
        expandBtn.className = 'expand-btn';
        const expandIcon = expandIconPath(expandedByDefault);
        if (expandIcon) {
            const iconImg = document.createElement('img');
            iconImg.src = expandIcon;
            iconImg.alt = expandedByDefault ? 'collapse' : 'expand';
            iconImg.draggable = false;
            expandBtn.appendChild(iconImg);
        } else {
            expandBtn.textContent = expandedByDefault ? 'v' : '>';
        }
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNodeExpand(container);
        });
        node.appendChild(expandBtn);
    } else {
        const spacer = document.createElement('span');
        spacer.className = 'expand-spacer';
        node.appendChild(spacer);
    }

    const mappedShape = nodeData.shapeId ? loadedShapes.get(nodeData.shapeId) : undefined;
    const supportsVisibility = Boolean(mappedShape && (nodeData.kind === 'assembly' || nodeData.kind === 'part' || nodeData.kind === 'solid'));
    if (supportsVisibility && mappedShape) {
        const visibilityBtn = document.createElement('span');
        visibilityBtn.className = 'visibility-btn';
        setVisibilityButtonState(visibilityBtn, mappedShape.visible);
        visibilityBtn.title = mappedShape.visible ? 'Hide' : 'Show';
        visibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleVisibility(mappedShape.id);
        });
        node.appendChild(visibilityBtn);
    } else if (nodeData.shapeId) {
        const spacer = document.createElement('span');
        spacer.className = 'visibility-spacer';
        node.appendChild(spacer);
    }

    const icon = document.createElement('span');
    icon.className = 'icon';
    const iconAsset = iconAssetForNode(nodeData);
    if (iconAsset) {
        const iconImg = document.createElement('img');
        iconImg.src = iconAsset;
        iconImg.alt = nodeData.kind;
        iconImg.draggable = false;
        icon.appendChild(iconImg);
    } else {
        icon.textContent = iconForNode(nodeData);
    }
    node.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = nodeData.label;
    node.appendChild(name);

    if (nodeData.selectionKey && (nodeData.groupId || nodeData.shapeId)) {
        node.draggable = true;
        node.addEventListener('dragstart', (event) => {
            const selectionKey = nodeData.selectionKey ?? '';
            const parsed = parseSelectionKey(selectionKey);
            if (!parsed || !event.dataTransfer) {
                event.preventDefault();
                return;
            }

            if (!selectedNodeIds.has(selectionKey)) {
                selectSelection(parsed);
            }

            const selectionKeys = getDraggableSelectionPayload(selectionKey);
            syncDragSelection(selectionKeys);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-cadtool-selection', JSON.stringify(selectionKeys));
            event.dataTransfer.setData('text/plain', selectionKeys.join(','));
            node.classList.add('dragging');
            hideTreeContextMenu();
        });
        node.addEventListener('dragend', () => {
            node.classList.remove('dragging');
            clearTreeDropIndicators();
        });
    }

    if (nodeData.selectionKey) {
        node.addEventListener('click', (event) => {
            const additive = event.ctrlKey || event.metaKey;
            const parsed = parseSelectionKey(nodeData.selectionKey ?? null);
            if (!parsed) {
                return;
            }
            selectSelection(parsed, {
                additive,
                toggle: additive
            });
        });
        node.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const parsed = parseSelectionKey(nodeData.selectionKey ?? null);
            if (!parsed) {
                return;
            }
            if (!selectedNodeIds.has(nodeData.selectionKey ?? '')) {
                selectSelection(parsed);
            }
            showTreeContextMenu(event.clientX, event.clientY, nodeData);
        });
    }

    if (node.dataset.dropTarget) {
        node.addEventListener('dragover', (event) => {
            const targetGroupId = node.dataset.dropTarget === '__root__' ? null : node.dataset.dropTarget ?? null;
            const validation = validateMoveSelectionToGroup(targetGroupId);
            applyTreeDropIndicator(node, validation.valid);
            if (validation.valid) {
                event.preventDefault();
                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                }
            }
        });
        node.addEventListener('dragleave', () => {
            node.classList.remove('drop-target-valid', 'drop-target-invalid');
        });
        node.addEventListener('drop', (event) => {
            event.preventDefault();
            clearTreeDropIndicators();

            const rawPayload = event.dataTransfer?.getData('application/x-cadtool-selection') ?? '';
            if (rawPayload) {
                try {
                    const parsedPayload = JSON.parse(rawPayload) as unknown;
                    if (Array.isArray(parsedPayload)) {
                        const selectionKeys = parsedPayload.filter((item): item is string => typeof item === 'string');
                        syncDragSelection(selectionKeys);
                    }
                } catch (error) {
                    console.warn('Failed to parse tree drag payload:', error);
                }
            }

            const targetGroupId = node.dataset.dropTarget === '__root__' ? null : node.dataset.dropTarget ?? null;
            handleTreeDrop(targetGroupId);
        });
    }

    container.appendChild(node);

    if (nodeData.children && nodeData.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        childrenContainer.style.display = (nodeData.kind === 'category' || nodeData.kind === 'assembly' || nodeData.kind === 'group') ? 'block' : 'none';

        nodeData.children.forEach((child) => {
            const childNode = createTreeNode(child, level + 1);
            childrenContainer.appendChild(childNode);
        });

        container.appendChild(childrenContainer);
    }

    return container;
}

function toggleNodeExpand(container: HTMLElement): void {
    const expandBtn = container.querySelector('.expand-btn') as HTMLElement | null;
    const childrenContainer = container.querySelector('.tree-children') as HTMLElement;

    if (expandBtn && childrenContainer) {
        const isExpanded = childrenContainer.style.display !== 'none';
        childrenContainer.style.display = isExpanded ? 'none' : 'block';
        setExpandButtonState(expandBtn, !isExpanded);
    }
}

function toggleVisibility(shapeId: string): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) return;

    shape.visible = !shape.visible;

    // Update viewer
    if (viewer && shape.meshId) {
        viewer.setVisibility(shape.meshId, shape.visible);
    }

    // Recursively update children
    if (shape.children) {
        shape.children.forEach(child => {
            setVisibilityRecursive(child, shape.visible);
        });
    }

    updateModelTree();
}

function setVisibilityRecursive(shape: LoadedShape, visible: boolean): void {
    shape.visible = visible;
    if (viewer && shape.meshId) {
        viewer.setVisibility(shape.meshId, visible);
    }
    if (shape.children) {
        shape.children.forEach(child => setVisibilityRecursive(child, visible));
    }
}

function showColorPicker(shapeId: string): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) return;

    // Create a simple color picker using HTML5 input
    const input = document.createElement('input');
    input.type = 'color';
    input.value = shape.color || '#808080';
    input.style.position = 'absolute';
    input.style.opacity = '0';
    document.body.appendChild(input);

    input.addEventListener('change', (e) => {
        const newColor = (e.target as HTMLInputElement).value;
        changeShapeColor(shapeId, newColor);
        document.body.removeChild(input);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.body.contains(input)) {
                document.body.removeChild(input);
            }
        }, 100);
    });

    input.click();
}

function changeShapeColor(shapeId: string, newColor: string): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) return;

    // Update shape color
    shape.color = newColor;

    // Apply to viewer
    if (viewer && shape.meshId) {
        const colorHex = parseInt(newColor.replace('#', ''), 16);
        viewer.setMeshColor(shape.meshId, colorHex);
    }

    // Update properties panel if this shape is selected
    if (selectedShapeId === shapeId) {
        updatePropertiesPanel(shapeId);
    }
}

type MassPropertiesViewState =
    | { kind: 'hidden' }
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; value: MassProperties };

function bindColorChangeButtons(propsEl: HTMLElement): void {
    propsEl.querySelectorAll('.color-change-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetShapeId = (e.currentTarget as HTMLElement).dataset.shapeId;
            if (targetShapeId) {
                showColorPicker(targetShapeId);
            }
        });
    });
}

function bindMaterialSelect(propsEl: HTMLElement): void {
    propsEl.querySelectorAll('.property-material-select').forEach(selectEl => {
        selectEl.addEventListener('change', (e) => {
            const select = e.currentTarget as HTMLSelectElement;
            const targetShapeId = select.dataset.shapeId;
            const nextDensity = Number.parseFloat(select.value);
            if (!targetShapeId || !Number.isFinite(nextDensity) || nextDensity <= 0) {
                return;
            }

            selectedDensityByShapeId.set(targetShapeId, nextDensity);
            if (selectedShapeId === targetShapeId) {
                massPropertiesCoordinator.cancelPending();
                updatePropertiesPanel(targetShapeId);
            }
        });
    });
}

function toDisplayShapeType(type: LoadedShape['type']): string {
    switch (type) {
        case 'assembly':
            return '装配体';
        case 'solid':
            return '实体';
        case 'part':
        default:
            return '零件';
    }
}

function countLeafShapeParts(shape: LoadedShape): number {
    if (!shape.children || shape.children.length === 0) {
        return 1;
    }
    return shape.children.reduce((sum, child) => sum + countLeafShapeParts(child), 0);
}

function formatPhysicsNumber(value: number, fractionDigits: number = 5): string {
    if (!Number.isFinite(value)) {
        return '--';
    }
    const abs = Math.abs(value);
    if (abs > 0 && (abs < 1e-3 || abs >= 1e5)) {
        return value.toExponential(4).replace('e+', 'e');
    }
    return value.toFixed(fractionDigits);
}

function formatInteger(value: number): string {
    if (!Number.isFinite(value)) {
        return '--';
    }
    return Math.round(value).toString();
}

function getMaterialDensity(shapeId: string): number {
    const saved = selectedDensityByShapeId.get(shapeId);
    if (!Number.isFinite(saved) || !saved || saved <= 0) {
        selectedDensityByShapeId.set(shapeId, DEFAULT_MATERIAL_DENSITY);
        return DEFAULT_MATERIAL_DENSITY;
    }
    return saved;
}

function findMaterialByDensity(density: number): MaterialOption | null {
    if (!Number.isFinite(density)) {
        return null;
    }
    const match = MATERIAL_OPTIONS.find((option) => Math.abs(option.density - density) < 0.5);
    return match ?? null;
}

function formatMaterialOptionLabel(material: MaterialOption): string {
    return `${material.name}:${formatInteger(material.density)}kg/m^3`;
}

function createMaterialRow(shapeId: string, density: number): string {
    const known = findMaterialByDensity(density);
    const options = [...MATERIAL_OPTIONS];
    if (!known) {
        options.push({
            id: 'custom-current',
            name: '自定义',
            density
        });
    }

    const optionsHtml = options.map((material) => {
        const selected = Math.abs(material.density - density) < 0.5 ? ' selected' : '';
        return `<option value="${material.density}"${selected}>${formatMaterialOptionLabel(material)}</option>`;
    }).join('');

    return `<div class="property-row">
        <span class="property-label">材料</span>
        <span class="property-value">
            <select class="property-material-select" data-shape-id="${shapeId}">
                ${optionsHtml}
            </select>
        </span>
    </div>`;
}

function getInertiaRows(mass: MassProperties): [number, number, number][] {
    const matrix = mass.inertiaMatrix?.m;
    if (Array.isArray(matrix) && matrix.length === 9 && matrix.every(v => Number.isFinite(v))) {
        return [
            [matrix[0], matrix[1], matrix[2]],
            [matrix[3], matrix[4], matrix[5]],
            [matrix[6], matrix[7], matrix[8]]
        ];
    }

    return [
        [mass.inertia.ixx, mass.inertia.ixy, mass.inertia.ixz],
        [mass.inertia.ixy, mass.inertia.iyy, mass.inertia.iyz],
        [mass.inertia.ixz, mass.inertia.iyz, mass.inertia.izz]
    ];
}

function createVectorRow(values: [number, number, number], unit?: string): string {
    const [x, y, z] = values;
    return `<div class="property-row property-vector-row">
        <span class="property-label"></span>
        <span class="property-value property-com-values">
            <span class="property-com-box">${formatPhysicsNumber(x, 5)}</span>
            <span class="property-com-box">${formatPhysicsNumber(y, 5)}</span>
            <span class="property-com-box">${formatPhysicsNumber(z, 5)}</span>
            ${unit ? `<span class="property-com-unit">${unit}</span>` : ''}
        </span>
    </div>`;
}

function renderPropertiesPanel(shape: LoadedShape, massState: MassPropertiesViewState): void {
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    let html = '';
    const displayColor = shape.color || '#808080';
    const isVisible = shape.visible;
    const partCount = countLeafShapeParts(shape);

    html += '<div class="property-section-header">基本属性</div>';
    html += createPropertyRow('名称', shape.name, { boxed: true });
    html += createPropertyRow('类型', toDisplayShapeType(shape.type));
    html += `<div class="property-row">
        <span class="property-label">可见性</span>
        <span class="property-value">
            <span class="property-check${isVisible ? ' checked' : ''}">${isVisible ? '✓' : ''}</span>
        </span>
    </div>`;
    html += `<div class="property-row">
        <span class="property-label">颜色</span>
        <span class="property-value property-color-value">
            <button class="color-change-btn property-swatch-btn" data-shape-id="${shape.id}" style="background: ${displayColor};" title="更改颜色"></button>
        </span>
    </div>`;
    html += `<div class="property-row">
        <span class="property-label">半透明</span>
        <span class="property-value">
            <span class="property-check"></span>
        </span>
    </div>`;

    html += '<div class="property-separator"></div>';
    html += '<div class="property-section-header">物理属性</div>';
    html += createPropertyRow('零件个数', partCount.toString(), { boxed: true });
    const currentDensity = getMaterialDensity(shape.id);
    html += createMaterialRow(shape.id, currentDensity);

    if (massState.kind === 'loading') {
        html += createPropertyRow('密度', `${formatInteger(currentDensity)} kg/m^3`);
        html += createPropertyRow('状态', '计算中...');
    } else if (massState.kind === 'unavailable' || massState.kind === 'hidden') {
        html += createPropertyRow('密度', `${formatInteger(currentDensity)} kg/m^3`);
        html += createPropertyRow('状态', '不可用');
    } else if (massState.kind === 'ready') {
        const densityValue = formatInteger(massState.value.density);
        html += createPropertyRow('密度', `${densityValue} kg/m^3`);
        html += createPropertyRow('总质量', `${formatPhysicsNumber(massState.value.mass, 5)} kg`);
        html += createPropertyRow('体积', `${formatPhysicsNumber(massState.value.volume, 5)} m^3`);

        html += '<div class="property-sub-header">  质心</div>';
        html += createVectorRow([
            massState.value.centerOfMass.x,
            massState.value.centerOfMass.y,
            massState.value.centerOfMass.z
        ], 'm');

        html += '<div class="property-sub-header">  惯性张量</div>';
        const inertiaRows = getInertiaRows(massState.value);
        html += createVectorRow(inertiaRows[0]);
        html += createVectorRow(inertiaRows[1]);
        html += createVectorRow(inertiaRows[2], 'kg·m²');
    }

    propsEl.innerHTML = html;
    bindColorChangeButtons(propsEl);
    bindMaterialSelect(propsEl);
}

function updatePropertiesPanel(shapeId: string | null): void {
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    if (!shapeId) {
        massPropertiesCoordinator.cancelPending();
        setPanelMode('properties', '属性');
        propsEl.innerHTML = '<div style="color: #808080; font-style: italic;">选择对象以查看属性</div>';
        return;
    }

    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        massPropertiesCoordinator.cancelPending();
        setPanelMode('properties', '属性');
        propsEl.innerHTML = '<div style="color: #808080; font-style: italic;">对象不存在</div>';
        return;
    }

    setPanelMode('properties', '属性-零件');
    const targetDensity = getMaterialDensity(shape.id);

    const occtForRequest = occt;
    const requestResult = massPropertiesCoordinator.request(
        { uiShapeId: shape.id, kernelShapeId: shape.shapeId, density: targetDensity },
        occtForRequest
            ? {
                hasShape: (targetShapeId: string) => occtForRequest.hasShape(targetShapeId),
                getMass: (targetShapeId: string, density: number) => {
                    try {
                        return occtForRequest.getMassProperties(targetShapeId, density);
                    } catch (error) {
                        console.warn('Failed to get mass properties:', error);
                        return null;
                    }
                }
            }
            : null,
        (resolvedShapeId, massProperties) => {
            if (selectedShapeId !== resolvedShapeId) {
                return;
            }
            const resolvedShape = loadedShapes.get(resolvedShapeId);
            if (!resolvedShape) {
                return;
            }
            if (massProperties) {
                renderPropertiesPanel(resolvedShape, { kind: 'ready', value: massProperties });
            } else {
                renderPropertiesPanel(resolvedShape, { kind: 'unavailable' });
            }
        }
    );

    let massState: MassPropertiesViewState = shape.shapeId
        ? { kind: 'unavailable' }
        : { kind: 'hidden' };

    if (requestResult.state === 'scheduled') {
        massState = { kind: 'loading' };
    } else if (requestResult.state === 'cached') {
        massState = requestResult.massProperties
            ? { kind: 'ready', value: requestResult.massProperties }
            : { kind: 'unavailable' };
    }

    renderPropertiesPanel(shape, massState);
}

function createPropertyRow(label: string, value: string, options?: { boxed?: boolean }): string {
    return `<div class="property-row">
        <span class="property-label">${label}</span>
        <span class="property-value${options?.boxed ? ' boxed' : ''}">${value}</span>
    </div>`;
}

function selectShape(shapeId: string, fromViewer: boolean = false): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        console.warn('[selectShape] Shape not found:', shapeId);
        return;
    }
    selectSelection({ kind: 'shape', id: shapeId }, { fromViewer });

    const newSelected = document.querySelector(`.tree-node[data-shape-id="${shapeId}"]`);
    if (newSelected) {
        expandParentNodes(newSelected);
        newSelected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function rememberShapeSelection(shapeId: string): void {
    const last = shapeSelectionHistory.at(-1);
    if (last !== shapeId) {
        shapeSelectionHistory.push(shapeId);
    }

    if (shapeSelectionHistory.length > 20) {
        shapeSelectionHistory.splice(0, shapeSelectionHistory.length - 20);
    }
}

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
                const expandBtn = container.querySelector('.expand-btn') as HTMLElement | null;
                if (expandBtn) {
                    setExpandButtonState(expandBtn, true);
                }
            }
        }

        current = current.parentElement;
    }
}

// ============================================================================
// OCCT Initialization
// ============================================================================

async function initOcct(): Promise<void> {
    if (occt && occt.isInitialized()) return;

    // If initialization is already in progress, wait for it
    if (occtInitPromise) {
        await occtInitPromise;
        return;
    }

    setStatus('Initializing OCCT...');
    occt = new OcctWrapper();
    occtInitPromise = occt.initialize();
    await occtInitPromise;
    setStatus('Ready');
}

// ============================================================================
// STEP File Loading
// ============================================================================

function toArrayBuffer(fileContent: unknown): ArrayBuffer {
    if (fileContent instanceof ArrayBuffer) {
        return fileContent;
    }
    if (fileContent instanceof Uint8Array) {
        return fileContent.buffer.slice(fileContent.byteOffset, fileContent.byteOffset + fileContent.byteLength);
    }
    if (Array.isArray(fileContent)) {
        return new Uint8Array(fileContent).buffer;
    }
    throw new Error('Unsupported file content format');
}

async function loadStepFile(fileName: string, fileContent: unknown): Promise<void> {
    console.log('[loadStepFile] Starting to load:', fileName);
    renderConfig = normalizeRenderConfig(renderConfig);

    // Always wait for OCCT to be fully initialized
    await initOcct();
    console.log('[loadStepFile] OCCT initialized');

    // Ensure old scene/WASM shapes are fully cleaned before importing a new file
    clearScene();
    occt?.clearShapes();

    showLoading(`Loading ${fileName}...`);
    showProgress(0, 'Reading file...');
    setStatus(`Loading ${fileName}...`);

    // Yield to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10));
    console.log('[loadStepFile] UI updated, starting decode');

    try {
        const arrayBuffer = toArrayBuffer(fileContent);
        console.log('[loadStepFile] Received binary file data, size:', arrayBuffer.byteLength);

        showProgress(10, 'Parsing STEP file...');
        // Yield to allow UI to update before heavy WASM call
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log('[loadStepFile] Calling readStep...');

        // Read STEP file
        const baseId = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
        const result: StepReadResult = await occt!.readStep(arrayBuffer, baseId);
        console.log('[loadStepFile] readStep result:', result);

        if (!result.success) {
            throw new Error(result.error || 'Failed to read STEP file');
        }

        const workerBuffer = arrayBuffer.slice(0);
        massPropertiesWorkerClient
            .syncStep(result.shapes, workerBuffer, baseId)
            .catch((error) => {
                console.warn('[massWorker] Step sync failed', error);
            });

        showProgress(30, 'Building hierarchy...');
        setStatus('Building model hierarchy...');
        await new Promise(resolve => setTimeout(resolve, 10));

        // Build hierarchy from rootNodes if available
        if (result.rootNodes && result.rootNodes.length > 0) {
            console.log('[loadStepFile] Building hierarchy from', result.rootNodes.length, 'root nodes');

            // Collect only leaf renderable shapes.
            // This avoids rendering both parent and child solids at the same time (z-fighting / ghosting).
            const shapesToMesh: Array<{ node: any }> = [];
            const hasRenderableDescendant = (node: any): boolean => {
                if (!node?.children || !Array.isArray(node.children)) {
                    return false;
                }
                return node.children.some((child: any) => Boolean(child.shapeId) || hasRenderableDescendant(child));
            };
            const collectShapes = (node: any) => {
                if (node.shapeId && !hasRenderableDescendant(node)) {
                    shapesToMesh.push({ node });
                }
                if (node.children) {
                    node.children.forEach((child: any) => {
                        collectShapes(child);
                    });
                }
            };
            result.rootNodes.forEach((root) => collectShapes(root));

            showProgress(40, `Generating meshes (0/${shapesToMesh.length})...`);
            console.log('[loadStepFile] Total shapes to mesh:', shapesToMesh.length);

            const validShapeIds = Array.from(new Set(
                shapesToMesh
                    .map(({ node }) => node.shapeId as string | undefined)
                    .filter((shapeId): shapeId is string => Boolean(shapeId) && occt!.hasShape(shapeId))
            ));
            const { linearDeflection, angularDeflection } = getMeshingParamsFromPreset(renderConfig.precisionPreset);
            const meshByShapeId = occt!.getMeshes(validShapeIds, linearDeflection, angularDeflection);
            const edgeByShapeId = new Map<string, EdgeData | null>();
            validShapeIds.forEach((shapeId) => {
                const edgeLinearDeflection = Math.max(linearDeflection * 0.35, 1e-6);
                edgeByShapeId.set(shapeId, occt!.getBrepEdges(shapeId, edgeLinearDeflection));
            });

            // Attach meshes to all nodes
            for (let i = 0; i < shapesToMesh.length; i++) {
                const {node} = shapesToMesh[i];
                if (node.shapeId) {
                    const meshData = meshByShapeId.get(node.shapeId) ?? null;
                    if (meshData && meshData.vertices.length > 0) {
                        node._meshData = meshData;
                    }
                    const edgeData = edgeByShapeId.get(node.shapeId) ?? null;
                    if (edgeData && edgeData.vertices.length > 0) {
                        node._edgeData = edgeData;
                    }
                }

                // Update progress (40% to 80% for mesh generation)
                const meshProgress = 40 + ((i + 1) / shapesToMesh.length) * 40;
                showProgress(meshProgress, `Generating meshes (${i + 1}/${shapesToMesh.length})...`);

                // Yield to UI thread periodically
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            showProgress(85, 'Building scene...');
            await new Promise(resolve => setTimeout(resolve, 10));

            // Build hierarchy tree
            let meshCount = 0;
            rootShapes.length = 0;
            loadedShapes.clear();
            selectedDensityByShapeId.clear();

            const buildShapeTree = (
                node: any,
                parent?: LoadedShape,
                parentTransform: RigidTransform = identityRigidTransform()
            ): LoadedShape => {
                const localTransform = normalizeRigidTransform(node.transform);
                const worldTransform = composeRigidTransforms(parentTransform, localTransform);
                const shape: LoadedShape = {
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    shapeId: node.shapeId,
                    color: node.color,
                    transform: worldTransform,
                    visible: true,
                    parent
                };

                // Add mesh to viewer if available
                if (node._meshData) {
                    const meshId = `mesh_${node.id}`;
                    const meshData = applyRigidTransformToMeshData(node._meshData, worldTransform);
                    const edgeData = applyRigidTransformToEdgeData(node._edgeData, worldTransform);
                    if (viewer) {
                        viewer.addMeshFromData(meshId, meshData, undefined, edgeData);

                        // Apply color if available
                        if (node.color) {
                            const colorHex = parseInt(node.color.replace('#', ''), 16);
                            viewer.setMeshColor(meshId, colorHex);
                        }
                    }
                    shape.meshId = meshId;
                    shape.meshData = meshData;
                    shape.edgeData = edgeData;

                    // Register mesh ID to shape ID mapping for selection sync
                    meshIdToShapeId.set(meshId, shape.id);

                    meshCount++;
                }

                // Process children
                if (node.children && node.children.length > 0) {
                    shape.children = node.children.map((child: any) => buildShapeTree(child, shape, worldTransform));
                }

                loadedShapes.set(shape.id, shape);
                return shape;
            };

            result.rootNodes.forEach(root => {
                rootShapes.push(buildShapeTree(root));
            });

            showProgress(95, 'Finalizing...');

            // Fit view to show all shapes
            if (viewer && meshCount > 0) {
                viewer.fitToView();
            }
            applyRenderConfigToViewer();

            // Update UI
            updateModelTree();
            showProgress(100, 'Complete');
            setStatus('Ready');
            setStatusInfo(`${meshCount} parts loaded (${result.rootNodes.length} assemblies)`);

            // Select first shape
            if (rootShapes.length > 0) {
                selectShape(rootShapes[0].id);
            }

            vscode.postMessage({
                command: 'alert',
                text: `Successfully loaded ${meshCount} parts from ${fileName}`
            });

        } else {
            // Fallback to legacy flat structure
            console.log('[loadStepFile] Using legacy flat structure');
            showProgress(30, `Generating mesh (0/${result.shapes.length})...`);
            setStatus(`Generating mesh for ${result.shapes.length} shapes...`);
            await new Promise(resolve => setTimeout(resolve, 10));

            let addedCount = 0;
            rootShapes.length = 0;
            loadedShapes.clear();
            selectedDensityByShapeId.clear();

            const totalShapes = result.shapes.length;
            const { linearDeflection, angularDeflection } = getMeshingParamsFromPreset(renderConfig.precisionPreset);
            const meshByShapeId = occt!.getMeshes(result.shapes, linearDeflection, angularDeflection);
            for (let i = 0; i < totalShapes; i++) {
                const shapeId = result.shapes[i];
                const meshData = meshByShapeId.get(shapeId) ?? null;
                const edgeLinearDeflection = Math.max(linearDeflection * 0.35, 1e-6);
                const edgeData = occt!.getBrepEdges(shapeId, edgeLinearDeflection);
                if (meshData && meshData.vertices.length > 0) {
                    const meshId = `mesh_${shapeId}`;
                    const shape: LoadedShape = {
                        id: shapeId,
                        name: shapeId,
                        type: 'solid',
                        shapeId,
                        meshId,
                        meshData,
                        edgeData: edgeData ?? undefined,
                        visible: true
                    };

                    // Add to viewer
                    if (viewer) {
                        viewer.addMeshFromData(meshId, meshData, undefined, edgeData ?? undefined);
                    }

                    // Register mesh ID to shape ID mapping for selection sync
                    meshIdToShapeId.set(meshId, shapeId);

                    loadedShapes.set(shapeId, shape);
                    rootShapes.push(shape);
                    addedCount++;
                }

                // Update progress (30% to 90% for mesh generation)
                const meshProgress = 30 + ((i + 1) / totalShapes) * 60;
                showProgress(meshProgress, `Generating mesh (${i + 1}/${totalShapes})...`);

                // Yield to UI thread periodically
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            showProgress(95, 'Finalizing...');

            // Fit view to show all shapes
            if (viewer && addedCount > 0) {
                viewer.fitToView();
            }
            applyRenderConfigToViewer();

            // Update UI
            updateModelTree();
            showProgress(100, 'Complete');
            setStatus('Ready');
            setStatusInfo(`${addedCount} shapes loaded`);

            // Select first shape
            if (result.shapes.length > 0) {
                selectShape(result.shapes[0]);
            }

            vscode.postMessage({
                command: 'alert',
                text: `Successfully loaded ${addedCount} shapes from ${fileName}`
            });
        }

    } catch (error) {
        console.error('Failed to load STEP file:', error);
        setStatus('Error loading file');
        vscode.postMessage({
            command: 'alert',
            text: `Failed to load STEP file: ${error}`
        });
    } finally {
        hideLoading();
    }
}

// ============================================================================
// Export Model Functions
// ============================================================================

/**
 * Export model data to JSON format
 */
function exportModel(): void {
    if (rootShapes.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'No model loaded to export'
        });
        return;
    }

    setStatus('Preparing export data...');

    try {
        // Build export data structure
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            parts: [] as Array<{
                id: string;
                name: string;
                type: string;
                color?: string;
                properties?: {
                    vertices?: number;
                    triangles?: number;
                    volume?: number;
                    surfaceArea?: number;
                    mass?: number;
                    centerOfMass?: { x: number; y: number; z: number };
                };
                boundingBox?: {
                    min: { x: number; y: number; z: number };
                    max: { x: number; y: number; z: number };
                    size: { x: number; y: number; z: number };
                };
                children?: string[];
            }>
        };

        // Recursively collect all parts
        const collectParts = (shape: LoadedShape): void => {
            const partData: typeof exportData.parts[0] = {
                id: shape.id,
                name: shape.name,
                type: shape.type,
                color: shape.color
            };

            // Add mesh properties if available
            if (shape.meshData) {
                const vertexCount = shape.meshData.vertices.length / 3;
                const triangleCount = shape.meshData.indices.length / 3;

                partData.properties = {
                    vertices: vertexCount,
                    triangles: triangleCount
                };

                // Calculate bounding box
                const vertices = shape.meshData.vertices;
                let minX = Infinity, minY = Infinity, minZ = Infinity;
                let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

                for (let i = 0; i < vertices.length; i += 3) {
                    minX = Math.min(minX, vertices[i]);
                    minY = Math.min(minY, vertices[i + 1]);
                    minZ = Math.min(minZ, vertices[i + 2]);
                    maxX = Math.max(maxX, vertices[i]);
                    maxY = Math.max(maxY, vertices[i + 1]);
                    maxZ = Math.max(maxZ, vertices[i + 2]);
                }

                partData.boundingBox = {
                    min: { x: minX, y: minY, z: minZ },
                    max: { x: maxX, y: maxY, z: maxZ },
                    size: {
                        x: maxX - minX,
                        y: maxY - minY,
                        z: maxZ - minZ
                    }
                };
            }

            // Get mass properties if available
            if (occt && shape.shapeId && occt.hasShape(shape.shapeId)) {
                try {
                    const density = getMaterialDensity(shape.id);
                    const massProps = occt.getMassProperties(shape.shapeId, density);
                    if (massProps && partData.properties) {
                        partData.properties.volume = massProps.volume;
                        partData.properties.surfaceArea = massProps.surfaceArea;
                        partData.properties.mass = massProps.mass;
                        partData.properties.centerOfMass = massProps.centerOfMass;
                    }
                } catch (e) {
                    console.warn('Failed to get mass properties for export:', e);
                }
            }

            // Add children IDs
            if (shape.children && shape.children.length > 0) {
                partData.children = shape.children.map(child => child.id);
            }

            exportData.parts.push(partData);

            // Recursively process children
            if (shape.children) {
                shape.children.forEach(collectParts);
            }
        };

        rootShapes.forEach(collectParts);

        // Convert to JSON string with formatting
        const jsonData = JSON.stringify(exportData, null, 2);

        // Send to extension to save file
        vscode.postMessage({
            command: 'exportModel',
            data: jsonData
        });

        setStatus('Ready');
        setStatusInfo(`Exported ${exportData.parts.length} parts`);

    } catch (error) {
        console.error('Failed to export model:', error);
        setStatus('Export failed');
        vscode.postMessage({
            command: 'alert',
            text: `Failed to export model: ${error}`
        });
    }
}

interface CadtoolConfigExportData {
    group: Array<{
        name: string;
        parts: string[];
        parentRef?: string | null;
        kind?: GroupKind;
        order?: number;
    }>;
    marker: Array<{
        name: string;
        groupRef: string;
        position?: Vec3;
        direction?: Vec3;
        refMarker?: boolean;
        relatedMarkerRef?: string;
    }>;
    designPoint: Array<{
        name: string;
        groupRef: string;
        markerRef?: string;
        position: Vec3;
        direction?: Vec3;
        size?: number;
        isDirectionReverse?: boolean;
        offsetValue?: number;
    }>;
    connector: Array<{
        name: string;
        connectorType: string;
        part1: string;
        part2: string;
    }>;
    motion: Array<{
        name: string;
        motionType: string;
        connectorRef: string;
    }>;
    fluidPort: Array<{
        name: string;
        portType: string;
        ribSliceRef: string;
    }>;
    ribSlice: Array<{
        name: string;
    }>;
    gravity: unknown[];
    medium: unknown[];
}

interface CadtoolConfigImportStats {
    groups: number;
    markers: number;
    designPoints: number;
    connectors: number;
    motions: number;
    ribSlices: number;
    fluidPorts: number;
    skipped: number;
    warningCount: number;
    warnings: string[];
}

type JsonRecord = Record<string, unknown>;

const DEFAULT_IMPORT_STATS: CadtoolConfigImportStats = {
    groups: 0,
    markers: 0,
    designPoints: 0,
    connectors: 0,
    motions: 0,
    ribSlices: 0,
    fluidPorts: 0,
    skipped: 0,
    warningCount: 0,
    warnings: []
};

function createImportStats(): CadtoolConfigImportStats {
    return {
        ...DEFAULT_IMPORT_STATS,
        warnings: []
    };
}

function isJsonRecord(value: unknown): value is JsonRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function addImportWarning(stats: CadtoolConfigImportStats, warning: string): void {
    stats.warningCount += 1;
    if (stats.warnings.length < 8) {
        stats.warnings.push(warning);
    }
}

function getConfigArray(config: JsonRecord, key: string, stats: CadtoolConfigImportStats): unknown[] {
    const value = config[key];
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        addImportWarning(stats, `Top-level field "${key}" is not an array and was ignored.`);
        return [];
    }
    return value;
}

function parseVector3(value: unknown): { x: number; y: number; z: number } | null {
    if (Array.isArray(value) && value.length === 3) {
        const [x, y, z] = value;
        if ([x, y, z].every(axis => typeof axis === 'number' && Number.isFinite(axis))) {
            return { x: x as number, y: y as number, z: z as number };
        }
        return null;
    }

    if (isJsonRecord(value)) {
        const x = value.x;
        const y = value.y;
        const z = value.z;
        if (
            typeof x === 'number'
            && Number.isFinite(x)
            && typeof y === 'number'
            && Number.isFinite(y)
            && typeof z === 'number'
            && Number.isFinite(z)
        ) {
            return { x, y, z };
        }
    }

    return null;
}

function normalizeVector(vector: { x: number; y: number; z: number } | null): { x: number; y: number; z: number } | null {
    if (!vector) {
        return null;
    }
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    if (length <= 1e-9) {
        return null;
    }

    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length
    };
}

function cloneVec3(vec: Vec3): Vec3 {
    return { x: vec.x, y: vec.y, z: vec.z };
}

function cloneMat3(mat: Mat3): Mat3 {
    return { m: [...mat.m] };
}

function createOrientationFromNormal(normal: Vec3): Mat3 {
    const normalized = normalizeVector(normal) ?? { x: 0, y: 0, z: 1 };
    let tempX: Vec3;
    if (Math.abs(normalized.z) > 0.9) {
        tempX = { x: 1, y: 0, z: 0 };
    } else {
        tempX = { x: 0, y: 0, z: 1 };
    }

    const yAxis = normalizeVector({
        x: normalized.y * tempX.z - normalized.z * tempX.y,
        y: normalized.z * tempX.x - normalized.x * tempX.z,
        z: normalized.x * tempX.y - normalized.y * tempX.x
    }) ?? { x: 0, y: 1, z: 0 };

    const xAxis = normalizeVector({
        x: yAxis.y * normalized.z - yAxis.z * normalized.y,
        y: yAxis.z * normalized.x - yAxis.x * normalized.z,
        z: yAxis.x * normalized.y - yAxis.y * normalized.x
    }) ?? { x: 1, y: 0, z: 0 };

    return {
        m: [
            xAxis.x, xAxis.y, xAxis.z,
            yAxis.x, yAxis.y, yAxis.z,
            normalized.x, normalized.y, normalized.z
        ]
    };
}

function orientationToDirection(orientation: Mat3): Vec3 {
    const direction = normalizeVector({
        x: orientation.m[2],
        y: orientation.m[5],
        z: orientation.m[8]
    });
    return direction ?? { x: 0, y: 0, z: 1 };
}

function formatVec3(vec: Vec3): string {
    return `${vec.x.toFixed(3)}, ${vec.y.toFixed(3)}, ${vec.z.toFixed(3)}`;
}

function recordFrameCreation(id: string, kind: FrameEntityKind): void {
    frameCreationHistory.push({ id, kind });
    if (frameCreationHistory.length > 200) {
        frameCreationHistory.splice(0, frameCreationHistory.length - 200);
    }
}

function setCanvasCursor(cursor: string): void {
    const container = document.getElementById('canvas-container');
    if (container) {
        container.style.cursor = cursor;
    }
}

function resetCanvasInteraction(): void {
    editingFrameTarget = null;
    canvasInteractionMode = 'none';
    setCanvasCursor('default');
}

function resolveLatestExistingFrameFromHistory(): { index: number; id: string; kind: FrameEntityKind } | null {
    for (let i = frameCreationHistory.length - 1; i >= 0; i -= 1) {
        const item = frameCreationHistory[i];
        const exists = item.kind === 'marker'
            ? createdMarkers.some((marker) => marker.id === item.id)
            : createdRefFrames.has(item.id);

        if (exists) {
            return { index: i, id: item.id, kind: item.kind };
        }

        frameCreationHistory.splice(i, 1);
    }

    return null;
}

function buildShapeNameToIdMap(): Map<string, string> {
    const shapeNameToId = new Map<string, string>();
    loadedShapes.forEach((shape) => {
        if (!shapeNameToId.has(shape.name)) {
            shapeNameToId.set(shape.name, shape.id);
        }
    });
    return shapeNameToId;
}

function resolveShapeRef(value: string, shapeNameToId: Map<string, string>): { resolved: string; matched: boolean } {
    const mapped = shapeNameToId.get(value);
    if (mapped) {
        return { resolved: mapped, matched: true };
    }
    return { resolved: value, matched: false };
}

function clearCadtoolRuntimeEntities(): void {
    if (viewer) {
        createdMarkers.forEach(marker => {
            viewer.removeFrame(marker.id);
        });
        createdRefFrames.forEach((refFrame) => {
            viewer.removeFrame(refFrame.id);
        });
    }

    createdMarkers.length = 0;
    createdRefFrames.clear();
    mbsDesignPoints.clear();
    frameCreationHistory.length = 0;
    resetCanvasInteraction();
    groupDesignState = createEmptyGroupDesignState(getAllLeafPartIds());
    selectedNodeIds.clear();
    activeSelectionKey = null;
    selectedShapeId = null;
    selectedGroupId = null;
    mbsJoints.clear();
    mbsMotions.clear();
    fluidSlices.clear();
    fluidPorts.clear();
}

function importCadtoolConfig(data: unknown, sourceName?: string): void {
    if (!isJsonRecord(data)) {
        setStatus('CADTool config import failed');
        vscode.postMessage({
            command: 'alert',
            text: 'CADTool config import failed: payload must be a JSON object.'
        });
        return;
    }

    const sourceLabel = sourceName ? ` from ${sourceName}` : '';
    setStatus(`Importing CADTool config${sourceLabel}...`);

    const stats = createImportStats();
    const shapeNameToId = buildShapeNameToIdMap();
    const groupNameToId = new Map<string, string>();
    const ribSliceNames = new Set<string>();

    clearCadtoolRuntimeEntities();

    const importedGroups: GroupNode[] = [];
    const groups = getConfigArray(data, 'group', stats);
    groups.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `group[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        if (!name) {
            stats.skipped += 1;
            addImportWarning(stats, `group[${index}] is missing a valid "name" and was skipped.`);
            return;
        }

        const partsRaw = entry.parts;
        const parts: string[] = Array.isArray(partsRaw)
            ? partsRaw
                .map(toNonEmptyString)
                .filter((value): value is string => Boolean(value))
            : [];

        if (partsRaw !== undefined && !Array.isArray(partsRaw)) {
            addImportWarning(stats, `group[${index}].parts is not an array and was ignored.`);
        }

        const memberShapeIds: string[] = [];
        parts.forEach((partName) => {
            const resolvedPart = resolveShapeRef(partName, shapeNameToId);
            if (!resolvedPart.matched && loadedShapes.size > 0) {
                addImportWarning(stats, `group "${name}" references unknown part "${partName}", keeping raw reference.`);
            }
            if (!memberShapeIds.includes(resolvedPart.resolved)) {
                memberShapeIds.push(resolvedPart.resolved);
            }
        });

        const parentRef = toNonEmptyString(entry.parentRef);
        const groupId = nextEntityId('group', importedGroups.length);
        const group: GroupNode = {
            id: groupId,
            name: getUniqueGroupName(name),
            parentGroupId: parentRef ? (groupNameToId.get(parentRef) ?? parentRef) : null,
            childGroupIds: [],
            memberPartIds: memberShapeIds,
            kind: entry.kind === 'default' ? 'default' : 'imported',
            order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : importedGroups.length + 1,
            createdAt: new Date().toISOString()
        };
        importedGroups.push(group);

        if (groupNameToId.has(name)) {
            addImportWarning(stats, `Duplicate group name "${name}" found; latest entry is used for references.`);
        }
        groupNameToId.set(name, groupId);
        stats.groups += 1;
    });

    importedGroups.forEach((group) => {
        if (group.parentGroupId && !getGroupNode(group.parentGroupId) && !groupDesignState.groupsById[group.parentGroupId]) {
            const mappedParentId = groupNameToId.get(group.parentGroupId);
            group.parentGroupId = mappedParentId ?? null;
        }
        upsertGroupNode(group);
    });

    const markerNameToId = new Map<string, string>();
    const frameNameToFrame = new Map<string, { id: string; kind: FrameEntityKind }>();

    const markers = getConfigArray(data, 'marker', stats);
    markers.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `marker[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        if (!name) {
            stats.skipped += 1;
            addImportWarning(stats, `marker[${index}] is missing a valid "name" and was skipped.`);
            return;
        }

        const groupRef = toNonEmptyString(entry.groupRef);
        const partRef = toNonEmptyString(entry.partRef);
        const relatedMarkerRef = toNonEmptyString(entry.relatedMarkerRef) ?? toNonEmptyString(entry.markerRef);
        const refMarkerFlag = entry.refMarker === true || entry.refMarker === 'true' || Boolean(relatedMarkerRef);

        let groupId: string | undefined;
        if (groupRef) {
            groupId = groupNameToId.get(groupRef) ?? shapeNameToId.get(groupRef) ?? groupRef;
            if (!groupNameToId.has(groupRef) && !shapeNameToId.has(groupRef)) {
                addImportWarning(stats, `marker "${name}" references unknown groupRef "${groupRef}", keeping raw reference.`);
            }
        } else if (partRef) {
            const partId = shapeNameToId.get(partRef) ?? partRef;
            groupId = resolveOwningGroupId(partId) ?? partId;
            if (!shapeNameToId.has(partRef) && loadedShapes.size > 0) {
                addImportWarning(stats, `marker "${name}" references unknown partRef "${partRef}", keeping raw reference.`);
            }
        }

        if (!groupId) {
            groupId = getActiveGroupId() ?? resolveOwningGroupId(selectedShapeId ?? undefined) ?? selectedShapeId ?? '__unassigned__';
            addImportWarning(stats, `marker "${name}" has no groupRef/partRef; assigned to "${groupId}".`);
        }

        const parsedPosition = parseVector3(entry.position);
        const parsedDirection = normalizeVector(parseVector3(entry.direction));

        if (entry.position !== undefined && !parsedPosition) {
            addImportWarning(stats, `marker "${name}" has invalid position; defaulting to (0,0,0).`);
        }
        if (entry.direction !== undefined && !parsedDirection) {
            addImportWarning(stats, `marker "${name}" has invalid direction; defaulting to +Z.`);
        }

        if (refMarkerFlag) {
            let relatedMarkerId: string | undefined;
            if (relatedMarkerRef) {
                relatedMarkerId = markerNameToId.get(relatedMarkerRef) ?? relatedMarkerRef;
            }

            const relatedMarker = relatedMarkerId
                ? createdMarkers.find((marker) => marker.id === relatedMarkerId)
                : undefined;
            if (relatedMarkerRef && !relatedMarker) {
                addImportWarning(stats, `ref marker "${name}" references unknown relatedMarkerRef "${relatedMarkerRef}".`);
            }

            const resolvedPosition = parsedPosition
                ?? (relatedMarker ? cloneVec3(relatedMarker.position) : { x: 0, y: 0, z: 0 });
            const resolvedOrientation = parsedDirection
                ? createOrientationFromNormal(parsedDirection)
                : (relatedMarker ? cloneMat3(relatedMarker.orientation) : createOrientationFromNormal({ x: 0, y: 0, z: 1 }));
            const refFrame: MbsRefFrameEntity = {
                id: nextEntityId('refMarker', createdRefFrames.size),
                name,
                groupId: relatedMarker?.groupId ?? groupId,
                position: resolvedPosition,
                orientation: resolvedOrientation,
                relatedMarkerId: relatedMarker?.id ?? relatedMarkerId,
                createdAt: new Date().toISOString()
            };

            createdRefFrames.set(refFrame.id, refFrame);
            if (relatedMarker) {
                relatedMarker.appendRefMarker(refFrame.id);
            }

            if (viewer) {
                viewer.addFrame({
                    id: refFrame.id,
                    name: refFrame.name,
                    position: refFrame.position,
                    orientation: refFrame.orientation,
                    isPrimary: false
                });
            }

            recordFrameCreation(refFrame.id, 'refFrame');
            frameNameToFrame.set(refFrame.name, { id: refFrame.id, kind: 'refFrame' });
        } else {
            const marker = markerCreator.createMarker({
                position: parsedPosition ?? { x: 0, y: 0, z: 0 },
                normal: parsedDirection ?? { x: 0, y: 0, z: 1 },
                groupId,
                name
            });

            createdMarkers.push(marker);
            markerNameToId.set(marker.name, marker.id);
            if (viewer) {
                viewer.addFrame({
                    id: marker.id,
                    name: marker.name,
                    position: marker.position,
                    orientation: marker.orientation,
                    isPrimary: true
                });
            }

            recordFrameCreation(marker.id, 'marker');
            frameNameToFrame.set(marker.name, { id: marker.id, kind: 'marker' });
        }

        if (frameNameToFrame.size > 0 && frameNameToFrame.get(name)?.id) {
            const duplicates = Array.from(frameNameToFrame.keys()).filter((frameName) => frameName === name).length;
            if (duplicates > 1) {
                addImportWarning(stats, `Duplicate marker name "${name}" found; latest entry is used for references.`);
            }
        }
        stats.markers += 1;
    });

    const designPointEntries = getConfigArray(data, 'designPoint', stats);
    designPointEntries.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `designPoint[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        if (!name) {
            stats.skipped += 1;
            addImportWarning(stats, `designPoint[${index}] is missing a valid "name" and was skipped.`);
            return;
        }

        const groupRef = toNonEmptyString(entry.groupRef);
        const markerRef = toNonEmptyString(entry.markerRef);
        let groupId = getActiveGroupId() ?? resolveOwningGroupId(selectedShapeId ?? undefined) ?? selectedShapeId ?? '__unassigned__';

        if (groupRef) {
            groupId = groupNameToId.get(groupRef) ?? shapeNameToId.get(groupRef) ?? groupRef;
            if (!groupNameToId.has(groupRef) && !shapeNameToId.has(groupRef)) {
                addImportWarning(stats, `designPoint "${name}" references unknown groupRef "${groupRef}", keeping raw reference.`);
            }
        }

        let markerRefId: string | undefined;
        if (markerRef) {
            const resolved = frameNameToFrame.get(markerRef);
            markerRefId = resolved?.id ?? markerRef;
            if (!resolved) {
                addImportWarning(stats, `designPoint "${name}" references unknown markerRef "${markerRef}", keeping raw reference.`);
            }
        }

        const parsedPosition = parseVector3(entry.position);
        const parsedDirection = normalizeVector(parseVector3(entry.direction));
        const markerRefEntity = markerRefId
            ? createdMarkers.find((marker) => marker.id === markerRefId)
                ?? createdRefFrames.get(markerRefId)
            : undefined;

        const position = parsedPosition
            ?? (markerRefEntity ? cloneVec3(markerRefEntity.position) : { x: 0, y: 0, z: 0 });
        const sizeValue = typeof entry.size === 'number' && Number.isFinite(entry.size)
            ? entry.size
            : -1;
        const isDirectionReverse = typeof entry.isDirectionReverse === 'boolean'
            ? entry.isDirectionReverse
            : false;
        const offsetValue = typeof entry.offsetValue === 'number' && Number.isFinite(entry.offsetValue)
            ? entry.offsetValue
            : 0;

        const designPoint: MbsDesignPointEntity = {
            id: nextEntityId('designPoint', mbsDesignPoints.size),
            name,
            groupId,
            markerRefId,
            position,
            direction: parsedDirection ?? (markerRefEntity ? orientationToDirection(markerRefEntity.orientation) : undefined),
            size: sizeValue,
            isDirectionReverse,
            offsetValue,
            createdAt: new Date().toISOString()
        };
        mbsDesignPoints.set(designPoint.id, designPoint);
        stats.designPoints += 1;
    });

    const connectors = getConfigArray(data, 'connector', stats);
    connectors.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `connector[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        const connectorType = toNonEmptyString(entry.connectorType);
        const part1 = toNonEmptyString(entry.part1);
        const part2 = toNonEmptyString(entry.part2);

        if (!name || !connectorType || !part1 || !part2) {
            stats.skipped += 1;
            addImportWarning(stats, `connector[${index}] is missing required fields and was skipped.`);
            return;
        }

        const resolvedPart1 = resolveShapeRef(part1, shapeNameToId);
        const resolvedPart2 = resolveShapeRef(part2, shapeNameToId);
        if (!resolvedPart1.matched && loadedShapes.size > 0) {
            addImportWarning(stats, `connector "${name}" references unknown part1 "${part1}", keeping raw reference.`);
        }
        if (!resolvedPart2.matched && loadedShapes.size > 0) {
            addImportWarning(stats, `connector "${name}" references unknown part2 "${part2}", keeping raw reference.`);
        }

        const joint: MbsJointEntity = {
            id: nextEntityId('joint', mbsJoints.size),
            name,
            jointType: connectorType,
            part1: resolvedPart1.resolved,
            part2: resolvedPart2.resolved,
            createdAt: new Date().toISOString()
        };
        mbsJoints.set(joint.id, joint);
        stats.connectors += 1;
    });

    const motions = getConfigArray(data, 'motion', stats);
    motions.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `motion[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        const motionType = toNonEmptyString(entry.motionType);
        const connectorRef = toNonEmptyString(entry.connectorRef);

        if (!name || !motionType || !connectorRef) {
            stats.skipped += 1;
            addImportWarning(stats, `motion[${index}] is missing required fields and was skipped.`);
            return;
        }

        const motion: MbsMotionEntity = {
            id: nextEntityId('motion', mbsMotions.size),
            name,
            motionType,
            connectorRef,
            createdAt: new Date().toISOString()
        };
        mbsMotions.set(motion.id, motion);
        stats.motions += 1;
    });

    const ribSlices = getConfigArray(data, 'ribSlice', stats);
    ribSlices.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `ribSlice[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        if (!name) {
            stats.skipped += 1;
            addImportWarning(stats, `ribSlice[${index}] is missing a valid "name" and was skipped.`);
            return;
        }

        const shapeRefRaw = toNonEmptyString(entry.shapeRef);
        const shapeRef = shapeRefRaw
            ? resolveShapeRef(shapeRefRaw, shapeNameToId).resolved
            : undefined;

        const slice: FluidSliceEntity = {
            id: nextEntityId('slice', fluidSlices.size),
            name,
            shapeRef,
            createdAt: new Date().toISOString()
        };
        fluidSlices.set(slice.id, slice);
        ribSliceNames.add(name);
        stats.ribSlices += 1;
    });

    const fluidPortEntries = getConfigArray(data, 'fluidPort', stats);
    fluidPortEntries.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `fluidPort[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        const portType = toNonEmptyString(entry.portType);
        if (!name || !portType) {
            stats.skipped += 1;
            addImportWarning(stats, `fluidPort[${index}] is missing required fields and was skipped.`);
            return;
        }

        const shapeRefRaw = toNonEmptyString(entry.shapeRef);
        const shapeRef = shapeRefRaw
            ? resolveShapeRef(shapeRefRaw, shapeNameToId).resolved
            : undefined;
        const ribSliceRef = toNonEmptyString(entry.ribSliceRef) ?? undefined;
        if (ribSliceRef && !ribSliceNames.has(ribSliceRef)) {
            addImportWarning(stats, `fluidPort "${name}" references unknown ribSliceRef "${ribSliceRef}".`);
        }

        const port: FluidPortEntity = {
            id: nextEntityId('port', fluidPorts.size),
            name,
            portType,
            shapeRef,
            ribSliceRef,
            createdAt: new Date().toISOString()
        };
        fluidPorts.set(port.id, port);
        stats.fluidPorts += 1;
    });

    updateModelTree();
    setStatus('Ready');
    setStatusInfo(
        `CADTool config imported: groups=${stats.groups}, markers=${stats.markers}, designPoints=${stats.designPoints}, connectors=${stats.connectors}, motions=${stats.motions}`
    );

    const summary = `CADTool config import complete${sourceLabel}: groups=${stats.groups}, markers=${stats.markers}, designPoints=${stats.designPoints}, connectors=${stats.connectors}, motions=${stats.motions}, ribSlices=${stats.ribSlices}, fluidPorts=${stats.fluidPorts}, skipped=${stats.skipped}.`;
    vscode.postMessage({
        command: 'alert',
        text: summary
    });

    if (stats.warningCount > 0) {
        const hiddenWarnings = stats.warningCount - stats.warnings.length;
        const warningText = hiddenWarnings > 0
            ? `${stats.warnings.join(' | ')} | ... and ${hiddenWarnings} more warning(s).`
            : stats.warnings.join(' | ');
        vscode.postMessage({
            command: 'alert',
            text: `CADTool config import warnings (${stats.warningCount}): ${warningText}`
        });
    }
}

function resolvePartRefName(shapeId: string | undefined): string {
    if (!shapeId) {
        return '';
    }
    return loadedShapes.get(shapeId)?.name ?? shapeId;
}

function resolveGroupRefName(groupOrShapeId: string | undefined): string {
    if (!groupOrShapeId) {
        return '';
    }
    const group = mbsGroups.get(groupOrShapeId);
    if (group) {
        return group.name;
    }
    return resolvePartRefName(groupOrShapeId);
}

function buildCadtoolConfigExportData(): CadtoolConfigExportData {
    const frameIdToName = new Map<string, string>();
    createdMarkers.forEach((marker) => frameIdToName.set(marker.id, marker.name));
    createdRefFrames.forEach((refFrame) => frameIdToName.set(refFrame.id, refFrame.name));

    const markerEntries = createdMarkers.map((marker) => ({
        name: marker.name,
        groupRef: resolveGroupRefName(marker.groupId),
        position: cloneVec3(marker.position),
        direction: orientationToDirection(marker.orientation)
    }));

    const refMarkerEntries = Array.from(createdRefFrames.values()).map((refFrame) => ({
        name: refFrame.name,
        groupRef: resolveGroupRefName(refFrame.groupId),
        position: cloneVec3(refFrame.position),
        direction: orientationToDirection(refFrame.orientation),
        refMarker: true,
        relatedMarkerRef: refFrame.relatedMarkerId
            ? (frameIdToName.get(refFrame.relatedMarkerId) ?? refFrame.relatedMarkerId)
            : undefined
    }));

    return {
        group: listGroups().map(group => ({
            name: group.name,
            parts: group.memberPartIds.map(resolvePartRefName),
            parentRef: group.parentGroupId ? (getGroupNode(group.parentGroupId)?.name ?? group.parentGroupId) : null,
            kind: group.kind,
            order: group.order
        })),
        marker: [...markerEntries, ...refMarkerEntries],
        designPoint: Array.from(mbsDesignPoints.values()).map((point) => ({
            name: point.name,
            groupRef: resolveGroupRefName(point.groupId),
            markerRef: point.markerRefId
                ? (frameIdToName.get(point.markerRefId) ?? point.markerRefId)
                : undefined,
            position: cloneVec3(point.position),
            direction: point.direction ? cloneVec3(point.direction) : undefined,
            size: point.size,
            isDirectionReverse: point.isDirectionReverse,
            offsetValue: point.offsetValue
        })),
        connector: Array.from(mbsJoints.values()).map(joint => ({
            name: joint.name,
            connectorType: joint.jointType,
            part1: resolvePartRefName(joint.part1),
            part2: resolvePartRefName(joint.part2)
        })),
        motion: Array.from(mbsMotions.values()).map(motion => ({
            name: motion.name,
            motionType: motion.motionType,
            connectorRef: motion.connectorRef
        })),
        fluidPort: Array.from(fluidPorts.values()).map(port => ({
            name: port.name,
            portType: port.portType,
            ribSliceRef: port.ribSliceRef ?? ''
        })),
        ribSlice: Array.from(fluidSlices.values()).map(slice => ({
            name: slice.name
        })),
        gravity: [],
        medium: []
    };
}

function exportCadtoolConfig(): void {
    setStatus('Preparing CADTool config export...');

    try {
        const exportData = buildCadtoolConfigExportData();
        const jsonData = JSON.stringify(exportData, null, 2);

        vscode.postMessage({
            command: 'exportCadtoolConfig',
            data: jsonData
        });

        setStatus('Ready');
        setStatusInfo(
            `CADTool config exported: groups=${exportData.group.length}, markers=${exportData.marker.length}, designPoints=${exportData.designPoint.length}, connectors=${exportData.connector.length}, motions=${exportData.motion.length}`
        );
    } catch (error) {
        console.error('Failed to export CADTool config:', error);
        setStatus('CADTool config export failed');
        vscode.postMessage({
            command: 'alert',
            text: `Failed to export CADTool config: ${error}`
        });
    }
}

// ============================================================================
// Exploded View Functions
// ============================================================================

/**
 * Calculate bounding box center for a shape hierarchy
 */
function calculateShapeCenter(shape: LoadedShape): { x: number; y: number; z: number } {
    if (!shape.meshData) {
        return { x: 0, y: 0, z: 0 };
    }

    const vertices = shape.meshData.vertices;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
        minX = Math.min(minX, vertices[i]);
        minY = Math.min(minY, vertices[i + 1]);
        minZ = Math.min(minZ, vertices[i + 2]);
        maxX = Math.max(maxX, vertices[i]);
        maxY = Math.max(maxY, vertices[i + 1]);
        maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2
    };
}

/**
 * Calculate assembly center from all root shapes
 */
function calculateAssemblyCenter(): { x: number; y: number; z: number } {
    if (rootShapes.length === 0) {
        return { x: 0, y: 0, z: 0 };
    }

    const centers: Array<{ x: number; y: number; z: number }> = [];

    function collectCenters(shape: LoadedShape): void {
        if (shape.meshData && shape.meshId) {
            centers.push(calculateShapeCenter(shape));
        }
        if (shape.children) {
            shape.children.forEach(collectCenters);
        }
    }

    rootShapes.forEach(collectCenters);

    if (centers.length === 0) {
        return { x: 0, y: 0, z: 0 };
    }

    const sum = centers.reduce(
        (acc, center) => ({
            x: acc.x + center.x,
            y: acc.y + center.y,
            z: acc.z + center.z
        }),
        { x: 0, y: 0, z: 0 }
    );

    return {
        x: sum.x / centers.length,
        y: sum.y / centers.length,
        z: sum.z / centers.length
    };
}

/**
 * Prepare explode data for all meshes
 */
function prepareExplodeData(): void {
    explodeDataMap.clear();

    const assemblyCenter = calculateAssemblyCenter();

    function processShape(shape: LoadedShape): void {
        if (shape.meshData && shape.meshId) {
            const shapeCenter = calculateShapeCenter(shape);

            // Calculate direction from assembly center to shape center
            let dirX = shapeCenter.x - assemblyCenter.x;
            let dirY = shapeCenter.y - assemblyCenter.y;
            let dirZ = shapeCenter.z - assemblyCenter.z;

            // Normalize direction
            const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
            if (length > 0.001) {
                dirX /= length;
                dirY /= length;
                dirZ /= length;
            } else {
                // If at center, use a default direction
                dirX = 0;
                dirY = 0;
                dirZ = 1;
            }

            explodeDataMap.set(shape.meshId, {
                meshId: shape.meshId,
                originalPosition: { x: 0, y: 0, z: 0 }, // Will be filled by viewer
                explodeDirection: { x: dirX, y: dirY, z: dirZ }
            });
        }

        if (shape.children) {
            shape.children.forEach(processShape);
        }
    }

    rootShapes.forEach(processShape);
}

/**
 * Apply explode transform to all meshes
 */
function applyExplode(distance: number): void {
    if (!viewer) return;

    explodeDataMap.forEach((data) => {
        const offset = {
            x: data.explodeDirection.x * distance,
            y: data.explodeDirection.y * distance,
            z: data.explodeDirection.z * distance
        };
        viewer.setMeshPosition(data.meshId, offset);
    });
}

/**
 * Toggle explode view
 */
function toggleExplode(): void {
    const sliderContainer = document.getElementById('explode-slider-container');
    const explodeBtn = document.getElementById('btn-explode');

    if (!sliderContainer || !explodeBtn) return;

    if (!isExploded) {
        // Enter explode mode
        if (rootShapes.length === 0) {
            vscode.postMessage({
                command: 'alert',
                text: 'Please load a model first'
            });
            return;
        }

        isExploded = true;
        sliderContainer.classList.add('show');
        explodeBtn.style.backgroundColor = 'rgba(0, 122, 204, 0.3)';

        prepareExplodeData();
        setStatus('Exploded view mode active');
    } else {
        // Exit explode mode
        isExploded = false;
        sliderContainer.classList.remove('show');
        explodeBtn.style.backgroundColor = '';

        // Reset to zero
        const slider = document.getElementById('explode-slider') as HTMLInputElement;
        if (slider) {
            slider.value = '0';
            explodeDistance = 0;
            updateExplodeValue(0);
        }

        applyExplode(0);
        setStatus('Ready');
    }
}

/**
 * Update explode distance from slider
 */
function updateExplodeDistance(percent: number): void {
    explodeDistance = percent;

    // Calculate actual distance based on model size
    // Use assembly bounding box to determine scale
    const maxDistance = calculateModelScale() * 2;
    const actualDistance = (percent / 100) * maxDistance;

    applyExplode(actualDistance);
    updateExplodeValue(percent);
}

/**
 * Calculate model scale for explosion distance
 */
function calculateModelScale(): number {
    if (rootShapes.length === 0) return 100;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    function processShape(shape: LoadedShape): void {
        if (shape.meshData) {
            const vertices = shape.meshData.vertices;
            for (let i = 0; i < vertices.length; i += 3) {
                minX = Math.min(minX, vertices[i]);
                minY = Math.min(minY, vertices[i + 1]);
                minZ = Math.min(minZ, vertices[i + 2]);
                maxX = Math.max(maxX, vertices[i]);
                maxY = Math.max(maxY, vertices[i + 1]);
                maxZ = Math.max(maxZ, vertices[i + 2]);
            }
        }
        if (shape.children) {
            shape.children.forEach(processShape);
        }
    }

    rootShapes.forEach(processShape);

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;

    return Math.max(sizeX, sizeY, sizeZ);
}

/**
 * Update explode slider value display
 */
function updateExplodeValue(percent: number): void {
    const valueDisplay = document.getElementById('explode-slider-value');
    if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(percent)}%`;
    }
}

// ============================================================================
// Clear Scene
// ============================================================================

function clearScene(): void {
    // Reset worker state before clearing geometry
    massPropertiesWorkerClient.clear();

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
    selectedGroupId = null;
    activeSelectionKey = null;
    selectedNodeIds.clear();
    selectedDensityByShapeId.clear();
    meshIdToShapeId.clear();
    shapeSelectionHistory.length = 0;
    externalModelTreeShapes = [];
    explodeDataMap.clear();
    massPropertiesCoordinator.clear();
    clearCadtoolRuntimeEntities();

    // Reset explode state
    if (isExploded) {
        toggleExplode();
    }

    updateModelTree();
    updatePropertiesPanel(null);
    setStatusInfo('');
    setStatus('Ready');
}

// ============================================================================
// MBS Action Handling
// ============================================================================

function nextEntityId(prefix: string, existingCount: number): string {
    return `${prefix}_${existingCount + 1}`;
}

function activeShapeName(shapeId: string | undefined): string {
    if (!shapeId) {
        return '(none)';
    }
    return loadedShapes.get(shapeId)?.name ?? shapeId;
}

function resolveJointParticipants(): { part1: string; part2: string } | null {
    const recent = shapeSelectionHistory
        .slice()
        .reverse()
        .filter((id, index, arr) => arr.indexOf(id) === index);

    if (recent.length >= 2) {
        return {
            part1: recent[1],
            part2: recent[0]
        };
    }

    if (selectedShapeId && rootShapes.length > 0) {
        const fallback = findFirstRenderableShapeId(rootShapes[0], selectedShapeId);
        if (fallback) {
            return { part1: selectedShapeId, part2: fallback };
        }
    }

    return null;
}

function findFirstRenderableShapeId(shape: LoadedShape, excludedShapeId: string): string | null {
    if (shape.id !== excludedShapeId && shape.meshId) {
        return shape.id;
    }

    if (shape.children) {
        for (const child of shape.children) {
            const found = findFirstRenderableShapeId(child, excludedShapeId);
            if (found) {
                return found;
            }
        }
    }

    return null;
}

function renderCustomProperties(title: string, rows: Array<{ label: string; value: string }>): void {
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) {
        return;
    }

    const lines = [`<div style="margin-bottom: 8px; font-weight: bold; color: #9cdcfe;">${title}</div>`];
    for (const row of rows) {
        lines.push(createPropertyRow(row.label, row.value));
    }

    propsEl.innerHTML = lines.join('');
}

// ============================================================================
// Options Panel Builders
// ============================================================================

function setPanelMode(mode: 'properties' | 'options', title: string): void {
    const headerText = document.getElementById('panel-header-text');
    const closeBtn = document.getElementById('panel-header-close');
    if (headerText) headerText.textContent = title;
    if (closeBtn) closeBtn.style.display = mode === 'options' ? 'inline' : 'none';
}

function buildNameInput(id: string, value: string): string {
    return `<div class="opt-name-row">
        <label for="${id}">名称</label>
        <input id="${id}" class="opt-input" type="text" value="${escapeAttr(value)}" />
    </div>`;
}

function buildSeparator(): string {
    return '<div class="opt-separator"></div>';
}

function buildVec3Input(prefix: string, label: string, x: number, y: number, z: number): string {
    return `<div class="opt-label">${label}</div>
    <div class="opt-vec3-row">
        <div class="opt-vec3-group">
            <span class="opt-vec3-label">X</span>
            <input id="${prefix}-x" class="opt-vec3-input" type="number" step="0.01" value="${x.toFixed(4)}" />
        </div>
        <div class="opt-vec3-group">
            <span class="opt-vec3-label">Y</span>
            <input id="${prefix}-y" class="opt-vec3-input" type="number" step="0.01" value="${y.toFixed(4)}" />
        </div>
        <div class="opt-vec3-group">
            <span class="opt-vec3-label">Z</span>
            <input id="${prefix}-z" class="opt-vec3-input" type="number" step="0.01" value="${z.toFixed(4)}" />
        </div>
    </div>`;
}

function buildDropdown(id: string, label: string, value: string, options: Array<{ value: string; text: string }>): string {
    const optionsHtml = options.map(opt =>
        `<option value="${escapeAttr(opt.value)}"${opt.value === value ? ' selected' : ''}>${opt.text}</option>`
    ).join('');
    return `<div class="opt-row">
        <label for="${id}">${label}</label>
        <select id="${id}" class="opt-dropdown">${optionsHtml}</select>
    </div>`;
}

function buildPartSelector(id: string, label: string, hint: string): string {
    return `<div class="opt-label">${label}</div>
    <div id="${id}" class="opt-part-selector">
        <span>🖱 ${hint}</span>
    </div>`;
}

function buildActionButtons(confirmId: string, confirmText: string, cancelId: string): string {
    return `<div class="opt-btn-row">
        <button id="${cancelId}" class="opt-btn-secondary">取消</button>
        <button id="${confirmId}" class="opt-btn-primary">${confirmText}</button>
    </div>`;
}

function buildModeSwitch(): string {
    return `<div class="opt-mode-row">
        <button class="opt-mode-btn-active" data-mode="fast">⚡ 闪电模式</button>
        <button class="opt-mode-btn" data-mode="standard">📐 标准模式</button>
    </div>`;
}

function buildSectionHeader(text: string): string {
    return `<div class="opt-section-header">${text}</div>`;
}

function buildTabBar(tabs: Array<{ id: string; text: string; active: boolean }>): string {
    const tabsHtml = tabs.map(tab =>
        `<button class="${tab.active ? 'opt-tab-active' : 'opt-tab'}" data-tab="${tab.id}">${tab.text}</button>`
    ).join('');
    return `<div class="opt-tab-bar">${tabsHtml}</div>`;
}

function buildSelectedList(items: Array<{ name: string }>): string {
    if (items.length === 0) {
        return '<div class="opt-selected-list"><div class="opt-hint">暂无已选零件</div></div>';
    }
    const itemsHtml = items.map(item =>
        `<div class="opt-selected-item"><span class="checkmark">✓</span>${item.name}</div>`
    ).join('');
    return `<div class="opt-selected-list">${itemsHtml}</div>`;
}

function closeOptionsPanel(): void {
    setPanelMode('properties', '属性');
    updateSelectionPropertiesPanel();
}

function escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function readVec3FromInputs(prefix: string): Vec3 {
    const x = parseFloat((document.getElementById(`${prefix}-x`) as HTMLInputElement)?.value ?? '0');
    const y = parseFloat((document.getElementById(`${prefix}-y`) as HTMLInputElement)?.value ?? '0');
    const z = parseFloat((document.getElementById(`${prefix}-z`) as HTMLInputElement)?.value ?? '0');
    return { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 0 : y, z: isNaN(z) ? 0 : z };
}

// ============================================================================
// Options Panel Renderers
// ============================================================================

function renderGroupOptionsPanel(selectedParts: LoadedShape[], parentGroupId: string | null = null): void {
    setPanelMode('options', '选项-组合');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    const defaultName = `Group${mbsGroups.size + 1}`;
    const partItems = selectedParts.map(s => ({ name: s.name }));
    const parentGroupName = parentGroupId ? (getGroupNode(parentGroupId)?.name ?? parentGroupId) : '(root)';

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-group-name', defaultName)}
        ${buildSeparator()}
        <div class="opt-label">目标父组：${parentGroupName}</div>
        ${buildSeparator()}
        <div class="opt-label">已选中零件：${selectedParts.length}</div>
        ${buildSelectedList(partItems)}
        ${buildSeparator()}
        ${buildActionButtons('opt-group-confirm', '确认组合', 'opt-group-cancel')}
    </div>`;

    document.getElementById('opt-group-confirm')?.addEventListener('click', () => {
        const nameInput = document.getElementById('opt-group-name') as HTMLInputElement;
        const name = nameInput?.value?.trim() || defaultName;
        const memberShapeIds = selectedParts.map(s => s.id);
        const group = createGroupFromParts(name, memberShapeIds, parentGroupId, 'manual');

        setStatusInfo(`Group created: ${name}`);
        updateModelTree();
        closeOptionsPanel();
        vscode.postMessage({
            command: 'alert',
            text: `Created group "${group.name}" with ${memberShapeIds.length} member(s).`
        });
    });

    document.getElementById('opt-group-cancel')?.addEventListener('click', () => {
        closeOptionsPanel();
    });
}

function renderMoveOptionsPanel(): void {
    setPanelMode('options', '选项-移动');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) {
        return;
    }

    const selectedGroupIds = getTopLevelSelectedGroupIds(getSelectedGroupIds());
    const selectedPartItems = getSelectedShapeIds()
        .map((shapeId) => loadedShapes.get(shapeId))
        .filter((shape): shape is LoadedShape => Boolean(shape))
        .map((shape) => ({ name: `零件: ${shape.name}` }));
    const selectedGroupItems = selectedGroupIds
        .map((groupId) => getGroupNode(groupId))
        .filter((group): group is GroupNode => Boolean(group))
        .map((group) => ({ name: `分组: ${group.name}` }));
    const selectedItems = [...selectedGroupItems, ...selectedPartItems];
    const moveTargetOptions = buildMoveTargetOptions(selectedGroupIds);

    propsEl.innerHTML = `<div class="opt-section">
        ${buildDropdown('opt-move-target', '目标位置', '__root__', moveTargetOptions)}
        ${buildSeparator()}
        <div class="opt-label">待移动对象：${selectedItems.length}</div>
        ${buildSelectedList(selectedItems)}
        ${buildSeparator()}
        ${buildActionButtons('opt-move-confirm', '确认移动', 'opt-move-cancel')}
    </div>`;

    document.getElementById('opt-move-confirm')?.addEventListener('click', () => {
        const targetSelect = document.getElementById('opt-move-target') as HTMLSelectElement | null;
        const targetValue = targetSelect?.value ?? '__root__';
        const targetGroupId = targetValue === '__root__' ? null : targetValue;

        try {
            const result = moveSelectedNodesToGroup(targetGroupId);
            updateModelTree();
            closeOptionsPanel();
            setStatusInfo(`Moved ${result.movedParts} part(s) and ${result.movedGroups} group(s).`);
        } catch (error) {
            vscode.postMessage({
                command: 'alert',
                text: error instanceof Error ? error.message : `Move failed: ${error}`
            });
        }
    });

    document.getElementById('opt-move-cancel')?.addEventListener('click', () => {
        closeOptionsPanel();
    });
}

function renderRenameGroupOptionsPanel(): void {
    const group = getGroupNode(getActiveGroupId());
    if (!group) {
        vscode.postMessage({
            command: 'alert',
            text: 'Select a group first.'
        });
        return;
    }

    setPanelMode('options', '选项-重命名');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) {
        return;
    }

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-rename-group-name', group.name)}
        ${buildSeparator()}
        <div class="opt-label">当前分组：${group.name}</div>
        ${buildSeparator()}
        ${buildActionButtons('opt-rename-group-confirm', '确认重命名', 'opt-rename-group-cancel')}
    </div>`;

    document.getElementById('opt-rename-group-confirm')?.addEventListener('click', () => {
        const nameInput = document.getElementById('opt-rename-group-name') as HTMLInputElement | null;
        const requestedName = nameInput?.value ?? group.name;

        try {
            const renamedGroup = renameSelectedGroup(requestedName);
            updateModelTree();
            closeOptionsPanel();
            setStatusInfo(`Group renamed: ${renamedGroup.name}`);
        } catch (error) {
            vscode.postMessage({
                command: 'alert',
                text: error instanceof Error ? error.message : `Rename failed: ${error}`
            });
        }
    });

    document.getElementById('opt-rename-group-cancel')?.addEventListener('click', () => {
        closeOptionsPanel();
    });
}

function renderFrameOptionsPanel(title: string, name: string, position: Vec3, direction: Vec3): void {
    setPanelMode('options', title);
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-frame-name', name)}
        ${buildSeparator()}
        ${buildVec3Input('opt-pos', '位置（全局坐标）', position.x, position.y, position.z)}
        ${buildSeparator()}
        ${buildVec3Input('opt-dir', '方向（Rx/Ry/Rz °）', direction.x, direction.y, direction.z)}
        ${buildSeparator()}
        <div class="opt-hint">💡 智能推断已开启</div>
        ${buildSeparator()}
        ${buildModeSwitch()}
    </div>`;

    bindModeSwitchEvents(propsEl);
}

function renderDesignPointOptionsPanel(name: string, position: Vec3): void {
    setPanelMode('options', '选项-设计点');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-dp-name', name)}
        ${buildSeparator()}
        ${buildTabBar([
            { id: 'pick', text: '拾取', active: true },
            { id: 'calc', text: '计算', active: false }
        ])}
        ${buildSeparator()}
        ${buildVec3Input('opt-dp-pos', '位置', position.x, position.y, position.z)}
        ${buildSeparator()}
        ${buildModeSwitch()}
    </div>`;

    bindModeSwitchEvents(propsEl);
    bindTabBarEvents(propsEl);
}

const JOINT_TYPE_OPTIONS: Array<{ value: string; text: string }> = [
    { value: 'Revolute', text: 'Revolute（旋转）' },
    { value: 'Prismatic', text: 'Prismatic（平移）' },
    { value: 'Cylindrical', text: 'Cylindrical（圆柱）' },
    { value: 'Spherical', text: 'Spherical（球）' },
    { value: 'Universal', text: 'Universal（万向）' },
    { value: 'Screw', text: 'Screw（螺旋）' },
    { value: 'Planar', text: 'Planar（平面）' },
    { value: 'Fixed', text: 'Fixed（固定）' }
];

function renderJointOptionsPanel(name: string, jointType: string, part1Name: string, part2Name: string, position: Vec3, direction: Vec3): void {
    setPanelMode('options', '选项-连接');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-joint-name', name)}
        ${buildDropdown('opt-joint-type', '类型', jointType, JOINT_TYPE_OPTIONS)}
        ${buildSeparator()}
        <div class="opt-label" style="color: #DC2626; font-weight: 500;">零件 1</div>
        <div id="opt-joint-part1" class="opt-part-selector${part1Name ? ' has-value' : ''}">
            <span>${part1Name || '🖱 点击选择零件 1'}</span>
        </div>
        <div class="opt-label" style="color: #2563EB; font-weight: 500;">零件 2</div>
        <div id="opt-joint-part2" class="opt-part-selector${part2Name ? ' has-value' : ''}">
            <span>${part2Name || '🖱 点击选择零件 2'}</span>
        </div>
        ${buildSeparator()}
        ${buildVec3Input('opt-joint-pos', '位置', position.x, position.y, position.z)}
        ${buildVec3Input('opt-joint-dir', '方向', direction.x, direction.y, direction.z)}
        ${buildSeparator()}
        ${buildModeSwitch()}
    </div>`;

    bindModeSwitchEvents(propsEl);
}

const MOTION_TYPE_OPTIONS: Array<{ value: string; text: string }> = [
    { value: 'constant', text: '匀速运动' },
    { value: 'sinusoidal', text: '正弦运动' },
    { value: 'ramp', text: '斜坡运动' },
    { value: 'custom', text: '自定义' }
];

function renderMotionOptionsPanel(name: string, motionType: string, connectorRef: string): void {
    setPanelMode('options', '选项-驱动');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-motion-name', name)}
        ${buildDropdown('opt-motion-type', '类型', motionType, MOTION_TYPE_OPTIONS)}
        ${buildSeparator()}
        <div class="opt-label">连接器</div>
        <div id="opt-motion-connector" class="opt-part-selector${connectorRef ? ' has-value' : ''}">
            <span>${connectorRef || '🖱 选择连接器'}</span>
        </div>
        ${buildSeparator()}
        ${buildSectionHeader('驱动参数')}
        <div class="opt-row">
            <label for="opt-motion-phi">phi.start</label>
            <input id="opt-motion-phi" class="opt-input" type="number" step="0.01" value="0" />
        </div>
        <div class="opt-row">
            <label for="opt-motion-w">w.start</label>
            <input id="opt-motion-w" class="opt-input" type="number" step="0.01" value="0" />
        </div>
        ${buildSeparator()}
        ${buildModeSwitch()}
    </div>`;

    bindModeSwitchEvents(propsEl);
}

function collectLeafShapeIds(shapes: LoadedShape[]): string[] {
    const result: string[] = [];
    const visit = (shape: LoadedShape): void => {
        if (shape.children && shape.children.length > 0) {
            shape.children.forEach(visit);
            return;
        }
        result.push(shape.id);
    };
    shapes.forEach(visit);
    return result;
}

function handleCreateGroup(parentGroupId: string | null = null): void {
    const selectedParts = getSelectedShapeIds()
        .map((shapeId) => loadedShapes.get(shapeId))
        .filter((shape): shape is LoadedShape => Boolean(shape));
    if (selectedParts.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'Select one or more parts first.'
        });
        return;
    }
    renderGroupOptionsPanel(selectedParts, parentGroupId);
}

function handleMoveToGroup(): void {
    const selectedShapeIds = getSelectedShapeIds();
    const selectedGroupIds = getTopLevelSelectedGroupIds(getSelectedGroupIds());
    if (selectedShapeIds.length === 0 && selectedGroupIds.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'Select one or more parts/groups first.'
        });
        return;
    }
    renderMoveOptionsPanel();
}

function handleRenameGroup(): void {
    const group = getGroupNode(getActiveGroupId());
    if (!group) {
        vscode.postMessage({
            command: 'alert',
            text: 'Select a group first.'
        });
        return;
    }
    renderRenameGroupOptionsPanel();
}

function handleCreateDefaultGroup(): void {
    syncUngroupedPartIds();
    const memberShapeIds = [...groupDesignState.ungroupedPartIds];
    if (memberShapeIds.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'No ungrouped parts available for default grouping.'
        });
        return;
    }

    const group = createGroupFromParts(`DefaultGroup${mbsGroups.size + 1}`, memberShapeIds, null, 'default');
    updateModelTree();
    setStatusInfo(`Default group created: ${group.memberPartIds.length} parts`);
}

function handleCleanGroup(): void {
    const blockedIds = new Set<string>();
    let removedCount = 0;

    while (true) {
        const removable = listGroups().filter((group) => group.childGroupIds.length === 0 && group.memberPartIds.length === 0);
        const nextRemovable = removable.filter((group) => {
            if (isGroupReferenced(group.id)) {
                blockedIds.add(group.id);
                return false;
            }
            return true;
        });
        if (nextRemovable.length === 0) {
            break;
        }
        nextRemovable.forEach((group) => {
            if (removeGroupById(group.id)) {
                removedCount += 1;
            }
        });
    }
    updateModelTree();
    if (blockedIds.size > 0) {
        vscode.postMessage({
            command: 'alert',
            text: `Skipped ${blockedIds.size} referenced empty group(s).`
        });
    }
    setStatusInfo(`Empty groups cleaned: ${removedCount}`);
}

function handleGroupProperties(): void {
    const target = getGroupNode(getActiveGroupId());
    if (!target) {
        vscode.postMessage({
            command: 'alert',
            text: 'Select a group first.'
        });
        return;
    }
    renderSelectedGroupProperties(target.id);
}

function handleUngroupGroup(): void {
    try {
        const result = ungroupSelectedGroup();
        updateModelTree();
        setStatusInfo(`Ungrouped: moved ${result.movedParts} part(s) and ${result.movedGroups} child group(s).`);
    } catch (error) {
        vscode.postMessage({
            command: 'alert',
            text: error instanceof Error ? error.message : `Ungroup failed: ${error}`
        });
    }
}

function handleCreateJoint(jointType: string): void {
    const participants = resolveJointParticipants();
    const part1Name = participants ? activeShapeName(participants.part1) : '';
    const part2Name = participants ? activeShapeName(participants.part2) : '';
    const name = `${jointType || 'joint'}_${mbsJoints.size + 1}`;
    const position: Vec3 = { x: 0, y: 0, z: 0 };
    const direction: Vec3 = { x: 0, y: 0, z: 1 };

    renderJointOptionsPanel(name, jointType || 'Revolute', part1Name, part2Name, position, direction);
}

function handleCreateMotion(motionType: string): void {
    const latestJoint = Array.from(mbsJoints.values()).at(-1);
    const connectorRef = latestJoint?.name ?? '';
    const name = `${motionType || 'motion'}_${mbsMotions.size + 1}`;

    renderMotionOptionsPanel(name, motionType || 'constant', connectorRef);
}

function handleMotionProperties(): void {
    const target = Array.from(mbsMotions.values()).at(-1);
    if (!target) {
        vscode.postMessage({
            command: 'alert',
            text: 'No motion available. Please create a motion first.'
        });
        return;
    }

    renderCustomProperties('Motion Properties', [
        { label: 'ID', value: target.id },
        { label: 'Name', value: target.name },
        { label: 'Motion Type', value: target.motionType },
        { label: 'Connector Ref', value: target.connectorRef },
        { label: 'Created', value: target.createdAt }
    ]);
}

function runExportCheck(): void {
    const issues: string[] = [];
    if (rootShapes.length === 0 && externalModelTreeShapes.length === 0) {
        issues.push('No model loaded');
    }
    if (mbsJoints.size === 0) {
        issues.push('No connections configured');
    }
    if (mbsMotions.size === 0) {
        issues.push('No motions configured');
    }

    if (issues.length === 0) {
        const okText = 'Export check passed.';
        setStatusInfo(okText);
        vscode.postMessage({ command: 'alert', text: okText });
        return;
    }

    const issueText = `Export check found ${issues.length} issue(s): ${issues.join('; ')}`;
    setStatusInfo(issueText);
    vscode.postMessage({ command: 'alert', text: issueText });
}

function handleCreateFluidTankSlice(): void {
    const id = nextEntityId('slice', fluidSlices.size);
    const slice: FluidSliceEntity = {
        id,
        name: `RibSlice${fluidSlices.size + 1}`,
        shapeRef: selectedShapeId ?? undefined,
        createdAt: new Date().toISOString()
    };
    fluidSlices.set(id, slice);

    updateModelTree();
    setStatusInfo(`Fluid slice created: ${slice.name}`);
    renderCustomProperties('Fluid Slice Properties', [
        { label: 'ID', value: slice.id },
        { label: 'Name', value: slice.name },
        { label: 'Shape Ref', value: activeShapeName(slice.shapeRef) },
        { label: 'Created', value: slice.createdAt }
    ]);
}

function handleCreateFluidPort(): void {
    const latestSlice = Array.from(fluidSlices.values()).at(-1);
    const id = nextEntityId('port', fluidPorts.size);
    const port: FluidPortEntity = {
        id,
        name: `FluidPort${fluidPorts.size + 1}`,
        portType: 'variableTankGasPort',
        shapeRef: selectedShapeId ?? undefined,
        ribSliceRef: latestSlice?.name,
        createdAt: new Date().toISOString()
    };
    fluidPorts.set(id, port);

    updateModelTree();
    setStatusInfo(`Fluid port created: ${port.name}`);
    renderCustomProperties('Fluid Port Properties', [
        { label: 'ID', value: port.id },
        { label: 'Name', value: port.name },
        { label: 'Port Type', value: port.portType },
        { label: 'Shape Ref', value: activeShapeName(port.shapeRef) },
        { label: 'Rib Slice Ref', value: port.ribSliceRef ?? '(none)' },
        { label: 'Created', value: port.createdAt }
    ]);
}

function handleMeasureTool(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a shape first.'
        });
        return;
    }

    const shape = loadedShapes.get(selectedShapeId);
    if (!shape?.meshData) {
        vscode.postMessage({
            command: 'alert',
            text: 'Selected shape has no mesh data.'
        });
        return;
    }

    const bbox = computeBoundingBox(shape.meshData.vertices);
    renderCustomProperties('Measurement', [
        { label: 'Shape', value: shape.name },
        { label: 'Size X', value: bbox.size.x.toFixed(3) },
        { label: 'Size Y', value: bbox.size.y.toFixed(3) },
        { label: 'Size Z', value: bbox.size.z.toFixed(3) },
        { label: 'Min', value: `${bbox.min.x.toFixed(3)}, ${bbox.min.y.toFixed(3)}, ${bbox.min.z.toFixed(3)}` },
        { label: 'Max', value: `${bbox.max.x.toFixed(3)}, ${bbox.max.y.toFixed(3)}, ${bbox.max.z.toFixed(3)}` }
    ]);
    setStatusInfo(`Measured shape: ${shape.name}`);
}

function handleSurfaceThicken(): void {
    if (!selectedShapeId) {
        vscode.postMessage({ command: 'alert', text: 'Please select a shape before surface thickening.' });
        return;
    }
    const shape = loadedShapes.get(selectedShapeId);
    setStatusInfo(`Surface thickening target: ${shape?.name ?? selectedShapeId}`);
}

function handlePlanarRingProcess(): void {
    if (!selectedShapeId) {
        vscode.postMessage({ command: 'alert', text: 'Please select a shape before planar ring processing.' });
        return;
    }
    const shape = loadedShapes.get(selectedShapeId);
    setStatusInfo(`Planar ring process target: ${shape?.name ?? selectedShapeId}`);
}

function computeBoundingBox(vertices: Float32Array): {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
} {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
        minX = Math.min(minX, vertices[i]);
        minY = Math.min(minY, vertices[i + 1]);
        minZ = Math.min(minZ, vertices[i + 2]);
        maxX = Math.max(maxX, vertices[i]);
        maxY = Math.max(maxY, vertices[i + 1]);
        maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    return {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    };
}

/**
 * Start marker creation mode
 */
function startMarkerCreation(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a part first to create a marker'
        });
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'createMarker';
    setStatus('Click on a face to create marker');
    setStatusInfo('Marker creation mode active');
    setCanvasCursor('crosshair');

    vscode.postMessage({
        command: 'alert',
        text: 'Click on a face to place the marker. The Z-axis will point outward along the face normal.'
    });
}

/**
 * Start reference marker creation mode
 */
function startRefFrameCreation(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a part first to create a reference marker.'
        });
        return;
    }
    if (createdMarkers.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please create a basic marker first before creating a reference marker.'
        });
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'createRefFrame';
    setStatus('Click on a face to create reference marker');
    setStatusInfo('Reference marker creation mode active');
    setCanvasCursor('crosshair');

    vscode.postMessage({
        command: 'alert',
        text: 'Click on a face to place the reference marker. It will be linked to the latest basic marker.'
    });
}

/**
 * Start design point creation mode
 */
function startDesignPointCreation(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a part first to create a design point.'
        });
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'createDesignPoint';
    setStatus('Click on a face to create design point');
    setStatusInfo('Design point creation mode active');
    setCanvasCursor('crosshair');

    vscode.postMessage({
        command: 'alert',
        text: 'Click on a face to place the design point.'
    });
}

/**
 * Start frame editing mode
 */
function startFrameEditMode(): void {
    if (!selectedShapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a part first to edit a frame.'
        });
        return;
    }

    const target = resolveLatestExistingFrameFromHistory();
    if (!target) {
        vscode.postMessage({
            command: 'alert',
            text: 'No frame available to edit. Please create a marker or reference marker first.'
        });
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'editFrame';
    editingFrameTarget = { id: target.id, kind: target.kind };
    setStatus('Click on a face to reposition the frame');
    setStatusInfo(`Editing ${target.kind === 'marker' ? 'marker' : 'reference marker'}: ${target.id}`);
    setCanvasCursor('crosshair');
}

function resolveFacePlacement(event: MouseEvent): { selectedShape: LoadedShape; position: Vec3; normal: Vec3 } | null {
    if (!viewer || !occt || !selectedShapeId) {
        return null;
    }

    const selectedShape = loadedShapes.get(selectedShapeId);
    if (!selectedShape || !selectedShape.shapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Selected part has no geometry to place marker/design point.'
        });
        return null;
    }

    const container = document.getElementById('canvas-container');
    if (!container) {
        return null;
    }

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const ray = viewer.getRayFromScreenPoint(x, y);
    if (!ray) {
        console.warn('Failed to get ray from screen point');
        return null;
    }

    const result = occt.getFaceNormalAtPoint(
        selectedShape.shapeId,
        ray.origin,
        ray.direction
    );

    if (!result) {
        vscode.postMessage({
            command: 'alert',
            text: 'No face found at click position. Please click on a face.'
        });
        return null;
    }

    return {
        selectedShape,
        position: cloneVec3(result.position),
        normal: cloneVec3(result.normal)
    };
}

function createMarkerFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): void {
    const marker = markerCreator.createMarker({
        position,
        normal,
        groupId: resolveOwningGroupId(selectedShape.id) ?? selectedShape.id,
        name: `Marker${createdMarkers.length + 1}`
    });

    createdMarkers.push(marker);
    recordFrameCreation(marker.id, 'marker');

    if (viewer) {
        viewer.addFrame({
            id: marker.id,
            name: marker.name,
            position: marker.position,
            orientation: marker.orientation,
            isPrimary: true
        });
    }

    renderFrameOptionsPanel('Edit Frame', marker.name,
        marker.position,
        orientationToDirection(marker.orientation));
    setStatusInfo(`Marker created: ${marker.name}`);
    vscode.postMessage({
        command: 'alert',
        text: `Marker "${marker.name}" created successfully at position (${marker.position.x.toFixed(2)}, ${marker.position.y.toFixed(2)}, ${marker.position.z.toFixed(2)})`
    });
}

function createRefFrameFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): boolean {
    const relatedMarker = createdMarkers.at(-1);
    if (!relatedMarker) {
        vscode.postMessage({
            command: 'alert',
            text: 'No basic marker found. Please create a basic marker first.'
        });
        return false;
    }

    const refFrame: MbsRefFrameEntity = {
        id: nextEntityId('refMarker', createdRefFrames.size),
        name: `RefMarker${createdRefFrames.size + 1}`,
        groupId: resolveOwningGroupId(selectedShape.id) ?? selectedShape.id,
        position: cloneVec3(position),
        orientation: createOrientationFromNormal(normal),
        relatedMarkerId: relatedMarker.id,
        createdAt: new Date().toISOString()
    };
    createdRefFrames.set(refFrame.id, refFrame);
    relatedMarker.appendRefMarker(refFrame.id);
    recordFrameCreation(refFrame.id, 'refFrame');

    if (viewer) {
        viewer.addFrame({
            id: refFrame.id,
            name: refFrame.name,
            position: refFrame.position,
            orientation: refFrame.orientation,
            isPrimary: false
        });
    }

    renderFrameOptionsPanel('Edit Frame', refFrame.name,
        refFrame.position,
        orientationToDirection(refFrame.orientation));
    setStatusInfo(`Reference marker created: ${refFrame.name}`);
    vscode.postMessage({
        command: 'alert',
        text: `Reference marker "${refFrame.name}" created and linked to "${relatedMarker.name}".`
    });
    return true;
}

function createDesignPointFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): void {
    const latestFrame = resolveLatestExistingFrameFromHistory();
    const designPoint: MbsDesignPointEntity = {
        id: nextEntityId('designPoint', mbsDesignPoints.size),
        name: `DesignPoint${mbsDesignPoints.size + 1}`,
        groupId: resolveOwningGroupId(selectedShape.id) ?? selectedShape.id,
        position: cloneVec3(position),
        direction: normalizeVector(cloneVec3(normal)) ?? { x: 0, y: 0, z: 1 },
        markerRefId: latestFrame?.id,
        size: -1,
        isDirectionReverse: false,
        offsetValue: 0,
        createdAt: new Date().toISOString()
    };
    mbsDesignPoints.set(designPoint.id, designPoint);

    renderDesignPointOptionsPanel(designPoint.name, designPoint.position);
    setStatusInfo(`Design point created: ${designPoint.name}`);
    vscode.postMessage({
        command: 'alert',
        text: `Design point "${designPoint.name}" created successfully.`
    });
}

function editFrameFromPlacement(position: Vec3, normal: Vec3): boolean {
    const target = editingFrameTarget;
    if (!target || !viewer) {
        vscode.postMessage({
            command: 'alert',
            text: 'No frame selected for editing.'
        });
        return false;
    }

    const orientation = createOrientationFromNormal(normal);
    if (target.kind === 'marker') {
        const marker = createdMarkers.find((item) => item.id === target.id);
        if (!marker) {
            vscode.postMessage({
                command: 'alert',
                text: 'Selected marker no longer exists.'
            });
            return false;
        }

        marker.setPosition(position.x, position.y, position.z);
        marker.setOrientation(orientation);
        viewer.updateFrame({
            id: marker.id,
            name: marker.name,
            position: marker.position,
            orientation: marker.orientation,
            isPrimary: true
        });

        setStatusInfo(`Marker edited: ${marker.name}`);
        renderFrameOptionsPanel('Edit Frame', marker.name,
            marker.position,
            orientationToDirection(marker.orientation));
        vscode.postMessage({
            command: 'alert',
            text: `Marker "${marker.name}" updated.`
        });
        return true;
    }

    const refFrame = createdRefFrames.get(target.id);
    if (!refFrame) {
        vscode.postMessage({
            command: 'alert',
            text: 'Selected reference marker no longer exists.'
        });
        return false;
    }

    refFrame.position = cloneVec3(position);
    refFrame.orientation = orientation;
    viewer.updateFrame({
        id: refFrame.id,
        name: refFrame.name,
        position: refFrame.position,
        orientation: refFrame.orientation,
        isPrimary: false
    });

    setStatusInfo(`Reference marker edited: ${refFrame.name}`);
    renderFrameOptionsPanel('Edit Frame', refFrame.name,
        refFrame.position,
        orientationToDirection(refFrame.orientation));
    vscode.postMessage({
        command: 'alert',
        text: `Reference marker "${refFrame.name}" updated.`
    });
    return true;
}

/**
 * Handle click on canvas for marker/ref marker/design point/frame editing
 */
function handleCanvasClick(event: MouseEvent): void {
    if (canvasInteractionMode === 'none') return;

    const placement = resolveFacePlacement(event);
    if (!placement) return;

    let completed = false;
    switch (canvasInteractionMode) {
        case 'createMarker':
            createMarkerFromPlacement(placement.selectedShape, placement.position, placement.normal);
            completed = true;
            break;
        case 'createRefFrame':
            completed = createRefFrameFromPlacement(placement.selectedShape, placement.position, placement.normal);
            break;
        case 'createDesignPoint':
            createDesignPointFromPlacement(placement.selectedShape, placement.position, placement.normal);
            completed = true;
            break;
        case 'editFrame':
            completed = editFrameFromPlacement(placement.position, placement.normal);
            break;
        default:
            break;
    }

    if (completed) {
        resetCanvasInteraction();
        setStatus('Ready');
    }
}

function handleMbsAction(action: string, params: Record<string, unknown>): void {
    console.log('[MBS Action]', action, params);

    switch (action) {
        case 'createGroup': {
            handleCreateGroup();
            break;
        }
        case 'createChildGroup': {
            const parentGroupId = getActiveGroupId();
            if (!parentGroupId) {
                vscode.postMessage({
                    command: 'alert',
                    text: 'Select a parent group first.'
                });
                return;
            }
            handleCreateGroup(parentGroupId);
            break;
        }
        case 'renameGroup': {
            handleRenameGroup();
            break;
        }
        case 'moveToGroup': {
            handleMoveToGroup();
            break;
        }
        case 'ungroupGroup': {
            handleUngroupGroup();
            break;
        }
        case 'deleteSelection': {
            handleDeleteSelection();
            break;
        }
        case 'createDefaultGroup': {
            handleCreateDefaultGroup();
            break;
        }
        case 'cleanGroup': {
            handleCleanGroup();
            break;
        }
        case 'groupProperties': {
            handleGroupProperties();
            break;
        }
        case 'createFrame': {
            startMarkerCreation();
            break;
        }
        case 'createRefFrame': {
            startRefFrameCreation();
            break;
        }
        case 'createDesignPoint': {
            startDesignPointCreation();
            break;
        }
        case 'editFrame': {
            startFrameEditMode();
            break;
        }
        case 'deleteFrame': {
            const target = resolveLatestExistingFrameFromHistory();
            if (!target) {
                vscode.postMessage({
                    command: 'alert',
                    text: 'No marker or reference marker to delete.'
                });
                return;
            }

            if (target.kind === 'marker') {
                const markerIndex = createdMarkers.findIndex((marker) => marker.id === target.id);
                if (markerIndex < 0) {
                    frameCreationHistory.splice(target.index, 1);
                    return;
                }

                const marker = createdMarkers[markerIndex];
                if (marker.relatedRefMarkerIds.length > 0) {
                    vscode.postMessage({
                        command: 'alert',
                        text: `Marker "${marker.name}" has reference markers and cannot be deleted.`
                    });
                    return;
                }

                createdMarkers.splice(markerIndex, 1);
                mbsDesignPoints.forEach((point) => {
                    if (point.markerRefId === marker.id) {
                        point.markerRefId = undefined;
                    }
                });

                if (viewer) {
                    viewer.removeFrame(marker.id);
                }
                frameCreationHistory.splice(target.index, 1);
                setStatusInfo(`Marker deleted: ${marker.name}`);
                vscode.postMessage({
                    command: 'alert',
                    text: `Marker "${marker.name}" deleted.`
                });
                break;
            }

            const refFrame = createdRefFrames.get(target.id);
            if (!refFrame) {
                frameCreationHistory.splice(target.index, 1);
                return;
            }

            if (refFrame.relatedMarkerId) {
                const parentMarker = createdMarkers.find((marker) => marker.id === refFrame.relatedMarkerId);
                parentMarker?.removeRefMarker(refFrame.id);
            }
            createdRefFrames.delete(refFrame.id);
            mbsDesignPoints.forEach((point) => {
                if (point.markerRefId === refFrame.id) {
                    point.markerRefId = undefined;
                }
            });
            if (viewer) {
                viewer.removeFrame(refFrame.id);
            }
            frameCreationHistory.splice(target.index, 1);
            setStatusInfo(`Reference marker deleted: ${refFrame.name}`);
            vscode.postMessage({
                command: 'alert',
                text: `Reference marker "${refFrame.name}" deleted.`
            });
            break;
        }
        case 'createJoint': {
            const jointType = params.jointType as string;
            handleCreateJoint(jointType);
            break;
        }
        case 'createMotion': {
            const motionType = params.motionType as string;
            handleCreateMotion(motionType);
            break;
        }
        case 'motionProperties': {
            handleMotionProperties();
            break;
        }
        case 'fluidTankSlice': {
            handleCreateFluidTankSlice();
            break;
        }
        case 'fluidPort': {
            handleCreateFluidPort();
            break;
        }
        case 'measureTool': {
            handleMeasureTool();
            break;
        }
        case 'surfaceThicken': {
            handleSurfaceThicken();
            break;
        }
        case 'planarRingProcess': {
            handlePlanarRingProcess();
            break;
        }
        default: {
            console.log('Unknown MBS action:', action);
        }
    }
}
// ============================================================================
// Message Handling
// ============================================================================

function handleMessage(event: MessageEvent): void {
    const message = event.data;
    switch (message.command) {
        case 'loadStepFile':
            loadStepFile(message.fileName, message.fileContent);
            break;
        case 'fitView':
            viewer?.fitToView();
            break;
        case 'setStatus':
            setStatus(message.text);
            break;
        case 'updateModelTree':
            externalModelTreeShapes = Array.isArray(message.shapes)
                ? message.shapes
                    .filter((item: unknown): item is { id: string; name: string } => {
                        if (!item || typeof item !== 'object') {
                            return false;
                        }
                        const id = (item as { id?: unknown }).id;
                        const name = (item as { name?: unknown }).name;
                        return typeof id === 'string' && typeof name === 'string';
                    })
                : [];
            updateModelTree();
            break;
        case 'updateProperties':
            updatePropertiesPanel(message.shapeId);
            break;
        case 'mbsAction':
            handleMbsAction(message.action, message);
            break;
        case 'requestCadtoolConfigExport':
            exportCadtoolConfig();
            break;
        case 'importCadtoolConfig':
            importCadtoolConfig(
                message.data,
                typeof message.fileName === 'string' ? message.fileName : undefined
            );
            break;
    }
}

// ============================================================================
// Initialization
// ============================================================================

async function initViewer(): Promise<void> {
    const container = document.getElementById('canvas-container');
    if (container) {
        const config = normalizeRenderConfig(renderConfig);
        renderConfig = config;

        viewer = new ThreeViewer(container, {
            backgroundColor: 0x2a2a2a,
            enableSelection: true,
            selectionOptions: {
                highlightColor: 0x58a6ff,
                highlightOpacity: 0.32
            },
            visualPreset: config.visualPreset
        });

        // Listen for selection changes from 3D viewer
        viewer.onSelectionChange((event) => {
            if (isSyncingViewerSelection) {
                return;
            }
            if (event.type === 'select' && event.objectId) {
                syncSelectionFromViewer(event.objectId);
            } else if (event.type === 'deselect') {
                syncSelectionFromViewer(null);
            }
        });

        // Add click listener for marker creation
        container.addEventListener('click', handleCanvasClick);

        applyRenderConfigToViewer();
    }
}

async function init(): Promise<void> {
    if (isInitialized) return;

    setStatus('Initializing...');

    try {
        // Initialize viewer
        await initViewer();

        // Initialize OCCT in background
        initOcct().catch(err => {
            console.warn('OCCT initialization deferred:', err);
        });

        isInitialized = true;
        setStatus('Ready');

        // Notify extension that webview is ready
        vscode.postMessage({ command: 'ready' });

    } catch (error) {
        console.error('Initialization failed:', error);
        setStatus('Initialization failed');
    }
}

// ============================================================================
// Event Listeners
// ============================================================================

window.addEventListener('message', handleMessage);

document.addEventListener('DOMContentLoaded', () => {
    setupRenderConfigUI();
    setupRibbonAdaptiveLayout();
    setupSidebarResize();
    init();

    document.addEventListener('keydown', (event) => {
        const target = event.target as HTMLElement | null;
        const isTypingTarget = Boolean(
            target
            && (target.tagName === 'INPUT'
                || target.tagName === 'TEXTAREA'
                || target.tagName === 'SELECT'
                || target.isContentEditable)
        );
        if (event.key !== 'Delete' || isTypingTarget) {
            return;
        }
        if (getSelectedShapeIds().length === 0 && getSelectedGroupIds().length === 0) {
            return;
        }
        event.preventDefault();
        handleMbsAction('deleteSelection', {});
    });

    // Panel close button handler
    document.getElementById('panel-header-close')?.addEventListener('click', () => {
        closeOptionsPanel();
    });

    // Button handlers
    document.getElementById('btn-import')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'importStep' });
    });

    document.getElementById('btn-open')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'requestCadtoolConfigImport' });
    });

    document.getElementById('btn-save')?.addEventListener('click', () => {
        exportCadtoolConfig();
    });

    document.getElementById('btn-saveas')?.addEventListener('click', () => {
        exportModel();
    });

    // Ribbon button handlers: direct dispatch to handleMbsAction
    document.querySelectorAll('.ribbon-btn[data-action-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const actionId = (btn as HTMLElement).dataset.actionId;
            if (!actionId) return;

            const params: Record<string, unknown> = {};
            if (actionId.startsWith('createJoint_')) {
                params.jointType = actionId.replace('createJoint_', '');
                handleMbsAction('createJoint', params);
            } else if (actionId.startsWith('createMotion_')) {
                params.motionType = actionId.replace('createMotion_', '');
                handleMbsAction('createMotion', params);
            } else {
                handleMbsAction(actionId, params);
            }
        });
    });

    document.getElementById('btn-explode')?.addEventListener('click', () => {
        toggleExplode();
    });

    document.getElementById('btn-export-check')?.addEventListener('click', () => {
        runExportCheck();
    });

    document.getElementById('btn-accept-exit')?.addEventListener('click', () => {
        exportCadtoolConfig();
        setStatusInfo('Accepted. You can close the editor.');
    });

    document.getElementById('btn-about')?.addEventListener('click', () => {
        vscode.postMessage({
            command: 'alert',
            text: 'CAD Tool Online'
        });
    });

    // Explode slider listeners
    const explodeSlider = document.getElementById('explode-slider') as HTMLInputElement;
    if (explodeSlider) {
        explodeSlider.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const value = parseInt(target.value);
            updateExplodeDistance(value);
        });
    }

    const explodeSliderClose = document.getElementById('explode-slider-close');
    if (explodeSliderClose) {
        explodeSliderClose.addEventListener('click', () => {
            if (isExploded) {
                toggleExplode();
            }
        });
    }
});


