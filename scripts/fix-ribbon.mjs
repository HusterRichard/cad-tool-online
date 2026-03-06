/**
 * fixRibbon(mbScreen)
 *
 * 完全重建 MB_SCREEN 中 MB_RIBBON 的 children 数组，
 * 将纯文本横排按钮改为独立的图标+文字垂直/水平结构，
 * 并补全缺失的"力"、"设置"、"关于"分组。
 *
 * 用法：
 *   import fs from 'fs';
 *   const pen = JSON.parse(fs.readFileSync('cadtoolonline.pen', 'utf8'));
 *   const mbScreen = pen.children.find(c => c.id === 'MB_SCREEN');
 *   fixRibbon(mbScreen);
 *   fs.writeFileSync('cadtoolonline.pen', JSON.stringify(pen, null, 2));
 */

export function fixRibbon(mbScreen) {
  const ribbon = mbScreen.children.find(c => c.id === 'MB_RIBBON');
  if (!ribbon) throw new Error('MB_RIBBON not found in mbScreen');

  // ── helpers ──────────────────────────────────────────────

  /** 分隔线 */
  function sep(id) {
    return { type: 'frame', id, width: 1, height: 'fill_container', fill: '#C8C8C8' };
  }

  /** 大按钮：52x80, 垂直排列 icon(32x32) + label */
  function bigBtn(idSuffix, label, iconColor) {
    return {
      type: 'frame',
      id: `MB_BTN_${idSuffix}`,
      width: 52,
      height: 80,
      layout: 'vertical',
      gap: 2,
      alignItems: 'center',
      children: [
        {
          type: 'frame',
          id: `MB_ICO_${idSuffix}`,
          width: 32,
          height: 32,
          fill: iconColor,
          cornerRadius: 6
        },
        {
          type: 'text',
          id: `MB_LBL_${idSuffix}`,
          content: label,
          fontFamily: 'Microsoft YaHei',
          fontSize: 11,
          fill: '#374151'
        }
      ]
    };
  }

  /** 小按钮：水平排列 icon(16x16) + label */
  function smallBtn(idSuffix, label, iconColor) {
    return {
      type: 'frame',
      id: `MB_BTN_${idSuffix}`,
      width: 'fill_container',
      height: 22,
      layout: 'horizontal',
      gap: 4,
      alignItems: 'center',
      children: [
        {
          type: 'frame',
          id: `MB_ICO_${idSuffix}`,
          width: 16,
          height: 16,
          fill: iconColor,
          cornerRadius: 3
        },
        {
          type: 'text',
          id: `MB_LBL_${idSuffix}`,
          content: label,
          fontFamily: 'Microsoft YaHei',
          fontSize: 12,
          fill: '#111827'
        }
      ]
    };
  }

  /** 分组标签（底部） */
  function groupLabel(id, text) {
    return {
      type: 'text',
      id,
      content: text,
      fontFamily: 'Microsoft YaHei',
      fontSize: 11,
      fill: '#6B7280',
      textAlign: 'center'
    };
  }

  /**
   * 构建"小按钮列式"分组（文件、分组 等按钮较多的区域）。
   * buttons: [[btn, btn], [btn, btn]]  ← 每个子数组是一列
   */
  function smallBtnGroup(groupId, columns, labelId, labelText, width) {
    const colFrames = columns.map((col, ci) => ({
      type: 'frame',
      id: `${groupId}_COL${ci + 1}`,
      width: 'fill_container',
      height: 'fill_container',
      layout: 'vertical',
      gap: 2,
      children: col
    }));

    return {
      type: 'frame',
      id: groupId,
      width,
      height: 'fill_container',
      fill: '#ECECEC',
      layout: 'vertical',
      gap: 2,
      children: [
        {
          type: 'frame',
          id: `${groupId}_BODY`,
          width: 'fill_container',
          height: 'fill_container',
          layout: 'horizontal',
          gap: 6,
          children: colFrames
        },
        groupLabel(labelId, labelText)
      ]
    };
  }

  /**
   * 构建"大按钮行式"分组（连接、驱动 等）。
   * rows: [[btn, btn, ...], [btn, btn, ...]]  ← 每个子数组是一行
   */
  function bigBtnGroup(groupId, rows, labelId, labelText, width) {
    const rowFrames = rows.map((row, ri) => ({
      type: 'frame',
      id: `${groupId}_ROW${ri + 1}`,
      width: 'fill_container',
      height: 'auto',
      layout: 'horizontal',
      gap: 4,
      children: row
    }));

    return {
      type: 'frame',
      id: groupId,
      width,
      height: 'fill_container',
      fill: '#ECECEC',
      layout: 'vertical',
      gap: 2,
      children: [
        ...rowFrames,
        groupLabel(labelId, labelText)
      ]
    };
  }

  /** 单行大按钮分组 */
  function singleRowBigBtnGroup(groupId, buttons, labelId, labelText, width) {
    return {
      type: 'frame',
      id: groupId,
      width,
      height: 'fill_container',
      fill: '#ECECEC',
      layout: 'vertical',
      gap: 2,
      alignItems: 'center',
      children: [
        {
          type: 'frame',
          id: `${groupId}_ROW1`,
          width: 'fill_container',
          height: 'auto',
          layout: 'horizontal',
          gap: 4,
          children: buttons
        },
        groupLabel(labelId, labelText)
      ]
    };
  }

  // ── 颜色常量 ────────────────────────────────────────────

  const COLOR = {
    FILE:     '#2563EB',
    GROUP:    '#059669',
    BASIC:    '#7C3AED',
    CONNECT:  '#DC2626',
    DRIVE:    '#EA580C',
    FORCE:    '#16A34A',
    TOOL:     '#0891B2',
    EXPORT:   '#4B5563',
    SETTINGS: '#6B7280',
    ABOUT:    '#9333EA'
  };

  // ── 1. 文件分组（4 个小按钮，2 列 x 2 行）──────────────

  const grpFile = smallBtnGroup('MB_G_FILE', [
    [
      smallBtn('FILE_IMPORT', '导入', COLOR.FILE),
      smallBtn('FILE_SAVE', '保存', COLOR.FILE)
    ],
    [
      smallBtn('FILE_OPEN', '打开', COLOR.FILE),
      smallBtn('FILE_SAVEAS', '另存为', COLOR.FILE)
    ]
  ], 'MB_G_FILE_LBL', '文件', 140);

  // ── 2. 分组（4 个小按钮，2 列 x 2 行）──────────────────

  const grpGroup = smallBtnGroup('MB_G_GROUP', [
    [
      smallBtn('GRP_MERGE', '组合', COLOR.GROUP),
      smallBtn('GRP_CLEAN', '清理', COLOR.GROUP)
    ],
    [
      smallBtn('GRP_SPLIT', '分解', COLOR.GROUP),
      smallBtn('GRP_DEFAULT', '默认分组', COLOR.GROUP)
    ]
  ], 'MB_G_GROUP_LBL', '分组', 160);

  // ── 3. 基本形状（2 个大按钮单行）───────────────────────

  const grpBasic = singleRowBigBtnGroup('MB_G_BASIC', [
    bigBtn('BASIC_MARKER', '标架', COLOR.BASIC),
    bigBtn('BASIC_POINT', '设计点', COLOR.BASIC)
  ], 'MB_G_BASIC_LBL', '基本形状', 120);

  // ── 4. 连接（8 个大按钮，2 行 x 4 列）─────────────────

  const grpConnect = bigBtnGroup('MB_G_CONNECT', [
    [
      bigBtn('CONN_FIXED', '固定副', COLOR.CONNECT),
      bigBtn('CONN_REVOLUTE', '转动副', COLOR.CONNECT),
      bigBtn('CONN_PRISMATIC', '平移副', COLOR.CONNECT),
      bigBtn('CONN_CYLINDRICAL', '圆柱副', COLOR.CONNECT)
    ],
    [
      bigBtn('CONN_SPHERICAL', '球副', COLOR.CONNECT),
      bigBtn('CONN_UNIVERSAL', '万向节', COLOR.CONNECT),
      bigBtn('CONN_SCREW', '螺旋副', COLOR.CONNECT),
      bigBtn('CONN_PLANAR', '平面副', COLOR.CONNECT)
    ]
  ], 'MB_G_CONNECT_LBL', '连接', 230);

  // ── 5. 驱动（2 个大按钮单行）───────────────────────────

  const grpDrive = singleRowBigBtnGroup('MB_G_DRIVE', [
    bigBtn('DRV_ROTATIONAL', '转动驱动', COLOR.DRIVE),
    bigBtn('DRV_TRANSLATIONAL', '平移驱动', COLOR.DRIVE)
  ], 'MB_G_DRIVE_LBL', '驱动', 120);

  // ── 6. 力（2 个大按钮单行）── 新增 ────────────────────

  const grpForce = singleRowBigBtnGroup('MB_G_FORCE', [
    bigBtn('FORCE_PP', '点点接触', COLOR.FORCE),
    bigBtn('FORCE_PF', '点面接触', COLOR.FORCE)
  ], 'MB_G_FORCE_LBL', '力', 120);

  // ── 7. 工具（4 个小按钮，2 列 x 2 行）─────────────────

  const grpTool = smallBtnGroup('MB_G_TOOL', [
    [
      smallBtn('TOOL_MEASURE', '测量', COLOR.TOOL),
      smallBtn('TOOL_THICKEN', '曲面加厚', COLOR.TOOL)
    ],
    [
      smallBtn('TOOL_EXPLODED', '爆炸视图', COLOR.TOOL),
      smallBtn('TOOL_PLANAR_LOOP', '平面环处理', COLOR.TOOL)
    ]
  ], 'MB_G_TOOL_LBL', '工具', 180);

  // ── 8. 导出（2 个小按钮，单列）─────────────────────────

  const grpExport = smallBtnGroup('MB_G_EXPORT', [
    [
      smallBtn('EXP_CHECK', '检查', COLOR.EXPORT),
      smallBtn('EXP_ACCEPT', '接受并退出', COLOR.EXPORT)
    ]
  ], 'MB_G_EXPORT_LBL', '导出', 110);

  // ── 9. 设置（1 个大按钮）── 新增 ──────────────────────

  const grpSettings = singleRowBigBtnGroup('MB_G_SETTINGS', [
    bigBtn('SETTINGS', '设置', COLOR.SETTINGS)
  ], 'MB_G_SETTINGS_LBL', '设置', 64);

  // ── 10. 关于（1 个大按钮）── 新增 ─────────────────────

  const grpAbout = singleRowBigBtnGroup('MB_G_ABOUT', [
    bigBtn('ABOUT', '关于', COLOR.ABOUT)
  ], 'MB_G_ABOUT_LBL', '关于', 64);

  // ── 组装 ribbon.children ────────────────────────────────

  ribbon.children = [
    grpFile,
    sep('MB_SEP_1'),
    grpGroup,
    sep('MB_SEP_2'),
    grpBasic,
    sep('MB_SEP_3'),
    grpConnect,
    sep('MB_SEP_4'),
    grpDrive,
    sep('MB_SEP_5'),
    grpForce,
    sep('MB_SEP_6'),
    grpTool,
    sep('MB_SEP_7'),
    grpExport,
    sep('MB_SEP_8'),
    grpSettings,
    sep('MB_SEP_9'),
    grpAbout
  ];
}

// ── CLI 入口：直接运行时读取 pen 文件并修复 ──────────────

import { fileURLToPath } from 'url';
import { argv } from 'process';

const __filename = fileURLToPath(import.meta.url);
if (argv[1] === __filename) {
  const fs = await import('fs');
  const penPath = argv[2] || 'cadtoolonline.pen';
  const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));
  const mbScreen = pen.children.find(c => c.id === 'MB_SCREEN');
  if (!mbScreen) {
    console.error('MB_SCREEN not found');
    process.exit(1);
  }
  fixRibbon(mbScreen);
  fs.writeFileSync(penPath, JSON.stringify(pen, null, 2));
  console.log(`Ribbon fixed in ${penPath}`);
}
