# 标架创建功能 - 快速启动指南

## 🚀 快速开始（3步完成）

### 步骤 1：编译 WASM 模块

```bash
# 进入 geo 包的 C++ 目录
cd packages/geo/cpp

# 激活 Emscripten 环境
# Windows (CMD):
build\emsdk\emsdk_env.bat

# Windows (PowerShell):
.\build\emsdk\emsdk_env.ps1

# Linux/Mac:
source build/emsdk/emsdk_env.sh

# 编译 Release 版本
bash build_wasm.sh release

# 预期看到：
# === Building cad-geo WASM module ===
# Activating Emscripten...
# Building release configuration...
# [100%] Built target cad-geo
# === Build completed ===
```

## 步骤 2：构建 TypeScript 包

```bash
# 返回项目根目录
cd ../../..

# 安装依赖（如果还没安装）
pnpm install

# 构建所有包
pnpm build

# 预期看到每个包的构建成功消息
```

## 步骤 3：启动并测试

```bash
# 启动 VSCode 扩展调试
# 在 VSCode 中按 F5

# 或使用命令
pnpm dev
```

---

## 📋 测试清单

### 基础功能测试

- [ ] **1. 导入模型**
  - 点击 "Import STEP" 按钮
  - 选择一个 STEP 文件（建议先用简单的几何体）
  - 等待模型加载完成

- [ ] **2. 选择零件**
  - 在左侧模型树中点击一个零件
  - 或在 3D 视图中直接点击零件
  - 确认零件被选中（高亮显示）

- [ ] **3. 创建标架**
  - 点击 Ribbon 菜单 → "标架设计" → "新建标架"
  - 状态栏应显示："Click on a face to create marker (法向向外)"
  - 鼠标光标变为十字线 ✚
  - 点击弹窗确认信息

- [ ] **4. 放置标架**
  - 在零件表面点击
  - 观察 3D 场景中出现坐标系：
    - 🔴 红色箭头 = X 轴
    - 🟢 绿色箭头 = Y 轴
    - 🔵 蓝色箭头 = Z 轴（法向向外）
    - 🟡 黄色球体 = 原点
  - 状态栏显示创建成功信息

- [ ] **5. 验证法向方向**
  - Z 轴（蓝色）应该指向零件外部
  - 在平面上：Z 轴垂直于平面
  - 在曲面上：Z 轴垂直于切平面

- [ ] **6. 删除标架**
  - 点击 Ribbon 菜单 → "标架设计" → "删除标架"
  - 最后创建的标架应该消失
  - 状态栏显示删除成功

### 高级测试

- [ ] **7. 多个标架**
  - 在同一个零件上创建多个标架
  - 每个标架应该有独立的 ID 和名称
  - 删除时按 LIFO 顺序（后进先出）

- [ ] **8. 不同面类型**
  - 测试平面（立方体顶面）
  - 测试圆柱面
  - 测试球面
  - 测试复杂曲面

- [ ] **9. 边缘情况**
  - 点击边缘（应该失败，提示点击面上）
  - 点击空白处（应该失败）
  - 未选择零件时创建（应该提示先选择零件）

---

## 🐛 故障排查

### 问题 1：WASM 编译失败

**症状**：`bash build_wasm.sh` 报错

**解决方案**：

```bash
# 检查 Emscripten 是否激活
em++ --version
# 应该显示：emcc (Emscripten gcc/clang-like replacement)

# 如果未激活，重新激活
source build/emsdk/emsdk_env.sh  # Linux/Mac
# 或
build\emsdk\emsdk_env.bat         # Windows

# 检查 OCCT 是否存在
ls build/occt/
# 应该看到 src、adm 等目录

# 如果 OCCT 不存在，运行设置脚本
cd ../..
pnpm setup:wasm
```

## 问题 2：TypeScript 类型错误

**症状**：`pnpm build` 报类型错误

**解决方案**：

```bash
# 检查 WASM 类型定义文件是否生成
cat packages/geo/wasm/cad-geo.d.ts | grep getFaceNormalAtPoint
# 应该看到函数声明

# 如果没有，重新编译 WASM
cd packages/geo/cpp
bash build_wasm.sh release

# 清理并重新构建
cd ../../..
pnpm clean
pnpm build
```

## 问题 3：点击面无响应

**症状**：点击零件表面没有创建标架

**检查清单**：

