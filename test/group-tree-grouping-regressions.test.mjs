import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('group selection renders the part properties panel with group type metadata', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const match = source.match(/function renderSelectedGroupProperties\(groupId: string\): void \{[\s\S]*?\n\}/);

  assert.ok(match, 'expected to find renderSelectedGroupProperties implementation');
  assert.match(match[0], /setPanelMode\('properties', '属性-零件'\);/);
  assert.match(match[0], /createPropertyRow\('类型', '分组', \{ boxed: true \}\)/);
});

test('default grouping derives ungrouped parts from non-assembly groupable nodes only', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /function getAllGroupablePartIds\(\): string\[\] \{/);
  assert.match(source, /return Array\.from\(new Set\(collectGroupableShapeIds\(rootShapes\)\)\);/);
  assert.match(source, /function collectGroupableShapeIds\(shapes: LoadedShape\[\]\): string\[\] \{/);
  assert.match(source, /if \(shape\.type === 'assembly' && shape\.children && shape\.children\.length > 0\) \{/);
  assert.match(source, /result\.push\(shape\.id\);/);
  assert.match(source, /groupDesignState\.ungroupedPartIds = getAllGroupablePartIds\(\)\.filter\(\(partId\) => !groupedPartIds\.has\(partId\)\);/);
});

test('step import disambiguates duplicate part names before imported groups are materialized', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const loadStepFileMatch = source.match(/async function loadStepFile\(fileName: string, fileContent: unknown\): Promise<void> \{[\s\S]*?\n\}/);

  assert.ok(loadStepFileMatch, 'expected to find loadStepFile implementation');
  assert.match(source, /function assignUniqueImportedPartNames\(shapes: LoadedShape\[\]\): void \{/);
  assert.match(source, /const seenNames = new Map<string, number>\(\);/);
  assert.match(source, /shape\.name = occurrenceIndex === 0 \? baseName : `\$\{baseName\}_\$\{occurrenceIndex\}`;/);
  assert.match(loadStepFileMatch[0], /assignUniqueImportedPartNames\(rootShapes\);[\s\S]*initializeImportedGroupDesignState\(\);/);
});

test('step import materializes exclusive imported groups for initially ungrouped parts', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const initMatch = source.match(/function initializeImportedGroupDesignState\(\): void \{[\s\S]*?\n\}/);

  assert.ok(initMatch, 'expected to find initializeImportedGroupDesignState implementation');
  assert.match(source, /materializeUngroupedPartsAsGroups/);
  assert.match(initMatch[0], /groupDesignState = materializeUngroupedPartsAsGroups\(groupDesignState, \{/);
  assert.match(initMatch[0], /kind: 'imported'/);
  assert.match(initMatch[0], /resolveGroupName: \(partId\) => loadedShapes\.get\(partId\)\?\.name \?\? partId/);
});

test('model tree preserves expansion state and only seeds the imported objects root as expanded', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /const treeExpandedNodeIds = new Set<string>\(\);/);
  assert.match(source, /function updateTreeNodeExpansionState\(nodeId: string \| undefined, expanded: boolean\): void \{/);
  assert.match(source, /function resetImportedTreeExpansionState\(\): void \{/);
  assert.match(source, /treeExpandedNodeIds\.add\('category_objects'\);/);
  assert.doesNotMatch(source, /getOrderedChildGroupIds\(null\)\.forEach\(\(groupId\) => \{\s*treeExpandedNodeIds\.add\(`group_\$\{groupId\}`\);\s*\}\);/);
  assert.match(source, /container\.dataset\.nodeId = nodeData\.id;/);
  assert.match(source, /const expandedByDefault = treeExpandedNodeIds\.has\(nodeData\.id\);/);
  assert.match(source, /updateTreeNodeExpansionState\(container\.dataset\.nodeId, !isExpanded\);/);
});

test('ungroup lifts the selected group contents to the root objects node', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /ungroupGroup as ungroupGroupInState/);
  assert.match(source, /const result = ungroupGroupInState\(groupDesignState, groupId, isGroupReferenced\);/);
  assert.match(source, /groupDesignState = result\.state as GroupDesignState;/);
  assert.match(source, /setStatusInfo\(`Ungrouped to 物体: moved \$\{result\.movedParts\} part\(s\) and \$\{result\.movedGroups\} child group\(s\)\.`\);/);
});

