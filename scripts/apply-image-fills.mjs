// Replace vector-shape icon compositions in .pen with real PNG icons
// Uses the correct .pen image fill format: { type: "image", url: "relative/path.png", mode: "fit" }

import fs from 'fs';
import path from 'path';

const penPath = 'cadtoolonline.pen';
const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));

// Icon base path relative to the .pen file location
const ICON_BASE_32 = 'public/icons/png/32';
const ICON_BASE_16 = 'public/icons/png/16';

// ── ID suffix → PNG filename mapping ─────────────────────────────
const BIG_ICON_MAP = {
  // File operations
  '_BTN_IMP_ICO':     'cad_import',
  '_BTN_IMPORT_ICO':  'cad_import',
  '_BTN_OPEN_ICO':    'cad_open_file',
  '_BTN_SAVE_ICO':    'cad_save_file',
  '_BTN_SAVEAS_ICO':  'cad_save_as',
  // Body operations
  '_BTN_MERGE_ICO':   'cad_create_group',
  '_BTN_MRG_ICO':     'cad_create_group',
  '_BTN_SPLIT_ICO':   'cad_ungroup',
  '_BTN_SPL_ICO':     'cad_ungroup',
  '_BTN_CLEAN_ICO':   'cad_clear',
  '_BTN_CLN_ICO':     'cad_clear',
  '_BTN_DEFGRP_ICO':  'cad_create_default_group',
  '_BTN_DG_ICO':      'cad_create_default_group',
  // Marker & Design Point
  '_BTN_MARKER_ICO':  'cad_place_marker',
  '_BTN_MKR_ICO':     'cad_place_marker',
  '_BTN_DPOINT_ICO':  'cad_design_pnt',
  '_BTN_DP_ICO':      'cad_design_pnt',
  // Point mass
  '_BTN_POINT_ICO':   'cad_point_mass',
  '_BTN_PT_ICO':      'cad_point_mass',
  // Joint types
  '_BTN_FIXED_ICO':   'joint_cad_fixed',
  '_BTN_FIX_ICO':     'joint_cad_fixed',
  '_BTN_REV_ICO':     'joint_cad_revolute',
  '_BTN_REVO_ICO':    'joint_cad_revolute',
  '_BTN_REVOLUTE_ICO':'joint_cad_revolute',
  '_BTN_PRIS_ICO':    'joint_cad_prismatic',
  '_BTN_PRI_ICO':     'joint_cad_prismatic',
  '_BTN_PRISM_ICO':   'joint_cad_prismatic',
  '_BTN_PRISMATIC_ICO':'joint_cad_prismatic',
  '_BTN_CYL_ICO':     'joint_cad_cylindrical',
  '_BTN_CYLIN_ICO':   'joint_cad_cylindrical',
  '_BTN_CYLINDRICAL_ICO':'joint_cad_cylindrical',
  '_BTN_SPH_ICO':     'joint_cad_spherical',
  '_BTN_SPHER_ICO':   'joint_cad_spherical',
  '_BTN_SPHERICAL_ICO':'joint_cad_spherical',
  '_BTN_UNI_ICO':     'joint_cad_universal',
  '_BTN_UNIV_ICO':    'joint_cad_universal',
  '_BTN_UNIVERSAL_ICO':'joint_cad_universal',
  '_BTN_SCREW_ICO':   'joint_cad_screw',
  '_BTN_SCR_ICO':     'joint_cad_screw',
  '_BTN_PLANAR_ICO':  'joint_cad_planar',
  '_BTN_PLN_ICO':     'joint_cad_planar',
  // Drive
  '_BTN_ROTDRIVE_ICO':'motion_cad_rotational',
  '_BTN_ROTDRV_ICO':  'motion_cad_rotational',
  '_BTN_RDRV_ICO':    'motion_cad_rotational',
  '_BTN_RD_ICO':      'motion_cad_rotational',
  '_BTN_TRANDRIVE_ICO':'motion_cad_translational',
  '_BTN_TRNDRV_ICO':  'motion_cad_translational',
  '_BTN_TDRV_ICO':    'motion_cad_translational',
  '_BTN_TD_ICO':      'motion_cad_translational',
  // Contact
  '_BTN_PP_ICO':      'force_cad_contact_point_point',
  '_BTN_PS_ICO':      'force_cad_contact_point_surface',
  // Measure & Exploded
  '_BTN_MEAS_ICO':    'cad_measure',
  '_BTN_MEASURE_ICO': 'cad_measure',
  '_BTN_EXPL_ICO':    'cad_exploded_view',
  '_BTN_EXPLODED_ICO':'cad_exploded_view',
  // Thicken & Loop
  '_BTN_THICKEN_ICO': 'cad_surface_thickening',
  '_BTN_THICK_ICO':   'cad_surface_thickening',
  '_BTN_THK_ICO':     'cad_surface_thickening',
  '_BTN_PLNLOOP_ICO': 'cad_planar_loop_constraint',
  '_BTN_LOOP_ICO':    'cad_planar_loop_constraint',
  '_BTN_PLC_ICO':     'cad_planar_loop_constraint',
  // Fluid
  '_BTN_STANK_ICO':   'cad_simple_tank',
  '_BTN_SIMTANK_ICO': 'cad_simple_tank',
  '_BTN_TANK_ICO':    'cad_tank',
  '_BTN_TSLICE_ICO':  'cad_rib',
  '_BTN_RIB_ICO':     'cad_rib',
  '_BTN_FPORT_ICO':   'cad_fluid_port',
  '_BTN_FP_ICO':      'cad_fluid_port',
  '_BTN_PORT_ICO':    'cad_fluid_port',
  // Settings & About
  '_BTN_CHECK_ICO':   'check_cad_check',
  '_BTN_CHK_ICO':     'check_cad_check',
  '_BTN_SET_ICO':     'cad_option',
  '_BTN_SETTINGS_ICO':'cad_option',
  '_BTN_ABOUT_ICO':   'cad_about',
  '_BTN_ABT_ICO':     'cad_about',
  '_BTN_ACCEPT_ICO':  'cad_accept',
  '_BTN_AE_ICO':      'cad_accept',
  '_BTN_EXIT_ICO':    'cad_cancel',
};

