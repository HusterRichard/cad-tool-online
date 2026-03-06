/**
 * fix-all-scenes.mjs
 * 对所有 SC01-SC60 场景画板统一基线修复：
 *   1) 通用：Ribbon + 左面板树 + 3D视图区 + 状态栏 + 窗口控件
 *   2) 右面板根据场景类型自动匹配（选项-接触/连接/驱动/标架/设计点/材料/…或默认属性-零件）
 */
import fs from 'fs';

const penPath = 'cadtoolonline.pen';
const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));

// ─── helpers ───────────────────────────────────────────────
function findNode(node, id) {
  if (node == null) return null;
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

function bigBtn(id, label, color) {
  return frame(id, { width: 56, height: 80, layout: 'vertical', gap: 2, padding: [2, 4] }, [
    iconBox(id + '_ICO', 32, color, 6),
    txt(id + '_LBL', label, 11, '#374151', { textAlign: 'center' }),
  ]);
}

function smallBtn(id, label, color) {
  return frame(id, { width: 'fill_container', height: 22, layout: 'horizontal', gap: 4 }, [
    iconBox(id + '_ICO', 16, color, 3),
    txt(id + '_LBL', label, 12, '#111827'),
  ]);
}

function ribbonGroup(id, width, topChildren, sectionLabel) {
  return frame(id, { width, height: 'fill_container', fill: '#ECECEC', layout: 'vertical', gap: 2, padding: [4, 6] }, [
    frame(id + '_TOP', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 2 }, topChildren),
    frame(id + '_LBL_ROW', { width: 'fill_container', height: 16 }, [
      txt(id + '_T', sectionLabel, 11, '#6B7280', { textAlign: 'center' }),
    ]),
  ]);
}

function twoColRow(id, btn1, btn2) {
  return frame(id, { width: 'fill_container', height: 22, layout: 'horizontal', gap: 4 }, [btn1, btn2]);
}

// ─── Determine if a scene should use Fluid template ───────
function isFluidScene(name) {
  return /流体|油箱|切片|肋板|端口|Fluid|Slice|Rib|Tank|Port/i.test(name || '');
}

// ─── Determine right panel type from scene name ───────────
function detectRightPanelType(name) {
  const n = name || '';
  if (/接触|Contact/i.test(n)) return 'contact';
  if (/连接|运动副|Connector/i.test(n)) return 'connector';
  if (/驱动|Motion/i.test(n)) return 'drive';
  if (/标架|Marker/i.test(n)) return 'marker';
  if (/设计点|DesignPoint/i.test(n)) return 'designpoint';
  if (/材料|Material/i.test(n)) return 'material';
  if (/分组|Group/i.test(n)) return 'group';
  if (/测量|Measure/i.test(n)) return 'measure';
  if (/爆炸|Explod/i.test(n)) return 'exploded';
  if (/属性|Attribute/i.test(n)) return 'property';
  if (/曲面加厚|Thicken/i.test(n)) return 'thicken';
  if (/平面环|Planar.*Loop/i.test(n)) return 'planarloop';
  if (/导出|Modelica|Export/i.test(n)) return 'export';
  if (/油箱|切片|肋板|Slice|Tank|Rib/i.test(n)) return 'slice';
  if (/流体端口|FluidPort/i.test(n)) return 'fluidport';
  if (/流体设计/i.test(n)) return 'fluiddesign';
  if (/ERR|Error|错误码/i.test(n)) return 'error';
  return 'default';
}