test('clean group keeps the empty-group cleanup behavior', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /cleanEmptyGroups as cleanEmptyGroupsInState/);
  assert.match(source, /const result = cleanEmptyGroupsInState\(groupDesignState, isGroupReferenced\);/);
  assert.match(source, /setStatusInfo\(`Empty groups cleaned: \$\{result\.removedGroupIds\.length\}`\);/);
  assert.doesNotMatch(source, /Group cleaned: moved/);
});

test('step hierarchy import materializes assemblies into selectable imported groups', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /function buildImportedGroupsFromShapes\(shapes: LoadedShape\[\]\): GroupNode\[\] \{/);
  assert.match(source, /id: `import_group_\$\{shape\.id\}`,/);
  assert.match(source, /kind: 'imported',/);
  assert.match(source, /const memberPartIds = shape\.type === 'assembly'\s*\?\s*\(shape\.children \?\? \[\]\)\s*\.filter\(\(child\) => child\.type !== 'assembly'\)\s*\.map\(\(child\) => child\.id\)\s*:\s*\[shape\.id\];/);
  assert.match(source, /function initializeImportedGroupDesignState\(\): void \{/);
  assert.match(source, /const importedGroups = buildImportedGroupsFromShapes\(flattenTopLevelAssemblyShapes\(rootShapes\)\);/);
});

test('step load initializes imported group state before model tree refresh', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const loadStepFileMatch = source.match(/async function loadStepFile\(fileName: string, fileContent: unknown\): Promise<void> \{[\s\S]*?\n\}/);

  assert.ok(loadStepFileMatch, 'expected to find loadStepFile implementation');
  const loadStepFileSource = loadStepFileMatch[0];
  assert.match(loadStepFileSource, /initializeImportedGroupDesignState\(\);/);
  assert.match(loadStepFileSource, /rootShapes\.push\(buildShapeTree\(root\)\);[\s\S]*initializeImportedGroupDesignState\(\);[\s\S]*updateModelTree\(\);/);
});

test('default group creates one exclusive parent group for every ungrouped part', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const handleCreateDefaultGroupMatch = source.match(/function handleCreateDefaultGroup\(\): void \{[\s\S]*?\n\}/);

  assert.ok(handleCreateDefaultGroupMatch, 'expected to find handleCreateDefaultGroup implementation');
  assert.match(handleCreateDefaultGroupMatch[0], /const createdGroups = memberShapeIds/);
  assert.match(handleCreateDefaultGroupMatch[0], /createGroupFromParts\(shape\.name, \[shape\.id\], null, 'default'\)/);
  assert.doesNotMatch(handleCreateDefaultGroupMatch[0], /createGroupFromParts\(`DefaultGroup\$\{mbsGroups\.size \+ 1\}`, memberShapeIds, null, 'default'\)/);
});

test('group selection syncs combined part bounds into viewer bounding boxes', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');

  assert.match(source, /function syncViewerGroupBoundsFromState\(\): void \{/);
  assert.match(source, /const groupBounds = getTopLevelSelectedGroupIds\(getSelectedGroupIds\(\)\)/);
  assert.match(source, /viewer\.setSelectionBoundsBoxes\(groupBounds\);/);
  assert.match(viewerSource, /private selectionBoundsGroup: THREE\.Group \| null = null;/);
  assert.match(viewerSource, /private buildSelectionBoundsHelper\(bounds: SelectionBoundsBox\): THREE\.Box3Helper \| null \{/);
  assert.match(viewerSource, /setSelectionBoundsBoxes\(boxes: SelectionBoundsBox\[\]\): void \{/);
  assert.match(viewerSource, /new THREE\.Box3Helper\(new THREE\.Box3\(min, max\), /);
});
