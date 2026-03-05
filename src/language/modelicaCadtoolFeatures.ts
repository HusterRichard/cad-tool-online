import * as vscode from 'vscode';
import { CADTOOL_CONFIG_BASENAMES } from './cadtoolKnowledge';

type IndexBucket =
    | 'group'
    | 'marker'
    | 'connector'
    | 'motion'
    | 'contact'
    | 'fluidPort'
    | 'ribSlice'
    | 'gravity'
    | 'medium'
    | 'part';

type CadtoolObjectType = Exclude<IndexBucket, 'part'> | 'designPoint';

type WorkspaceIndex = Record<IndexBucket, Set<string>>;

const CADTOOL_TO_MODELICA_SELECTOR: vscode.DocumentSelector = [
    { language: 'modelica' },
    { pattern: '**/*.mo' }
];

const REFERENCE_BUCKETS_BY_FIELD: Readonly<Record<string, readonly IndexBucket[]>> = {
    groupRef: ['group'],
    markerRef: ['marker'],
    marker1: ['marker'],
    marker2: ['marker'],
    connectorRef: ['connector'],
    ribSliceRef: ['ribSlice'],
    part1: ['group', 'part'],
    part2: ['group', 'part'],
    partA: ['group', 'part'],
    partB: ['group', 'part'],
    partRef: ['group', 'part'],
    tankRef: ['group', 'part']
};

const SUPPORTED_BUCKETS_BY_OBJECT_TYPE: Readonly<Record<CadtoolObjectType, IndexBucket | undefined>> = {
    group: 'group',
    marker: 'marker',
    designPoint: undefined,
    connector: 'connector',
    motion: 'motion',
    contact: 'contact',
    fluidPort: 'fluidPort',
    ribSlice: 'ribSlice',
    gravity: 'gravity',
    medium: 'medium'
};

const MANUAL_REFRESH_COMMAND = 'cadtool-online.refreshCadtoolIndex';

let workspaceIndex: WorkspaceIndex = createEmptyWorkspaceIndex();
let refreshPromise: Promise<void> | undefined;

export function registerModelicaCadtoolFeatures(context: vscode.ExtensionContext): void {
    refreshWorkspaceIndexDebounced();

    const completionProvider = vscode.languages.registerCompletionItemProvider(
        CADTOOL_TO_MODELICA_SELECTOR,
        {
            provideCompletionItems(document, position) {
                return provideModelicaCadtoolCompletionItems(document, position);
            }
        },
        '"',
        '=',
        '.',
        '_'
    );

    const configWatcher1 = vscode.workspace.createFileSystemWatcher('**/cadtool.config.json');
    const configWatcher2 = vscode.workspace.createFileSystemWatcher('**/.cadtoolrc.json');
    const onWatcherChanged = (): void => refreshWorkspaceIndexDebounced();
    configWatcher1.onDidChange(onWatcherChanged);
    configWatcher1.onDidCreate(onWatcherChanged);
    configWatcher1.onDidDelete(onWatcherChanged);
    configWatcher2.onDidChange(onWatcherChanged);
    configWatcher2.onDidCreate(onWatcherChanged);
    configWatcher2.onDidDelete(onWatcherChanged);

    const onSaveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
        if (isCadtoolConfigDocument(document)) {
            refreshWorkspaceIndexDebounced();
        }
    });

    const manualRefreshCommand = vscode.commands.registerCommand(MANUAL_REFRESH_COMMAND, async () => {
        await refreshWorkspaceIndex();
        vscode.window.showInformationMessage('CADTool index refreshed');
    });

    context.subscriptions.push(
        completionProvider,
        configWatcher1,
        configWatcher2,
        onSaveDisposable,
        manualRefreshCommand
    );
}

function provideModelicaCadtoolCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
): vscode.CompletionItem[] | undefined {
    if (!isModelicaDocument(document)) {
        return undefined;
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    const field = detectActiveReferenceField(linePrefix);
    const range = document.getWordRangeAtPosition(position, /[A-Za-z0-9_]+/);

    const values = field
        ? collectFieldReferenceValues(field)
        : shouldOfferGeneralCompletion(linePrefix)
          ? collectGeneralReferenceValues()
          : [];

    if (values.length === 0) {
        return undefined;
    }

    return values.map((value) => {
        const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Reference);
        item.detail = field ? `CADTool reference for ${field}` : 'CADTool symbol';
        item.sortText = `0_${value}`;
        item.insertText = value;
        if (range) {
            item.range = range;
        }
        return item;
    });
}

function isModelicaDocument(document: vscode.TextDocument): boolean {
    return document.fileName.toLowerCase().endsWith('.mo');
}

function shouldOfferGeneralCompletion(linePrefix: string): boolean {
    return /(cadtool|annotation|connectorRef|markerRef|groupRef|partRef|part1|part2)/i.test(linePrefix);
}

