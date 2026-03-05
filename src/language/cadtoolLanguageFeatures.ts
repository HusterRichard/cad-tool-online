import * as vscode from 'vscode';
import {
    CADTOOL_CONFIG_BASENAMES,
    CADTOOL_ENUM_VALUES_BY_FIELD,
    CADTOOL_ERROR_CODES,
    CADTOOL_FIELD_HOVER_DOCS,
    CADTOOL_NAME_RULE,
    CADTOOL_OBJECT_TYPES,
    CADTOOL_PARAMETER_FIELDS,
    CADTOOL_ROOT_OBJECT_ARRAY_FIELDS,
    DIRECTION_MAX,
    DIRECTION_MIN,
    ICON_SIZE_MAX,
    ICON_SIZE_MIN,
    POSITION_MAX,
    POSITION_MIN,
    type CadtoolBilingualDoc,
    type CadtoolKnowledgeEntry
} from './cadtoolKnowledge';

type JsonNode =
    | JsonObjectNode
    | JsonArrayNode
    | JsonStringNode
    | JsonNumberNode
    | JsonBooleanNode
    | JsonNullNode;

interface JsonNodeBase {
    kind: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
    start: number;
    end: number;
}

interface JsonObjectNode extends JsonNodeBase {
    kind: 'object';
    properties: JsonProperty[];
}

interface JsonArrayNode extends JsonNodeBase {
    kind: 'array';
    elements: JsonNode[];
}

interface JsonStringNode extends JsonNodeBase {
    kind: 'string';
    value: string;
}

interface JsonNumberNode extends JsonNodeBase {
    kind: 'number';
    value: number;
}

interface JsonBooleanNode extends JsonNodeBase {
    kind: 'boolean';
    value: boolean;
}

interface JsonNullNode extends JsonNodeBase {
    kind: 'null';
    value: null;
}

interface JsonProperty {
    key: string;
    keyNode: JsonStringNode;
    value: JsonNode;
    start: number;
    end: number;
}

interface PropertyContext {
    property: JsonProperty;
    insideKey: boolean;
    insideValue: boolean;
    valueNode: JsonNode;
}

const DIAGNOSTIC_SOURCE = 'cadtool';
const DIAGNOSTIC_CODE_INVALID_NAME = 'cadtool.invalidName';
const DIAGNOSTIC_CODE_DUPLICATE_NAME = 'cadtool.duplicateName';
const DIAGNOSTIC_CODE_ICON_SIZE_RANGE = 'cadtool.iconSize.range';
const DIAGNOSTIC_CODE_POSITION_RANGE = 'cadtool.position.range';
const DIAGNOSTIC_CODE_DIRECTION_RANGE = 'cadtool.direction.range';
const DIAGNOSTIC_CODE_UNRESOLVED_REFERENCE = 'cadtool.unresolvedReference';
const DIAGNOSTIC_CODE_MISSING_REQUIRED_FIELD = 'cadtool.missingRequiredField';

type CadtoolObjectType =
    | 'group'
    | 'marker'
    | 'designPoint'
    | 'connector'
    | 'motion'
    | 'contact'
    | 'fluidPort'
    | 'ribSlice'
    | 'gravity'
    | 'medium';

interface CadtoolObjectContext {
    rootField: string;
    objectType: CadtoolObjectType | undefined;
    node: JsonObjectNode;
}

type ReferenceCollectionKey = 'group' | 'marker' | 'connector' | 'ribSlice' | 'part';

type CadtoolReferenceIndex = Readonly<Record<ReferenceCollectionKey, ReadonlySet<string>>>;

const REQUIRED_FIELDS_BY_OBJECT_TYPE: Readonly<Record<CadtoolObjectType, readonly string[]>> = {
    group: ['name'],
    marker: ['name'],
    designPoint: ['name'],
    connector: ['name', 'connectorType', 'part1', 'part2'],
    motion: ['name', 'motionType', 'connectorRef'],
    contact: ['name', 'partA', 'partB'],
    fluidPort: ['name', 'portType'],
    ribSlice: ['name'],
    gravity: ['name', 'gravityType'],
    medium: ['name']
};