```javascript
// 1. 打开浏览器控制台（F12）
// 2. 查看是否有错误信息

// 3. 检查是否选中了零件
console.log(selectedShapeId);  // 应该不是 null

// 4. 检查射线是否正确
// 点击时应该看到：
[Marker Creation] Ray: {origin: {...}, direction: {...}}

// 5. 检查法向计算结果
// 应该看到：
[Marker Creation] Face normal result: {success: true, ...}

// 6. 如果看到 "No face found"
// - 确保点击在面上（不是边缘或空白）
// - 尝试点击较大的平面
// - 检查模型是否正确加载
```

### 问题 4：标架方向不对

**症状**：Z 轴没有指向外部

**调试步骤**：

```javascript
// 在控制台检查标架数据
console.log(createdMarkers);

// 检查最后一个标架
const marker = createdMarkers[createdMarkers.length - 1];
console.log('Position:', marker.position);
console.log('Orientation:', marker.orientation);

// Z 轴应该是 orientation.m 的第 3、6、9 个元素
const zAxis = {
  x: marker.orientation.m[2],
  y: marker.orientation.m[5],
  z: marker.orientation.m[8]
};
console.log('Z-axis:', zAxis);
```

### 问题 5：WASM 文件过大

**症状**：WASM 文件 > 10MB

**优化方案**：

```bash
# 使用 Release 模式（应该已经在用）
bash build_wasm.sh release

# 检查文件大小
ls -lh ../wasm/cad-geo.wasm

# 如果还是太大，编辑 CMakeLists.txt
# 添加更激进的优化选项（可选）
# -Os (已有) 改为 -Oz
# 添加 --closure 1 进行代码压缩
```

---

## 📊 性能基准

### 正常性能指标

| 操作 | 预期时间 | 说明 |
|------|---------|------|
| WASM 编译 | 2-5 分钟 | Release 模式 |
| TypeScript 构建 | 30-60 秒 | 所有包 |
| 模型加载（小） | < 1 秒 | < 100 面 |
| 模型加载（中） | 1-5 秒 | 100-10k 面 |
| 模型加载（大） | 5-30 秒 | 10k-100k 面 |
| 标架创建 | < 100ms | 点击到显示 |
| 法向计算 | < 50ms | WASM 调用 |

### 性能优化建议

如果超过上述时间：
1. 检查是否使用 Release 模式
2. 减少模型面数（简化 STEP 文件）
3. 关闭不必要的浏览器扩展
4. 增加 WASM 堆内存（见 CMakeLists.txt）

---

## 📝 控制台日志参考

### 正常流程日志

```
[MBS Action] createFrame {}
[Marker Creation] Ray: {
  origin: {x: 50, y: 50, z: 100},
  direction: {x: 0, y: 0, z: -1}
}
[Marker Creation] Face normal result: {
  success: true,
  position: {x: 10, y: 20, z: 5},
  normal: {x: 0, y: 0, z: 1},
  distance: 95
}
[Marker Creation] Created marker: MbsMarker {
  id: "marker_1738838400000_1",
  name: "Marker1",
  position: {x: 10, y: 20, z: 5},
  orientation: {...},
  groupId: "step_1_node_1_shape"
}
```

### 错误日志示例

```
// 未选择零件
[Alert] Please select a part first to create a marker

// 点击未命中
[Alert] No face found at click position. Please click on a face.

// OCCT 错误
Face normal calculation failed: Shape not found
```

---

## 🎯 下一步建议

### 立即可做
1. ✅ 编译和测试基本功能
2. ✅ 用简单几何体验证
3. ✅ 检查法向方向正确性

### 短期改进
1. 添加单元测试（见 marker-creation-implementation.md）
2. 优化用户体验（添加撤销功能）
3. 改进错误提示（更详细的失败原因）

### 中期计划
1. 实现标架编辑功能
2. 添加标架列表面板
3. 支持标架持久化（保存/加载）

### 长期目标
1. 标架约束和吸附
2. 导出到 Modelica
3. 与关节系统集成

---

## 📞 需要帮助？

如果遇到问题：
1. 检查浏览器控制台日志
2. 查看本文档的故障排查部分
3. 参考详细实现文档：`marker-creation-implementation.md`
4. 检查项目文档：`.claude/agents/project-context.md`

---

**最后更新**: 2026-02-06
**版本**: 1.0.0
**状态**: 实现完成，待编译测试