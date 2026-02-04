# CadToolOnline

将桌面版 CADToolbox (Qt/C++) 转为 VSCode 插件在线版。

## 技术栈

- 几何内核：OCCT V8_0_0_rc3 (WebAssembly)
- 渲染：three.js ^0.170.0
- 拓扑图：@maxgraph/core
- 构建：Vite + pnpm workspace

## 关键约定

- 坐标系：右手系，Z 轴向上
- 角度单位：弧度
- OCCT 精度：`1e-6` ~ `1e+6`

## 参考项目

- `../CADToolbox` - 原桌面版 (Qt 5.14.2 + OCCT 7.7.0 + Sysplorer SDK)
- [chili3d](https://github.com/xiangechen/chili3d) - OCCT WASM 编译参考

## 核心模块映射

| CADToolbox 源码 | 功能 |
|----------------|------|
| `cad_mbs_model/src/model/factory/` | 分组/关节工厂 |
| `cad_mbs_model/src/model/body/` | 刚体、分组连接 |
| `cad_mbs_model/src/model/motion/` | 关节驱动 |
| `mw_cad_toolbox/src/exchanger/mo_builder/` | Modelica 导出 |

## 关节类型

Revolute, Prismatic, Cylindrical, Spherical, Universal, Planar, Fixed

## 详细设计

见 [.claude/agents/project-context.md](.claude/agents/project-context.md)
