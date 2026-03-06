/**
 * fix-pen-prototype.mjs
 * 综合修复 cadtoolonline.pen 原型：Ribbon、左面板、右面板、视图区、窗口控件、状态栏
 * 以及关键场景画板和辅助交互画板。
 */
import fs from 'fs';

const penPath = 'cadtoolonline.pen';
const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));

// ─── helpers ───────────────────────────────────────────────
function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  if (!Array.isArray(node.children)) return null;
  for (const c of node.children) { const f = findNode(c, id); if (f) return f; }
  return null;
}

function txt(id, content, fontSize = 12, fill = '#111827', extra = {}) {
  return { type: 'text', id, content, fontFamily: 'Microsoft YaHei', fontSize, fill, ...extra };
}

function frame(id, props, children = []) {
  return { type: 'frame', id, ...props, children };
}

function divider(id) {
  return frame(id, { width: 1, height: 'fill_container', fill: '#C8C8C8' });
}

function iconBox(id, size, color, cr = 4) {
  return frame(id, { width: size, height: size, fill: color, cornerRadius: cr });
}

// 大按钮 (icon 32x32 + label)
function bigBtn(id, label, color) {
  return frame(id, { width: 56, height: 80, layout: 'vertical', gap: 2, padding: [2, 4] }, [
    iconBox(id + '_ICO', 32, color, 6),
    txt(id + '_LBL', label, 11, '#374151', { textAlign: 'center' }),
  ]);
}

// 小按钮 (icon 16x16 + label, 水平)
function smallBtn(id, label, color) {
  return frame(id, { width: 'fill_container', height: 22, layout: 'horizontal', gap: 4 }, [
    iconBox(id + '_ICO', 16, color, 3),
    txt(id + '_LBL', label, 12, '#111827'),
  ]);
}

// Ribbon 分组容器
function ribbonGroup(id, width, color, topChildren, sectionLabel) {
  return frame(id, { width, height: 'fill_container', fill: '#ECECEC', layout: 'vertical', gap: 2, padding: [4, 6] }, [
    frame(id + '_TOP', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 2 }, topChildren),
    frame(id + '_LBL_ROW', { width: 'fill_container', height: 16 }, [
      txt(id + '_T', sectionLabel, 11, '#6B7280', { textAlign: 'center' }),
    ]),
  ]);
}

// 两列小按钮行
function twoColRow(id, btn1, btn2) {
  return frame(id, { width: 'fill_container', height: 22, layout: 'horizontal', gap: 4 }, [btn1, btn2]);
}

// ─── P0: Fix Ribbon ───────────────────────────────────────
function fixRibbon(screen) {
  const ribbon = findNode(screen, screen.id.replace('_SCREEN', '') + '_RIBBON');
  if (!ribbon) return;
  const P = screen.id.replace('_SCREEN', ''); // prefix: MB or FL

  ribbon.height = 100;
  ribbon.padding = [4, 8];
  ribbon.gap = 6;

  if (P === 'MB') {
    ribbon.children = [
      // 1. 文件
      ribbonGroup(P + '_G_FILE', 110, '#2563EB', [
        twoColRow(P + '_FR1', smallBtn(P + '_BTN_IMPORT', '导入', '#2563EB'), smallBtn(P + '_BTN_OPEN', '打开', '#2563EB')),
        twoColRow(P + '_FR2', smallBtn(P + '_BTN_SAVE', '保存', '#3B82F6'), smallBtn(P + '_BTN_SAVEAS', '另存为', '#3B82F6')),
      ], '文件'),
      divider(P + '_D1'),
      // 2. 分组
      ribbonGroup(P + '_G_GROUP', 120, '#059669', [
        twoColRow(P + '_GR1', smallBtn(P + '_BTN_MERGE', '组合', '#059669'), smallBtn(P + '_BTN_SPLIT', '分解', '#059669')),
        twoColRow(P + '_GR2', smallBtn(P + '_BTN_CLEAN', '清理', '#10B981'), smallBtn(P + '_BTN_DEFGRP', '默认分组', '#10B981')),
      ], '分组'),
      divider(P + '_D2'),
      // 3. 基本形状
      ribbonGroup(P + '_G_BASIC', 90, '#7C3AED', [
        frame(P + '_BR1', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_MARKER', '标架', '#7C3AED'),
          bigBtn(P + '_BTN_POINT', '设计点', '#8B5CF6'),
        ]),
      ], '基本形状'),
      divider(P + '_D3'),
      // 4. 连接
      ribbonGroup(P + '_G_CONNECT', 260, '#DC2626', [
        frame(P + '_CR1', { width: 'fill_container', height: 38, layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_FIXED', '固定副', '#DC2626'),
          bigBtn(P + '_BTN_REVO', '转动副', '#EF4444'),
          bigBtn(P + '_BTN_PRISM', '平移副', '#F87171'),
          bigBtn(P + '_BTN_CYLIN', '圆柱副', '#DC2626'),
        ]),
        frame(P + '_CR2', { width: 'fill_container', height: 38, layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_SPHER', '球副', '#EF4444'),
          bigBtn(P + '_BTN_UNIV', '万向节', '#F87171'),
          bigBtn(P + '_BTN_SCREW', '螺旋副', '#DC2626'),
          bigBtn(P + '_BTN_PLANAR', '平面副', '#EF4444'),
        ]),
      ], '连接'),
      divider(P + '_D4'),
      // 5. 驱动
      ribbonGroup(P + '_G_DRIVE', 90, '#EA580C', [
        frame(P + '_DRR', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_ROTDRV', '转动驱动', '#EA580C'),
          bigBtn(P + '_BTN_TRNDRV', '平移驱动', '#F97316'),
        ]),
      ], '驱动'),
      divider(P + '_D5'),
      // 6. 力 (新增)
      ribbonGroup(P + '_G_FORCE', 90, '#16A34A', [
        frame(P + '_FCR', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_PP', '点点接触', '#16A34A'),
          bigBtn(P + '_BTN_PS', '点面接触', '#22C55E'),
        ]),
      ], '力'),
      divider(P + '_D6'),
      // 7. 工具
      ribbonGroup(P + '_G_TOOL', 180, '#0891B2', [
        frame(P + '_TR1', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_MEAS', '测量', '#0891B2'),
          bigBtn(P + '_BTN_EXPL', '爆炸视图', '#06B6D4'),
          bigBtn(P + '_BTN_THICK', '曲面加厚', '#0E7490'),
          bigBtn(P + '_BTN_LOOP', '平面环', '#0891B2'),
        ]),
      ], '工具'),
      divider(P + '_D7'),
      // 8. 导出
      ribbonGroup(P + '_G_EXPORT', 90, '#4B5563', [
        frame(P + '_ER', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_CHECK', '检查', '#4B5563'),
          bigBtn(P + '_BTN_EXIT', '接受并退出', '#6B7280'),
        ]),
      ], '导出'),
      divider(P + '_D8'),
      // 9. 设置 (新增)
      ribbonGroup(P + '_G_SETTINGS', 50, '#6B7280', [
        bigBtn(P + '_BTN_SETTINGS', '设置', '#6B7280'),
      ], '设置'),
      divider(P + '_D9'),
      // 10. 关于 (新增)
      ribbonGroup(P + '_G_ABOUT', 50, '#9333EA', [
        bigBtn(P + '_BTN_ABOUT', '关于', '#9333EA'),
      ], '关于'),
    ];
  } else {
    // FL Ribbon
    ribbon.children = [
      ribbonGroup(P + '_G_FILE', 110, '#2563EB', [
        twoColRow(P + '_FR1', smallBtn(P + '_BTN_IMPORT', '导入', '#2563EB'), smallBtn(P + '_BTN_OPEN', '打开', '#2563EB')),
        twoColRow(P + '_FR2', smallBtn(P + '_BTN_SAVE', '保存', '#3B82F6'), smallBtn(P + '_BTN_SAVEAS', '另存为', '#3B82F6')),
      ], '文件'),
      divider(P + '_D1'),
      ribbonGroup(P + '_G_SLICE', 180, '#0284C7', [
        frame(P + '_SR', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_SIMTANK', '简单油箱', '#0284C7'),
          bigBtn(P + '_BTN_TANK', '油箱切片', '#0369A1'),
          bigBtn(P + '_BTN_RIB', '肋板切片', '#0EA5E9'),
        ]),
      ], '切片'),
      divider(P + '_D2'),
      ribbonGroup(P + '_G_DESIGN', 60, '#B45309', [
        bigBtn(P + '_BTN_PORT', '流体端口', '#B45309'),
      ], '设计'),
      divider(P + '_D3'),
      ribbonGroup(P + '_G_TOOL', 140, '#0891B2', [
        frame(P + '_TR1', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_MEAS', '测量', '#0891B2'),
          bigBtn(P + '_BTN_EXPL', '爆炸视图', '#06B6D4'),
          bigBtn(P + '_BTN_THICK', '曲面加厚', '#0E7490'),
        ]),
      ], '工具'),
      divider(P + '_D4'),
      ribbonGroup(P + '_G_EXPORT', 90, '#4B5563', [
        frame(P + '_ER', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_CHECK', '检查', '#4B5563'),
          bigBtn(P + '_BTN_EXIT', '接受并退出', '#6B7280'),
        ]),
      ], '导出'),
      divider(P + '_D5'),
      ribbonGroup(P + '_G_SETTINGS', 50, '#6B7280', [
        bigBtn(P + '_BTN_SETTINGS', '设置', '#6B7280'),
      ], '设置'),
      divider(P + '_D6'),
      ribbonGroup(P + '_G_ABOUT', 50, '#9333EA', [
        bigBtn(P + '_BTN_ABOUT', '关于', '#9333EA'),
      ], '关于'),
    ];
  }
}

