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

test('reference marker creation opens options panel and requires an existing base marker', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const startRefFrameCreationMatch = source.match(/function startRefFrameCreation\(\): void \{[\s\S]*?\n\}/);

  assert.ok(startRefFrameCreationMatch, 'expected to find startRefFrameCreation implementation');

  const startRefFrameCreationSource = startRefFrameCreationMatch[0];
  assert.match(startRefFrameCreationSource, /if \(createdMarkers\.length === 0\)/);
  assert.match(startRefFrameCreationSource, /Please create a basic marker first before creating a reference marker\./);
  assert.match(startRefFrameCreationSource, /pendingRefFrameBaseId\s*=\s*null/);
  assert.match(startRefFrameCreationSource, /pendingRefFrameTargetShapeId\s*=\s*null/);
  assert.match(startRefFrameCreationSource, /selectSelection\(null\)/);
  assert.match(startRefFrameCreationSource, /renderRefFrameCreationPanel\(\)/);
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

test('frame editing reuses hover inference while suppressing normal scene selection', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const startFrameEditModeForTargetMatch = source.match(/function startFrameEditModeForTarget\([\s\S]*?\n\}/);
  const handleCanvasPointerMoveMatch = source.match(/function handleCanvasPointerMove\(event: MouseEvent\): void \{[\s\S]*?\n\}/);

  assert.ok(startFrameEditModeForTargetMatch, 'expected to find startFrameEditModeForTarget implementation');
  assert.ok(handleCanvasPointerMoveMatch, 'expected to find handleCanvasPointerMove implementation');

  const startFrameEditModeForTargetSource = startFrameEditModeForTargetMatch[0];
  const handleCanvasPointerMoveSource = handleCanvasPointerMoveMatch[0];

  assert.match(startFrameEditModeForTargetSource, /viewer\?\.setSelectionEnabled\(false\)/);
  assert.match(handleCanvasPointerMoveSource, /canvasInteractionMode === 'editFrame' && editingFrameTarget !== null/);
  assert.match(handleCanvasPointerMoveSource, /viewer\?\.setMarkerGuide\(placement\.guide\)/);
  assert.match(handleCanvasPointerMoveSource, /if \(markerPlacementActive\) \{\s*showMarkerPreview/);
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

  assert.match(source, /if \(nodeData\.frameId\) \{\s*return \[\s*\{ label: '.*', action: 'deleteFrame' \}/);
});

test('reference marker fast mode auto-creates after selecting target part', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /if \(refFrameCreationMode === 'fast' && pendingRefFrameBaseId\) \{\s*createReferenceFrameFromSelection\(pendingRefFrameBaseId, selectedShapeId\);/);
});

test('reference marker standard mode validates base and target before confirm creation', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const renderRefFrameCreationPanelMatch = source.match(/function renderRefFrameCreationPanel\(\): void \{[\s\S]*?\n\}/);

  assert.ok(renderRefFrameCreationPanelMatch, 'expected to find renderRefFrameCreationPanel implementation');

  const panelSource = renderRefFrameCreationPanelMatch[0];
  assert.match(panelSource, /buildActionButtons\('opt-ref-confirm', '添加', 'opt-ref-cancel'\)/);
  assert.match(panelSource, /if \(!pendingRefFrameBaseId \|\| !pendingRefFrameTargetShapeId\)/);
  assert.match(panelSource, /createReferenceFrameFromSelection\(pendingRefFrameBaseId, pendingRefFrameTargetShapeId\)/);
});

test('reference marker panel asks users to pick the base marker from 3D selection', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const renderRefFrameCreationPanelMatch = source.match(/function renderRefFrameCreationPanel\(\): void \{[\s\S]*?\n\}/);

  assert.ok(renderRefFrameCreationPanelMatch, 'expected to find renderRefFrameCreationPanel implementation');

  const panelSource = renderRefFrameCreationPanelMatch[0];
  assert.match(panelSource, /当前基本标架：\$\{selectedBaseMarker\?\.name \?\? '\(未选择，请在三维中拾取标架\)'\}/);
  assert.doesNotMatch(panelSource, /id="opt-ref-base"/);
});

test('reference marker panel shows selected target part name', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const renderRefFrameCreationPanelMatch = source.match(/function renderRefFrameCreationPanel\(\): void \{[\s\S]*?\n\}/);

  assert.ok(renderRefFrameCreationPanelMatch, 'expected to find renderRefFrameCreationPanel implementation');

  const panelSource = renderRefFrameCreationPanelMatch[0];
  assert.match(panelSource, /目标零件：\$\{selectedTargetShape\?\.name \?\? '\(未选择\)'\}/);
});