const REFERENCE_TARGETS_BY_FIELD: Readonly<Record<string, readonly ReferenceCollectionKey[]>> = {
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

const RANGE_FIX_RULES: Readonly<
    Record<
        string,
        {
            label: string;
            min: number;
            max: number;
        }
    >
> = {
    [DIAGNOSTIC_CODE_ICON_SIZE_RANGE]: { label: 'iconSize', min: ICON_SIZE_MIN, max: ICON_SIZE_MAX },
    [DIAGNOSTIC_CODE_POSITION_RANGE]: { label: 'position', min: POSITION_MIN, max: POSITION_MAX },
    [DIAGNOSTIC_CODE_DIRECTION_RANGE]: { label: 'direction', min: DIRECTION_MIN, max: DIRECTION_MAX }
};

const CADTOOL_DOCUMENT_SELECTOR: vscode.DocumentSelector = [
    { language: 'json', pattern: '**/cadtool.config.json' },
    { language: 'json', pattern: '**/.cadtoolrc.json' },
    { language: 'jsonc', pattern: '**/cadtool.config.json' },
    { language: 'jsonc', pattern: '**/.cadtoolrc.json' }
];

export function registerCadtoolLanguageFeatures(context: vscode.ExtensionContext): void {
    const diagnostics = vscode.languages.createDiagnosticCollection('cadtool-config');
    context.subscriptions.push(diagnostics);

    const refreshDiagnostics = (document: vscode.TextDocument): void => {
        if (!isCadtoolConfigDocument(document)) {
            diagnostics.delete(document.uri);
            return;
        }

        diagnostics.set(document.uri, createCadtoolDiagnostics(document));
    };

    for (const document of vscode.workspace.textDocuments) {
        refreshDiagnostics(document);
    }

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
        vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
        vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri))
    );

    const completionProvider = vscode.languages.registerCompletionItemProvider(
        CADTOOL_DOCUMENT_SELECTOR,
        {
            provideCompletionItems(document, position) {
                return provideCadtoolCompletionItems(document, position);
            }
        },
        '"',
        ':',
        '.',
        '/'
    );

    const hoverProvider = vscode.languages.registerHoverProvider(CADTOOL_DOCUMENT_SELECTOR, {
        provideHover(document, position) {
            return provideCadtoolHover(document, position);
        }
    });

    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        CADTOOL_DOCUMENT_SELECTOR,
        new CadtoolCodeActionProvider(),
        {
            providedCodeActionKinds: CadtoolCodeActionProvider.providedCodeActionKinds
        }
    );

    context.subscriptions.push(completionProvider, hoverProvider, codeActionProvider);
}

function isCadtoolConfigDocument(document: vscode.TextDocument): boolean {
    if (document.languageId !== 'json' && document.languageId !== 'jsonc') {
        return false;
    }

    const baseName = getBaseName(document.fileName);
    return CADTOOL_CONFIG_BASENAMES.some((name) => name === baseName);
}

function getBaseName(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    const baseName = segments.at(-1) ?? '';
    return baseName.toLowerCase();
}

function provideCadtoolCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
): vscode.CompletionItem[] | undefined {
    if (!isCadtoolConfigDocument(document)) {
        return undefined;
    }

    const text = document.getText();
    const offset = document.offsetAt(position);
    const root = parseJsonWithRanges(text);
    const propertyContext = root ? findPropertyContext(root, offset) : undefined;

    const isInsideQuotedKey = propertyContext?.insideKey ?? false;
    const isInsideStringValue =
        (propertyContext?.insideValue === true && propertyContext.valueNode.kind === 'string') ||
        isInsideUnterminatedString(text, offset);
    const keyRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9_.]+/);
    const valueRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9_\u4e00-\u9fff.-]+/);

    const items: vscode.CompletionItem[] = [];
    const seenLabels = new Set<string>();

    const pushUnique = (item: vscode.CompletionItem): void => {
        const label = typeof item.label === 'string' ? item.label : item.label.label;
        if (seenLabels.has(label)) {
            return;
        }
        seenLabels.add(label);
        items.push(item);
    };

    if (propertyContext?.insideKey || isLikelyKeyPosition(text, offset)) {
        for (const field of CADTOOL_PARAMETER_FIELDS) {
            pushUnique(createFieldCompletion(field, isInsideQuotedKey, keyRange));
        }
    }

    const activeValueKey = resolveActiveValueKey(text, offset, propertyContext);
    if (activeValueKey === 'type') {
        for (const objectType of CADTOOL_OBJECT_TYPES) {
            pushUnique(createStringValueCompletion(objectType, vscode.CompletionItemKind.Class, isInsideStringValue, valueRange));
        }
    }

    if (activeValueKey === 'errorCode') {
        for (const errorCode of CADTOOL_ERROR_CODES) {
            pushUnique(createStringValueCompletion(errorCode, vscode.CompletionItemKind.Constant, isInsideStringValue, valueRange));
        }
    }

    const enumEntries = activeValueKey ? CADTOOL_ENUM_VALUES_BY_FIELD[activeValueKey] : undefined;
    if (enumEntries) {
        for (const entry of enumEntries) {
            pushUnique(createStringValueCompletion(entry, vscode.CompletionItemKind.EnumMember, isInsideStringValue, valueRange));
        }
    }

    if (activeValueKey && root?.kind === 'object') {
        const references = collectReferenceCandidates(buildCadtoolReferenceIndex(root), activeValueKey);
        for (const reference of references) {
            pushUnique(
                createReferenceValueCompletion(
                    reference,
                    activeValueKey,
                    isInsideStringValue,
                    valueRange
                )
            );
        }
    }

    return items.length > 0 ? items : undefined;
}

