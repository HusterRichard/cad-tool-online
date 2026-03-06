/**
 * fixLeftPanel(mbScreen)
 *
 * Rebuilds MB_LEFT children for the model browser panel:
 *   1. Title bar (MB_LEFT_H) - "模型浏览器" with dock/close buttons
 *   2. Toolbar - expand/collapse/filter/search
 *   3. Scrollable tree area with bulldozer.STEP model parts
 *
 * Usage:
 *   import { readFileSync, writeFileSync } from 'fs';
 *   const pen = JSON.parse(readFileSync('cadtoolonline.pen', 'utf8'));
 *   const mbScreen = pen.children.find(c => c.id === 'MB_SCREEN');
 *   fixLeftPanel(mbScreen);
 *   writeFileSync('cadtoolonline.pen', JSON.stringify(pen, null, 2));
 */

// ── helpers ──────────────────────────────────────────────────────────

function findNodeById(node, id) {
  if (node.id === id) return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

const FONT = "Microsoft YaHei";

function txt(id, content, opts = {}) {
  return { type: "text", id, content, fontFamily: FONT, fontSize: 12, fill: "#374151", ...opts };
}

function frame(id, opts = {}, children = []) {
  return { type: "frame", id, ...opts, children };
}

// icon: small colored square to represent category icon
function iconBox(id, color) {
  return frame(id, { width: 12, height: 12, fill: color, cornerRadius: [2, 2, 2, 2] });
}

// ── tree data ────────────────────────────────────────────────────────

const COLORS = {
  body:     "#2563EB",
  connect:  "#DC2626",
  drive:    "#EA580C",
  force:    "#16A34A",
  material: "#F59E0B",
};

const BODIES = [
  "Ground",
  "arm",
  "lifting_hydraulic_cylinder",
  "lifting_hydraulic_rod",
  "pala",
  "pitch_del_cilindro",
  "hydraulic_rod",
  "pitch_arm",
  "pitch_link",
  "base",
];

const PITCH_SUB = {
  name: "pitch_del_cilindro_1",
  markers: ["Marker2", "Marker12"],
};

// ── row builders ─────────────────────────────────────────────────────

function treeRow(id, icon, iconColor, label, indent, opts = {}) {
  const arrow = opts.expanded ? "▼" : (opts.collapsed ? "▷" : "");
  const isRoot = opts.root;
  const isLeaf = opts.leaf;
  const textFill = isLeaf ? "#6B7280" : isRoot ? "#1F2937" : "#374151";
  const fw = isRoot ? "600" : "400";
  const fs = isRoot ? 13 : 12;

  const rowChildren = [];

  if (arrow) {
    rowChildren.push(txt(`${id}_arr`, arrow, { fontSize: 10, fill: "#6B7280", width: 12 }));
  } else {
    // spacer for alignment
    rowChildren.push(frame(`${id}_sp`, { width: 12, height: 12 }));
  }

  rowChildren.push(iconBox(`${id}_ico`, iconColor));
  rowChildren.push(txt(`${id}_lbl`, label, { fontSize: fs, fontWeight: fw, fill: textFill }));

  const bgFill = opts.selected ? "#CCE5FF" : undefined;

  return frame(id, {
    width: "fill_container",
    height: 22,
    layout: "horizontal",
    gap: 4,
    padding: [2, indent],
    ...(bgFill ? { fill: bgFill } : {}),
    verticalAlign: "center",
  }, rowChildren);
}

// ── main function ────────────────────────────────────────────────────

export default function fixLeftPanel(mbScreen) {
  const mbLeft = findNodeById(mbScreen, "MB_LEFT");
  if (!mbLeft) throw new Error("MB_LEFT not found in mbScreen");

  // ① Title bar — reuse existing MB_LEFT_H structure, ensure correct text
  const titleBar = frame("MB_LEFT_H", {
    width: "fill_container",
    height: 24,
    fill: "#2F7ACB",
    layout: "horizontal",
    padding: [3, 6],
    verticalAlign: "center",
  }, [
    txt("MB_LEFT_H_TXT", "模型浏览器", { fontSize: 14, fill: "#FFFFFF", fontWeight: "600", width: "fill_container" }),
    // dock button
    txt("MB_LEFT_H_DOCK", "⊟", { fontSize: 12, fill: "#FFFFFF", width: 16 }),
    // close button
    txt("MB_LEFT_H_CLOSE", "✕", { fontSize: 12, fill: "#FFFFFF", width: 16 }),
  ]);

  // ② Toolbar row
  const toolbar = frame("MB_LEFT_TB", {
    width: "fill_container",
    height: 26,
    fill: "#E0E0E0",
    layout: "horizontal",
    gap: 4,
    padding: [3, 6],
    verticalAlign: "center",
  }, [
    // expand all
    frame("MB_LEFT_TB_EXP", {
      width: 20, height: 20, fill: "#D4D4D4", cornerRadius: [2, 2, 2, 2],
      layout: "horizontal", padding: [2, 2], verticalAlign: "center", horizontalAlign: "center",
    }, [txt("MB_LEFT_TB_EXP_T", "+", { fontSize: 12, fill: "#374151", fontWeight: "700" })]),
    // collapse all
    frame("MB_LEFT_TB_COL", {
      width: 20, height: 20, fill: "#D4D4D4", cornerRadius: [2, 2, 2, 2],
      layout: "horizontal", padding: [2, 2], verticalAlign: "center", horizontalAlign: "center",
    }, [txt("MB_LEFT_TB_COL_T", "−", { fontSize: 12, fill: "#374151", fontWeight: "700" })]),
    // filter dropdown
    frame("MB_LEFT_TB_FLT", {
      width: 56, height: 20, fill: "#FFFFFF", cornerRadius: [2, 2, 2, 2],
      layout: "horizontal", padding: [2, 4], verticalAlign: "center",
      stroke: "#C0C0C0", strokeThickness: 1,
    }, [txt("MB_LEFT_TB_FLT_T", "模型 ▼", { fontSize: 11, fill: "#374151" })]),
    // search box
    frame("MB_LEFT_TB_SRC", {
      width: "fill_container", height: 20, fill: "#FFFFFF", cornerRadius: [2, 2, 2, 2],
      layout: "horizontal", padding: [2, 4], verticalAlign: "center",
      stroke: "#C0C0C0", strokeThickness: 1,
    }, [txt("MB_LEFT_TB_SRC_T", "🔍 搜索模型浏览器", { fontSize: 11, fill: "#9CA3AF" })]),
  ]);

  // ③ Tree area
  const treeRows = [];

  // --- 物体 (expanded) ---
  treeRows.push(
    treeRow("TR_BODY", "📁", COLORS.body, "物体", 4, { root: true, expanded: true })
  );

  for (const name of BODIES) {
    if (name === "pitch_del_cilindro") {
      // expanded parent
      treeRows.push(
        treeRow("TR_B_pitch_del_cilindro", "📦", COLORS.body, "pitch_del_cilindro", 20, { expanded: true })
      );
      // sub-body expanded
      treeRows.push(
        treeRow("TR_B_pitch_del_cilindro_1", "📦", COLORS.body, PITCH_SUB.name, 36, { expanded: true })
      );
      // markers (leaves)
      for (const mk of PITCH_SUB.markers) {
        const mkId = `TR_B_MK_${mk}`;
        treeRows.push(
          treeRow(mkId, "⊕", COLORS.body, mk, 52, { leaf: true })
        );
      }
    } else {
      const safeId = `TR_B_${name}`;
      const isGround = name === "Ground";
      treeRows.push(
        treeRow(safeId, isGround ? "🌍" : "📦", COLORS.body, name, 20, {})
      );
    }
  }

  // --- 连接 (collapsed) ---
  treeRows.push(
    treeRow("TR_CONN", "🔗", COLORS.connect, "连接", 4, { root: true, collapsed: true })
  );

  // --- 驱动 (collapsed) ---
  treeRows.push(
    treeRow("TR_DRV", "⚙", COLORS.drive, "驱动", 4, { root: true, collapsed: true })
  );

  // --- 力 (collapsed) ---
  treeRows.push(
    treeRow("TR_FRC", "💪", COLORS.force, "力", 4, { root: true, collapsed: true })
  );

  // --- 材料 (collapsed) ---
  treeRows.push(
    treeRow("TR_MAT", "🎨", COLORS.material, "材料", 4, { root: true, collapsed: true })
  );

  const treeArea = frame("MB_LEFT_TREE", {
    width: "fill_container",
    height: "fill_container",
    fill: "#FFFFFF",
    layout: "vertical",
    padding: [4, 0],
    gap: 0,
    clip: true,
  }, treeRows);

  // ④ Reassemble MB_LEFT children
  mbLeft.children = [titleBar, toolbar, treeArea];
}

// ── CLI entry point ──────────────────────────────────────────────────
// Run: node scripts/fix-left-panel.mjs [path-to-pen]

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const penPath = resolve(process.argv[2] || "cadtoolonline.pen");
const pen = JSON.parse(readFileSync(penPath, "utf8"));
const mbScreen = pen.children.find((c) => c.id === "MB_SCREEN");
if (!mbScreen) {
  console.error("MB_SCREEN not found in", penPath);
  process.exit(1);
}

fixLeftPanel(mbScreen);
writeFileSync(penPath, JSON.stringify(pen, null, 2), "utf8");
console.log("Done — MB_LEFT rebuilt in", penPath);
