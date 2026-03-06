import fs from 'fs';

const PEN_PATH = 'cadtoolonline.pen';
const REPORT_PATH = 'docs/outputs/RIBBON_ICON_PRODUCTIZATION_2026-03-06.md';

const GROUP_ID_RE = /_G_[A-Z]+$/;
const GROUP_TITLE_ID_SUFFIX_RE = /_(FT|GT|BT|CT|DRT|TT|ET|ST|DST)$/;
const ROW_ID_RE = /_ROW$/;
const ICON_NODE_ID_RE = /(_ICON|_I\d+)$/;
const ACTION_SPLIT_RE = /\s{2,}|[\u3001,\uFF0C;\uFF1B|/\uFF5C]+/;

const GROUP_LABELS = new Set([
  '\u6587\u4ef6',
  '\u5206\u7ec4',
  '\u57fa\u672c\u5f62\u72b6',
  '\u8fde\u63a5',
  '\u9a71\u52a8',
  '\u5de5\u5177',
  '\u5bfc\u51fa',
  '\u5207\u7247',
  '\u8bbe\u8ba1'
]);

const ACTION_TO_SEMANTIC = {
  '\u5bfc\u5165': 'import',
  '\u6253\u5f00': 'open',
  '\u4fdd\u5b58': 'save',
  '\u53e6\u5b58\u4e3a': 'save_as',
  '\u7ec4\u5408': 'group_merge',
  '\u5206\u89e3': 'group_split',
  '\u6e05\u7406': 'group_clean',
  '\u9ed8\u8ba4\u5206\u7ec4': 'group_default',
  '\u6807\u67b6': 'marker',
  '\u8bbe\u8ba1\u70b9': 'design_point',
  '\u56fa\u5b9a\u526f': 'joint_fixed',
  '\u8f6c\u52a8\u526f': 'joint_revolute',
  '\u5e73\u79fb\u526f': 'joint_prismatic',
  '\u5706\u67f1\u526f': 'joint_cylindrical',
  '\u7403\u526f': 'joint_spherical',
  '\u4e07\u5411\u8282': 'joint_universal',
  '\u87ba\u65cb\u526f': 'joint_screw',
  '\u5e73\u9762\u526f': 'joint_planar',
  '\u8f6c\u52a8\u9a71\u52a8': 'drive_rotational',
  '\u5e73\u79fb\u9a71\u52a8': 'drive_translational',
  '\u6d4b\u91cf': 'tool_measure',
  '\u7206\u70b8\u89c6\u56fe': 'tool_exploded',
  '\u66f2\u9762\u52a0\u539a': 'tool_thicken',
  '\u5e73\u9762\u73af\u5904\u7406': 'tool_planar_loop',
  '\u68c0\u67e5': 'export_check',
  '\u63a5\u53d7\u5e76\u9000\u51fa': 'export_accept_exit',
  '\u7b80\u5355\u6cb9\u7bb1': 'slice_simple_tank',
  '\u6cb9\u7bb1': 'slice_tank',
  '\u808b\u677f': 'slice_rib',
  '\u7aef\u53e3': 'design_port'
};

const DEFAULT_SEMANTIC_BY_KEY = {
  FILE: 'open',
  GROUP: 'group_merge',
  BASIC: 'marker',
  CONNECT: 'joint_revolute',
  DRIVE: 'drive_rotational',
  TOOL: 'tool_measure',
  EXPORT: 'export_check',
  SLICE: 'slice_tank',
  DESIGN: 'design_port'
};