function createFieldCompletion(
    entry: CadtoolKnowledgeEntry,
    isInsideQuotedKey: boolean,
    range: vscode.Range | undefined
): vscode.CompletionItem {
    const item = new vscode.CompletionItem(entry.value, vscode.CompletionItemKind.Field);
    item.detail = entry.detail;
    item.documentation = createKnowledgeMarkdown(entry.value, entry.detail, entry.doc);
    item.insertText = isInsideQuotedKey ? entry.value : `"${entry.value}": `;
    if (range) {
        item.range = range;
    }
    return item;
}

function createStringValueCompletion(
    entry: CadtoolKnowledgeEntry,
    kind: vscode.CompletionItemKind,
    isInsideStringValue: boolean,
    range: vscode.Range | undefined
): vscode.CompletionItem {
    const item = new vscode.CompletionItem(entry.value, kind);
    item.detail = entry.detail;
    item.documentation = createKnowledgeMarkdown(entry.value, entry.detail, entry.doc);
    item.insertText = isInsideStringValue ? entry.value : `"${entry.value}"`;
    if (range) {
        item.range = range;
    }
    return item;
}

function createReferenceValueCompletion(
    value: string,
    field: string,
    isInsideStringValue: boolean,
    range: vscode.Range | undefined
): vscode.CompletionItem {
    const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Reference);
    item.detail = `Reference value for ${field}`;
    item.insertText = isInsideStringValue ? value : `"${value}"`;
    if (range) {
        item.range = range;
    }
    return item;
}

function provideCadtoolHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    if (!isCadtoolConfigDocument(document)) {
        return undefined;
    }

    const tokenRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_.]*/);
    if (!tokenRange) {
        return undefined;
    }

    const token = document.getText(tokenRange);

    const fieldDoc = CADTOOL_FIELD_HOVER_DOCS[token];
    if (fieldDoc) {
        return new vscode.Hover(createFieldMarkdown(token, fieldDoc), tokenRange);
    }

    const objectType = CADTOOL_OBJECT_TYPES.find((entry) => entry.value === token);
    if (objectType) {
        return new vscode.Hover(createKnowledgeMarkdown(token, objectType.detail, objectType.doc), tokenRange);
    }

    const errorCode = CADTOOL_ERROR_CODES.find((entry) => entry.value === token);
    if (errorCode) {
        return new vscode.Hover(createKnowledgeMarkdown(token, errorCode.detail, errorCode.doc), tokenRange);
    }

    const enumEntry = findEnumEntryByValue(token);
    if (enumEntry) {
        return new vscode.Hover(createKnowledgeMarkdown(token, enumEntry.detail, enumEntry.doc), tokenRange);
    }

    return undefined;
}

function findEnumEntryByValue(value: string): CadtoolKnowledgeEntry | undefined {
    for (const entries of Object.values(CADTOOL_ENUM_VALUES_BY_FIELD)) {
        const match = entries.find((entry) => entry.value === value);
        if (match) {
            return match;
        }
    }
    return undefined;
}

function createFieldMarkdown(field: string, doc: CadtoolBilingualDoc): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString(undefined, true);
    markdown.appendMarkdown(`**${field}**\n\n`);
    markdown.appendMarkdown(`- 中文：${doc.zh}\n`);
    markdown.appendMarkdown(`- EN: ${doc.en}`);
    markdown.isTrusted = false;
    return markdown;
}

function createKnowledgeMarkdown(
    label: string,
    detail: string,
    doc: CadtoolBilingualDoc
): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString(undefined, true);
    markdown.appendMarkdown(`**${label}**\n\n`);
    markdown.appendMarkdown(`${detail}\n\n`);
    markdown.appendMarkdown(`- 中文：${doc.zh}\n`);
    markdown.appendMarkdown(`- EN: ${doc.en}`);
    markdown.isTrusted = false;
    return markdown;
}

function isLikelyKeyPosition(text: string, offset: number): boolean {
    const lookBehind = text.slice(Math.max(0, offset - 160), offset);
    return /[{,]\s*"[^"]*$/.test(lookBehind) || /[{,]\s*$/.test(lookBehind);
}

function resolveActiveValueKey(
    text: string,
    offset: number,
    context: PropertyContext | undefined
): string | undefined {
    if (context?.insideValue) {
        return context.property.key;
    }

    const lookBehind = text.slice(Math.max(0, offset - 320), offset);
    const match = lookBehind.match(/"([A-Za-z0-9_.]+)"\s*:\s*(?:"[^"]*|[^,\]}]*)$/);
    return match?.[1];
}

function isInsideUnterminatedString(text: string, offset: number): boolean {
    let insideString = false;
    let escaped = false;

    for (let index = 0; index < offset; index += 1) {
        const char = text[index];
        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '"') {
            insideString = !insideString;
        }
    }

    return insideString;
}

function createCadtoolDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
    const root = parseJsonWithRanges(document.getText());
    if (!root || root.kind !== 'object') {
        return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const names = new Map<string, JsonStringNode[]>();
    const referenceIndex = buildCadtoolReferenceIndex(root);
    const objectContexts = collectRootObjectContexts(root);

    for (const objectContext of objectContexts) {
        const objectNode = objectContext.node;
        const nameProperty = getObjectProperty(objectNode, 'name');
        if (nameProperty?.value.kind === 'string') {
            const nameNode = nameProperty.value;
            const nameValue = nameNode.value;
            if (!CADTOOL_NAME_RULE.test(nameValue)) {
                const nameOffsets = getStringContentOffsets(nameNode);
                diagnostics.push(
                    createDiagnostic(
                        document,
                        nameOffsets.start,
                        nameOffsets.end,
                        'name must match ^[A-Za-z_][A-Za-z0-9_]*$.',
                        DIAGNOSTIC_CODE_INVALID_NAME
                    )
                );
            }

            const existing = names.get(nameValue);
            if (existing) {
                existing.push(nameNode);
            } else {
                names.set(nameValue, [nameNode]);
            }
        }

        const iconSizeProperty = getObjectProperty(objectNode, 'iconSize');
        if (iconSizeProperty?.value.kind === 'number') {
            addRangeDiagnostic(
                diagnostics,
                document,
                iconSizeProperty.value,
                ICON_SIZE_MIN,
                ICON_SIZE_MAX,
                'iconSize',
                DIAGNOSTIC_CODE_ICON_SIZE_RANGE
            );
        }

        const positionProperty = getObjectProperty(objectNode, 'position');
        if (positionProperty?.value.kind === 'array') {
            addArrayElementRangeDiagnostics(
                diagnostics,
                document,
                positionProperty.value,
                POSITION_MIN,
                POSITION_MAX,
                'position',
                DIAGNOSTIC_CODE_POSITION_RANGE
            );
        } else if (positionProperty?.value.kind === 'object') {
            addObjectCoordinateRangeDiagnostics(
                diagnostics,
                document,
                positionProperty.value,
                POSITION_MIN,
                POSITION_MAX,
                'position',
                DIAGNOSTIC_CODE_POSITION_RANGE
            );
        }

        const directionProperty = getObjectProperty(objectNode, 'direction');
        if (directionProperty?.value.kind === 'array') {
            addArrayElementRangeDiagnostics(
                diagnostics,
                document,
                directionProperty.value,
                DIRECTION_MIN,
                DIRECTION_MAX,
                'direction',
                DIAGNOSTIC_CODE_DIRECTION_RANGE
            );
        } else if (directionProperty?.value.kind === 'object') {
            addObjectCoordinateRangeDiagnostics(
                diagnostics,
                document,
                directionProperty.value,
                DIRECTION_MIN,
                DIRECTION_MAX,
                'direction',
                DIAGNOSTIC_CODE_DIRECTION_RANGE
            );
        }

        addMissingRequiredFieldDiagnostics(diagnostics, document, objectContext);
        addUnresolvedReferenceDiagnostics(diagnostics, document, objectNode, referenceIndex);
    }

    for (const [name, occurrences] of names.entries()) {
        if (occurrences.length < 2) {
            continue;
        }

        for (const nameNode of occurrences) {
            const nameOffsets = getStringContentOffsets(nameNode);
            diagnostics.push(
                createDiagnostic(
                    document,
                    nameOffsets.start,
                    nameOffsets.end,
                    `Duplicate name "${name}" found in objects array.`,
                    DIAGNOSTIC_CODE_DUPLICATE_NAME
                )
            );
        }
    }

    return diagnostics;
}

function addUnresolvedReferenceDiagnostics(
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument,
    objectNode: JsonObjectNode,
    referenceIndex: CadtoolReferenceIndex
): void {
    for (const property of objectNode.properties) {
        if (property.value.kind !== 'string') {
            continue;
        }

        const value = property.value.value;
        if (value.trim().length === 0) {
            continue;
        }

        if (isReferenceResolved(referenceIndex, property.key, value)) {
            continue;
        }

        const valueOffsets = getStringContentOffsets(property.value);
        diagnostics.push(
            createDiagnostic(
                document,
                valueOffsets.start,
                valueOffsets.end,
                `Unresolved reference for ${property.key}: "${value}".`,
                DIAGNOSTIC_CODE_UNRESOLVED_REFERENCE
            )
        );
    }
}

function addMissingRequiredFieldDiagnostics(
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument,
    objectContext: CadtoolObjectContext
): void {
    const { objectType, node } = objectContext;
    if (!objectType) {
        return;
    }

    const requiredFields = REQUIRED_FIELDS_BY_OBJECT_TYPE[objectType];
    if (!requiredFields) {
        return;
    }

    const missingFields = requiredFields.filter((field) => !getObjectProperty(node, field));
    if (missingFields.length === 0) {
        return;
    }

    const insertionOffset = Math.max(node.start + 1, node.end - 1);
    for (const field of missingFields) {
        diagnostics.push(
            createDiagnostic(
                document,
                insertionOffset,
                insertionOffset,
                `Missing required field "${field}" for ${objectType}.`,
                `${DIAGNOSTIC_CODE_MISSING_REQUIRED_FIELD}:${objectType}:${field}`
            )
        );
    }
}

