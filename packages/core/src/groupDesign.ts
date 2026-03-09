export type GroupKind = 'manual' | 'default' | 'imported';

export type GroupDesignMode = 'idle' | 'group-create' | 'move' | 'delete';

export interface GroupNode {
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

export interface GroupDesignState {
    groupsById: Record<string, GroupNode>;
    rootGroupIds: string[];
    ungroupedPartIds: string[];
    selectedNodeIds: string[];
    activeMode: GroupDesignMode;
}

export interface CreateGroupDesignStateInput {
    groups?: GroupNode[];
    allPartIds?: string[];
    selectedNodeIds?: string[];
    activeMode?: GroupDesignMode;
}

export interface CreateGroupNodeInput {
    id: string;
    name: string;
    memberPartIds: string[];
    parentGroupId?: string | null;
    kind?: GroupKind;
    order?: number;
    createdAt?: string;
}

export interface MoveGroupNodesInput {
    partIds?: string[];
    groupIds?: string[];
    targetGroupId?: string | null;
}

export interface MoveGroupNodesResult {
    state: GroupDesignState;
    movedParts: number;
    movedGroups: number;
}

export interface UngroupGroupResult {
    state: GroupDesignState;
    movedGroups: number;
    movedParts: number;
    parentGroupId: string | null;
}

export interface CleanEmptyGroupsResult {
    state: GroupDesignState;
    removedGroupIds: string[];
    blockedGroupIds: string[];
}

export interface DeleteGroupsResult {
    state: GroupDesignState;
    deletedGroupIds: string[];
    blockedMessages: string[];
}

export interface GroupSchemaRecord {
    name: string;
    parts?: string[];
    parentRef?: string | null;
    kind?: GroupKind;
    order?: number;
}

export interface ImportGroupSchemaInput {
    records: GroupSchemaRecord[];
    allPartIds?: string[];
    resolvePartRef?: (partRef: string) => string;
    createGroupId?: (index: number, record: GroupSchemaRecord) => string;
    now?: () => string;
}

function cloneGroupNode(group: GroupNode): GroupNode {
    return {
        ...group,
        parentGroupId: group.parentGroupId ?? null,
        childGroupIds: [...group.childGroupIds],
        memberPartIds: [...group.memberPartIds]
    };
}

function compareGroups(left: GroupNode, right: GroupNode): number {
    return left.order - right.order || left.name.localeCompare(right.name);
}

function getAllKnownPartIds(state: GroupDesignState): string[] {
    const partIds = new Set<string>(state.ungroupedPartIds);
    Object.values(state.groupsById).forEach((group) => {
        group.memberPartIds.forEach((partId) => partIds.add(partId));
    });
    return Array.from(partIds);
}

function cloneState(state: GroupDesignState, allPartIds: string[] = getAllKnownPartIds(state)): GroupDesignState {
    return createGroupDesignState({
        groups: Object.values(state.groupsById).map(cloneGroupNode),
        allPartIds,
        selectedNodeIds: state.selectedNodeIds,
        activeMode: state.activeMode
    });
}

function rebuildState(state: GroupDesignState, allPartIds: string[] = getAllKnownPartIds(state)): GroupDesignState {
    return createGroupDesignState({
        groups: Object.values(state.groupsById).map(cloneGroupNode),
        allPartIds,
        selectedNodeIds: state.selectedNodeIds,
        activeMode: state.activeMode
    });
}

function getExistingGroupNameSet(state: GroupDesignState, ignoreGroupId?: string): Set<string> {
    return new Set(
        listGroupNodes(state)
            .filter((group) => group.id !== ignoreGroupId)
            .map((group) => group.name)
    );
}

export function sanitizeGroupName(name: string, fallback = 'Group'): string {
    const normalized = name.trim().replace(/[^A-Za-z0-9_]/g, '_');
    if (normalized.length === 0) {
        return fallback;
    }
    return /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
}

export function getUniqueGroupName(state: GroupDesignState, desiredName: string, ignoreGroupId?: string): string {
    const trimmed = sanitizeGroupName(desiredName);
    const existingNames = getExistingGroupNameSet(state, ignoreGroupId);
    if (!existingNames.has(trimmed)) {
        return trimmed;
    }

    let index = 1;
    while (existingNames.has(`${trimmed}_${index}`)) {
        index += 1;
    }
    return `${trimmed}_${index}`;
}

function getOrderedSiblingIds(state: GroupDesignState, parentGroupId: string | null): string[] {
    const siblings = Object.values(state.groupsById)
        .filter((group) => group.parentGroupId === parentGroupId && !group.deletedAt)
        .sort(compareGroups);
    return siblings.map((group) => group.id);
}

function normalizeSiblingOrders(state: GroupDesignState, parentGroupId: string | null): void {
    getOrderedSiblingIds(state, parentGroupId).forEach((groupId, index) => {
        const group = state.groupsById[groupId];
        if (group) {
            group.order = index + 1;
        }
    });
}

function removePartIdsFromOwners(state: GroupDesignState, partIds: string[]): void {
    const partIdSet = new Set(partIds);
    Object.values(state.groupsById).forEach((group) => {
        if (group.memberPartIds.length === 0) {
            return;
        }
        group.memberPartIds = group.memberPartIds.filter((partId) => !partIdSet.has(partId));
    });
}

function movePartIdsToGroupMutable(state: GroupDesignState, partIds: string[], targetGroupId: string | null): number {
    const uniquePartIds = Array.from(new Set(partIds));
    if (uniquePartIds.length === 0) {
        return 0;
    }

    removePartIdsFromOwners(state, uniquePartIds);

    if (targetGroupId) {
        const targetGroup = state.groupsById[targetGroupId];
        if (!targetGroup) {
            throw new Error(`Target group "${targetGroupId}" does not exist.`);
        }
        const mergedPartIds = new Set(targetGroup.memberPartIds);
        uniquePartIds.forEach((partId) => mergedPartIds.add(partId));
        targetGroup.memberPartIds = Array.from(mergedPartIds);
    }

    return uniquePartIds.length;
}

function moveGroupToParentMutable(state: GroupDesignState, groupId: string, targetParentGroupId: string | null): string | null {
    const group = state.groupsById[groupId];
    if (!group) {
        return null;
    }

    const previousParentGroupId = group.parentGroupId;
    group.parentGroupId = targetParentGroupId && state.groupsById[targetParentGroupId] ? targetParentGroupId : null;
    group.order = getOrderedSiblingIds(state, group.parentGroupId).filter((siblingId) => siblingId !== groupId).length + 1;
    return previousParentGroupId;
}

export function createEmptyGroupDesignState(ungroupedPartIds: string[] = []): GroupDesignState {
    return {
        groupsById: {},
        rootGroupIds: [],
        ungroupedPartIds: [...ungroupedPartIds],
        selectedNodeIds: [],
        activeMode: 'idle'
    };
}

export function createGroupDesignState(input: CreateGroupDesignStateInput = {}): GroupDesignState {
    const groupsById: Record<string, GroupNode> = {};
    const groups = input.groups ?? [];
    groups.forEach((group, index) => {
        groupsById[group.id] = {
            ...cloneGroupNode(group),
            childGroupIds: [],
            memberPartIds: Array.from(new Set(group.memberPartIds)),
            order: Number.isFinite(group.order) ? group.order : index + 1
        };
    });

    const rootGroupIds: string[] = [];
    Object.values(groupsById)
        .sort(compareGroups)
        .forEach((group) => {
            if (group.parentGroupId && groupsById[group.parentGroupId]) {
                groupsById[group.parentGroupId].childGroupIds.push(group.id);
                return;
            }
            group.parentGroupId = null;
            rootGroupIds.push(group.id);
        });

    Object.values(groupsById).forEach((group) => {
        group.childGroupIds.sort((leftId, rightId) => compareGroups(groupsById[leftId], groupsById[rightId]));
    });

    const groupedPartIds = new Set<string>();
    Object.values(groupsById).forEach((group) => {
        group.memberPartIds.forEach((partId) => groupedPartIds.add(partId));
    });

    const allPartIds = Array.from(new Set(input.allPartIds ?? []));

    return {
        groupsById,
        rootGroupIds: rootGroupIds.sort((leftId, rightId) => compareGroups(groupsById[leftId], groupsById[rightId])),
        ungroupedPartIds: allPartIds.filter((partId) => !groupedPartIds.has(partId)),
        selectedNodeIds: [...(input.selectedNodeIds ?? [])],
        activeMode: input.activeMode ?? 'idle'
    };
}

export function listGroupNodes(state: GroupDesignState): GroupNode[] {
    return Object.values(state.groupsById)
        .filter((group) => !group.deletedAt)
        .sort(compareGroups);
}

export function getGroupNode(state: GroupDesignState, groupId: string | null | undefined): GroupNode | undefined {
    if (!groupId) {
        return undefined;
    }
    return state.groupsById[groupId];
}

export function getOrderedChildGroupIds(state: GroupDesignState, parentGroupId: string | null): string[] {
    if (parentGroupId === null) {
        return [...state.rootGroupIds];
    }
    return [...(state.groupsById[parentGroupId]?.childGroupIds ?? [])];
}

export function getPartOwnerGroupMap(state: GroupDesignState): Record<string, string> {
    const result: Record<string, string> = {};
    listGroupNodes(state).forEach((group) => {
        group.memberPartIds.forEach((partId) => {
            result[partId] = group.id;
        });
    });
    return result;
}

export function resolvePartOwnerGroupId(state: GroupDesignState, partId: string | null | undefined): string | null {
    if (!partId) {
        return null;
    }
    return getPartOwnerGroupMap(state)[partId] ?? null;
}

export function collectDescendantGroupIds(state: GroupDesignState, groupId: string, collected: Set<string> = new Set<string>()): Set<string> {
    const group = getGroupNode(state, groupId);
    if (!group) {
        return collected;
    }

    group.childGroupIds.forEach((childGroupId) => {
        if (collected.has(childGroupId)) {
            return;
        }
        collected.add(childGroupId);
        collectDescendantGroupIds(state, childGroupId, collected);
    });

    return collected;
}

export function getTopLevelGroupIds(state: GroupDesignState, groupIds: string[]): string[] {
    const selectedIds = new Set(groupIds);
    return Array.from(new Set(groupIds)).filter((groupId) => {
        let parentGroupId = getGroupNode(state, groupId)?.parentGroupId ?? null;
        while (parentGroupId) {
            if (selectedIds.has(parentGroupId)) {
                return false;
            }
            parentGroupId = getGroupNode(state, parentGroupId)?.parentGroupId ?? null;
        }
        return true;
    });
}

export function createGroupNode(state: GroupDesignState, input: CreateGroupNodeInput): { state: GroupDesignState; group: GroupNode } {
    const uniquePartIds = Array.from(new Set(input.memberPartIds));
    const allPartIds = Array.from(new Set([...getAllKnownPartIds(state), ...uniquePartIds]));
    const nextState = cloneState(state, allPartIds);
    const parentGroupId = input.parentGroupId && nextState.groupsById[input.parentGroupId] ? input.parentGroupId : null;

    removePartIdsFromOwners(nextState, uniquePartIds);

    const group: GroupNode = {
        id: input.id,
        name: getUniqueGroupName(nextState, input.name),
        parentGroupId,
        childGroupIds: [],
        memberPartIds: uniquePartIds,
        kind: input.kind ?? 'manual',
        order: input.order ?? (getOrderedSiblingIds(nextState, parentGroupId).length + 1),
        createdAt: input.createdAt ?? new Date().toISOString()
    };

    nextState.groupsById[group.id] = group;
    const rebuilt = rebuildState(nextState, allPartIds);
    return {
        state: rebuilt,
        group: rebuilt.groupsById[group.id]
    };
}

export function renameGroupNode(state: GroupDesignState, groupId: string, desiredName: string): GroupDesignState {
    const group = getGroupNode(state, groupId);
    if (!group) {
        throw new Error(`Group "${groupId}" does not exist.`);
    }

    const nextState = cloneState(state);
    nextState.groupsById[groupId].name = getUniqueGroupName(nextState, desiredName, groupId);
    return rebuildState(nextState);
}

export function moveGroupNodes(state: GroupDesignState, input: MoveGroupNodesInput): MoveGroupNodesResult {
    const nextState = cloneState(state);
    const selectedGroupIds = getTopLevelGroupIds(nextState, input.groupIds ?? []);
    const targetGroupId = input.targetGroupId ?? null;

    if (targetGroupId && !nextState.groupsById[targetGroupId]) {
        throw new Error(`Target group "${targetGroupId}" does not exist.`);
    }

    const coveredGroupIds = new Set<string>();
    selectedGroupIds.forEach((groupId) => {
        coveredGroupIds.add(groupId);
        collectDescendantGroupIds(nextState, groupId).forEach((descendantGroupId) => coveredGroupIds.add(descendantGroupId));
    });

    const ownerMap = getPartOwnerGroupMap(nextState);
    const selectedPartIds = Array.from(new Set(input.partIds ?? [])).filter((partId) => {
        const ownerGroupId = ownerMap[partId];
        return !ownerGroupId || !coveredGroupIds.has(ownerGroupId);
    });

    const invalidGroupId = selectedGroupIds.find((groupId) => {
        if (!targetGroupId) {
            return false;
        }
        if (groupId === targetGroupId) {
            return true;
        }
        return collectDescendantGroupIds(nextState, groupId).has(targetGroupId);
    });

    if (invalidGroupId) {
        throw new Error(`Invalid move target for group "${getGroupNode(nextState, invalidGroupId)?.name ?? invalidGroupId}".`);
    }

    const touchedParentIds = new Set<string | null>();
    movePartIdsToGroupMutable(nextState, selectedPartIds, targetGroupId);

    selectedGroupIds.forEach((groupId) => {
        const previousParentGroupId = moveGroupToParentMutable(nextState, groupId, targetGroupId);
        touchedParentIds.add(previousParentGroupId);
        touchedParentIds.add(targetGroupId);
    });

    touchedParentIds.forEach((parentGroupId) => normalizeSiblingOrders(nextState, parentGroupId));

    return {
        state: rebuildState(nextState),
        movedGroups: selectedGroupIds.length,
        movedParts: selectedPartIds.length
    };
}

export function ungroupGroup(
    state: GroupDesignState,
    groupId: string,
    isReferenced: (groupId: string) => boolean = () => false
): UngroupGroupResult {
    const allPartIds = getAllKnownPartIds(state);
    const nextState = cloneState(state, allPartIds);
    const group = getGroupNode(nextState, groupId);

    if (!group) {
        throw new Error('Select a group first.');
    }
    if (isReferenced(groupId)) {
        throw new Error(`Group "${group.name}" is referenced by design entities.`);
    }

    const parentGroupId = group.parentGroupId ?? null;
    const childGroupIds = [...group.childGroupIds];
    const memberPartIds = [...group.memberPartIds];

    movePartIdsToGroupMutable(nextState, memberPartIds, parentGroupId);
    childGroupIds.forEach((childGroupId) => {
        moveGroupToParentMutable(nextState, childGroupId, parentGroupId);
    });

    delete nextState.groupsById[groupId];
    normalizeSiblingOrders(nextState, parentGroupId);

    return {
        state: rebuildState(nextState, allPartIds),
        movedGroups: childGroupIds.length,
        movedParts: memberPartIds.length,
        parentGroupId
    };
}

export function cleanEmptyGroups(
    state: GroupDesignState,
    isReferenced: (groupId: string) => boolean = () => false
): CleanEmptyGroupsResult {
    const nextState = cloneState(state);
    const removedGroupIds: string[] = [];
    const blockedGroupIds = new Set<string>();

    while (true) {
        const removable = listGroupNodes(nextState).filter((group) => group.childGroupIds.length === 0 && group.memberPartIds.length === 0);
        const nextRemovable = removable.filter((group) => {
            if (isReferenced(group.id)) {
                blockedGroupIds.add(group.id);
                return false;
            }
            return true;
        });

        if (nextRemovable.length === 0) {
            break;
        }

        nextRemovable.forEach((group) => {
            delete nextState.groupsById[group.id];
            removedGroupIds.push(group.id);
        });
        Object.values(nextState.groupsById).forEach((group) => {
            group.childGroupIds = group.childGroupIds.filter((childGroupId) => nextState.groupsById[childGroupId]);
        });
        nextState.rootGroupIds = nextState.rootGroupIds.filter((groupId) => nextState.groupsById[groupId]);
        Object.values(nextState.groupsById).forEach((group) => normalizeSiblingOrders(nextState, group.parentGroupId));
        normalizeSiblingOrders(nextState, null);
        Object.assign(nextState, rebuildState(nextState));
    }

    return {
        state: rebuildState(nextState),
        removedGroupIds,
        blockedGroupIds: Array.from(blockedGroupIds)
    };
}

export function deleteGroups(
    state: GroupDesignState,
    groupIds: string[],
    isReferenced: (groupId: string) => boolean = () => false
): DeleteGroupsResult {
    const nextState = cloneState(state);
    const deletedGroupIds: string[] = [];
    const blockedMessages: string[] = [];
    const touchedParentIds = new Set<string | null>();

    getTopLevelGroupIds(nextState, groupIds).forEach((groupId) => {
        const group = getGroupNode(nextState, groupId);
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
        if (isReferenced(group.id)) {
            blockedMessages.push(`Group "${group.name}" is referenced by design entities.`);
            return;
        }
        touchedParentIds.add(group.parentGroupId);
        delete nextState.groupsById[group.id];
        deletedGroupIds.push(group.id);
    });

    touchedParentIds.forEach((parentGroupId) => normalizeSiblingOrders(nextState, parentGroupId));

    return {
        state: rebuildState(nextState),
        deletedGroupIds,
        blockedMessages
    };
}

export function exportGroupSchema(
    state: GroupDesignState,
    resolvePartRef: (partId: string) => string = (partId) => partId
): GroupSchemaRecord[] {
    return listGroupNodes(state).map((group) => ({
        name: group.name,
        parts: group.memberPartIds.map(resolvePartRef),
        parentRef: group.parentGroupId ? (getGroupNode(state, group.parentGroupId)?.name ?? group.parentGroupId) : null,
        kind: group.kind,
        order: group.order
    }));
}

export function importGroupSchema(input: ImportGroupSchemaInput): GroupDesignState {
    const resolvePartRef = input.resolvePartRef ?? ((partRef: string) => partRef);
    const createGroupId = input.createGroupId ?? ((index: number) => `group_${index + 1}`);
    const now = input.now ?? (() => new Date().toISOString());
    const groups: GroupNode[] = [];
    const rawNameToId = new Map<string, string>();
    const usedNames = new Set<string>();

    input.records.forEach((record, index) => {
        const rawName = sanitizeGroupName(record.name);
        if (!rawName) {
            return;
        }

        let uniqueName = rawName;
        let duplicateIndex = 1;
        while (usedNames.has(uniqueName)) {
            uniqueName = `${rawName}_${duplicateIndex}`;
            duplicateIndex += 1;
        }
        usedNames.add(uniqueName);

        const parts = Array.isArray(record.parts)
            ? Array.from(new Set(record.parts.map(resolvePartRef)))
            : [];

        const group: GroupNode = {
            id: createGroupId(index, record),
            name: uniqueName,
            parentGroupId: record.parentRef?.trim() ? record.parentRef.trim() : null,
            childGroupIds: [],
            memberPartIds: parts,
            kind: record.kind ?? 'imported',
            order: typeof record.order === 'number' && Number.isFinite(record.order) ? record.order : index + 1,
            createdAt: now()
        };

        groups.push(group);
        rawNameToId.set(rawName, group.id);
    });

    groups.forEach((group) => {
        if (!group.parentGroupId) {
            return;
        }
        group.parentGroupId = rawNameToId.get(group.parentGroupId) ?? null;
    });

    const allPartIds = Array.from(
        new Set([
            ...(input.allPartIds ?? []),
            ...groups.flatMap((group) => group.memberPartIds)
        ])
    );

    return createGroupDesignState({
        groups,
        allPartIds
    });
}
