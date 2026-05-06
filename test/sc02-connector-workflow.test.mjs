import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const webviewSourceUrl = new URL('../src/webview/main.ts', import.meta.url);

async function readWebviewSource() {
    return readFile(webviewSourceUrl, 'utf8');
}

function extractFunction(source, signaturePattern, label) {
    const match = source.match(signaturePattern);
    assert.ok(match, `expected to find ${label}`);
    return match[0];
}

test('SC02 joint options panel exposes dual-mode creation, Ground shortcut and pose editing controls', async () => {
    const source = await readWebviewSource();
    const panelSource = extractFunction(
        source,
        /function renderJointOptionsPanel\(\): void \{[\s\S]*?\n\}/,
        'renderJointOptionsPanel implementation'
    );

    assert.match(panelSource, /id="opt-joint-size"/);
    assert.match(panelSource, /支持 Alt \+ 鼠标滚轮快速调节图标大小/);
    assert.match(panelSource, /id="opt-joint-mode-fast"/);
    assert.match(panelSource, /id="opt-joint-mode-standard"/);
    assert.match(panelSource, /id="opt-joint-ground"/);
    assert.match(panelSource, /buildVec3Input\('opt-joint-pos'/);
    assert.match(panelSource, /buildVec3Input\('opt-joint-dir'/);
    assert.match(panelSource, /id="opt-joint-reverse"/);
    assert.match(panelSource, /buildActionButtons\('opt-joint-confirm', '添加', 'opt-joint-cancel'\)/);
    assert.match(panelSource, /当前为闪电模式，完成零件 1 和零件 2 拾取后会立即创建连接。/);
});

test('SC02 joint picking supports Ground as part2 and differentiates fast versus standard completion', async () => {
    const source = await readWebviewSource();
    const groundTargetSource = extractFunction(
        source,
        /function setJointDraftGroundTarget\(\): void \{[\s\S]*?\n\}/,
        'setJointDraftGroundTarget implementation'
    );
    const placementSource = extractFunction(
        source,
        /function createJointFromPlacement\(selectedShape: LoadedShape, position: Vec3, normal: Vec3\): void \{[\s\S]*?\n\}/,
        'createJointFromPlacement implementation'
    );

    assert.match(groundTargetSource, /jointDraft\.part2 = GROUND_PART_ID;/);
    assert.match(groundTargetSource, /jointCreationMode === 'fast'/);
    assert.match(groundTargetSource, /finalizeJointDraft\(\);/);
    assert.match(groundTargetSource, /setStatusInfo\('零件 2 已设置为 Ground。'\);/);

    assert.match(placementSource, /jointDraftPickStage === 'part1'/);
    assert.match(placementSource, /jointDraft\.part1 = selectedShape\.id;/);
    assert.match(placementSource, /jointDraftPickStage = 'part2';/);
    assert.match(placementSource, /jointDraft\.part2 = selectedShape\.id;/);
    assert.match(placementSource, /const validation = validateConnectorParticipants\(jointDraft\.part1, jointDraft\.part2\);/);
    assert.match(placementSource, /if \(jointCreationMode === 'fast'\) \{\s*finalizeJointDraft\(\);/);
    assert.match(placementSource, /setStatus\('可调整位置\/方向后点击添加'\);/);
});

test('SC02 joint finalization persists canonical connector data and keeps continuous creation active', async () => {
    const source = await readWebviewSource();
    const finalizeSource = extractFunction(
        source,
        /function finalizeJointDraft\(\): boolean \{[\s\S]*?\n\}/,
        'finalizeJointDraft implementation'
    );

    assert.match(finalizeSource, /jointType: normalizeConnectorType\(jointDraft\.jointType\)/);
    assert.match(finalizeSource, /position: cloneVec3\(jointDraft\.position\)/);
    assert.match(finalizeSource, /direction: resolveConnectorDirection\(\{/);
    assert.match(finalizeSource, /iconSize: jointDraft\.iconSize/);
    assert.match(finalizeSource, /inferenceEnabled: jointDraft\.inferenceEnabled/);
    assert.match(finalizeSource, /zAxisReversed: jointDraft\.zAxisReversed/);
    assert.match(finalizeSource, /clearJointDraftPreview\(\);/);
    assert.match(finalizeSource, /viewer\?\.addJoint\(buildJointViewerData\(joint\)\);/);
    assert.match(finalizeSource, /updateModelTree\(\);/);
    assert.match(finalizeSource, /selectSelection\(\{ kind: 'joint', id: joint\.id \}\);/);
    assert.match(finalizeSource, /expandAndScrollToTreeNode\(`conn_\$\{joint\.id\}`\);/);
    assert.match(finalizeSource, /jointDraft = createDefaultJointDraft\(nextType\);/);
    assert.match(finalizeSource, /jointDraftPickStage = 'part1';/);
});

test('SC02 joint default naming uses per-type numbering and retargets auto names on type change', async () => {
    const source = await readWebviewSource();
    const nextSequenceSource = extractFunction(
        source,
        /function getNextJointSequenceNumber\(jointType: string\): number \{[\s\S]*?\n\}/,
        'getNextJointSequenceNumber implementation'
    );
    const defaultNameSource = extractFunction(
        source,
        /function getDefaultJointName\(jointType: string\): string \{[\s\S]*?\n\}/,
        'getDefaultJointName implementation'
    );
    const previewDraftSource = extractFunction(
        source,
        /function buildTransientJointPreviewDraft\([\s\S]*?\): JointDraft \{[\s\S]*?\n\}/,
        'buildTransientJointPreviewDraft implementation'
    );
    const createDraftSource = extractFunction(
        source,
        /function createDefaultJointDraft\(jointType: string\): JointDraft \{[\s\S]*?\n\}/,
        'createDefaultJointDraft implementation'
    );
    const syncDraftSource = extractFunction(
        source,
        /function syncJointDraftFromInputs\(\): void \{[\s\S]*?\n\}/,
        'syncJointDraftFromInputs implementation'
    );

    assert.match(
        nextSequenceSource,
        /const usedNumbers = new Set<number>\(\);/
    );
    assert.match(nextSequenceSource, /normalizeConnectorType\(joint\.jointType\) !== normalizedType/);
    assert.match(nextSequenceSource, /joint\.name\.match\(new RegExp\(`\^\$\{normalizedType\}_\(\\\\d\+\)\$`\)\)/);
    assert.match(nextSequenceSource, /while \(usedNumbers\.has\(nextSequence\)\) \{/);
    assert.match(
        defaultNameSource,
        /return `\$\{normalizedType\}_\$\{getNextJointSequenceNumber\(normalizedType\)\}`;/
    );
    assert.match(previewDraftSource, /getDefaultJointName\(jointType\)/);
    assert.match(createDraftSource, /name: getDefaultJointName\(normalizedType\),/);
    assert.match(syncDraftSource, /const previousType = normalizeConnectorType\(jointDraft\.jointType\);/);
    assert.match(syncDraftSource, /const previousAutoName = getDefaultJointName\(previousType\);/);
    assert.match(syncDraftSource, /const nextType = normalizeConnectorType\(/);
    assert.match(syncDraftSource, /const nextDefaultName = getDefaultJointName\(nextType\);/);
    assert.match(syncDraftSource, /const shouldRefreshAutoName =/);
    assert.match(syncDraftSource, /jointDraft\.name = shouldRefreshAutoName \? nextDefaultName : typedName;/);
});

test('SC02 joint preview and persisted rendering stay anchored to part1 and separate draft from created visuals', async () => {
    const source = await readWebviewSource();
    const recomputeSource = extractFunction(
        source,
        /function recomputeJointDraftPlacement\(\): void \{[\s\S]*?\n\}/,
        'recomputeJointDraftPlacement implementation'
    );
    const buildViewerSource = extractFunction(
        source,
        /function buildJointViewerData\(joint: MbsJointEntity\): JointData \{[\s\S]*?\n\}/,
        'buildJointViewerData implementation'
    );
    const buildPreviewSource = extractFunction(
        source,
        /function buildJointPreviewData\(draft: JointDraft\): JointData \{[\s\S]*?\n\}/,
        'buildJointPreviewData implementation'
    );
    const pointerMoveSource = extractFunction(
        source,
        /function handleCanvasPointerMove\(event: MouseEvent\): void \{[\s\S]*?\n\}/,
        'handleCanvasPointerMove implementation'
    );
    const finalizeSource = extractFunction(
        source,
        /function finalizeJointDraft\(\): boolean \{[\s\S]*?\n\}/,
        'finalizeJointDraft implementation'
    );
    const resetSource = extractFunction(
        source,
        /function resetCanvasInteraction\(\): void \{[\s\S]*?\n\}/,
        'resetCanvasInteraction implementation'
    );

    assert.match(
        recomputeSource,
        /pickedDirection:\s*part1Pick\?\.direction\s*\?\?\s*part2Pick\?\.direction\s*\?\?\s*DEFAULT_CONNECTOR_DIRECTION/
    );
    assert.match(recomputeSource, /jointDraft\.position = cloneVec3\(part1Pick\.position\);/);
    assert.doesNotMatch(
        recomputeSource,
        /x:\s*\(part1Pick\.position\.x\s*\+\s*part2Pick\.position\.x\)\s*\/\s*2/
    );

    assert.match(buildViewerSource, /connectorType: normalizeConnectorType\(joint\.jointType\)/);
    assert.match(buildViewerSource, /displayState: 'created'/);
    assert.match(buildPreviewSource, /connectorType: normalizeConnectorType\(draft\.jointType\)/);
    assert.match(buildPreviewSource, /displayState: 'draft'/);
    assert.match(finalizeSource, /jointDraftPreviewBlockedUntil = Date\.now\(\) \+ 180;/);
    assert.match(
        source,
        /jointOptions:\s*\{[\s\S]*iconBaseUrl:\s*resolveIcons32Base\(\)\s*\?\?\s*undefined[\s\S]*preferSceneIcons:\s*false[\s\S]*\}/
    );
    assert.match(
        pointerMoveSource,
        /Date\.now\(\) < jointDraftPreviewBlockedUntil/,
    );
    assert.match(
        pointerMoveSource,
        /jointPlacementActive[\s\S]*jointDraftPickStage === 'part1'[\s\S]*showJointPreview\(\s*buildTransientJointPreviewDraft\(\s*placement\.selectedShape,\s*placement\.position,\s*placement\.normal\s*\)\s*\)/
    );
    assert.match(resetSource, /clearJointDraftPreview\(\);/);
});

test('SC02 joint nodes remain directly selectable and editable from tree and properties panel', async () => {
    const source = await readWebviewSource();
    const iconAssetSource = extractFunction(
        source,
        /function iconAssetForNode\(node: ModelTreeNode\): string \| null \{[\s\S]*?\n\}/,
        'iconAssetForNode implementation'
    );
    const propertiesSource = extractFunction(
        source,
        /function renderJointPropertiesPanel\(jointId: string\): void \{[\s\S]*?\n\}/,
        'renderJointPropertiesPanel implementation'
    );

    assert.match(
        source,
        /connectionsCategory\.children = Array\.from\(mbsJoints\.values\(\)\)\.map\(joint => \(\{[\s\S]*selectionKey: toJointSelectionKey\(joint\.id\)/
    );
    assert.match(propertiesSource, /buildDropdown\('prop-joint-type', '类型'/);
    assert.match(iconAssetSource, /const joint = node\.jointId \? mbsJoints\.get\(node\.jointId\) : null;/);
    assert.match(iconAssetSource, /switch \(normalizeConnectorType\(joint\?\.jointType\)\) \{/);
    assert.match(iconAssetSource, /case 'fixed':\s*return treeIconPath\('joint_cad_fixed\.png'\);/);
    assert.match(iconAssetSource, /case 'revolute':\s*return treeIconPath\('joint_cad_revolute\.png'\);/);
    assert.match(iconAssetSource, /case 'prismatic':\s*return treeIconPath\('joint_cad_prismatic\.png'\);/);
    assert.match(iconAssetSource, /case 'cylindrical':\s*return treeIconPath\('joint_cad_cylindrical\.png'\);/);
    assert.match(iconAssetSource, /case 'spherical':\s*return treeIconPath\('joint_cad_spherical\.png'\);/);
    assert.match(iconAssetSource, /case 'universal':\s*return treeIconPath\('joint_cad_universal\.png'\);/);
    assert.match(iconAssetSource, /case 'screw':\s*return treeIconPath\('joint_cad_screw\.png'\);/);
    assert.match(iconAssetSource, /case 'planar':\s*return treeIconPath\('joint_cad_planar\.png'\);/);
    assert.match(iconAssetSource, /default:\s*return treeIconPath\('model_tree_cad_unknown_cnt\.png'\);/);
    assert.match(propertiesSource, /id="prop-joint-inference"/);
    assert.match(propertiesSource, /id="prop-joint-reverse"/);
    assert.match(propertiesSource, /id="prop-joint-size"/);
    assert.match(propertiesSource, /buildVec3Input\('prop-joint-pos'/);
    assert.match(propertiesSource, /buildVec3Input\('prop-joint-dir'/);
    assert.match(propertiesSource, /id="prop-joint-delete"/);
    assert.match(propertiesSource, /id="prop-joint-save"/);
    assert.match(propertiesSource, /joint\.direction = resolveConnectorDirection\(\{/);
    assert.match(propertiesSource, /syncJointEntityToViewer\(joint\.id\);/);
    assert.match(propertiesSource, /deleteJointById\(joint\.id\);/);
});

test('SC02 joint import export and delete selection preserve connector workflow contract', async () => {
    const source = await readWebviewSource();
    const deleteSelectionSource = extractFunction(
        source,
        /function handleDeleteSelection\(\): void \{[\s\S]*?\n\}/,
        'handleDeleteSelection implementation'
    );

    assert.match(source, /const connectors = getConfigArray\(data, 'connector', stats\);/);
    assert.match(source, /const connectorType = toNonEmptyString\(entry\.connectorType\);/);
    assert.match(source, /const part1 = toNonEmptyString\(entry\.part1\);/);
    assert.match(source, /const part2 = toNonEmptyString\(entry\.part2\);/);
    assert.match(source, /const parsedDirection = resolveConnectorDirection\(\{/);
    assert.match(source, /iconSize:\s*typeof entry\.iconSize === 'number' && Number\.isFinite\(entry\.iconSize\)/);
    assert.match(source, /inferenceEnabled:\s*typeof entry\.inferenceEnabled === 'boolean' \? entry\.inferenceEnabled : true/);
    assert.match(source, /zAxisReversed: typeof entry\.zAxisReversed === 'boolean' \? entry\.zAxisReversed : false/);
    assert.match(
        source,
        /connector: Array\.from\(mbsJoints\.values\(\)\)\.map\(joint => \(\{[\s\S]*name: joint\.name,[\s\S]*connectorType: normalizeConnectorType\(joint\.jointType\),[\s\S]*part1: resolvePartRefName\(joint\.part1\),[\s\S]*part2: resolvePartRefName\(joint\.part2\),[\s\S]*position: joint\.position,[\s\S]*direction: joint\.direction,[\s\S]*iconSize: joint\.iconSize,[\s\S]*inferenceEnabled: joint\.inferenceEnabled,[\s\S]*zAxisReversed: joint\.zAxisReversed/
    );

    assert.match(deleteSelectionSource, /const selectedJointIds = getSelectedJointIds\(\);/);
    assert.match(
        deleteSelectionSource,
        /Select one or more design points, joints, motions, contacts, parts or groups first\./
    );
    assert.match(deleteSelectionSource, /selectedJointIds\.forEach\(jointId => \{/);
    assert.match(deleteSelectionSource, /if \(deleteJointById\(jointId\)\) \{\s*deletedJointCount \+= 1;/);
    assert.match(
        deleteSelectionSource,
        /Deleted \$\{deletedDesignPointCount\} design point\(s\), \$\{deletedJointCount\} joint\(s\), \$\{deletedMotionCount\} motion\(s\), \$\{deletedContactCount\} contact\(s\), \$\{deletedPartCount\} part\(s\) and \$\{groupDeleteResult\.deletedCount\} group\(s\)\./
    );
});