function addObjectCoordinateRangeDiagnostics(
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument,
    objectNode: JsonObjectNode,
    min: number,
    max: number,
    label: string,
    code: string
): void {
    for (const property of objectNode.properties) {
        if (property.value.kind !== 'number') {
            continue;
        }
        addRangeDiagnostic(diagnostics, document, property.value, min, max, label, code);
    }
}

function collectRootObjectContexts(root: JsonObjectNode): CadtoolObjectContext[] {
    const contexts: CadtoolObjectContext[] = [];

    for (const property of root.properties) {
        const key = property.key;
        if (!CADTOOL_ROOT_OBJECT_ARRAY_FIELDS.includes(key as (typeof CADTOOL_ROOT_OBJECT_ARRAY_FIELDS)[number])) {
            continue;
        }
        if (property.value.kind !== 'array') {
            continue;
        }

        for (const element of property.value.elements) {
            if (element.kind === 'object') {
                contexts.push({
                    rootField: key,
                    objectType: resolveCadtoolObjectType(key, element),
                    node: element
                });
            }
        }
    }

    return contexts;
}

function buildCadtoolReferenceIndex(root: JsonObjectNode): CadtoolReferenceIndex {
    const groups = new Set<string>();
    const markers = new Set<string>();
    const connectors = new Set<string>();
    const ribSlices = new Set<string>();
    const parts = new Set<string>();

    const objectContexts = collectRootObjectContexts(root);
    for (const objectContext of objectContexts) {
        const objectType = objectContext.objectType;
        if (!objectType) {
            continue;
        }

        const name = getStringPropertyValue(objectContext.node, 'name');
        if (name) {
            if (objectType === 'group') {
                groups.add(name);
            } else if (objectType === 'marker') {
                markers.add(name);
            } else if (objectType === 'connector') {
                connectors.add(name);
            } else if (objectType === 'ribSlice') {
                ribSlices.add(name);
            }
        }

        if (objectType === 'group') {
            collectGroupPartNames(parts, objectContext.node);
        }
    }

    return {
        group: groups,
        marker: markers,
        connector: connectors,
        ribSlice: ribSlices,
        part: parts
    };
}

function resolveCadtoolObjectType(
    rootField: string,
    objectNode: JsonObjectNode
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

    const objectType = getStringPropertyValue(objectNode, 'type');
    if (
        objectType === 'group' ||
        objectType === 'marker' ||
        objectType === 'designPoint' ||
        objectType === 'connector' ||
        objectType === 'motion' ||
        objectType === 'contact' ||
        objectType === 'fluidPort' ||
        objectType === 'ribSlice' ||
        objectType === 'gravity' ||
        objectType === 'medium'
    ) {
        return objectType;
    }

    return undefined;
}

function getStringPropertyValue(objectNode: JsonObjectNode, key: string): string | undefined {
    const property = getObjectProperty(objectNode, key);
    if (property?.value.kind !== 'string') {
        return undefined;
    }
    return property.value.value;
}

function collectGroupPartNames(target: Set<string>, groupNode: JsonObjectNode): void {
    const partsProperty = getObjectProperty(groupNode, 'parts');
    if (partsProperty?.value.kind !== 'array') {
        return;
    }

    for (const element of partsProperty.value.elements) {
        if (element.kind !== 'string') {
            continue;
        }
        target.add(element.value);
    }
}