function detectActiveReferenceField(linePrefix: string): string | undefined {
    const match = linePrefix.match(
        /(groupRef|markerRef|marker1|marker2|connectorRef|ribSliceRef|part1|part2|partA|partB|partRef|tankRef)\s*=\s*"?[A-Za-z0-9_]*$/i
    );
    if (!match) {
        return undefined;
    }

    return match[1];
}

function collectFieldReferenceValues(field: string): string[] {
    const buckets = REFERENCE_BUCKETS_BY_FIELD[field];
    if (!buckets) {
        return [];
    }

    const values = new Set<string>();
    for (const bucket of buckets) {
        for (const name of workspaceIndex[bucket]) {
            values.add(name);
        }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function collectGeneralReferenceValues(): string[] {
    const values = new Set<string>();
    const buckets: readonly IndexBucket[] = [
        'group',
        'marker',
        'connector',
        'motion',
        'contact',
        'fluidPort',
        'ribSlice',
        'gravity',
        'medium',
        'part'
    ];

    for (const bucket of buckets) {
        for (const name of workspaceIndex[bucket]) {
            values.add(name);
        }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function refreshWorkspaceIndexDebounced(): void {
    if (refreshPromise) {
        return;
    }

    refreshPromise = refreshWorkspaceIndex().finally(() => {
        refreshPromise = undefined;
    });
}

async function refreshWorkspaceIndex(): Promise<void> {
    const [configFiles, rcFiles] = await Promise.all([
        vscode.workspace.findFiles('**/cadtool.config.json', '**/node_modules/**'),
        vscode.workspace.findFiles('**/.cadtoolrc.json', '**/node_modules/**')
    ]);

    const files = [...configFiles, ...rcFiles];
    const nextIndex = createEmptyWorkspaceIndex();

    for (const file of files) {
        try {
            const content = await vscode.workspace.fs.readFile(file);
            const text = new TextDecoder('utf-8').decode(content);
            collectSymbolsFromConfigText(text, nextIndex);
        } catch {
            // Ignore malformed files to keep completions responsive.
        }
    }

    workspaceIndex = nextIndex;
}

function collectSymbolsFromConfigText(text: string, index: WorkspaceIndex): void {
    let root: unknown;
    try {
        root = JSON.parse(text);
    } catch {
        return;
    }

    if (!root || typeof root !== 'object' || Array.isArray(root)) {
        return;
    }

    for (const [rootField, value] of Object.entries(root)) {
        if (!Array.isArray(value)) {
            continue;
        }

        for (const item of value) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                continue;
            }

            const itemObject = item as Record<string, unknown>;
            const objectType = resolveObjectType(rootField, itemObject);
            if (!objectType) {
                continue;
            }

            const bucket = SUPPORTED_BUCKETS_BY_OBJECT_TYPE[objectType];
            const name = typeof itemObject.name === 'string' ? itemObject.name : undefined;
            if (bucket && name) {
                index[bucket].add(name);
            }

            if (objectType === 'group') {
                collectPartNames(itemObject, index.part);
            }
        }
    }
}

function resolveObjectType(
    rootField: string,
    objectNode: Record<string, unknown>
): CadtoolObjectType | undefined {
    if (
        rootField === 'group' ||
        rootField === 'marker' ||
        rootField === 'designPoint' ||
        rootField === 'connector' ||
        rootField === 'motion' ||
        rootField === 'contact' ||
        rootField === 'fluidPort' ||
        rootField === 'ribSlice' ||
        rootField === 'gravity' ||
        rootField === 'medium'
    ) {
        return rootField;
    }

    if (rootField !== 'objects') {
        return undefined;
    }

    const typeValue = objectNode.type;
    if (
        typeValue === 'group' ||
        typeValue === 'marker' ||
        typeValue === 'designPoint' ||
        typeValue === 'connector' ||
        typeValue === 'motion' ||
        typeValue === 'contact' ||
        typeValue === 'fluidPort' ||
        typeValue === 'ribSlice' ||
        typeValue === 'gravity' ||
        typeValue === 'medium'
    ) {
        return typeValue;
    }

    return undefined;
}

function collectPartNames(groupNode: Record<string, unknown>, target: Set<string>): void {
    const parts = groupNode.parts;
    if (!Array.isArray(parts)) {
        return;
    }

    for (const part of parts) {
        if (typeof part === 'string' && part.length > 0) {
            target.add(part);
        }
    }
}

function createEmptyWorkspaceIndex(): WorkspaceIndex {
    return {
        group: new Set<string>(),
        marker: new Set<string>(),
        connector: new Set<string>(),
        motion: new Set<string>(),
        contact: new Set<string>(),
        fluidPort: new Set<string>(),
        ribSlice: new Set<string>(),
        gravity: new Set<string>(),
        medium: new Set<string>(),
        part: new Set<string>()
    };
}

function isCadtoolConfigDocument(document: vscode.TextDocument): boolean {
    const fileName = document.fileName.replace(/\\/g, '/').split('/').at(-1)?.toLowerCase() ?? '';
    return CADTOOL_CONFIG_BASENAMES.includes(fileName as (typeof CADTOOL_CONFIG_BASENAMES)[number]);
}