// ─── P0: Fix Left Panel (Model Browser) ──────────────────
function fixLeftPanel(screen) {
  const P = screen.id.replace('_SCREEN', '');
  const left = findNode(screen, P + '_LEFT');
  if (!left) return;

  left.width = 265;
  left.fill = '#F5F5F5';
  left.layout = 'vertical';
  left.gap = 0;

  // tree node helper
  function treeRoot(id, icon, label, color, expanded, childNodes) {
    const arrow = expanded ? '▼' : '▷';
    return frame(id, { width: 'fill_container', layout: 'vertical' }, [
      frame(id + '_ROW', { width: 'fill_container', height: 24, layout: 'horizontal', gap: 4, padding: [2, 6] }, [
        txt(id + '_ARR', arrow, 11, '#6B7280'),
        iconBox(id + '_ICO', 14, color, 2),
        txt(id + '_LBL', label, 13, '#1F2937', { fontWeight: '600' }),
      ]),
      ...(expanded && childNodes ? [frame(id + '_CH', { width: 'fill_container', layout: 'vertical', padding: [0, 0, 0, 20] }, childNodes)] : []),
    ]);
  }

  function treePart(id, label, selected, childNodes) {
    const bg = selected ? '#CCE5FF' : undefined;
    const arrow = childNodes ? '▼' : '';
    const props = { width: 'fill_container', layout: 'vertical' };
    return frame(id, props, [
      frame(id + '_ROW', { width: 'fill_container', height: 22, layout: 'horizontal', gap: 4, padding: [1, 8], ...(bg ? { fill: bg } : {}) }, [
        ...(childNodes ? [txt(id + '_ARR', arrow, 10, '#9CA3AF')] : []),
        iconBox(id + '_ICO', 12, '#F59E0B', 2),
        txt(id + '_LBL', label, 12, '#374151'),
      ]),
      ...(childNodes ? [frame(id + '_CH', { width: 'fill_container', layout: 'vertical', padding: [0, 0, 0, 16] }, childNodes)] : []),
    ]);
  }

  function treeLeaf(id, label, color = '#7C3AED') {
    return frame(id + '_ROW', { width: 'fill_container', height: 20, layout: 'horizontal', gap: 4, padding: [1, 12] }, [
      iconBox(id + '_ICO', 10, color, 5),
      txt(id + '_LBL', label, 11, '#6B7280'),
    ]);
  }

  const mbParts = P === 'MB' ? [
    treePart(P + '_T_GND', 'Ground', false),
    treePart(P + '_T_ARM', 'arm', false),
    treePart(P + '_T_LHC', 'lifting_hydraulic_cylinder', false),
    treePart(P + '_T_LHR', 'lifting_hydraulic_rod', false),
    treePart(P + '_T_PAL', 'pala', false),
    treePart(P + '_T_PDC', 'pitch_del_cilindro', false, [
      treePart(P + '_T_PDC1', 'pitch_del_cilindro_1', true, [
        treeLeaf(P + '_T_MK2', 'Marker2', '#7C3AED'),
        treeLeaf(P + '_T_MK12', 'Marker12', '#7C3AED'),
      ]),
    ]),
    treePart(P + '_T_HR', 'hydraulic_rod', false),
    treePart(P + '_T_PA', 'pitch_arm', false),
    treePart(P + '_T_PL', 'pitch_link', false),
    treePart(P + '_T_BASE', 'base', false),
  ] : [
    treePart(P + '_T_TANK', 'FuelTank', false),
    treePart(P + '_T_COVER', 'Cover', false),
    treePart(P + '_T_PIPE', 'Pipe', false),
  ];

  const connItems = P === 'MB' ? [
    treeLeaf(P + '_T_CN1', 'revolute_arm_base', '#DC2626'),
    treeLeaf(P + '_T_CN2', 'prismatic_hyd_rod', '#DC2626'),
    treeLeaf(P + '_T_CN3', 'fixed_pala_arm', '#DC2626'),
  ] : [];

  const driveItems = P === 'MB' ? [
    treeLeaf(P + '_T_DR1', 'Rotational1', '#EA580C'),
  ] : [];

  const forceItems = P === 'MB' ? [
    treeLeaf(P + '_T_FG', 'Gravity', '#16A34A'),
  ] : [
    treeLeaf(P + '_T_FG', 'Gravity', '#16A34A'),
  ];

  const matItems = [
    treeLeaf(P + '_T_M1', '钢(7800)', '#F59E0B'),
    treeLeaf(P + '_T_M2', '铝(2700)', '#F59E0B'),
  ];

  left.children = [
    // 标题栏
    frame(P + '_LEFT_H', { width: 'fill_container', height: 24, fill: '#2F7ACB', layout: 'horizontal', padding: [2, 8], gap: 4 }, [
      txt(P + '_LEFT_H_TXT', '模型浏览器', 12, '#FFFFFF', { fontWeight: '600' }),
    ]),
    // 工具栏
    frame(P + '_LEFT_TB', { width: 'fill_container', height: 28, fill: '#EFEFEF', layout: 'horizontal', padding: [3, 6], gap: 4 }, [
      frame(P + '_TB_EXP', { width: 20, height: 20, fill: '#E5E7EB', cornerRadius: 3 }, [
        txt(P + '_TB_EXP_T', '+', 14, '#374151'),
      ]),
      frame(P + '_TB_COL', { width: 20, height: 20, fill: '#E5E7EB', cornerRadius: 3 }, [
        txt(P + '_TB_COL_T', '-', 14, '#374151'),
      ]),
      frame(P + '_TB_FILTER', { width: 70, height: 20, fill: '#FFFFFF', cornerRadius: 3, stroke: '#D1D5DB', strokeWidth: 1, layout: 'horizontal', padding: [0, 4], gap: 2 }, [
        txt(P + '_TB_FILTER_T', '模型', 11, '#374151'),
        txt(P + '_TB_FILTER_A', '▼', 9, '#9CA3AF'),
      ]),
      frame(P + '_TB_SEARCH', { width: 'fill_container', height: 20, fill: '#FFFFFF', cornerRadius: 3, stroke: '#D1D5DB', strokeWidth: 1, padding: [0, 4] }, [
        txt(P + '_TB_SEARCH_T', '🔍 搜索模型浏览器', 10, '#9CA3AF'),
      ]),
    ]),
    // 树形区
    frame(P + '_TREE', { width: 'fill_container', height: 'fill_container', fill: '#FFFFFF', layout: 'vertical', padding: [4, 0], gap: 0 }, [
      treeRoot(P + '_R_BODY', '📁', '物体', '#2563EB', true, mbParts),
      treeRoot(P + '_R_CONN', '🔗', '连接', '#DC2626', P === 'MB', connItems),
      treeRoot(P + '_R_DRV', '⚙', '驱动', '#EA580C', P === 'MB', driveItems),
      treeRoot(P + '_R_FORCE', '💪', '力', '#16A34A', true, forceItems),
      treeRoot(P + '_R_MAT', '🎨', '材料', '#F59E0B', true, matItems),
    ]),
  ];
}

