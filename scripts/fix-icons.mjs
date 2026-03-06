/**
 * fix-icons.mjs
 * 将所有 Ribbon 按钮图标和树节点图标从纯色方块替换为矢量形状组合
 */
import fs from 'fs';

const penPath = 'cadtoolonline.pen';
const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));

// ─── helpers ────────────────────────────────────────
function F(id, props, children = []) {
  return { type: 'frame', id, ...props, children };
}

// ─── Icon builders: 32x32 (Ribbon big) ──────────────
// Each returns an array of child frames to place inside a 32x32 container

const ICONS_32 = {
  // ── 文件 File ──
  import: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#EFF6FF', cornerRadius: 6 }, [
    // Document body
    F(id + '_S1', { x: 8, y: 3, width: 12, height: 16, fill: '#2563EB', cornerRadius: 2 }),
    // Fold corner
    F(id + '_S2', { x: 16, y: 3, width: 4, height: 4, fill: '#93C5FD' }),
    // Arrow down
    F(id + '_S3', { x: 12, y: 21, width: 2, height: 7, fill: '#2563EB' }),
    F(id + '_S4', { x: 9, y: 25, width: 8, height: 2, fill: '#2563EB' }),
    F(id + '_S5', { x: 11, y: 27, width: 4, height: 2, fill: '#2563EB' }),
  ]),
  open: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#EFF6FF', cornerRadius: 6 }, [
    // Folder back
    F(id + '_S1', { x: 4, y: 8, width: 24, height: 16, fill: '#3B82F6', cornerRadius: 2 }),
    // Folder tab
    F(id + '_S2', { x: 4, y: 5, width: 10, height: 5, fill: '#3B82F6', cornerRadius: [2, 2, 0, 0] }),
    // Folder front (open)
    F(id + '_S3', { x: 3, y: 14, width: 26, height: 11, fill: '#60A5FA', cornerRadius: [2, 2, 3, 3] }),
  ]),
  save: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#EFF6FF', cornerRadius: 6 }, [
    // Floppy body
    F(id + '_S1', { x: 5, y: 4, width: 22, height: 24, fill: '#3B82F6', cornerRadius: 2 }),
    // Label area
    F(id + '_S2', { x: 9, y: 6, width: 14, height: 8, fill: '#FFFFFF', cornerRadius: 1 }),
    // Metal shutter
    F(id + '_S3', { x: 9, y: 18, width: 14, height: 8, fill: '#1D4ED8', cornerRadius: 1 }),
    F(id + '_S4', { x: 13, y: 19, width: 6, height: 6, fill: '#93C5FD', cornerRadius: 1 }),
  ]),
  saveas: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#EFF6FF', cornerRadius: 6 }, [
    F(id + '_S1', { x: 3, y: 4, width: 20, height: 22, fill: '#3B82F6', cornerRadius: 2 }),
    F(id + '_S2', { x: 7, y: 6, width: 12, height: 7, fill: '#FFFFFF', cornerRadius: 1 }),
    F(id + '_S3', { x: 7, y: 16, width: 12, height: 8, fill: '#1D4ED8', cornerRadius: 1 }),
    // Pencil overlay
    F(id + '_S4', { x: 20, y: 18, width: 3, height: 10, fill: '#F59E0B', cornerRadius: 1 }),
    F(id + '_S5', { x: 21, y: 28, width: 1, height: 2, fill: '#374151' }),
  ]),

  // ── 分组 Group ──
  merge: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#ECFDF5', cornerRadius: 6 }, [
    // Two overlapping rectangles merging
    F(id + '_S1', { x: 4, y: 6, width: 14, height: 12, fill: '#059669', cornerRadius: 2 }),
    F(id + '_S2', { x: 14, y: 14, width: 14, height: 12, fill: '#34D399', cornerRadius: 2 }),
    // Arrow inward
    F(id + '_S3', { x: 13, y: 11, width: 6, height: 2, fill: '#FFFFFF' }),
  ]),
  split: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#ECFDF5', cornerRadius: 6 }, [
    F(id + '_S1', { x: 3, y: 8, width: 12, height: 10, fill: '#059669', cornerRadius: 2 }),
    F(id + '_S2', { x: 17, y: 14, width: 12, height: 10, fill: '#34D399', cornerRadius: 2 }),
    // Arrows outward
    F(id + '_S3', { x: 12, y: 12, width: 8, height: 2, fill: '#065F46' }),
    F(id + '_S4', { x: 14, y: 10, width: 2, height: 6, fill: '#065F46' }),
  ]),
  clean: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#ECFDF5', cornerRadius: 6 }, [
    // Broom/brush shape
    F(id + '_S1', { x: 10, y: 4, width: 4, height: 16, fill: '#059669', cornerRadius: 1 }),
    F(id + '_S2', { x: 6, y: 20, width: 12, height: 8, fill: '#34D399', cornerRadius: [0, 0, 3, 3] }),
    // Bristles
    F(id + '_S3', { x: 7, y: 22, width: 1, height: 4, fill: '#065F46' }),
    F(id + '_S4', { x: 10, y: 22, width: 1, height: 5, fill: '#065F46' }),
    F(id + '_S5', { x: 13, y: 22, width: 1, height: 4, fill: '#065F46' }),
    F(id + '_S6', { x: 16, y: 22, width: 1, height: 5, fill: '#065F46' }),
  ]),
  defgrp: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#ECFDF5', cornerRadius: 6 }, [
    F(id + '_S1', { x: 5, y: 6, width: 22, height: 16, fill: '#059669', cornerRadius: 2 }),
    F(id + '_S2', { x: 5, y: 3, width: 10, height: 5, fill: '#059669', cornerRadius: [2, 2, 0, 0] }),
    // Star inside
    F(id + '_S3', { x: 13, y: 11, width: 6, height: 6, fill: '#FFFFFF', cornerRadius: 3 }),
  ]),

  // ── 基本形状 Basic ──
  marker: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#F5F3FF', cornerRadius: 6 }, [
    // Crosshair
    F(id + '_S1', { x: 15, y: 4, width: 2, height: 24, fill: '#7C3AED' }),
    F(id + '_S2', { x: 4, y: 15, width: 24, height: 2, fill: '#7C3AED' }),
    // Center circle
    F(id + '_S3', { x: 12, y: 12, width: 8, height: 8, fill: '#FFFFFF', cornerRadius: 4, stroke: '#7C3AED', strokeWidth: 2 }),
  ]),
  designpoint: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#F5F3FF', cornerRadius: 6 }, [
    // Small crosshair
    F(id + '_S1', { x: 15, y: 8, width: 2, height: 16, fill: '#8B5CF6' }),
    F(id + '_S2', { x: 8, y: 15, width: 16, height: 2, fill: '#8B5CF6' }),
    // Filled center dot
    F(id + '_S3', { x: 13, y: 13, width: 6, height: 6, fill: '#7C3AED', cornerRadius: 3 }),
  ]),

  // ── 连接 Joints ──
  fixed: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    // Ground hatch
    F(id + '_S1', { x: 4, y: 22, width: 24, height: 4, fill: '#DC2626' }),
    F(id + '_S2', { x: 6, y: 26, width: 3, height: 2, fill: '#DC2626' }),
    F(id + '_S3', { x: 12, y: 26, width: 3, height: 2, fill: '#DC2626' }),
    F(id + '_S4', { x: 18, y: 26, width: 3, height: 2, fill: '#DC2626' }),
    // Rigid block
    F(id + '_S5', { x: 8, y: 8, width: 16, height: 14, fill: '#FCA5A5', cornerRadius: 2, stroke: '#DC2626', strokeWidth: 1 }),
  ]),
  revolute: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    // Circle (rotation joint)
    F(id + '_S1', { x: 8, y: 8, width: 16, height: 16, fill: '#FFFFFF', cornerRadius: 8, stroke: '#DC2626', strokeWidth: 2 }),
    // Center dot
    F(id + '_S2', { x: 14, y: 14, width: 4, height: 4, fill: '#DC2626', cornerRadius: 2 }),
    // Arrow arc (simplified as curved lines)
    F(id + '_S3', { x: 20, y: 8, width: 6, height: 2, fill: '#EF4444' }),
    F(id + '_S4', { x: 24, y: 8, width: 2, height: 6, fill: '#EF4444' }),
  ]),
  prismatic: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    // Rail (two parallel lines)
    F(id + '_S1', { x: 6, y: 10, width: 20, height: 3, fill: '#DC2626', cornerRadius: 1 }),
    F(id + '_S2', { x: 6, y: 19, width: 20, height: 3, fill: '#DC2626', cornerRadius: 1 }),
    // Slider block
    F(id + '_S3', { x: 12, y: 8, width: 8, height: 16, fill: '#FCA5A5', cornerRadius: 2, stroke: '#DC2626', strokeWidth: 1 }),
    // Arrow right
    F(id + '_S4', { x: 22, y: 14, width: 6, height: 2, fill: '#EF4444' }),
    F(id + '_S5', { x: 26, y: 12, width: 2, height: 6, fill: '#EF4444' }),
  ]),
  cylindrical: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    // Cylinder body
    F(id + '_S1', { x: 8, y: 6, width: 16, height: 20, fill: '#FCA5A5', cornerRadius: [8, 8, 8, 8], stroke: '#DC2626', strokeWidth: 1 }),
    // Center line
    F(id + '_S2', { x: 15, y: 4, width: 2, height: 24, fill: '#DC2626' }),
    // Rotation arrow hint
    F(id + '_S3', { x: 22, y: 10, width: 4, height: 2, fill: '#EF4444' }),
  ]),
  spherical: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    // Sphere (full circle)
    F(id + '_S1', { x: 6, y: 6, width: 20, height: 20, fill: '#FFFFFF', cornerRadius: 10, stroke: '#DC2626', strokeWidth: 2 }),
    // Center dot
    F(id + '_S2', { x: 13, y: 13, width: 6, height: 6, fill: '#DC2626', cornerRadius: 3 }),
    // Equator line
    F(id + '_S3', { x: 8, y: 15, width: 16, height: 1, fill: '#FCA5A5' }),
  ]),
  universal: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    // Cross shape (universal joint)
    F(id + '_S1', { x: 14, y: 4, width: 4, height: 24, fill: '#DC2626', cornerRadius: 2 }),
    F(id + '_S2', { x: 4, y: 14, width: 24, height: 4, fill: '#EF4444', cornerRadius: 2 }),
    // Center connector
    F(id + '_S3', { x: 12, y: 12, width: 8, height: 8, fill: '#FFFFFF', cornerRadius: 4, stroke: '#DC2626', strokeWidth: 1 }),
  ]),
  screw: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    // Screw shaft
    F(id + '_S1', { x: 14, y: 4, width: 4, height: 20, fill: '#DC2626', cornerRadius: 1 }),
    // Thread lines
    F(id + '_S2', { x: 11, y: 8, width: 10, height: 2, fill: '#FCA5A5' }),
    F(id + '_S3', { x: 11, y: 13, width: 10, height: 2, fill: '#FCA5A5' }),
    F(id + '_S4', { x: 11, y: 18, width: 10, height: 2, fill: '#FCA5A5' }),
    // Point
    F(id + '_S5', { x: 15, y: 24, width: 2, height: 4, fill: '#DC2626' }),
  ]),
  planar: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    // Flat plane
    F(id + '_S1', { x: 4, y: 12, width: 24, height: 12, fill: '#FCA5A5', cornerRadius: 1, stroke: '#DC2626', strokeWidth: 1 }),
    // Surface dots
    F(id + '_S2', { x: 10, y: 16, width: 3, height: 3, fill: '#DC2626', cornerRadius: 1 }),
    F(id + '_S3', { x: 19, y: 16, width: 3, height: 3, fill: '#DC2626', cornerRadius: 1 }),
    // Arrows (slide)
    F(id + '_S4', { x: 14, y: 6, width: 4, height: 2, fill: '#EF4444' }),
    F(id + '_S5', { x: 4, y: 6, width: 4, height: 2, fill: '#EF4444' }),
  ]),

  // ── 驱动 Drive ──
  rotdrive: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FFF7ED', cornerRadius: 6 }, [
    // Motor body
    F(id + '_S1', { x: 6, y: 8, width: 14, height: 16, fill: '#EA580C', cornerRadius: 2 }),
    // Shaft
    F(id + '_S2', { x: 20, y: 14, width: 8, height: 4, fill: '#F97316', cornerRadius: 1 }),
    // Rotation arrow
    F(id + '_S3', { x: 22, y: 8, width: 6, height: 2, fill: '#FDBA74' }),
    F(id + '_S4', { x: 26, y: 8, width: 2, height: 4, fill: '#FDBA74' }),
  ]),
  trandrive: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FFF7ED', cornerRadius: 6 }, [
    // Actuator body
    F(id + '_S1', { x: 4, y: 10, width: 14, height: 12, fill: '#EA580C', cornerRadius: 2 }),
    // Rod
    F(id + '_S2', { x: 18, y: 14, width: 10, height: 4, fill: '#F97316', cornerRadius: 1 }),
    // Arrow right
    F(id + '_S3', { x: 26, y: 12, width: 2, height: 8, fill: '#FDBA74' }),
  ]),

  // ── 力 Force ──
  pp_contact: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#F0FDF4', cornerRadius: 6 }, [
    // Two spheres touching
    F(id + '_S1', { x: 4, y: 10, width: 12, height: 12, fill: '#FFFFFF', cornerRadius: 6, stroke: '#16A34A', strokeWidth: 2 }),
    F(id + '_S2', { x: 16, y: 10, width: 12, height: 12, fill: '#FFFFFF', cornerRadius: 6, stroke: '#22C55E', strokeWidth: 2 }),
    // Contact point
    F(id + '_S3', { x: 15, y: 14, width: 3, height: 3, fill: '#16A34A', cornerRadius: 1 }),
  ]),
  ps_contact: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#F0FDF4', cornerRadius: 6 }, [
    // Sphere
    F(id + '_S1', { x: 6, y: 6, width: 12, height: 12, fill: '#FFFFFF', cornerRadius: 6, stroke: '#16A34A', strokeWidth: 2 }),
    // Surface (flat)
    F(id + '_S2', { x: 4, y: 20, width: 24, height: 4, fill: '#22C55E', cornerRadius: 1 }),
    // Contact arrow
    F(id + '_S3', { x: 11, y: 16, width: 2, height: 4, fill: '#16A34A' }),
  ]),

  // ── 工具 Tool ──
  measure: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#ECFEFF', cornerRadius: 6 }, [
    // Ruler body
    F(id + '_S1', { x: 4, y: 10, width: 24, height: 12, fill: '#0891B2', cornerRadius: 2 }),
    // Tick marks
    F(id + '_S2', { x: 8, y: 10, width: 1, height: 6, fill: '#FFFFFF' }),
    F(id + '_S3', { x: 12, y: 10, width: 1, height: 8, fill: '#FFFFFF' }),
    F(id + '_S4', { x: 16, y: 10, width: 1, height: 6, fill: '#FFFFFF' }),
    F(id + '_S5', { x: 20, y: 10, width: 1, height: 8, fill: '#FFFFFF' }),
    F(id + '_S6', { x: 24, y: 10, width: 1, height: 6, fill: '#FFFFFF' }),
  ]),
  exploded: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#ECFEFF', cornerRadius: 6 }, [
    // Center block
    F(id + '_S1', { x: 12, y: 12, width: 8, height: 8, fill: '#06B6D4', cornerRadius: 1 }),
    // Arrows outward (4 directions)
    F(id + '_S2', { x: 4, y: 4, width: 6, height: 6, fill: '#0891B2', cornerRadius: 1 }),
    F(id + '_S3', { x: 22, y: 4, width: 6, height: 6, fill: '#0891B2', cornerRadius: 1 }),
    F(id + '_S4', { x: 4, y: 22, width: 6, height: 6, fill: '#0891B2', cornerRadius: 1 }),
    F(id + '_S5', { x: 22, y: 22, width: 6, height: 6, fill: '#0891B2', cornerRadius: 1 }),
    // Dotted lines
    F(id + '_S6', { x: 10, y: 8, width: 2, height: 2, fill: '#67E8F9' }),
    F(id + '_S7', { x: 20, y: 8, width: 2, height: 2, fill: '#67E8F9' }),
    F(id + '_S8', { x: 10, y: 22, width: 2, height: 2, fill: '#67E8F9' }),
    F(id + '_S9', { x: 20, y: 22, width: 2, height: 2, fill: '#67E8F9' }),
  ]),
  thicken: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#ECFEFF', cornerRadius: 6 }, [
    // Thin surface
    F(id + '_S1', { x: 4, y: 14, width: 24, height: 2, fill: '#0E7490' }),
    // Thick version above
    F(id + '_S2', { x: 4, y: 6, width: 24, height: 6, fill: '#06B6D4', cornerRadius: 1 }),
    // Arrow showing thickness direction
    F(id + '_S3', { x: 15, y: 12, width: 2, height: 6, fill: '#0E7490' }),
    F(id + '_S4', { x: 14, y: 17, width: 4, height: 2, fill: '#0E7490' }),
  ]),
  planarloop: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#ECFEFF', cornerRadius: 6 }, [
    // Loop shape (rectangle with rounded corners)
    F(id + '_S1', { x: 6, y: 6, width: 20, height: 20, fill: '#FFFFFF', cornerRadius: 4, stroke: '#0891B2', strokeWidth: 2 }),
    // Cut mark
    F(id + '_S2', { x: 14, y: 4, width: 4, height: 4, fill: '#ECFEFF' }),
    F(id + '_S3', { x: 15, y: 3, width: 2, height: 3, fill: '#EF4444' }),
  ]),

  // ── 导出 Export ──
  check: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#F3F4F6', cornerRadius: 6 }, [
    // Checkmark
    F(id + '_S1', { x: 8, y: 16, width: 6, height: 3, fill: '#4B5563' }),
    F(id + '_S2', { x: 12, y: 12, width: 3, height: 10, fill: '#4B5563' }),
    // Circle outline
    F(id + '_S3', { x: 5, y: 5, width: 22, height: 22, fill: '#FFFFFF', cornerRadius: 11, stroke: '#4B5563', strokeWidth: 2 }),
  ]),
  accept_exit: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#F3F4F6', cornerRadius: 6 }, [
    // Box
    F(id + '_S1', { x: 4, y: 8, width: 16, height: 16, fill: '#FFFFFF', cornerRadius: 2, stroke: '#6B7280', strokeWidth: 2 }),
    // Arrow out
    F(id + '_S2', { x: 18, y: 12, width: 10, height: 3, fill: '#4B5563' }),
    F(id + '_S3', { x: 24, y: 10, width: 3, height: 7, fill: '#4B5563' }),
  ]),

  // ── 设置 Settings ──
  settings: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#F3F4F6', cornerRadius: 6 }, [
    // Gear outer
    F(id + '_S1', { x: 6, y: 6, width: 20, height: 20, fill: '#6B7280', cornerRadius: 4 }),
    // Gear inner hole
    F(id + '_S2', { x: 12, y: 12, width: 8, height: 8, fill: '#F3F4F6', cornerRadius: 4 }),
    // Teeth (4)
    F(id + '_S3', { x: 14, y: 3, width: 4, height: 4, fill: '#6B7280' }),
    F(id + '_S4', { x: 14, y: 25, width: 4, height: 4, fill: '#6B7280' }),
    F(id + '_S5', { x: 3, y: 14, width: 4, height: 4, fill: '#6B7280' }),
    F(id + '_S6', { x: 25, y: 14, width: 4, height: 4, fill: '#6B7280' }),
  ]),

  // ── 关于 About ──
  about: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#F5F3FF', cornerRadius: 6 }, [
    // Circle
    F(id + '_S1', { x: 6, y: 6, width: 20, height: 20, fill: '#FFFFFF', cornerRadius: 10, stroke: '#9333EA', strokeWidth: 2 }),
    // i letter
    F(id + '_S2', { x: 15, y: 11, width: 2, height: 2, fill: '#9333EA', cornerRadius: 1 }),
    F(id + '_S3', { x: 14, y: 15, width: 4, height: 8, fill: '#9333EA', cornerRadius: 1 }),
  ]),

  // ── 流体 Fluid ──
  simple_tank: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#EFF6FF', cornerRadius: 6 }, [
    F(id + '_S1', { x: 6, y: 4, width: 20, height: 24, fill: '#FFFFFF', cornerRadius: 3, stroke: '#0284C7', strokeWidth: 2 }),
    // Liquid level
    F(id + '_S2', { x: 8, y: 14, width: 16, height: 12, fill: '#7DD3FC', cornerRadius: [0, 0, 2, 2] }),
  ]),
  tank_slice: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#EFF6FF', cornerRadius: 6 }, [
    F(id + '_S1', { x: 6, y: 4, width: 20, height: 24, fill: '#FFFFFF', cornerRadius: 3, stroke: '#0369A1', strokeWidth: 2 }),
    // Slice lines
    F(id + '_S2', { x: 8, y: 10, width: 16, height: 1, fill: '#0369A1' }),
    F(id + '_S3', { x: 8, y: 16, width: 16, height: 1, fill: '#0369A1' }),
    F(id + '_S4', { x: 8, y: 22, width: 16, height: 1, fill: '#0369A1' }),
  ]),
  rib_slice: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#EFF6FF', cornerRadius: 6 }, [
    F(id + '_S1', { x: 6, y: 4, width: 20, height: 24, fill: '#FFFFFF', cornerRadius: 3, stroke: '#0EA5E9', strokeWidth: 2 }),
    // Rib plate
    F(id + '_S2', { x: 10, y: 8, width: 2, height: 16, fill: '#0EA5E9' }),
    F(id + '_S3', { x: 20, y: 8, width: 2, height: 16, fill: '#0EA5E9' }),
    F(id + '_S4', { x: 12, y: 14, width: 8, height: 2, fill: '#0EA5E9' }),
  ]),
  fluid_port: (id) => F(id + '_ICO', { width: 32, height: 32, fill: '#FFFBEB', cornerRadius: 6 }, [
    // Port circle
    F(id + '_S1', { x: 8, y: 8, width: 16, height: 16, fill: '#FFFFFF', cornerRadius: 8, stroke: '#B45309', strokeWidth: 2 }),
    // Arrow in/out
    F(id + '_S2', { x: 14, y: 4, width: 4, height: 8, fill: '#B45309', cornerRadius: 1 }),
    F(id + '_S3', { x: 12, y: 4, width: 8, height: 2, fill: '#B45309' }),
  ]),
};

