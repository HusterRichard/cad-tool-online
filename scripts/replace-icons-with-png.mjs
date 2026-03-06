// Replace vector-shape icon compositions in .pen with real PNG icons from CADToolBox resources
// Icons are embedded as base64 data URIs in a special "image" property on frames

import fs from 'fs';
import path from 'path';

const penPath = 'cadtoolonline.pen';
const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));
const ICON_DIR = 'public/icons/png';

// ── Icon file mapping ──────────────────────────────────────────────
// Maps .pen button ID suffix patterns → PNG file name (without extension)
// The patterns match against node IDs ending with these suffixes

const BIG_ICON_MAP = {
  // File operations (both long and short suffixes)
  '_BTN_IMP_ICO':     'cad_import',          // 导入
  '_BTN_IMPORT_ICO':  'cad_import',
  '_BTN_OPEN_ICO':    'cad_open_file',       // 打开
  '_BTN_SAVE_ICO':    'cad_save_file',       // 保存
  '_BTN_SAVEAS_ICO':  'cad_save_as',         // 另存为
  // Body operations
  '_BTN_MERGE_ICO':   'cad_create_group',    // 组合
  '_BTN_MRG_ICO':     'cad_create_group',
  '_BTN_SPLIT_ICO':   'cad_ungroup',         // 拆分
  '_BTN_SPL_ICO':     'cad_ungroup',
  '_BTN_CLEAN_ICO':   'cad_clear',           // 清理
  '_BTN_CLN_ICO':     'cad_clear',
  '_BTN_DEFGRP_ICO':  'cad_create_default_group', // 默认分组
  '_BTN_DG_ICO':      'cad_create_default_group',
  // Marker & Design Point
  '_BTN_MARKER_ICO':  'cad_place_marker',    // 标架
  '_BTN_MKR_ICO':     'cad_place_marker',
  '_BTN_DPOINT_ICO':  'cad_design_pnt',      // 设计点
  '_BTN_DP_ICO':      'cad_design_pnt',
  // Point mass
  '_BTN_POINT_ICO':   'cad_point_mass',      // 质点
  // Joint types (连接) - both full and abbreviated suffixes
  '_BTN_FIXED_ICO':   'joint_cad_fixed',     // 固定副
  '_BTN_FIX_ICO':     'joint_cad_fixed',
  '_BTN_REV_ICO':     'joint_cad_revolute',  // 转动副
  '_BTN_REVO_ICO':    'joint_cad_revolute',
  '_BTN_REVOLUTE_ICO':'joint_cad_revolute',
  '_BTN_PRIS_ICO':    'joint_cad_prismatic', // 移动副
  '_BTN_PRISM_ICO':   'joint_cad_prismatic',
  '_BTN_PRISMATIC_ICO':'joint_cad_prismatic',
  '_BTN_CYL_ICO':     'joint_cad_cylindrical', // 圆柱副
  '_BTN_CYLIN_ICO':   'joint_cad_cylindrical',
  '_BTN_CYLINDRICAL_ICO':'joint_cad_cylindrical',
  '_BTN_SPH_ICO':     'joint_cad_spherical', // 球面副
  '_BTN_SPHER_ICO':   'joint_cad_spherical',
  '_BTN_SPHERICAL_ICO':'joint_cad_spherical',
  '_BTN_UNI_ICO':     'joint_cad_universal', // 万向节
  '_BTN_UNIV_ICO':    'joint_cad_universal',
  '_BTN_UNIVERSAL_ICO':'joint_cad_universal',
  '_BTN_SCREW_ICO':   'joint_cad_screw',     // 螺旋副
  '_BTN_SCR_ICO':     'joint_cad_screw',
  '_BTN_PLANAR_ICO':  'joint_cad_planar',    // 平面副
  '_BTN_PLN_ICO':     'joint_cad_planar',
  // Drive (驱动) - both full and abbreviated suffixes
  '_BTN_ROTDRIVE_ICO':'motion_cad_rotational',  // 转动驱动
  '_BTN_ROTDRV_ICO':  'motion_cad_rotational',
  '_BTN_RD_ICO':      'motion_cad_rotational',
  '_BTN_TRANDRIVE_ICO':'motion_cad_translational', // 移动驱动
  '_BTN_TRNDRV_ICO':  'motion_cad_translational',
  '_BTN_TD_ICO':      'motion_cad_translational',
  // Contact (接触)
  '_BTN_PP_ICO':      'force_cad_contact_point_point',   // 点点接触
  '_BTN_PS_ICO':      'force_cad_contact_point_surface',  // 点面接触
  // Measure & View
  '_BTN_MEAS_ICO':    'cad_measure',         // 测量
  '_BTN_MEASURE_ICO': 'cad_measure',
  '_BTN_EXPL_ICO':    'cad_exploded_view',   // 爆炸视图
  '_BTN_EXPLODED_ICO':'cad_exploded_view',
  // Surface thickening
  '_BTN_THICKEN_ICO': 'cad_surface_thickening', // 曲面加厚
  '_BTN_THICK_ICO':   'cad_surface_thickening',
  '_BTN_THK_ICO':     'cad_surface_thickening',
  // Planar loop constraint
  '_BTN_PLNLOOP_ICO': 'cad_planar_loop_constraint',
  '_BTN_LOOP_ICO':    'cad_planar_loop_constraint',
  '_BTN_PLC_ICO':     'cad_planar_loop_constraint',
  // Fluid operations
  '_BTN_STANK_ICO':   'cad_simple_tank',     // 简单容器
  '_BTN_TANK_ICO':    'cad_tank',            // 容器
  '_BTN_TSLICE_ICO':  'cad_rib',             // 容器截面 (reuse rib icon)
  '_BTN_RIB_ICO':     'cad_rib',             // 筋截面
  '_BTN_FPORT_ICO':   'cad_fluid_port',      // 流体端口
  '_BTN_FP_ICO':      'cad_fluid_port',
  // Settings & About
  '_BTN_CHECK_ICO':   'check_cad_check',     // 检查
  '_BTN_CHK_ICO':     'check_cad_check',
  '_BTN_SET_ICO':     'cad_option',          // 设置
  '_BTN_SETTINGS_ICO':'cad_option',
  '_BTN_ABOUT_ICO':   'cad_about',           // 关于
  '_BTN_ABT_ICO':     'cad_about',
  // Accept/Exit
  '_BTN_ACCEPT_ICO':  'cad_accept',
  '_BTN_AE_ICO':      'cad_accept',          // Accept/Exit (SC screens)
  '_BTN_EXIT_ICO':    'cad_cancel',
  // Additional SC screen abbreviations
  '_BTN_PT_ICO':      'cad_point_mass',       // 质点 (SC screens)
  '_BTN_PRI_ICO':     'joint_cad_prismatic',  // 移动副 (SC screens short)
  '_BTN_RDRV_ICO':    'motion_cad_rotational', // 转动驱动 (SC screens short)
  '_BTN_TDRV_ICO':    'motion_cad_translational', // 移动驱动 (SC screens short)
  '_BTN_SIMTANK_ICO': 'cad_simple_tank',      // 简单容器 (FL screen)
  '_BTN_PORT_ICO':    'cad_fluid_port',       // 流体端口 (SC fluid screens)
};