// ─── P0: Fix Right Panel (Property Editor) ────────────────
function fixRightPanel(screen) {
  const P = screen.id.replace('_SCREEN', '');
  const right = findNode(screen, P + '_RIGHT');
  if (!right) return;

  right.width = 280;
  right.fill = '#F9FAFB';
  right.layout = 'vertical';
  right.gap = 0;

  function sectionHeader(id, label) {
    return frame(id, { width: 'fill_container', height: 24, fill: '#F3F4F6', padding: [4, 8] }, [
      txt(id + '_T', label, 13, '#1F2937', { fontWeight: '600' }),
    ]);
  }

  function propRow(id, label, value, isInput = false) {
    const valNode = isInput
      ? frame(id + '_VAL', { width: 'fill_container', height: 22, fill: '#FFFFFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [2, 6] }, [
          txt(id + '_VT', value, 12, '#111827'),
        ])
      : txt(id + '_VT', value, 12, '#111827');

    return frame(id, { width: 'fill_container', height: 26, layout: 'horizontal', gap: 4, padding: [2, 8] }, [
      txt(id + '_LBL', label, 12, '#6B7280', { width: 60 }),
      valNode,
    ]);
  }

  function checkboxRow(id, label, checked) {
    return frame(id, { width: 'fill_container', height: 26, layout: 'horizontal', gap: 4, padding: [2, 8] }, [
      txt(id + '_LBL', label, 12, '#6B7280', { width: 60 }),
      frame(id + '_CB', { width: 16, height: 16, fill: checked ? '#2563EB' : '#FFFFFF', stroke: '#9CA3AF', strokeWidth: 1, cornerRadius: 3 }, [
        ...(checked ? [txt(id + '_CK', '✓', 11, '#FFFFFF')] : []),
      ]),
    ]);
  }

  function colorRow(id, label, color) {
    return frame(id, { width: 'fill_container', height: 26, layout: 'horizontal', gap: 4, padding: [2, 8] }, [
      txt(id + '_LBL', label, 12, '#6B7280', { width: 60 }),
      frame(id + '_SWATCH', { width: 50, height: 18, fill: color, cornerRadius: 3, stroke: '#D1D5DB', strokeWidth: 1 }),
    ]);
  }

  function dropdownRow(id, label, value) {
    return frame(id, { width: 'fill_container', height: 26, layout: 'horizontal', gap: 4, padding: [2, 8] }, [
      txt(id + '_LBL', label, 12, '#6B7280', { width: 60 }),
      frame(id + '_DD', { width: 'fill_container', height: 22, fill: '#FFFFFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, layout: 'horizontal', padding: [2, 6] }, [
        txt(id + '_DDT', value, 12, '#111827'),
        txt(id + '_DDA', '▼', 9, '#9CA3AF'),
      ]),
    ]);
  }

  function tripleRow(id, label, v1, v2, v3, unit) {
    return frame(id, { width: 'fill_container', height: 26, layout: 'horizontal', gap: 2, padding: [2, 8] }, [
      txt(id + '_LBL', label, 12, '#6B7280', { width: 36 }),
      frame(id + '_V1', { width: 'fill_container', height: 20, fill: '#FFFFFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [
        txt(id + '_V1T', v1, 10, '#111827'),
      ]),
      frame(id + '_V2', { width: 'fill_container', height: 20, fill: '#FFFFFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [
        txt(id + '_V2T', v2, 10, '#111827'),
      ]),
      frame(id + '_V3', { width: 'fill_container', height: 20, fill: '#FFFFFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [
        txt(id + '_V3T', v3, 10, '#111827'),
      ]),
      txt(id + '_U', unit, 10, '#9CA3AF'),
    ]);
  }

  right.children = [
    // 标题栏
    frame(P + '_RIGHT_H', { width: 'fill_container', height: 24, fill: '#F3F3F3', layout: 'horizontal', padding: [3, 8] }, [
      txt(P + '_RIGHT_H_TXT', '属性-零件', 12, '#374151', { fontWeight: '600' }),
    ]),
    // 基本属性
    sectionHeader(P + '_SEC_BASIC', '基本属性'),
    propRow(P + '_P_NAME', '名称', 'pitch_del_cilindro_1', true),
    propRow(P + '_P_TYPE', '类型', '零件'),
    checkboxRow(P + '_P_VIS', '可见性', true),
    colorRow(P + '_P_COLOR', '颜色', '#F59E0B'),
    checkboxRow(P + '_P_TRANS', '半透明', false),
    // 分隔
    frame(P + '_SEP1', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
    // 物理属性
    sectionHeader(P + '_SEC_PHYS', '物理属性'),
    propRow(P + '_P_COUNT', '零件个数', '1', true),
    dropdownRow(P + '_P_MAT', '材料', '钢:7800kg/m³'),
    propRow(P + '_P_DENSITY', '密度', '7800 kg/m³'),
    propRow(P + '_P_MASS', '总质量', '1.72873 kg'),
    propRow(P + '_P_VOL', '体积', '2.216e-4 m³'),
    // 质心
    txt(P + '_P_COM_H', '  质心', 12, '#6B7280', { fontWeight: '600' }),
    tripleRow(P + '_P_COM', '', '1.49e-7', '0.6934', '1.2879', 'm'),
    // 惯性张量
    txt(P + '_P_INR_H', '  惯性张量', 12, '#6B7280', { fontWeight: '600' }),
    tripleRow(P + '_P_I1', '', '0.00755', '0.00000', '0.00000', ''),
    tripleRow(P + '_P_I2', '', '0.00000', '0.00753', '-0.00019', ''),
    tripleRow(P + '_P_I3', '', '0.00000', '-0.00019', '0.00xxx', 'kg·m²'),
    // 分隔
    frame(P + '_SEP2', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
    // 导出
    sectionHeader(P + '_SEC_EXP', '导出'),
    dropdownRow(P + '_P_MESH', '网格精度', '中'),
  ];
}

// ─── P1: Fix View Area and Window Chrome ──────────────────
function fixViewAndChrome(screen) {
  const P = screen.id.replace('_SCREEN', '');

  // 1. Fix Title Bar: Quick Access Toolbar + Title + Window Controls
  const title = findNode(screen, P + '_TITLE');
  if (title) {
    title.height = 30;
    title.fill = '#E0E0E0';
    title.layout = 'horizontal';
    title.padding = [3, 6];
    title.gap = 0;
    title.children = [
      // Quick Access Toolbar
      frame(P + '_QAT', { height: 24, layout: 'horizontal', gap: 2 }, [
        frame(P + '_QAT_APP', { width: 20, height: 20, fill: '#1774D0', cornerRadius: 3 }, [
          txt(P + '_QAT_APP_T', '⚙', 12, '#FFFFFF'),
        ]),
        frame(P + '_QAT_UNDO', { width: 22, height: 20, fill: '#D1D5DB', cornerRadius: 3 }, [
          txt(P + '_QAT_UNDO_T', '↩', 13, '#374151'),
        ]),
        frame(P + '_QAT_REDO', { width: 22, height: 20, fill: '#D1D5DB', cornerRadius: 3 }, [
          txt(P + '_QAT_REDO_T', '↪', 13, '#374151'),
        ]),
      ]),
      // Spacer
      frame(P + '_TITLE_SP1', { width: 'fill_container', height: 1 }),
      // Title text
      txt(P + '_TITLE_TXT', P === 'MB' ? 'CAD 工具 - bulldozer.STEP' : 'CAD 工具 - FuelTank.STEP', 13, '#1F2937'),
      // Spacer
      frame(P + '_TITLE_SP2', { width: 'fill_container', height: 1 }),
      // Window controls
      frame(P + '_WINCTL', { height: 24, layout: 'horizontal', gap: 0 }, [
        frame(P + '_WIN_HELP', { width: 30, height: 22 }, [txt(P + '_WIN_HELP_T', '?', 14, '#374151')]),
        frame(P + '_WIN_MIN', { width: 30, height: 22 }, [txt(P + '_WIN_MIN_T', '—', 13, '#374151')]),
        frame(P + '_WIN_MAX', { width: 30, height: 22 }, [txt(P + '_WIN_MAX_T', '☐', 13, '#374151')]),
        frame(P + '_WIN_CLOSE', { width: 30, height: 22, fill: '#E81123' }, [txt(P + '_WIN_CLOSE_T', '✕', 13, '#FFFFFF')]),
      ]),
    ];
  }

  // 2. Fix Tab Bar: smaller font
  const tabMulti = findNode(screen, P + '_TAB_MULTI');
  const tabFluid = findNode(screen, P + '_TAB_FLUID');
  const tab = findNode(screen, P + '_TAB');
  if (tab) { tab.height = 24; tab.padding = [3, 10]; tab.gap = 14; }
  if (tabMulti) {
    tabMulti.fontSize = 13;
    tabMulti.fontWeight = P === 'MB' ? '700' : '400';
    tabMulti.fill = P === 'MB' ? '#2563EB' : '#6B7280';
  }
  if (tabFluid) {
    tabFluid.fontSize = 13;
    tabFluid.fontWeight = P === 'FL' ? '700' : '400';
    tabFluid.fill = P === 'FL' ? '#2563EB' : '#6B7280';
  }

  // 3. Hide MB_POPUP
  const popup = findNode(screen, P + '_POPUP');
  if (popup) { popup.height = 0; popup.children = []; }

  // 4. Fix 3D View Area
  const view = findNode(screen, P + '_VIEW');
  if (view) {
    view.layout = undefined; // absolute positioning inside
    view.fill = '#C5CDD6';
    view.children = [
      // Background gradient simulation
      frame(P + '_VIEW_BG', { x: 0, y: 0, width: 'fill_container', height: 'fill_container', fill: '#BCC4CE' }),
      // Grid lines hint (bottom area)
      frame(P + '_VIEW_GRID', { x: 50, y: 280, width: 500, height: 200, fill: '#B8C2CE', cornerRadius: 0 }, [
        // grid lines as thin frames
        frame(P + '_GL1', { x: 0, y: 0, width: 500, height: 1, fill: '#A8B5C4' }),
        frame(P + '_GL2', { x: 0, y: 40, width: 500, height: 1, fill: '#A8B5C4' }),
        frame(P + '_GL3', { x: 0, y: 80, width: 500, height: 1, fill: '#A8B5C4' }),
        frame(P + '_GL4', { x: 0, y: 120, width: 500, height: 1, fill: '#A8B5C4' }),
        frame(P + '_GL5', { x: 0, y: 160, width: 500, height: 1, fill: '#A8B5C4' }),
        frame(P + '_GLV1', { x: 0, y: 0, width: 1, height: 200, fill: '#A8B5C4' }),
        frame(P + '_GLV2', { x: 100, y: 0, width: 1, height: 200, fill: '#A8B5C4' }),
        frame(P + '_GLV3', { x: 200, y: 0, width: 1, height: 200, fill: '#A8B5C4' }),
        frame(P + '_GLV4', { x: 300, y: 0, width: 1, height: 200, fill: '#A8B5C4' }),
        frame(P + '_GLV5', { x: 400, y: 0, width: 1, height: 200, fill: '#A8B5C4' }),
      ]),
      // Placeholder text for 3D model
      txt(P + '_VIEW_HINT', '[ 3D 模型渲染区 ]', 16, '#8896A6'),
      // View Toolbar (centered at top)
      frame(P + '_VTB', { x: 220, y: 8, width: 200, height: 30, fill: '#FFFFFF', cornerRadius: 15, stroke: '#D1D5DB', strokeWidth: 1, layout: 'horizontal', gap: 4, padding: [3, 8] }, [
        frame(P + '_VTB1', { width: 24, height: 24, fill: '#E5E7EB', cornerRadius: 12 }, [txt(P + '_VTB1_T', '⊞', 14, '#374151')]),
        frame(P + '_VTB2', { width: 24, height: 24, fill: '#E5E7EB', cornerRadius: 12 }, [txt(P + '_VTB2_T', '⊡', 14, '#374151')]),
        frame(P + '_VTB3', { width: 24, height: 24, fill: '#E5E7EB', cornerRadius: 12 }, [txt(P + '_VTB3_T', '◲', 14, '#374151')]),
        frame(P + '_VTB4', { width: 24, height: 24, fill: '#E5E7EB', cornerRadius: 12 }, [txt(P + '_VTB4_T', '▧', 14, '#374151')]),
        frame(P + '_VTB5', { width: 24, height: 24, fill: '#E5E7EB', cornerRadius: 12 }, [txt(P + '_VTB5_T', '◈', 14, '#374151')]),
        frame(P + '_VTB6', { width: 24, height: 24, fill: '#E5E7EB', cornerRadius: 12 }, [txt(P + '_VTB6_T', '◉', 14, '#374151')]),
      ]),
      // ViewCube (top-right)
      frame(P + '_VCUBE', { x: 500, y: 10, width: 60, height: 60, fill: '#E5E7EB', cornerRadius: 4, stroke: '#9CA3AF', strokeWidth: 1 }, [
        txt(P + '_VCUBE_FR', 'Front', 9, '#374151'),
        frame(P + '_VCUBE_R', { x: 40, y: 10, width: 18, height: 40, fill: '#D1D5DB', cornerRadius: 2 }, [
          txt(P + '_VCUBE_RT', 'R', 8, '#6B7280'),
        ]),
        frame(P + '_VCUBE_TOP', { x: 10, y: 0, width: 40, height: 14, fill: '#D1D5DB', cornerRadius: 2 }, [
          txt(P + '_VCUBE_TT', 'Top', 8, '#6B7280'),
        ]),
      ]),
      // Coordinate Axes (bottom-left)
      frame(P + '_AXES', { x: 10, y: 420, width: 50, height: 50 }, [
        frame(P + '_AX_X', { x: 20, y: 30, width: 25, height: 2, fill: '#EF4444' }),
        txt(P + '_AX_XT', 'X', 10, '#EF4444'),
        frame(P + '_AX_Y', { x: 20, y: 5, width: 2, height: 25, fill: '#22C55E' }),
        txt(P + '_AX_YT', 'Y', 10, '#22C55E'),
        frame(P + '_AX_Z', { x: 12, y: 18, width: 2, height: 20, fill: '#3B82F6' }),
        txt(P + '_AX_ZT', 'Z', 10, '#3B82F6'),
      ]),
    ];
  }

  // 5. Fix Status Bar
  const status = findNode(screen, P + '_STATUS');
  if (status) {
    status.layout = 'horizontal';
    status.padding = [2, 10];
    status.children = [
      txt(P + '_STATUS_L', '就绪', 12, '#FFFFFF'),
      frame(P + '_STATUS_SP', { width: 'fill_container', height: 1 }),
      txt(P + '_STATUS_R', 'X = 0.722903  Y = 0.630869  Z = 0.193035', 11, '#E0E0E0'),
    ];
  }
}

// ─── P1: Rebuild key scenario screens ─────────────────────
function buildConnectorScene(screen) {
  const P = screen.id.replace('_SCREEN', '');

  // 先应用基础修复
  fixRibbon(screen);
  fixLeftPanel(screen);
  fixViewAndChrome(screen);

  // 标题
  const titleTxt = findNode(screen, P + '_TITLE_TXT');
  if (titleTxt) titleTxt.content = 'CAD 工具 - bulldozer.STEP [添加连接]';

  // 右侧改为"选项-连接"面板
  const right = findNode(screen, P + '_RIGHT');
  if (!right) return;

  right.width = 280;
  right.fill = '#F9FAFB';
  right.layout = 'vertical';
  right.gap = 0;

  function inputField(id, value) {
    return frame(id, { width: 'fill_container', height: 22, fill: '#FFFFFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [2, 6] }, [
      txt(id + '_T', value, 12, '#111827'),
    ]);
  }

  function pickBtn(id, label) {
    return frame(id, { width: 'fill_container', height: 28, fill: '#EFF6FF', stroke: '#93C5FD', strokeWidth: 1, cornerRadius: 4, padding: [4, 8], layout: 'horizontal', gap: 4 }, [
      iconBox(id + '_ICO', 14, '#3B82F6', 3),
      txt(id + '_T', label, 12, '#2563EB'),
    ]);
  }

  function coordGroup(id, label, x, y, z) {
    return frame(id, { width: 'fill_container', layout: 'vertical', gap: 2, padding: [2, 8] }, [
      txt(id + '_H', label, 11, '#6B7280', { fontWeight: '600' }),
      frame(id + '_ROW', { width: 'fill_container', height: 22, layout: 'horizontal', gap: 3 }, [
        txt(id + '_XL', 'X', 10, '#9CA3AF'),
        frame(id + '_XV', { width: 'fill_container', height: 20, fill: '#FFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [txt(id + '_XT', x, 10, '#111827')]),
        txt(id + '_YL', 'Y', 10, '#9CA3AF'),
        frame(id + '_YV', { width: 'fill_container', height: 20, fill: '#FFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [txt(id + '_YT', y, 10, '#111827')]),
        txt(id + '_ZL', 'Z', 10, '#9CA3AF'),
        frame(id + '_ZV', { width: 'fill_container', height: 20, fill: '#FFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [txt(id + '_ZT', z, 10, '#111827')]),
      ]),
    ]);
  }

  right.children = [
    frame(P + '_OPT_H', { width: 'fill_container', height: 24, fill: '#F3F3F3', layout: 'horizontal', padding: [3, 8] }, [
      txt(P + '_OPT_HT', '选项-连接', 12, '#374151', { fontWeight: '600' }),
      frame(P + '_OPT_SP', { width: 'fill_container', height: 1 }),
      txt(P + '_OPT_CLOSE', '✕', 12, '#9CA3AF'),
    ]),
    frame(P + '_OPT_BODY', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      // 名称
      frame(P + '_OPT_NR', { width: 'fill_container', layout: 'horizontal', gap: 4 }, [
        txt(P + '_OPT_NL', '名称', 12, '#6B7280', { width: 50 }),
        inputField(P + '_OPT_NV', 'revolute_arm_base'),
      ]),
      // 类型
      frame(P + '_OPT_TR', { width: 'fill_container', layout: 'horizontal', gap: 4 }, [
        txt(P + '_OPT_TL', '类型', 12, '#6B7280', { width: 50 }),
        frame(P + '_OPT_TD', { width: 'fill_container', height: 22, fill: '#FFFFFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, layout: 'horizontal', padding: [2, 6] }, [
          txt(P + '_OPT_TDT', '转动副', 12, '#111827'),
          txt(P + '_OPT_TDA', '▼', 9, '#9CA3AF'),
        ]),
      ]),
      // 图标大小滑块
      frame(P + '_OPT_ISR', { width: 'fill_container', layout: 'horizontal', gap: 4 }, [
        txt(P + '_OPT_ISL', '图标大小', 12, '#6B7280', { width: 50 }),
        frame(P + '_OPT_SLIDER', { width: 'fill_container', height: 6, fill: '#E5E7EB', cornerRadius: 3 }, [
          frame(P + '_OPT_THUMB', { x: 40, y: -4, width: 14, height: 14, fill: '#3B82F6', cornerRadius: 7 }),
        ]),
      ]),
      // 分隔线
      frame(P + '_OPT_S1', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
      // Part 1
      txt(P + '_OPT_P1H', '零件 1', 12, '#DC2626', { fontWeight: '600' }),
      pickBtn(P + '_OPT_P1', '点击3D视图选择零件 1'),
      // Part 2
      txt(P + '_OPT_P2H', '零件 2', 12, '#2563EB', { fontWeight: '600' }),
      pickBtn(P + '_OPT_P2', '点击3D视图选择零件 2'),
      // 分隔线
      frame(P + '_OPT_S2', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
      // 位置
      coordGroup(P + '_OPT_POS', '位置 (全局坐标)', '0.352', '0.693', '1.288'),
      // 方向
      coordGroup(P + '_OPT_DIR', '方向 (Rx/Ry/Rz °)', '0.0', '0.0', '90.0'),
      // Z轴反转
      frame(P + '_OPT_ZREV', { width: 'fill_container', height: 22, layout: 'horizontal', gap: 4, padding: [2, 0] }, [
        frame(P + '_OPT_ZREV_CB', { width: 14, height: 14, fill: '#FFFFFF', stroke: '#9CA3AF', strokeWidth: 1, cornerRadius: 3 }),
        txt(P + '_OPT_ZREV_T', 'Z轴反转', 12, '#374151'),
      ]),
      // 分隔线
      frame(P + '_OPT_S3', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
      // 模式切换
      frame(P + '_OPT_MODE', { width: 'fill_container', height: 28, layout: 'horizontal', gap: 6 }, [
        frame(P + '_OPT_FLASH', { width: 'fill_container', height: 26, fill: '#DBEAFE', cornerRadius: 4, stroke: '#3B82F6', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_OPT_FLASH_T', '⚡ 闪电模式', 11, '#2563EB', { fontWeight: '600' }),
        ]),
        frame(P + '_OPT_STD', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_OPT_STD_T', '📋 标准模式', 11, '#6B7280'),
        ]),
      ]),
    ]),
  ];

  // 状态栏
  const statusL = findNode(screen, P + '_STATUS_L');
  if (statusL) statusL.content = '添加连接：请选择两个零件';
}

function buildMeasureScene(screen) {
  const P = screen.id.replace('_SCREEN', '');

  fixRibbon(screen);
  fixLeftPanel(screen);
  fixViewAndChrome(screen);

  const titleTxt = findNode(screen, P + '_TITLE_TXT');
  if (titleTxt) titleTxt.content = 'CAD 工具 - Robot.STEP [测量]';

  const right = findNode(screen, P + '_RIGHT');
  if (!right) return;

  right.width = 280;
  right.fill = '#F9FAFB';
  right.layout = 'vertical';
  right.gap = 0;

  right.children = [
    frame(P + '_OPT_H', { width: 'fill_container', height: 24, fill: '#F3F3F3', layout: 'horizontal', padding: [3, 8] }, [
      txt(P + '_OPT_HT', '选项-测量', 12, '#374151', { fontWeight: '600' }),
      frame(P + '_OPT_SP', { width: 'fill_container', height: 1 }),
      txt(P + '_OPT_CLOSE', '✕', 12, '#9CA3AF'),
    ]),
    // 测量工具栏
    frame(P + '_M_TB', { width: 'fill_container', height: 32, fill: '#F9FAFB', layout: 'horizontal', gap: 4, padding: [4, 8] }, [
      frame(P + '_M_TB1', { width: 28, height: 28, fill: '#E5E7EB', cornerRadius: 4, stroke: '#9CA3AF', strokeWidth: 1 }, [txt(P + '_M_TB1_T', '⊙', 16, '#374151')]),
      frame(P + '_M_TB2', { width: 28, height: 28, fill: '#DBEAFE', cornerRadius: 4, stroke: '#3B82F6', strokeWidth: 1 }, [txt(P + '_M_TB2_T', '↕', 16, '#2563EB')]),
      frame(P + '_M_TB3', { width: 28, height: 28, fill: '#E5E7EB', cornerRadius: 4, stroke: '#9CA3AF', strokeWidth: 1 }, [txt(P + '_M_TB3_T', '↔', 16, '#374151')]),
    ]),
    // 选择项
    frame(P + '_M_SEL', { width: 'fill_container', layout: 'vertical', gap: 2, padding: [4, 8] }, [
      txt(P + '_M_SELH', '选择项', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_M_SELBOX', { width: 'fill_container', height: 60, fill: '#FFFFFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [4, 6], layout: 'vertical', gap: 2 }, [
        txt(P + '_M_S1', 'upperarm_1_face <48>', 11, '#111827'),
        txt(P + '_M_S2', 'base_1_face <266>', 11, '#111827'),
      ]),
    ]),
    // 分隔
    frame(P + '_M_SP1', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
    // 测量结果表格
    frame(P + '_M_RES', { width: 'fill_container', layout: 'vertical', gap: 0, padding: [4, 8] }, [
      txt(P + '_M_RESH', '测量结果', 12, '#6B7280', { fontWeight: '600' }),
      // Table header
      frame(P + '_M_TH', { width: 'fill_container', height: 24, fill: '#F3F4F6', layout: 'horizontal', padding: [2, 4] }, [
        txt(P + '_M_TH1', '测量类型', 11, '#6B7280', { fontWeight: '600', width: 130 }),
        txt(P + '_M_TH2', '测量值', 11, '#6B7280', { fontWeight: '600' }),
      ]),
      // Row 1
      frame(P + '_M_R1', { width: 'fill_container', height: 22, fill: '#FFFFFF', layout: 'horizontal', padding: [2, 4], stroke: '#F3F4F6', strokeWidth: 1 }, [
        txt(P + '_M_R1C1', '角度', 11, '#374151', { width: 130 }),
        txt(P + '_M_R1C2', '5°', 11, '#111827'),
      ]),
      // Row 2
      frame(P + '_M_R2', { width: 'fill_container', height: 22, fill: '#F9FAFB', layout: 'horizontal', padding: [2, 4] }, [
        txt(P + '_M_R2C1', 'face <48> 面积', 11, '#374151', { width: 130 }),
        txt(P + '_M_R2C2', '0.00316 m²', 11, '#111827'),
      ]),
      // Row 3
      frame(P + '_M_R3', { width: 'fill_container', height: 22, fill: '#FFFFFF', layout: 'horizontal', padding: [2, 4], stroke: '#F3F4F6', strokeWidth: 1 }, [
        txt(P + '_M_R3C1', 'face <266> 面积', 11, '#374151', { width: 130 }),
        txt(P + '_M_R3C2', '0.00525 m²', 11, '#111827'),
      ]),
      // Row 4 - distance
      frame(P + '_M_R4', { width: 'fill_container', height: 22, fill: '#F9FAFB', layout: 'horizontal', padding: [2, 4] }, [
        txt(P + '_M_R4C1', '距离', 11, '#374151', { width: 130 }),
        txt(P + '_M_R4C2', '0.12874 m', 11, '#111827', { fontWeight: '600' }),
      ]),
      // Row 5 - dx
      frame(P + '_M_R5', { width: 'fill_container', height: 22, fill: '#FFFFFF', layout: 'horizontal', padding: [2, 4], stroke: '#F3F4F6', strokeWidth: 1 }, [
        txt(P + '_M_R5C1', 'dx', 11, '#9CA3AF', { width: 130 }),
        txt(P + '_M_R5C2', '4.485e-17 m', 11, '#6B7280'),
      ]),
    ]),
    // 退出按钮
    frame(P + '_M_EXIT', { width: 'fill_container', height: 32, padding: [4, 8] }, [
      frame(P + '_M_EXIT_BTN', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, layout: 'horizontal', gap: 4, padding: [4, 8] }, [
        frame(P + '_M_EXIT_SP', { width: 'fill_container', height: 1 }),
        txt(P + '_M_EXIT_T', '▶ 退出', 12, '#374151'),
      ]),
    ]),
  ];

  const statusL = findNode(screen, P + '_STATUS_L');
  if (statusL) statusL.content = '测量：选中 2 个特征';
}

function buildExplodedScene(screen) {
  const P = screen.id.replace('_SCREEN', '');

  fixRibbon(screen);
  fixLeftPanel(screen);
  fixViewAndChrome(screen);

  const titleTxt = findNode(screen, P + '_TITLE_TXT');
  if (titleTxt) titleTxt.content = 'CAD 工具 - bulldozer.STEP [爆炸视图]';

  const right = findNode(screen, P + '_RIGHT');
  if (!right) return;

  right.width = 280;
  right.fill = '#F9FAFB';
  right.layout = 'vertical';
  right.gap = 0;

  right.children = [
    frame(P + '_OPT_H', { width: 'fill_container', height: 24, fill: '#F3F3F3', layout: 'horizontal', padding: [3, 8] }, [
      txt(P + '_OPT_HT', '选项-爆炸视图', 12, '#374151', { fontWeight: '600' }),
      frame(P + '_OPT_SP', { width: 'fill_container', height: 1 }),
      txt(P + '_OPT_CLOSE', '✕', 12, '#9CA3AF'),
    ]),
    frame(P + '_EXP_BODY', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 8, padding: [8, 8] }, [
      // 选中零件列表
      txt(P + '_EXP_SELH', '选中零件', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_EXP_LIST', { width: 'fill_container', height: 80, fill: '#FFFFFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [4, 6], layout: 'vertical', gap: 2 }, [
        txt(P + '_EXP_L1', '✓ arm', 11, '#111827'),
        txt(P + '_EXP_L2', '✓ pala', 11, '#111827'),
        txt(P + '_EXP_L3', '✓ lifting_hydraulic_cylinder', 11, '#111827'),
        txt(P + '_EXP_L4', '✓ lifting_hydraulic_rod', 11, '#111827'),
      ]),
      // 分隔
      frame(P + '_EXP_S1', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
      // 爆炸模式
      txt(P + '_EXP_MDH', '爆炸模式', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_EXP_MDROW', { width: 'fill_container', height: 28, layout: 'horizontal', gap: 6 }, [
        frame(P + '_EXP_MD1', { width: 'fill_container', height: 26, fill: '#DBEAFE', cornerRadius: 4, stroke: '#3B82F6', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_EXP_MD1T', '按分组', 11, '#2563EB', { fontWeight: '600' }),
        ]),
        frame(P + '_EXP_MD2', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_EXP_MD2T', '按零件', 11, '#6B7280'),
        ]),
      ]),
      // 分隔
      frame(P + '_EXP_S2', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
      // 爆炸因子
      txt(P + '_EXP_FCH', '爆炸因子', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_EXP_SLIDER', { width: 'fill_container', height: 30, layout: 'horizontal', gap: 8 }, [
        txt(P + '_EXP_SL_0', '0', 10, '#9CA3AF'),
        frame(P + '_EXP_SL_BAR', { width: 'fill_container', height: 6, fill: '#E5E7EB', cornerRadius: 3 }, [
          frame(P + '_EXP_SL_FILL', { x: 0, y: 0, width: 100, height: 6, fill: '#3B82F6', cornerRadius: 3 }),
          frame(P + '_EXP_SL_THUMB', { x: 95, y: -5, width: 16, height: 16, fill: '#3B82F6', cornerRadius: 8, stroke: '#FFFFFF', strokeWidth: 2 }),
        ]),
        txt(P + '_EXP_SL_100', '100', 10, '#9CA3AF'),
      ]),
      txt(P + '_EXP_SL_VAL', '当前值：55', 11, '#374151'),
    ]),
  ];

  const statusL = findNode(screen, P + '_STATUS_L');
  if (statusL) statusL.content = '爆炸视图：选中 4 个零件';
}

// ─── P2: Settings Dialog ──────────────────────────────────
function buildSettingsDialog() {
  return frame('SETTINGS_SCREEN', {
    name: '设置对话框',
    x: 0, y: -900,
    width: 520, height: 450,
    fill: '#FFFFFF', cornerRadius: 8,
    stroke: '#D1D5DB', strokeWidth: 1,
    layout: 'vertical', gap: 0,
    clip: true,
  }, [
    // Dialog title bar
    frame('SET_TITLEBAR', { width: 'fill_container', height: 36, fill: '#F3F4F6', layout: 'horizontal', padding: [6, 12] }, [
      txt('SET_TITLE', '设置', 14, '#1F2937', { fontWeight: '600' }),
      frame('SET_SP', { width: 'fill_container', height: 1 }),
      frame('SET_CLOSE', { width: 24, height: 24, cornerRadius: 4 }, [txt('SET_CLOSE_T', '✕', 14, '#6B7280')]),
    ]),
    // Tabs
    frame('SET_TABS', { width: 'fill_container', height: 32, fill: '#F9FAFB', layout: 'horizontal', padding: [0, 12], gap: 0 }, [
      frame('SET_TAB1', { width: 80, height: 32, fill: '#FFFFFF', padding: [6, 0] }, [
        txt('SET_TAB1_T', '显示', 13, '#2563EB', { fontWeight: '600' }),
      ]),
      frame('SET_TAB2', { width: 80, height: 32, padding: [6, 0] }, [
        txt('SET_TAB2_T', '鼠标样式', 13, '#6B7280'),
      ]),
    ]),
    // Display settings content
    frame('SET_CONTENT', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 8, padding: [12, 16] }, [
      // 外观
      txt('SET_APP_H', '外观', 13, '#1F2937', { fontWeight: '600' }),
      frame('SET_APP_VC', { width: 'fill_container', height: 24, layout: 'horizontal', gap: 8 }, [
        frame('SET_APP_VC_CB', { width: 16, height: 16, fill: '#2563EB', cornerRadius: 3, stroke: '#2563EB', strokeWidth: 1 }, [
          txt('SET_APP_VC_CK', '✓', 11, '#FFFFFF'),
        ]),
        txt('SET_APP_VC_T', '显示视图方块', 12, '#374151'),
      ]),
      frame('SET_APP_AX', { width: 'fill_container', height: 24, layout: 'horizontal', gap: 8 }, [
        frame('SET_APP_AX_CB', { width: 16, height: 16, fill: '#2563EB', cornerRadius: 3, stroke: '#2563EB', strokeWidth: 1 }, [
          txt('SET_APP_AX_CK', '✓', 11, '#FFFFFF'),
        ]),
        txt('SET_APP_AX_T', '显示参考坐标轴', 12, '#374151'),
      ]),
      frame('SET_APP_IS', { width: 'fill_container', height: 24, layout: 'horizontal', gap: 8 }, [
        txt('SET_APP_IS_L', '全局图标大小', 12, '#6B7280', { width: 100 }),
        frame('SET_APP_IS_V', { width: 60, height: 22, fill: '#FFFFFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [2, 6] }, [
          txt('SET_APP_IS_VT', '100', 12, '#111827'),
        ]),
      ]),
      frame('SET_SP1', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
      // 背景颜色
      txt('SET_BG_H', '背景颜色', 13, '#1F2937', { fontWeight: '600' }),
      frame('SET_BG_ROW', { width: 'fill_container', height: 30, layout: 'horizontal', gap: 8 }, [
        frame('SET_BG_1', { width: 40, height: 26, cornerRadius: 4, fill: '#4B5563', stroke: '#2563EB', strokeWidth: 2 }),
        frame('SET_BG_2', { width: 40, height: 26, cornerRadius: 4, fill: '#D1D5DB' }),
        frame('SET_BG_3', { width: 40, height: 26, cornerRadius: 4, fill: '#6B8E6B' }),
        frame('SET_BG_4', { width: 40, height: 26, cornerRadius: 4, fill: '#4B6B8E' }),
        frame('SET_BG_5', { width: 40, height: 26, cornerRadius: 4, fill: '#6B4B8E' }),
      ]),
      frame('SET_SP2', { width: 'fill_container', height: 1, fill: '#E5E7EB' }),
      // 网格线
      txt('SET_GRID_H', '网格线', 13, '#1F2937', { fontWeight: '600' }),
      frame('SET_GRID_ROW', { width: 'fill_container', height: 24, layout: 'horizontal', gap: 8 }, [
        frame('SET_GRID_CB', { width: 16, height: 16, fill: '#2563EB', cornerRadius: 3 }, [
          txt('SET_GRID_CK', '✓', 11, '#FFFFFF'),
        ]),
        txt('SET_GRID_T', '显示 Z-X 平面网格', 12, '#374151'),
      ]),
      frame('SET_GRID_SP', { width: 'fill_container', height: 24, layout: 'horizontal', gap: 8 }, [
        txt('SET_GRID_SP_L', '网格间距', 12, '#6B7280', { width: 100 }),
        frame('SET_GRID_SP_V', { width: 60, height: 22, fill: '#FFFFFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [2, 6] }, [
          txt('SET_GRID_SP_VT', '0.1 m', 12, '#111827'),
        ]),
      ]),
    ]),
  ]);
}

// ─── P2: Context Menus ────────────────────────────────────
function buildContextMenus() {
  function menuItem(id, label, shortcut) {
    return frame(id, { width: 'fill_container', height: 26, layout: 'horizontal', padding: [3, 10], gap: 4 }, [
      txt(id + '_T', label, 12, '#374151'),
      frame(id + '_SP', { width: 'fill_container', height: 1 }),
      ...(shortcut ? [txt(id + '_K', shortcut, 11, '#9CA3AF')] : []),
    ]);
  }

  function menuSep(id) {
    return frame(id, { width: 'fill_container', height: 1, fill: '#E5E7EB' });
  }

  return frame('CTXMENU_SCREEN', {
    name: '右键菜单集合',
    x: 600, y: -900,
    width: 700, height: 350,
    fill: '#F9FAFB',
    layout: 'horizontal', gap: 40, padding: [20, 20],
  }, [
    // Menu 1: 零件右键
    frame('CTX_PART', { width: 180, layout: 'vertical', fill: '#FFFFFF', cornerRadius: 6, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 0] }, [
      txt('CTX_PART_H', '零件右键菜单', 10, '#9CA3AF', { padding: [0, 10] }),
      menuItem('CTX_P_1', '组合', 'Ctrl+G'),
      menuItem('CTX_P_2', '移动到...', ''),
      menuSep('CTX_P_S1'),
      menuItem('CTX_P_3', '删除', 'Del'),
      menuSep('CTX_P_S2'),
      menuItem('CTX_P_4', '隐藏', 'H'),
      menuItem('CTX_P_5', '仅显示此项', ''),
      menuItem('CTX_P_6', '显示全部', ''),
    ]),
    // Menu 2: 分组右键
    frame('CTX_GROUP', { width: 180, layout: 'vertical', fill: '#FFFFFF', cornerRadius: 6, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 0] }, [
      txt('CTX_GROUP_H', '分组右键菜单', 10, '#9CA3AF', { padding: [0, 10] }),
      menuItem('CTX_G_1', '组合', ''),
      menuItem('CTX_G_2', '分解', ''),
      menuItem('CTX_G_3', '移动到...', ''),
      menuSep('CTX_G_S1'),
      menuItem('CTX_G_4', '删除', 'Del'),
      menuSep('CTX_G_S2'),
      menuItem('CTX_G_5', '隐藏', 'H'),
      menuItem('CTX_G_6', '显示全部', ''),
    ]),
    // Menu 3: 3D 视图右键（无选中）
    frame('CTX_VIEW', { width: 180, layout: 'vertical', fill: '#FFFFFF', cornerRadius: 6, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 0] }, [
      txt('CTX_VIEW_H', '视图右键菜单', 10, '#9CA3AF', { padding: [0, 10] }),
      menuItem('CTX_V_1', '缩放至最佳', 'F'),
      menuSep('CTX_V_S1'),
      menuItem('CTX_V_2', '正视图', 'Shift+F'),
      menuItem('CTX_V_3', '俯视图', 'Shift+M'),
      menuItem('CTX_V_4', '等轴测', 'Shift+I'),
      menuSep('CTX_V_S2'),
      menuItem('CTX_V_5', '线框模式', ''),
      menuItem('CTX_V_6', '着色模式', ''),
      menuItem('CTX_V_7', '边线着色', ''),
    ]),
  ]);
}

// ─── Apply all fixes ──────────────────────────────────────
const mb = pen.children[0]; // MB_SCREEN
const fl = pen.children[1]; // FL_SCREEN

console.log('Fixing MB_SCREEN Ribbon...');
fixRibbon(mb);
console.log('Fixing FL_SCREEN Ribbon...');
fixRibbon(fl);

console.log('Fixing MB_SCREEN Left Panel...');
fixLeftPanel(mb);
console.log('Fixing FL_SCREEN Left Panel...');
fixLeftPanel(fl);

console.log('Fixing MB_SCREEN Right Panel...');
fixRightPanel(mb);
console.log('Fixing FL_SCREEN Right Panel...');
fixRightPanel(fl);

console.log('Fixing MB_SCREEN View & Chrome...');
fixViewAndChrome(mb);
console.log('Fixing FL_SCREEN View & Chrome...');
fixViewAndChrome(fl);

// Fix SC02 (添加连接) - index 3 in children array
console.log('Rebuilding SC02 (添加连接)...');
const sc02 = pen.children[3];
buildConnectorScene(sc02);

// Fix SC23 (测量) - index 24
console.log('Rebuilding SC23 (测量)...');
const sc23 = pen.children[24];
buildMeasureScene(sc23);

// Fix SC09 (爆炸视图) - index 10
console.log('Rebuilding SC09 (爆炸视图)...');
const sc09 = pen.children[10];
buildExplodedScene(sc09);

// Add Settings Dialog and Context Menus
console.log('Adding Settings Dialog...');
pen.children.push(buildSettingsDialog());
console.log('Adding Context Menus...');
pen.children.push(buildContextMenus());

// Write back
fs.writeFileSync(penPath, JSON.stringify(pen, null, 2) + '\n', 'utf8');
console.log(`Done! Total screens: ${pen.children.length}`);
