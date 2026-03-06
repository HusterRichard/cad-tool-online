/**
 * fixViewAndChrome(mbScreen)
 *
 * 修复 MB_SCREEN 的标题栏、Tab 栏、弹出框、3D 视图区和状态栏，
 * 使之贴近 CADToolBox 桌面版真实 UI 样式。
 *
 * 可直接 import 使用，也可作为独立脚本执行（读取 cadtoolonline.pen 并写回）。
 */

// ── helpers ────────────────────────────────────────────────────────
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

function makeText(id, content, fontSize = 14, fill = '#111827', fontWeight) {
  const n = {
    type: 'text',
    id,
    content,
    fontFamily: 'Microsoft YaHei',
    fontSize,
    fill,
  };
  if (fontWeight) n.fontWeight = fontWeight;
  return n;
}

function makeCircleIcon(id, label, bgFill, fgFill) {
  return {
    type: 'frame',
    id,
    name: `ICON:${label}`,
    width: 24,
    height: 24,
    fill: bgFill,
    cornerRadius: 12,
    children: [
      makeText(`${id}_LBL`, label, 10, fgFill),
    ],
  };
}

// ── main ───────────────────────────────────────────────────────────
export function fixViewAndChrome(mbScreen) {
  // ================================================================
  // 1. MB_TITLE — Quick Access Toolbar + 居中标题 + 窗口控件
  // ================================================================
  const title = findNode(mbScreen, 'MB_TITLE');
  if (title) {
    // 保留原始样式属性，重置 children
    title.layout = 'horizontal';
    title.gap = 0;
    title.padding = [0, 4];
    title.children = [
      // ---- 左侧：Quick Access Toolbar ----
      {
        type: 'frame',
        id: 'MB_QAT',
        name: 'Quick Access Toolbar',
        height: 'fill_container',
        layout: 'horizontal',
        gap: 2,
        padding: [4, 6],
        children: [
          // 齿轮（设置）
          {
            type: 'frame',
            id: 'MB_QAT_SETTINGS',
            name: 'ICON:设置|SEM:settings',
            width: 16,
            height: 16,
            fill: '#8B8B8B',
            cornerRadius: 8,
            children: [
              {
                type: 'frame',
                id: 'MB_QAT_SETTINGS_DOT',
                x: 5,
                y: 5,
                width: 6,
                height: 6,
                fill: '#E9E9E9',
                cornerRadius: 3,
              },
            ],
          },
          // 撤销
          {
            type: 'frame',
            id: 'MB_QAT_UNDO',
            name: 'ICON:撤销|SEM:undo',
            width: 16,
            height: 16,
            fill: 'transparent',
            children: [
              {
                type: 'frame',
                id: 'MB_QAT_UNDO_ARROW',
                x: 2,
                y: 3,
                width: 10,
                height: 8,
                fill: '#4A4A4A',
                cornerRadius: [4, 4, 0, 0],
              },
            ],
          },
          // 重做
          {
            type: 'frame',
            id: 'MB_QAT_REDO',
            name: 'ICON:重做|SEM:redo',
            width: 16,
            height: 16,
            fill: 'transparent',
            children: [
              {
                type: 'frame',
                id: 'MB_QAT_REDO_ARROW',
                x: 4,
                y: 3,
                width: 10,
                height: 8,
                fill: '#AFAFAF',
                cornerRadius: [4, 4, 0, 0],
              },
            ],
          },
        ],
      },

      // ---- 中间：标题文字（fill_container 占满剩余空间） ----
      {
        type: 'frame',
        id: 'MB_TITLE_CENTER',
        width: 'fill_container',
        height: 'fill_container',
        layout: 'horizontal',
        padding: [6, 0],
        children: [
          makeText('MB_TITLE_TXT', 'CAD 工具 - bulldozer.STEP', 12, '#1F2937'),
        ],
      },

      // ---- 右侧：窗口控件 ----
      {
        type: 'frame',
        id: 'MB_WINCTRLS',
        name: 'Window Controls',
        height: 'fill_container',
        layout: 'horizontal',
        gap: 0,
        children: [
          // 帮助 ?
          {
            type: 'frame',
            id: 'MB_WIN_HELP',
            name: 'ICON:帮助|SEM:help',
            width: 46,
            height: 'fill_container',
            fill: 'transparent',
            layout: 'horizontal',
            padding: [6, 0],
            children: [
              makeText('MB_WIN_HELP_LBL', '?', 14, '#1F2937'),
            ],
          },
          // 最小化
          {
            type: 'frame',
            id: 'MB_WIN_MIN',
            name: 'ICON:最小化|SEM:minimize',
            width: 46,
            height: 'fill_container',
            fill: 'transparent',
            layout: 'horizontal',
            padding: [6, 0],
            children: [
              {
                type: 'frame',
                id: 'MB_WIN_MIN_BAR',
                width: 10,
                height: 1,
                fill: '#1F2937',
              },
            ],
          },
          // 最大化
          {
            type: 'frame',
            id: 'MB_WIN_MAX',
            name: 'ICON:最大化|SEM:maximize',
            width: 46,
            height: 'fill_container',
            fill: 'transparent',
            layout: 'horizontal',
            padding: [6, 0],
            children: [
              {
                type: 'frame',
                id: 'MB_WIN_MAX_BOX',
                width: 10,
                height: 10,
                fill: 'transparent',
                cornerRadius: 1,
                stroke: '#1F2937',
                strokeWidth: 1,
              },
            ],
          },
          // 关闭
          {
            type: 'frame',
            id: 'MB_WIN_CLOSE',
            name: 'ICON:关闭|SEM:close',
            width: 46,
            height: 'fill_container',
            fill: 'transparent',
            layout: 'horizontal',
            padding: [6, 0],
            children: [
              makeText('MB_WIN_CLOSE_X', '\u00D7', 16, '#1F2937'),
            ],
          },
        ],
      },
    ];
  }

  // ================================================================
  // 2. MB_TAB — 字号 22→13，高度 30→24
  // ================================================================
  const tab = findNode(mbScreen, 'MB_TAB');
  if (tab) {
    tab.height = 24;
    tab.padding = [3, 12];
    tab.gap = 18;
  }
  const tabMulti = findNode(mbScreen, 'MB_TAB_MULTI');
  if (tabMulti) {
    tabMulti.fontSize = 13;
  }
  const tabFluid = findNode(mbScreen, 'MB_TAB_FLUID');
  if (tabFluid) {
    tabFluid.fontSize = 13;
  }

  // ================================================================
  // 3. MB_POPUP — 隐藏（height=0, children=[]）
  // ================================================================
  const popup = findNode(mbScreen, 'MB_POPUP');
  if (popup) {
    popup.height = 0;
    popup.children = [];
    popup.padding = 0;
    popup.gap = 0;
    popup.clip = true;
  }

  // ================================================================
  // 4. MB_VIEW — 3D 视图区完整重建
  // ================================================================
  const view = findNode(mbScreen, 'MB_VIEW');
  if (view) {
    // 背景渐变模拟：上浅下深两层叠加
    view.fill = '#BCC4CE';
    view.layout = undefined;    // 使用绝对定位
    delete view.layout;
    view.padding = 0;
    view.clip = true;
    view.children = [
      // ---- 渐变背景底层 ----
      {
        type: 'frame',
        id: 'MB_VIEW_BG_BOTTOM',
        name: '网格背景-下',
        x: 0,
        y: 0,
        width: 'fill_container',
        height: 'fill_container',
        fill: '#D6DCE4',
      },
      {
        type: 'frame',
        id: 'MB_VIEW_BG_TOP',
        name: '网格背景-上（半透明渐变模拟）',
        x: 0,
        y: 0,
        width: 'fill_container',
        height: '50%',
        fill: '#BCC4CE',
        opacity: 0.6,
      },

      // ---- View Toolbar：居中悬浮在顶部 ----
      {
        type: 'frame',
        id: 'MB_VIEW_TOOLBAR',
        name: 'View Toolbar',
        x: '50%',
        y: 8,
        layout: 'horizontal',
        gap: 4,
        padding: [3, 6],
        fill: '#FFFFFF',
        cornerRadius: 16,
        opacity: 0.92,
        children: [
          makeCircleIcon('MB_VT_FIT',   '适', '#E8EFF7', '#4B5563'),
          makeCircleIcon('MB_VT_SEL',   '选', '#E8EFF7', '#4B5563'),
          makeCircleIcon('MB_VT_DIR',   '向', '#E8EFF7', '#4B5563'),
          makeCircleIcon('MB_VT_REND',  '渲', '#E8EFF7', '#4B5563'),
          makeCircleIcon('MB_VT_PROJ',  '投', '#E8EFF7', '#4B5563'),
          makeCircleIcon('MB_VT_SHOW',  '显', '#E8EFF7', '#4B5563'),
        ],
      },

      // ---- ViewCube：右上角 ----
      {
        type: 'frame',
        id: 'MB_VIEW_CUBE',
        name: 'ViewCube',
        x: 'calc(100% - 80)',
        y: 12,
        width: 60,
        height: 60,
        fill: '#FFFFFF',
        cornerRadius: 4,
        opacity: 0.85,
        layout: 'vertical',
        gap: 0,
        padding: 2,
        children: [
          // 顶面 "Top"
          {
            type: 'frame',
            id: 'MB_VCUBE_TOP',
            width: 'fill_container',
            height: 16,
            fill: '#C7D4E3',
            cornerRadius: [3, 3, 0, 0],
            layout: 'horizontal',
            padding: [1, 0],
            children: [
              makeText('MB_VCUBE_TOP_LBL', 'Top', 8, '#4B5563'),
            ],
          },
          // 正面 "Front"
          {
            type: 'frame',
            id: 'MB_VCUBE_FRONT',
            width: 'fill_container',
            height: 24,
            fill: '#D6DCE4',
            layout: 'horizontal',
            padding: [4, 0],
            children: [
              makeText('MB_VCUBE_FRONT_LBL', 'Front', 9, '#374151'),
            ],
          },
          // 右面 "Right"
          {
            type: 'frame',
            id: 'MB_VCUBE_RIGHT',
            width: 'fill_container',
            height: 16,
            fill: '#E0E5EC',
            cornerRadius: [0, 0, 3, 3],
            layout: 'horizontal',
            padding: [1, 0],
            children: [
              makeText('MB_VCUBE_RIGHT_LBL', 'Right', 8, '#6B7280'),
            ],
          },
        ],
      },

      // ---- 坐标轴：左下角 ----
      {
        type: 'frame',
        id: 'MB_VIEW_AXES',
        name: '坐标轴',
        x: 12,
        y: 'calc(100% - 60)',
        width: 50,
        height: 50,
        children: [
          // X 轴（红色横线）
          {
            type: 'frame',
            id: 'MB_AX_X',
            x: 8,
            y: 30,
            width: 28,
            height: 2,
            fill: '#E53E3E',
            cornerRadius: 1,
          },
          makeText('MB_AX_X_LBL', 'X', 9, '#E53E3E'),
          // Y 轴（绿色竖线）
          {
            type: 'frame',
            id: 'MB_AX_Y',
            x: 8,
            y: 4,
            width: 2,
            height: 28,
            fill: '#38A169',
            cornerRadius: 1,
          },
          makeText('MB_AX_Y_LBL', 'Y', 9, '#38A169'),
          // Z 轴（蓝色斜线模拟）
          {
            type: 'frame',
            id: 'MB_AX_Z',
            x: 12,
            y: 18,
            width: 2,
            height: 20,
            fill: '#3182CE',
            cornerRadius: 1,
          },
          makeText('MB_AX_Z_LBL', 'Z', 9, '#3182CE'),
        ],
      },

      // ---- 占位文字（调试可选，表示 3D 渲染区） ----
      {
        type: 'text',
        id: 'MB_VIEW_TXT',
        content: '',
        fontFamily: 'Microsoft YaHei',
        fontSize: 12,
        fill: '#9CA3AF',
      },
    ];
  }

  // ================================================================
  // 5. MB_STATUS — 左侧"就绪" + 右侧坐标
  // ================================================================
  const status = findNode(mbScreen, 'MB_STATUS');
  if (status) {
    status.layout = 'horizontal';
    status.gap = 0;
    status.children = [
      // 左侧
      makeText('MB_STATUS_LEFT', '就绪', 12, '#FFFFFF'),
      // spacer（占满中间空间）
      {
        type: 'frame',
        id: 'MB_STATUS_SPACER',
        width: 'fill_container',
        height: 'fill_container',
      },
      // 右侧坐标
      makeText(
        'MB_STATUS_RIGHT',
        'X = 0.722903  Y = 0.630869  Z = 0.193035',
        11,
        '#FFFFFF',
      ),
    ];
  }

  return mbScreen;
}

// ── CLI 入口 ──────────────────────────────────────────────────────
// node scripts/fix-view-and-chrome.mjs
import { argv } from 'process';
if (argv[1] && argv[1].includes('fix-view-and-chrome')) {
  const fs = await import('fs');
  const penPath = 'cadtoolonline.pen';
  const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));

  // 找到 MB_SCREEN（第一个 child）
  const mbScreen = pen.children.find((c) => c.id === 'MB_SCREEN');
  if (!mbScreen) {
    console.error('MB_SCREEN not found');
    process.exit(1);
  }

  fixViewAndChrome(mbScreen);

  fs.writeFileSync(penPath, JSON.stringify(pen, null, 2), 'utf8');
  console.log('OK: cadtoolonline.pen patched');
}
