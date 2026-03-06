import fs from 'fs';

const penPath = 'cadtoolonline.pen';

/**
 * 为 MB_RIGHT 面板生成完整的零件属性编辑器内容。
 * @param {object} mbScreen - MB_SCREEN 节点（pen 文件的顶层 frame）
 */
function fixRightPanel(mbScreen) {
  const FONT = 'Microsoft YaHei';
  const LABEL_COLOR = '#374151';
  const VALUE_COLOR = '#111827';
  const SECTION_BG = '#F3F3F3';
  const INPUT_BG = '#FFFFFF';
  const INPUT_STROKE = '#D1D5DB';
  const CHECK_STROKE = '#9CA3AF';
  const PANEL_WIDTH = 280;

  let _seq = 0;
  /** 生成唯一 ID */
  function uid(prefix) {
    return `MB_RP_${prefix}_${++_seq}`;
  }

  /** 文字节点 */
  function text(id, content, { fontSize = 12, fill = VALUE_COLOR, fontWeight, width } = {}) {
    const n = { type: 'text', id, content, fontFamily: FONT, fontSize, fill };
    if (fontWeight) n.fontWeight = fontWeight;
    if (width) n.width = width;
    return n;
  }

  /** 输入框 */
  function inputBox(id, value, { width = 'fill_container', height = 22 } = {}) {
    return {
      type: 'frame', id, width, height,
      fill: INPUT_BG, stroke: INPUT_STROKE, strokeThickness: 1,
      cornerRadius: 3, layout: 'horizontal',
      padding: [2, 4],
      children: [
        text(id + '_V', value, { fill: VALUE_COLOR })
      ]
    };
  }

  /** 下拉框 */
  function dropdown(id, value, { width = 'fill_container', height = 22 } = {}) {
    return {
      type: 'frame', id, width, height,
      fill: INPUT_BG, stroke: INPUT_STROKE, strokeThickness: 1,
      cornerRadius: 3, layout: 'horizontal',
      padding: [2, 4],
      children: [
        text(id + '_V', value, { fill: VALUE_COLOR, width: 'fill_container' }),
        text(id + '_ARR', '\u25BC', { fontSize: 10, fill: '#6B7280' })
      ]
    };
  }

  /** 复选框 */
  function checkbox(id, checked) {
    return {
      type: 'frame', id, width: 14, height: 14,
      fill: checked ? '#2563EB' : INPUT_BG,
      stroke: CHECK_STROKE, strokeThickness: 1,
      cornerRadius: 2,
      children: checked
        ? [text(id + '_CHK', '\u2713', { fontSize: 10, fill: '#FFFFFF' })]
        : []
    };
  }

  /** 色块 */
  function colorSwatch(id, color) {
    return {
      type: 'frame', id, width: 50, height: 20,
      fill: color, cornerRadius: 3,
      stroke: INPUT_STROKE, strokeThickness: 1
    };
  }

  /** 属性行: label + value widget */
  function propRow(idPrefix, label, valueNode) {
    return {
      type: 'frame', id: uid(idPrefix),
      width: 'fill_container', height: 26,
      layout: 'horizontal', gap: 6,
      padding: [2, 8],
      children: [
        text(uid(idPrefix + '_L'), label, {
          fontSize: 12, fill: LABEL_COLOR, width: 70
        }),
        valueNode
      ]
    };
  }

  /** 区域标题 */
  function sectionHeader(idPrefix, title) {
    return {
      type: 'frame', id: uid(idPrefix),
      width: 'fill_container', height: 26,
      fill: '#E5E7EB', layout: 'horizontal',
      padding: [4, 8],
      children: [
        text(uid(idPrefix + '_T'), title, {
          fontSize: 13, fill: '#1F2937', fontWeight: '600'
        })
      ]
    };
  }

  /** 只读文字值 */
  function readonlyValue(id, value) {
    return text(id, value, { fill: VALUE_COLOR });
  }

  /** 矩阵行 (3个数字) */
  function matrixRow(idPrefix, v1, v2, v3) {
    return {
      type: 'frame', id: uid(idPrefix),
      width: 'fill_container', height: 22,
      layout: 'horizontal', gap: 4,
      padding: [0, 8],
      children: [
        { type: 'frame', id: uid(idPrefix + '_C1'), width: 'fill_container', height: 20,
          fill: INPUT_BG, stroke: INPUT_STROKE, strokeThickness: 1, cornerRadius: 2,
          layout: 'horizontal', padding: [1, 2],
          children: [text(uid(idPrefix + '_V1'), v1, { fontSize: 11 })]
        },
        { type: 'frame', id: uid(idPrefix + '_C2'), width: 'fill_container', height: 20,
          fill: INPUT_BG, stroke: INPUT_STROKE, strokeThickness: 1, cornerRadius: 2,
          layout: 'horizontal', padding: [1, 2],
          children: [text(uid(idPrefix + '_V2'), v2, { fontSize: 11 })]
        },
        { type: 'frame', id: uid(idPrefix + '_C3'), width: 'fill_container', height: 20,
          fill: INPUT_BG, stroke: INPUT_STROKE, strokeThickness: 1, cornerRadius: 2,
          layout: 'horizontal', padding: [1, 2],
          children: [text(uid(idPrefix + '_V3'), v3, { fontSize: 11 })]
        }
      ]
    };
  }

  /** 向量行标签 + 3数字 + 单位 */
  function vectorRow(idPrefix, label, v1, v2, v3, unit) {
    return {
      type: 'frame', id: uid(idPrefix),
      width: 'fill_container', layout: 'vertical', gap: 2,
      padding: [2, 0],
      children: [
        {
          type: 'frame', id: uid(idPrefix + '_LBL'),
          width: 'fill_container', height: 20,
          layout: 'horizontal', padding: [0, 8],
          children: [
            text(uid(idPrefix + '_L'), label, { fontSize: 12, fill: LABEL_COLOR, fontWeight: '600' }),
            text(uid(idPrefix + '_U'), unit, { fontSize: 11, fill: '#6B7280' })
          ]
        },
        matrixRow(idPrefix + '_R', v1, v2, v3)
      ]
    };
  }

  // ── 查找 MB_RIGHT ──
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

  const mbRight = findNode(mbScreen, 'MB_RIGHT');
  if (!mbRight) {
    throw new Error('MB_RIGHT not found in mbScreen');
  }

  // 1. 调整宽度
  mbRight.width = PANEL_WIDTH;

  // 2. 重建 children
  mbRight.children = [
    // ── 标题栏 ──
    {
      type: 'frame', id: 'MB_RIGHT_H',
      width: 'fill_container', height: 24,
      fill: SECTION_BG, layout: 'horizontal',
      padding: [3, 8],
      children: [
        text('MB_RIGHT_TXT', '属性-零件', { fontSize: 14, fill: '#111827' })
      ]
    },

    // ── 滚动内容区 ──
    {
      type: 'frame', id: 'MB_RIGHT_BODY',
      width: 'fill_container', height: 'fill_container',
      layout: 'vertical', gap: 2,
      clip: true,
      children: [

        // ═══════ 基本属性 ═══════
        sectionHeader('SEC_BASIC', '基本属性'),

        propRow('NAME', '名称',
          inputBox(uid('NAME_IN'), 'pitch_del_cilindro_1')),

        propRow('TYPE', '类型',
          readonlyValue(uid('TYPE_V'), '零件')),

        propRow('VISIBLE', '可见性',
          checkbox(uid('VIS_CB'), true)),

        propRow('COLOR', '颜色',
          colorSwatch(uid('COLOR_SW'), '#EAB308')),

        propRow('TRANSP', '半透明',
          checkbox(uid('TRANSP_CB'), false)),

        // ═══════ 物理属性 ═══════
        sectionHeader('SEC_PHYS', '物理属性'),

        propRow('COUNT', '零件个数',
          inputBox(uid('CNT_IN'), '1', { width: 60 })),

        propRow('MAT', '材料',
          dropdown(uid('MAT_DD'), '钢:7800kg/m³')),

        propRow('DENSITY', '密度',
          readonlyValue(uid('DENS_V'), '7800 kg/m³')),

        propRow('MASS', '总质量',
          readonlyValue(uid('MASS_V'), '1.72872901716929 kg')),

        propRow('VOL', '体积',
          readonlyValue(uid('VOL_V'), '0.000221631921528 m³')),

        // 质心 (向量)
        vectorRow('COM', '质心', '1.49347e-07', '0.693403', '1.28786', 'm'),

        // 惯性张量 (3x3)
        {
          type: 'frame', id: uid('SEC_INERTIA'),
          width: 'fill_container', layout: 'vertical', gap: 2,
          padding: [2, 0],
          children: [
            {
              type: 'frame', id: uid('INERTIA_LBL'),
              width: 'fill_container', height: 20,
              layout: 'horizontal', padding: [0, 8],
              children: [
                text(uid('INERTIA_L'), '惯性张量', {
                  fontSize: 12, fill: LABEL_COLOR, fontWeight: '600'
                }),
                text(uid('INERTIA_U'), 'kg\u00B7m²', { fontSize: 11, fill: '#6B7280' })
              ]
            },
            matrixRow('I_R1', '0.007546', '0.000000', '0.000000'),
            matrixRow('I_R2', '0.000000', '0.007532', '-0.000189'),
            matrixRow('I_R3', '0.000000', '-0.000189', '0.000014')
          ]
        },

        // ═══════ 导出 ═══════
        sectionHeader('SEC_EXPORT', '导出'),

        propRow('MESH', '网格精度',
          dropdown(uid('MESH_DD'), '中'))
      ]
    }
  ];

  return mbScreen;
}

// ── 主执行 ──
const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));
const mbScreen = pen.children[0];
fixRightPanel(mbScreen);
fs.writeFileSync(penPath, JSON.stringify(pen, null, 2), 'utf8');
console.log('Done: MB_RIGHT panel updated with full property editor.');
