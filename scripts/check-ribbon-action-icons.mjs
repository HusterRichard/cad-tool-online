import fs from 'fs';
import path from 'path';

const TITLE_ID_SUFFIX_RE = /_(FT|GT|BT|CT|DRT|TT|ET|ST|DST)$/;
const GROUP_ID_RE = /_G_[A-Z]+$/;
const ACTION_SPLIT_RE = /\s{2,}|[\u3001,\uFF0C;\uFF1B|/\uFF5C]+/;

function parseArgs(argv) {
  const options = {
    file: 'cadtoolonline.pen',
    out: '',
    noFail: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file' && argv[i + 1]) {
      options.file = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--out' && argv[i + 1]) {
      options.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--no-fail') {
      options.noFail = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function walk(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') return;
  visitor(node, parent);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) {
    walk(child, visitor, node);
  }
}

function findById(node, id) {
  let found = null;
  walk(node, (cur) => {
    if (found) return;
    if (cur.id === id) found = cur;
  });
  return found;
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
  if (TITLE_ID_SUFFIX_RE.test(id)) return false;
  const size = Number(node.fontSize || 0);
  return size >= 15;
}

function isIconNode(node) {
  if (!node || node.type !== 'frame') return false;
  const id = String(node.id || '');
  return /(_ICON|_I\d+)$/.test(id);
}

function collectGroupReport(screenId, group) {
  const report = {
    screenId,
    groupId: group.id,
    groupTitle: '',
    structure: 'flat',
    actionCount: 0,
    iconCount: 0,
    actions: [],
    iconNodeIds: [],
    missingActions: []
  };

  const children = Array.isArray(group.children) ? group.children : [];
  const titleNode = children.find(
    (child) => child.type === 'text' && TITLE_ID_SUFFIX_RE.test(String(child.id || ''))
  );
  report.groupTitle = normalizeText(titleNode?.content || '');

  const rows = children.filter((child) => child.type === 'frame' && String(child.id || '').endsWith('_ROW'));
  if (rows.length > 0) {
    report.structure = 'row';
    for (const row of rows) {
      const rowChildren = Array.isArray(row.children) ? row.children : [];
      const rowTexts = rowChildren.filter((child) => isActionTextNode(child));
      const rowWords = rowTexts.flatMap((textNode) => splitActionWords(textNode.content));
      const rowIcons = rowChildren.filter((child) => isIconNode(child));
      report.actions.push(...rowWords);
      report.iconNodeIds.push(...rowIcons.map((icon) => icon.id));
      report.actionCount += rowWords.length;
      report.iconCount += rowIcons.length;
      if (rowWords.length > rowIcons.length) {
        report.missingActions.push(...rowWords.slice(rowIcons.length));
      }
    }
    return report;
  }

  const actionTextNodes = children.filter((child) => isActionTextNode(child));
  const actionWords = actionTextNodes.flatMap((textNode) => splitActionWords(textNode.content));
  report.actions.push(...actionWords);
  report.actionCount = actionWords.length;

  const iconContainer = children.find((child) => child.id === `${group.id}_ICONS`);
  const iconCandidates = [];
  if (iconContainer && Array.isArray(iconContainer.children)) {
    iconCandidates.push(...iconContainer.children.filter((child) => isIconNode(child)));
  }
  iconCandidates.push(
    ...children.filter(
      (child) => child.type === 'frame' && String(child.id || '').endsWith('_ICON')
    )
  );
  const uniqIconIds = [...new Set(iconCandidates.map((node) => node.id))];
  report.iconNodeIds.push(...uniqIconIds);
  report.iconCount = uniqIconIds.length;

  if (actionWords.length > report.iconCount) {
    report.missingActions.push(...actionWords.slice(report.iconCount));
  }
  return report;
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(options.file);
  const raw = fs.readFileSync(filePath, 'utf8');
  const pen = JSON.parse(raw);
  const screens = Array.isArray(pen.children) ? pen.children : [];

  const groupReports = [];
  for (const screen of screens) {
    const screenId = String(screen.id || '');
    if (!screenId.endsWith('_SCREEN')) continue;
    const prefix = screenId.slice(0, -'_SCREEN'.length);
    const ribbon = findById(screen, `${prefix}_RIBBON`);
    if (!ribbon || !Array.isArray(ribbon.children)) continue;

    for (const group of ribbon.children) {
      if (!group || group.type !== 'frame') continue;
      if (!GROUP_ID_RE.test(String(group.id || ''))) continue;
      groupReports.push(collectGroupReport(screenId, group));
    }
  }

  const summary = {
    groupCount: groupReports.length,
    actionCount: groupReports.reduce((acc, cur) => acc + cur.actionCount, 0),
    iconCount: groupReports.reduce((acc, cur) => acc + cur.iconCount, 0)
  };
  const missingDetails = groupReports
    .filter((item) => item.missingActions.length > 0)
    .map((item) => ({
      screenId: item.screenId,
      groupId: item.groupId,
      groupTitle: item.groupTitle,
      actionCount: item.actionCount,
      iconCount: item.iconCount,
      missingCount: item.missingActions.length,
      missingActions: item.missingActions,
      actionWords: item.actions,
      iconNodeIds: item.iconNodeIds
    }));

  const output = {
    ruleId: 'RIBBON_ACTION_ICON_COVERAGE',
    generatedAt: new Date().toISOString(),
    filePath,
    summary: {
      ...summary,
      missingGroupCount: missingDetails.length,
      missingActionCount: missingDetails.reduce((acc, cur) => acc + cur.missingCount, 0),
      pass: missingDetails.length === 0
    },
    missingDetails
  };

  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!options.noFail && !output.summary.pass) {
    process.exitCode = 2;
  }
}

run();