// Small button icons (16x16 in Quick Access Toolbar and ribbon small buttons)
const SMALL_ICON_MAP = {
  '_QA_IMP':      'cad_import',
  '_QA_OPEN':     'cad_open_file',
  '_QA_SAVE':     'cad_save_file',
  '_QA_UNDO':     'undo',
  '_QA_REDO':     'redo',
  // 16x16 ribbon small buttons (MB_SCREEN uses full names)
  '_BTN_IMPORT_ICO':  'cad_import',
  '_BTN_OPEN_ICO':    'cad_open_file',
  '_BTN_SAVE_ICO':    'cad_save_file',
  '_BTN_SAVEAS_ICO':  'cad_save_as',
  '_BTN_MERGE_ICO':   'cad_create_group',
  '_BTN_SPLIT_ICO':   'cad_ungroup',
  '_BTN_CLEAN_ICO':   'cad_clear',
  '_BTN_DEFGRP_ICO':  'cad_create_default_group',
  '_BTN_IMP_ICO':     'cad_import',
  '_BTN_MRG_ICO':     'cad_create_group',
  '_BTN_SPL_ICO':     'cad_ungroup',
  '_BTN_CLN_ICO':     'cad_clear',
  '_BTN_DG_ICO':      'cad_create_default_group',
};