// ─── Fix Ribbon (reuse from fix-pen-prototype) ────────────
function fixRibbon(screen) {
  const P = screen.id.replace('_SCREEN', '');
  const ribbon = findNode(screen, P + '_RIBBON');
  if (!ribbon) return;
  ribbon.height = 100;
  ribbon.padding = [4, 8];
  ribbon.gap = 6;

  const isFluid = isFluidScene(screen.name);

  if (!isFluid) {
    ribbon.children = [
      ribbonGroup(P + '_G_FILE', 110, [
        twoColRow(P + '_FR1', smallBtn(P + '_BTN_IMP', '导入', '#2563EB'), smallBtn(P + '_BTN_OPEN', '打开', '#2563EB')),
        twoColRow(P + '_FR2', smallBtn(P + '_BTN_SAVE', '保存', '#3B82F6'), smallBtn(P + '_BTN_SAVEAS', '另存为', '#3B82F6')),
      ], '文件'),
      divider(P + '_D1'),
      ribbonGroup(P + '_G_GROUP', 120, [
        twoColRow(P + '_GR1', smallBtn(P + '_BTN_MERGE', '组合', '#059669'), smallBtn(P + '_BTN_SPLIT', '分解', '#059669')),
        twoColRow(P + '_GR2', smallBtn(P + '_BTN_CLEAN', '清理', '#10B981'), smallBtn(P + '_BTN_DEFGRP', '默认分组', '#10B981')),
      ], '分组'),
      divider(P + '_D2'),
      ribbonGroup(P + '_G_BASIC', 90, [
        frame(P + '_BR1', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_MKR', '标架', '#7C3AED'),
          bigBtn(P + '_BTN_PT', '设计点', '#8B5CF6'),
        ]),
      ], '基本形状'),
      divider(P + '_D3'),
      ribbonGroup(P + '_G_CONNECT', 260, [
        frame(P + '_CR1', { width: 'fill_container', height: 38, layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_FIX', '固定副', '#DC2626'), bigBtn(P + '_BTN_REV', '转动副', '#EF4444'),
          bigBtn(P + '_BTN_PRI', '平移副', '#F87171'), bigBtn(P + '_BTN_CYL', '圆柱副', '#DC2626'),
        ]),
        frame(P + '_CR2', { width: 'fill_container', height: 38, layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_SPH', '球副', '#EF4444'), bigBtn(P + '_BTN_UNI', '万向节', '#F87171'),
          bigBtn(P + '_BTN_SCR', '螺旋副', '#DC2626'), bigBtn(P + '_BTN_PLN', '平面副', '#EF4444'),
        ]),
      ], '连接'),
      divider(P + '_D4'),
      ribbonGroup(P + '_G_DRIVE', 90, [
        frame(P + '_DRR', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_RDRV', '转动驱动', '#EA580C'), bigBtn(P + '_BTN_TDRV', '平移驱动', '#F97316'),
        ]),
      ], '驱动'),
      divider(P + '_D5'),
      ribbonGroup(P + '_G_FORCE', 90, [
        frame(P + '_FCR', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_PP', '点点接触', '#16A34A'), bigBtn(P + '_BTN_PS', '点面接触', '#22C55E'),
        ]),
      ], '力'),
      divider(P + '_D6'),
      ribbonGroup(P + '_G_TOOL', 180, [
        frame(P + '_TR1', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_MEAS', '测量', '#0891B2'), bigBtn(P + '_BTN_EXPL', '爆炸视图', '#06B6D4'),
          bigBtn(P + '_BTN_THK', '曲面加厚', '#0E7490'), bigBtn(P + '_BTN_LOOP', '平面环', '#0891B2'),
        ]),
      ], '工具'),
      divider(P + '_D7'),
      ribbonGroup(P + '_G_EXPORT', 90, [
        frame(P + '_ER', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_CHK', '检查', '#4B5563'), bigBtn(P + '_BTN_AE', '接受并退出', '#6B7280'),
        ]),
      ], '导出'),
      divider(P + '_D8'),
      ribbonGroup(P + '_G_SET', 50, [bigBtn(P + '_BTN_SET', '设置', '#6B7280')], '设置'),
      divider(P + '_D9'),
      ribbonGroup(P + '_G_ABT', 50, [bigBtn(P + '_BTN_ABT', '关于', '#9333EA')], '关于'),
    ];
  } else {
    ribbon.children = [
      ribbonGroup(P + '_G_FILE', 110, [
        twoColRow(P + '_FR1', smallBtn(P + '_BTN_IMP', '导入', '#2563EB'), smallBtn(P + '_BTN_OPEN', '打开', '#2563EB')),
        twoColRow(P + '_FR2', smallBtn(P + '_BTN_SAVE', '保存', '#3B82F6'), smallBtn(P + '_BTN_SAVEAS', '另存为', '#3B82F6')),
      ], '文件'),
      divider(P + '_D1'),
      ribbonGroup(P + '_G_SLICE', 180, [
        frame(P + '_SR', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_STANK', '简单油箱', '#0284C7'), bigBtn(P + '_BTN_TANK', '油箱切片', '#0369A1'),
          bigBtn(P + '_BTN_RIB', '肋板切片', '#0EA5E9'),
        ]),
      ], '切片'),
      divider(P + '_D2'),
      ribbonGroup(P + '_G_DESIGN', 60, [bigBtn(P + '_BTN_PORT', '流体端口', '#B45309')], '设计'),
      divider(P + '_D3'),
      ribbonGroup(P + '_G_TOOL', 140, [
        frame(P + '_TR1', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 2 }, [
          bigBtn(P + '_BTN_MEAS', '测量', '#0891B2'), bigBtn(P + '_BTN_EXPL', '爆炸视图', '#06B6D4'),
          bigBtn(P + '_BTN_THK', '曲面加厚', '#0E7490'),
        ]),
      ], '工具'),
      divider(P + '_D4'),
      ribbonGroup(P + '_G_EXPORT', 90, [
        frame(P + '_ER', { width: 'fill_container', height: 'fill_container', layout: 'horizontal', gap: 4 }, [
          bigBtn(P + '_BTN_CHK', '检查', '#4B5563'), bigBtn(P + '_BTN_AE', '接受并退出', '#6B7280'),
        ]),
      ], '导出'),
      divider(P + '_D5'),
      ribbonGroup(P + '_G_SET', 50, [bigBtn(P + '_BTN_SET', '设置', '#6B7280')], '设置'),
      divider(P + '_D6'),
      ribbonGroup(P + '_G_ABT', 50, [bigBtn(P + '_BTN_ABT', '关于', '#9333EA')], '关于'),
    ];
  }
}