// ─── Icon builders: 16x16 (Ribbon small buttons) ───
const ICONS_16 = {
  import: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#EFF6FF', cornerRadius: 3 }, [
    F(id + '_S1', { x: 4, y: 1, width: 6, height: 9, fill: '#2563EB', cornerRadius: 1 }),
    F(id + '_S2', { x: 8, y: 1, width: 2, height: 2, fill: '#93C5FD' }),
    F(id + '_S3', { x: 6, y: 11, width: 2, height: 4, fill: '#2563EB' }),
  ]),
  open: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#EFF6FF', cornerRadius: 3 }, [
    F(id + '_S1', { x: 2, y: 4, width: 12, height: 8, fill: '#3B82F6', cornerRadius: 1 }),
    F(id + '_S2', { x: 2, y: 2, width: 5, height: 3, fill: '#3B82F6', cornerRadius: [1, 1, 0, 0] }),
    F(id + '_S3', { x: 1, y: 7, width: 14, height: 6, fill: '#60A5FA', cornerRadius: 1 }),
  ]),
  save: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#EFF6FF', cornerRadius: 3 }, [
    F(id + '_S1', { x: 2, y: 2, width: 12, height: 12, fill: '#3B82F6', cornerRadius: 1 }),
    F(id + '_S2', { x: 4, y: 3, width: 8, height: 4, fill: '#FFFFFF' }),
    F(id + '_S3', { x: 4, y: 9, width: 8, height: 4, fill: '#1D4ED8' }),
  ]),
  saveas: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#EFF6FF', cornerRadius: 3 }, [
    F(id + '_S1', { x: 1, y: 2, width: 10, height: 11, fill: '#3B82F6', cornerRadius: 1 }),
    F(id + '_S2', { x: 3, y: 3, width: 6, height: 3, fill: '#FFFFFF' }),
    F(id + '_S3', { x: 11, y: 9, width: 2, height: 6, fill: '#F59E0B' }),
  ]),
  merge: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#ECFDF5', cornerRadius: 3 }, [
    F(id + '_S1', { x: 2, y: 3, width: 7, height: 6, fill: '#059669', cornerRadius: 1 }),
    F(id + '_S2', { x: 7, y: 7, width: 7, height: 6, fill: '#34D399', cornerRadius: 1 }),
  ]),
  split: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#ECFDF5', cornerRadius: 3 }, [
    F(id + '_S1', { x: 1, y: 4, width: 6, height: 5, fill: '#059669', cornerRadius: 1 }),
    F(id + '_S2', { x: 9, y: 7, width: 6, height: 5, fill: '#34D399', cornerRadius: 1 }),
    F(id + '_S3', { x: 6, y: 7, width: 4, height: 1, fill: '#065F46' }),
  ]),
  clean: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#ECFDF5', cornerRadius: 3 }, [
    F(id + '_S1', { x: 6, y: 2, width: 3, height: 8, fill: '#059669' }),
    F(id + '_S2', { x: 4, y: 10, width: 7, height: 4, fill: '#34D399', cornerRadius: [0, 0, 2, 2] }),
  ]),
  defgrp: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#ECFDF5', cornerRadius: 3 }, [
    F(id + '_S1', { x: 2, y: 3, width: 12, height: 8, fill: '#059669', cornerRadius: 1 }),
    F(id + '_S2', { x: 2, y: 1, width: 5, height: 3, fill: '#059669', cornerRadius: [1, 1, 0, 0] }),
    F(id + '_S3', { x: 6, y: 6, width: 4, height: 4, fill: '#FFF', cornerRadius: 2 }),
  ]),
  measure: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#ECFEFF', cornerRadius: 3 }, [
    F(id + '_S1', { x: 2, y: 5, width: 12, height: 6, fill: '#0891B2', cornerRadius: 1 }),
    F(id + '_S2', { x: 4, y: 5, width: 1, height: 3, fill: '#FFF' }),
    F(id + '_S3', { x: 7, y: 5, width: 1, height: 4, fill: '#FFF' }),
    F(id + '_S4', { x: 10, y: 5, width: 1, height: 3, fill: '#FFF' }),
  ]),
  exploded: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#ECFEFF', cornerRadius: 3 }, [
    F(id + '_S1', { x: 6, y: 6, width: 4, height: 4, fill: '#06B6D4' }),
    F(id + '_S2', { x: 2, y: 2, width: 3, height: 3, fill: '#0891B2' }),
    F(id + '_S3', { x: 11, y: 2, width: 3, height: 3, fill: '#0891B2' }),
    F(id + '_S4', { x: 2, y: 11, width: 3, height: 3, fill: '#0891B2' }),
    F(id + '_S5', { x: 11, y: 11, width: 3, height: 3, fill: '#0891B2' }),
  ]),
  thicken: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#ECFEFF', cornerRadius: 3 }, [
    F(id + '_S1', { x: 2, y: 7, width: 12, height: 1, fill: '#0E7490' }),
    F(id + '_S2', { x: 2, y: 3, width: 12, height: 3, fill: '#06B6D4' }),
  ]),
  planarloop: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#ECFEFF', cornerRadius: 3 }, [
    F(id + '_S1', { x: 3, y: 3, width: 10, height: 10, fill: '#FFF', cornerRadius: 2, stroke: '#0891B2', strokeWidth: 1 }),
    F(id + '_S2', { x: 7, y: 2, width: 2, height: 2, fill: '#EF4444' }),
  ]),
  check: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#F3F4F6', cornerRadius: 3 }, [
    F(id + '_S1', { x: 2, y: 2, width: 12, height: 12, fill: '#FFF', cornerRadius: 6, stroke: '#4B5563', strokeWidth: 1 }),
    F(id + '_S2', { x: 4, y: 8, width: 3, height: 2, fill: '#4B5563' }),
    F(id + '_S3', { x: 6, y: 6, width: 2, height: 5, fill: '#4B5563' }),
  ]),
  accept_exit: (id) => F(id + '_ICO', { width: 16, height: 16, fill: '#F3F4F6', cornerRadius: 3 }, [
    F(id + '_S1', { x: 2, y: 4, width: 8, height: 8, fill: '#FFF', cornerRadius: 1, stroke: '#6B7280', strokeWidth: 1 }),
    F(id + '_S2', { x: 9, y: 6, width: 5, height: 2, fill: '#4B5563' }),
    F(id + '_S3', { x: 12, y: 5, width: 2, height: 4, fill: '#4B5563' }),
  ]),
};