// Model tree root icons
const TREE_ROOT_MAP = {
  '_RB_I':  'model_tree_body_dir',       // 物体
  '_RC_I':  'model_tree_connector_dir',   // 连接
  '_RD_I':  'motion_cad_rotational',      // 驱动 (use motion dir or rotational)
  '_RF_I':  'model_tree_force_dir',       // 力
  '_RM_I':  'model_tree_material_dir',    // 材料
};

// Model tree item icons (for individual items in tree)
const TREE_ITEM_MAP = {
  '_PART_I':     'model_tree_part',
  '_BODY_I':     'model_tree_part',
  '_MARKER_I':   'model_tree_marker',
  '_MKR_I':      'model_tree_marker',
  '_GROUP_I':    'model_tree_group',
  '_GRP_I':      'model_tree_group',
  '_MAT_I':      'model_tree_material',
  '_FIXED_I':    'model_tree_cad_fixed_gray',
  '_REV_I':      'model_tree_cad_revolute_gray',
  '_PRIS_I':     'model_tree_cad_prismatic_gray',
  '_CYL_I':      'model_tree_cad_cylindrical_gray',
  '_SPH_I':      'model_tree_cad_spherical_gray',
  '_UNI_I':      'model_tree_cad_universal_gray',
  '_SCREW_I':    'model_tree_cad_screw_gray',
  '_PLN_I':      'model_tree_cad_planar_gray',
  '_ROTD_I':     'model_tree_cad_rotational_gray',
  '_TRAD_I':     'model_tree_cad_translational_gray',
  '_DP_I':       'model_tree_design_pnt_gray',
  '_DPOINT_I':   'model_tree_design_pnt_gray',
  '_SUBBODY_I':  'model_tree_subbody',
  '_GROUND_I':   'model_tree_cad_ground',
};

// View toolbar icons
const VIEW_ICON_MAP = {
  '_VT_SHADE':   'view_dis_shaded',
  '_VT_WIRE':    'view_dis_wire_frame',
  '_VT_SHADELN': 'view_dis_shaded_line',
  '_VT_PERSP':   'view_proj_persp',
  '_VT_ORTH':    'view_proj_orth',
  '_VT_FRONT':   'view_view_front',
  '_VT_BACK':    'view_view_back',
  '_VT_TOP':     'view_view_top',
  '_VT_BOTTOM':  'view_view_bottom',
  '_VT_LEFT':    'view_view_left',
  '_VT_RIGHT':   'view_view_right',
  '_VT_ISO':     'view_view_iso_zxy',
  '_VT_ZALL':    'view_view_zoom_all',
  '_VT_ZSEL':    'view_view_zoom_select',
};

// ── Load PNGs as base64 ──────────────────────────────────────────
const pngCache = {};

function loadPng(iconKey, size) {
  const cacheKey = `${iconKey}_${size}`;
  if (pngCache[cacheKey]) return pngCache[cacheKey];

  const pngPath = path.join(ICON_DIR, String(size), iconKey + '.png');
  if (!fs.existsSync(pngPath)) {
    // Try without subdirectory prefix
    return null;
  }
  const buf = fs.readFileSync(pngPath);
  const dataUri = 'data:image/png;base64,' + buf.toString('base64');
  pngCache[cacheKey] = dataUri;
  return dataUri;
}

// ── Replace icons in .pen ────────────────────────────────────────
let replaceCount = 0;
let missCount = 0;
const missing = new Set();