const SEMANTIC_TO_SRC = {
  import: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/ImportCAD/ImportNeutralCAD/import_cad_model.png',
  open: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/ToolBoxEntry/toolbox_entry.png',
  save: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/SaveModel/save_file.png',
  save_as: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/SaveModel/save_as_dialog.png',
  group_merge: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/GroupParts/group_parts.png',
  group_split: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/GroupParts/ungroup.png',
  group_clean: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/GroupParts/del_empty_group.png',
  group_default: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/GroupParts/default_group.png',
  marker: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildMarkers/add_marker.png',
  design_point: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/AddDesignPoint/add_design_point_pick_mode.png',
  joint_fixed: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildConnectors/add_connector.png',
  joint_revolute: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildConnectors/add_connector.png',
  joint_prismatic: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildConnectors/add_connector_flash.png',
  joint_cylindrical: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildConnectors/add_connector_flash.png',
  joint_spherical: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildConnectors/add_connector.png',
  joint_universal: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildConnectors/universal_dir_1.png',
  joint_screw: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildConnectors/add_connector_flash.png',
  joint_planar: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildConnectors/add_connector.png',
  drive_rotational: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildMotions/add_motion.png',
  drive_translational: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/BuildMotions/add_motion_flash.png',
  tool_measure: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/Measure/measure_pnt.png',
  tool_exploded: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/ExplodedView/entrance.png',
  tool_thicken: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/SurfaceThickening/thicken.png',
  tool_planar_loop: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/PlanarLoopConstrains/tool_entrance.png',
  export_check: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/ToModelicaModel/build_mo_model.png',
  export_accept_exit: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/ManageCADFiles/manage_cad_files.png',
  slice_simple_tank: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/Tank/simpletank.png',
  slice_tank: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/Tank/Tank.png',
  slice_rib: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/Tank/rib.png',
  design_port: 'ref/Docs/CADToolBox/CADToolBox/HowToUse/Tank/port.png'
};

const STYLE_BY_SEMANTIC = {
  import: { bg: '#E0F2FE', p: '#0284C7', a: '#0EA5E9', glyph: 'doc' },
  open: { bg: '#DBEAFE', p: '#2563EB', a: '#60A5FA', glyph: 'folder' },
  save: { bg: '#DCFCE7', p: '#059669', a: '#10B981', glyph: 'disk' },
  save_as: { bg: '#CCFBF1', p: '#0F766E', a: '#14B8A6', glyph: 'disk_plus' },
  group_merge: { bg: '#E0F2FE', p: '#0369A1', a: '#0284C7', glyph: 'merge' },
  group_split: { bg: '#FCE7F3', p: '#BE185D', a: '#EC4899', glyph: 'split' },
  group_clean: { bg: '#FEF3C7', p: '#B45309', a: '#F59E0B', glyph: 'clean' },
  group_default: { bg: '#EDE9FE', p: '#6D28D9', a: '#8B5CF6', glyph: 'default' },
  marker: { bg: '#DCFCE7', p: '#15803D', a: '#22C55E', glyph: 'cross' },
  design_point: { bg: '#ECFEFF', p: '#0E7490', a: '#06B6D4', glyph: 'point' },
  joint_fixed: { bg: '#EDE9FE', p: '#6D28D9', a: '#8B5CF6', glyph: 'link' },
  joint_revolute: { bg: '#F5F3FF', p: '#5B21B6', a: '#A78BFA', glyph: 'link' },
  joint_prismatic: { bg: '#EEF2FF', p: '#4338CA', a: '#6366F1', glyph: 'slide' },
  joint_cylindrical: { bg: '#EEF2FF', p: '#3730A3', a: '#6366F1', glyph: 'cyl' },
  joint_spherical: { bg: '#F3E8FF', p: '#7E22CE', a: '#C084FC', glyph: 'sphere' },
  joint_universal: { bg: '#F3E8FF', p: '#7C3AED', a: '#A855F7', glyph: 'cross' },
  joint_screw: { bg: '#F5F3FF', p: '#6D28D9', a: '#A78BFA', glyph: 'screw' },
  joint_planar: { bg: '#F5F3FF', p: '#4C1D95', a: '#8B5CF6', glyph: 'plane' },
  drive_rotational: { bg: '#FEE2E2', p: '#B91C1C', a: '#EF4444', glyph: 'rot' },
  drive_translational: { bg: '#FEE2E2', p: '#991B1B', a: '#F87171', glyph: 'lin' },
  tool_measure: { bg: '#FEF3C7', p: '#B45309', a: '#F59E0B', glyph: 'ruler' },
  tool_exploded: { bg: '#FFEDD5', p: '#C2410C', a: '#FB923C', glyph: 'explode' },
  tool_thicken: { bg: '#FEF9C3', p: '#A16207', a: '#EAB308', glyph: 'stack' },
  tool_planar_loop: { bg: '#FEF3C7', p: '#92400E', a: '#F59E0B', glyph: 'loop' },
  export_check: { bg: '#E5E7EB', p: '#374151', a: '#6B7280', glyph: 'check' },
  export_accept_exit: { bg: '#E2E8F0', p: '#334155', a: '#64748B', glyph: 'exit' },
  slice_simple_tank: { bg: '#CCFBF1', p: '#0F766E', a: '#14B8A6', glyph: 'layers' },
  slice_tank: { bg: '#CCFBF1', p: '#0F766E', a: '#2DD4BF', glyph: 'tank' },
  slice_rib: { bg: '#CCFBF1', p: '#115E59', a: '#14B8A6', glyph: 'rib' },
  design_port: { bg: '#F3E8FF', p: '#7E22CE', a: '#C084FC', glyph: 'port' }
};