// ─── Fix Left Panel ───────────────────────────────────────
function fixLeftPanel(screen) {
  const P = screen.id.replace('_SCREEN', '');
  const left = findNode(screen, P + '_LEFT');
  if (!left) return;
  left.width = 265; left.fill = '#F5F5F5'; left.layout = 'vertical'; left.gap = 0;

  const isFluid = isFluidScene(screen.name);

  function treeRoot(id, label, color, expanded, childNodes) {
    const arrow = expanded ? '▼' : '▷';
    return frame(id, { width: 'fill_container', layout: 'vertical' }, [
      frame(id + '_R', { width: 'fill_container', height: 24, layout: 'horizontal', gap: 4, padding: [2, 6] }, [
        txt(id + '_A', arrow, 11, '#6B7280'),
        iconBox(id + '_I', 14, color, 2),
        txt(id + '_L', label, 13, '#1F2937', { fontWeight: '600' }),
      ]),
      ...(expanded && childNodes ? [frame(id + '_C', { width: 'fill_container', layout: 'vertical', padding: [0, 0, 0, 20] }, childNodes)] : []),
    ]);
  }

  function treePart(id, label, sel, childNodes) {
    const bg = sel ? '#CCE5FF' : undefined;
    return frame(id, { width: 'fill_container', layout: 'vertical' }, [
      frame(id + '_R', { width: 'fill_container', height: 22, layout: 'horizontal', gap: 4, padding: [1, 8], ...(bg ? { fill: bg } : {}) }, [
        ...(childNodes ? [txt(id + '_A', '▼', 10, '#9CA3AF')] : []),
        iconBox(id + '_I', 12, '#F59E0B', 2),
        txt(id + '_L', label, 12, '#374151'),
      ]),
      ...(childNodes ? [frame(id + '_C', { width: 'fill_container', layout: 'vertical', padding: [0, 0, 0, 16] }, childNodes)] : []),
    ]);
  }

  function treeLeaf(id, label, color = '#7C3AED') {
    return frame(id + '_R', { width: 'fill_container', height: 20, layout: 'horizontal', gap: 4, padding: [1, 12] }, [
      iconBox(id + '_I', 10, color, 5),
      txt(id + '_L', label, 11, '#6B7280'),
    ]);
  }

  const mbParts = [
    treePart(P + '_TG', 'Ground', false),
    treePart(P + '_TA', 'arm', false),
    treePart(P + '_TLC', 'lifting_hydraulic_cyl', false),
    treePart(P + '_TLR', 'lifting_hydraulic_rod', false),
    treePart(P + '_TP', 'pala', false),
    treePart(P + '_TPDC', 'pitch_del_cilindro', false, [
      treePart(P + '_TPDC1', 'pitch_del_cilindro_1', true, [
        treeLeaf(P + '_TM2', 'Marker2'), treeLeaf(P + '_TM12', 'Marker12'),
      ]),
    ]),
    treePart(P + '_THR', 'hydraulic_rod', false),
    treePart(P + '_TPA', 'pitch_arm', false),
    treePart(P + '_TPL', 'pitch_link', false),
    treePart(P + '_TB', 'base', false),
  ];

  const flParts = [
    treePart(P + '_TFT', 'FuelTank', false),
    treePart(P + '_TCV', 'Cover', false),
    treePart(P + '_TPP', 'Pipe', false),
  ];

  left.children = [
    frame(P + '_LEFT_H', { width: 'fill_container', height: 24, fill: '#2F7ACB', layout: 'horizontal', padding: [2, 8] }, [
      txt(P + '_LEFT_HT', '模型浏览器', 12, '#FFFFFF', { fontWeight: '600' }),
    ]),
    frame(P + '_LEFT_TB', { width: 'fill_container', height: 28, fill: '#EFEFEF', layout: 'horizontal', padding: [3, 6], gap: 4 }, [
      frame(P + '_TBE', { width: 20, height: 20, fill: '#E5E7EB', cornerRadius: 3 }, [txt(P + '_TBET', '+', 14, '#374151')]),
      frame(P + '_TBC', { width: 20, height: 20, fill: '#E5E7EB', cornerRadius: 3 }, [txt(P + '_TBCT', '-', 14, '#374151')]),
      frame(P + '_TBF', { width: 70, height: 20, fill: '#FFF', cornerRadius: 3, stroke: '#D1D5DB', strokeWidth: 1, layout: 'horizontal', padding: [0, 4] }, [
        txt(P + '_TBFT', '模型', 11, '#374151'), txt(P + '_TBFA', '▼', 9, '#9CA3AF'),
      ]),
      frame(P + '_TBS', { width: 'fill_container', height: 20, fill: '#FFF', cornerRadius: 3, stroke: '#D1D5DB', strokeWidth: 1, padding: [0, 4] }, [
        txt(P + '_TBST', '搜索模型浏览器', 10, '#9CA3AF'),
      ]),
    ]),
    frame(P + '_TREE', { width: 'fill_container', height: 'fill_container', fill: '#FFF', layout: 'vertical', padding: [4, 0] }, [
      treeRoot(P + '_RB', '物体', '#2563EB', true, isFluid ? flParts : mbParts),
      treeRoot(P + '_RC', '连接', '#DC2626', false, []),
      treeRoot(P + '_RD', '驱动', '#EA580C', false, []),
      treeRoot(P + '_RF', '力', '#16A34A', false, [treeLeaf(P + '_TGR', 'Gravity', '#16A34A')]),
      treeRoot(P + '_RM', '材料', '#F59E0B', false, [treeLeaf(P + '_TMS', '钢(7800)', '#F59E0B')]),
    ]),
  ];
}

