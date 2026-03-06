import fs from 'fs';

const pageDataPath = 'ref/Docs/CADToolBox/pageData/page-data-list.json';
const penPath = 'cadtoolonline.pen';
const prdPath = 'docs/outputs/PRD_VSCode_CADTool_Autocomplete_2026a.md';

const pages = JSON.parse(fs.readFileSync(pageDataPath, 'utf8'));
const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function remapIds(node, oldPrefix, newPrefix) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.id === 'string' && node.id.startsWith(oldPrefix + '_')) {
    node.id = newPrefix + node.id.slice(oldPrefix.length);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) remapIds(child, oldPrefix, newPrefix);
  }
}

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  if (!Array.isArray(node.children)) return null;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function setText(screen, id, content) {
  const node = findNode(screen, id);
  if (node && node.type === 'text') {
    node.content = content;
  }
}

function makeText(id, content, size = 14, fill = '#111827', weight) {
  const n = {
    type: 'text',
    id,
    content,
    fontFamily: 'Microsoft YaHei',
    fontSize: size,
    fill
  };
  if (weight) n.fontWeight = weight;
  return n;
}

function clip(s, n = 44) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + '…';
}

function unique(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    if (!item) continue;
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function extractHeadings(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return unique(
    lines
      .filter((s) => s.startsWith('#'))
      .map((s) => s.replace(/^#+\s*/, '').trim())
      .filter(Boolean)
  );
}

function extractSteps(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return unique(
    lines
      .filter((s) => /^\d+\s*[\.、]/.test(s))
      .map((s) => s.replace(/\s+/g, ' ').trim())
  );
}

function replaceTree(screen, prefix, lines) {
  const left = findNode(screen, `${prefix}_LEFT`);
  if (!left) return;

  let tree = findNode(screen, `${prefix}_TREE`);
  if (!tree) {
    tree = {
      type: 'frame',
      id: `${prefix}_TREE`,
      width: 'fill_container',
      height: 'fill_container',
      fill: '#F5F5F5',
      layout: 'vertical',
      padding: [6, 8],
      gap: 4,
      children: []
    };
    if (!Array.isArray(left.children)) left.children = [];
    left.children.push(tree);
  }

  tree.children = lines.map((line, i) =>
    makeText(`${prefix}_TR${i + 1}`, clip(line, 40), 15, '#111827')
  );
}

function replaceRightBody(screen, prefix, lines) {
  const right = findNode(screen, `${prefix}_RIGHT`);
  if (!right) return;
  if (!Array.isArray(right.children)) right.children = [];

  right.children = right.children.filter((c) => c.id === `${prefix}_RIGHT_H`);
  right.children.push({
    type: 'frame',
    id: `${prefix}_RIGHT_BODY`,
    width: 'fill_container',
    height: 'fill_container',
    fill: '#F6F6F6',
    layout: 'vertical',
    padding: [8, 8],
    gap: 6,
    children: lines.map((line, i) =>
      makeText(`${prefix}_RP${i + 1}`, clip(line, 56), 13, '#1F2937')
    )
  });
}

function setPopup(screen, prefix, title, lines) {
  const popup = findNode(screen, `${prefix}_POPUP`);
  if (!popup) return;

  if (!title || !lines.length) {
    popup.height = 0;
    popup.children = [];
    return;
  }

  const clipped = lines.map((x) => clip(x, 62)).slice(0, 3);
  popup.height = 88 + Math.max(0, clipped.length - 2) * 18;
  popup.children = [
    makeText(`${prefix}_POP_T`, title, 14, '#374151', '700'),
    ...clipped.map((line, i) =>
      makeText(`${prefix}_POP_${i + 1}`, line, 14, '#111827')
    )
  ];
}

function iconColorForGroupId(groupId = '') {
  const id = String(groupId).toUpperCase();
  if (id.includes('FILE')) return '#2563EB';
  if (id.includes('GROUP')) return '#059669';
  if (id.includes('BASIC')) return '#7C3AED';
  if (id.includes('CONNECT')) return '#DC2626';
  if (id.includes('DRIVE')) return '#EA580C';
  if (id.includes('SLICE')) return '#0284C7';
  if (id.includes('DESIGN')) return '#B45309';
  if (id.includes('TOOL')) return '#0891B2';
  if (id.includes('EXPORT')) return '#4B5563';
  return '#6B7280';
}

function decorateRibbonWithIcons(screen, prefix) {
  const ribbon = findNode(screen, `${prefix}_RIBBON`);
  if (!ribbon || !Array.isArray(ribbon.children)) return;

  for (const group of ribbon.children) {
    if (!group || group.type !== 'frame') continue;
    if (!group.id || !group.id.includes('_G_')) continue;
    if (!Array.isArray(group.children)) continue;

    const color = iconColorForGroupId(group.id);
    const rebuilt = [];

    for (const child of group.children) {
      // Keep section title text and non-text nodes unchanged.
      if (
        !child ||
        child.type !== 'text' ||
        Number(child.fontSize) < 15 ||
        String(child.id || '').endsWith('_T')
      ) {
        rebuilt.push(child);
        continue;
      }

      const row = {
        type: 'frame',
        id: `${child.id}_ROW`,
        width: 'fill_container',
        height: 18,
        layout: 'horizontal',
        gap: 6,
        children: [
          {
            type: 'frame',
            id: `${child.id}_ICON`,
            width: 12,
            height: 12,
            fill: color
          },
          child
        ]
      };
      rebuilt.push(row);
    }

    group.children = rebuilt;
  }
}

function chooseModule(page) {
  if (Array.isArray(page.breadcrumb) && page.breadcrumb.length >= 3) {
    return page.breadcrumb[2].title || '其它';
  }
  if (String(page.path || '').includes('/FAQ/')) return 'FAQ/错误码';
  return '其它';
}

function chooseTemplate(module, path) {
  if (String(module).includes('流体')) return 'FL';
  if (/(Fluid|Slice|Rib|Tank|Port)/i.test(path)) return 'FL';
  return 'MB';
}

const howToPages = pages.filter(
  (p) =>
    String(p.path).startsWith('/Doc/CADToolBox/HowToUseCADToolBox/') &&
    String(p.path).endsWith('.html')
);

const faqPages = pages.filter((p) => {
  const path = String(p.path || '');
  if (path === '/Doc/CADToolBox/FAQ/ErrorReference.html') return true;
  if (/^\/Doc\/CADToolBox\/FAQ\/ErrorReference\/Error\d+\.html$/.test(path)) return true;
  if (path === '/Doc/CADToolBox/FaqOverview.html') return true;
  if (path.startsWith('/Doc/CADToolBox/FAQ/faq_') && path.endsWith('.html')) return true;
  return false;
});

const selectedPages = [...howToPages, ...faqPages];

const baseMbSource = pen.children.find((c) => c.id === 'MB_SCREEN');
const baseFlSource = pen.children.find((c) => c.id === 'FL_SCREEN');
if (!baseMbSource || !baseFlSource) {
  throw new Error('MB_SCREEN / FL_SCREEN not found in cadtoolonline.pen');
}
const baseMb = clone(baseMbSource);
const baseFl = clone(baseFlSource);

const scenarioRows = [];
const newScreens = [baseMb, baseFl];

for (let i = 0; i < selectedPages.length; i++) {
  const page = selectedPages[i];
  const module = chooseModule(page);
  const template = chooseTemplate(module, page.path || '');
  const headings = extractHeadings(page.content || '');
  const steps = extractSteps(page.content || '');
  const summary = clip(page.description || `参考页面：${page.title}`, 64);
  const prefix = `SC${String(i + 1).padStart(2, '0')}`;

  const screen = clone(template === 'FL' ? baseFl : baseMb);
  remapIds(screen, template === 'FL' ? 'FL' : 'MB', prefix);

  screen.id = `${prefix}_SCREEN`;
  screen.name = `文档场景_${String(i + 1).padStart(2, '0')}_${page.title}`;

  const globalIndex = i + 2;
  screen.x = (globalIndex % 4) * 1420;
  screen.y = Math.floor(globalIndex / 4) * 820;

  const leftItems = headings.length > 1 ? headings.slice(1, 5) : [module, page.title, '关键要点', '操作入口'];
  const rightItems = steps.length ? steps.slice(0, 4) : headings.slice(0, 4);
  const popupItems = unique([...headings.slice(1, 3), ...steps.slice(0, 2)]).slice(0, 3);

  setText(screen, `${prefix}_TITLE_TXT`, `CAD 工具 - ${page.title}`);
  setText(screen, `${prefix}_VIEW_TXT`, `文档路径：${page.path}`);
  setText(screen, `${prefix}_STATUS_TXT`, summary);
  setText(screen, `${prefix}_LEFT_H_TXT`, module || '流程模块');

  if (findNode(screen, `${prefix}_RIGHT_TXT`)) {
    setText(screen, `${prefix}_RIGHT_TXT`, '关键步骤');
  }
  if (findNode(screen, `${prefix}_RIGHT_H_TXT`)) {
    setText(screen, `${prefix}_RIGHT_H_TXT`, '关键步骤');
  }

  replaceTree(screen, prefix, leftItems);
  replaceRightBody(screen, prefix, rightItems.length ? rightItems : ['请参考文档原文页面']);
  if (template === 'MB') {
    setPopup(screen, prefix, '关键交互', popupItems);
  }
  decorateRibbonWithIcons(screen, prefix);

  newScreens.push(screen);
  scenarioRows.push({
    sid: prefix,
    module,
    title: page.title,
    path: page.path,
    boardId: screen.id,
    boardName: screen.name,
    template
  });
}

pen.children = newScreens;
fs.writeFileSync(penPath, JSON.stringify(pen, null, 2) + '\n', 'utf8');

const moduleCountMap = new Map();
for (const row of scenarioRows) {
  moduleCountMap.set(row.module, (moduleCountMap.get(row.module) || 0) + 1);
}
const moduleRows = [...moduleCountMap.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([module, count]) => `| ${module} | ${count} |`)
  .join('\n');

const scenarioTable = scenarioRows
  .map(
    (r) =>
      `| ${r.sid} | ${r.module} | ${r.title} | \`${r.path}\` | ${r.boardId} |`
  )
  .join('\n');

const today = new Date().toISOString().slice(0, 10);
const prd = `# PRD：CADToolOnline 三维建模界面重建（基于本地帮助文档重构）

## 1. 文档信息

- 文档版本：v3.0
- 更新日期：${today}
- 数据来源：
  - \`ref/Docs/CADToolBox/index.html\`
  - \`ref/Docs/CADToolBox/pageData/page-data-list.json\`

## 2. 重构目标

1. 以帮助文档操作页为唯一事实来源，重建可指导开发的 UI 原型体系。
2. PRD 与 \`.pen\` 画板一一映射，消除“文档-原型”差异。
3. 覆盖模型导入、多体设计、流体设计、设计工具、导出、迭代、FAQ/错误码、三维交互全流程。

## 3. 功能范围与页面统计

- 文档操作页（HowToUse）纳入：${howToPages.length} 页
- FAQ/错误码页纳入：${faqPages.length} 页
- 原型场景页（不含主界面）：${scenarioRows.length} 页
- 画板总数（含主界面多体/流体）：${newScreens.length} 页

### 3.1 模块统计

| 模块 | 页面数 |
|---|---:|
${moduleRows}

## 4. 原型场景映射（文档页 -> 画板）

| 场景ID | 模块 | 帮助页面 | 文档路径 | 画板ID |
|---|---|---|---|---|
${scenarioTable}

## 5. 关键交互约束（来自帮助文档）

1. 统一退出交互：多数建模态支持再次点击功能按钮或 \`Esc\` 退出。
2. 闪电模式与标准模式：连接、驱动、接触、流体端口等需双模式支持。
3. 三维拾取一致性：点/线/面拾取规则必须与文档说明一致，并支持高亮联动。
4. 参数侧边栏：进入操作态后右侧必须出现对应“选项-xxx”面板。
5. 导入/导出/迭代关键流程须提供状态提示、异常提示与日志定位入口。

## 6. 验收标准

1. 所有纳入文档页在 \`.pen\` 中均有对应画板。
2. 任一画板必须包含：页面标题、流程模块、关键步骤、状态提示。
3. PRD 场景映射表中的每一行，都可在 \`cadtoolonline.pen\` 顶层画板中定位到对应 ID。
4. 开发人员可基于画板直接建立页面与交互任务，无需回溯原始文档才能理解流程。
`;

fs.writeFileSync(prdPath, prd, 'utf8');

console.log(
  `Rebuilt PRD + PEN from local docs. scenarios=${scenarioRows.length}, screens=${newScreens.length}`
);
