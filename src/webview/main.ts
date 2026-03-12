// WebView entry point
// This file will be bundled by Vite for the WebView

import * as THREE from 'three';
import { ThreeViewer, type JointData, type MarkerGuideData } from '@cadtool-online/three';
import { MbsJointType, OcctWrapper, type MassProperties, type StepReadResult } from '@cadtool-online/geo';
import type { EdgeData, Mat3, MeshData, Vec3 } from '@cadtool-online/core';
import {
    aggregateMassProperties,
    buildModelBrowserTree,
    cleanEmptyGroups as cleanEmptyGroupsInState,
    DEFAULT_CONNECTOR_DIRECTION,
    createCadtoolErrorNotification,
    findNearestCircularEdge,
    flattenTopLevelAssemblyShapes,
    getUniqueGroupName as getUniqueGroupNameFromState,
    markerCreator,
    normalizeConnectorType,
    ungroupGroup as ungroupGroupInState,
    resolveConnectorDirection,
    resolveMarkerOwnerRef,
    renameGroupNode as renameGroupNodeInState,
    sanitizeGroupName,
    validateConnectorParticipants,
    validateReferenceMarkerCreation,
    type CadtoolErrorCode,
    type CadtoolRuntimeNotification,
    type BrowserNamedEntityInput,
    type MarkerOwnerRef,
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
let selectedMarkerId: string | null = null;
let selectedRefFrameId: string | null = null;
let selectedJointId: string | null = null;
let selectedMotionId: string | null = null;
let selectedDesignPointId: string | null = null;
let selectedContactId: string | null = null;
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
let markerCreationMode: 'fast' | 'standard' = 'fast';
let refFrameCreationMode: 'fast' | 'standard' = 'fast';
let markerFeatureInferenceEnabled = true;
let pendingMarkerSize = 20;
let jointCreationMode: 'fast' | 'standard' = 'fast';
let jointCreationPanelActive = false;
let jointFeatureInferenceEnabled = true;
let pendingJointIconSize = 20;
let jointDraftPickStage: 'part1' | 'part2' = 'part1';
let jointDraft: JointDraft | null = null;
let pendingDesignPointSize = 20;
let pendingRefFrameBaseId: string | null = null;
let pendingRefFrameTargetShapeId: string | null = null;
let frameEditPickIntent: 'placement' | 'position' | 'direction' = 'placement';
let markerDraftPickIntent: 'placement' | 'position' | 'direction' = 'placement';
let markerDraft: MarkerDraft | null = null;
let markerCreationPanelActive = false;
let refFrameCreationPanelActive = false;
let designPointCreationPanelActive = false;
let designPointCreationMode: 'pick' | 'calc' = 'pick';
let designPointCalcMode: 'midpoint' | 'offset' | 'intersection' = 'midpoint';
let designPointPickIntent: 'placement' | 'firstPoint' | 'secondPoint' | 'basePoint' | 'direction' | 'featureA' | 'featureB' = 'placement';
let designPointDraft: DesignPointDraft | null = null;
let motionCreationPanelActive = false;
let motionCreationMode: 'fast' | 'standard' = 'fast';
let pendingMotionIconSize = 20;
let motionDraft: MotionDraft | null = null;
let motionCreationPreset: MotionType = 'rotational';
let contactCreationPanelActive = false;
let contactCreationMode: ContactCreationMode = 'fast';
let pendingContactSize = 20;
let contactDraft: ContactDraft | null = null;
let contactCreationPreset: ContactType = 'pointPoint';
let activeContactHighlightIds: string[] = [];

type FrameEntityKind = 'marker' | 'refFrame';
type CanvasInteractionMode = 'none' | 'createMarker' | 'createDesignPoint' | 'createJoint' | 'createMotion' | 'editFrame' | 'createContact';
let canvasInteractionMode: CanvasInteractionMode = 'none';

const DRAFT_MARKER_ID = '__draft_marker__';
const GROUND_PART_ID = '__ground__';
const CAD_BODY_DISPLAY_COLOR = '#D4A017';
const CAD_DARK_COMPONENT_COLOR = '#2B2B2B';
const CAD_LIGHT_METAL_COLOR = '#B8B8B8';
const TREE_NODE_INDENT_PX = 12;

interface MbsRefFrameEntity {
    id: string;
    name: string;
    groupId: string;
    parentId?: string;
    position: Vec3;
    orientation: Mat3;
    size: number;
    visible: boolean;
    relatedMarkerId?: string;
    createdAt: string;
}

interface MarkerDraft {
    name: string;
    owner: MarkerOwnerRef;
    hostShapeId: string;
    position: Vec3;
    orientation: Mat3;
    size: number;
}

interface JointDraftPick {
    partId: string;
    position: Vec3;
    direction: Vec3;
}

interface JointDraft {
    name: string;
    jointType: string;
    part1?: string;
    part2?: string;
    position: Vec3;
    direction: Vec3;
    iconSize: number;
    inferenceEnabled: boolean;
    zAxisReversed: boolean;
    part1Pick?: JointDraftPick;
    part2Pick?: JointDraftPick;
}

interface ContactDraft {
    name: string;
    contactType: ContactType;
    iconSize: number;
    featureA?: ContactFeatureRef;
    featureB?: ContactFeatureRef;
}

type MotionType = 'rotational' | 'translational';
type MotionDriveMode =
    | 'angle'
    | 'angularVelocity'
    | 'angularAcceleration'
    | 'displacement'
    | 'velocity'
    | 'acceleration';

interface MotionDraft {
    name: string;
    motionType: MotionType;
    driveMode: MotionDriveMode;
    connectorRef?: string;
    iconSize: number;
    visible: boolean;
    phiStart: number;
    wStart: number;
}

function normalizeImportedDisplayColor(
    name: string,
    type: LoadedShape['type'],
    color?: string
): string | undefined {
    if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
        return type === 'assembly' ? '#C0C0C0' : CAD_BODY_DISPLAY_COLOR;
    }

    const normalized = color.toUpperCase();
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    const lowerName = name.toLowerCase();
    const isNearlyWhite = r >= 0xec && g >= 0xec && b >= 0xec;
    const isNeutralMetal = Math.abs(r - g) <= 10 && Math.abs(g - b) <= 10 && r >= 0xc0;
    const isWarmBodyPaint = r >= 0xd0 && g >= 0x78 && b <= 0x50;

    if (/(tire|tyre|rubber|seat|cushion|damping|damper)/.test(lowerName) && (isNearlyWhite || isNeutralMetal)) {
        return CAD_DARK_COMPONENT_COLOR;
    }

    if (/(cylinder|rod|shaft|axle|eje|piston|hub|nave|rim)/.test(lowerName) && (isNearlyWhite || isNeutralMetal)) {
        return CAD_LIGHT_METAL_COLOR;
    }

    if (type !== 'assembly' && (isWarmBodyPaint || isNearlyWhite || isNeutralMetal)) {
        return CAD_BODY_DISPLAY_COLOR;
    }

    return normalized;
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

interface DesignPointFeatureLine {
    kind: 'line';
    point: Vec3;
    direction: Vec3;
    label: string;
}

interface DesignPointFeaturePlane {
    kind: 'plane';
    point: Vec3;
    normal: Vec3;
    label: string;
}

type DesignPointFeature = DesignPointFeatureLine | DesignPointFeaturePlane;

interface DesignPointDraft {
    name: string;
    groupId: string;
    hostShapeId: string;
    position: Vec3;
    direction: Vec3;
    markerRefId?: string;
    size: number;
    isDirectionReverse: boolean;
    offsetValue: number;
    firstPoint?: Vec3;
    secondPoint?: Vec3;
    basePoint?: Vec3;
    featureA?: DesignPointFeature;
    featureB?: DesignPointFeature;
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
type SelectionKind = 'shape' | 'group' | 'marker' | 'refFrame' | 'joint' | 'motion' | 'designPoint' | 'contact';
type ContactType = 'pointPoint' | 'pointSurface';
type ContactCreationMode = 'fast' | 'standard';

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
    kind: ModelBrowserNode['kind'] | 'group' | 'marker' | 'refFrame' | 'designPoint';
    groupId?: string;
    frameId?: string;
    jointId?: string;
    motionId?: string;
    designPointId?: string;
    contactId?: string;
    selectionKey?: string;
    children?: ModelTreeNode[];
}

interface MbsJointEntity {
    id: string;
    name: string;
    jointType: string;
    part1: string;
    part2: string;
    position: Vec3;
    direction: Vec3;
    iconSize: number;
    inferenceEnabled: boolean;
    zAxisReversed: boolean;
    createdAt: string;
}

interface MbsMotionEntity {
    id: string;
    name: string;
    motionType: MotionType;
    driveMode: MotionDriveMode;
    connectorRef: string;
    iconSize: number;
    visible: boolean;
    phiStart: number;
    wStart: number;
    createdAt: string;
}

interface ContactFeatureRef {
    shapeId: string;
    position: Vec3;
    normal: Vec3;
}

interface MbsContactEntity {
    id: string;
    name: string;
    contactType: ContactType;
    partA: string;
    partB: string;
    featureA: ContactFeatureRef;
    featureB: ContactFeatureRef;
    iconSize: number;
    visible: boolean;
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
const mbsContacts = new Map<string, MbsContactEntity>();
const contactVisuals = new Map<string, THREE.Group>();
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
        groupDesignState = createEmptyGroupDesignState(getAllGroupablePartIds());
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

function toMarkerSelectionKey(markerId: string): string {
    return `marker:${markerId}`;
}

function toRefFrameSelectionKey(refFrameId: string): string {
    return `refFrame:${refFrameId}`;
}

function toJointSelectionKey(jointId: string): string {
    return `joint:${jointId}`;
}

function toMotionSelectionKey(motionId: string): string {
    return `motion:${motionId}`;
}

function toDesignPointSelectionKey(designPointId: string): string {
    return `designPoint:${designPointId}`;
}

function toContactSelectionKey(contactId: string): string {
    return `contact:${contactId}`;
}

function parseSelectionKey(selectionKey: string | null): { kind: SelectionKind; id: string } | null {
    if (!selectionKey) {
        return null;
    }
    const [kind, ...rest] = selectionKey.split(':');
    if (
        (kind !== 'shape'
            && kind !== 'group'
            && kind !== 'marker'
            && kind !== 'refFrame'
            && kind !== 'joint'
            && kind !== 'motion'
            && kind !== 'designPoint'
            && kind !== 'contact')
        || rest.length === 0
    ) {
        return null;
    }
    return {
        kind: kind as SelectionKind,
        id: rest.join(':')
    };
}

function getAllGroupablePartIds(): string[] {
    if (rootShapes.length === 0) {
        return [];
    }
    return Array.from(new Set(collectGroupableShapeIds(rootShapes)));
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
    groupDesignState.ungroupedPartIds = getAllGroupablePartIds().filter((partId) => !groupedPartIds.has(partId));
}

function buildImportedGroupsFromShapes(shapes: LoadedShape[]): GroupNode[] {
    const importedGroups: GroupNode[] = [];
    const importedState = createEmptyGroupDesignState();

    const visit = (shape: LoadedShape, parentGroupId: string | null, order: number): void => {
        if (shape.type !== 'assembly') {
            return;
        }

        const group: GroupNode = {
            id: `import_group_${shape.id}`,
            name: getUniqueGroupNameFromState(
                importedState,
                sanitizeGroupName(shape.name, `ImportedGroup${importedGroups.length + 1}`)
            ),
            parentGroupId,
            childGroupIds: [],
            memberPartIds: (shape.children ?? [])
                .filter((child) => child.type !== 'assembly')
                .map((child) => child.id),
            kind: 'imported',
            order,
            createdAt: new Date().toISOString()
        };

        importedState.groupsById[group.id] = {
            ...group,
            childGroupIds: [...group.childGroupIds],
            memberPartIds: [...group.memberPartIds]
        };
        importedGroups.push(group);

        let childOrder = 1;
        (shape.children ?? []).forEach((child) => {
            if (child.type !== 'assembly') {
                return;
            }
            visit(child, group.id, childOrder);
            childOrder += 1;
        });
    };

    let rootOrder = 1;
    shapes.forEach((shape) => {
        if (shape.type !== 'assembly') {
            return;
        }
        visit(shape, null, rootOrder);
        rootOrder += 1;
    });

    return importedGroups;
}

function initializeImportedGroupDesignState(): void {
    groupDesignState = createEmptyGroupDesignState(getAllGroupablePartIds());
    const importedGroups = buildImportedGroupsFromShapes(flattenTopLevelAssemblyShapes(rootShapes));
    importedGroups.forEach((group) => {
        upsertGroupNode(group);
    });
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

function resolveFrameOwnerForShape(shapeId: string): MarkerOwnerRef {
    return resolveMarkerOwnerRef(shapeId, resolveOwningGroupId(shapeId) ?? null);
}

function buildMarkerDesignGroupMap(): Record<string, { id: string; parentGroupId: string | null }> {
    return Object.fromEntries(
        listGroups().map((group) => [
            group.id,
            {
                id: group.id,
                parentGroupId: group.parentGroupId
            }
        ])
    );
}

function findOwningShapeForFrame(frameId: string, kind: FrameEntityKind): LoadedShape | null {
    const ownerId = kind === 'marker'
        ? createdMarkers.find((marker) => marker.id === frameId)?.parentId
            ?? createdMarkers.find((marker) => marker.id === frameId)?.groupId
        : createdRefFrames.get(frameId)?.parentId
            ?? createdRefFrames.get(frameId)?.groupId;
    if (!ownerId) {
        return null;
    }
    if (loadedShapes.has(ownerId)) {
        return loadedShapes.get(ownerId) ?? null;
    }

    const group = getGroupNode(ownerId);
    if (!group) {
        return null;
    }

    const candidatePartId = group.memberPartIds[0] ?? Array.from(collectGroupPartIdsRecursive(group.id))[0];
    return candidatePartId ? (loadedShapes.get(candidatePartId) ?? null) : null;
}

function frameOwnerDisplayName(ownerId: string): string {
    return getGroupNode(ownerId)?.name ?? loadedShapes.get(ownerId)?.name ?? ownerId;
}

function getSelectedShapeIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: SelectionKind; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'shape')
        .map((entry) => entry.id);
}

function getSelectedGroupIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: SelectionKind; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'group')
        .map((entry) => entry.id);
}

function getSelectedMarkerIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: SelectionKind; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'marker')
        .map((entry) => entry.id);
}

function getSelectedRefFrameIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: SelectionKind; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'refFrame')
        .map((entry) => entry.id);
}

function getSelectedJointIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: SelectionKind; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'joint')
        .map((entry) => entry.id);
}

function getSelectedMotionIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: SelectionKind; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'motion')
        .map((entry) => entry.id);
}

function getSelectedDesignPointIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: SelectionKind; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'designPoint')
        .map((entry) => entry.id);
}

function getSelectedContactIds(): string[] {
    return Array.from(selectedNodeIds)
        .map((selectionKey) => parseSelectionKey(selectionKey))
        .filter((entry): entry is { kind: SelectionKind; id: string } => Boolean(entry))
        .filter((entry) => entry.kind === 'contact')
        .map((entry) => entry.id);
}

function getActiveGroupId(): string | null {
    const active = parseSelectionKey(activeSelectionKey);
    return active?.kind === 'group' ? active.id : null;
}

function getActiveMarkerId(): string | null {
    const active = parseSelectionKey(activeSelectionKey);
    return active?.kind === 'marker' ? active.id : null;
}

function getActiveRefFrameId(): string | null {
    const active = parseSelectionKey(activeSelectionKey);
    return active?.kind === 'refFrame' ? active.id : null;
}

function getActiveJointId(): string | null {
    const active = parseSelectionKey(activeSelectionKey);
    return active?.kind === 'joint' ? active.id : null;
}

function getActiveMotionId(): string | null {
    const active = parseSelectionKey(activeSelectionKey);
    return active?.kind === 'motion' ? active.id : null;
}

function getActiveDesignPointId(): string | null {
    const active = parseSelectionKey(activeSelectionKey);
    return active?.kind === 'designPoint' ? active.id : null;
}

function getActiveContactId(): string | null {
    const active = parseSelectionKey(activeSelectionKey);
    return active?.kind === 'contact' ? active.id : null;
}

function syncSelectedEntitiesFromActive(): { kind: SelectionKind; id: string } | null {
    const active = parseSelectionKey(activeSelectionKey);
    selectedShapeId = active?.kind === 'shape' ? active.id : null;
    selectedGroupId = active?.kind === 'group' ? active.id : null;
    selectedMarkerId = active?.kind === 'marker' ? active.id : null;
    selectedRefFrameId = active?.kind === 'refFrame' ? active.id : null;
    selectedJointId = active?.kind === 'joint' ? active.id : null;
    selectedMotionId = active?.kind === 'motion' ? active.id : null;
    selectedDesignPointId = active?.kind === 'designPoint' ? active.id : null;
    selectedContactId = active?.kind === 'contact' ? active.id : null;
    return active;
}

function updateTreeSelectionClasses(): void {
    document.querySelectorAll<HTMLElement>('.tree-node[data-selection-key]').forEach((node) => {
        const selectionKey = node.dataset.selectionKey ?? '';
        node.classList.toggle('selected', selectedNodeIds.has(selectionKey));
    });
}

function isMarkerId(id: string): boolean {
    return createdMarkers.some((marker) => marker.id === id);
}

function isRefFrameId(id: string): boolean {
    return createdRefFrames.has(id);
}

function isJointId(id: string): boolean {
    return mbsJoints.has(id);
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

    const targetIds = new Set<string>();
    Array.from(new Set(
        getSelectedShapeIds()
            .flatMap((shapeId) => {
                const shape = loadedShapes.get(shapeId);
                return shape ? collectMeshBackedShapeIds(shape) : [shapeId];
            })
    ))
        .map((shapeId) => loadedShapes.get(shapeId)?.meshId)
        .filter((meshId): meshId is string => Boolean(meshId))
        .forEach((meshId) => targetIds.add(meshId));

    getSelectedMarkerIds().forEach((markerId) => targetIds.add(markerId));
    getSelectedRefFrameIds().forEach((refFrameId) => targetIds.add(refFrameId));
    getSelectedJointIds().forEach((jointId) => targetIds.add(jointId));
    getSelectedDesignPointIds().forEach((designPointId) => targetIds.add(designPointId));
    getSelectedContactIds().forEach((contactId) => targetIds.add(contactId));

    const currentIds = new Set(viewer.getSelectedIds());
    isSyncingViewerSelection = true;
    try {
        currentIds.forEach((id) => {
            if (!targetIds.has(id)) {
                viewer.deselect(id);
            }
        });
        targetIds.forEach((id) => {
            if (!currentIds.has(id)) {
                viewer.select(id);
            }
        });
    } finally {
        isSyncingViewerSelection = false;
    }
}

function applyShapeVisualColor(shapeId: string, color: string | undefined): void {
    const shape = loadedShapes.get(shapeId);
    if (!shape?.meshId || !viewer || !color) {
        return;
    }
    const normalized = color.startsWith('#') ? color.slice(1) : color;
    const parsed = Number.parseInt(normalized, 16);
    if (Number.isFinite(parsed)) {
        viewer.setMeshColor(shape.meshId, parsed);
    }
}

function clearContactPartHighlights(): void {
    activeContactHighlightIds.forEach((shapeId) => {
        applyShapeVisualColor(shapeId, loadedShapes.get(shapeId)?.color);
    });
    activeContactHighlightIds = [];
}