// ─── Fix View & Chrome ────────────────────────────────────
function fixViewAndChrome(screen) {
  const P = screen.id.replace('_SCREEN', '');
  const isFluid = isFluidScene(screen.name);
  const sceneName = (screen.name || '').replace(/^文档场景_\d+_/, '');

  // Title bar
  const title = findNode(screen, P + '_TITLE');
  if (title) {
    title.height = 30; title.fill = '#E0E0E0'; title.layout = 'horizontal'; title.padding = [3, 6]; title.gap = 0;
    title.children = [
      frame(P + '_QAT', { height: 24, layout: 'horizontal', gap: 2 }, [
        frame(P + '_QATAPP', { width: 20, height: 20, fill: '#1774D0', cornerRadius: 3 }, [txt(P + '_QATAT', '⚙', 12, '#FFF')]),
        frame(P + '_QATU', { width: 22, height: 20, fill: '#D1D5DB', cornerRadius: 3 }, [txt(P + '_QATUT', '↩', 13, '#374151')]),
        frame(P + '_QATR', { width: 22, height: 20, fill: '#D1D5DB', cornerRadius: 3 }, [txt(P + '_QATRT', '↪', 13, '#374151')]),
      ]),
      frame(P + '_TSP1', { width: 'fill_container', height: 1 }),
      txt(P + '_TITLE_TXT', 'CAD 工具 - ' + (isFluid ? 'FuelTank.STEP' : 'bulldozer.STEP') + (sceneName ? ' [' + sceneName + ']' : ''), 13, '#1F2937'),
      frame(P + '_TSP2', { width: 'fill_container', height: 1 }),
      frame(P + '_WCTL', { height: 24, layout: 'horizontal', gap: 0 }, [
        frame(P + '_WH', { width: 30, height: 22 }, [txt(P + '_WHT', '?', 14, '#374151')]),
        frame(P + '_WMN', { width: 30, height: 22 }, [txt(P + '_WMNT', '—', 13, '#374151')]),
        frame(P + '_WMX', { width: 30, height: 22 }, [txt(P + '_WMXT', '☐', 13, '#374151')]),
        frame(P + '_WCL', { width: 30, height: 22, fill: '#E81123' }, [txt(P + '_WCLT', '✕', 13, '#FFF')]),
      ]),
    ];
  }

  // Tab bar
  const tab = findNode(screen, P + '_TAB');
  if (tab) { tab.height = 24; tab.padding = [3, 10]; tab.gap = 14; }
  const tm = findNode(screen, P + '_TAB_MULTI');
  const tf = findNode(screen, P + '_TAB_FLUID');
  if (tm) { tm.fontSize = 13; tm.fontWeight = isFluid ? '400' : '700'; tm.fill = isFluid ? '#6B7280' : '#2563EB'; }
  if (tf) { tf.fontSize = 13; tf.fontWeight = isFluid ? '700' : '400'; tf.fill = isFluid ? '#2563EB' : '#6B7280'; }

  // Hide popup
  const popup = findNode(screen, P + '_POPUP');
  if (popup) { popup.height = 0; popup.children = []; }

  // 3D View
  const view = findNode(screen, P + '_VIEW');
  if (view) {
    delete view.layout;
    view.fill = '#C5CDD6';
    view.children = [
      frame(P + '_VBG', { x: 0, y: 0, width: 'fill_container', height: 'fill_container', fill: '#BCC4CE' }),
      // Grid
      frame(P + '_VGR', { x: 50, y: 280, width: 500, height: 200, fill: '#B8C2CE' }, [
        ...[0, 40, 80, 120, 160].map((y, i) => frame(P + '_GLH' + i, { x: 0, y, width: 500, height: 1, fill: '#A8B5C4' })),
        ...[0, 100, 200, 300, 400].map((x, i) => frame(P + '_GLV' + i, { x, y: 0, width: 1, height: 200, fill: '#A8B5C4' })),
      ]),
      txt(P + '_VHINT', '[ 3D 模型渲染区 ]', 16, '#8896A6'),
      // View Toolbar
      frame(P + '_VTB', { x: 220, y: 8, width: 200, height: 30, fill: '#FFFFFF', cornerRadius: 15, stroke: '#D1D5DB', strokeWidth: 1, layout: 'horizontal', gap: 4, padding: [3, 8] }, [
        ...'⊞⊡◲▧◈◉'.split('').map((ch, i) =>
          frame(P + '_VTB' + i, { width: 24, height: 24, fill: '#E5E7EB', cornerRadius: 12 }, [txt(P + '_VTB' + i + 'T', ch, 14, '#374151')])
        ),
      ]),
      // ViewCube
      frame(P + '_VC', { x: 500, y: 10, width: 60, height: 60, fill: '#E5E7EB', cornerRadius: 4, stroke: '#9CA3AF', strokeWidth: 1 }, [
        txt(P + '_VCF', 'Front', 9, '#374151'),
        frame(P + '_VCR', { x: 40, y: 10, width: 18, height: 40, fill: '#D1D5DB', cornerRadius: 2 }, [txt(P + '_VCRT', 'R', 8, '#6B7280')]),
        frame(P + '_VCT', { x: 10, y: 0, width: 40, height: 14, fill: '#D1D5DB', cornerRadius: 2 }, [txt(P + '_VCTT', 'Top', 8, '#6B7280')]),
      ]),
      // Axes
      frame(P + '_AX', { x: 10, y: 420, width: 50, height: 50 }, [
        frame(P + '_AXX', { x: 20, y: 30, width: 25, height: 2, fill: '#EF4444' }),
        txt(P + '_AXXT', 'X', 10, '#EF4444'),
        frame(P + '_AXY', { x: 20, y: 5, width: 2, height: 25, fill: '#22C55E' }),
        txt(P + '_AXYT', 'Y', 10, '#22C55E'),
        frame(P + '_AXZ', { x: 12, y: 18, width: 2, height: 20, fill: '#3B82F6' }),
        txt(P + '_AXZT', 'Z', 10, '#3B82F6'),
      ]),
    ];
  }

  // Status bar
  const status = findNode(screen, P + '_STATUS');
  if (status) {
    status.layout = 'horizontal'; status.padding = [2, 10];
    status.children = [
      txt(P + '_STL', '就绪', 12, '#FFFFFF'),
      frame(P + '_STSP', { width: 'fill_container', height: 1 }),
      txt(P + '_STR', 'X = 0.722903  Y = 0.630869  Z = 0.193035', 11, '#E0E0E0'),
    ];
  }
}

// ─── Right panel builders ─────────────────────────────────

