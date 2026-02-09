---
name: mbs-domain
description: 多体动力学（MBS）领域知识，涵盖刚体、标架、关节类型、驱动类型及 Modelica 映射。在开发 MBS 相关功能、修复 Bug 或进行重构时使用。
---

# 多体动力学领域知识

## 核心概念

### 刚体 (Rigid Body)
- 质量 (mass)
- 质心 (center of mass)
- 惯性矩阵 (inertia matrix) - 3x3 对称矩阵

### 标架 (Frame/Marker)
- 位置 (position) - Vec3
- 方向 (orientation) - 3x3 旋转矩阵或四元数
- iMarker/jMarker - 关节连接的两个标架

### 关节类型
| 类型 | 自由度 | 约束 |
|------|--------|------|
| Revolute | 1 (旋转) | 5 |
| Prismatic | 1 (平移) | 5 |
| Cylindrical | 2 | 4 |
| Spherical | 3 | 3 |
| Universal | 2 | 4 |
| Planar | 3 | 3 |
| Fixed | 0 | 6 |

### 驱动类型
- 位移驱动: s(t)
- 速度驱动: v(t)
- 加速度驱动: a(t)
- 力/力矩驱动: F(t)/T(t)

## Modelica 映射
```modelica
model Body
  parameter SI.Mass m;
  parameter SI.Position r_CM[3];
  parameter SI.Inertia I_11, I_22, I_33, I_21, I_31, I_32;
end Body;
```
