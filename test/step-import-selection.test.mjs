import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('step import keeps the initial selection empty', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const loadStepFileMatch = source.match(/async function loadStepFile\(fileName: string, fileContent: unknown\): Promise<void> \{[\s\S]*?\n\}/);

  assert.ok(loadStepFileMatch, 'expected to find loadStepFile implementation');

  const loadStepFileSource = loadStepFileMatch[0];
  assert.doesNotMatch(loadStepFileSource, /selectShape\(rootShapes\[0\]\.id\)/);
  assert.doesNotMatch(loadStepFileSource, /selectShape\(result\.shapes\[0\]\)/);
});

test('marker creation opens the options panel without requiring a preselected part', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const startMarkerCreationMatch = source.match(/function startMarkerCreation\(\): void \{[\s\S]*?\n\}/);

  assert.ok(startMarkerCreationMatch, 'expected to find startMarkerCreation implementation');

  const startMarkerCreationSource = startMarkerCreationMatch[0];
  assert.match(startMarkerCreationSource, /renderMarkerCreationPanel\(\)/);
  assert.doesNotMatch(startMarkerCreationSource, /Please select a part first to create a marker/);
  assert.doesNotMatch(startMarkerCreationSource, /if \(!selectedShapeId\)/);
  assert.match(startMarkerCreationSource, /viewer\?\.setSelectionEnabled\(false\)/);
});

test('marker and reference marker tree nodes prefer the host part node', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /marker\.parentId\s*\?\?\s*marker\.groupId/);
  assert.match(source, /refFrame\.parentId\s*\?\?\s*refFrame\.groupId/);
});

test('marker creation wires hover preview updates on canvas pointer move', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');
  const selectionManagerSource = await readFile(new URL('../packages/three/src/SelectionManager.ts', import.meta.url), 'utf8');

  assert.match(source, /container\.addEventListener\('mousemove', handleCanvasPointerMove\)/);
  assert.match(source, /viewer\?\.setSelectionEnabled\(true\)/);
  assert.match(viewerSource, /pickSelectableIdAtScreenPoint\(x: number, y: number\): string \| null/);
  assert.match(viewerSource, /setSelectionEnabled\(enabled: boolean\): void/);
  assert.doesNotMatch(selectionManagerSource, /pickObjectIdAtScreenPoint\(x: number, y: number\): string \| null \{\s*if \(!this\.enabled\)/);
});

test('marker creation stays in marker placement mode after creating a marker', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const handleCanvasClickMatch = source.match(/function handleCanvasClick\(event: MouseEvent\): void \{[\s\S]*?\n\}/);
  const finalizeMarkerDraftMatch = source.match(/function finalizeMarkerDraft\(\): void \{[\s\S]*?\n\}/);

  assert.ok(handleCanvasClickMatch, 'expected to find handleCanvasClick implementation');
  assert.ok(finalizeMarkerDraftMatch, 'expected to find finalizeMarkerDraft implementation');

  const handleCanvasClickSource = handleCanvasClickMatch[0];
  const finalizeMarkerDraftSource = finalizeMarkerDraftMatch[0];

  assert.doesNotMatch(handleCanvasClickSource, /completed = markerCreationMode === 'fast'/);
  assert.match(finalizeMarkerDraftSource, /viewer\?\.setSelectionEnabled\(false\)/);
  assert.match(finalizeMarkerDraftSource, /setStatus\('Click on a face to create marker'\)/);
});

test('marker tree context menu supports deleting marker nodes', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /if \(nodeData\.frameId\) \{\s*return \[\s*\{ label: '删除', action: 'deleteFrame' \}/);
});

test('marker properties panel exposes editable name visibility size position and direction', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const renderMarkerPropertiesPanelMatch = source.match(/function renderMarkerPropertiesPanel\(markerId: string\): void \{[\s\S]*?\n\}/);

  assert.ok(renderMarkerPropertiesPanelMatch, 'expected to find renderMarkerPropertiesPanel implementation');

  const panelSource = renderMarkerPropertiesPanelMatch[0];
  assert.match(panelSource, /buildNameInput\('prop-marker-name'/);
  assert.match(panelSource, /id="prop-marker-visible"/);
  assert.match(panelSource, /id="prop-marker-size"/);
  assert.match(panelSource, /buildVec3Input\('prop-marker-pos'/);
  assert.match(panelSource, /buildVec3Input\('prop-marker-dir'/);
});

test('mesh picking uses double sided surfaces for marker hover coverage', async () => {
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');

  assert.match(viewerSource, /side: THREE\.DoubleSide/);
});

test('frame visualizer adds a circular ring around the marker triad', async () => {
  const frameVisualizerSource = await readFile(new URL('../packages/three/src/FrameVisualizer.ts', import.meta.url), 'utf8');

  assert.match(frameVisualizerSource, /new THREE\.TorusGeometry\(/);
});

test('marker face placement converts viewer rays through the shape transform', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const resolveFacePlacementMatch = source.match(/function resolveFacePlacement\([\s\S]*?\n\}/);

  assert.ok(resolveFacePlacementMatch, 'expected to find resolveFacePlacement implementation');

  const resolveFacePlacementSource = resolveFacePlacementMatch[0];
  assert.match(resolveFacePlacementSource, /invertRigidTransform\(shapeTransform\)/);
  assert.match(resolveFacePlacementSource, /transformPoint\(\s*inverseShapeTransform,\s*ray\.origin\.x/);
  assert.match(resolveFacePlacementSource, /transformDirection\(\s*inverseShapeTransform,\s*ray\.direction\.x/);
  assert.match(resolveFacePlacementSource, /transformPoint\(\s*shapeTransform,\s*result\.position\.x/);
  assert.match(resolveFacePlacementSource, /transformDirection\(\s*shapeTransform,\s*result\.normal\.x/);
});
