# 示例数据目录

本目录包含项目的示例数据，用于开发、测试和演示。

## 目录结构

```
data/
├── step-files/              # 示例 STEP 文件
│   ├── basic/              # 基础几何体
│   ├── assemblies/         # 装配体示例
│   └── complex/            # 复杂模型
├── modelica-examples/      # Modelica 导出示例
├── screenshots/            # 参考截图
└── test-cases/             # 测试用例数据
```

## STEP 文件示例

### 基础几何体 (basic/)

**用途**: 快速演示和基础功能测试

建议包含：
- `box.step` - 立方体
- `cylinder.step` - 圆柱体
- `sphere.step` - 球体
- `cone.step` - 圆锥体

### 装配体 (assemblies/)

**用途**: 多体建模演示

建议包含：
- `simple-hinge.step` - 简单铰链（2个零件）
- `slider-crank.step` - 滑块曲柄机构
- `four-bar.step` - 四连杆机构

### 复杂模型 (complex/)

**用途**: 性能测试和展示复杂场景

建议包含：
- `engine-assembly.step` - 发动机总成
- `robot-arm.step` - 机械臂

## Modelica 示例

`modelica-examples/` 目录包含导出的 Modelica 代码示例，展示不同运动副类型的用法。

示例文件：
- `revolute-joint-example.mo` - 转动副示例
- `prismatic-joint-example.mo` - 移动副示例
- `four-bar-mechanism.mo` - 完整的四连杆机构

## 数据来源

### 获取示例 STEP 文件

1. **自行创建**: 使用 FreeCAD、Fusion 360 等 CAD 软件导出
2. **开源资源**:
   - [GrabCAD](https://grabcad.com/) - 工程师社区
   - [Thingiverse](https://www.thingiverse.com/) - 3D 模型库
   - [OpenCascade Samples](https://dev.opencascade.org/resources/download/sample-files)

3. **参考项目**:
   - 使用 `../CADToolbox/src/python/test_use_case/` 中的测试模型

### 许可证说明

- 确保所有示例数据具有适当的许可证
- 开源模型请注明来源和许可协议
- 商业模型请勿添加到版本控制

## 使用说明

### 在代码中引用

```typescript
import { join } from 'path';

// 引用示例 STEP 文件
const boxStepPath = join(__dirname, '../data/step-files/basic/box.step');

// 在测试中使用
const testDataPath = join(__dirname, '../data/test-cases/');
```

### 在文档中引用

演示文档中可以引用这些示例：

```markdown
示例：导入一个简单的立方体

1. 打开 CadToolOnline
2. 导入文件：`data/step-files/basic/box.step`
3. 查看渲染结果
```

## 文件大小限制

- 基础几何体: <1MB
- 装配体: <10MB
- 复杂模型: <50MB
- 请勿添加超过 100MB 的文件

## 数据更新

当添加新的示例数据时，请：

1. 更新本 README 文件
2. 确保文件命名清晰（使用 kebab-case）
3. 添加简要说明（在相应目录的 README 中）
4. 检查文件是否可以正确导入

## Git 忽略规则

大型文件（>10MB）应考虑使用 Git LFS 或添加到 `.gitignore`：

```gitignore
# 大型示例文件
data/step-files/complex/*.step
```

## 相关链接

- [STEP 文件格式规范](https://en.wikipedia.org/wiki/ISO_10303)
- [OpenCASCADE 支持的格式](https://dev.opencascade.org/doc/overview/html/occt_user_guides__step.html)
- [FreeCAD 教程](https://wiki.freecad.org/Tutorials)

---

**注意**: 本目录的数据仅供开发和测试使用，请勿用于生产环境。