function inputField(id, value) {
  return frame(id, { width: 'fill_container', height: 22, fill: '#FFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [2, 6] }, [
    txt(id + '_T', value, 12, '#111827'),
  ]);
}

function pickBtn(id, label) {
  return frame(id, { width: 'fill_container', height: 28, fill: '#EFF6FF', stroke: '#93C5FD', strokeWidth: 1, cornerRadius: 4, padding: [4, 8], layout: 'horizontal', gap: 4 }, [
    iconBox(id + '_I', 14, '#3B82F6', 3), txt(id + '_T', label, 12, '#2563EB'),
  ]);
}

function optHeader(P, title) {
  return frame(P + '_OH', { width: 'fill_container', height: 24, fill: '#F3F3F3', layout: 'horizontal', padding: [3, 8] }, [
    txt(P + '_OHT', title, 12, '#374151', { fontWeight: '600' }),
    frame(P + '_OHS', { width: 'fill_container', height: 1 }),
    txt(P + '_OHX', '✕', 12, '#9CA3AF'),
  ]);
}

function modeSwitch(P) {
  return frame(P + '_MODE', { width: 'fill_container', height: 28, layout: 'horizontal', gap: 6 }, [
    frame(P + '_FLASH', { width: 'fill_container', height: 26, fill: '#DBEAFE', cornerRadius: 4, stroke: '#3B82F6', strokeWidth: 1, padding: [4, 8] }, [
      txt(P + '_FLASHT', '⚡ 闪电模式', 11, '#2563EB', { fontWeight: '600' }),
    ]),
    frame(P + '_STD', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 8] }, [
      txt(P + '_STDT', '📋 标准模式', 11, '#6B7280'),
    ]),
  ]);
}

function propRow(id, label, value, isInput) {
  const valNode = isInput
    ? inputField(id + '_V', value)
    : txt(id + '_VT', value, 12, '#111827');
  return frame(id, { width: 'fill_container', height: 26, layout: 'horizontal', gap: 4, padding: [2, 8] }, [
    txt(id + '_L', label, 12, '#6B7280', { width: 60 }), valNode,
  ]);
}

function dropdown(id, label, value) {
  return frame(id, { width: 'fill_container', height: 26, layout: 'horizontal', gap: 4, padding: [2, 8] }, [
    txt(id + '_L', label, 12, '#6B7280', { width: 60 }),
    frame(id + '_D', { width: 'fill_container', height: 22, fill: '#FFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, layout: 'horizontal', padding: [2, 6] }, [
      txt(id + '_DT', value, 12, '#111827'), txt(id + '_DA', '▼', 9, '#9CA3AF'),
    ]),
  ]);
}

function sectionTitle(id, label) {
  return frame(id, { width: 'fill_container', height: 24, fill: '#F3F4F6', padding: [4, 8] }, [
    txt(id + '_T', label, 13, '#1F2937', { fontWeight: '600' }),
  ]);
}

function sep(id) { return frame(id, { width: 'fill_container', height: 1, fill: '#E5E7EB' }); }

function coordRow(id, label, x, y, z) {
  return frame(id, { width: 'fill_container', layout: 'vertical', gap: 2, padding: [2, 8] }, [
    txt(id + '_H', label, 11, '#6B7280', { fontWeight: '600' }),
    frame(id + '_R', { width: 'fill_container', height: 22, layout: 'horizontal', gap: 3 }, [
      txt(id + '_XL', 'X', 10, '#9CA3AF'),
      frame(id + '_XV', { width: 'fill_container', height: 20, fill: '#FFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [txt(id + '_XT', x, 10, '#111827')]),
      txt(id + '_YL', 'Y', 10, '#9CA3AF'),
      frame(id + '_YV', { width: 'fill_container', height: 20, fill: '#FFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [txt(id + '_YT', y, 10, '#111827')]),
      txt(id + '_ZL', 'Z', 10, '#9CA3AF'),
      frame(id + '_ZV', { width: 'fill_container', height: 20, fill: '#FFF', stroke: '#E5E7EB', strokeWidth: 1, cornerRadius: 2, padding: [1, 3] }, [txt(id + '_ZT', z, 10, '#111827')]),
    ]),
  ]);
}

// --- Right panel: 选项-连接 ---
function rightConnector(P) {
  return [
    optHeader(P, '选项-连接'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      propRow(P + '_ON', '名称', 'revolute_arm_base', true),
      dropdown(P + '_OT', '类型', '转动副'),
      sep(P + '_S1'),
      txt(P + '_P1H', '零件 1', 12, '#DC2626', { fontWeight: '600' }),
      pickBtn(P + '_P1', '点击选择零件 1'),
      txt(P + '_P2H', '零件 2', 12, '#2563EB', { fontWeight: '600' }),
      pickBtn(P + '_P2', '点击选择零件 2'),
      sep(P + '_S2'),
      coordRow(P + '_POS', '位置 (全局坐标)', '0.352', '0.693', '1.288'),
      coordRow(P + '_DIR', '方向 (Rx/Ry/Rz °)', '0.0', '0.0', '90.0'),
      sep(P + '_S3'),
      modeSwitch(P),
    ]),
  ];
}

// --- Right panel: 选项-接触 ---
function rightContact(P) {
  return [
    optHeader(P, '选项-接触'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      propRow(P + '_ON', '名称', 'ContactSphere1', true),
      dropdown(P + '_OT', '类型', '球球接触'),
      sep(P + '_S1'),
      txt(P + '_F1H', '特征 1', 12, '#DC2626', { fontWeight: '600' }),
      pickBtn(P + '_F1', '点击选择特征 1'),
      txt(P + '_F2H', '特征 2', 12, '#2563EB', { fontWeight: '600' }),
      pickBtn(P + '_F2', '点击选择特征 2'),
      sep(P + '_S2'),
      sectionTitle(P + '_NFH', '法向力参数'),
      propRow(P + '_NK', 'k (刚度)', '1e8', true),
      propRow(P + '_ND', 'd (阻尼)', '1e5', true),
      propRow(P + '_NN1', 'n1', '1.5', true),
      propRow(P + '_NP', 'p_max', '0.001', true),
      sep(P + '_S3'),
      modeSwitch(P),
    ]),
  ];
}

// --- Right panel: 选项-驱动 ---
function rightDrive(P) {
  return [
    optHeader(P, '选项-驱动'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      propRow(P + '_ON', '名称', 'Rotational1', true),
      dropdown(P + '_OT', '类型', '转动驱动'),
      sep(P + '_S1'),
      txt(P + '_CH', '连接器', 12, '#6B7280', { fontWeight: '600' }),
      pickBtn(P + '_CP', '点击选择目标连接'),
      sep(P + '_S2'),
      sectionTitle(P + '_PH', '驱动参数'),
      dropdown(P + '_DT', '驱动类型', '角度'),
      propRow(P + '_PS', 'phi.start', '0.0', true),
      propRow(P + '_WS', 'w.start', '0.0', true),
      sep(P + '_S3'),
      modeSwitch(P),
    ]),
  ];
}

// --- Right panel: 选项-标架 ---
function rightMarker(P) {
  return [
    optHeader(P, '选项-标架'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      propRow(P + '_ON', '名称', 'Marker1', true),
      sep(P + '_S1'),
      coordRow(P + '_POS', '位置 (全局坐标)', '0.0', '0.0', '0.0'),
      coordRow(P + '_DIR', '方向 (Rx/Ry/Rz °)', '0.0', '0.0', '0.0'),
      sep(P + '_S2'),
      txt(P + '_INF', '💡 智能推断已开启', 11, '#059669'),
      sep(P + '_S3'),
      modeSwitch(P),
    ]),
  ];
}