function rect(id, x, y, width, height, fill, cornerRadius = 0) {
  const node = { type: 'frame', id, x, y, width, height, fill };
  if (cornerRadius > 0) node.cornerRadius = cornerRadius;
  return node;
}

function glyphChildren(iconId, glyphType, primary, accent) {
  const white = '#FFFFFF';
  switch (glyphType) {
    case 'doc':
      return [
        rect(`${iconId}_S1`, 3, 2, 9, 12, primary, 1),
        rect(`${iconId}_S2`, 9, 2, 3, 3, accent, 0),
        rect(`${iconId}_S3`, 6, 9, 3, 5, white, 0)
      ];
    case 'folder':
      return [
        rect(`${iconId}_S1`, 2, 6, 14, 8, primary, 2),
        rect(`${iconId}_S2`, 4, 4, 6, 3, accent, 1),
        rect(`${iconId}_S3`, 5, 8, 9, 3, white, 1)
      ];
    case 'disk':
    case 'disk_plus':
      return [
        rect(`${iconId}_S1`, 3, 3, 12, 12, primary, 2),
        rect(`${iconId}_S2`, 6, 4, 6, 3, accent, 1),
        rect(`${iconId}_S3`, 6, 10, 6, 4, white, 0),
        ...(glyphType === 'disk_plus'
          ? [rect(`${iconId}_S4`, 11, 10, 4, 4, accent, 2), rect(`${iconId}_S5`, 12, 11, 2, 2, white, 0)]
          : [])
      ];
    case 'merge':
      return [
        rect(`${iconId}_S1`, 3, 3, 4, 4, primary, 1),
        rect(`${iconId}_S2`, 11, 3, 4, 4, primary, 1),
        rect(`${iconId}_S3`, 7, 11, 4, 4, accent, 1),
        rect(`${iconId}_S4`, 8, 7, 2, 4, white, 0)
      ];
    case 'split':
      return [
        rect(`${iconId}_S1`, 7, 3, 4, 4, primary, 1),
        rect(`${iconId}_S2`, 3, 11, 4, 4, accent, 1),
        rect(`${iconId}_S3`, 11, 11, 4, 4, accent, 1),
        rect(`${iconId}_S4`, 6, 10, 6, 1, white, 0)
      ];
    case 'link':
      return [
        rect(`${iconId}_S1`, 2, 5, 6, 8, primary, 3),
        rect(`${iconId}_S2`, 10, 5, 6, 8, primary, 3),
        rect(`${iconId}_S3`, 7, 7, 4, 4, accent, 1),
        rect(`${iconId}_S4`, 8, 8, 2, 2, white, 0)
      ];
    case 'slide':
    case 'lin':
      return [
        rect(`${iconId}_S1`, 3, 8, 10, 2, primary, 1),
        rect(`${iconId}_S2`, 11, 7, 4, 4, accent, 1),
        rect(`${iconId}_S3`, 12, 8, 2, 2, white, 0)
      ];
    case 'rot':
      return [
        rect(`${iconId}_S1`, 3, 8, 8, 2, primary, 1),
        rect(`${iconId}_S2`, 10, 6, 4, 6, accent, 2),
        rect(`${iconId}_S3`, 12, 8, 2, 2, white, 0)
      ];
    case 'ruler':
      return [
        rect(`${iconId}_S1`, 3, 10, 12, 3, primary, 1),
        rect(`${iconId}_S2`, 4, 7, 2, 3, accent, 0),
        rect(`${iconId}_S3`, 8, 7, 2, 3, accent, 0),
        rect(`${iconId}_S4`, 12, 7, 2, 3, accent, 0)
      ];
    case 'explode':
      return [
        rect(`${iconId}_S1`, 2, 2, 5, 5, primary, 1),
        rect(`${iconId}_S2`, 11, 2, 5, 5, accent, 1),
        rect(`${iconId}_S3`, 2, 11, 5, 5, accent, 1),
        rect(`${iconId}_S4`, 11, 11, 5, 5, primary, 1)
      ];
    case 'stack':
    case 'layers':
      return [
        rect(`${iconId}_S1`, 3, 4, 12, 3, primary, 1),
        rect(`${iconId}_S2`, 4, 8, 10, 3, accent, 1),
        rect(`${iconId}_S3`, 5, 12, 8, 3, primary, 1)
      ];
    case 'check':
      return [
        rect(`${iconId}_S1`, 3, 6, 8, 8, primary, 1),
        rect(`${iconId}_S2`, 10, 3, 5, 5, accent, 1),
        rect(`${iconId}_S3`, 11, 11, 4, 2, white, 0)
      ];
    case 'exit':
      return [
        rect(`${iconId}_S1`, 3, 5, 8, 8, primary, 1),
        rect(`${iconId}_S2`, 10, 7, 5, 4, accent, 1),
        rect(`${iconId}_S3`, 13, 6, 2, 6, white, 0)
      ];
    case 'cyl':
      return [
        rect(`${iconId}_S1`, 3, 5, 12, 8, primary, 4),
        rect(`${iconId}_S2`, 6, 7, 6, 4, accent, 2)
      ];
    case 'sphere':
      return [
        rect(`${iconId}_S1`, 4, 4, 10, 10, primary, 5),
        rect(`${iconId}_S2`, 7, 7, 4, 4, accent, 2)
      ];
    case 'screw':
      return [
        rect(`${iconId}_S1`, 4, 4, 10, 10, primary, 2),
        rect(`${iconId}_S2`, 5, 6, 8, 1, accent, 0),
        rect(`${iconId}_S3`, 5, 9, 8, 1, accent, 0),
        rect(`${iconId}_S4`, 5, 12, 8, 1, accent, 0)
      ];
    case 'plane':
      return [
        rect(`${iconId}_S1`, 3, 6, 12, 8, primary, 1),
        rect(`${iconId}_S2`, 5, 4, 8, 2, accent, 1),
        rect(`${iconId}_S3`, 6, 9, 6, 3, white, 0)
      ];
    case 'loop':
      return [
        rect(`${iconId}_S1`, 4, 4, 10, 10, primary, 5),
        rect(`${iconId}_S2`, 6, 6, 6, 6, white, 3),
        rect(`${iconId}_S3`, 10, 3, 4, 3, accent, 1)
      ];
    case 'tank':
      return [
        rect(`${iconId}_S1`, 3, 3, 12, 12, primary, 3),
        rect(`${iconId}_S2`, 5, 7, 8, 1, accent, 0),
        rect(`${iconId}_S3`, 5, 10, 8, 1, accent, 0)
      ];
    case 'rib':
      return [
        rect(`${iconId}_S1`, 3, 3, 12, 12, primary, 2),
        rect(`${iconId}_S2`, 6, 3, 1, 12, accent, 0),
        rect(`${iconId}_S3`, 10, 3, 1, 12, accent, 0)
      ];
    case 'point':
      return [
        rect(`${iconId}_S1`, 3, 8, 12, 2, primary, 1),
        rect(`${iconId}_S2`, 8, 3, 2, 12, primary, 1),
        rect(`${iconId}_S3`, 6, 6, 6, 6, accent, 3)
      ];
    case 'port':
      return [
        rect(`${iconId}_S1`, 7, 7, 4, 4, primary, 2),
        rect(`${iconId}_S2`, 9, 3, 1, 4, accent, 0),
        rect(`${iconId}_S3`, 11, 9, 4, 1, accent, 0),
        rect(`${iconId}_S4`, 9, 11, 1, 4, accent, 0)
      ];
    case 'cross':
      return [
        rect(`${iconId}_S1`, 8, 2, 2, 14, primary, 1),
        rect(`${iconId}_S2`, 2, 8, 14, 2, primary, 1),
        rect(`${iconId}_S3`, 7, 7, 4, 4, accent, 1)
      ];
    case 'clean':
      return [
        rect(`${iconId}_S1`, 3, 11, 12, 3, primary, 1),
        rect(`${iconId}_S2`, 5, 6, 8, 4, accent, 1),
        rect(`${iconId}_S3`, 12, 4, 3, 2, primary, 0)
      ];
    case 'default':
      return [
        rect(`${iconId}_S1`, 4, 4, 10, 10, primary, 2),
        rect(`${iconId}_S2`, 7, 7, 4, 4, white, 1),
        rect(`${iconId}_S3`, 2, 2, 4, 4, accent, 1)
      ];
    default:
      return [
        rect(`${iconId}_S1`, 4, 4, 10, 10, primary, 2),
        rect(`${iconId}_S2`, 6, 6, 6, 6, accent, 1)
      ];
  }
}