const SMALL_ICON_MAP = {
  '_QA_IMP':          'cad_import',
  '_QA_OPEN':         'cad_open_file',
  '_QA_SAVE':         'cad_save_file',
  '_QA_UNDO':         'undo',
  '_QA_REDO':         'redo',
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

const TREE_ROOT_MAP = {
  '_RB_I':  'model_tree_body_dir',
  '_RC_I':  'model_tree_connector_dir',
  '_RD_I':  'model_tree_motion_dir',
  '_RF_I':  'model_tree_force_dir',
  '_RM_I':  'model_tree_material_dir',
};

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

// ── Apply image fill ─────────────────────────────────────────────
let replaceCount = 0;
const missing = new Set();

function applyImageFill(node, iconKey, size) {
  const dir = size >= 32 ? ICON_BASE_32 : ICON_BASE_16;
  const relUrl = `${dir}/${iconKey}.png`;

  // Verify PNG exists
  if (!fs.existsSync(relUrl)) {
    missing.add(relUrl);
    return false;
  }

  // Clear vector shape children
  node.children = [];

  // Set fill to image fill object per .pen schema
  node.fill = {
    type: 'image',
    url: relUrl,
    mode: 'fit',
  };

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

  // Big button icons (32x32)
  if (w === 32 && h === 32) {
    for (const [suffix, iconKey] of Object.entries(BIG_ICON_MAP)) {
      if (id.endsWith(suffix)) {
        applyImageFill(node, iconKey, 32);
        break;
      }
    }
  }

  // Small icons (any size <= 20)
  if (w <= 20 && h <= 20 && w > 0 && h > 0) {
    let matched = false;

    // 16x16 ribbon small buttons
    if (w === 16 && h === 16) {
      for (const [suffix, iconKey] of Object.entries(SMALL_ICON_MAP)) {
        if (id.endsWith(suffix)) {
          applyImageFill(node, iconKey, 16);
          matched = true;
          break;
        }
      }
    }

    // Tree root icons
    if (!matched) {
      for (const [suffix, iconKey] of Object.entries(TREE_ROOT_MAP)) {
        if (id.endsWith(suffix)) {
          applyImageFill(node, iconKey, 16);
          matched = true;
          break;
        }
      }
    }

    // Tree item icons
    if (!matched) {
      for (const [suffix, iconKey] of Object.entries(TREE_ITEM_MAP)) {
        if (id.endsWith(suffix)) {
          applyImageFill(node, iconKey, 16);
          matched = true;
          break;
        }
      }
    }

    // View toolbar icons
    if (!matched) {
      for (const [suffix, iconKey] of Object.entries(VIEW_ICON_MAP)) {
        if (id.endsWith(suffix)) {
          applyImageFill(node, iconKey, 16);
          matched = true;
          break;
        }
      }
    }

    // Generic tree item ICO nodes
    if (!matched && id.includes('ICO') && w <= 14) {
      if (id.includes('_GND_') || id.includes('_GROUND')) {
        applyImageFill(node, 'model_tree_cad_ground', 16);
      } else if (id.includes('_R_BODY')) {
        applyImageFill(node, 'model_tree_body_dir', 16);
      } else if (id.includes('_R_CONN')) {
        applyImageFill(node, 'model_tree_connector_dir', 16);
      } else if (id.includes('_R_DRV') || id.includes('_R_MOTION')) {
        applyImageFill(node, 'model_tree_motion_dir', 16);
      } else if (id.includes('_R_FORCE')) {
        applyImageFill(node, 'model_tree_force_dir', 16);
      } else if (id.includes('_R_MAT')) {
        applyImageFill(node, 'model_tree_material_dir', 16);
      } else if (id.includes('_T_') && id.endsWith('_ICO')) {
        applyImageFill(node, 'model_tree_part', 16);
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

console.log(`Replaced ${replaceCount} icons with image fills`);
if (missing.size > 0) {
  console.log(`Missing files:`);
  for (const m of missing) console.log(`  ${m}`);
}

fs.writeFileSync(penPath, JSON.stringify(pen, null, 2) + '\n', 'utf8');
const sizeMB = (fs.statSync(penPath).size / 1024 / 1024).toFixed(1);
console.log(`Saved ${penPath} (${sizeMB} MB)`);
