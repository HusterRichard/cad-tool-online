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

test('model tree nodes start collapsed after STEP import so users expand explicitly', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /const expandedByDefault = false;/);
  assert.match(source, /childrenContainer\.style\.display = expandedByDefault \? 'block' : 'none';/);
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
  assert.match(source, /if \(shape\.type !== 'assembly'\) \{\s*return;\s*\}/);
  assert.match(source, /id: `import_group_\$\{shape\.id\}`,/);
  assert.match(source, /kind: 'imported',/);
  assert.match(source, /memberPartIds: \(shape\.children \?\? \[\]\)\s*\.filter\(\(child\) => child\.type !== 'assembly'\)\s*\.map\(\(child\) => child\.id\),/);
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