// ─── Tree node icons: 14x14 ─────────────────────────
const TREE_ICONS = {
  body: (id) => F(id + '_I', { width: 14, height: 14, fill: '#DBEAFE', cornerRadius: 3 }, [
    F(id + '_IS1', { x: 3, y: 3, width: 8, height: 8, fill: '#2563EB', cornerRadius: 2 }),
    F(id + '_IS2', { x: 5, y: 5, width: 4, height: 4, fill: '#DBEAFE', cornerRadius: 1 }),
  ]),
  part: (id) => F(id + '_I', { width: 12, height: 12, fill: '#FEF3C7', cornerRadius: 2 }, [
    F(id + '_IS1', { x: 2, y: 2, width: 8, height: 8, fill: '#F59E0B', cornerRadius: 1 }),
  ]),
  marker: (id) => F(id + '_I', { width: 10, height: 10, fill: '#F5F3FF', cornerRadius: 5 }, [
    F(id + '_IS1', { x: 4, y: 1, width: 2, height: 8, fill: '#7C3AED' }),
    F(id + '_IS2', { x: 1, y: 4, width: 8, height: 2, fill: '#7C3AED' }),
  ]),
  connection: (id) => F(id + '_I', { width: 14, height: 14, fill: '#FEF2F2', cornerRadius: 3 }, [
    F(id + '_IS1', { x: 2, y: 4, width: 4, height: 6, fill: '#DC2626', cornerRadius: 2 }),
    F(id + '_IS2', { x: 8, y: 4, width: 4, height: 6, fill: '#EF4444', cornerRadius: 2 }),
    F(id + '_IS3', { x: 5, y: 6, width: 4, height: 2, fill: '#DC2626' }),
  ]),
  drive: (id) => F(id + '_I', { width: 14, height: 14, fill: '#FFF7ED', cornerRadius: 3 }, [
    F(id + '_IS1', { x: 2, y: 4, width: 6, height: 6, fill: '#EA580C', cornerRadius: 1 }),
    F(id + '_IS2', { x: 8, y: 6, width: 4, height: 2, fill: '#F97316' }),
  ]),
  force: (id) => F(id + '_I', { width: 14, height: 14, fill: '#F0FDF4', cornerRadius: 3 }, [
    F(id + '_IS1', { x: 3, y: 3, width: 8, height: 8, fill: '#FFFFFF', cornerRadius: 4, stroke: '#16A34A', strokeWidth: 1 }),
    F(id + '_IS2', { x: 6, y: 6, width: 2, height: 2, fill: '#16A34A', cornerRadius: 1 }),
  ]),
  material: (id) => F(id + '_I', { width: 14, height: 14, fill: '#FEF9C3', cornerRadius: 7 }, [
    F(id + '_IS1', { x: 3, y: 3, width: 8, height: 8, fill: '#F59E0B', cornerRadius: 4 }),
  ]),
};

