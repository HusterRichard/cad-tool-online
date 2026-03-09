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
