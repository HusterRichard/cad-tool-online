export interface MarkerDesignGroupNode {
    id: string;
    parentGroupId: string | null;
}

export type MarkerOwnerKind = 'group' | 'part';

export interface MarkerOwnerRef {
    id: string;
    kind: MarkerOwnerKind;
}

export interface ReferenceMarkerValidationResult {
    valid: boolean;
    reason?: string;
}

function hasOwn<T extends object>(record: T, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key);
}

export function resolveMarkerOwnerRef(
    targetPartId: string,
    owningGroupId: string | null | undefined
): MarkerOwnerRef {
    if (owningGroupId && owningGroupId.trim().length > 0) {
        return {
            id: owningGroupId,
            kind: 'group'
        };
    }

    return {
        id: targetPartId,
        kind: 'part'
    };
}

export function resolveTopLevelMarkerOwnerId(
    ownerId: string,
    groupsById: Record<string, MarkerDesignGroupNode>
): string {
    if (!ownerId || !hasOwn(groupsById, ownerId)) {
        return ownerId;
    }

    const visited = new Set<string>();
    let currentId = ownerId;

    while (hasOwn(groupsById, currentId)) {
        if (visited.has(currentId)) {
            return currentId;
        }
        visited.add(currentId);

        const parentId = groupsById[currentId]?.parentGroupId ?? null;
        if (!parentId || !hasOwn(groupsById, parentId)) {
            return currentId;
        }
        currentId = parentId;
    }

    return currentId;
}

export function validateReferenceMarkerCreation(
    baseOwnerId: string,
    targetOwnerId: string,
    groupsById: Record<string, MarkerDesignGroupNode>
): ReferenceMarkerValidationResult {
    if (!baseOwnerId) {
        return {
            valid: false,
            reason: '请选择基本标架。'
        };
    }

    if (!targetOwnerId) {
        return {
            valid: false,
            reason: '请选择目标零件所属组。'
        };
    }

    if (baseOwnerId === targetOwnerId) {
        return {
            valid: false,
            reason: '参考标架无法添加到基本标架所在同一顶层组中。'
        };
    }

    const baseTopLevelId = resolveTopLevelMarkerOwnerId(baseOwnerId, groupsById);
    const targetTopLevelId = resolveTopLevelMarkerOwnerId(targetOwnerId, groupsById);
    if (baseTopLevelId === targetTopLevelId) {
        return {
            valid: false,
            reason: '参考标架无法添加到基本标架所在同一顶层组中。'
        };
    }

    return { valid: true };
}