function groupKeyById(id) {
  const match = String(id || '').match(/_G_([A-Z]+)$/);
  return match ? match[1] : null;
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitActionWords(text) {
  const raw = String(text || '')
    .replace(/\u3000/g, ' ')
    .trim();
  if (!raw) return [];
  if (!ACTION_SPLIT_RE.test(raw)) return [normalizeText(raw)];
  return raw
    .split(ACTION_SPLIT_RE)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function isActionTextNode(node) {
  if (!node || node.type !== 'text') return false;
  const id = String(node.id || '');
  if (GROUP_TITLE_ID_SUFFIX_RE.test(id)) return false;
  return Number(node.fontSize || 0) >= 15;
}

function isIconNode(node) {
  if (!node || node.type !== 'frame') return false;
  return ICON_NODE_ID_RE.test(String(node.id || ''));
}

function actionsFromTextNodes(textNodes) {
  return textNodes
    .flatMap((textNode) => splitActionWords(textNode.content))
    .filter((word) => !GROUP_LABELS.has(word));
}

function resolveSemantic(action, key, missingActionMap) {
  const semantic = ACTION_TO_SEMANTIC[action] || DEFAULT_SEMANTIC_BY_KEY[key] || 'open';
  if (!ACTION_TO_SEMANTIC[action]) {
    missingActionMap.set(action, (missingActionMap.get(action) || 0) + 1);
  }
  return semantic;
}

function createIcon(iconId, semantic, action) {
  const style = STYLE_BY_SEMANTIC[semantic] || STYLE_BY_SEMANTIC.open;
  const src = SEMANTIC_TO_SRC[semantic] || SEMANTIC_TO_SRC.open;
  return {
    type: 'frame',
    id: iconId,
    name: `ICON:${action}|SEM:${semantic}|SRC:${src}`,
    width: 18,
    height: 18,
    fill: style.bg,
    cornerRadius: 4,
    children: glyphChildren(iconId, style.glyph, style.p, style.a)
  };
}

function buildActionIcons(actions, key, baseId, missingActionMap) {
  return actions.map((action, idx) => {
    const semantic = resolveSemantic(action, key, missingActionMap);
    return createIcon(`${baseId}_I${idx + 1}`, semantic, action);
  });
}

function processRowGroup(group, key, missingActionMap) {
  let actionCount = 0;
  let iconCount = 0;

  const children = Array.isArray(group.children) ? group.children : [];
  const rows = children.filter((child) => child.type === 'frame' && ROW_ID_RE.test(String(child.id || '')));

  group.children = children.filter(
    (child) => !(child.type === 'frame' && String(child.id || '').endsWith('_ICONS') && !ROW_ID_RE.test(String(child.id || '')))
  );

  for (const row of rows) {
    const rowChildren = Array.isArray(row.children) ? row.children : [];
    const actionTextNodes = rowChildren.filter((child) => isActionTextNode(child));
    const actions = actionsFromTextNodes(actionTextNodes);
    actionCount += actions.length;

    const icons = buildActionIcons(actions, key, row.id, missingActionMap);
    iconCount += icons.length;

    const nonIconChildren = rowChildren.filter((child) => !isIconNode(child));
    const firstActionTextIdx = nonIconChildren.findIndex((child) => isActionTextNode(child));

    row.layout = 'horizontal';
    row.gap = 6;
    if (typeof row.height !== 'number' || row.height < 20) row.height = 20;

    if (firstActionTextIdx === -1) {
      row.children = [...icons, ...nonIconChildren];
    } else {
      row.children = [
        ...nonIconChildren.slice(0, firstActionTextIdx),
        ...icons,
        ...nonIconChildren.slice(firstActionTextIdx)
      ];
    }
  }

  return { actionCount, iconCount };
}

function processFlatGroup(group, key, missingActionMap) {
  const children = Array.isArray(group.children) ? group.children : [];
  const actionTextNodes = children.filter((child) => isActionTextNode(child));
  const actions = actionsFromTextNodes(actionTextNodes);

  const icons = buildActionIcons(actions, key, `${group.id}_ICONS`, missingActionMap);

  const iconContainerId = `${group.id}_ICONS`;
  const existingIconContainer = children.find(
    (child) => child.type === 'frame' && (child.id === iconContainerId || String(child.name || '').startsWith('ICON_SET:'))
  );

  const iconContainer = existingIconContainer || { type: 'frame', id: iconContainerId };
  iconContainer.name = `ICON_SET:${key}`;
  iconContainer.width = 'fill_container';
  iconContainer.height = 20;
  iconContainer.layout = 'horizontal';
  iconContainer.gap = 4;
  iconContainer.children = icons;

  const filtered = children.filter((child) => {
    if (child === existingIconContainer) return false;
    if (child.type === 'frame' && String(child.name || '').startsWith('ICON_SET:')) return false;
    return !isIconNode(child);
  });

  const firstActionTextIdx = filtered.findIndex((child) => isActionTextNode(child));
  if (firstActionTextIdx === -1) {
    group.children = [iconContainer, ...filtered];
  } else {
    group.children = [
      ...filtered.slice(0, firstActionTextIdx),
      iconContainer,
      ...filtered.slice(firstActionTextIdx)
    ];
  }

  return { actionCount: actions.length, iconCount: icons.length };
}

const pen = JSON.parse(fs.readFileSync(PEN_PATH, 'utf8'));

let groups = 0;
let actionCount = 0;
let iconCount = 0;
const missingActionMap = new Map();

const stack = [pen];
while (stack.length > 0) {
  const node = stack.pop();
  if (!node || typeof node !== 'object') continue;

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      stack.push(child);
    }
  }

  if (node.type !== 'frame') continue;
  const groupId = String(node.id || '');
  if (!GROUP_ID_RE.test(groupId)) continue;

  const key = groupKeyById(groupId);
  if (!key || !DEFAULT_SEMANTIC_BY_KEY[key]) continue;

  groups += 1;
  const rows = (node.children || []).filter((child) => child.type === 'frame' && ROW_ID_RE.test(String(child.id || '')));

  if (rows.length > 0) {
    const stats = processRowGroup(node, key, missingActionMap);
    actionCount += stats.actionCount;
    iconCount += stats.iconCount;
    continue;
  }

  const stats = processFlatGroup(node, key, missingActionMap);
  actionCount += stats.actionCount;
  iconCount += stats.iconCount;
}

fs.writeFileSync(PEN_PATH, `${JSON.stringify(pen, null, 2)}\n`, 'utf8');

const missingRows = [...missingActionMap.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([action, count]) => `| ${action} | ${count} |`)
  .join('\n');

const semanticRows = Object.entries(SEMANTIC_TO_SRC)
  .map(([semantic, src]) => `| ${semantic} | \`${src}\` |`)
  .join('\n');

const md = `# Ribbon Icon Productization (Stage 5)\n\n- Date: 2026-03-06\n- Groups processed: ${groups}\n- Action items parsed: ${actionCount}\n- Icons generated: ${iconCount}\n- Rule: one actionable menu item -> one icon node\n\n## Semantic Source Mapping\n| Semantic | Source |\n|---|---|\n${semanticRows}\n\n## Unmapped Actions (Fallback Applied)\n| Action | Count |\n|---|---:|\n${missingRows || '| (none) | 0 |'}\n`;

fs.mkdirSync('docs/outputs', { recursive: true });
fs.writeFileSync(REPORT_PATH, `${md}\n`, 'utf8');

console.log(`Productized icons generated. groups=${groups}, actions=${actionCount}, icons=${iconCount}`);
