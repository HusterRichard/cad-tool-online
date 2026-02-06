# Prompt 汇总及迭代记录

本文档记录了在 CadToolOnline 项目开发过程中使用的关键 Prompt，展示 AI 辅助开发的迭代过程。

## Prompt 编写原则

1. **明确目标**: 清晰描述期望的输出结果
2. **提供上下文**: 包含项目背景、技术栈、约束条件
3. **分步骤**: 复杂任务拆解为多个小步骤
4. **示例驱动**: 提供输入输出示例
5. **迭代优化**: 根据结果反馈调整 Prompt

---

## Prompt 1: OCCT WASM 编译环境搭建

### 初始 Prompt (v1)
```
帮我设置 OpenCASCADE 的 WebAssembly 编译环境，使用 Emscripten。
```

**问题**: 过于宽泛，缺少具体版本和配置要求

### 改进 Prompt (v2)
```
我需要将 OpenCASCADE V8_0_0_rc3 编译为 WebAssembly，要求：

技术栈:
- Emscripten v4.0.8
- CMake >= 3.30
- Ninja 构建系统

需要的 OCCT 模块:
- FoundationClasses: TKernel, TKMath
- ModelingData: TKG2d, TKG3d, TKGeomBase, TKBRep
- DataExchange: TKSTEP, TKIGES, TKSTL

编译配置:
- 优化级别: -O3
- 输出格式: ES6 module
- 包含 Embind 绑定支持

请提供:
1. CMakeLists.txt 配置
2. 构建脚本 (bash)
3. Embind 绑定示例
```

**效果**:
- ✅ 成功生成可用的 CMakeLists.txt
- ✅ 自动化构建脚本
- ✅ WASM 体积控制在合理范围

### 迭代记录
- v1 → v2: 增加具体版本号和模块列表
- v2 → v3: 添加优化参数和输出格式要求

---

## Prompt 2: STEP 文件导入功能

### 初始 Prompt
```
实现 STEP 文件导入功能，使用 OCCT WASM。
```

### 改进 Prompt
```
基于已编译的 OCCT WASM 模块，实现 STEP 文件导入功能。

需求:
1. 从 Uint8Array 读取 STEP 文件数据
2. 解析为 TopoDS_Shape
3. 生成三角网格用于渲染
4. 支持导入进度回调

C++ 端 (geo_binding.cpp):
- 使用 STEPControl_Reader 读取 STEP
- 使用 BRepMesh_IncrementalMesh 生成网格
- 通过 Embind 导出接口

TypeScript 端:
- 封装类型安全的 API
- 处理异步加载
- 错误处理

请实现:
1. C++ 绑定代码
2. TypeScript 类型定义
3. 使用示例
```

**效果**:
- ✅ 成功解析 STEP 文件
- ✅ 进度回调机制正常
- ❌ 大文件性能问题（后续优化）

### 迭代记录
- v1: 基础实现
- v2: 添加进度回调
- v3: 优化大文件处理（使用 Worker）

---

## Prompt 3: Three.js 渲染器封装

### Prompt
```
封装 Three.js 渲染器，用于显示 OCCT WASM 生成的网格数据。

坐标系约定:
- OCCT: Z-up 右手系
- Three.js: 需与 OCCT 保持一致

功能需求:
1. 场景初始化 (Scene, Camera, Renderer)
2. 轨道控制器 (OrbitControls)
3. 渲染网格数据 (vertices, indices, normals)
4. Fit View 功能
5. 对象选择高亮

输入数据格式:
interface MeshData {
  vertices: Float32Array;  // [x, y, z, x, y, z, ...]
  indices: Uint32Array;    // [i1, i2, i3, ...]
  normals: Float32Array;   // [nx, ny, nz, ...]
}

请实现 ThreeViewer 类，包含上述功能。
```

**效果**:
- ✅ 渲染正常，坐标系一致
- ✅ Fit View 计算准确
- ✅ 性能满足需求

---

## Prompt 4: VSCode 插件 WebView 通信