function collectReferenceCandidates(referenceIndex: CadtoolReferenceIndex, field: string): string[] {
    const targets = REFERENCE_TARGETS_BY_FIELD[field];
    if (!targets) {
        return [];
    }

    const values = new Set<string>();
    for (const target of targets) {
        for (const value of referenceIndex[target]) {
            values.add(value);
        }
    }
    return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function isReferenceResolved(referenceIndex: CadtoolReferenceIndex, field: string, value: string): boolean {
    const targets = REFERENCE_TARGETS_BY_FIELD[field];
    if (!targets) {
        return true;
    }

    for (const target of targets) {
        if (referenceIndex[target].has(value)) {
            return true;
        }
    }

    return false;
}

function addArrayElementRangeDiagnostics(
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument,
    arrayNode: JsonArrayNode,
    min: number,
    max: number,
    label: string,
    code: string
): void {
    for (const element of arrayNode.elements) {
        if (element.kind !== 'number') {
            continue;
        }

        addRangeDiagnostic(diagnostics, document, element, min, max, label, code);
    }
}

function addRangeDiagnostic(
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument,
    numberNode: JsonNumberNode,
    min: number,
    max: number,
    label: string,
    code: string
): void {
    if (numberNode.value >= min && numberNode.value <= max) {
        return;
    }

    diagnostics.push(
        createDiagnostic(
            document,
            numberNode.start,
            numberNode.end,
            `${label} must be between ${min} and ${max}.`,
            code
        )
    );
}

function createDiagnostic(
    document: vscode.TextDocument,
    start: number,
    end: number,
    message: string,
    code: string
): vscode.Diagnostic {
    const range = new vscode.Range(document.positionAt(start), document.positionAt(end));
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = code;
    return diagnostic;
}

function getStringContentOffsets(node: JsonStringNode): { start: number; end: number } {
    const start = node.start + 1;
    const end = Math.max(start, node.end - 1);
    return { start, end };
}

function getObjectProperty(node: JsonObjectNode, key: string): JsonProperty | undefined {
    return node.properties.find((property) => property.key === key);
}

class CadtoolCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    public provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        if (!isCadtoolConfigDocument(document)) {
            return [];
        }

        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (typeof diagnostic.code !== 'string') {
                continue;
            }

            if (diagnostic.code === DIAGNOSTIC_CODE_INVALID_NAME) {
                const fix = createNameQuickFix(document, diagnostic);
                if (fix) {
                    actions.push(fix);
                }
                continue;
            }

            if (diagnostic.code.startsWith(`${DIAGNOSTIC_CODE_MISSING_REQUIRED_FIELD}:`)) {
                const fix = createMissingRequiredFieldQuickFix(document, diagnostic);
                if (fix) {
                    actions.push(fix);
                }
                continue;
            }

            if (diagnostic.code === DIAGNOSTIC_CODE_UNRESOLVED_REFERENCE) {
                actions.push(...createReferenceReplaceQuickFixes(document, diagnostic));
                continue;
            }

            const rangeRule = RANGE_FIX_RULES[diagnostic.code];
            if (!rangeRule) {
                continue;
            }

            const fix = createRangeClipQuickFix(document, diagnostic, rangeRule.label, rangeRule.min, rangeRule.max);
            if (fix) {
                actions.push(fix);
            }
        }

        return actions;
    }
}

function createNameQuickFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction | undefined {
    const current = document.getText(diagnostic.range);
    const sanitized = sanitizeName(current);
    if (sanitized === current) {
        return undefined;
    }

    const action = new vscode.CodeAction(
        `Normalize name to "${sanitized}"`,
        vscode.CodeActionKind.QuickFix
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, diagnostic.range, sanitized);
    action.edit = edit;
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
}

function createMissingRequiredFieldQuickFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction | undefined {
    if (typeof diagnostic.code !== 'string') {
        return undefined;
    }

    const codeParts = diagnostic.code.split(':');
    if (codeParts.length !== 3 || codeParts[0] !== DIAGNOSTIC_CODE_MISSING_REQUIRED_FIELD) {
        return undefined;
    }

    const objectType = codeParts[1] as CadtoolObjectType;
    const field = codeParts[2];
    if (!Object.prototype.hasOwnProperty.call(REQUIRED_FIELDS_BY_OBJECT_TYPE, objectType)) {
        return undefined;
    }

    const insertion = buildMissingRequiredFieldInsertText(document, diagnostic.range.start, objectType, field);
    if (!insertion) {
        return undefined;
    }

    const action = new vscode.CodeAction(
        `Add required field "${field}"`,
        vscode.CodeActionKind.QuickFix
    );
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, diagnostic.range.start, insertion);
    action.edit = edit;
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
}

function buildMissingRequiredFieldInsertText(
    document: vscode.TextDocument,
    insertionPosition: vscode.Position,
    objectType: CadtoolObjectType,
    field: string
): string | undefined {
    const defaultValue = getDefaultValueForRequiredField(objectType, field);
    if (defaultValue === undefined) {
        return undefined;
    }

    const text = document.getText();
    const insertionOffset = document.offsetAt(insertionPosition);
    const hasExistingProperties = objectHasExistingProperties(text, insertionOffset);
    const baseIndent = getLineIndent(document.lineAt(insertionPosition.line).text);
    const fieldIndent = resolveObjectFieldIndent(document, insertionPosition, baseIndent);
    const fieldLiteral = `"${field}": ${defaultValue}`;

    if (hasExistingProperties) {
        return `,\n${fieldIndent}${fieldLiteral}\n${baseIndent}`;
    }

    return `\n${fieldIndent}${fieldLiteral}\n${baseIndent}`;
}

function getDefaultValueForRequiredField(
    objectType: CadtoolObjectType,
    field: string
): string | undefined {
    if (field === 'name') {
        return `"${objectType}_1"`;
    }

    if (field === 'connectorType') {
        return '"fixed"';
    }

    if (field === 'motionType') {
        return '"angle"';
    }

    if (field === 'portType') {
        return '"variableTankGasPort"';
    }

    if (field === 'gravityType') {
        return '"uniform"';
    }

    if (
        field === 'part1' ||
        field === 'part2' ||
        field === 'partA' ||
        field === 'partB' ||
        field === 'partRef' ||
        field === 'groupRef' ||
        field === 'markerRef' ||
        field === 'connectorRef' ||
        field === 'ribSliceRef' ||
        field === 'tankRef'
    ) {
        return '""';
    }

    return undefined;
}

function objectHasExistingProperties(text: string, insertionOffset: number): boolean {
    let index = insertionOffset - 1;
    while (index >= 0 && /\s/.test(text[index])) {
        index -= 1;
    }

    if (index < 0) {
        return false;
    }

    return text[index] !== '{';
}