function replaceIcon(node, iconKey, size) {
  const dataUri = loadPng(iconKey, size);
  if (!dataUri) {
    missing.add(iconKey);
    missCount++;
    return false;
  }

  // Replace the frame: clear children (vector shapes), set image fill
  node.children = [];
  // Store image as a special property - the .pen format may use "image" or "fill" with data URI
  // We use the "image" property which is the standard way in design tools
  node.image = dataUri;
  // Also set fill to transparent so the image shows
  node.fill = 'transparent';
  replaceCount++;
  return true;
}

function walkAndReplace(node) {
  if (!node) return;
  if (!node.id) {
    if (node.children) for (const c of node.children) walkAndReplace(c);
    return;
  }

  const id = node.id;
  const w = node.width || 0;
  const h = node.height || 0;

  // Check big button icons (32x32)
  if (w === 32 && h === 32) {
    for (const [suffix, iconKey] of Object.entries(BIG_ICON_MAP)) {
      if (id.endsWith(suffix)) {
        replaceIcon(node, iconKey, 32);
        break;
      }
    }
  }

  // Check small icons (any size <= 20, including 16x16, 14x14, 12x12, 10x10)
  if (w <= 20 && h <= 20 && w > 0 && h > 0) {
    let matched = false;

    // Small button map (16x16 ribbon buttons)
    if (w === 16 && h === 16) {
      for (const [suffix, iconKey] of Object.entries(SMALL_ICON_MAP)) {
        if (id.endsWith(suffix)) {
          replaceIcon(node, iconKey, 16);
          matched = true;
          break;
        }
      }
    }

    // Tree root icons (14x14)
    if (!matched) {
      for (const [suffix, iconKey] of Object.entries(TREE_ROOT_MAP)) {
        if (id.endsWith(suffix)) {
          replaceIcon(node, iconKey, 16);
          matched = true;
          break;
        }
      }
    }

    // Tree item icons (various sizes 10-16)
    if (!matched) {
      for (const [suffix, iconKey] of Object.entries(TREE_ITEM_MAP)) {
        if (id.endsWith(suffix)) {
          replaceIcon(node, iconKey, 16);
          matched = true;
          break;
        }
      }
    }

    // View toolbar icons
    if (!matched) {
      for (const [suffix, iconKey] of Object.entries(VIEW_ICON_MAP)) {
        if (id.endsWith(suffix)) {
          replaceIcon(node, iconKey, 16);
          matched = true;
          break;
        }
      }
    }

    // Generic tree item ICO nodes - try to infer icon from ID
    if (!matched && id.includes('ICO') && (!node.image)) {
      // Tree body items
      if (id.includes('_GND_') || id.includes('_GROUND')) {
        replaceIcon(node, 'model_tree_cad_ground', 16);
      } else if (id.includes('_T_') && id.endsWith('_ICO')) {
        // Generic tree item - try part icon
        replaceIcon(node, 'model_tree_part', 16);
      } else if (id.includes('_R_BODY')) {
        replaceIcon(node, 'model_tree_body_dir', 16);
      } else if (id.includes('_R_CONN')) {
        replaceIcon(node, 'model_tree_connector_dir', 16);
      } else if (id.includes('_R_DRV') || id.includes('_R_MOTION')) {
        replaceIcon(node, 'model_tree_motion_dir', 16);
      } else if (id.includes('_R_FORCE')) {
        replaceIcon(node, 'model_tree_force_dir', 16);
      } else if (id.includes('_R_MAT')) {
        replaceIcon(node, 'model_tree_material_dir', 16);
      }
    }
  }

  // Recurse
  if (node.children) {
    for (const c of node.children) walkAndReplace(c);
  }
}

// Process all screens
for (const screen of pen.children) {
  walkAndReplace(screen);
}

console.log(`Replaced ${replaceCount} icons with real PNGs`);
if (missing.size > 0) {
  console.log(`Missing PNG files for ${missing.size} icon keys:`);
  for (const m of missing) console.log(`  - ${m}`);
}

// Write the updated .pen file
fs.writeFileSync(penPath, JSON.stringify(pen, null, 2) + '\n', 'utf8');
console.log('Updated .pen file saved');