test('reference marker target selection updates status info with selected part name', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /setStatusInfo\(`Target part selected: \$\{selectedTargetShape\.name\}`\)/);
});

test('reference marker creation keeps the options workflow active after validation failures', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const createReferenceFrameFromSelectionMatch = source.match(/function createReferenceFrameFromSelection\(baseMarkerId: string, targetShapeId: string\): boolean \{[\s\S]*?\n\}/);

  assert.ok(createReferenceFrameFromSelectionMatch, 'expected to find createReferenceFrameFromSelection implementation');

  const fnSource = createReferenceFrameFromSelectionMatch[0];
  assert.match(fnSource, /const restoreRefFrameCreationPanel = \(statusInfo\?: string\): void => \{/);
  assert.match(fnSource, /renderRefFrameCreationPanel\(\)/);
  assert.match(fnSource, /setStatus\('Select a basic marker and target part to create reference marker'\)/);
  assert.match(fnSource, /restoreRefFrameCreationPanel\(reason\)/);
});

test('reference marker name is aligned with the selected base marker name', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const createReferenceFrameFromSelectionMatch = source.match(/function createReferenceFrameFromSelection\(baseMarkerId: string, targetShapeId: string\): boolean \{[\s\S]*?\n\}/);

  assert.ok(createReferenceFrameFromSelectionMatch, 'expected to find createReferenceFrameFromSelection implementation');

  const fnSource = createReferenceFrameFromSelectionMatch[0];
  assert.match(fnSource, /name:\s*relatedMarker\.name/);
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

test('reference marker properties panel keeps core fields read-only and only edits visibility', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const renderRefFramePropertiesPanelMatch = source.match(/function renderRefFramePropertiesPanel\(refFrameId: string\): void \{[\s\S]*?\n\}/);

  assert.ok(renderRefFramePropertiesPanelMatch, 'expected to find renderRefFramePropertiesPanel implementation');

  const panelSource = renderRefFramePropertiesPanelMatch[0];
  assert.match(panelSource, /createPropertyRow\('名称', refFrame\.name, \{ boxed: true \}\)/);
  assert.match(panelSource, /createPropertyRow\('基本标架', relatedMarker\?\.name \?\? '\(none\)', \{ boxed: true \}\)/);
  assert.match(panelSource, /createPropertyRow\('宿主对象', frameOwnerDisplayName\(refFrame\.groupId\), \{ boxed: true \}\)/);
  assert.match(panelSource, /id="prop-ref-frame-visible"/);
  assert.doesNotMatch(panelSource, /buildNameInput\('prop-ref-frame-name'/);
  assert.doesNotMatch(panelSource, /buildVec3Input\('prop-ref-frame-/);
});

test('reference marker deletion detaches from base marker and clears entity map', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /if \(refFrame\.relatedMarkerId\) \{\s*const parentMarker = createdMarkers\.find\(\(marker\) => marker\.id === refFrame\.relatedMarkerId\);\s*parentMarker\?\.removeRefMarker\(refFrame\.id\);/);
  assert.match(source, /createdRefFrames\.delete\(refFrame\.id\);/);
});

test('mesh shading prefers front sided surfaces for stronger solid depth cues', async () => {
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');

  assert.match(viewerSource, /side: THREE\.FrontSide/);
});

test('frame visualizer adds a circular ring around the marker triad', async () => {
  const frameVisualizerSource = await readFile(new URL('../packages/three/src/FrameVisualizer.ts', import.meta.url), 'utf8');

  assert.match(frameVisualizerSource, /new THREE\.TorusGeometry\(/);
});

test('frame visualizer aligns the marker ring with the frame orientation', async () => {
  const frameVisualizerSource = await readFile(new URL('../packages/three/src/FrameVisualizer.ts', import.meta.url), 'utf8');

  assert.match(frameVisualizerSource, /const accentGroup = new THREE\.Group\(\);/);
  assert.match(frameVisualizerSource, /frameRotation\.makeBasis\(xAxis, yAxis, zAxis\);/);
  assert.match(frameVisualizerSource, /accentGroup\.setRotationFromMatrix\(frameRotation\);/);
  assert.match(frameVisualizerSource, /accentGroup\.add\(this\.createMarkerRing\(accentColor, length\)\);/);
  assert.match(frameVisualizerSource, /group\.add\(this\.createAxis\(xAxis, FrameVisualizer\.COLORS\.xAxis, length\)\);/);
  assert.match(frameVisualizerSource, /group\.add\(this\.createAxis\(yAxis, FrameVisualizer\.COLORS\.yAxis, length\)\);/);
  assert.match(frameVisualizerSource, /group\.add\(this\.createAxis\(zAxis, FrameVisualizer\.COLORS\.zAxis, length\)\);/);
});

test('frame selection uses dedicated accent colors instead of the generic pale highlight overlay', async () => {
  const frameVisualizerSource = await readFile(new URL('../packages/three/src/FrameVisualizer.ts', import.meta.url), 'utf8');
  const selectionManagerSource = await readFile(new URL('../packages/three/src/SelectionManager.ts', import.meta.url), 'utf8');
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');

  assert.match(frameVisualizerSource, /markerDefault:/);
  assert.match(frameVisualizerSource, /markerSelected:/);
  assert.match(frameVisualizerSource, /refFrameDefault:/);
  assert.match(frameVisualizerSource, /refFrameSelected:/);
  assert.match(frameVisualizerSource, /selectionAppearance:\s*'frame'/);
  assert.match(frameVisualizerSource, /frameSelected:\s*Boolean\(data\.selected\)/);
  assert.match(frameVisualizerSource, /setFrameSelected\(id: string, selected: boolean\): void/);
  assert.match(selectionManagerSource, /if \(object\.userData\.selectionAppearance === 'frame'\) \{\s*return;\s*\}/);
  assert.match(viewerSource, /this\.syncFrameSelectionVisuals\(\);/);
  assert.match(viewerSource, /this\.frameVisualizer\.setFrameSelected\(id, this\.selectionManager\?\.isSelected\(id\) \?\? false\);/);
});

test('marker face placement converts viewer rays through the shape transform', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');
  const resolveFacePlacementMatch = source.match(/function resolveFacePlacement\([\s\S]*?\n\}/);

  assert.ok(resolveFacePlacementMatch, 'expected to find resolveFacePlacement implementation');

  const resolveFacePlacementSource = resolveFacePlacementMatch[0];
  assert.match(resolveFacePlacementSource, /viewer\.getRayFromScreenPoint\(event\.clientX,\s*event\.clientY\)/);
  assert.match(resolveFacePlacementSource, /invertRigidTransform\(shapeTransform\)/);
  assert.match(resolveFacePlacementSource, /transformPoint\(\s*inverseShapeTransform,\s*ray\.origin\.x/);
  assert.match(resolveFacePlacementSource, /transformDirection\(\s*inverseShapeTransform,\s*ray\.direction\.x/);
  assert.match(resolveFacePlacementSource, /transformPoint\(\s*shapeTransform,\s*result\.position\.x/);
  assert.match(resolveFacePlacementSource, /transformDirection\(\s*shapeTransform,\s*result\.normal\.x/);
  assert.match(resolveFacePlacementSource, /const localSnapPoint = result\.snapPoint \?\? result\.inferredPosition;/);
  assert.match(resolveFacePlacementSource, /const worldSnapPoint = localSnapPoint/);
  assert.match(resolveFacePlacementSource, /const worldSnapDirection = localSnapDirection/);
  assert.match(viewerSource, /\(\(\(x - rect\.left\) \/ rect\.width\) \* 2\) - 1/);
  assert.match(viewerSource, /-\(\(\(y - rect\.top\) \/ rect\.height\) \* 2\) \+ 1/);
});

test('cad editor panel serves ribbon icons from svg assets', async () => {
  const panelSource = await readFile(new URL('../src/panels/CadEditorPanel.ts', import.meta.url), 'utf8');

  assert.match(panelSource, /joinPath\(extensionUri, 'public', 'icons', 'svg', '32'\)/);
  assert.doesNotMatch(panelSource, /\$\{icons32\}\/[a-z0-9_]+\.png/);
  assert.match(panelSource, /\$\{icons32\}\/cad_import\.svg/);
});

test('model tree icons resolve svg files instead of raster png files', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const panelSource = await readFile(new URL('../src/panels/CadEditorPanel.ts', import.meta.url), 'utf8');

  assert.match(panelSource, /joinPath\(extensionUri, 'public', 'icons', 'svg', '32'\)/);
  assert.match(panelSource, /window\.ICONS_32_BASE = "\$\{icons32\}";/);
  assert.match(source, /function toTreeIconsBase\(base: string\): string/);
  assert.ok(source.includes("return base.replace(/\\/(?:png|svg)\\/32$/i, '/svg/16');"));
  assert.match(source, /function resolveTreeIconsBase\(\): string \| null/);
  assert.ok(source.includes("fileName.replace(/\\.png$/i, '.svg')"));
  assert.match(source, /data-icons32-base/);
  assert.match(source, /case 'category_objects':\s*return treeIconPath\('model_tree_body_dir\.png'\)/);
  assert.match(source, /case 'category_connections':\s*return treeIconPath\('model_tree_connector_dir\.png'\)/);
  assert.match(source, /case 'category_motions':\s*return treeIconPath\('model_tree_motion_dir\.png'\)/);
  assert.match(source, /case 'category_forces':\s*return treeIconPath\('model_tree_force_dir\.png'\)/);
  assert.match(source, /case 'category_materials':\s*return treeIconPath\('model_tree_material_dir\.png'\)/);
});

test('orbit controls disable damping for immediate camera response', async () => {
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');

  assert.match(viewerSource, /this\.controls\.enableDamping = false;/);
  assert.doesNotMatch(viewerSource, /this\.controls\.enableDamping = true;/);
});

test('cad visual preset uses restrained neutral lighting instead of an overexposed showroom rig', async () => {
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');

  assert.match(viewerSource, /this\.renderer\.toneMappingExposure = 1\.02;/);
  assert.match(viewerSource, /this\.ambientLight = new THREE\.AmbientLight\(0xffffff, 0\.62\);/);
  assert.match(viewerSource, /this\.hemisphereLight = new THREE\.HemisphereLight\(0xf5f8fc, 0xa7afb8, 0\.58\);/);
  assert.match(viewerSource, /this\.keyLight = new THREE\.DirectionalLight\(0xffffff, 1\.02\);/);
  assert.match(viewerSource, /this\.fillLight = new THREE\.DirectionalLight\(0xf1f5fa, 0\.46\);/);
  assert.match(viewerSource, /this\.rimLight = new THREE\.DirectionalLight\(0xfaf3e4, 0\.28\);/);
  assert.match(viewerSource, /this\.topLight = new THREE\.DirectionalLight\(0xffffff, 0\.22\);/);
  assert.match(viewerSource, /this\.ambientLight\.intensity = 0\.74;/);
  assert.match(viewerSource, /this\.hemisphereLight\.intensity = 0\.54;/);
  assert.match(viewerSource, /this\.keyLight\.intensity = 1\.08;/);
  assert.match(viewerSource, /this\.fillLight\.intensity = 0\.42;/);
  assert.match(viewerSource, /this\.rimLight\.intensity = 0\.24;/);
  assert.match(viewerSource, /this\.topLight\.intensity = 0\.18;/);
  assert.doesNotMatch(viewerSource, /this\.renderer\.toneMappingExposure = 1\.34;/);
  assert.doesNotMatch(viewerSource, /this\.ambientLight\.intensity = 1\.08;/);
  assert.doesNotMatch(viewerSource, /this\.keyLight\.intensity = 1\.48;/);
});

test('step reader enables color transfer and resolves colors through referenced shapes', async () => {
  const geoBindingSource = await readFile(new URL('../packages/geo/cpp/src/geo/geo_binding.cpp', import.meta.url), 'utf8');

  assert.match(geoBindingSource, /reader\.SetColorMode\(Standard_True\);/);
  assert.match(geoBindingSource, /resolveReferenceTarget\(shapeTool, label, resolvedLabel\)/);
  assert.match(geoBindingSource, /TopoDS_Shape resolvedShape = shapeTool->GetShape\(resolvedLabel\);/);
});

test('cylindrical marker hover inference exposes explicit cylinder-axis snap metadata', async () => {
  const geoBindingSource = await readFile(new URL('../packages/geo/cpp/src/geo/geo_binding.cpp', import.meta.url), 'utf8');
  const geoTypesSource = await readFile(new URL('../packages/geo/src/types.ts', import.meta.url), 'utf8');
  const webviewSource = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');

  assert.match(geoBindingSource, /BRepAdaptor_Surface surface\(closestFace,\s*Standard_True\);/);
  assert.match(geoBindingSource, /const Standard_Real axisParameter = ElCLib::Parameter\(axisLine, closestPoint\);/);
  assert.match(geoBindingSource, /inferredPosition = ElCLib::Value\(axisParameter, axisLine\);/);
  assert.match(geoBindingSource, /snapKindName = "cylinder-axis";/);
  assert.match(geoBindingSource, /BRepTools::UVBounds\(closestFace,\s*uMin,\s*uMax,\s*vMin,\s*vMax\);/);
  assert.match(geoBindingSource, /result << ",\\"cylinderRadius\\":" << cylinderRadius;/);
  assert.match(geoBindingSource, /result << ",\\"snapKind\\":\\"" << snapKindName << "\\"";/);
  assert.match(geoTypesSource, /snapKind\?: 'cylinder-axis' \| 'sphere-center';/);
  assert.match(geoTypesSource, /snapPoint\?: Vec3;/);
  assert.match(geoTypesSource, /cylinderRadius\?: number;/);
  assert.match(geoTypesSource, /cylinderAxisStart\?: Vec3;/);
  assert.match(webviewSource, /snapKind = result\.snapKind/);
  assert.match(webviewSource, /if \(geometryHint\?\.snapKind === 'cylinder-axis'/);
  assert.match(webviewSource, /findNearestCircularEdge\(shape\.edgeData,\s*hitPosition/);
  assert.match(webviewSource, /kind: 'cylinder'/);
  assert.match(webviewSource, /viewer\?\.setMarkerGuide\(placement\.guide\)/);
  assert.match(viewerSource, /setMarkerGuide\(guide: MarkerGuideData \| null\)/);
  assert.match(viewerSource, /computeCylinderGuideGeometry\(/);
});

test('marker hover guide uses a higher-contrast overlay style', async () => {
  const viewerSource = await readFile(new URL('../packages/three/src/ThreeViewer.ts', import.meta.url), 'utf8');

  assert.match(viewerSource, /color:\s*0x00f5ff/);
  assert.match(viewerSource, /transparent:\s*true/);
  assert.match(viewerSource, /opacity:\s*0\.98/);
  assert.match(viewerSource, /depthTest:\s*false/);
  assert.match(viewerSource, /renderOrder = 6/);
});

test('step import normalizes low-information solid colors for clearer CAD presentation', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /function normalizeImportedDisplayColor\(/);
  assert.match(source, /CAD_BODY_DISPLAY_COLOR = '#D4A017'/);
  assert.match(source, /CAD_DARK_COMPONENT_COLOR = '#2B2B2B'/);
  assert.match(source, /CAD_LIGHT_METAL_COLOR = '#B8B8B8'/);
  assert.match(source, /normalizeImportedDisplayColor\(node\.name, node\.type, node\.color\)/);
});

test('model tree uses icon-based expand toggles and compact unified icon sizing', async () => {
  const panelSource = await readFile(new URL('../src/panels/CadEditorPanel.ts', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const expandIcon = await readFile(new URL('../public/icons/svg/16/model_tree_cad_expand.svg', import.meta.url), 'utf8');
  const collapseIcon = await readFile(new URL('../public/icons/svg/16/model_tree_cad_collapse.svg', import.meta.url), 'utf8');

  assert.match(panelSource, /\.tree-node \{\s*padding: 0 4px;/);
  assert.match(panelSource, /\.tree-node \{\s*[\s\S]*min-height: 18px;/);
  assert.match(panelSource, /\.tree-node \.icon \{\s*width: 13px;\s*height: 13px;/);
  assert.match(panelSource, /\.tree-node \.icon img \{\s*width: 13px;\s*height: 13px;/);
  assert.match(panelSource, /\.tree-node \.visibility-btn \{\s*width: 13px;\s*height: 13px;/);
  assert.match(panelSource, /\.tree-node \.visibility-btn img \{\s*width: 13px;\s*height: 13px;/);
  assert.match(panelSource, /\.tree-node \.expand-btn \{\s*width: 13px;\s*height: 13px;/);
  assert.match(panelSource, /\.tree-node \.expand-btn img \{\s*width: 11px;\s*height: 11px;/);
  assert.match(panelSource, /\.tree-node\.tree-node-category \.icon \{\s*width: 11px;\s*height: 11px;/);
  assert.match(panelSource, /\.tree-node\.tree-node-category \.icon img \{\s*width: 11px;\s*height: 11px;/);
  assert.doesNotMatch(panelSource, /\.tree-node \.expand-btn::before \{/);
  assert.match(panelSource, /\.tree-node \.expand-btn \{\s*[\s\S]*background-color: transparent;/);
  assert.match(panelSource, /\.tree-children \{\s*[\s\S]*border-left: 1px solid/);
  assert.match(panelSource, /\.tree-children \{\s*[\s\S]*margin-left: 0;/);
  assert.match(panelSource, /\.tree-children \{\s*[\s\S]*padding-left: 0;/);
  assert.match(source, /if \(nodeData\.kind === 'category'\) \{\s*node\.classList\.add\('tree-node-category'\);/);
  assert.match(source, /expandBtn\.dataset\.expanded = expanded \? 'true' : 'false';/);
  assert.match(source, /function expandIconPath\(expanded: boolean\): string \| null/);
  assert.match(source, /const iconPath = expandIconPath\(expanded\);/);
  assert.match(source, /const img = document\.createElement\('img'\);/);
  assert.match(source, /const TREE_NODE_INDENT_PX = 12;/);
  assert.match(source, /container\.style\.marginLeft = `\$\{Math\.max\(0, level\) \* TREE_NODE_INDENT_PX\}px`;/);
  assert.match(source, /setExpandButtonState\(expandBtn, expandedByDefault\);/);
  assert.match(source, /const expandedByDefault = nodeData\.kind === 'category';/);
  assert.doesNotMatch(expandIcon, /linearGradient|rect|polyline/i);
  assert.doesNotMatch(collapseIcon, /linearGradient|rect|polyline/i);
  assert.match(expandIcon, /<path[^>]+stroke="#64748B"/i);
  assert.match(collapseIcon, /<path[^>]+stroke="#64748B"/i);
});

test('imported tree wraps top-level single parts into a synthetic group node', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /function toImportedTreeNode\(/);
  assert.match(source, /const shouldWrapAsGroup = shape\.type === 'assembly' \|\| options\.wrapSinglePart;/);
  assert.match(source, /const wrappedLeafNodes = options\.wrapSinglePart \? \[toImportedLeafTreeNode\(shape, shape\.name\)\] : \[\];/);
  assert.match(source, /id: `import_group_\$\{shape\.id\}`,/);
  assert.match(source, /label: shape\.name,/);
});

test('single-part synthetic group disambiguates duplicate part labels with a suffix', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /const normalizedLabel = shape\.name === parentGroupName \? `\$\{shape\.name\}_1` : shape\.name;/);
});

test('motion and joint model tree nodes carry selection keys for direct selection', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /connectionsCategory\.children = Array\.from\(mbsJoints\.values\(\)\)\.map\(\(joint\) => \(\{[\s\S]*selectionKey: toJointSelectionKey\(joint\.id\)/);
  assert.match(source, /motionsCategory\.children = Array\.from\(mbsMotions\.values\(\)\)\.map\(\(motion\) => \(\{[\s\S]*selectionKey: toMotionSelectionKey\(motion\.id\)/);
});

test('motion options panel exposes fast standard creation modes and connector-driven controls', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const renderMotionOptionsPanelMatch = source.match(/function renderMotionOptionsPanel\(\): void \{[\s\S]*?\n\}/);

  assert.ok(renderMotionOptionsPanelMatch, 'expected to find renderMotionOptionsPanel implementation');

  const panelSource = renderMotionOptionsPanelMatch[0];
  assert.match(panelSource, /id="opt-motion-size"/);
  assert.match(panelSource, /id="opt-motion-size-range"/);
  assert.match(panelSource, /id="opt-motion-mode-fast"/);
  assert.match(panelSource, /id="opt-motion-mode-standard"/);
  assert.match(panelSource, /id="opt-motion-reset"/);
  assert.match(panelSource, /id="opt-motion-cancel"/);
  assert.match(panelSource, /opt-motion-add/);
  assert.match(panelSource, /请选择转动、移动或圆柱连接/);
  assert.match(panelSource, /支持 Alt \+ 鼠标滚轮快速调节图标大小/);
});

test('motion properties panel exposes editable drive fields while keeping the motion type read-only', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const renderMotionPropertiesPanelMatch = source.match(/function renderMotionPropertiesPanel\(motionId: string\): void \{[\s\S]*?\n\}/);

  assert.ok(renderMotionPropertiesPanelMatch, 'expected to find renderMotionPropertiesPanel implementation');

  const panelSource = renderMotionPropertiesPanelMatch[0];
  assert.match(panelSource, /buildNameInput\('prop-motion-name'/);
  assert.match(panelSource, /createPropertyRow\('类型', resolveMotionTypeLabel\(motion\.motionType\), \{ boxed: true \}\)/);
  assert.match(panelSource, /id="prop-motion-visible"/);
  assert.match(panelSource, /id="prop-motion-size"/);
  assert.match(panelSource, /prop-motion-drive-mode/);
  assert.match(panelSource, /id="prop-motion-phi"/);
  assert.match(panelSource, /id="prop-motion-w"/);
  assert.doesNotMatch(panelSource, /prop-motion-type/);
});

test('motion creation import and export persist drive-specific fields', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');
  const createMotionFromDraftMatch = source.match(/function createMotionFromDraft\(\): boolean \{[\s\S]*?\n\}/);

  assert.ok(createMotionFromDraftMatch, 'expected to find createMotionFromDraft implementation');

  const createMotionFromDraftSource = createMotionFromDraftMatch[0];
  assert.match(createMotionFromDraftSource, /driveMode: normalizeMotionDriveMode\(draft\.driveMode, draft\.motionType\)/);
  assert.match(createMotionFromDraftSource, /iconSize: Math\.max\(1, draft\.iconSize\)/);
  assert.match(createMotionFromDraftSource, /visible: draft\.visible/);
  assert.match(createMotionFromDraftSource, /phiStart: draft\.phiStart/);
  assert.match(createMotionFromDraftSource, /wStart: draft\.wStart/);
  assert.match(source, /toNonEmptyString\(entry\.driveMode\) \?\? toNonEmptyString\(entry\.functionType\)/);
  assert.match(source, /iconSize: typeof entry\.iconSize === 'number' && Number\.isFinite\(entry\.iconSize\) \? entry\.iconSize : pendingMotionIconSize/);
  assert.match(source, /visible: typeof entry\.visible === 'boolean'/);
  assert.match(source, /phiStart: typeof entry\.phiStart === 'number'/);
  assert.match(source, /wStart: typeof entry\.wStart === 'number'/);
  assert.match(source, /driveMode: motion\.driveMode/);
  assert.match(source, /iconSize: motion\.iconSize/);
  assert.match(source, /visible: motion\.visible/);
  assert.match(source, /phiStart: motion\.phiStart/);
  assert.match(source, /wStart: motion\.wStart/);
});

test('motion connector selection enforces joint compatibility for rotational and translational drives', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /function isMotionTypeCompatibleWithJoint\(motionType: MotionType, jointType: string\): boolean \{/);
  assert.match(source, /return normalized === 'revolute' \|\| normalized === 'cylindrical';/);
  assert.match(source, /return normalized === 'prismatic' \|\| normalized === 'cylindrical';/);
  assert.match(source, /if \(!isMotionTypeCompatibleWithJoint\(draft\.motionType, joint\.jointType\)\) \{/);
});

test('motion creation supports Alt plus mouse wheel icon sizing and delete key removal', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /const nextSize = updateMotionDraftSize\(pendingMotionIconSize \+ delta\);/);
  assert.match(source, /setStatusInfo\(`Motion icon size: \$\{nextSize\}`\);/);
  assert.match(source, /if \(\s*selectedNodeIds\.size === 0\s*\) \{\s*return;\s*\}/);
  assert.match(source, /handleMbsAction\('deleteSelection', \{\}\);/);
});

test('delete selection handles joints alongside motions contacts and design points', async () => {
  const source = await readFile(new URL('../src/webview/main.ts', import.meta.url), 'utf8');

  assert.match(source, /const selectedJointIds = getSelectedJointIds\(\);/);
  assert.match(source, /Select one or more design points, joints, motions, contacts, parts or groups first\./);
  assert.match(source, /selectedJointIds\.forEach\(\(jointId\) => \{\s*if \(deleteJointById\(jointId\)\) \{\s*deletedJointCount \+= 1;/);
  assert.match(source, /Deleted \$\{deletedDesignPointCount\} design point\(s\), \$\{deletedJointCount\} joint\(s\), \$\{deletedMotionCount\} motion\(s\), \$\{deletedContactCount\} contact\(s\), \$\{deletedPartCount\} part\(s\) and \$\{groupDeleteResult\.deletedCount\} group\(s\)\./);
});