// --- Right panel: 选项-设计点 ---
function rightDesignPoint(P) {
  return [
    optHeader(P, '选项-设计点'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      propRow(P + '_ON', '名称', 'Point1', true),
      sep(P + '_S1'),
      // Tab bar: 拾取 | 计算
      frame(P + '_TABS', { width: 'fill_container', height: 28, layout: 'horizontal', gap: 0 }, [
        frame(P + '_TAB1', { width: 'fill_container', height: 26, fill: '#DBEAFE', cornerRadius: [4, 0, 0, 4], padding: [4, 8] }, [
          txt(P + '_TAB1T', '拾取', 12, '#2563EB', { fontWeight: '600' }),
        ]),
        frame(P + '_TAB2', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: [0, 4, 4, 0], padding: [4, 8] }, [
          txt(P + '_TAB2T', '计算', 12, '#6B7280'),
        ]),
      ]),
      sep(P + '_S2'),
      coordRow(P + '_POS', '位置 (全局坐标)', '0.0', '0.0', '0.0'),
      sep(P + '_S3'),
      modeSwitch(P),
    ]),
  ];
}

// --- Right panel: 选项-材料 ---
function rightMaterial(P) {
  return [
    optHeader(P, '选项-材料'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      dropdown(P + '_MAT', '材料', '钢:7800kg/m³'),
      propRow(P + '_DEN', '密度', '7800 kg/m³', true),
      sep(P + '_S1'),
      frame(P + '_BTNS', { width: 'fill_container', height: 28, layout: 'horizontal', gap: 6 }, [
        frame(P + '_BNEW', { width: 'fill_container', height: 26, fill: '#EFF6FF', cornerRadius: 4, stroke: '#93C5FD', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_BNEWT', '+ 新建材料', 11, '#2563EB'),
        ]),
        frame(P + '_BDEF', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_BDEFT', '设为默认', 11, '#374151'),
        ]),
      ]),
    ]),
  ];
}

// --- Right panel: 选项-组合 ---
function rightGroup(P) {
  return [
    optHeader(P, '选项-组合'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      propRow(P + '_GN', '分组名称', 'NewGroup', true),
      sep(P + '_S1'),
      txt(P + '_SEL', '已选中零件：3', 12, '#374151'),
      frame(P + '_SELLIST', { width: 'fill_container', height: 60, fill: '#FFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [4, 6], layout: 'vertical', gap: 2 }, [
        txt(P + '_SL1', '✓ arm', 11, '#111827'),
        txt(P + '_SL2', '✓ pala', 11, '#111827'),
        txt(P + '_SL3', '✓ pitch_arm', 11, '#111827'),
      ]),
      sep(P + '_S2'),
      frame(P + '_BTNS', { width: 'fill_container', height: 28, layout: 'horizontal', gap: 6 }, [
        frame(P + '_BOK', { width: 'fill_container', height: 26, fill: '#2563EB', cornerRadius: 4, padding: [4, 8] }, [
          txt(P + '_BOKT', '确认组合', 11, '#FFF', { fontWeight: '600' }),
        ]),
        frame(P + '_BCC', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_BCCT', '取消', 11, '#374151'),
        ]),
      ]),
    ]),
  ];
}