// ─── Mapping: button ID patterns -> icon key ────────
const BIG_BUTTON_MAP = {
  '_BTN_MKR': 'marker', '_BTN_MARKER': 'marker',
  '_BTN_PT': 'designpoint', '_BTN_POINT': 'designpoint',
  '_BTN_FIX': 'fixed', '_BTN_FIXED': 'fixed',
  '_BTN_REV': 'revolute', '_BTN_REVO': 'revolute',
  '_BTN_PRI': 'prismatic', '_BTN_PRISM': 'prismatic',
  '_BTN_CYL': 'cylindrical', '_BTN_CYLIN': 'cylindrical',
  '_BTN_SPH': 'spherical', '_BTN_SPHER': 'spherical',
  '_BTN_UNI': 'universal', '_BTN_UNIV': 'universal',
  '_BTN_SCR': 'screw',
  '_BTN_PLN': 'planar', '_BTN_PLANAR': 'planar',
  '_BTN_RDRV': 'rotdrive', '_BTN_ROTDRV': 'rotdrive',
  '_BTN_TDRV': 'trandrive', '_BTN_TRNDRV': 'trandrive',
  '_BTN_PP': 'pp_contact',
  '_BTN_PS': 'ps_contact',
  '_BTN_MEAS': 'measure',
  '_BTN_EXPL': 'exploded',
  '_BTN_THK': 'thicken', '_BTN_THICK': 'thicken',
  '_BTN_LOOP': 'planarloop',
  '_BTN_CHK': 'check',
  '_BTN_AE': 'accept_exit', '_BTN_EXIT': 'accept_exit',
  '_BTN_SET': 'settings', '_BTN_SETTINGS': 'settings',
  '_BTN_ABT': 'about',
  '_BTN_STANK': 'simple_tank', '_BTN_SIMTANK': 'simple_tank',
  '_BTN_TANK': 'tank_slice',
  '_BTN_RIB': 'rib_slice',
  '_BTN_PORT': 'fluid_port',
};