function resolveObjectFieldIndent(
    document: vscode.TextDocument,
    insertionPosition: vscode.Position,
    baseIndent: string
): string {
    for (let lineNumber = insertionPosition.line - 1; lineNumber >= 0; lineNumber -= 1) {
        const lineText = document.lineAt(lineNumber).text;
        if (lineText.trim().length === 0) {
            continue;
        }

        const indent = getLineIndent(lineText);
        if (indent.length > baseIndent.length) {
            return indent;
        }
        break;
    }

    return `${baseIndent}  `;
}

function getLineIndent(lineText: string): string {
    const match = lineText.match(/^\s*/);
    return match ? match[0] : '';
}

function createReferenceReplaceQuickFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): vscode.CodeAction[] {
    const parsed = parseUnresolvedReferenceDiagnosticMessage(diagnostic.message);
    if (!parsed) {
        return [];
    }

    const root = parseJsonWithRanges(document.getText());
    if (!root || root.kind !== 'object') {
        return [];
    }

    const candidates = collectReferenceCandidates(buildCadtoolReferenceIndex(root), parsed.field)
        .filter((candidate) => candidate !== parsed.value)
        .slice(0, 5);

    return candidates.map((candidate, index) => {
        const action = new vscode.CodeAction(
            `Replace with "${candidate}"`,
            vscode.CodeActionKind.QuickFix
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, diagnostic.range, candidate);
        action.edit = edit;
        action.diagnostics = [diagnostic];
        action.isPreferred = index === 0;
        return action;
    });
}

function parseUnresolvedReferenceDiagnosticMessage(
    message: string
): { field: string; value: string } | undefined {
    const match = message.match(/^Unresolved reference for ([A-Za-z0-9_]+): "([^"]+)"\.$/);
    if (!match) {
        return undefined;
    }

    return {
        field: match[1],
        value: match[2]
    };
}

function createRangeClipQuickFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    label: string,
    min: number,
    max: number
): vscode.CodeAction | undefined {
    const rawValue = document.getText(diagnostic.range);
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
        return undefined;
    }

    const clipped = clamp(parsedValue, min, max);
    if (clipped === parsedValue) {
        return undefined;
    }

    const replacement = String(clipped);
    const action = new vscode.CodeAction(
        `Clip ${label} to ${replacement}`,
        vscode.CodeActionKind.QuickFix
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, diagnostic.range, replacement);
    action.edit = edit;
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
}