// --- Right panel: 选项-测量 ---
function rightMeasure(P) {
  return [
    optHeader(P, '选项-测量'),
    frame(P + '_MTB', { width: 'fill_container', height: 32, fill: '#F9FAFB', layout: 'horizontal', gap: 4, padding: [4, 8] }, [
      frame(P + '_MT1', { width: 28, height: 28, fill: '#E5E7EB', cornerRadius: 4 }, [txt(P + '_MT1T', '⊙', 16, '#374151')]),
      frame(P + '_MT2', { width: 28, height: 28, fill: '#DBEAFE', cornerRadius: 4, stroke: '#3B82F6', strokeWidth: 1 }, [txt(P + '_MT2T', '↕', 16, '#2563EB')]),
      frame(P + '_MT3', { width: 28, height: 28, fill: '#E5E7EB', cornerRadius: 4 }, [txt(P + '_MT3T', '↔', 16, '#374151')]),
    ]),
    frame(P + '_MSEL', { width: 'fill_container', layout: 'vertical', gap: 2, padding: [4, 8] }, [
      txt(P + '_MSELH', '选择项', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_MSELB', { width: 'fill_container', height: 50, fill: '#FFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [4, 6], layout: 'vertical', gap: 2 }, [
        txt(P + '_MS1', 'face_1 <48>', 11, '#111827'),
        txt(P + '_MS2', 'face_2 <266>', 11, '#111827'),
      ]),
    ]),
    sep(P + '_SP1'),
    frame(P + '_MRES', { width: 'fill_container', layout: 'vertical', gap: 0, padding: [4, 8] }, [
      txt(P + '_MRSH', '测量结果', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_MRH', { width: 'fill_container', height: 22, fill: '#F3F4F6', layout: 'horizontal', padding: [2, 4] }, [
        txt(P + '_MRH1', '测量类型', 11, '#6B7280', { fontWeight: '600', width: 120 }),
        txt(P + '_MRH2', '测量值', 11, '#6B7280', { fontWeight: '600' }),
      ]),
      frame(P + '_MR1', { width: 'fill_container', height: 22, fill: '#FFF', layout: 'horizontal', padding: [2, 4] }, [
        txt(P + '_MR1A', '距离', 11, '#374151', { width: 120 }),
        txt(P + '_MR1B', '0.12874 m', 11, '#111827', { fontWeight: '600' }),
      ]),
    ]),
    frame(P + '_MEXIT', { width: 'fill_container', height: 32, padding: [4, 8] }, [
      frame(P + '_MEBTN', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 8] }, [
        frame(P + '_MESP', { width: 'fill_container', height: 1 }), txt(P + '_MEET', '▶ 退出', 12, '#374151'),
      ]),
    ]),
  ];
}

// --- Right panel: 选项-爆炸视图 ---
function rightExploded(P) {
  return [
    optHeader(P, '选项-爆炸视图'),
    frame(P + '_EB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 8, padding: [8, 8] }, [
      txt(P + '_ESH', '选中零件', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_EL', { width: 'fill_container', height: 60, fill: '#FFF', stroke: '#D1D5DB', strokeWidth: 1, cornerRadius: 3, padding: [4, 6], layout: 'vertical', gap: 2 }, [
        txt(P + '_EL1', '✓ arm', 11, '#111827'), txt(P + '_EL2', '✓ pala', 11, '#111827'),
      ]),
      sep(P + '_ES1'),
      txt(P + '_EMH', '爆炸模式', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_EMR', { width: 'fill_container', height: 28, layout: 'horizontal', gap: 6 }, [
        frame(P + '_EM1', { width: 'fill_container', height: 26, fill: '#DBEAFE', cornerRadius: 4, stroke: '#3B82F6', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_EM1T', '按分组', 11, '#2563EB', { fontWeight: '600' }),
        ]),
        frame(P + '_EM2', { width: 'fill_container', height: 26, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 8] }, [
          txt(P + '_EM2T', '按零件', 11, '#6B7280'),
        ]),
      ]),
      sep(P + '_ES2'),
      txt(P + '_EFH', '爆炸因子', 12, '#6B7280', { fontWeight: '600' }),
      frame(P + '_ESL', { width: 'fill_container', height: 20, layout: 'horizontal', gap: 8 }, [
        txt(P + '_ES0', '0', 10, '#9CA3AF'),
        frame(P + '_ESLB', { width: 'fill_container', height: 6, fill: '#E5E7EB', cornerRadius: 3 }, [
          frame(P + '_ESLF', { x: 0, y: 0, width: 80, height: 6, fill: '#3B82F6', cornerRadius: 3 }),
        ]),
        txt(P + '_ES100', '100', 10, '#9CA3AF'),
      ]),
      txt(P + '_ESV', '当前值：50', 11, '#374151'),
    ]),
  ];
}

// --- Right panel: 属性-零件 (default) ---
function rightProperty(P) {
  return [
    frame(P + '_RH', { width: 'fill_container', height: 24, fill: '#F3F3F3', layout: 'horizontal', padding: [3, 8] }, [
      txt(P + '_RHT', '属性-零件', 12, '#374151', { fontWeight: '600' }),
    ]),
    sectionTitle(P + '_SB', '基本属性'),
    propRow(P + '_PN', '名称', 'pitch_del_cilindro_1', true),
    propRow(P + '_PT', '类型', '零件'),
    frame(P + '_PV', { width: 'fill_container', height: 26, layout: 'horizontal', gap: 4, padding: [2, 8] }, [
      txt(P + '_PVL', '可见性', 12, '#6B7280', { width: 60 }),
      frame(P + '_PVCB', { width: 16, height: 16, fill: '#2563EB', cornerRadius: 3 }, [txt(P + '_PVCK', '✓', 11, '#FFF')]),
    ]),
    frame(P + '_PC', { width: 'fill_container', height: 26, layout: 'horizontal', gap: 4, padding: [2, 8] }, [
      txt(P + '_PCL', '颜色', 12, '#6B7280', { width: 60 }),
      frame(P + '_PCSW', { width: 50, height: 18, fill: '#F59E0B', cornerRadius: 3, stroke: '#D1D5DB', strokeWidth: 1 }),
    ]),
    sep(P + '_SP1'),
    sectionTitle(P + '_SPH', '物理属性'),
    dropdown(P + '_PM', '材料', '钢:7800kg/m³'),
    propRow(P + '_PD', '密度', '7800 kg/m³'),
    propRow(P + '_PMM', '总质量', '1.72873 kg'),
    propRow(P + '_PVV', '体积', '2.216e-4 m³'),
    sep(P + '_SP2'),
    sectionTitle(P + '_SE', '导出'),
    dropdown(P + '_PME', '网格精度', '中'),
  ];
}