### Prompt
```
实现 VSCode 插件与 WebView 之间的双向通信。

场景:
- Extension 端: Node.js 环境，可访问文件系统
- WebView 端: 浏览器环境，运行 React + Three.js

通信需求:
1. Extension → WebView: 发送 STEP 文件数据
2. WebView → Extension: 请求保存 Modelica 文件
3. 类型安全的消息定义

请实现:
1. Extension 端消息处理
2. WebView 端消息处理
3. TypeScript 类型定义（共享）
4. 错误处理机制
```

**效果**:
- ✅ 消息传递稳定
- ✅ 类型安全
- ✅ 错误恢复机制完善

---

## Prompt 5: Ribbon 菜单系统

### Prompt
```
实现类似 Microsoft Office 的 Ribbon 菜单系统，用于 VSCode WebView。

UI 设计:
- Tab 切换: Home, Insert, Modify, View
- 每个 Tab 包含多个 Group
- Group 包含按钮、下拉菜单等控件

技术栈:
- React + TypeScript
- CSS Modules (不使用第三方 UI 库)

功能需求:
1. 响应式布局
2. 图标 + 文字按钮
3. 命令分发机制
4. 键盘快捷键支持

请实现:
1. Ribbon 组件架构
2. 示例配置数据
3. 命令处理系统
```

**效果**:
- ✅ UI 符合预期
- ✅ 命令系统灵活
- ⚠️ 样式需微调（后续优化）

---

## Prompt 6: 质量属性计算

### Prompt
```
使用 OCCT 计算多体动力学所需的质量属性。

输入:
- TopoDS_Shape: 几何形状
- density: 材料密度 (kg/m³)

输出:
- mass: 质量 (kg)
- centerOfMass: 质心 [x, y, z]
- inertia: 惯性张量 (3x3 矩阵)

OCCT API:
- GProp_GProps: 质量属性计算
- BRepGProp::VolumeProperties: 体积属性

请实现:
1. C++ 计算函数
2. Embind 绑定
3. TypeScript 封装
4. 单元测试
```

**效果**:
- ✅ 计算结果准确（与桌面版对比）
- ✅ 性能可接受
- ✅ 单元测试覆盖

---

## Prompt 7: 项目架构重构

### Prompt
```
根据以下评分标准，帮我重构项目目录结构：

[评分标准内容...]

当前项目是一个 TypeScript monorepo (pnpm workspace)，包含：
- packages/core: 核心数据模型
- packages/geo: OCCT WASM 封装
- packages/three: Three.js 渲染
- packages/ui: React 组件
- packages/vscode: VSCode 插件

需要添加的目录：
- report/: 结项报告和架构文档
- demo/: 演示视频和截图
- prompts/: Prompt 记录
- ai-artifacts/: AI 产物
- tests/: 测试代码
- data/: 示例数据

请帮我：
1. 创建缺失的目录
2. 编写必需的文档框架
3. 更新 README.md
4. 添加运行和测试脚本
```

**效果**: 本次重构 ✅

---

## 总结与经验

### 有效的 Prompt 模式

1. **目标 + 约束 + 示例**
   ```
   目标: 实现 XXX 功能
   约束: 使用 YYY 技术，不超过 ZZZ
   示例: 输入 A，输出 B
   ```

2. **分层描述**
   ```
   背景: ...
   技术栈: ...
   需求: ...
   实现: ...
   ```

3. **增量迭代**
   - 先基础实现
   - 再添加功能
   - 最后优化性能

### 常见问题与解决

| 问题 | 解决方案 |
|------|----------|
| 输出不符合预期 | 增加示例和约束条件 |
| 代码质量不高 | 指定编码规范和测试要求 |
| 上下文丢失 | 在 Prompt 中重申关键信息 |
| 性能问题 | 明确性能指标和优化方向 |

### 后续优化方向

- [ ] 使用 AI 生成单元测试
- [ ] 自动化文档生成
- [ ] 代码审查辅助
- [ ] 性能优化建议

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 待填写 | v1.0 | 初始版本，记录前 7 个关键 Prompt |