function syncContactPartHighlights(): void {
    clearContactPartHighlights();
    const contactId = getActiveContactId();
    if (!contactId) {
        return;
    }
    const contact = mbsContacts.get(contactId);
    if (!contact) {
        return;
    }

    applyShapeVisualColor(contact.partA, '#DC2626');
    activeContactHighlightIds.push(contact.partA);
    if (contact.partB !== contact.partA) {
        applyShapeVisualColor(contact.partB, '#2563EB');
        activeContactHighlightIds.push(contact.partB);
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

    setPanelMode('properties', '属性-零件');
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
    html += createPropertyRow('名称', group.name, { boxed: true });
    html += createPropertyRow('类型', '分组', { boxed: true });
    html += createPropertyRow('ID', group.id, { boxed: true });
    html += createPropertyRow('父分组', group.parentGroupId ? (getGroupNode(group.parentGroupId)?.name ?? group.parentGroupId) : '物体');
    html += createPropertyRow('分组类别', group.kind);
    html += createPropertyRow('子分组数', group.childGroupIds.length.toString());
    html += createPropertyRow('直属成员数', group.memberPartIds.length.toString());
    html += createPropertyRow('零件总数', partIds.length.toString());
    html += createPropertyRow('创建时间', group.createdAt);
    html += '<div class="property-separator"></div>';
    html += '<div class="property-section-header">物理属性</div>';

    if (!massSummary) {
        html += createPropertyRow('状态', '不可用');
    } else {
        html += createPropertyRow('已计算零件', `${massSummary.computedPartCount}/${massSummary.totalPartCount}`);
        html += createPropertyRow('缺失零件', missingText);
        html += createPropertyRow('总质量', `${formatPhysicsNumber(massSummary.mass, 5)} kg`);
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
    if (active.kind === 'marker') {
        renderMarkerPropertiesPanel(active.id);
        return;
    }
    if (active.kind === 'refFrame') {
        renderRefFramePropertiesPanel(active.id);
        return;
    }
    if (active.kind === 'joint') {
        renderJointPropertiesPanel(active.id);
        return;
    }
    if (active.kind === 'motion') {
        renderMotionPropertiesPanel(active.id);
        return;
    }
    if (active.kind === 'designPoint') {
        renderDesignPointPropertiesPanel(active.id);
        return;
    }
    if (active.kind === 'contact') {
        renderContactPropertiesPanel(active.id);
        return;
    }
    updatePropertiesPanel(active.id);
}

function selectSelection(
    nextSelection: { kind: SelectionKind; id: string } | null,
    options?: { additive?: boolean; toggle?: boolean; fromViewer?: boolean }
): void {
    const selectionKey = nextSelection
        ? (
            nextSelection.kind === 'shape'
                ? toShapeSelectionKey(nextSelection.id)
                : nextSelection.kind === 'group'
                    ? toGroupSelectionKey(nextSelection.id)
                    : nextSelection.kind === 'marker'
                        ? toMarkerSelectionKey(nextSelection.id)
                        : nextSelection.kind === 'refFrame'
                            ? toRefFrameSelectionKey(nextSelection.id)
                            : nextSelection.kind === 'joint'
                                ? toJointSelectionKey(nextSelection.id)
                                : nextSelection.kind === 'motion'
                                    ? toMotionSelectionKey(nextSelection.id)
                                : nextSelection.kind === 'designPoint'
                                    ? toDesignPointSelectionKey(nextSelection.id)
                                    : toContactSelectionKey(nextSelection.id)
        )
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

    syncSelectedEntitiesFromActive();

    updateTreeSelectionClasses();
    if (!options?.fromViewer) {
        syncViewerSelectionFromState();
    }
    updateSelectionPropertiesPanel();
    syncContactPartHighlights();

    if (motionCreationPanelActive && selectedJointId) {
        applyMotionConnectorSelection(selectedJointId);
    }

    if (selectedShapeId) {
        rememberShapeSelection(selectedShapeId);
        vscode.postMessage({ command: 'selectShape', shapeId: selectedShapeId });
    }

    if (refFrameCreationPanelActive) {
        if (selectedMarkerId) {
            // In reference-marker mode, base marker selection must come from 3D picking.
            setStatusInfo('Please pick a base marker in the 3D view.');
            renderRefFrameCreationPanel();
        } else if (selectedShapeId) {
            pendingRefFrameTargetShapeId = selectedShapeId;
            const selectedTargetShape = loadedShapes.get(selectedShapeId);
            if (selectedTargetShape) {
                setStatusInfo(`Target part selected: ${selectedTargetShape.name}`);
            }
            if (refFrameCreationMode === 'fast' && pendingRefFrameBaseId) {
                createReferenceFrameFromSelection(pendingRefFrameBaseId, selectedShapeId);
            } else {
                if (!pendingRefFrameBaseId) {
                    setStatusInfo(
                        selectedTargetShape
                            ? `Target part selected: ${selectedTargetShape.name}. Please pick a base marker in the 3D view first.`
                            : 'Please pick a base marker in the 3D view first.'
                    );
                }
                renderRefFrameCreationPanel();
            }
        }
    }

    if (motionCreationPanelActive && selectedJointId) {
        applyMotionConnectorSelection(selectedJointId);
    }
}

function syncSelectionFromViewer(activeObjectId: string | null): void {
    const selectedIds = viewer?.getSelectedIds() ?? [];
    selectedNodeIds.clear();
    const selectionKeys = selectedIds.flatMap((id) => {
        const shapeId = meshIdToShapeId.get(id);
        if (shapeId) {
            return [toShapeSelectionKey(shapeId)];
        }
        if (isMarkerId(id)) {
            return [toMarkerSelectionKey(id)];
        }
        if (isRefFrameId(id)) {
            return [toRefFrameSelectionKey(id)];
        }
        if (isJointId(id)) {
            return [toJointSelectionKey(id)];
        }
        if (mbsMotions.has(id)) {
            return [toMotionSelectionKey(id)];
        }
        if (mbsDesignPoints.has(id)) {
            return [toDesignPointSelectionKey(id)];
        }
        if (mbsContacts.has(id)) {
            return [toContactSelectionKey(id)];
        }
        return [];
    });
    selectionKeys.forEach((selectionKey) => selectedNodeIds.add(selectionKey));

    if (activeObjectId) {
        const activeShapeId = meshIdToShapeId.get(activeObjectId);
        if (activeShapeId) {
            activeSelectionKey = toShapeSelectionKey(activeShapeId);
        } else if (isMarkerId(activeObjectId)) {
            activeSelectionKey = toMarkerSelectionKey(activeObjectId);
        } else if (isRefFrameId(activeObjectId)) {
            activeSelectionKey = toRefFrameSelectionKey(activeObjectId);
        } else if (isJointId(activeObjectId)) {
            activeSelectionKey = toJointSelectionKey(activeObjectId);
        } else if (mbsMotions.has(activeObjectId)) {
            activeSelectionKey = toMotionSelectionKey(activeObjectId);
        } else if (mbsDesignPoints.has(activeObjectId)) {
            activeSelectionKey = toDesignPointSelectionKey(activeObjectId);
        } else if (mbsContacts.has(activeObjectId)) {
            activeSelectionKey = toContactSelectionKey(activeObjectId);
        } else {
            activeSelectionKey = selectionKeys.at(-1) ?? null;
        }
    } else {
        activeSelectionKey = selectionKeys.at(-1) ?? null;
    }
    syncSelectedEntitiesFromActive();
    updateTreeSelectionClasses();
    updateSelectionPropertiesPanel();
    syncContactPartHighlights();
    if (selectedShapeId) {
        rememberShapeSelection(selectedShapeId);
        vscode.postMessage({ command: 'selectShape', shapeId: selectedShapeId });
    }

    if (refFrameCreationPanelActive) {
        if (selectedMarkerId) {
            pendingRefFrameBaseId = selectedMarkerId;
            const selectedBaseMarker = createdMarkers.find((marker) => marker.id === selectedMarkerId);
            if (selectedBaseMarker) {
                setStatusInfo(`Base marker selected: ${selectedBaseMarker.name}`);
            }
            renderRefFrameCreationPanel();
        } else if (selectedShapeId) {
            pendingRefFrameTargetShapeId = selectedShapeId;
            const selectedTargetShape = loadedShapes.get(selectedShapeId);
            if (selectedTargetShape) {
                setStatusInfo(`Target part selected: ${selectedTargetShape.name}`);
            }
            if (refFrameCreationMode === 'fast' && pendingRefFrameBaseId) {
                createReferenceFrameFromSelection(pendingRefFrameBaseId, selectedShapeId);
            } else {
                if (!pendingRefFrameBaseId) {
                    setStatusInfo(
                        selectedTargetShape
                            ? `Target part selected: ${selectedTargetShape.name}. Please pick a base marker in the 3D view first.`
                            : 'Please pick a base marker in the 3D view first.'
                    );
                }
                renderRefFrameCreationPanel();
            }
        }
    }

    if (motionCreationPanelActive && selectedJointId) {
        applyMotionConnectorSelection(selectedJointId);
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
    const result = ungroupGroupInState(groupDesignState, groupId, isGroupReferenced);
    groupDesignState = result.state as GroupDesignState;
    selectedNodeIds.clear();
    groupDesignState.selectedNodeIds = [];
    activeSelectionKey = null;
    syncSelectedEntitiesFromActive();
    updateTreeSelectionClasses();
    updateSelectionPropertiesPanel();
    return result;
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

    syncSelectedEntitiesFromActive();
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
    Array.from(mbsContacts.values()).forEach((contact) => {
        if (contact.partA === shapeId || contact.partB === shapeId) {
            references.push(`contact:${contact.name}`);
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

function deleteSelectedDesignPoints(): number {
    const selectedDesignPointIds = getSelectedDesignPointIds();
    const deletedSelectionKeys = new Set(selectedDesignPointIds.map((designPointId) => toDesignPointSelectionKey(designPointId)));
    selectedDesignPointIds.forEach((designPointId) => {
        mbsDesignPoints.delete(designPointId);
        selectedNodeIds.delete(toDesignPointSelectionKey(designPointId));
        viewer?.removeFrame(designPointId);
    });
    if (selectedDesignPointIds.length > 0) {
        if (activeSelectionKey && deletedSelectionKeys.has(activeSelectionKey)) {
            activeSelectionKey = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds).at(-1) ?? null : null;
        }
        syncSelectedEntitiesFromActive();
    }
    return selectedDesignPointIds.length;
}

function handleDeleteSelection(): void {
    const deletedDesignPointCount = deleteSelectedDesignPoints();
    const selectedJointIds = getSelectedJointIds();
    const selectedMotionIds = getSelectedMotionIds();
    const selectedContactIds = getSelectedContactIds();
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

    if (
        selectedGroupIds.length === 0
        && selectedPartIds.length === 0
        && deletedDesignPointCount === 0
        && selectedJointIds.length === 0
        && selectedMotionIds.length === 0
        && selectedContactIds.length === 0
    ) {
        vscode.postMessage({
            command: 'alert',
            text: 'Select one or more design points, joints, motions, contacts, parts or groups first.'
        });
        return;
    }

    let deletedPartCount = 0;
    let deletedJointCount = 0;
    let deletedMotionCount = 0;
    let deletedContactCount = 0;
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
    selectedJointIds.forEach((jointId) => {
        if (deleteJointById(jointId)) {
            deletedJointCount += 1;
        }
    });
    selectedMotionIds.forEach((motionId) => {
        if (deleteMotionById(motionId)) {
            deletedMotionCount += 1;
        }
    });
    selectedContactIds.forEach((contactId) => {
        if (deleteContactById(contactId)) {
            deletedContactCount += 1;
        }
    });

    updateModelTree();
    setStatusInfo(`Deleted ${deletedDesignPointCount} design point(s), ${deletedJointCount} joint(s), ${deletedMotionCount} motion(s), ${deletedContactCount} contact(s), ${deletedPartCount} part(s) and ${groupDeleteResult.deletedCount} group(s).`);

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

function postNotification(notification: CadtoolRuntimeNotification): void {
    vscode.postMessage({
        command: 'notify',
        ...notification
    });
}

function notifyInfo(text: string, options: { detail?: string; statusText?: string; statusInfo?: string } = {}): void {
    if (options.statusText) {
        setStatus(options.statusText);
    }
    if (typeof options.statusInfo === 'string') {
        setStatusInfo(options.statusInfo);
    }
    postNotification({
        level: 'info',
        text,
        detail: options.detail
    });
}

function notifyWarning(text: string, options: { detail?: string; statusText?: string; statusInfo?: string } = {}): void {
    if (options.statusText) {
        setStatus(options.statusText);
    }
    if (typeof options.statusInfo === 'string') {
        setStatusInfo(options.statusInfo);
    }
    postNotification({
        level: 'warning',
        text,
        detail: options.detail
    });
}

function notifyError(
    code: CadtoolErrorCode,
    detail: string,
    options: {
        text?: string;
        statusText?: string;
        statusInfo?: string;
    } = {}
): void {
    if (options.statusText) {
        setStatus(options.statusText);
    }
    if (typeof options.statusInfo === 'string') {
        setStatusInfo(options.statusInfo);
    }
    postNotification(createCadtoolErrorNotification(code, {
        detail,
        text: options.text
    }));
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

function invertRigidTransform(transform: RigidTransform): RigidTransform {
    const r = transform.rotation;
    const rotation = [
        r[0], r[3], r[6],
        r[1], r[4], r[7],
        r[2], r[5], r[8]
    ];
    const tx = transform.translation.x;
    const ty = transform.translation.y;
    const tz = transform.translation.z;

    return {
        translation: {
            x: -(rotation[0] * tx + rotation[1] * ty + rotation[2] * tz),
            y: -(rotation[3] * tx + rotation[4] * ty + rotation[5] * tz),
            z: -(rotation[6] * tx + rotation[7] * ty + rotation[8] * tz)
        },
        rotation
    };
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
let resolvedTreeIconsBase: string | null | undefined;

function toTreeIconsBase(base: string): string {
    return base.replace(/\/(?:png|svg)\/32$/i, '/svg/16');
}

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
        '.ribbon-btn-icon img, img[src*="icons/svg/32/"], img[src*="public/icons/svg/32/"], img[src*="icons/png/32/"], img[src*="public/icons/png/32/"]'
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

function resolveTreeIconsBase(): string | null {
    if (typeof resolvedTreeIconsBase === 'string' && resolvedTreeIconsBase.length > 0) {
        return resolvedTreeIconsBase;
    }

    const fromWindow = typeof window.ICONS_32_BASE === 'string' ? window.ICONS_32_BASE.trim() : '';
    if (fromWindow.length > 0) {
        resolvedTreeIconsBase = toTreeIconsBase(fromWindow);
        return resolvedTreeIconsBase;
    }

    const fromDataAttr = document.documentElement.getAttribute('data-icons32-base')?.trim() ?? '';
    if (fromDataAttr.length > 0) {
        resolvedTreeIconsBase = toTreeIconsBase(fromDataAttr);
        return resolvedTreeIconsBase;
    }

    const fallback = resolveIcons32Base();
    resolvedTreeIconsBase = fallback ? toTreeIconsBase(fallback) : null;
    return resolvedTreeIconsBase;
}

function treeIconPath(fileName: string): string | null {
    const base = resolveTreeIconsBase();
    if (!base) {
        return null;
    }
    return `${base}/${fileName.replace(/\.png$/i, '.svg')}`;
}

function expandIconPath(expanded: boolean): string | null {
    return treeIconPath(expanded ? 'model_tree_cad_collapse.png' : 'model_tree_cad_expand.png');
}

function buildOwnedDesignNodes(ownerId: string): ModelTreeNode[] {
    const markerNodes = createdMarkers
        .filter((marker) => (marker.parentId ?? marker.groupId) === ownerId)
        .map((marker) => ({
            id: `marker_${marker.id}`,
            kind: 'marker' as const,
            label: marker.name,
            frameId: marker.id,
            selectionKey: toMarkerSelectionKey(marker.id)
        }));
    const refFrameNodes = Array.from(createdRefFrames.values())
        .filter((refFrame) => (refFrame.parentId ?? refFrame.groupId) === ownerId)
        .map((refFrame) => ({
            id: `refFrame_${refFrame.id}`,
            kind: 'refFrame' as const,
            label: refFrame.name,
            frameId: refFrame.id,
            selectionKey: toRefFrameSelectionKey(refFrame.id)
        }));
    const designPointNodes = Array.from(mbsDesignPoints.values())
        .filter((point) => point.groupId === ownerId)
        .map((point) => ({
            id: `designPoint_${point.id}`,
            kind: 'designPoint' as const,
            label: point.name,
            designPointId: point.id,
            selectionKey: toDesignPointSelectionKey(point.id)
        }));
    return [...markerNodes, ...refFrameNodes, ...designPointNodes];
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
        selectionKey: toShapeSelectionKey(shape.id),
        children: buildOwnedDesignNodes(shape.id)
    };
}

function toFallbackTreeShapeNode(shape: LoadedShape): ModelTreeNode {
    return {
        id: `shape_${shape.id}`,
        kind: shape.type,
        label: shape.name,
        shapeId: shape.id,
        selectionKey: toShapeSelectionKey(shape.id),
        children: [
            ...(shape.children?.map((child) => toFallbackTreeShapeNode(child)) ?? []),
            ...buildOwnedDesignNodes(shape.id)
        ]
    };
}

function toImportedLeafTreeNode(shape: LoadedShape, parentGroupName?: string): ModelTreeNode {
    const normalizedLabel = shape.name === parentGroupName ? `${shape.name}_1` : shape.name;
    return {
        id: `shape_${shape.id}`,
        kind: shape.type,
        label: normalizedLabel,
        shapeId: shape.id,
        selectionKey: toShapeSelectionKey(shape.id),
        children: buildOwnedDesignNodes(shape.id)
    };
}

function toImportedTreeNode(
    shape: LoadedShape,
    options: {
        wrapSinglePart?: boolean;
        parentGroupName?: string;
    } = {}
): ModelTreeNode {
    const shouldWrapAsGroup = shape.type === 'assembly' || options.wrapSinglePart;

    if (!shouldWrapAsGroup) {
        return toImportedLeafTreeNode(shape, options.parentGroupName);
    }

    const childNodes = shape.children?.map((child) => toImportedTreeNode(child, { parentGroupName: shape.name })) ?? [];
    const wrappedLeafNodes = options.wrapSinglePart ? [toImportedLeafTreeNode(shape, shape.name)] : [];

    return {
        id: `import_group_${shape.id}`,
        kind: 'group',
        label: shape.name,
        children: [
            ...childNodes,
            ...wrappedLeafNodes,
            ...buildOwnedDesignNodes(shape.id)
        ]
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
            .filter((node): node is ModelTreeNode => Boolean(node)),
        ...buildOwnedDesignNodes(group.id)
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
        ? flattenTopLevelAssemblyShapes(rootShapes).map((shape) => (
            shape.type === 'assembly'
                ? toImportedTreeNode(shape)
                : toImportedTreeNode(shape, { wrapSinglePart: true })
        ))
        : externalModelTreeShapes.map((shape) => ({
            id: `shape_${shape.id}`,
            label: shape.name,
            kind: 'part',
            shapeId: shape.id,
            selectionKey: toShapeSelectionKey(shape.id)
        }));
}

function buildForceTreeNodes(): ModelTreeNode[] {
    const contactNodes = Array.from(mbsContacts.values()).map((contact) => ({
        id: `contact_${contact.id}`,
        kind: 'force' as const,
        label: contact.name,
        contactId: contact.id,
        selectionKey: toContactSelectionKey(contact.id)
    }));
    const fluidNodes = [
        ...Array.from(fluidSlices.values(), (slice) => ({
            id: `slice_${slice.id}`,
            kind: 'force' as const,
            label: slice.name
        })),
        ...Array.from(fluidPorts.values(), (port) => ({
            id: `port_${port.id}`,
            kind: 'force' as const,
            label: port.name
        }))
    ];
    return [...contactNodes, ...fluidNodes];
}

function buildModelTreeNodes(): ModelTreeNode[] {
    const forceNodes = buildForceTreeNodes();

    const objectNodes = buildObjectTreeNodes();

    const hasEntities = objectNodes.length > 0
        || mbsJoints.size > 0
        || mbsMotions.size > 0
        || forceNodes.length > 0;
    if (!hasEntities) {
        return [];
    }

    const nodes = buildModelBrowserTree({
        shapes: [],
        includeGround: true,
        connections: toNamedEntityList(mbsJoints.values()),
        motions: toNamedEntityList(mbsMotions.values()),
        forces: forceNodes.map((node) => ({ id: node.id, name: node.label })),
        materials: []
    }) as unknown as ModelTreeNode[];

    const objectsCategory = nodes.find((node) => node.id === 'category_objects');
    if (objectsCategory) {
        const groundNode = objectsCategory.children?.find((node) => node.kind === 'ground');
        objectsCategory.children = groundNode ? [groundNode as ModelTreeNode, ...objectNodes] : objectNodes;
    }

    const connectionsCategory = nodes.find((node) => node.id === 'category_connections');
    if (connectionsCategory) {
        connectionsCategory.children = Array.from(mbsJoints.values()).map((joint) => ({
            id: `conn_${joint.id}`,
            kind: 'connection' as const,
            label: joint.name,
            jointId: joint.id,
            selectionKey: toJointSelectionKey(joint.id)
        }));
    }

    const motionsCategory = nodes.find((node) => node.id === 'category_motions');
    if (motionsCategory) {
        motionsCategory.children = Array.from(mbsMotions.values()).map((motion) => ({
            id: `motion_${motion.id}`,
            kind: 'motion' as const,
            label: motion.name,
            motionId: motion.id,
            selectionKey: toMotionSelectionKey(motion.id)
        }));
    }

    const forcesCategory = nodes.find((node) => node.id === 'category_forces');
    if (forcesCategory) {
        forcesCategory.children = forceNodes;
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
        case 'marker':
            return 'M';
        case 'refFrame':
            return 'R';
        case 'designPoint':
            return 'D';
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
        case 'marker':
            return treeIconPath('cad_place_marker.png');
        case 'refFrame':
            return treeIconPath('cad_place_refmarker.png');
        case 'designPoint':
            return treeIconPath('cad_design_pnt.png');
        case 'connection':
            return treeIconPath('model_tree_cad_unknown_cnt.png');
        case 'motion':
            return (() => {
                const motion = node.motionId ? mbsMotions.get(node.motionId) : null;
                return treeIconPath(
                    motion?.motionType === 'translational'
                        ? 'model_tree_cad_translational_gray.png'
                        : 'model_tree_cad_rotational_gray.png'
                );
            })();
        case 'force':
            return treeIconPath('force_cad_general_force.png');
        case 'material':
            return treeIconPath('model_tree_material.png');
        default:
            return null;
    }
}

function setExpandButtonState(expandBtn: HTMLElement, expanded: boolean): void {
    expandBtn.dataset.expanded = expanded ? 'true' : 'false';
    const iconPath = expandIconPath(expanded);
    const icon = expandBtn.querySelector('img');
    if (icon && iconPath) {
        const img = icon as HTMLImageElement;
        img.src = iconPath;
        img.alt = expanded ? 'collapse' : 'expand';
        return;
    }

    if (iconPath) {
        const img = document.createElement('img');
        img.src = iconPath;
        img.alt = expanded ? 'collapse' : 'expand';
        img.draggable = false;
        expandBtn.textContent = '';
        expandBtn.appendChild(img);
    }
    expandBtn.setAttribute('aria-label', expanded ? 'collapse' : 'expand');
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
    if (nodeData.contactId) {
        return [
            { label: '删除', action: 'deleteContact' }
        ];
    }

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

    if (nodeData.frameId) {
        return [
            { label: '删除', action: 'deleteFrame' }
        ];
    }

    if (nodeData.jointId) {
        return [
            { label: '属性', action: 'jointProperties' },
            { label: '删除', action: 'deleteJoint' }
        ];
    }

    if (nodeData.motionId) {
        return [
            { label: '属性', action: 'motionProperties' },
            { label: '删除', action: 'deleteMotion' }
        ];
    }

    if (nodeData.designPointId) {
        return [
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
    container.style.marginLeft = `${Math.max(0, level) * TREE_NODE_INDENT_PX}px`;

    const node = document.createElement('div');
    node.className = 'tree-node';
    if (nodeData.kind === 'category') {
        node.classList.add('tree-node-category');
    }
    if (nodeData.selectionKey && selectedNodeIds.has(nodeData.selectionKey)) {
        node.classList.add('selected');
    }
    if (nodeData.shapeId) {
        node.dataset.shapeId = nodeData.shapeId;
    }
    if (nodeData.groupId) {
        node.dataset.groupId = nodeData.groupId;
    }
    if (nodeData.frameId) {
        node.dataset.frameId = nodeData.frameId;
    }
    if (nodeData.jointId) {
        node.dataset.jointId = nodeData.jointId;
    }
    if (nodeData.motionId) {
        node.dataset.motionId = nodeData.motionId;
    }
    if (nodeData.designPointId) {
        node.dataset.designPointId = nodeData.designPointId;
    }
    if (nodeData.contactId) {
        node.dataset.contactId = nodeData.contactId;
    }
    if (nodeData.selectionKey) {
        node.dataset.selectionKey = nodeData.selectionKey;
    }
    if (nodeData.groupId || nodeData.id === 'category_objects') {
        node.dataset.dropTarget = nodeData.groupId ?? '__root__';
    }

    if (nodeData.children && nodeData.children.length > 0) {
        const expandedByDefault = false;
        const expandBtn = document.createElement('span');
        expandBtn.className = 'expand-btn';
        setExpandButtonState(expandBtn, expandedByDefault);
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
        const expandedByDefault = false;
        childrenContainer.style.display = expandedByDefault ? 'block' : 'none';

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

function syncFrameEntityToViewer(kind: FrameEntityKind, id: string): void {
    if (!viewer) {
        return;
    }

    if (kind === 'marker') {
        const marker = createdMarkers.find((item) => item.id === id);
        if (!marker) {
            return;
        }
        viewer.updateFrame({
            id: marker.id,
            name: marker.name,
            position: marker.position,
            orientation: marker.orientation,
            size: marker.size,
            visible: marker.visible,
            isPrimary: true
        });
        return;
    }

    const refFrame = createdRefFrames.get(id);
    if (!refFrame) {
        return;
    }
    viewer.updateFrame({
        id: refFrame.id,
        name: refFrame.name,
        position: refFrame.position,
        orientation: refFrame.orientation,
        size: refFrame.size,
        visible: refFrame.visible,
        isPrimary: false
    });
}

function syncDesignPointEntityToViewer(id: string): void {
    if (!viewer) {
        return;
    }

    const point = mbsDesignPoints.get(id);
    if (!point) {
        return;
    }

    viewer.updateFrame({
        id: point.id,
        name: point.name,
        position: point.position,
        orientation: createOrientationFromNormal(point.direction ?? { x: 0, y: 0, z: 1 }),
        size: clampDesignPointSize(point.size),
        visible: true,
        isPrimary: false
    });
}

function calculateShapeWorldCenter(shapeId: string): Vec3 {
    const shape = loadedShapes.get(shapeId);
    if (!shape) {
        return { x: 0, y: 0, z: 0 };
    }
    const localCenter = calculateShapeCenter(shape);
    const transform = normalizeRigidTransform(shape.transform);
    const [x, y, z] = transformPoint(transform, localCenter.x, localCenter.y, localCenter.z);
    return { x, y, z };
}

function resolveJointViewerType(jointType: string): MbsJointType {
    switch (normalizeConnectorType(jointType)) {
        case 'fixed':
            return MbsJointType.Fixed;
        case 'prismatic':
            return MbsJointType.Prismatic;
        case 'cylindrical':
        case 'screw':
            return MbsJointType.Cylindrical;
        case 'spherical':
            return MbsJointType.Spherical;
        case 'universal':
            return MbsJointType.Universal;
        case 'planar':
            return MbsJointType.Planar;
        case 'revolute':
        default:
            return MbsJointType.Revolute;
    }
}

function buildJointViewerData(joint: MbsJointEntity): JointData {
    const position = joint.position ?? (
        joint.part2 === GROUND_PART_ID
            ? calculateShapeWorldCenter(joint.part1)
            : (() => {
                const p1 = calculateShapeWorldCenter(joint.part1);
                const p2 = calculateShapeWorldCenter(joint.part2);
                return {
                    x: (p1.x + p2.x) / 2,
                    y: (p1.y + p2.y) / 2,
                    z: (p1.z + p2.z) / 2
                };
            })()
    );

    return {
        id: joint.id,
        name: joint.name,
        type: resolveJointViewerType(joint.jointType),
        position,
        axis: normalizeVector(joint.direction) ?? DEFAULT_CONNECTOR_DIRECTION,
        size: Math.max(1, joint.iconSize),
        selected: selectedJointId === joint.id
    };
}

function syncJointEntityToViewer(id: string): void {
    if (!viewer) {
        return;
    }

    const joint = mbsJoints.get(id);
    if (!joint) {
        viewer.removeJoint(id);
        return;
    }

    viewer.updateJoint(buildJointViewerData(joint));
}

function renderMarkerPropertiesPanel(markerId: string): void {
    const marker = createdMarkers.find((item) => item.id === markerId);
    const propsEl = document.getElementById('properties-panel');
    if (!marker || !propsEl) {
        updatePropertiesPanel(null);
        return;
    }

    setPanelMode('properties', '属性-标架');
    const direction = orientationToDirection(marker.orientation);
    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('prop-marker-name', marker.name)}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="prop-marker-visible">可见性</label>
            <input id="prop-marker-visible" type="checkbox"${marker.visible ? ' checked' : ''} />
        </div>
        ${buildSeparator()}
        <div class="opt-row">
            <label for="prop-marker-size">图标大小</label>
            <input id="prop-marker-size" class="opt-input" type="number" min="1" step="1" value="${Math.max(1, marker.size > 0 ? marker.size : pendingMarkerSize)}" />
        </div>
        ${buildSeparator()}
        ${buildVec3Input('prop-marker-pos', '位置（全局坐标）', marker.position.x, marker.position.y, marker.position.z)}
        ${buildSeparator()}
        ${buildVec3Input('prop-marker-dir', '方向（单位向量）', direction.x, direction.y, direction.z)}
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="prop-marker-pick-position" class="opt-btn-secondary">拾取位置</button>
            <button id="prop-marker-pick-direction" class="opt-btn-secondary">拾取方向</button>
        </div>
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="prop-marker-save" class="opt-btn-primary">保存修改</button>
        </div>
    </div>`;

    document.getElementById('prop-marker-visible')?.addEventListener('change', (event) => {
        const target = event.currentTarget as HTMLInputElement;
        marker.setVisible(target.checked);
        viewer?.setFrameVisible(marker.id, marker.visible);
    });

    document.getElementById('prop-marker-save')?.addEventListener('click', () => {
        const nameInput = document.getElementById('prop-marker-name') as HTMLInputElement | null;
        const sizeInput = document.getElementById('prop-marker-size') as HTMLInputElement | null;
        const directionInput = normalizeVector(readVec3FromInputs('prop-marker-dir')) ?? { x: 0, y: 0, z: 1 };
        marker.name = nameInput?.value?.trim() || marker.name;
        marker.setSize(Math.max(1, Number.parseFloat(sizeInput?.value ?? `${pendingMarkerSize}`) || pendingMarkerSize));
        const nextPosition = readVec3FromInputs('prop-marker-pos');
        marker.setPosition(nextPosition.x, nextPosition.y, nextPosition.z);
        marker.setOrientation(createOrientationFromNormal(directionInput));
        syncFrameEntityToViewer('marker', marker.id);
        updateModelTree();
        renderMarkerPropertiesPanel(marker.id);
    });

    document.getElementById('prop-marker-pick-position')?.addEventListener('click', () => {
        startFrameEditModeForTarget(marker.id, 'marker', 'position');
    });
    document.getElementById('prop-marker-pick-direction')?.addEventListener('click', () => {
        startFrameEditModeForTarget(marker.id, 'marker', 'direction');
    });
}

function renderRefFramePropertiesPanel(refFrameId: string): void {
    const refFrame = createdRefFrames.get(refFrameId);
    const propsEl = document.getElementById('properties-panel');
    if (!refFrame || !propsEl) {
        updatePropertiesPanel(null);
        return;
    }

    const direction = orientationToDirection(refFrame.orientation);
    const relatedMarker = refFrame.relatedMarkerId
        ? createdMarkers.find((marker) => marker.id === refFrame.relatedMarkerId)
        : null;

    setPanelMode('properties', '属性-参考标架');
    propsEl.innerHTML = `<div class="opt-section">
        <div class="property-section-header">基本属性</div>
        ${createPropertyRow('名称', refFrame.name, { boxed: true })}
        ${createPropertyRow('基本标架', relatedMarker?.name ?? '(none)', { boxed: true })}
        ${createPropertyRow('宿主对象', frameOwnerDisplayName(refFrame.groupId), { boxed: true })}
        ${createPropertyRow('位置', formatVec3(refFrame.position))}
        ${createPropertyRow('方向', formatVec3(direction))}
        <div class="property-separator"></div>
        <div class="opt-row">
            <label for="prop-ref-frame-visible">可见性</label>
            <input id="prop-ref-frame-visible" type="checkbox"${refFrame.visible ? ' checked' : ''} />
        </div>
    </div>`;

    document.getElementById('prop-ref-frame-visible')?.addEventListener('change', (event) => {
        const target = event.currentTarget as HTMLInputElement;
        refFrame.visible = target.checked;
        viewer?.setFrameVisible(refFrame.id, refFrame.visible);
    });
}

function renderJointPropertiesPanel(jointId: string): void {
    const joint = mbsJoints.get(jointId);
    const propsEl = document.getElementById('properties-panel');
    if (!joint || !propsEl) {
        updatePropertiesPanel(null);
        return;
    }

    setPanelMode('properties', '属性-连接');
    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('prop-joint-name', joint.name)}
        ${buildDropdown('prop-joint-type', '类型', normalizeConnectorType(joint.jointType), JOINT_TYPE_OPTIONS)}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="prop-joint-inference">智能推理</label>
            <input id="prop-joint-inference" type="checkbox"${joint.inferenceEnabled ? ' checked' : ''} />
        </div>
        <div class="opt-row">
            <label for="prop-joint-reverse">Z 轴反向</label>
            <input id="prop-joint-reverse" type="checkbox"${joint.zAxisReversed ? ' checked' : ''} />
        </div>
        <div class="opt-row">
            <label for="prop-joint-size">图标大小</label>
            <input id="prop-joint-size" class="opt-input" type="number" min="1" max="200" step="1" value="${Math.max(1, Math.round(joint.iconSize))}" />
        </div>
        ${buildSeparator()}
        ${createPropertyRow('零件 1', resolvePartRefName(joint.part1), { boxed: true })}
        ${createPropertyRow('零件 2', resolvePartRefName(joint.part2), { boxed: true })}
        ${buildSeparator()}
        ${buildVec3Input('prop-joint-pos', '位置（全局坐标）', joint.position.x, joint.position.y, joint.position.z)}
        ${buildVec3Input('prop-joint-dir', '方向（单位向量）', joint.direction.x, joint.direction.y, joint.direction.z)}
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="prop-joint-delete" class="opt-btn-secondary">删除</button>
            <button id="prop-joint-save" class="opt-btn-primary">保存修改</button>
        </div>
    </div>`;

    document.getElementById('prop-joint-save')?.addEventListener('click', () => {
        const nameInput = document.getElementById('prop-joint-name') as HTMLInputElement | null;
        const typeInput = document.getElementById('prop-joint-type') as HTMLSelectElement | null;
        const sizeInput = document.getElementById('prop-joint-size') as HTMLInputElement | null;
        const inferenceInput = document.getElementById('prop-joint-inference') as HTMLInputElement | null;
        const reverseInput = document.getElementById('prop-joint-reverse') as HTMLInputElement | null;
        const nextDirection = normalizeVector(readVec3FromInputs('prop-joint-dir')) ?? DEFAULT_CONNECTOR_DIRECTION;

        joint.name = nameInput?.value?.trim() || joint.name;
        joint.jointType = normalizeConnectorType(typeInput?.value, normalizeConnectorType(joint.jointType));
        joint.iconSize = Math.max(1, Number.parseFloat(sizeInput?.value ?? `${joint.iconSize}`) || joint.iconSize);
        joint.inferenceEnabled = inferenceInput?.checked ?? joint.inferenceEnabled;
        joint.zAxisReversed = reverseInput?.checked ?? joint.zAxisReversed;
        joint.position = readVec3FromInputs('prop-joint-pos');
        joint.direction = resolveConnectorDirection({
            inferenceEnabled: true,
            pickedDirection: nextDirection,
            reverseDirection: joint.zAxisReversed
        });
        syncJointEntityToViewer(joint.id);
        updateModelTree();
        renderJointPropertiesPanel(joint.id);
    });

    document.getElementById('prop-joint-delete')?.addEventListener('click', () => {
        deleteJointById(joint.id);
        updateSelectionPropertiesPanel();
    });
}

function renderMotionPropertiesPanel(motionId: string): void {
    const motion = mbsMotions.get(motionId);
    const propsEl = document.getElementById('properties-panel');
    if (!motion || !propsEl) {
        updatePropertiesPanel(null);
        return;
    }

    setPanelMode('properties', '属性-驱动');
    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('prop-motion-name', motion.name)}
        ${createPropertyRow('类型', resolveMotionTypeLabel(motion.motionType), { boxed: true })}
        ${buildDropdown('prop-motion-drive-mode', '驱动类型', motion.driveMode, getMotionDriveModeOptions(motion.motionType))}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="prop-motion-visible">可见性</label>
            <input id="prop-motion-visible" type="checkbox"${motion.visible ? ' checked' : ''} />
        </div>
        <div class="opt-row">
            <label for="prop-motion-size">图标大小</label>
            <input id="prop-motion-size" class="opt-input" type="number" min="1" max="50000" step="1" value="${Math.max(1, Math.round(motion.iconSize))}" />
        </div>
        ${buildSeparator()}
        ${createPropertyRow('连接', resolveMotionConnectorLabel(motion.connectorRef), { boxed: true })}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="prop-motion-phi">phi.start</label>
            <input id="prop-motion-phi" class="opt-input" type="number" step="0.01" value="${motion.phiStart}" />
        </div>
        <div class="opt-row">
            <label for="prop-motion-w">w.start</label>
            <input id="prop-motion-w" class="opt-input" type="number" step="0.01" value="${motion.wStart}" />
        </div>
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="prop-motion-delete" class="opt-btn-secondary">删除</button>
            <button id="prop-motion-save" class="opt-btn-primary">保存修改</button>
        </div>
    </div>`;

    document.getElementById('prop-motion-save')?.addEventListener('click', () => {
        const nameInput = document.getElementById('prop-motion-name') as HTMLInputElement | null;
        const driveModeInput = document.getElementById('prop-motion-drive-mode') as HTMLSelectElement | null;
        const visibleInput = document.getElementById('prop-motion-visible') as HTMLInputElement | null;
        const sizeInput = document.getElementById('prop-motion-size') as HTMLInputElement | null;
        const phiInput = document.getElementById('prop-motion-phi') as HTMLInputElement | null;
        const wInput = document.getElementById('prop-motion-w') as HTMLInputElement | null;

        motion.name = nameInput?.value.trim() || motion.name;
        motion.driveMode = normalizeMotionDriveMode(driveModeInput?.value, motion.motionType);
        motion.visible = visibleInput?.checked ?? motion.visible;
        motion.iconSize = Math.max(1, Number.parseFloat(sizeInput?.value ?? `${motion.iconSize}`) || motion.iconSize);
        motion.phiStart = Number.parseFloat(phiInput?.value ?? `${motion.phiStart}`) || 0;
        motion.wStart = Number.parseFloat(wInput?.value ?? `${motion.wStart}`) || 0;
        updateModelTree();
        renderMotionPropertiesPanel(motion.id);
    });

    document.getElementById('prop-motion-delete')?.addEventListener('click', () => {
        deleteMotionById(motion.id);
        updateSelectionPropertiesPanel();
    });
}

function renderContactPropertiesPanel(contactId: string): void {
    const contact = mbsContacts.get(contactId);
    const propsEl = document.getElementById('properties-panel');
    if (!contact || !propsEl) {
        updatePropertiesPanel(null);
        return;
    }

    setPanelMode('properties', '属性-接触');
    const partAName = loadedShapes.get(contact.partA)?.name ?? contact.partA;
    const partBName = loadedShapes.get(contact.partB)?.name ?? contact.partB;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('prop-contact-name', contact.name)}
        ${buildDropdown('prop-contact-type', '类型', contact.contactType, CONTACT_TYPE_OPTIONS)}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="prop-contact-visible">可见性</label>
            <input id="prop-contact-visible" type="checkbox"${contact.visible ? ' checked' : ''} />
        </div>
        <div class="opt-row">
            <label for="prop-contact-size">图标大小</label>
            <input id="prop-contact-size" class="opt-input" type="number" min="1" max="50000" step="1" value="${Math.max(1, Math.round(contact.iconSize))}" />
        </div>
        ${buildSeparator()}
        ${createPropertyRow('零件一', partAName, { boxed: true })}
        ${createPropertyRow('零件二', partBName, { boxed: true })}
        ${createPropertyRow('特征一', formatVec3(contact.featureA.position))}
        ${createPropertyRow('特征二', formatVec3(contact.featureB.position))}
        ${createPropertyRow('创建时间', contact.createdAt)}
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="prop-contact-delete" class="opt-btn-secondary">删除</button>
            <button id="prop-contact-save" class="opt-btn-primary">保存修改</button>
        </div>
    </div>`;

    document.getElementById('prop-contact-visible')?.addEventListener('change', (event) => {
        const target = event.currentTarget as HTMLInputElement;
        contact.visible = target.checked;
        const visual = contactVisuals.get(contact.id);
        if (visual) {
            visual.visible = contact.visible;
        }
    });

    document.getElementById('prop-contact-save')?.addEventListener('click', () => {
        const nameInput = document.getElementById('prop-contact-name') as HTMLInputElement | null;
        const typeInput = document.getElementById('prop-contact-type') as HTMLSelectElement | null;
        const sizeInput = document.getElementById('prop-contact-size') as HTMLInputElement | null;
        contact.name = nameInput?.value?.trim() || contact.name;
        contact.contactType = (typeInput?.value as ContactType) || contact.contactType;
        contact.iconSize = Math.max(1, Number.parseFloat(sizeInput?.value ?? `${contact.iconSize}`) || contact.iconSize);
        upsertContactVisual(contact);
        updateModelTree();
        renderContactPropertiesPanel(contact.id);
    });

    document.getElementById('prop-contact-delete')?.addEventListener('click', () => {
        deleteContactById(contact.id);
        updateSelectionPropertiesPanel();
    });
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
                const displayColor = normalizeImportedDisplayColor(node.name, node.type, node.color);
                const shape: LoadedShape = {
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    shapeId: node.shapeId,
                    color: displayColor,
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
                        if (displayColor) {
                            const colorHex = parseInt(displayColor.replace('#', ''), 16);
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
            initializeImportedGroupDesignState();

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

            // Keep the initial state unselected so downstream tools operate on
            // an explicit user-picked part instead of an implicit assembly-wide selection.

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
            initializeImportedGroupDesignState();
            updateModelTree();
            showProgress(100, 'Complete');
            setStatus('Ready');
            setStatusInfo(`${addedCount} shapes loaded`);

            // Keep the initial state unselected so downstream tools operate on
            // an explicit user-picked part instead of an implicit selection.

            vscode.postMessage({
                command: 'alert',
                text: `Successfully loaded ${addedCount} shapes from ${fileName}`
            });
        }

    } catch (error) {
        console.error('Failed to load STEP file:', error);
        const detail = error instanceof Error ? error.message : String(error);
        notifyError('PARSE_FILE_FAILED', detail, {
            text: 'Failed to load STEP file.',
            statusText: 'Error loading file',
            statusInfo: 'STEP import failed.'
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
        const detail = error instanceof Error ? error.message : String(error);
        notifyError('ERR_GENERATE_FILE_FAILED', detail, {
            text: 'Failed to export model.',
            statusText: 'Export failed',
            statusInfo: 'Model export failed.'
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
        size?: number;
        visible?: boolean;
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
        position?: Vec3;
        direction?: Vec3;
        iconSize?: number;
        inferenceEnabled?: boolean;
        zAxisReversed?: boolean;
    }>;
    motion: Array<{
        name: string;
        motionType: string;
        connectorRef: string;
        driveMode?: string;
        functionType?: string;
        iconSize?: number;
        visible?: boolean;
        visibility?: boolean;
        phiStart?: number;
        start?: number;
        wStart?: number;
        w?: number;
    }>;
    contact: Array<{
        name: string;
        partA: string;
        partB: string;
        iconSize?: number;
        visibility?: boolean;
        position?: Vec3;
        direction?: Vec3;
        params?: Record<string, unknown>;
        featureA?: { position?: Vec3; direction?: Vec3 };
        featureB?: { position?: Vec3; direction?: Vec3 };
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
    contacts: number;
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
    contacts: 0,
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

function subtractVec3(a: Vec3, b: Vec3): Vec3 {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z
    };
}

function distanceSquaredBetweenPoints(a: Vec3, b: Vec3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
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

function showMarkerPreview(draft: MarkerDraft): void {
    if (!viewer) {
        return;
    }

    viewer.addFrame({
        id: DRAFT_MARKER_ID,
        name: draft.name,
        position: draft.position,
        orientation: draft.orientation,
        size: draft.size,
        visible: true,
        isPrimary: true
    });
}

function buildMarkerPreviewDraft(selectedShape: LoadedShape, position: Vec3, normal: Vec3): MarkerDraft {
    const nameInput = document.getElementById('opt-marker-name') as HTMLInputElement | null;
    const sizeInput = document.getElementById('opt-marker-size') as HTMLInputElement | null;
    const owner = resolveFrameOwnerForShape(selectedShape.id);
    const fallbackSize = markerDraft?.size ?? pendingMarkerSize;

    return {
        name: nameInput?.value?.trim() || markerDraft?.name || `Marker${createdMarkers.length + 1}`,
        owner,
        hostShapeId: selectedShape.id,
        position: cloneVec3(position),
        orientation: createOrientationFromNormal(normal),
        size: Math.max(1, Number.parseFloat(sizeInput?.value ?? `${fallbackSize}`) || fallbackSize)
    };
}

function estimateShapeInferenceTolerance(shape: LoadedShape): number {
    const vertices = shape.meshData?.vertices;
    if (!vertices || vertices.length < 6) {
        return 1;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < vertices.length; index += 3) {
        minX = Math.min(minX, vertices[index]);
        minY = Math.min(minY, vertices[index + 1]);
        minZ = Math.min(minZ, vertices[index + 2]);
        maxX = Math.max(maxX, vertices[index]);
        maxY = Math.max(maxY, vertices[index + 1]);
        maxZ = Math.max(maxZ, vertices[index + 2]);
    }

    const diagonal = Math.sqrt(
        (maxX - minX) * (maxX - minX)
        + (maxY - minY) * (maxY - minY)
        + (maxZ - minZ) * (maxZ - minZ)
    );
    return Math.max(diagonal * 0.02, 0.5);
}

function inferPlacementFromEdgeEndpoints(shape: LoadedShape, hitPosition: Vec3, fallbackNormal: Vec3): { position: Vec3; normal: Vec3 } | null {
    const edgeVertices = shape.edgeData?.vertices;
    if (!edgeVertices || edgeVertices.length < 6) {
        return null;
    }

    const tolerance = estimateShapeInferenceTolerance(shape);
    const toleranceSq = tolerance * tolerance;
    let bestCandidate: { position: Vec3; normal: Vec3; endpointDistanceSq: number; segmentDistanceSq: number } | null = null;

    for (let index = 0; index + 5 < edgeVertices.length; index += 6) {
        const start: Vec3 = {
            x: edgeVertices[index],
            y: edgeVertices[index + 1],
            z: edgeVertices[index + 2]
        };
        const end: Vec3 = {
            x: edgeVertices[index + 3],
            y: edgeVertices[index + 4],
            z: edgeVertices[index + 5]
        };
        const segment = subtractVec3(end, start);
        const length = Math.sqrt(segment.x * segment.x + segment.y * segment.y + segment.z * segment.z);
        if (length <= 1e-9) {
            continue;
        }

        const toHit = subtractVec3(hitPosition, start);
        const t = Math.max(0, Math.min(1, ((toHit.x * segment.x) + (toHit.y * segment.y) + (toHit.z * segment.z)) / (length * length)));
        const closestPoint: Vec3 = {
            x: start.x + segment.x * t,
            y: start.y + segment.y * t,
            z: start.z + segment.z * t
        };
        const segmentDistanceSq = distanceSquaredBetweenPoints(hitPosition, closestPoint);
        if (segmentDistanceSq > toleranceSq) {
            continue;
        }

        const startDistanceSq = distanceSquaredBetweenPoints(hitPosition, start);
        const endDistanceSq = distanceSquaredBetweenPoints(hitPosition, end);
        const position = startDistanceSq <= endDistanceSq ? start : end;
        const direction = normalizeVector(segment) ?? fallbackNormal;
        const endpointDistanceSq = Math.min(startDistanceSq, endDistanceSq);

        if (!bestCandidate
            || segmentDistanceSq < bestCandidate.segmentDistanceSq
            || (segmentDistanceSq === bestCandidate.segmentDistanceSq && endpointDistanceSq < bestCandidate.endpointDistanceSq)) {
            bestCandidate = {
                position: cloneVec3(position),
                normal: direction,
                endpointDistanceSq,
                segmentDistanceSq
            };
        }
    }

    if (!bestCandidate || bestCandidate.endpointDistanceSq > toleranceSq * 4) {
        return null;
    }

    return {
        position: bestCandidate.position,
        normal: bestCandidate.normal
    };
}

function inferPlacementFromCircularEdge(
    shape: LoadedShape,
    hitPosition: Vec3,
    fallbackNormal: Vec3
): { position: Vec3; normal: Vec3; guide: MarkerGuideData } | null {
    if (!markerFeatureInferenceEnabled) {
        return null;
    }

    const tolerance = estimateShapeInferenceTolerance(shape);
    const candidate = findNearestCircularEdge(shape.edgeData, hitPosition, {
        proximityTolerance: Math.max(tolerance * 0.6, 0.25)
    });
    if (!candidate) {
        return null;
    }

    const dot = (candidate.normal.x * fallbackNormal.x)
        + (candidate.normal.y * fallbackNormal.y)
        + (candidate.normal.z * fallbackNormal.z);
    const alignedNormal = dot < 0
        ? { x: -candidate.normal.x, y: -candidate.normal.y, z: -candidate.normal.z }
        : candidate.normal;

    return {
        position: cloneVec3(candidate.center),
        normal: alignedNormal,
        guide: {
            kind: 'circle',
            center: cloneVec3(candidate.center),
            normal: cloneVec3(alignedNormal),
            radius: candidate.radius
        }
    };
}

function pickShapeAtScreenPoint(screenX: number, screenY: number): LoadedShape | null {
    const objectId = viewer?.pickSelectableIdAtScreenPoint(screenX, screenY) ?? null;
    if (!objectId) {
        return null;
    }

    const shapeId = meshIdToShapeId.get(objectId);
    if (!shapeId) {
        return null;
    }

    return loadedShapes.get(shapeId) ?? null;
}

function pickShapeAtPointerEvent(event: MouseEvent): LoadedShape | null {
    return pickShapeAtScreenPoint(event.clientX, event.clientY);
}

function inferMarkerPlacement(
    selectedShape: LoadedShape,
    hitPosition: Vec3,
    fallbackNormal: Vec3,
    geometryHint: {
        snapPoint?: Vec3;
        snapDirection?: Vec3;
        snapKind?: string;
        snapConfidence?: number;
    } | null
): { position: Vec3; normal: Vec3 } {
    if (!markerFeatureInferenceEnabled) {
        return {
            position: cloneVec3(hitPosition),
            normal: cloneVec3(fallbackNormal)
        };
    }

    const snapPoint = geometryHint?.snapPoint ? cloneVec3(geometryHint.snapPoint) : null;
    const snapDirection = geometryHint?.snapDirection
        ? normalizeVector(geometryHint.snapDirection) ?? null
        : null;
    if (geometryHint?.snapKind === 'sphere-center' && snapPoint && snapDirection && (geometryHint.snapConfidence ?? 0) >= 0.5) {
        return {
            position: snapPoint,
            normal: snapDirection
        };
    }
    if (geometryHint?.snapKind === 'cylinder-axis' && snapPoint && snapDirection && (geometryHint.snapConfidence ?? 0) >= 0.5) {
        return {
            position: snapPoint,
            normal: snapDirection
        };
    }

    const edgePlacement = inferPlacementFromEdgeEndpoints(selectedShape, hitPosition, fallbackNormal);
    if (edgePlacement) {
        return edgePlacement;
    }

    return {
        position: cloneVec3(hitPosition),
        normal: cloneVec3(fallbackNormal)
    };
}

function clearMarkerDraftPreview(): void {
    markerDraft = null;
    if (viewer) {
        viewer.removeFrame(DRAFT_MARKER_ID);
        viewer.setMarkerGuide(null);
    }
}

function syncMarkerDraftPreview(): void {
    if (!viewer || !markerDraft) {
        return;
    }
    showMarkerPreview(markerDraft);
}

function resetCanvasInteraction(): void {
    editingFrameTarget = null;
    frameEditPickIntent = 'placement';
    markerDraftPickIntent = 'placement';
    jointDraftPickStage = 'part1';
    designPointPickIntent = 'placement';
    canvasInteractionMode = 'none';
    markerCreationPanelActive = false;
    jointCreationPanelActive = false;
    motionCreationPanelActive = false;
    refFrameCreationPanelActive = false;
    designPointCreationPanelActive = false;
    contactCreationPanelActive = false;
    motionCreationMode = 'fast';
    designPointCreationMode = 'pick';
    designPointCalcMode = 'midpoint';
    designPointDraft = null;
    jointDraft = null;
    motionDraft = null;
    contactDraft = null;
    clearMarkerDraftPreview();
    viewer?.setSelectionEnabled(true);
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
    if (value.trim().toLowerCase() === 'ground') {
        return { resolved: GROUND_PART_ID, matched: true };
    }
    const mapped = shapeNameToId.get(value);
    if (mapped) {
        return { resolved: mapped, matched: true };
    }
    return { resolved: value, matched: false };
}

function clearCadtoolRuntimeEntities(): void {
    clearContactPartHighlights();
    if (viewer) {
        createdMarkers.forEach(marker => {
            viewer.removeFrame(marker.id);
        });
        createdRefFrames.forEach((refFrame) => {
            viewer.removeFrame(refFrame.id);
        });
        mbsDesignPoints.forEach((designPoint) => {
            viewer.removeFrame(designPoint.id);
        });
        mbsJoints.forEach((joint) => {
            viewer.removeJoint(joint.id);
        });
        Array.from(contactVisuals.keys()).forEach((contactId) => {
            removeContactVisual(contactId);
        });
    }

    createdMarkers.length = 0;
    createdRefFrames.clear();
    mbsDesignPoints.clear();
    mbsContacts.clear();
    contactVisuals.clear();
    frameCreationHistory.length = 0;
    resetCanvasInteraction();
    groupDesignState = createEmptyGroupDesignState(getAllGroupablePartIds());
    selectedNodeIds.clear();
    activeSelectionKey = null;
    selectedShapeId = null;
    selectedGroupId = null;
    selectedMarkerId = null;
    selectedRefFrameId = null;
    selectedJointId = null;
    selectedMotionId = null;
    selectedDesignPointId = null;
    selectedContactId = null;
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
        let hostPartId: string | undefined;
        if (groupRef) {
            groupId = groupNameToId.get(groupRef) ?? shapeNameToId.get(groupRef) ?? groupRef;
            if (!groupNameToId.has(groupRef) && !shapeNameToId.has(groupRef)) {
                addImportWarning(stats, `marker "${name}" references unknown groupRef "${groupRef}", keeping raw reference.`);
            }
        } else if (partRef) {
            const partId = shapeNameToId.get(partRef) ?? partRef;
            hostPartId = partId;
            groupId = resolveOwningGroupId(partId) ?? partId;
            if (!shapeNameToId.has(partRef) && loadedShapes.size > 0) {
                addImportWarning(stats, `marker "${name}" references unknown partRef "${partRef}", keeping raw reference.`);
            }
        }

        if (!groupId) {
            groupId = getActiveGroupId() ?? resolveOwningGroupId(selectedShapeId ?? undefined) ?? selectedShapeId ?? '__unassigned__';
            addImportWarning(stats, `marker "${name}" has no groupRef/partRef; assigned to "${groupId}".`);
        }
        if (!hostPartId && groupId && loadedShapes.has(groupId)) {
            hostPartId = groupId;
        }

        const parsedPosition = parseVector3(entry.position);
        const parsedDirection = normalizeVector(parseVector3(entry.direction));
        const parsedSize = typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : -1;
        const parsedVisible = typeof entry.visible === 'boolean' ? entry.visible : true;

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
                groupId,
                parentId: hostPartId,
                position: resolvedPosition,
                orientation: resolvedOrientation,
                size: parsedSize > 0 ? parsedSize : (relatedMarker?.size ?? pendingMarkerSize),
                visible: parsedVisible,
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
                    size: refFrame.size,
                    visible: refFrame.visible,
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
            marker.setParentId(hostPartId);
            marker.setSize(parsedSize);
            marker.setVisible(parsedVisible);

            createdMarkers.push(marker);
            markerNameToId.set(marker.name, marker.id);
            if (viewer) {
                viewer.addFrame({
                    id: marker.id,
                    name: marker.name,
                    position: marker.position,
                    orientation: marker.orientation,
                    size: marker.size,
                    visible: marker.visible,
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
            name: getUniqueDesignPointName(name),
            groupId,
            markerRefId,
            position: clampDesignPointPosition(position),
            direction: parsedDirection ?? (markerRefEntity ? orientationToDirection(markerRefEntity.orientation) : undefined),
            size: clampDesignPointSize(sizeValue),
            isDirectionReverse,
            offsetValue,
            createdAt: new Date().toISOString()
        };
        mbsDesignPoints.set(designPoint.id, designPoint);
        viewer?.addFrame({
            id: designPoint.id,
            name: designPoint.name,
            position: designPoint.position,
            orientation: createOrientationFromNormal(designPoint.direction ?? { x: 0, y: 0, z: 1 }),
            size: clampDesignPointSize(designPoint.size),
            visible: true,
            isPrimary: false
        });
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

        const parsedPosition = parseVector3(entry.position) ?? calculateShapeWorldCenter(resolvedPart1.resolved);
        const parsedDirection = resolveConnectorDirection({
            inferenceEnabled: typeof entry.inferenceEnabled === 'boolean' ? entry.inferenceEnabled : true,
            pickedDirection: parseVector3(entry.direction),
            reverseDirection: typeof entry.zAxisReversed === 'boolean' ? entry.zAxisReversed : false
        });

        const joint: MbsJointEntity = {
            id: nextEntityId('joint', mbsJoints.size),
            name,
            jointType: normalizeConnectorType(connectorType),
            part1: resolvedPart1.resolved,
            part2: resolvedPart2.resolved,
            position: parsedPosition,
            direction: parsedDirection,
            iconSize: typeof entry.iconSize === 'number' && Number.isFinite(entry.iconSize) ? entry.iconSize : pendingJointIconSize,
            inferenceEnabled: typeof entry.inferenceEnabled === 'boolean' ? entry.inferenceEnabled : true,
            zAxisReversed: typeof entry.zAxisReversed === 'boolean' ? entry.zAxisReversed : false,
            createdAt: new Date().toISOString()
        };
        mbsJoints.set(joint.id, joint);
        viewer?.addJoint(buildJointViewerData(joint));
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

        const normalizedMotionType = normalizeMotionType(motionType);
        const jointRef = Array.from(mbsJoints.values()).find((joint) => joint.id === connectorRef || joint.name === connectorRef) ?? null;
        if (!jointRef) {
            addImportWarning(stats, `motion "${name}" references unknown connector "${connectorRef}", keeping raw reference.`);
        } else if (!isDriveCompatibleJointType(jointRef.jointType)) {
            addImportWarning(stats, `motion "${name}" references connector "${connectorRef}" which is not drive-compatible.`);
        }

        const driveMode = normalizeMotionDriveMode(
            toNonEmptyString(entry.driveMode) ?? toNonEmptyString(entry.functionType),
            normalizedMotionType
        );

        const motion: MbsMotionEntity = {
            id: nextEntityId('motion', mbsMotions.size),
            name,
            motionType: normalizedMotionType,
            driveMode,
            connectorRef: jointRef?.id ?? connectorRef,
            iconSize: typeof entry.iconSize === 'number' && Number.isFinite(entry.iconSize) ? entry.iconSize : pendingMotionIconSize,
            visible: typeof entry.visible === 'boolean'
                ? entry.visible
                : (typeof entry.visibility === 'boolean' ? entry.visibility : true),
            phiStart: typeof entry.phiStart === 'number'
                ? entry.phiStart
                : (typeof entry.start === 'number' ? entry.start : 0),
            wStart: typeof entry.wStart === 'number'
                ? entry.wStart
                : (typeof entry.w === 'number' ? entry.w : 0),
            createdAt: new Date().toISOString()
        };
        mbsMotions.set(motion.id, motion);
        stats.motions += 1;
    });

    const contacts = getConfigArray(data, 'contact', stats);
    contacts.forEach((entry, index) => {
        if (!isJsonRecord(entry)) {
            stats.skipped += 1;
            addImportWarning(stats, `contact[${index}] is not an object and was skipped.`);
            return;
        }

        const name = toNonEmptyString(entry.name);
        const partA = toNonEmptyString(entry.partA);
        const partB = toNonEmptyString(entry.partB);
        if (!name || !partA || !partB) {
            stats.skipped += 1;
            addImportWarning(stats, `contact[${index}] is missing required fields and was skipped.`);
            return;
        }

        const resolvedPartA = resolveShapeRef(partA, shapeNameToId);
        const resolvedPartB = resolveShapeRef(partB, shapeNameToId);
        if (!resolvedPartA.matched && loadedShapes.size > 0) {
            addImportWarning(stats, `contact "${name}" references unknown partA "${partA}", keeping raw reference.`);
        }
        if (!resolvedPartB.matched && loadedShapes.size > 0) {
            addImportWarning(stats, `contact "${name}" references unknown partB "${partB}", keeping raw reference.`);
        }

        const params = isJsonRecord(entry.params) ? entry.params : null;
        const featureARecord = isJsonRecord(entry.featureA) ? entry.featureA : null;
        const featureBRecord = isJsonRecord(entry.featureB) ? entry.featureB : null;
        const anchorA = getShapeContactAnchor(resolvedPartA.resolved);
        const anchorB = getShapeContactAnchor(resolvedPartB.resolved);

        const contact: MbsContactEntity = {
            id: nextEntityId('contact', mbsContacts.size),
            name,
            contactType: (
                toNonEmptyString(entry.contactType)
                ?? toNonEmptyString(params?.contactType)
                ?? 'pointPoint'
            ) as ContactType,
            partA: resolvedPartA.resolved,
            partB: resolvedPartB.resolved,
            featureA: {
                shapeId: resolvedPartA.resolved,
                position: parseVector3(featureARecord?.position) ?? anchorA.position,
                normal: normalizeVector(parseVector3(featureARecord?.direction)) ?? anchorA.normal
            },
            featureB: {
                shapeId: resolvedPartB.resolved,
                position: parseVector3(featureBRecord?.position) ?? anchorB.position,
                normal: normalizeVector(parseVector3(featureBRecord?.direction)) ?? anchorB.normal
            },
            iconSize: typeof entry.iconSize === 'number' && Number.isFinite(entry.iconSize)
                ? Math.max(1, entry.iconSize)
                : pendingContactSize,
            visible: typeof entry.visibility === 'boolean' ? entry.visibility : true,
            createdAt: new Date().toISOString()
        };

        mbsContacts.set(contact.id, contact);
        upsertContactVisual(contact);
        stats.contacts += 1;
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
        `CADTool config imported: groups=${stats.groups}, markers=${stats.markers}, designPoints=${stats.designPoints}, connectors=${stats.connectors}, motions=${stats.motions}, contacts=${stats.contacts}`
    );

    const summary = `CADTool config import complete${sourceLabel}: groups=${stats.groups}, markers=${stats.markers}, designPoints=${stats.designPoints}, connectors=${stats.connectors}, motions=${stats.motions}, contacts=${stats.contacts}, ribSlices=${stats.ribSlices}, fluidPorts=${stats.fluidPorts}, skipped=${stats.skipped}.`;
    notifyInfo(summary);

    if (stats.warningCount > 0) {
        const hiddenWarnings = stats.warningCount - stats.warnings.length;
        const warningText = hiddenWarnings > 0
            ? `${stats.warnings.join(' | ')} | ... and ${hiddenWarnings} more warning(s).`
            : stats.warnings.join(' | ');
        notifyWarning(`CADTool config import warnings (${stats.warningCount}).`, {
            detail: warningText,
            statusInfo: `CADTool config import completed with ${stats.warningCount} warning(s).`
        });
    }
}

function resolvePartRefName(shapeId: string | undefined): string {
    if (!shapeId) {
        return '';
    }
    if (shapeId === GROUND_PART_ID) {
        return 'Ground';
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
        partRef: marker.parentId ? resolvePartRefName(marker.parentId) : undefined,
        position: cloneVec3(marker.position),
        direction: orientationToDirection(marker.orientation),
        size: marker.size,
        visible: marker.visible
    }));

    const refMarkerEntries = Array.from(createdRefFrames.values()).map((refFrame) => ({
        name: refFrame.name,
        groupRef: resolveGroupRefName(refFrame.groupId),
        partRef: refFrame.parentId ? resolvePartRefName(refFrame.parentId) : undefined,
        position: cloneVec3(refFrame.position),
        direction: orientationToDirection(refFrame.orientation),
        size: refFrame.size,
        visible: refFrame.visible,
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
            connectorType: normalizeConnectorType(joint.jointType),
            part1: resolvePartRefName(joint.part1),
            part2: resolvePartRefName(joint.part2),
            position: joint.position,
            direction: joint.direction,
            iconSize: joint.iconSize,
            inferenceEnabled: joint.inferenceEnabled,
            zAxisReversed: joint.zAxisReversed
        })),
        motion: Array.from(mbsMotions.values()).map(motion => ({
            name: motion.name,
            motionType: motion.motionType,
            connectorRef: mbsJoints.get(motion.connectorRef)?.name ?? motion.connectorRef,
            driveMode: motion.driveMode,
            iconSize: motion.iconSize,
            visible: motion.visible,
            phiStart: motion.phiStart,
            wStart: motion.wStart
        })),
        contact: Array.from(mbsContacts.values()).map((contact) => ({
            name: contact.name,
            partA: resolvePartRefName(contact.partA),
            partB: resolvePartRefName(contact.partB),
            iconSize: contact.iconSize,
            visibility: contact.visible,
            featureA: {
                position: cloneVec3(contact.featureA.position),
                direction: cloneVec3(contact.featureA.normal)
            },
            featureB: {
                position: cloneVec3(contact.featureB.position),
                direction: cloneVec3(contact.featureB.normal)
            },
            params: {
                contactType: contact.contactType
            }
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
            `CADTool config exported: groups=${exportData.group.length}, markers=${exportData.marker.length}, designPoints=${exportData.designPoint.length}, connectors=${exportData.connector.length}, motions=${exportData.motion.length}, contacts=${exportData.contact.length}`
        );
    } catch (error) {
        console.error('Failed to export CADTool config:', error);
        const detail = error instanceof Error ? error.message : String(error);
        notifyError('ERR_GENERATE_FILE_FAILED', detail, {
            text: 'Failed to export CADTool config.',
            statusText: 'CADTool config export failed',
            statusInfo: 'CADTool config export failed.'
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

function sanitizeDesignPointName(name: string, fallback: string): string {
    const normalized = name.trim().replace(/[^A-Za-z0-9_]/g, '_');
    if (normalized.length === 0) {
        return fallback;
    }
    return /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
}

function collectReservedEntityNames(ignoreDesignPointId?: string): Set<string> {
    const names = new Set<string>();
    loadedShapes.forEach((shape) => names.add(shape.name));
    listGroups().forEach((group) => names.add(group.name));
    createdMarkers.forEach((marker) => names.add(marker.name));
    Array.from(createdRefFrames.values()).forEach((refFrame) => names.add(refFrame.name));
    Array.from(mbsDesignPoints.values())
        .filter((point) => point.id !== ignoreDesignPointId)
        .forEach((point) => names.add(point.name));
    Array.from(mbsJoints.values()).forEach((joint) => names.add(joint.name));
    Array.from(mbsMotions.values()).forEach((motion) => names.add(motion.name));
    Array.from(fluidSlices.values()).forEach((slice) => names.add(slice.name));
    Array.from(fluidPorts.values()).forEach((port) => names.add(port.name));
    return names;
}

function getUniqueDesignPointName(desiredName: string, ignoreDesignPointId?: string): string {
    const fallback = `DesignPoint${mbsDesignPoints.size + 1}`;
    const normalized = sanitizeDesignPointName(desiredName, fallback);
    const reservedNames = collectReservedEntityNames(ignoreDesignPointId);
    if (!reservedNames.has(normalized)) {
        return normalized;
    }

    let index = 1;
    while (reservedNames.has(`${normalized}_${index}`)) {
        index += 1;
    }
    return `${normalized}_${index}`;
}

function clampDesignPointSize(value: number): number {
    const rounded = Math.round(Number.isFinite(value) ? value : pendingDesignPointSize);
    return Math.min(50000, Math.max(1, rounded));
}

function clampDesignPointPosition(position: Vec3): Vec3 {
    const clampAxis = (value: number): number => Math.min(1000, Math.max(-1000, Number.isFinite(value) ? value : 0));
    return {
        x: clampAxis(position.x),
        y: clampAxis(position.y),
        z: clampAxis(position.z)
    };
}

function calculateMidpoint(pointA: Vec3, pointB: Vec3): Vec3 {
    return {
        x: (pointA.x + pointB.x) / 2,
        y: (pointA.y + pointB.y) / 2,
        z: (pointA.z + pointB.z) / 2
    };
}

function calculateOffsetPoint(basePoint: Vec3, direction: Vec3, offsetValue: number, reverse = false): Vec3 {
    const normalized = normalizeVector(direction);
    if (!normalized) {
        throw new Error('Offset direction is invalid.');
    }
    const distance = Number.isFinite(offsetValue) ? offsetValue : 0;
    const sign = reverse ? -1 : 1;
    return {
        x: basePoint.x + normalized.x * distance * sign,
        y: basePoint.y + normalized.y * distance * sign,
        z: basePoint.z + normalized.z * distance * sign
    };
}

function intersectLineWithPlane(
    linePoint: Vec3,
    lineDirection: Vec3,
    planePoint: Vec3,
    planeNormal: Vec3
): Vec3 {
    const direction = normalizeVector(lineDirection);
    const normal = normalizeVector(planeNormal);
    if (!direction || !normal) {
        throw new Error('Intersection feature is invalid.');
    }
    const denominator = direction.x * normal.x + direction.y * normal.y + direction.z * normal.z;
    if (Math.abs(denominator) <= 1e-6) {
        throw new Error('Selected line and plane do not intersect.');
    }
    const t = (
        (planePoint.x - linePoint.x) * normal.x
        + (planePoint.y - linePoint.y) * normal.y
        + (planePoint.z - linePoint.z) * normal.z
    ) / denominator;
    return {
        x: linePoint.x + direction.x * t,
        y: linePoint.y + direction.y * t,
        z: linePoint.z + direction.z * t
    };
}

function intersectLineWithLine(lineA: DesignPointFeatureLine, lineB: DesignPointFeatureLine): Vec3 {
    const p1 = lineA.point;
    const p2 = lineB.point;
    const d1 = normalizeVector(lineA.direction);
    const d2 = normalizeVector(lineB.direction);
    if (!d1 || !d2) {
        throw new Error('Selected line feature is invalid.');
    }

    const w0 = subtractVec3(p1, p2);
    const a = d1.x * d1.x + d1.y * d1.y + d1.z * d1.z;
    const b = d1.x * d2.x + d1.y * d2.y + d1.z * d2.z;
    const c = d2.x * d2.x + d2.y * d2.y + d2.z * d2.z;
    const d = d1.x * w0.x + d1.y * w0.y + d1.z * w0.z;
    const e = d2.x * w0.x + d2.y * w0.y + d2.z * w0.z;
    const denominator = a * c - b * b;
    if (Math.abs(denominator) <= 1e-6) {
        throw new Error('Selected line features are parallel or nearly parallel.');
    }

    const s = (b * e - c * d) / denominator;
    const t = (a * e - b * d) / denominator;
    const pointA = {
        x: p1.x + d1.x * s,
        y: p1.y + d1.y * s,
        z: p1.z + d1.z * s
    };
    const pointB = {
        x: p2.x + d2.x * t,
        y: p2.y + d2.y * t,
        z: p2.z + d2.z * t
    };
    const gap = Math.sqrt(
        Math.pow(pointA.x - pointB.x, 2)
        + Math.pow(pointA.y - pointB.y, 2)
        + Math.pow(pointA.z - pointB.z, 2)
    );
    if (gap > 1e-3) {
        throw new Error('Selected line features do not share a stable intersection.');
    }
    return calculateMidpoint(pointA, pointB);
}

function calculateIntersectionPoint(featureA: DesignPointFeature, featureB: DesignPointFeature): Vec3 {
    if (featureA.kind === 'line' && featureB.kind === 'line') {
        return intersectLineWithLine(featureA, featureB);
    }
    if (featureA.kind === 'line' && featureB.kind === 'plane') {
        return intersectLineWithPlane(featureA.point, featureA.direction, featureB.point, featureB.normal);
    }
    if (featureA.kind === 'plane' && featureB.kind === 'line') {
        return intersectLineWithPlane(featureB.point, featureB.direction, featureA.point, featureA.normal);
    }
    throw new Error('Two plane features do not produce a single design point.');
}

function getFrameReferenceOptions(): Array<{ value: string; text: string }> {
    return [
        { value: '', text: '(无)' },
        ...createdMarkers.map((marker) => ({ value: marker.id, text: `标架: ${marker.name}` })),
        ...Array.from(createdRefFrames.values()).map((refFrame) => ({ value: refFrame.id, text: `参考标架: ${refFrame.name}` }))
    ];
}

function getFrameReferenceLabel(frameId?: string): string {
    if (!frameId) {
        return '(无)';
    }
    const marker = createdMarkers.find((item) => item.id === frameId);
    if (marker) {
        return `标架: ${marker.name}`;
    }
    const refFrame = createdRefFrames.get(frameId);
    if (refFrame) {
        return `参考标架: ${refFrame.name}`;
    }
    return frameId;
}

function createLooseDesignPointDraft(): DesignPointDraft {
    return {
        name: getUniqueDesignPointName(`DesignPoint${mbsDesignPoints.size + 1}`),
        groupId: '__unassigned__',
        hostShapeId: '__unassigned__',
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        markerRefId: resolveLatestExistingFrameFromHistory()?.id,
        size: pendingDesignPointSize,
        isDirectionReverse: false,
        offsetValue: 0
    };
}

function createEmptyDesignPointDraft(shape: LoadedShape): DesignPointDraft {
    const owner = resolveFrameOwnerForShape(shape.id);
    return {
        name: getUniqueDesignPointName(`DesignPoint${mbsDesignPoints.size + 1}`),
        groupId: owner.id,
        hostShapeId: shape.id,
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        markerRefId: resolveLatestExistingFrameFromHistory()?.id,
        size: pendingDesignPointSize,
        isDirectionReverse: false,
        offsetValue: 0
    };
}

function recalculateDesignPointDraft(draft: DesignPointDraft, silent = false): boolean {
    try {
        if (designPointCreationMode === 'pick') {
            if (draft.isDirectionReverse) {
                const reversed = normalizeVector({
                    x: -draft.direction.x,
                    y: -draft.direction.y,
                    z: -draft.direction.z
                });
                draft.direction = reversed ?? draft.direction;
            }
            draft.position = clampDesignPointPosition(draft.position);
            return true;
        }

        if (designPointCalcMode === 'midpoint') {
            if (!draft.firstPoint || !draft.secondPoint) {
                return false;
            }
            draft.position = clampDesignPointPosition(calculateMidpoint(draft.firstPoint, draft.secondPoint));
            const midpointDirection = normalizeVector(subtractVec3(draft.secondPoint, draft.firstPoint));
            if (midpointDirection) {
                draft.direction = midpointDirection;
            }
            return true;
        }

        if (designPointCalcMode === 'offset') {
            if (!draft.basePoint) {
                return false;
            }
            draft.position = clampDesignPointPosition(
                calculateOffsetPoint(draft.basePoint, draft.direction, draft.offsetValue, draft.isDirectionReverse)
            );
            return true;
        }

        if (!draft.featureA || !draft.featureB) {
            return false;
        }
        draft.position = clampDesignPointPosition(calculateIntersectionPoint(draft.featureA, draft.featureB));
        if (draft.featureA.kind === 'line') {
            draft.direction = draft.featureA.direction;
        } else if (draft.featureB.kind === 'line') {
            draft.direction = draft.featureB.direction;
        } else {
            draft.direction = draft.featureA.normal;
        }
        return true;
    } catch (error) {
        if (!silent) {
            vscode.postMessage({
                command: 'alert',
                text: error instanceof Error ? error.message : `Design point calculation failed: ${error}`
            });
        }
        return false;
    }
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

function bindModeSwitchEvents(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            container.querySelectorAll<HTMLElement>('[data-mode]').forEach((item) => {
                item.className = item.dataset.mode === mode ? 'opt-mode-btn-active' : 'opt-mode-btn';
            });
        });
    });
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

function bindTabBarEvents(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            container.querySelectorAll<HTMLElement>('[data-tab]').forEach((item) => {
                item.className = item.dataset.tab === tabId ? 'opt-tab-active' : 'opt-tab';
            });
        });
    });
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
    if (
        canvasInteractionMode !== 'none'
        || markerCreationPanelActive
        || jointCreationPanelActive
        || refFrameCreationPanelActive
        || motionCreationPanelActive
        || designPointCreationPanelActive
        || contactCreationPanelActive
    ) {
        resetCanvasInteraction();
    }
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

function finalizeMarkerDraft(): void {
    if (!markerDraft) {
        vscode.postMessage({
            command: 'alert',
            text: '请先在三维视图中拾取标架位置。'
        });
        return;
    }

    const nameInput = document.getElementById('opt-marker-name') as HTMLInputElement | null;
    const sizeInput = document.getElementById('opt-marker-size') as HTMLInputElement | null;
    const direction = normalizeVector(readVec3FromInputs('opt-marker-dir')) ?? orientationToDirection(markerDraft.orientation);
    const position = readVec3FromInputs('opt-marker-pos');
    const size = Math.max(1, Number.parseFloat(sizeInput?.value ?? `${markerDraft.size}`) || markerDraft.size);
    const marker = markerCreator.createMarker({
        position,
        normal: direction,
        groupId: markerDraft.owner.id,
        name: nameInput?.value?.trim() || markerDraft.name
    });
    marker.setParentId(markerDraft.hostShapeId);
    marker.setSize(size);
    marker.setVisible(true);

    createdMarkers.push(marker);
    pendingMarkerSize = size;
    clearMarkerDraftPreview();
    recordFrameCreation(marker.id, 'marker');
    viewer?.addFrame({
        id: marker.id,
        name: marker.name,
        position: marker.position,
        orientation: marker.orientation,
        size: marker.size,
        visible: marker.visible,
        isPrimary: true
    });
    updateModelTree();
    selectSelection({ kind: 'marker', id: marker.id });
    viewer?.setSelectionEnabled(false);
    renderMarkerCreationPanel();
    setStatus('Click on a face to create marker');
    setStatusInfo(`Marker created: ${marker.name}`);
}

function createReferenceFrameFromSelection(baseMarkerId: string, targetShapeId: string): boolean {
    const relatedMarker = createdMarkers.find((marker) => marker.id === baseMarkerId);
    const targetShape = loadedShapes.get(targetShapeId);

    const restoreRefFrameCreationPanel = (statusInfo?: string): void => {
        // Keep reference-marker workflow active after failed attempts so users can continue quickly.
        renderRefFrameCreationPanel();
        setStatus('Select a basic marker and target part to create reference marker');
        if (statusInfo) {
            setStatusInfo(statusInfo);
        }
    };

    if (!relatedMarker || !targetShape) {
        restoreRefFrameCreationPanel('Reference marker creation is waiting for a valid base marker and target part.');
        return false;
    }

    const targetOwner = resolveFrameOwnerForShape(targetShape.id);
    const validation = validateReferenceMarkerCreation(
        relatedMarker.groupId,
        targetOwner.id,
        buildMarkerDesignGroupMap()
    );
    if (!validation.valid) {
        const reason = validation.reason ?? '参考标架创建失败。';
        vscode.postMessage({
            command: 'alert',
            text: reason
        });
        restoreRefFrameCreationPanel(reason);
        return false;
    }

    const refFrame: MbsRefFrameEntity = {
        id: nextEntityId('refMarker', createdRefFrames.size),
        // Keep the reference marker name aligned with the base marker for traceable pairing.
        name: relatedMarker.name,
        groupId: targetOwner.id,
        parentId: targetShape.id,
        position: cloneVec3(relatedMarker.position),
        orientation: cloneMat3(relatedMarker.orientation),
        size: relatedMarker.size,
        visible: true,
        relatedMarkerId: relatedMarker.id,
        createdAt: new Date().toISOString()
    };
    createdRefFrames.set(refFrame.id, refFrame);
    relatedMarker.appendRefMarker(refFrame.id);
    recordFrameCreation(refFrame.id, 'refFrame');
    viewer?.addFrame({
        id: refFrame.id,
        name: refFrame.name,
        position: refFrame.position,
        orientation: refFrame.orientation,
        size: refFrame.size,
        visible: refFrame.visible,
        isPrimary: false
    });
    updateModelTree();
    selectSelection({ kind: 'refFrame', id: refFrame.id });
    renderRefFrameCreationPanel();
    setStatus('Select a basic marker and target part to create reference marker');
    setStatusInfo(`Reference marker created: ${refFrame.name}`);
    return true;
}

function renderMarkerCreationPanel(): void {
    markerCreationPanelActive = true;
    setPanelMode('options', '选项-标架');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) {
        return;
    }

    const draftPosition = markerDraft?.position ?? { x: 0, y: 0, z: 0 };
    const draftDirection = markerDraft ? orientationToDirection(markerDraft.orientation) : { x: 0, y: 0, z: 1 };
    const modeRow = `<div class="opt-mode-row">
        <button id="opt-marker-mode-fast" class="${markerCreationMode === 'fast' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">闪电模式</button>
        <button id="opt-marker-mode-standard" class="${markerCreationMode === 'standard' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">标准模式</button>
    </div>`;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-marker-name', markerDraft?.name ?? `Marker${createdMarkers.length + 1}`)}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-marker-size">图标大小</label>
            <input id="opt-marker-size" class="opt-input" type="number" min="1" step="1" value="${Math.max(1, markerDraft?.size ?? pendingMarkerSize)}" />
        </div>
        ${buildSeparator()}
        ${modeRow}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-marker-inference">智能推断</label>
            <input id="opt-marker-inference" type="checkbox"${markerFeatureInferenceEnabled ? ' checked' : ''} />
        </div>
        ${markerCreationMode === 'standard' ? `${buildSeparator()}
        ${buildVec3Input('opt-marker-pos', '位置（全局坐标）', draftPosition.x, draftPosition.y, draftPosition.z)}
        ${buildSeparator()}
        ${buildVec3Input('opt-marker-dir', '方向（单位向量）', draftDirection.x, draftDirection.y, draftDirection.z)}
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="opt-marker-pick-placement" class="opt-btn-secondary">拾取放置</button>
            <button id="opt-marker-pick-position" class="opt-btn-secondary">拾取位置</button>
            <button id="opt-marker-pick-direction" class="opt-btn-secondary">拾取方向</button>
        </div>
        ${buildSeparator()}
        ${buildActionButtons('opt-marker-confirm', '添加', 'opt-marker-cancel')}` : `${buildSeparator()}
        <div class="opt-hint">当前为闪电模式，拾取面后立即创建标架。</div>
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="opt-marker-cancel" class="opt-btn-secondary">取消</button>
        </div>`}
    </div>`;

    document.getElementById('opt-marker-mode-fast')?.addEventListener('click', () => {
        markerCreationMode = 'fast';
        renderMarkerCreationPanel();
    });
    document.getElementById('opt-marker-mode-standard')?.addEventListener('click', () => {
        markerCreationMode = 'standard';
        renderMarkerCreationPanel();
    });
    document.getElementById('opt-marker-inference')?.addEventListener('change', (event) => {
        markerFeatureInferenceEnabled = (event.currentTarget as HTMLInputElement).checked;
    });
    document.getElementById('opt-marker-cancel')?.addEventListener('click', () => {
        resetCanvasInteraction();
        closeOptionsPanel();
    });
    document.getElementById('opt-marker-confirm')?.addEventListener('click', () => {
        finalizeMarkerDraft();
    });
    document.getElementById('opt-marker-pick-placement')?.addEventListener('click', () => {
        markerDraftPickIntent = 'placement';
        canvasInteractionMode = 'createMarker';
        setCanvasCursor('crosshair');
    });
    document.getElementById('opt-marker-pick-position')?.addEventListener('click', () => {
        markerDraftPickIntent = 'position';
        canvasInteractionMode = 'createMarker';
        setCanvasCursor('crosshair');
    });
    document.getElementById('opt-marker-pick-direction')?.addEventListener('click', () => {
        markerDraftPickIntent = 'direction';
        canvasInteractionMode = 'createMarker';
        setCanvasCursor('crosshair');
    });
}

function renderRefFrameCreationPanel(): void {
    refFrameCreationPanelActive = true;
    setPanelMode('options', '选项-参考标架');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) {
        return;
    }

    const selectedBaseMarker = pendingRefFrameBaseId
        ? createdMarkers.find((marker) => marker.id === pendingRefFrameBaseId) ?? null
        : null;
    const selectedTargetShape = pendingRefFrameTargetShapeId ? loadedShapes.get(pendingRefFrameTargetShapeId) ?? null : null;
    const targetOwnerName = selectedTargetShape
        ? frameOwnerDisplayName(resolveFrameOwnerForShape(selectedTargetShape.id).id)
        : '(未选择)';
    const modeRow = `<div class="opt-mode-row">
        <button id="opt-ref-mode-fast" class="${refFrameCreationMode === 'fast' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">闪电模式</button>
        <button id="opt-ref-mode-standard" class="${refFrameCreationMode === 'standard' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">标准模式</button>
    </div>`;

    propsEl.innerHTML = `<div class="opt-section">
        <div class="opt-label">当前基本标架：${selectedBaseMarker?.name ?? '(未选择，请在三维中拾取标架)'}</div>
        ${buildSeparator()}
        ${modeRow}
        ${buildSeparator()}
        <div class="opt-label">目标零件：${selectedTargetShape?.name ?? '(未选择)'}</div>
        <div class="opt-label">目标零件所属组：${targetOwnerName}</div>
        ${buildSeparator()}
        <div class="opt-hint">${refFrameCreationMode === 'fast' ? '先在三维中拾取一个标架，再选择目标零件后会立即创建参考标架。' : '先在三维中拾取一个标架，再选择目标零件并点击“添加”完成创建。'}</div>
        ${buildSeparator()}
        ${refFrameCreationMode === 'standard'
            ? buildActionButtons('opt-ref-confirm', '添加', 'opt-ref-cancel')
            : '<div class="opt-btn-row"><button id="opt-ref-cancel" class="opt-btn-secondary">取消</button></div>'}
    </div>`;

    document.getElementById('opt-ref-mode-fast')?.addEventListener('click', () => {
        refFrameCreationMode = 'fast';
        renderRefFrameCreationPanel();
    });
    document.getElementById('opt-ref-mode-standard')?.addEventListener('click', () => {
        refFrameCreationMode = 'standard';
        renderRefFrameCreationPanel();
    });
    document.getElementById('opt-ref-cancel')?.addEventListener('click', () => {
        resetCanvasInteraction();
        closeOptionsPanel();
    });
    document.getElementById('opt-ref-confirm')?.addEventListener('click', () => {
        if (!pendingRefFrameBaseId || !pendingRefFrameTargetShapeId) {
            vscode.postMessage({
                command: 'alert',
                text: '请选择基本标架和目标零件。'
            });
            return;
        }
        createReferenceFrameFromSelection(pendingRefFrameBaseId, pendingRefFrameTargetShapeId);
    });
}

function syncDesignPointDraftFromPanel(): DesignPointDraft | null {
    if (!designPointDraft) {
        return null;
    }

    const nameInput = document.getElementById('opt-dp-name') as HTMLInputElement | null;
    const sizeInput = document.getElementById('opt-dp-size') as HTMLInputElement | null;
    const offsetInput = document.getElementById('opt-dp-offset') as HTMLInputElement | null;
    const reverseInput = document.getElementById('opt-dp-reverse') as HTMLInputElement | null;
    const markerRefSelect = document.getElementById('opt-dp-marker-ref') as HTMLSelectElement | null;

    designPointDraft.name = nameInput?.value?.trim() || designPointDraft.name;
    designPointDraft.size = clampDesignPointSize(Number.parseFloat(sizeInput?.value ?? `${designPointDraft.size}`));
    designPointDraft.offsetValue = Number.parseFloat(offsetInput?.value ?? `${designPointDraft.offsetValue}`) || 0;
    designPointDraft.isDirectionReverse = reverseInput?.checked ?? false;
    designPointDraft.markerRefId = markerRefSelect?.value || undefined;

    if (designPointCreationMode === 'pick') {
        designPointDraft.position = clampDesignPointPosition(readVec3FromInputs('opt-dp-pos'));
        designPointDraft.direction = normalizeVector(readVec3FromInputs('opt-dp-dir')) ?? designPointDraft.direction;
    }

    return designPointDraft;
}

function finalizeDesignPointDraft(): void {
    const draft = syncDesignPointDraftFromPanel();
    if (!draft) {
        vscode.postMessage({
            command: 'alert',
            text: 'Design point draft is not ready.'
        });
        return;
    }

    if (draft.groupId === '__unassigned__' || draft.hostShapeId === '__unassigned__') {
        vscode.postMessage({
            command: 'alert',
            text: '请先在三维视图中拾取设计点所属零件。'
        });
        return;
    }

    if (!recalculateDesignPointDraft(draft)) {
        vscode.postMessage({
            command: 'alert',
            text: '请先完成设计点所需的拾取或计算参数。'
        });
        return;
    }

    const designPoint: MbsDesignPointEntity = {
        id: nextEntityId('designPoint', mbsDesignPoints.size),
        name: getUniqueDesignPointName(draft.name),
        groupId: draft.groupId,
        position: clampDesignPointPosition(draft.position),
        direction: normalizeVector(draft.direction) ?? { x: 0, y: 0, z: 1 },
        markerRefId: draft.markerRefId,
        size: clampDesignPointSize(draft.size),
        isDirectionReverse: draft.isDirectionReverse,
        offsetValue: draft.offsetValue,
        createdAt: new Date().toISOString()
    };
    mbsDesignPoints.set(designPoint.id, designPoint);
    pendingDesignPointSize = designPoint.size;
    viewer?.addFrame({
        id: designPoint.id,
        name: designPoint.name,
        position: designPoint.position,
        orientation: createOrientationFromNormal(designPoint.direction ?? { x: 0, y: 0, z: 1 }),
        size: clampDesignPointSize(designPoint.size),
        visible: true,
        isPrimary: false
    });
    updateModelTree();
    selectSelection({ kind: 'designPoint', id: designPoint.id });
    setStatusInfo(`Design point created: ${designPoint.name}`);
    vscode.postMessage({
        command: 'alert',
        text: `Design point "${designPoint.name}" created successfully.`
    });

    const nextShape = loadedShapes.get(draft.hostShapeId) ?? (selectedShapeId ? loadedShapes.get(selectedShapeId) ?? null : null);
    if (nextShape) {
        designPointDraft = createEmptyDesignPointDraft(nextShape);
        designPointDraft.size = pendingDesignPointSize;
        designPointDraft.markerRefId = designPoint.markerRefId;
        designPointDraft.offsetValue = designPoint.offsetValue;
    } else {
        designPointDraft = null;
    }
    renderDesignPointOptionsPanel();
}

function renderDesignPointOptionsPanel(): void {
    const draft = designPointDraft;
    if (!draft) {
        closeOptionsPanel();
        return;
    }

    setPanelMode('options', '选项-设计点');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) {
        return;
    }
    designPointCreationPanelActive = true;

    const calcModeOptions = [
        { value: 'midpoint', text: '中点模式' },
        { value: 'offset', text: '偏移模式' },
        { value: 'intersection', text: '交点模式' }
    ];
    const pointText = (value?: Vec3): string => value ? formatVec3(value) : '(未选择)';
    const featureText = (value?: DesignPointFeature): string => value ? `${value.label} ${formatVec3(value.point)}` : '(未选择)';
    const pickSection = designPointCreationMode === 'pick'
        ? `${buildVec3Input('opt-dp-pos', '位置（全局坐标）', draft.position.x, draft.position.y, draft.position.z)}
        ${buildSeparator()}
        ${buildVec3Input('opt-dp-dir', '方向（单位向量）', draft.direction.x, draft.direction.y, draft.direction.z)}
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="opt-dp-pick-placement" class="opt-btn-secondary">拾取位置与方向</button>
        </div>`
        : `${buildDropdown('opt-dp-calc-mode', '计算方式', designPointCalcMode, calcModeOptions)}
        ${buildSeparator()}
        ${designPointCalcMode === 'midpoint'
            ? `<div class="opt-label">第一个点：${pointText(draft.firstPoint)}</div>
                <div class="opt-label">第二个点：${pointText(draft.secondPoint)}</div>
                ${buildSeparator()}
                <div class="opt-btn-row">
                    <button id="opt-dp-pick-first" class="opt-btn-secondary">拾取第一个点</button>
                    <button id="opt-dp-pick-second" class="opt-btn-secondary">拾取第二个点</button>
                </div>`
            : designPointCalcMode === 'offset'
                ? `<div class="opt-label">参考点：${pointText(draft.basePoint)}</div>
                    <div class="opt-label">参考方向：${formatVec3(draft.direction)}</div>
                    ${buildSeparator()}
                    <div class="opt-btn-row">
                        <button id="opt-dp-pick-base" class="opt-btn-secondary">拾取参考点</button>
                        <button id="opt-dp-pick-direction" class="opt-btn-secondary">拾取参考方向</button>
                    </div>`
                : `<div class="opt-label">特征一：${featureText(draft.featureA)}</div>
                    <div class="opt-label">特征二：${featureText(draft.featureB)}</div>
                    ${buildSeparator()}
                    <div class="opt-btn-row">
                        <button id="opt-dp-pick-feature-a" class="opt-btn-secondary">拾取特征一</button>
                        <button id="opt-dp-pick-feature-b" class="opt-btn-secondary">拾取特征二</button>
                    </div>`}
        ${buildSeparator()}
        ${buildVec3Input('opt-dp-pos', '计算结果位置', draft.position.x, draft.position.y, draft.position.z)}
        ${buildSeparator()}
        ${buildVec3Input('opt-dp-dir', '计算结果方向', draft.direction.x, draft.direction.y, draft.direction.z)}
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="opt-dp-calc" class="opt-btn-secondary">计算</button>
        </div>`;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-dp-name', draft.name)}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-dp-size">图标大小</label>
            <input id="opt-dp-size" class="opt-input" type="number" min="1" max="50000" step="1" value="${clampDesignPointSize(draft.size)}" />
        </div>
        ${buildSeparator()}
        ${buildTabBar([
            { id: 'pick', text: '拾取', active: designPointCreationMode === 'pick' },
            { id: 'calc', text: '计算', active: designPointCreationMode === 'calc' }
        ])}
        ${buildSeparator()}
        ${buildDropdown('opt-dp-marker-ref', '参考标架', draft.markerRefId ?? '', getFrameReferenceOptions())}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-dp-reverse">反向</label>
            <input id="opt-dp-reverse" type="checkbox"${draft.isDirectionReverse ? ' checked' : ''} />
        </div>
        <div class="opt-row">
            <label for="opt-dp-offset">偏移值</label>
            <input id="opt-dp-offset" class="opt-input" type="number" step="0.01" value="${draft.offsetValue.toFixed(4)}" />
        </div>
        ${buildSeparator()}
        ${pickSection}
        ${buildSeparator()}
        ${buildActionButtons('opt-dp-confirm', '添加', 'opt-dp-cancel')}
    </div>`;

    document.getElementById('opt-dp-confirm')?.addEventListener('click', () => {
        finalizeDesignPointDraft();
    });
    document.getElementById('opt-dp-cancel')?.addEventListener('click', () => {
        closeOptionsPanel();
    });
    document.getElementById('opt-dp-pick-placement')?.addEventListener('click', () => {
        designPointPickIntent = 'placement';
        canvasInteractionMode = 'createDesignPoint';
        setCanvasCursor('crosshair');
        setStatus('Click on a face to place the design point');
    });
    document.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            syncDesignPointDraftFromPanel();
            const tabId = button.dataset.tab;
            designPointCreationMode = tabId === 'calc' ? 'calc' : 'pick';
            renderDesignPointOptionsPanel();
        });
    });
    document.getElementById('opt-dp-calc-mode')?.addEventListener('change', (event) => {
        syncDesignPointDraftFromPanel();
        const nextMode = (event.currentTarget as HTMLSelectElement).value;
        if (nextMode === 'midpoint' || nextMode === 'offset' || nextMode === 'intersection') {
            designPointCalcMode = nextMode;
        }
        renderDesignPointOptionsPanel();
    });
    document.getElementById('opt-dp-calc')?.addEventListener('click', () => {
        const currentDraft = syncDesignPointDraftFromPanel();
        if (!currentDraft) {
            return;
        }
        if (recalculateDesignPointDraft(currentDraft)) {
            renderDesignPointOptionsPanel();
        }
    });
    document.getElementById('opt-dp-pick-first')?.addEventListener('click', () => {
        designPointPickIntent = 'firstPoint';
        canvasInteractionMode = 'createDesignPoint';
        setCanvasCursor('crosshair');
        setStatus('Click on the first point');
    });
    document.getElementById('opt-dp-pick-second')?.addEventListener('click', () => {
        designPointPickIntent = 'secondPoint';
        canvasInteractionMode = 'createDesignPoint';
        setCanvasCursor('crosshair');
        setStatus('Click on the second point');
    });
    document.getElementById('opt-dp-pick-base')?.addEventListener('click', () => {
        designPointPickIntent = 'basePoint';
        canvasInteractionMode = 'createDesignPoint';
        setCanvasCursor('crosshair');
        setStatus('Click on the reference point');
    });
    document.getElementById('opt-dp-pick-direction')?.addEventListener('click', () => {
        designPointPickIntent = 'direction';
        canvasInteractionMode = 'createDesignPoint';
        setCanvasCursor('crosshair');
        setStatus('Click on a point, line or face to derive direction');
    });
    document.getElementById('opt-dp-pick-feature-a')?.addEventListener('click', () => {
        designPointPickIntent = 'featureA';
        canvasInteractionMode = 'createDesignPoint';
        setCanvasCursor('crosshair');
        setStatus('Click on the first intersection feature');
    });
    document.getElementById('opt-dp-pick-feature-b')?.addEventListener('click', () => {
        designPointPickIntent = 'featureB';
        canvasInteractionMode = 'createDesignPoint';
        setCanvasCursor('crosshair');
        setStatus('Click on the second intersection feature');
    });
}

function renderDesignPointPropertiesPanel(designPointId: string): void {
    const point = mbsDesignPoints.get(designPointId);
    const propsEl = document.getElementById('properties-panel');
    if (!point || !propsEl) {
        updatePropertiesPanel(null);
        return;
    }

    setPanelMode('properties', '属性-设计点');
    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('prop-dp-name', point.name)}
        ${buildSeparator()}
        ${createPropertyRow('类型', '设计点', { boxed: true })}
        ${createPropertyRow('所属对象', frameOwnerDisplayName(point.groupId), { boxed: true })}
        ${createPropertyRow('参考标架', getFrameReferenceLabel(point.markerRefId), { boxed: true })}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="prop-dp-size">图标大小</label>
            <input id="prop-dp-size" class="opt-input" type="number" min="1" max="50000" step="1" value="${clampDesignPointSize(point.size)}" />
        </div>
        ${buildSeparator()}
        ${buildVec3Input('prop-dp-pos', '位置（全局坐标）', point.position.x, point.position.y, point.position.z)}
        ${buildSeparator()}
        ${buildVec3Input('prop-dp-dir', '方向（单位向量）', point.direction?.x ?? 0, point.direction?.y ?? 0, point.direction?.z ?? 1)}
        ${buildSeparator()}
        ${buildDropdown('prop-dp-marker-ref', '参考标架', point.markerRefId ?? '', getFrameReferenceOptions())}
        <div class="opt-row">
            <label for="prop-dp-reverse">反向</label>
            <input id="prop-dp-reverse" type="checkbox"${point.isDirectionReverse ? ' checked' : ''} />
        </div>
        <div class="opt-row">
            <label for="prop-dp-offset">偏移值</label>
            <input id="prop-dp-offset" class="opt-input" type="number" step="0.01" value="${point.offsetValue.toFixed(4)}" />
        </div>
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="prop-dp-save" class="opt-btn-primary">保存修改</button>
        </div>
    </div>`;

    document.getElementById('prop-dp-save')?.addEventListener('click', () => {
        const nameInput = document.getElementById('prop-dp-name') as HTMLInputElement | null;
        const sizeInput = document.getElementById('prop-dp-size') as HTMLInputElement | null;
        const markerRefSelect = document.getElementById('prop-dp-marker-ref') as HTMLSelectElement | null;
        const reverseInput = document.getElementById('prop-dp-reverse') as HTMLInputElement | null;
        const offsetInput = document.getElementById('prop-dp-offset') as HTMLInputElement | null;
        point.name = getUniqueDesignPointName(nameInput?.value ?? point.name, point.id);
        point.size = clampDesignPointSize(Number.parseFloat(sizeInput?.value ?? `${point.size}`) || point.size);
        point.position = clampDesignPointPosition(readVec3FromInputs('prop-dp-pos'));
        point.direction = normalizeVector(readVec3FromInputs('prop-dp-dir')) ?? point.direction ?? { x: 0, y: 0, z: 1 };
        point.markerRefId = markerRefSelect?.value || undefined;
        point.isDirectionReverse = reverseInput?.checked ?? false;
        point.offsetValue = Number.parseFloat(offsetInput?.value ?? `${point.offsetValue}`) || 0;
        syncDesignPointEntityToViewer(point.id);
        updateModelTree();
        renderDesignPointPropertiesPanel(point.id);
    });
}

const JOINT_TYPE_OPTIONS: Array<{ value: string; text: string }> = [
    { value: 'revolute', text: 'Revolute（旋转）' },
    { value: 'prismatic', text: 'Prismatic（平移）' },
    { value: 'cylindrical', text: 'Cylindrical（圆柱）' },
    { value: 'spherical', text: 'Spherical（球）' },
    { value: 'universal', text: 'Universal（万向）' },
    { value: 'screw', text: 'Screw（螺旋）' },
    { value: 'planar', text: 'Planar（平面）' },
    { value: 'fixed', text: 'Fixed（固定）' }
];

function createDefaultJointDraft(jointType: string): JointDraft {
    const normalizedType = normalizeConnectorType(jointType);
    return {
        name: `${normalizedType}_${mbsJoints.size + 1}`,
        jointType: normalizedType,
        position: { x: 0, y: 0, z: 0 },
        direction: { ...DEFAULT_CONNECTOR_DIRECTION },
        iconSize: pendingJointIconSize,
        inferenceEnabled: jointFeatureInferenceEnabled,
        zAxisReversed: false
    };
}

function syncJointDraftFromInputs(): void {
    if (!jointDraft) {
        return;
    }

    const nameInput = document.getElementById('opt-joint-name') as HTMLInputElement | null;
    const typeInput = document.getElementById('opt-joint-type') as HTMLSelectElement | null;
    const sizeInput = document.getElementById('opt-joint-size') as HTMLInputElement | null;
    const inferenceInput = document.getElementById('opt-joint-inference') as HTMLInputElement | null;
    const reverseInput = document.getElementById('opt-joint-reverse') as HTMLInputElement | null;

    jointDraft.name = nameInput?.value?.trim() || jointDraft.name;
    jointDraft.jointType = normalizeConnectorType(typeInput?.value, normalizeConnectorType(jointDraft.jointType));
    jointDraft.iconSize = Math.max(1, Number.parseFloat(sizeInput?.value ?? `${jointDraft.iconSize}`) || jointDraft.iconSize);
    jointDraft.inferenceEnabled = inferenceInput?.checked ?? jointDraft.inferenceEnabled;
    jointDraft.zAxisReversed = reverseInput?.checked ?? jointDraft.zAxisReversed;
    pendingJointIconSize = jointDraft.iconSize;
    jointFeatureInferenceEnabled = jointDraft.inferenceEnabled;

    if (jointCreationMode === 'standard') {
        jointDraft.position = readVec3FromInputs('opt-joint-pos');
        jointDraft.direction = resolveConnectorDirection({
            inferenceEnabled: true,
            pickedDirection: normalizeVector(readVec3FromInputs('opt-joint-dir')),
            reverseDirection: jointDraft.zAxisReversed
        });
    }
}

function recomputeJointDraftPlacement(): void {
    if (!jointDraft) {
        return;
    }

    const part1Pick = jointDraft.part1Pick;
    const part2Pick = jointDraft.part2Pick;
    const nextDirection = resolveConnectorDirection({
        inferenceEnabled: jointDraft.inferenceEnabled,
        pickedDirection: part2Pick?.direction ?? part1Pick?.direction ?? DEFAULT_CONNECTOR_DIRECTION,
        reverseDirection: jointDraft.zAxisReversed
    });

    if (part1Pick && part2Pick) {
        jointDraft.position = {
            x: (part1Pick.position.x + part2Pick.position.x) / 2,
            y: (part1Pick.position.y + part2Pick.position.y) / 2,
            z: (part1Pick.position.z + part2Pick.position.z) / 2
        };
        jointDraft.direction = nextDirection;
        return;
    }

    if (part1Pick) {
        jointDraft.position = cloneVec3(part1Pick.position);
        jointDraft.direction = nextDirection;
    }
}

function finalizeJointDraft(): boolean {
    if (!jointDraft) {
        return false;
    }

    syncJointDraftFromInputs();
    const validation = validateConnectorParticipants(jointDraft.part1, jointDraft.part2);
    if (!validation.valid) {
        vscode.postMessage({
            command: 'alert',
            text: validation.reason ?? '连接创建失败。'
        });
        return false;
    }

    const joint: MbsJointEntity = {
        id: nextEntityId('joint', mbsJoints.size),
        name: jointDraft.name,
        jointType: normalizeConnectorType(jointDraft.jointType),
        part1: jointDraft.part1!,
        part2: jointDraft.part2!,
        position: cloneVec3(jointDraft.position),
        direction: resolveConnectorDirection({
            inferenceEnabled: true,
            pickedDirection: jointDraft.direction,
            reverseDirection: jointDraft.zAxisReversed
        }),
        iconSize: jointDraft.iconSize,
        inferenceEnabled: jointDraft.inferenceEnabled,
        zAxisReversed: jointDraft.zAxisReversed,
        createdAt: new Date().toISOString()
    };

    mbsJoints.set(joint.id, joint);
    viewer?.addJoint(buildJointViewerData(joint));
    updateModelTree();
    selectSelection({ kind: 'joint', id: joint.id });

    const nextType = jointDraft.jointType;
    jointDraft = createDefaultJointDraft(nextType);
    jointCreationPanelActive = true;
    jointDraftPickStage = 'part1';
    renderJointOptionsPanel();
    setStatus('请选择零件 1');
    setStatusInfo(`Connection created: ${joint.name}`);
    return true;
}

function setJointDraftGroundTarget(): void {
    if (!jointDraft) {
        return;
    }
    syncJointDraftFromInputs();
    if (!jointDraft.part1) {
        vscode.postMessage({
            command: 'alert',
            text: '请先在三维视图中选择零件 1。'
        });
        return;
    }
    jointDraft.part2 = GROUND_PART_ID;
    jointDraft.part2Pick = undefined;
    jointDraftPickStage = 'part2';
    recomputeJointDraftPlacement();
    if (jointCreationMode === 'fast') {
        finalizeJointDraft();
        return;
    }
    renderJointOptionsPanel();
    setStatus('可调整位置/方向后点击添加');
    setStatusInfo('零件 2 已设置为 Ground。');
}

function renderJointOptionsPanel(): void {
    jointCreationPanelActive = true;
    setPanelMode('options', '选项-连接');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    if (!jointDraft) {
        jointDraft = createDefaultJointDraft('revolute');
    }

    const draft = jointDraft;
    const part1Name = resolvePartRefName(draft.part1);
    const part2Name = resolvePartRefName(draft.part2);
    const stageText = draft.part1
        ? (draft.part2 ? '已完成零件选择，可继续调整参数或连续创建。' : '下一步：在三维视图中拾取零件 2，或使用 Ground。')
        : '下一步：在三维视图中拾取零件 1。';
    const modeRow = `<div class="opt-mode-row">
        <button id="opt-joint-mode-fast" class="${jointCreationMode === 'fast' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">闪电模式</button>
        <button id="opt-joint-mode-standard" class="${jointCreationMode === 'standard' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">标准模式</button>
    </div>`;

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-joint-name', draft.name)}
        ${buildDropdown('opt-joint-type', '类型', normalizeConnectorType(draft.jointType), JOINT_TYPE_OPTIONS)}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-joint-size">图标大小</label>
            <input id="opt-joint-size" class="opt-input" type="number" min="1" max="200" step="1" value="${Math.max(1, Math.round(draft.iconSize))}" />
        </div>
        ${buildSeparator()}
        ${modeRow}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-joint-inference">智能推理</label>
            <input id="opt-joint-inference" type="checkbox"${draft.inferenceEnabled ? ' checked' : ''} />
        </div>
        ${buildSeparator()}
        <div class="opt-label" style="color: #DC2626; font-weight: 500;">零件 1</div>
        <div id="opt-joint-part1" class="opt-part-selector${part1Name ? ' has-value' : ''}">
            <span>${part1Name || '🖱 点击选择零件 1'}</span>
        </div>
        <div class="opt-label" style="color: #2563EB; font-weight: 500;">零件 2</div>
        <div id="opt-joint-part2" class="opt-part-selector${part2Name ? ' has-value' : ''}">
            <span>${part2Name || '🖱 点击选择零件 2'}</span>
        </div>
        <div class="opt-btn-row">
            <button id="opt-joint-ground" class="opt-btn-secondary">零件 2 = Ground</button>
        </div>
        ${buildSeparator()}
        <div class="opt-hint">${stageText}</div>
        ${jointCreationMode === 'standard' ? `${buildSeparator()}
        <div class="opt-row">
            <label for="opt-joint-reverse">Z 轴反向</label>
            <input id="opt-joint-reverse" type="checkbox"${draft.zAxisReversed ? ' checked' : ''} />
        </div>
        ${buildSeparator()}
        ${buildVec3Input('opt-joint-pos', '位置（全局坐标）', draft.position.x, draft.position.y, draft.position.z)}
        ${buildVec3Input('opt-joint-dir', '方向（单位向量）', draft.direction.x, draft.direction.y, draft.direction.z)}
        ${buildSeparator()}
        ${buildActionButtons('opt-joint-confirm', '添加', 'opt-joint-cancel')}` : `${buildSeparator()}
        <div class="opt-hint">当前为闪电模式，完成零件 1 和零件 2 拾取后会立即创建连接。</div>
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="opt-joint-cancel" class="opt-btn-secondary">取消</button>
        </div>`}
    </div>`;

    document.getElementById('opt-joint-mode-fast')?.addEventListener('click', () => {
        syncJointDraftFromInputs();
        jointCreationMode = 'fast';
        renderJointOptionsPanel();
    });
    document.getElementById('opt-joint-mode-standard')?.addEventListener('click', () => {
        syncJointDraftFromInputs();
        jointCreationMode = 'standard';
        renderJointOptionsPanel();
    });
    document.getElementById('opt-joint-ground')?.addEventListener('click', () => {
        setJointDraftGroundTarget();
    });
    document.getElementById('opt-joint-cancel')?.addEventListener('click', () => {
        resetCanvasInteraction();
        closeOptionsPanel();
    });
    document.getElementById('opt-joint-confirm')?.addEventListener('click', () => {
        finalizeJointDraft();
    });
}

const MOTION_TYPE_OPTIONS: Array<{ value: MotionType; text: string }> = [
    { value: 'rotational', text: '旋转驱动' },
    { value: 'translational', text: '平移驱动' }
];

const ROTATIONAL_DRIVE_MODE_OPTIONS: Array<{ value: MotionDriveMode; text: string }> = [
    { value: 'angle', text: '角度' },
    { value: 'angularVelocity', text: '角速度' },
    { value: 'angularAcceleration', text: '角加速度' }
];

const TRANSLATIONAL_DRIVE_MODE_OPTIONS: Array<{ value: MotionDriveMode; text: string }> = [
    { value: 'displacement', text: '位移' },
    { value: 'velocity', text: '速度' },
    { value: 'acceleration', text: '加速度' }
];

const CONTACT_TYPE_OPTIONS: Array<{ value: ContactType; text: string }> = [
    { value: 'pointPoint', text: '点点接触' },
    { value: 'pointSurface', text: '点面接触' }
];

function normalizeMotionType(value: string | null | undefined, fallback: MotionType = 'rotational'): MotionType {
    if (value === 'translational' || value === 'displacement' || value === 'velocity' || value === 'acceleration') {
        return 'translational';
    }
    if (value === 'rotational' || value === 'angle' || value === 'angularVelocity' || value === 'angularAcceleration') {
        return 'rotational';
    }
    return fallback;
}

function defaultMotionDriveMode(motionType: MotionType): MotionDriveMode {
    return motionType === 'translational' ? 'displacement' : 'angle';
}

function getMotionDriveModeOptions(motionType: MotionType): Array<{ value: MotionDriveMode; text: string }> {
    return motionType === 'translational'
        ? TRANSLATIONAL_DRIVE_MODE_OPTIONS
        : ROTATIONAL_DRIVE_MODE_OPTIONS;
}

function normalizeMotionDriveMode(value: string | null | undefined, motionType: MotionType): MotionDriveMode {
    const allowed = new Set(getMotionDriveModeOptions(motionType).map((item) => item.value));
    if (value && allowed.has(value as MotionDriveMode)) {
        return value as MotionDriveMode;
    }
    return defaultMotionDriveMode(motionType);
}

function isDriveCompatibleJointType(jointType: string): boolean {
    const normalized = normalizeConnectorType(jointType);
    return normalized === 'revolute' || normalized === 'prismatic' || normalized === 'cylindrical';
}

function isMotionTypeCompatibleWithJoint(motionType: MotionType, jointType: string): boolean {
    const normalized = normalizeConnectorType(jointType);
    if (motionType === 'rotational') {
        return normalized === 'revolute' || normalized === 'cylindrical';
    }
    return normalized === 'prismatic' || normalized === 'cylindrical';
}

function resolveMotionTypeLabel(motionType: MotionType): string {
    return MOTION_TYPE_OPTIONS.find((item) => item.value === motionType)?.text ?? motionType;
}

function resolveMotionConnectorLabel(connectorRef: string | undefined): string {
    if (!connectorRef) {
        return '🖱 选择转动/移动连接';
    }

    const joint = mbsJoints.get(connectorRef);
    if (!joint) {
        return connectorRef;
    }

    const jointTypeLabel = JOINT_TYPE_OPTIONS.find((item) => item.value === normalizeConnectorType(joint.jointType))?.text
        ?? normalizeConnectorType(joint.jointType);
    return `${joint.name} (${jointTypeLabel})`;
}

function createDefaultMotionDraft(motionType: MotionType = motionCreationPreset): MotionDraft {
    const normalizedType = normalizeMotionType(motionType, motionCreationPreset);
    return {
        name: `${normalizedType === 'translational' ? 'TranslationalDrive' : 'RotationalDrive'}${mbsMotions.size + 1}`,
        motionType: normalizedType,
        driveMode: defaultMotionDriveMode(normalizedType),
        connectorRef: undefined,
        iconSize: pendingMotionIconSize,
        visible: true,
        phiStart: 0,
        wStart: 0
    };
}

function syncMotionSizeInputs(nextValue: number): void {
    const rounded = Math.max(1, Math.min(50000, Math.round(nextValue)));
    const sizeInput = document.getElementById('opt-motion-size') as HTMLInputElement | null;
    const sizeRangeInput = document.getElementById('opt-motion-size-range') as HTMLInputElement | null;
    if (sizeInput) {
        sizeInput.value = `${rounded}`;
    }
    if (sizeRangeInput) {
        sizeRangeInput.value = `${Math.max(1, Math.min(500, rounded))}`;
    }
}

function updateMotionDraftSize(nextValue: number): number {
    const normalized = Math.max(1, Math.min(50000, Math.round(nextValue)));
    pendingMotionIconSize = normalized;
    if (motionDraft) {
        motionDraft.iconSize = normalized;
    }
    syncMotionSizeInputs(normalized);
    return normalized;
}

function syncMotionDraftFromInputs(): MotionDraft {
    const currentDraft = motionDraft ?? createDefaultMotionDraft();
    const nameInput = document.getElementById('opt-motion-name') as HTMLInputElement | null;
    const driveModeInput = document.getElementById('opt-motion-drive-mode') as HTMLSelectElement | null;
    const sizeInput = document.getElementById('opt-motion-size') as HTMLInputElement | null;
    const visibleInput = document.getElementById('opt-motion-visible') as HTMLInputElement | null;
    const phiInput = document.getElementById('opt-motion-phi') as HTMLInputElement | null;
    const wInput = document.getElementById('opt-motion-w') as HTMLInputElement | null;

    const nextMotionType = currentDraft.motionType;
    const nextDraft: MotionDraft = {
        ...currentDraft,
        name: nameInput?.value.trim() || currentDraft.name,
        motionType: nextMotionType,
        driveMode: normalizeMotionDriveMode(driveModeInput?.value, nextMotionType),
        iconSize: Math.max(1, Number.parseFloat(sizeInput?.value ?? `${currentDraft.iconSize}`) || currentDraft.iconSize),
        visible: visibleInput?.checked ?? currentDraft.visible,
        phiStart: Number.parseFloat(phiInput?.value ?? `${currentDraft.phiStart}`) || 0,
        wStart: Number.parseFloat(wInput?.value ?? `${currentDraft.wStart}`) || 0
    };

    pendingMotionIconSize = nextDraft.iconSize;
    motionCreationPreset = nextDraft.motionType;
    motionDraft = nextDraft;
    return nextDraft;
}

function createMotionFromDraft(): boolean {
    const draft = syncMotionDraftFromInputs();
    if (!draft.connectorRef) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please select a revolute, prismatic, or cylindrical joint first.'
        });
        setStatus('请选择连接');
        renderMotionOptionsPanel();
        return false;
    }

    const joint = mbsJoints.get(draft.connectorRef);
    if (!joint) {
        vscode.postMessage({
            command: 'alert',
            text: 'Selected joint no longer exists.'
        });
        draft.connectorRef = undefined;
        renderMotionOptionsPanel();
        return false;
    }
    if (!isDriveCompatibleJointType(joint.jointType)) {
        vscode.postMessage({
            command: 'alert',
            text: 'Only revolute, prismatic, or cylindrical joints can be driven.'
        });
        setStatus('当前连接不支持驱动');
        renderMotionOptionsPanel();
        return false;
    }
    if (!isMotionTypeCompatibleWithJoint(draft.motionType, joint.jointType)) {
        const expectedType = draft.motionType === 'rotational'
            ? 'revolute/cylindrical'
            : 'prismatic/cylindrical';
        vscode.postMessage({
            command: 'alert',
            text: `The selected joint is incompatible with this drive. Expected ${expectedType}.`
        });
        setStatus('当前连接与驱动类型不匹配');
        renderMotionOptionsPanel();
        return false;
    }

    const id = nextEntityId('motion', mbsMotions.size);
    const motion: MbsMotionEntity = {
        id,
        name: draft.name,
        motionType: draft.motionType,
        driveMode: normalizeMotionDriveMode(draft.driveMode, draft.motionType),
        connectorRef: joint.id,
        iconSize: Math.max(1, draft.iconSize),
        visible: draft.visible,
        phiStart: draft.phiStart,
        wStart: draft.wStart,
        createdAt: new Date().toISOString()
    };

    mbsMotions.set(id, motion);
    pendingMotionIconSize = motion.iconSize;
    updateModelTree();
    selectSelection({ kind: 'motion', id });
    renderMotionPropertiesPanel(id);
    setStatus('Ready');
    setStatusInfo(`Motion created: ${motion.name}`);

    if (motionCreationMode === 'fast') {
        motionDraft = createDefaultMotionDraft(motion.motionType);
        renderMotionOptionsPanel();
        setStatus('继续选择连接以创建驱动');
        return true;
    }

    resetCanvasInteraction();
    return true;
}

function applyMotionConnectorSelection(jointId: string): void {
    if (!motionCreationPanelActive) {
        return;
    }

    const joint = mbsJoints.get(jointId);
    if (!joint) {
        return;
    }
    if (!isDriveCompatibleJointType(joint.jointType)) {
        setStatusInfo('Only revolute, prismatic, and cylindrical joints can be used as drive connectors.');
        renderMotionOptionsPanel();
        return;
    }

    const draft = syncMotionDraftFromInputs();
    if (!isMotionTypeCompatibleWithJoint(draft.motionType, joint.jointType)) {
        setStatusInfo(
            draft.motionType === 'rotational'
                ? '请选择转动或圆柱连接来创建旋转驱动。'
                : '请选择移动或圆柱连接来创建平移驱动。'
        );
        renderMotionOptionsPanel();
        return;
    }
    draft.connectorRef = joint.id;
    motionDraft = draft;
    renderMotionOptionsPanel();
    setStatusInfo(`Drive connector selected: ${joint.name}`);

    if (motionCreationMode === 'fast') {
        createMotionFromDraft();
    } else {
        setStatus('点击“添加”完成驱动创建');
    }
}

function startMotionCreation(motionTypeRaw: string): void {
    const motionType = normalizeMotionType(motionTypeRaw, motionCreationPreset);
    if (canvasInteractionMode === 'createMotion' && motionCreationPanelActive && motionCreationPreset === motionType) {
        resetCanvasInteraction();
        closeOptionsPanel();
        setStatus('Ready');
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'createMotion';
    motionCreationPanelActive = true;
    motionCreationPreset = motionType;
    motionCreationMode = 'fast';
    motionDraft = createDefaultMotionDraft(motionType);
    renderMotionOptionsPanel();
    setStatus('请选择转动/移动连接');
    setStatusInfo('Drive creation mode active');
}

function renderMotionOptionsPanel(): void {
    setPanelMode('options', '选项-驱动');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    const draft = motionDraft ?? createDefaultMotionDraft();
    motionDraft = draft;
    motionCreationPreset = draft.motionType;
    pendingMotionIconSize = draft.iconSize;
    const addButton = motionCreationMode === 'standard'
        ? '<button id="opt-motion-add" class="opt-btn-primary">添加</button>'
        : '';

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-motion-name', draft.name)}
        ${createPropertyRow('类型', resolveMotionTypeLabel(draft.motionType), { boxed: true })}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-motion-visible">可见性</label>
            <input id="opt-motion-visible" type="checkbox"${draft.visible ? ' checked' : ''} />
        </div>
        <div class="opt-row">
            <label for="opt-motion-size">图标大小</label>
            <input id="opt-motion-size" class="opt-input" type="number" min="1" max="50000" step="1" value="${Math.max(1, Math.round(draft.iconSize))}" />
        </div>
        <div class="opt-row">
            <label for="opt-motion-size-range">大小滑条</label>
            <input id="opt-motion-size-range" type="range" min="1" max="500" step="1" value="${Math.max(1, Math.min(500, Math.round(draft.iconSize)))}" />
        </div>
        <div class="opt-hint">支持 Alt + 鼠标滚轮快速调节图标大小</div>
        ${buildSeparator()}
        <div class="opt-label">连接器</div>
        <div id="opt-motion-connector" class="opt-part-selector${draft.connectorRef ? ' has-value' : ''}">
            <span>${resolveMotionConnectorLabel(draft.connectorRef)}</span>
        </div>
        <div class="opt-hint">请选择转动、移动或圆柱连接。闪电模式下选择后立即创建，标准模式下需要点击“添加”。</div>
        ${buildSeparator()}
        ${buildDropdown('opt-motion-drive-mode', '驱动类型', draft.driveMode, getMotionDriveModeOptions(draft.motionType))}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-motion-phi">phi.start</label>
            <input id="opt-motion-phi" class="opt-input" type="number" step="0.01" value="${draft.phiStart}" />
        </div>
        <div class="opt-row">
            <label for="opt-motion-w">w.start</label>
            <input id="opt-motion-w" class="opt-input" type="number" step="0.01" value="${draft.wStart}" />
        </div>
        ${buildSeparator()}
        <div class="opt-mode-row">
            <button id="opt-motion-mode-fast" class="${motionCreationMode === 'fast' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">⚡ 闪电模式</button>
            <button id="opt-motion-mode-standard" class="${motionCreationMode === 'standard' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">📐 标准模式</button>
        </div>
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="opt-motion-reset" class="opt-btn-secondary">重置</button>
            <button id="opt-motion-cancel" class="opt-btn-secondary">取消</button>
            ${addButton}
        </div>
    </div>`;

    const nameInput = document.getElementById('opt-motion-name') as HTMLInputElement | null;
    nameInput?.addEventListener('input', () => {
        if (motionDraft) {
            motionDraft.name = nameInput.value.trim() || motionDraft.name;
        }
    });

    const driveModeInput = document.getElementById('opt-motion-drive-mode') as HTMLSelectElement | null;
    driveModeInput?.addEventListener('change', () => {
        if (!motionDraft) {
            return;
        }
        motionDraft.driveMode = normalizeMotionDriveMode(driveModeInput.value, motionDraft.motionType);
    });

    const sizeInput = document.getElementById('opt-motion-size') as HTMLInputElement | null;
    sizeInput?.addEventListener('input', () => {
        updateMotionDraftSize(Number.parseFloat(sizeInput.value));
    });
    const sizeRangeInput = document.getElementById('opt-motion-size-range') as HTMLInputElement | null;
    sizeRangeInput?.addEventListener('input', () => {
        updateMotionDraftSize(Number.parseFloat(sizeRangeInput.value));
    });

    document.getElementById('opt-motion-mode-fast')?.addEventListener('click', () => {
        syncMotionDraftFromInputs();
        motionCreationMode = 'fast';
        renderMotionOptionsPanel();
    });
    document.getElementById('opt-motion-mode-standard')?.addEventListener('click', () => {
        syncMotionDraftFromInputs();
        motionCreationMode = 'standard';
        renderMotionOptionsPanel();
    });
    document.getElementById('opt-motion-reset')?.addEventListener('click', () => {
        motionDraft = createDefaultMotionDraft(motionDraft?.motionType ?? motionCreationPreset);
        renderMotionOptionsPanel();
        setStatus('请选择转动/移动连接');
        setStatusInfo('Drive draft reset.');
    });
    document.getElementById('opt-motion-cancel')?.addEventListener('click', () => {
        resetCanvasInteraction();
        closeOptionsPanel();
        setStatus('Ready');
    });
    document.getElementById('opt-motion-add')?.addEventListener('click', () => {
        createMotionFromDraft();
    });
}

function createDefaultContactDraft(contactType: ContactType = contactCreationPreset): ContactDraft {
    return {
        name: `Contact${mbsContacts.size + 1}`,
        contactType,
        iconSize: pendingContactSize
    };
}

function contactFeatureLabel(feature: ContactFeatureRef | undefined): string {
    if (!feature) {
        return '🖱 在三维视图中选择面';
    }
    const shapeName = loadedShapes.get(feature.shapeId)?.name ?? feature.shapeId;
    return `${shapeName} @ (${feature.position.x.toFixed(2)}, ${feature.position.y.toFixed(2)}, ${feature.position.z.toFixed(2)})`;
}

function syncContactSizeInputs(nextValue: number): void {
    const numberInput = document.getElementById('opt-contact-size') as HTMLInputElement | null;
    const rangeInput = document.getElementById('opt-contact-size-range') as HTMLInputElement | null;
    const rounded = Math.max(1, Math.round(nextValue));
    if (numberInput) {
        numberInput.value = `${rounded}`;
    }
    if (rangeInput) {
        rangeInput.value = `${rounded}`;
    }
}

function updateContactDraftSize(nextValue: number): number {
    const normalized = Math.max(1, Math.min(50000, Math.round(nextValue)));
    pendingContactSize = normalized;
    if (contactDraft) {
        contactDraft.iconSize = normalized;
    }
    syncContactSizeInputs(normalized);
    return normalized;
}

function resetContactDraftFeatures(): void {
    if (!contactDraft) {
        return;
    }
    contactDraft.featureA = undefined;
    contactDraft.featureB = undefined;
}

function renderContactOptionsPanel(): void {
    setPanelMode('options', '选项-接触');
    const propsEl = document.getElementById('properties-panel');
    if (!propsEl) return;

    const draft = contactDraft ?? createDefaultContactDraft();
    contactDraft = draft;
    contactCreationPreset = draft.contactType;
    pendingContactSize = draft.iconSize;

    const addButton = contactCreationMode === 'standard'
        ? '<button id="opt-contact-add" class="opt-btn-primary">添加</button>'
        : '';

    propsEl.innerHTML = `<div class="opt-section">
        ${buildNameInput('opt-contact-name', draft.name)}
        ${buildDropdown('opt-contact-type', '类型', draft.contactType, CONTACT_TYPE_OPTIONS)}
        ${buildSeparator()}
        <div class="opt-row">
            <label for="opt-contact-size">图标大小</label>
            <input id="opt-contact-size" class="opt-input" type="number" min="1" max="50000" step="1" value="${Math.max(1, Math.round(draft.iconSize))}" />
        </div>
        <div class="opt-row">
            <label for="opt-contact-size-range">大小滑条</label>
            <input id="opt-contact-size-range" type="range" min="1" max="500" step="1" value="${Math.max(1, Math.min(500, Math.round(draft.iconSize)))}" />
        </div>
        <div class="opt-hint">支持 Alt + 鼠标滚轮快速调节图标大小</div>
        ${buildSeparator()}
        <div class="opt-label" style="color: #2563EB; font-weight: 600;">特征 1</div>
        <div id="opt-contact-feature-a" class="opt-part-selector${draft.featureA ? ' has-value' : ''}">
            <span>${contactFeatureLabel(draft.featureA)}</span>
        </div>
        <div class="opt-label" style="color: #2563EB; font-weight: 600;">特征 2</div>
        <div id="opt-contact-feature-b" class="opt-part-selector${draft.featureB ? ' has-value' : ''}">
            <span>${contactFeatureLabel(draft.featureB)}</span>
        </div>
        <div class="opt-hint">${contactCreationMode === 'fast' ? '闪电模式下，选择完第二个特征后立即创建。' : '标准模式下，选择完两个特征后点击添加。'}</div>
        ${buildSeparator()}
        <div class="opt-mode-row">
            <button id="opt-contact-mode-fast" class="${contactCreationMode === 'fast' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">⚡ 闪电模式</button>
            <button id="opt-contact-mode-standard" class="${contactCreationMode === 'standard' ? 'opt-mode-btn-active' : 'opt-mode-btn'}">📐 标准模式</button>
        </div>
        ${buildSeparator()}
        <div class="opt-btn-row">
            <button id="opt-contact-reset" class="opt-btn-secondary">重置</button>
            <button id="opt-contact-cancel" class="opt-btn-secondary">取消</button>
            ${addButton}
        </div>
    </div>`;

    const nameInput = document.getElementById('opt-contact-name') as HTMLInputElement | null;
    nameInput?.addEventListener('input', () => {
        if (contactDraft) {
            contactDraft.name = nameInput.value.trim() || contactDraft.name;
        }
    });

    const typeInput = document.getElementById('opt-contact-type') as HTMLSelectElement | null;
    typeInput?.addEventListener('change', () => {
        if (contactDraft) {
            contactDraft.contactType = (typeInput.value as ContactType) || contactDraft.contactType;
            contactCreationPreset = contactDraft.contactType;
        }
    });

    const updateSize = (value: number): void => {
        updateContactDraftSize(value);
    };

    const sizeInput = document.getElementById('opt-contact-size') as HTMLInputElement | null;
    sizeInput?.addEventListener('input', () => {
        updateSize(Number.parseFloat(sizeInput.value));
    });
    const sizeRangeInput = document.getElementById('opt-contact-size-range') as HTMLInputElement | null;
    sizeRangeInput?.addEventListener('input', () => {
        updateSize(Number.parseFloat(sizeRangeInput.value));
    });

    document.getElementById('opt-contact-mode-fast')?.addEventListener('click', () => {
        contactCreationMode = 'fast';
        renderContactOptionsPanel();
    });
    document.getElementById('opt-contact-mode-standard')?.addEventListener('click', () => {
        contactCreationMode = 'standard';
        renderContactOptionsPanel();
    });
    document.getElementById('opt-contact-reset')?.addEventListener('click', () => {
        contactDraft = createDefaultContactDraft(contactDraft?.contactType ?? contactCreationPreset);
        renderContactOptionsPanel();
        setStatus('请选择特征 1');
        setStatusInfo('Contact draft reset.');
    });
    document.getElementById('opt-contact-cancel')?.addEventListener('click', () => {
        resetCanvasInteraction();
        closeOptionsPanel();
        setStatus('Ready');
    });
    document.getElementById('opt-contact-add')?.addEventListener('click', () => {
        createContactFromDraft();
    });
}

function collectGroupableShapeIds(shapes: LoadedShape[]): string[] {
    const result: string[] = [];
    const visit = (shape: LoadedShape): void => {
        if (shape.type === 'assembly' && shape.children && shape.children.length > 0) {
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
    const result = cleanEmptyGroupsInState(groupDesignState, isGroupReferenced);
    groupDesignState = result.state as GroupDesignState;
    updateModelTree();
    if (result.blockedGroupIds.length > 0) {
        vscode.postMessage({
            command: 'alert',
            text: `Skipped ${result.blockedGroupIds.length} referenced empty group(s).`
        });
    }
    setStatusInfo(`Empty groups cleaned: ${result.removedGroupIds.length}`);
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
        setStatusInfo(`Ungrouped to 物体: moved ${result.movedParts} part(s) and ${result.movedGroups} child group(s).`);
    } catch (error) {
        vscode.postMessage({
            command: 'alert',
            text: error instanceof Error ? error.message : `Ungroup failed: ${error}`
        });
    }
}

function handleCreateJoint(jointType: string): void {
    startJointCreation(jointType);
}

function handleCreateMotion(motionType: string): void {
    startMotionCreation(motionType);
}

function handleMotionProperties(): void {
    const activeMotionId = getActiveMotionId();
    const target = activeMotionId
        ? (mbsMotions.get(activeMotionId) ?? null)
        : (Array.from(mbsMotions.values()).at(-1) ?? null);
    if (!target) {
        vscode.postMessage({
            command: 'alert',
            text: 'No motion available. Please create a motion first.'
        });
        return;
    }

    renderMotionPropertiesPanel(target.id);
}

function getContactFeatureFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): ContactFeatureRef {
    return {
        shapeId: selectedShape.id,
        position: cloneVec3(position),
        normal: normalizeVector(cloneVec3(normal)) ?? { x: 0, y: 0, z: 1 }
    };
}

function getShapeContactAnchor(shapeId: string): ContactFeatureRef {
    const shape = loadedShapes.get(shapeId);
    if (shape?.meshData) {
        const center = calculateShapeCenter(shape);
        return {
            shapeId,
            position: { x: center.x, y: center.y, z: center.z },
            normal: { x: 0, y: 0, z: 1 }
        };
    }
    return {
        shapeId,
        position: { x: 0, y: 0, z: 0 },
        normal: { x: 0, y: 0, z: 1 }
    };
}

function createContactVisual(contact: MbsContactEntity): THREE.Group | null {
    const pointA = new THREE.Vector3(contact.featureA.position.x, contact.featureA.position.y, contact.featureA.position.z);
    const pointB = new THREE.Vector3(contact.featureB.position.x, contact.featureB.position.y, contact.featureB.position.z);
    const direction = new THREE.Vector3().subVectors(pointB, pointA);
    const distance = direction.length();
    if (!Number.isFinite(distance) || distance <= 1e-6 || !viewer) {
        return null;
    }

    const radius = Math.max(0.6, contact.iconSize * 0.04);
    const material = new THREE.MeshPhongMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 0.18,
        transparent: true,
        opacity: contact.visible ? 0.9 : 0.15
    });
    const sphereGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const centerGeometry = new THREE.SphereGeometry(radius * 1.3, 20, 20);
    const cylinderGeometry = new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, distance, 12, 1, false);

    const group = new THREE.Group();
    group.name = `contact_${contact.id}`;

    const sphereA = new THREE.Mesh(sphereGeometry, material.clone());
    sphereA.position.copy(pointA);
    group.add(sphereA);

    const sphereB = new THREE.Mesh(sphereGeometry, material.clone());
    sphereB.position.copy(pointB);
    group.add(sphereB);

    const connector = new THREE.Mesh(cylinderGeometry, material.clone());
    const midpoint = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
    connector.position.copy(midpoint);
    connector.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    group.add(connector);

    const core = new THREE.Mesh(centerGeometry, material.clone());
    core.position.copy(midpoint);
    group.add(core);

    group.visible = contact.visible;
    group.userData = {
        contactId: contact.id,
        contactName: contact.name,
        selectionAppearance: 'contact'
    };

    viewer.getScene().add(group);
    viewer.registerSelectableObject(contact.id, group);
    contactVisuals.set(contact.id, group);
    return group;
}

function removeContactVisual(contactId: string): void {
    const group = contactVisuals.get(contactId);
    if (!group || !viewer) {
        return;
    }

    viewer.unregisterSelectableObject(contactId);
    viewer.getScene().remove(group);
    group.traverse((child) => {
        const disposable = child as THREE.Object3D & {
            geometry?: THREE.BufferGeometry;
            material?: THREE.Material | THREE.Material[];
        };
        disposable.geometry?.dispose();
        if (Array.isArray(disposable.material)) {
            disposable.material.forEach((material) => material.dispose());
        } else {
            disposable.material?.dispose();
        }
    });
    contactVisuals.delete(contactId);
}

function upsertContactVisual(contact: MbsContactEntity): void {
    removeContactVisual(contact.id);
    createContactVisual(contact);
}

function handleContactProperties(): void {
    const contactId = getActiveContactId();
    if (!contactId) {
        vscode.postMessage({
            command: 'alert',
            text: 'No contact selected.'
        });
        return;
    }
    renderContactPropertiesPanel(contactId);
}

function createContactFromDraft(): void {
    const draft = contactDraft;
    if (!draft?.featureA || !draft.featureB) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please pick feature 1 and feature 2 first.'
        });
        return;
    }
    if (draft.featureA.shapeId === draft.featureB.shapeId) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please pick two different parts for contact creation.'
        });
        return;
    }

    const contact: MbsContactEntity = {
        id: nextEntityId('contact', mbsContacts.size),
        name: draft.name.trim() || `Contact${mbsContacts.size + 1}`,
        contactType: draft.contactType,
        partA: draft.featureA.shapeId,
        partB: draft.featureB.shapeId,
        featureA: {
            shapeId: draft.featureA.shapeId,
            position: cloneVec3(draft.featureA.position),
            normal: cloneVec3(draft.featureA.normal)
        },
        featureB: {
            shapeId: draft.featureB.shapeId,
            position: cloneVec3(draft.featureB.position),
            normal: cloneVec3(draft.featureB.normal)
        },
        iconSize: Math.max(1, draft.iconSize),
        visible: true,
        createdAt: new Date().toISOString()
    };

    mbsContacts.set(contact.id, contact);
    upsertContactVisual(contact);
    updateModelTree();
    selectSelection({ kind: 'contact', id: contact.id });
    setStatusInfo(`Contact created: ${contact.name}`);

    contactDraft = createDefaultContactDraft(draft.contactType);
    renderContactOptionsPanel();
    setStatus('请选择特征 1');
}

function handleContactPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): void {
    const nextFeature = getContactFeatureFromPlacement(selectedShape, position, normal);
    if (!contactDraft) {
        contactDraft = createDefaultContactDraft(contactCreationPreset);
    }

    if (!contactDraft.featureA || (contactDraft.featureA && contactDraft.featureB)) {
        contactDraft.featureA = nextFeature;
        contactDraft.featureB = undefined;
        renderContactOptionsPanel();
        setStatus('请选择特征 2');
        setStatusInfo(`Feature 1 selected: ${selectedShape.name}`);
        return;
    }

    contactDraft.featureB = nextFeature;
    renderContactOptionsPanel();
    setStatusInfo(`Feature 2 selected: ${selectedShape.name}`);
    if (contactCreationMode === 'fast') {
        createContactFromDraft();
    } else {
        setStatus('点击“添加”完成接触创建');
    }
}

function startContactCreation(contactType: ContactType): void {
    if (canvasInteractionMode === 'createContact' && contactCreationPanelActive && contactCreationPreset === contactType) {
        resetCanvasInteraction();
        closeOptionsPanel();
        setStatus('Ready');
        return;
    }

    resetCanvasInteraction();
    canvasInteractionMode = 'createContact';
    contactCreationPanelActive = true;
    contactCreationPreset = contactType;
    contactDraft = createDefaultContactDraft(contactType);
    viewer?.setSelectionEnabled(false);
    renderContactOptionsPanel();
    setCanvasCursor('crosshair');
    setStatus('请选择特征 1');
    setStatusInfo('Contact creation mode active');
}

function deleteContactById(contactId: string): boolean {
    const contact = mbsContacts.get(contactId);
    if (!contact) {
        return false;
    }

    if (selectedContactId === contactId || getActiveContactId() === contactId) {
        selectSelection(null);
    }
    selectedNodeIds.delete(toContactSelectionKey(contactId));
    mbsContacts.delete(contactId);
    removeContactVisual(contactId);
    updateModelTree();
    setStatusInfo(`Contact deleted: ${contact.name}`);
    return true;
}

function deleteJointById(jointId: string): boolean {
    const joint = mbsJoints.get(jointId);
    if (!joint) {
        return false;
    }

    Array.from(mbsMotions.values())
        .filter((motion) => motion.connectorRef === jointId)
        .forEach((motion) => {
            deleteMotionById(motion.id);
        });

    if (selectedJointId === jointId || getActiveJointId() === jointId) {
        selectSelection(null);
    }
    selectedNodeIds.delete(toJointSelectionKey(jointId));
    mbsJoints.delete(jointId);
    viewer?.removeJoint(jointId);
    updateModelTree();
    setStatusInfo(`Joint deleted: ${joint.name}`);
    return true;
}

function deleteMotionById(motionId: string): boolean {
    const motion = mbsMotions.get(motionId);
    if (!motion) {
        return false;
    }

    if (selectedMotionId === motionId || getActiveMotionId() === motionId) {
        selectSelection(null);
    }
    selectedNodeIds.delete(toMotionSelectionKey(motionId));
    mbsMotions.delete(motionId);
    updateModelTree();
    setStatusInfo(`Motion deleted: ${motion.name}`);
    return true;
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
    resetCanvasInteraction();
    markerCreationPanelActive = true;
    canvasInteractionMode = 'createMarker';
    markerDraftPickIntent = 'placement';
    selectSelection(null);
    viewer?.setSelectionEnabled(false);
    renderMarkerCreationPanel();
    setStatus('Click on a face to create marker');
    setStatusInfo('Marker creation mode active');
    setCanvasCursor('crosshair');
}

/**
 * Start reference marker creation mode
 */
function startRefFrameCreation(): void {
    if (createdMarkers.length === 0) {
        vscode.postMessage({
            command: 'alert',
            text: 'Please create a basic marker first before creating a reference marker.'
        });
        return;
    }

    resetCanvasInteraction();
    pendingRefFrameBaseId = null;
    pendingRefFrameTargetShapeId = null;
    selectSelection(null);
    renderRefFrameCreationPanel();
    setStatus('Pick a marker in 3D view, then select a target part to create reference marker');
    setStatusInfo('Reference marker creation mode active');
}

function startJointCreation(jointType: string): void {
    resetCanvasInteraction();
    jointDraft = createDefaultJointDraft(jointType);
    jointDraftPickStage = 'part1';
    jointCreationPanelActive = true;
    canvasInteractionMode = 'createJoint';
    selectSelection(null);
    viewer?.setSelectionEnabled(false);
    renderJointOptionsPanel();
    setStatus('请选择零件 1');
    setStatusInfo(`Connection creation mode active: ${normalizeConnectorType(jointType)}`);
    setCanvasCursor('crosshair');
}

/**
 * Start design point creation mode
 */
function startDesignPointCreation(): void {
    resetCanvasInteraction();
    const targetShape = selectedShapeId
        ? loadedShapes.get(selectedShapeId) ?? null
        : (shapeSelectionHistory.at(-1) ? loadedShapes.get(shapeSelectionHistory.at(-1) ?? '') ?? null : null);
    if (targetShape) {
        selectedShapeId = targetShape.id;
        rememberShapeSelection(targetShape.id);
        designPointDraft = createEmptyDesignPointDraft(targetShape);
    } else {
        designPointDraft = createLooseDesignPointDraft();
    }
    designPointCreationPanelActive = true;
    designPointCreationMode = 'pick';
    designPointCalcMode = 'midpoint';
    designPointPickIntent = 'placement';
    canvasInteractionMode = 'createDesignPoint';
    viewer?.setSelectionEnabled(false);
    setStatus('Click on a face to pick design point placement');
    setStatusInfo('Design point creation mode active');
    setCanvasCursor('crosshair');
    renderDesignPointOptionsPanel();
}

/**
 * Start frame editing mode
 */
function startFrameEditMode(): void {
    const target = resolveLatestExistingFrameFromHistory();
    if (!target) {
        vscode.postMessage({
            command: 'alert',
            text: 'No frame available to edit. Please create a marker or reference marker first.'
        });
        return;
    }

    startFrameEditModeForTarget(target.id, target.kind, 'placement');
}

function startFrameEditModeForTarget(
    id: string,
    kind: FrameEntityKind,
    pickIntent: 'placement' | 'position' | 'direction'
): void {
    const targetShape = findOwningShapeForFrame(id, kind) ?? (shapeSelectionHistory.at(-1) ? loadedShapes.get(shapeSelectionHistory.at(-1) ?? '') ?? null : null);
    if (!targetShape) {
        vscode.postMessage({
            command: 'alert',
            text: 'No target part available for frame editing. Please select a related part first.'
        });
        return;
    }

    selectedShapeId = targetShape.id;
    rememberShapeSelection(targetShape.id);
    resetCanvasInteraction();
    canvasInteractionMode = 'editFrame';
    editingFrameTarget = { id, kind };
    frameEditPickIntent = pickIntent;
    viewer?.setSelectionEnabled(false);
    setStatus(pickIntent === 'position'
        ? 'Click on a face to update frame position'
        : pickIntent === 'direction'
            ? 'Click on a face to update frame direction'
            : 'Click on a face to reposition the frame');
    setStatusInfo(`Editing ${kind === 'marker' ? 'marker' : 'reference marker'}: ${id}`);
    setCanvasCursor('crosshair');
}

function resolveFacePlacement(
    event: MouseEvent,
    options?: { silent?: boolean; enableInference?: boolean }
): { selectedShape: LoadedShape; position: Vec3; normal: Vec3; guide: MarkerGuideData | null; feature: DesignPointFeature | null } | null {
    if (!viewer || !occt) {
        return null;
    }

    const selectedShape = pickShapeAtPointerEvent(event)
        ?? (selectedShapeId ? loadedShapes.get(selectedShapeId) ?? null : null)
        ?? (shapeSelectionHistory.at(-1) ? loadedShapes.get(shapeSelectionHistory.at(-1) ?? '') ?? null : null);
    if (!selectedShape || !selectedShape.shapeId) {
        if (!options?.silent) {
            vscode.postMessage({
                command: 'alert',
                text: 'Selected part has no geometry to place marker/design point.'
            });
        }
        return null;
    }

    const ray = viewer.getRayFromScreenPoint(event.clientX, event.clientY);
    if (!ray) {
        console.warn('Failed to get ray from screen point');
        return null;
    }

    const shapeTransform = normalizeRigidTransform(selectedShape.transform);
    const inverseShapeTransform = invertRigidTransform(shapeTransform);
    const [localOriginX, localOriginY, localOriginZ] = transformPoint(
        inverseShapeTransform,
        ray.origin.x,
        ray.origin.y,
        ray.origin.z
    );
    const [localDirX, localDirY, localDirZ] = transformDirection(
        inverseShapeTransform,
        ray.direction.x,
        ray.direction.y,
        ray.direction.z
    );
    const localDirection = normalizeVector({ x: localDirX, y: localDirY, z: localDirZ }) ?? {
        x: localDirX,
        y: localDirY,
        z: localDirZ
    };

    const result = occt.getFaceNormalAtPoint(
        selectedShape.shapeId,
        {
            x: localOriginX,
            y: localOriginY,
            z: localOriginZ
        },
        localDirection
    );

    if (!result) {
        if (!options?.silent) {
            vscode.postMessage({
                command: 'alert',
                text: 'No face found at click position. Please click on a face.'
            });
        }
        return null;
    }

    const [worldPositionX, worldPositionY, worldPositionZ] = transformPoint(
        shapeTransform,
        result.position.x,
        result.position.y,
        result.position.z
    );
    const [worldNormalX, worldNormalY, worldNormalZ] = transformDirection(
        shapeTransform,
        result.normal.x,
        result.normal.y,
        result.normal.z
    );
    const worldNormal = normalizeVector({
        x: worldNormalX,
        y: worldNormalY,
        z: worldNormalZ
    }) ?? {
        x: worldNormalX,
        y: worldNormalY,
        z: worldNormalZ
    };
    const localSnapPoint = result.snapPoint ?? result.inferredPosition;
    const localSnapDirection = result.snapDirection ?? result.inferredDirection;
    const snapKind = result.snapKind
        ?? (result.inferredFeature === 'cylinderAxis'
            ? 'cylinder-axis'
            : result.inferredFeature === 'sphereCenter'
                ? 'sphere-center'
                : undefined);
    const worldSnapPoint = localSnapPoint
        ? (() => {
            const [x, y, z] = transformPoint(
                shapeTransform,
                localSnapPoint.x,
                localSnapPoint.y,
                localSnapPoint.z
            );
            return { x, y, z };
        })()
        : undefined;
    const worldSnapDirection = localSnapDirection
        ? (() => {
            const [x, y, z] = transformDirection(
                shapeTransform,
                localSnapDirection.x,
                localSnapDirection.y,
                localSnapDirection.z
            );
            return normalizeVector({ x, y, z }) ?? { x, y, z };
        })()
        : undefined;
    const worldCylinderAxisStart = result.cylinderAxisStart
        ? (() => {
            const [x, y, z] = transformPoint(
                shapeTransform,
                result.cylinderAxisStart.x,
                result.cylinderAxisStart.y,
                result.cylinderAxisStart.z
            );
            return { x, y, z };
        })()
        : undefined;
    const worldCylinderAxisEnd = result.cylinderAxisEnd
        ? (() => {
            const [x, y, z] = transformPoint(
                shapeTransform,
                result.cylinderAxisEnd.x,
                result.cylinderAxisEnd.y,
                result.cylinderAxisEnd.z
            );
            return { x, y, z };
        })()
        : undefined;

    const inferEnabled = options?.enableInference ?? (canvasInteractionMode === 'createMarker' || canvasInteractionMode === 'editFrame');
    const circularEdgePlacement = inferEnabled
        ? inferPlacementFromCircularEdge(
            selectedShape,
            {
                x: worldPositionX,
                y: worldPositionY,
                z: worldPositionZ
            },
            worldNormal
        )
        : null;
    const inferredPlacement = inferEnabled
        ? (circularEdgePlacement ?? {
            position: {
                x: worldPositionX,
                y: worldPositionY,
                z: worldPositionZ
            },
            normal: worldNormal,
            guide: null
        })
        : {
            position: {
                x: worldPositionX,
                y: worldPositionY,
                z: worldPositionZ
            },
            normal: worldNormal,
            guide: null
        };
    if (inferEnabled && !circularEdgePlacement) {
        const placement = inferMarkerPlacement(
            selectedShape,
            {
                x: worldPositionX,
                y: worldPositionY,
                z: worldPositionZ
            },
            worldNormal,
            {
                snapKind,
                snapPoint: worldSnapPoint,
                snapDirection: worldSnapDirection,
                snapConfidence: result.snapConfidence ?? (snapKind ? 1 : undefined)
            } as {
                snapPoint?: Vec3;
                snapDirection?: Vec3;
                snapKind?: string;
                snapConfidence?: number;
            }
        );
        inferredPlacement.position = placement.position;
        inferredPlacement.normal = placement.normal;
        if (
            markerFeatureInferenceEnabled
            && snapKind === 'cylinder-axis'
            && worldCylinderAxisStart
            && worldCylinderAxisEnd
            && worldSnapPoint
            && typeof result.cylinderRadius === 'number'
            && Number.isFinite(result.cylinderRadius)
            && result.cylinderRadius > 0
        ) {
            inferredPlacement.guide = {
                kind: 'cylinder',
                axisStart: worldCylinderAxisStart,
                axisEnd: worldCylinderAxisEnd,
                radius: result.cylinderRadius,
                viewDirection: normalizeVector(ray.direction) ?? ray.direction,
                snapCircleCenter: worldSnapPoint
            };
        }
    }

    return {
        selectedShape,
        position: inferredPlacement.position,
        normal: inferredPlacement.normal,
        guide: inferredPlacement.guide,
        feature: worldSnapPoint && worldSnapDirection
            ? {
                kind: 'line',
                point: worldSnapPoint,
                direction: worldSnapDirection,
                label: snapKind === 'cylinder-axis' ? '轴线' : '直线'
            }
            : {
                kind: 'plane',
                point: inferredPlacement.position,
                normal: inferredPlacement.normal,
                label: '平面'
            }
    };
}

function handleCanvasPointerMove(event: MouseEvent): void {
    const markerPlacementActive = canvasInteractionMode === 'createMarker' && markerCreationPanelActive;
    const jointPlacementActive = canvasInteractionMode === 'createJoint' && jointCreationPanelActive;
    const frameEditActive = canvasInteractionMode === 'editFrame' && editingFrameTarget !== null;
    if (!markerPlacementActive && !jointPlacementActive && !frameEditActive) {
        return;
    }

    const placement = resolveFacePlacement(event, {
        silent: true,
        enableInference: jointPlacementActive
            ? jointFeatureInferenceEnabled
            : true
    });
    if (!placement) {
        if (markerPlacementActive && !markerDraft) {
            clearMarkerDraftPreview();
        } else {
            viewer?.setMarkerGuide(null);
        }
        return;
    }

    viewer?.setMarkerGuide(placement.guide);
    if (markerPlacementActive) {
        showMarkerPreview(buildMarkerPreviewDraft(placement.selectedShape, placement.position, placement.normal));
    }
}

function createMarkerFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): void {
    if (markerCreationMode === 'standard') {
        const nameInput = document.getElementById('opt-marker-name') as HTMLInputElement | null;
        const sizeInput = document.getElementById('opt-marker-size') as HTMLInputElement | null;
        const owner = resolveFrameOwnerForShape(selectedShape.id);
        const nextOrientation = createOrientationFromNormal(normal);
        const nextPosition = cloneVec3(position);
        const nextSize = Math.max(1, Number.parseFloat(sizeInput?.value ?? `${pendingMarkerSize}`) || pendingMarkerSize);

        if (!markerDraft) {
            markerDraft = {
                name: nameInput?.value?.trim() || `Marker${createdMarkers.length + 1}`,
                owner,
                hostShapeId: selectedShape.id,
                position: nextPosition,
                orientation: nextOrientation,
                size: nextSize
            };
        } else {
            markerDraft.name = nameInput?.value?.trim() || markerDraft.name;
            markerDraft.size = nextSize;
            markerDraft.owner = owner;
            markerDraft.hostShapeId = selectedShape.id;
            if (markerDraftPickIntent === 'placement' || markerDraftPickIntent === 'position') {
                markerDraft.position = nextPosition;
            }
            if (markerDraftPickIntent === 'placement' || markerDraftPickIntent === 'direction') {
                markerDraft.orientation = nextOrientation;
            }
        }

        syncMarkerDraftPreview();
        renderMarkerCreationPanel();
        setStatusInfo(`Marker draft updated: ${markerDraft.name}`);
        return;
    }

    const nameInput = document.getElementById('opt-marker-name') as HTMLInputElement | null;
    const sizeInput = document.getElementById('opt-marker-size') as HTMLInputElement | null;
    const marker = markerCreator.createMarker({
        position,
        normal,
        groupId: resolveFrameOwnerForShape(selectedShape.id).id,
        name: nameInput?.value?.trim() || `Marker${createdMarkers.length + 1}`
    });
    marker.setParentId(selectedShape.id);
    marker.setSize(Math.max(1, Number.parseFloat(sizeInput?.value ?? `${pendingMarkerSize}`) || pendingMarkerSize));
    marker.setVisible(true);

    createdMarkers.push(marker);
    pendingMarkerSize = marker.size;
    recordFrameCreation(marker.id, 'marker');

    viewer?.addFrame({
        id: marker.id,
        name: marker.name,
        position: marker.position,
        orientation: marker.orientation,
        size: marker.size,
        visible: marker.visible,
        isPrimary: true
    });

    updateModelTree();
    selectSelection({ kind: 'marker', id: marker.id });
    viewer?.setSelectionEnabled(false);
    renderMarkerCreationPanel();
    setStatus('Click on a face to create marker');
    setStatusInfo(`Marker created: ${marker.name}`);
}

function createJointFromPlacement(selectedShape: LoadedShape, position: Vec3, normal: Vec3): void {
    if (!jointDraft) {
        return;
    }

    syncJointDraftFromInputs();
    const pickedDirection = jointDraft.inferenceEnabled
        ? normal
        : DEFAULT_CONNECTOR_DIRECTION;
    const pick: JointDraftPick = {
        partId: selectedShape.id,
        position: cloneVec3(position),
        direction: cloneVec3(pickedDirection)
    };

    if (jointDraftPickStage === 'part1') {
        jointDraft.part1 = selectedShape.id;
        jointDraft.part1Pick = pick;
        jointDraft.part2 = undefined;
        jointDraft.part2Pick = undefined;
        jointDraftPickStage = 'part2';
        recomputeJointDraftPlacement();
        renderJointOptionsPanel();
        setStatus('请选择零件 2');
        setStatusInfo(`零件 1 已选择：${selectedShape.name}`);
        return;
    }

    jointDraft.part2 = selectedShape.id;
    jointDraft.part2Pick = pick;
    const validation = validateConnectorParticipants(jointDraft.part1, jointDraft.part2);
    if (!validation.valid) {
        jointDraft.part2 = undefined;
        jointDraft.part2Pick = undefined;
        vscode.postMessage({
            command: 'alert',
            text: validation.reason ?? '连接创建失败。'
        });
        renderJointOptionsPanel();
        return;
    }

    recomputeJointDraftPlacement();
    if (jointCreationMode === 'fast') {
        finalizeJointDraft();
        return;
    }

    renderJointOptionsPanel();
    setStatus('可调整位置/方向后点击添加');
    setStatusInfo(`零件 2 已选择：${selectedShape.name}`);
}

function createDesignPointFromPlacement(
    selectedShape: LoadedShape,
    position: Vec3,
    normal: Vec3,
    feature: DesignPointFeature | null
): void {
    const draft = designPointDraft ?? createEmptyDesignPointDraft(selectedShape);
    const owner = resolveFrameOwnerForShape(selectedShape.id);
    draft.groupId = owner.id;
    draft.hostShapeId = selectedShape.id;
    draft.position = cloneVec3(position);
    draft.direction = normalizeVector(cloneVec3(normal)) ?? draft.direction;
    draft.markerRefId = draft.markerRefId ?? resolveLatestExistingFrameFromHistory()?.id;

    switch (designPointCreationMode) {
        case 'pick':
            designPointPickIntent = 'placement';
            setStatusInfo('Design point placement updated.');
            break;
        case 'calc':
            if (designPointCalcMode === 'midpoint') {
                if (designPointPickIntent === 'firstPoint') {
                    draft.firstPoint = cloneVec3(position);
                    setStatusInfo('First point selected.');
                } else if (designPointPickIntent === 'secondPoint') {
                    draft.secondPoint = cloneVec3(position);
                    setStatusInfo('Second point selected.');
                }
            } else if (designPointCalcMode === 'offset') {
                if (designPointPickIntent === 'basePoint') {
                    draft.basePoint = cloneVec3(position);
                    setStatusInfo('Reference point selected.');
                } else if (designPointPickIntent === 'direction') {
                    draft.direction = normalizeVector(cloneVec3(normal)) ?? draft.direction;
                    setStatusInfo('Reference direction selected.');
                }
            } else if (designPointPickIntent === 'featureA') {
                if (!feature) {
                    vscode.postMessage({
                        command: 'alert',
                        text: 'Selected feature cannot be used for intersection.'
                    });
                } else {
                    draft.featureA = feature;
                    setStatusInfo('First feature selected.');
                }
            } else if (designPointPickIntent === 'featureB') {
                if (!feature) {
                    vscode.postMessage({
                        command: 'alert',
                        text: 'Selected feature cannot be used for intersection.'
                    });
                } else {
                    draft.featureB = feature;
                    setStatusInfo('Second feature selected.');
                }
            }
            recalculateDesignPointDraft(draft, true);
            break;
        default:
            break;
    }

    designPointDraft = draft;
    renderDesignPointOptionsPanel();
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

        if (frameEditPickIntent === 'placement' || frameEditPickIntent === 'position') {
            marker.setPosition(position.x, position.y, position.z);
        }
        if (frameEditPickIntent === 'placement' || frameEditPickIntent === 'direction') {
            marker.setOrientation(orientation);
        }
        syncFrameEntityToViewer('marker', marker.id);

        setStatusInfo(`Marker edited: ${marker.name}`);
        renderMarkerPropertiesPanel(marker.id);
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

    if (frameEditPickIntent === 'placement' || frameEditPickIntent === 'position') {
        refFrame.position = cloneVec3(position);
    }
    if (frameEditPickIntent === 'placement' || frameEditPickIntent === 'direction') {
        refFrame.orientation = orientation;
    }
    syncFrameEntityToViewer('refFrame', refFrame.id);

    setStatusInfo(`Reference marker edited: ${refFrame.name}`);
    renderRefFramePropertiesPanel(refFrame.id);
    return true;
}

/**
 * Handle click on canvas for marker/ref marker/design point/frame editing
 */
function handleCanvasClick(event: MouseEvent): void {
    if (canvasInteractionMode === 'none') return;

    const placement = resolveFacePlacement(event, {
        enableInference: canvasInteractionMode === 'createJoint'
            ? jointFeatureInferenceEnabled
            : undefined
    });
    if (!placement) return;

    let completed = false;
    switch (canvasInteractionMode) {
        case 'createMarker':
            createMarkerFromPlacement(placement.selectedShape, placement.position, placement.normal);
            break;
        case 'createJoint':
            createJointFromPlacement(placement.selectedShape, placement.position, placement.normal);
            break;
        case 'createContact':
            handleContactPlacement(placement.selectedShape, placement.position, placement.normal);
            break;
        case 'createDesignPoint':
            createDesignPointFromPlacement(placement.selectedShape, placement.position, placement.normal, placement.feature);
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
            if (canvasInteractionMode === 'createDesignPoint') {
                closeOptionsPanel();
                setStatus('Ready');
                return;
            }
            startDesignPointCreation();
            break;
        }
        case 'createContact': {
            const contactType = (params.contactType as ContactType | undefined) ?? 'pointPoint';
            startContactCreation(contactType);
            break;
        }
        case 'editFrame': {
            startFrameEditMode();
            break;
        }
        case 'deleteFrame': {
            const activeMarkerId = getActiveMarkerId();
            const activeRefFrameId = getActiveRefFrameId();
            const target = activeMarkerId
                ? { index: -1, id: activeMarkerId, kind: 'marker' as const }
                : activeRefFrameId
                    ? { index: -1, id: activeRefFrameId, kind: 'refFrame' as const }
                    : resolveLatestExistingFrameFromHistory();
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
                    if (target.index >= 0) {
                        frameCreationHistory.splice(target.index, 1);
                    }
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
                if (target.index >= 0) {
                    frameCreationHistory.splice(target.index, 1);
                }
                updateModelTree();
                selectSelection(null);
                setStatusInfo(`Marker deleted: ${marker.name}`);
                vscode.postMessage({
                    command: 'alert',
                    text: `Marker "${marker.name}" deleted.`
                });
                break;
            }

            const refFrame = createdRefFrames.get(target.id);
            if (!refFrame) {
                if (target.index >= 0) {
                    frameCreationHistory.splice(target.index, 1);
                }
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
            if (target.index >= 0) {
                frameCreationHistory.splice(target.index, 1);
            }
            updateModelTree();
            selectSelection(null);
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
        case 'deleteJoint': {
            const activeId = getActiveJointId();
            if (!activeId) {
                vscode.postMessage({
                    command: 'alert',
                    text: 'No joint selected.'
                });
                return;
            }
            deleteJointById(activeId);
            break;
        }
        case 'jointProperties': {
            const activeId = getActiveJointId();
            if (!activeId) {
                vscode.postMessage({
                    command: 'alert',
                    text: 'No joint selected.'
                });
                return;
            }
            renderJointPropertiesPanel(activeId);
            break;
        }
        case 'createMotion': {
            const motionType = params.motionType as string;
            handleCreateMotion(motionType);
            break;
        }
        case 'deleteMotion': {
            const activeId = getActiveMotionId();
            if (!activeId) {
                vscode.postMessage({
                    command: 'alert',
                    text: 'No motion selected.'
                });
                return;
            }
            deleteMotionById(activeId);
            break;
        }
        case 'deleteContact': {
            const activeId = getActiveContactId();
            if (!activeId) {
                vscode.postMessage({
                    command: 'alert',
                    text: 'No contact selected.'
                });
                return;
            }
            deleteContactById(activeId);
            break;
        }
        case 'contactProperties': {
            handleContactProperties();
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
            backgroundColor: 0xe9edf2,
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

        // Add pointer listeners for marker creation/editing
        container.addEventListener('mousemove', handleCanvasPointerMove);
        container.addEventListener('click', handleCanvasClick);
        container.addEventListener('wheel', (event) => {
            if (!event.altKey) {
                return;
            }
            if (contactCreationPanelActive) {
                event.preventDefault();
                const delta = event.deltaY < 0 ? 1 : -1;
                const nextSize = updateContactDraftSize(pendingContactSize + delta);
                renderContactOptionsPanel();
                setStatusInfo(`Contact icon size: ${nextSize}`);
                return;
            }
            if (!motionCreationPanelActive) {
                return;
            }
            event.preventDefault();
            const delta = event.deltaY < 0 ? 1 : -1;
            const nextSize = updateMotionDraftSize(pendingMotionIconSize + delta);
            renderMotionOptionsPanel();
            setStatusInfo(`Motion icon size: ${nextSize}`);
        }, { passive: false });

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
        if (event.key === 'Escape' && !isTypingTarget) {
            if (
                canvasInteractionMode !== 'none'
                || markerCreationPanelActive
                || jointCreationPanelActive
                || motionCreationPanelActive
                || refFrameCreationPanelActive
                || designPointDraft
                || contactCreationPanelActive
            ) {
                event.preventDefault();
                closeOptionsPanel();
                setStatus('Ready');
            }
            return;
        }
        if (event.key !== 'Delete' || isTypingTarget) {
            return;
        }
        if (
            selectedNodeIds.size === 0
        ) {
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
            } else if (actionId.startsWith('createContact_')) {
                params.contactType = actionId.replace('createContact_', '');
                handleMbsAction('createContact', params);
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