// --- Right panel: 选项-切片 (fluid) ---
function rightSlice(P) {
  return [
    optHeader(P, '选项-切片'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      dropdown(P + '_ST', '切片类型', '简单油箱切片'),
      sep(P + '_S1'),
      txt(P + '_TPH', '目标零件', 12, '#6B7280', { fontWeight: '600' }),
      pickBtn(P + '_TP', '点击选择目标零件'),
      sep(P + '_S2'),
      sectionTitle(P + '_PPH', '切片参数'),
      propRow(P + '_SN', '切片数', '10', true),
      propRow(P + '_SD', '方向', 'Z 轴'),
    ]),
  ];
}

// --- Right panel: 选项-流体端口 ---
function rightFluidPort(P) {
  return [
    optHeader(P, '选项-流体端口'),
    frame(P + '_OB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 6, padding: [8, 8] }, [
      propRow(P + '_ON', '名称', 'Port1', true),
      sep(P + '_S1'),
      txt(P + '_TPH', '目标面', 12, '#6B7280', { fontWeight: '600' }),
      pickBtn(P + '_TP', '点击选择目标面'),
      sep(P + '_S2'),
      coordRow(P + '_POS', '位置', '0.0', '0.0', '0.0'),
      coordRow(P + '_DIR', '法线方向', '0.0', '0.0', '1.0'),
      sep(P + '_S3'),
      modeSwitch(P),
    ]),
  ];
}

// --- Right panel: 错误码/FAQ (简化) ---
function rightError(P, sceneName) {
  const errName = (sceneName || '').replace(/^文档场景_\d+_/, '');
  return [
    frame(P + '_RH', { width: 'fill_container', height: 24, fill: '#FEF2F2', layout: 'horizontal', padding: [3, 8] }, [
      txt(P + '_RHT', '错误信息', 12, '#DC2626', { fontWeight: '600' }),
    ]),
    frame(P + '_ERB', { width: 'fill_container', height: 'fill_container', layout: 'vertical', gap: 8, padding: [12, 10] }, [
      frame(P + '_EICON', { width: 40, height: 40, fill: '#FEE2E2', cornerRadius: 20 }, [
        txt(P + '_EICOT', '⚠', 22, '#DC2626'),
      ]),
      txt(P + '_ENAME', errName, 13, '#1F2937', { fontWeight: '600' }),
      sep(P + '_ES1'),
      txt(P + '_EDESC', '请参考帮助文档中的详细说明和解决方案。', 12, '#6B7280'),
      txt(P + '_ETIP', '提示：检查日志文件获取更多信息。', 12, '#6B7280'),
      sep(P + '_ES2'),
      frame(P + '_EBTN', { width: 'fill_container', height: 28, fill: '#F3F4F6', cornerRadius: 4, stroke: '#D1D5DB', strokeWidth: 1, padding: [4, 8] }, [
        frame(P + '_EBSP', { width: 'fill_container', height: 1 }),
        txt(P + '_EBTT', '查看日志', 12, '#374151'),
      ]),
    ]),
  ];
}

// --- Map type -> builder ---
function buildRightPanel(P, type, sceneName) {
  switch (type) {
    case 'connector': return rightConnector(P);
    case 'contact': return rightContact(P);
    case 'drive': return rightDrive(P);
    case 'marker': return rightMarker(P);
    case 'designpoint': return rightDesignPoint(P);
    case 'material': return rightMaterial(P);
    case 'group': return rightGroup(P);
    case 'measure': return rightMeasure(P);
    case 'exploded': return rightExploded(P);
    case 'slice': return rightSlice(P);
    case 'fluidport': return rightFluidPort(P);
    case 'fluiddesign': return rightSlice(P);
    case 'error': return rightError(P, sceneName);
    case 'thicken':
    case 'planarloop':
    case 'export':
    case 'property':
    case 'default':
    default: return rightProperty(P);
  }
}

// ─── Apply to ALL scenes ──────────────────────────────────
let fixed = 0;
for (let i = 2; i < pen.children.length; i++) {
  const screen = pen.children[i];
  if (!screen.id || !screen.id.startsWith('SC')) continue;

  const P = screen.id.replace('_SCREEN', '');

  // Apply universal fixes
  fixRibbon(screen);
  fixLeftPanel(screen);
  fixViewAndChrome(screen);

  // Determine and apply right panel
  const type = detectRightPanelType(screen.name);
  const right = findNode(screen, P + '_RIGHT');
  if (right) {
    right.width = 280;
    right.fill = '#F9FAFB';
    right.layout = 'vertical';
    right.gap = 0;
    right.children = buildRightPanel(P, type, screen.name);
  }

  fixed++;
}

fs.writeFileSync(penPath, JSON.stringify(pen, null, 2) + '\n', 'utf8');
console.log('Fixed ' + fixed + ' scenario screens. Total: ' + pen.children.length);
