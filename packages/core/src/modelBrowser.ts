export type BrowserShapeType = 'assembly' | 'part' | 'solid';

export interface BrowserShapeInput {
    id: string;
    name: string;
    type: BrowserShapeType;
    children?: BrowserShapeInput[];
}

export interface BrowserGroupInput {
    id: string;
    name: string;
    type: 'group';
    children?: BrowserObjectInput[];
}

export type BrowserObjectInput = BrowserShapeInput | BrowserGroupInput;

export interface BrowserNamedEntityInput {
    id: string;
    name: string;
}

export type ModelBrowserNodeKind =
    | 'category'
    | 'ground'
    | 'group'
    | 'assembly'
    | 'part'
    | 'solid'
    | 'connection'
    | 'motion'
    | 'force'
    | 'material';

export interface ModelBrowserNode {
    id: string;
    label: string;
    kind: ModelBrowserNodeKind;
    shapeId?: string;
    groupId?: string;
    children?: ModelBrowserNode[];
}

export interface BuildModelBrowserTreeInput {
    shapes?: BrowserShapeInput[];
    objects?: BrowserObjectInput[];
    includeGround?: boolean;
    connections?: BrowserNamedEntityInput[];
    motions?: BrowserNamedEntityInput[];
    forces?: BrowserNamedEntityInput[];
    materials?: BrowserNamedEntityInput[];
}

export function flattenTopLevelAssemblyShapes<T extends { type: string; children?: T[] }>(shapes: T[]): T[] {
    return shapes.flatMap((shape) => (
        shape.type === 'assembly' && shape.children && shape.children.length > 0
            ? shape.children
            : [shape]
    ));
}

export function collectLeafShapeIds<T extends { id: string; children?: T[] }>(shapeOrShapes: T | T[]): string[] {
    const shapes = Array.isArray(shapeOrShapes) ? shapeOrShapes : [shapeOrShapes];
    const leafIds: string[] = [];
    const visit = (shape: T): void => {
        if (shape.children && shape.children.length > 0) {
            shape.children.forEach(visit);
            return;
        }
        leafIds.push(shape.id);
    };

    shapes.forEach(visit);
    return leafIds;
}

const CATEGORY_LABELS = {
    objects: '\u7269\u4f53',
    connections: '\u8fde\u63a5',
    motions: '\u9a71\u52a8',
    forces: '\u529b',
    materials: '\u6750\u6599'
} as const;

function normalizeLabel(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        return 'Unnamed';
    }
    return trimmed.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function mapShapeNode(shape: BrowserShapeInput): ModelBrowserNode {
    return {
        id: `shape_${shape.id}`,
        kind: shape.type,
        label: normalizeLabel(shape.name),
        shapeId: shape.id,
        children: shape.children?.map(mapShapeNode)
    };
}

function mapObjectNode(node: BrowserObjectInput): ModelBrowserNode {
    if (node.type === 'group') {
        return {
            id: `group_${node.id}`,
            kind: 'group',
            label: normalizeLabel(node.name),
            groupId: node.id,
            children: node.children?.map(mapObjectNode)
        };
    }

    return mapShapeNode(node);
}

function mapNamedEntities(
    items: BrowserNamedEntityInput[] | undefined,
    kind: Extract<ModelBrowserNodeKind, 'connection' | 'motion' | 'force' | 'material'>,
    prefix: string
): ModelBrowserNode[] {
    if (!items || items.length === 0) {
        return [];
    }
    return items.map((item) => ({
        id: `${prefix}_${item.id}`,
        kind,
        label: normalizeLabel(item.name)
    }));
}

export function buildModelBrowserTree(input: BuildModelBrowserTreeInput): ModelBrowserNode[] {
    const includeGround = input.includeGround ?? true;
    const objectInputs = input.objects ?? input.shapes ?? [];

    const objectChildren: ModelBrowserNode[] = [];
    if (includeGround) {
        objectChildren.push({
            id: 'ground',
            kind: 'ground',
            label: 'Ground'
        });
    }
    objectChildren.push(...objectInputs.map(mapObjectNode));

    return [
        {
            id: 'category_objects',
            kind: 'category',
            label: CATEGORY_LABELS.objects,
            children: objectChildren
        },
        {
            id: 'category_connections',
            kind: 'category',
            label: CATEGORY_LABELS.connections,
            children: mapNamedEntities(input.connections, 'connection', 'conn')
        },
        {
            id: 'category_motions',
            kind: 'category',
            label: CATEGORY_LABELS.motions,
            children: mapNamedEntities(input.motions, 'motion', 'motion')
        },
        {
            id: 'category_forces',
            kind: 'category',
            label: CATEGORY_LABELS.forces,
            children: mapNamedEntities(input.forces, 'force', 'force')
        },
        {
            id: 'category_materials',
            kind: 'category',
            label: CATEGORY_LABELS.materials,
            children: mapNamedEntities(input.materials, 'material', 'mat')
        }
    ];
}