function sanitizeName(name: string): string {
    const replaced = name.replace(/[^A-Za-z0-9_]/g, '_');
    if (replaced.length === 0) {
        return '_';
    }

    if (/^[A-Za-z_]/.test(replaced)) {
        return replaced;
    }

    return `_${replaced}`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function parseJsonWithRanges(text: string): JsonNode | undefined {
    const parser = new JsonRangeParser(text);
    return parser.parse();
}

function findPropertyContext(node: JsonNode, offset: number): PropertyContext | undefined {
    if (node.kind === 'object') {
        for (const property of node.properties) {
            if (offset >= property.keyNode.start && offset <= property.keyNode.end) {
                return {
                    property,
                    insideKey: true,
                    insideValue: false,
                    valueNode: property.value
                };
            }

            if (offset >= property.value.start && offset <= property.value.end) {
                const nested = findPropertyContext(property.value, offset);
                if (nested) {
                    return nested;
                }

                return {
                    property,
                    insideKey: false,
                    insideValue: true,
                    valueNode: property.value
                };
            }
        }
    }

    if (node.kind === 'array') {
        for (const element of node.elements) {
            if (offset >= element.start && offset <= element.end) {
                const nested = findPropertyContext(element, offset);
                if (nested) {
                    return nested;
                }
            }
        }
    }

    return undefined;
}

class JsonRangeParser {
    private readonly text: string;
    private index = 0;

    public constructor(text: string) {
        this.text = text;
    }

    public parse(): JsonNode | undefined {
        this.skipTrivia();
        const node = this.parseValue();
        if (!node) {
            return undefined;
        }

        this.skipTrivia();
        if (this.index !== this.text.length) {
            return undefined;
        }

        return node;
    }

    private parseValue(): JsonNode | undefined {
        this.skipTrivia();
        const char = this.peek();
        if (!char) {
            return undefined;
        }

        if (char === '{') {
            return this.parseObject();
        }
        if (char === '[') {
            return this.parseArray();
        }
        if (char === '"') {
            return this.parseString();
        }
        if (char === '-' || this.isDigit(char)) {
            return this.parseNumber();
        }
        if (this.text.startsWith('true', this.index)) {
            const start = this.index;
            this.index += 4;
            return { kind: 'boolean', value: true, start, end: this.index };
        }
        if (this.text.startsWith('false', this.index)) {
            const start = this.index;
            this.index += 5;
            return { kind: 'boolean', value: false, start, end: this.index };
        }
        if (this.text.startsWith('null', this.index)) {
            const start = this.index;
            this.index += 4;
            return { kind: 'null', value: null, start, end: this.index };
        }

        return undefined;
    }

    private parseObject(): JsonObjectNode | undefined {
        const start = this.index;
        this.index += 1;
        const properties: JsonProperty[] = [];
        this.skipTrivia();

        if (this.peek() === '}') {
            this.index += 1;
            return { kind: 'object', properties, start, end: this.index };
        }

        while (this.index < this.text.length) {
            this.skipTrivia();
            const keyNode = this.parseString();
            if (!keyNode) {
                return undefined;
            }

            this.skipTrivia();
            if (this.peek() !== ':') {
                return undefined;
            }
            this.index += 1;

            const value = this.parseValue();
            if (!value) {
                return undefined;
            }

            properties.push({
                key: keyNode.value,
                keyNode,
                value,
                start: keyNode.start,
                end: value.end
            });

            this.skipTrivia();
            const delimiter = this.peek();
            if (delimiter === ',') {
                this.index += 1;
                continue;
            }
            if (delimiter === '}') {
                this.index += 1;
                return { kind: 'object', properties, start, end: this.index };
            }
            return undefined;
        }

        return undefined;
    }

    private parseArray(): JsonArrayNode | undefined {
        const start = this.index;
        this.index += 1;
        const elements: JsonNode[] = [];
        this.skipTrivia();

        if (this.peek() === ']') {
            this.index += 1;
            return { kind: 'array', elements, start, end: this.index };
        }

        while (this.index < this.text.length) {
            const value = this.parseValue();
            if (!value) {
                return undefined;
            }
            elements.push(value);

            this.skipTrivia();
            const delimiter = this.peek();
            if (delimiter === ',') {
                this.index += 1;
                continue;
            }
            if (delimiter === ']') {
                this.index += 1;
                return { kind: 'array', elements, start, end: this.index };
            }
            return undefined;
        }

        return undefined;
    }

    private parseString(): JsonStringNode | undefined {
        if (this.peek() !== '"') {
            return undefined;
        }

        const start = this.index;
        this.index += 1;

        while (this.index < this.text.length) {
            const char = this.text[this.index];
            if (char === '\\') {
                this.index += 2;
                continue;
            }
            if (char === '"') {
                this.index += 1;
                const end = this.index;
                const raw = this.text.slice(start, end);
                try {
                    return {
                        kind: 'string',
                        start,
                        end,
                        value: JSON.parse(raw) as string
                    };
                } catch {
                    return undefined;
                }
            }

            if (char === '\n' || char === '\r') {
                return undefined;
            }

            this.index += 1;
        }

        return undefined;
    }

    private parseNumber(): JsonNumberNode | undefined {
        const start = this.index;

        if (this.peek() === '-') {
            this.index += 1;
        }

        const first = this.peek();
        if (!first) {
            return undefined;
        }

        if (first === '0') {
            this.index += 1;
        } else if (this.isNonZeroDigit(first)) {
            this.index += 1;
            while (this.isDigit(this.peek())) {
                this.index += 1;
            }
        } else {
            return undefined;
        }

        if (this.peek() === '.') {
            this.index += 1;
            if (!this.isDigit(this.peek())) {
                return undefined;
            }
            while (this.isDigit(this.peek())) {
                this.index += 1;
            }
        }

        const exponent = this.peek();
        if (exponent === 'e' || exponent === 'E') {
            this.index += 1;
            const sign = this.peek();
            if (sign === '+' || sign === '-') {
                this.index += 1;
            }
            if (!this.isDigit(this.peek())) {
                return undefined;
            }
            while (this.isDigit(this.peek())) {
                this.index += 1;
            }
        }

        const raw = this.text.slice(start, this.index);
        const value = Number(raw);
        if (!Number.isFinite(value)) {
            return undefined;
        }

        return {
            kind: 'number',
            value,
            start,
            end: this.index
        };
    }

    private skipTrivia(): void {
        while (this.index < this.text.length) {
            const char = this.peek();
            if (char === undefined) {
                return;
            }

            if (/\s/.test(char)) {
                this.index += 1;
                continue;
            }

            const next = this.peek(1);
            if (char === '/' && next === '/') {
                this.index += 2;
                while (this.index < this.text.length && this.text[this.index] !== '\n' && this.text[this.index] !== '\r') {
                    this.index += 1;
                }
                continue;
            }
            if (char === '/' && next === '*') {
                const endComment = this.text.indexOf('*/', this.index + 2);
                if (endComment < 0) {
                    this.index = this.text.length;
                    return;
                }
                this.index = endComment + 2;
                continue;
            }

            return;
        }
    }

    private peek(offset = 0): string | undefined {
        return this.text[this.index + offset];
    }

    private isDigit(char: string | undefined): boolean {
        return char !== undefined && char >= '0' && char <= '9';
    }

    private isNonZeroDigit(char: string): boolean {
        return char >= '1' && char <= '9';
    }
}