const SMALL_BUTTON_MAP = {
  '_BTN_IMP': 'import', '_BTN_IMPORT': 'import',
  '_BTN_OPEN': 'open',
  '_BTN_SAVE': 'save',
  '_BTN_SAVEAS': 'saveas',
  '_BTN_MERGE': 'merge',
  '_BTN_SPLIT': 'split',
  '_BTN_CLEAN': 'clean',
  '_BTN_DEFGRP': 'defgrp',
};

// ─── Tree node root mapping ─────────────────────────
const TREE_ROOT_MAP = {
  '_RB': 'body', '_R_BODY': 'body',
  '_RC': 'connection', '_R_CONN': 'connection',
  '_RD': 'drive', '_R_DRV': 'drive',
  '_RF': 'force', '_R_FORCE': 'force',
  '_RM': 'material', '_R_MAT': 'material',
};

// ─── Recursive node replacer ────────────────────────
function walkAndReplace(node) {
  if (!node || typeof node !== 'object') return;
  if (!Array.isArray(node.children)) return;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (!child || !child.id) continue;

    // Replace big button icons (32x32)
    if (child.id.endsWith('_ICO') && child.width === 32 && child.height === 32) {
      const parentId = child.id.replace('_ICO', '');
      for (const [suffix, key] of Object.entries(BIG_BUTTON_MAP)) {
        if (parentId.endsWith(suffix) && ICONS_32[key]) {
          node.children[i] = ICONS_32[key](parentId);
          break;
        }
      }
    }

    // Replace small button icons (16x16)
    if (child.id.endsWith('_ICO') && child.width === 16 && child.height === 16) {
      const parentId = child.id.replace('_ICO', '');
      for (const [suffix, key] of Object.entries(SMALL_BUTTON_MAP)) {
        if (parentId.endsWith(suffix) && ICONS_16[key]) {
          node.children[i] = ICONS_16[key](parentId);
          break;
        }
      }
    }

    // Replace tree root icons (14x14)
    if (child.id.endsWith('_I') && (child.width === 14 || child.width === 12 || child.width === 10)) {
      const parentId = child.id.replace('_I', '');
      for (const [suffix, key] of Object.entries(TREE_ROOT_MAP)) {
        if (parentId.endsWith(suffix) && TREE_ICONS[key]) {
          node.children[i] = TREE_ICONS[key](parentId);
          break;
        }
      }
      // Part nodes
      if (child.fill === '#F59E0B' && child.width === 12) {
        node.children[i] = TREE_ICONS.part(child.id.replace('_I', ''));
      }
      // Marker/leaf nodes
      if ((child.fill === '#7C3AED' || child.cornerRadius === 5) && child.width === 10) {
        node.children[i] = TREE_ICONS.marker(child.id.replace('_I', ''));
      }
    }

    // Recurse
    walkAndReplace(child);
  }
}

// ─── Apply to all screens ───────────────────────────
let count = 0;
for (const screen of pen.children) {
  walkAndReplace(screen);
  count++;
}

fs.writeFileSync(penPath, JSON.stringify(pen, null, 2) + '\n', 'utf8');
console.log('Replaced icons in ' + count + ' screens');
