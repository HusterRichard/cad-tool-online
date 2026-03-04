# 测试数据目录

此目录用于存放颜色功能测试所需的 STEP 文件。

## 目录结构

```
test-data/
├── README.md           # 本文件
├── colored-part.step   # 单个带颜色的零件（待添加）
├── colored-assembly.step # 带颜色的装配体（待添加）
└── no-color.step       # 无颜色信息的 STEP 文件（待添加）
```

## 如何准备测试文件

### 方法 1: 从 CADToolbox 复制

如果你有访问权限，可以从原桌面版项目复制测试数据：

```bash
# 从 CADToolbox 项目复制测试文件
cp ../CADToolbox/src/python/test_use_case/*.step ./test-data/
```

## 方法 2: 使用 CAD 软件创建

### 使用 SolidWorks
1. 创建一个简单的零件（如长方体）
2. 应用颜色：右键 → 外观 → 选择颜色
3. 导出为 STEP：文件 → 另存为 → STEP (*.step)
4. 在选项中勾选 "Export colors"
5. 保存为 `colored-part.step`

#### 使用 Fusion 360
1. 创建简单零件并应用外观
2. 文件 → 导出 → STEP
3. 格式选择 "STEP 242"
4. 保存

#### 使用 FreeCAD
1. 创建零件并在视图中设置颜色
2. File → Export → STEP with colors (AP214)
3. 保存

### 方法 3: 使用示例文件

你可以从以下来源获取带颜色的 STEP 文件：
- [GrabCAD](https://grabcad.com/) - 社区 CAD 模型
- [McMaster-Carr](https://www.mcmaster.com/) - 工业零件 CAD 模型
- [TraceParts](https://www.traceparts.com/) - 免费 CAD 零件库

## 测试文件要求

### colored-part.step
- **用途**: 测试单个零件的颜色提取
- **要求**:
  - 单个实体零件
  - 必须包含颜色信息
  - 格式：STEP AP214 或 AP242
  - 推荐颜色：橙红色 (#FF5733)

### colored-assembly.step
- **用途**: 测试装配体层级结构中的颜色
- **要求**:
  - 至少包含 3 个不同颜色的零件
  - 有装配体层级关系
  - 每个零件有不同颜色
  - 格式：STEP AP214 或 AP242

### no-color.step
- **用途**: 测试无颜色信息时的默认处理
- **要求**:
  - 普通 STEP 文件（AP203 或更早版本）
  - 不包含颜色元数据
  - 可以是任何简单几何体

## 验证 STEP 文件包含颜色

使用文本编辑器打开 STEP 文件，搜索以下关键字：

```step
COLOUR_RGB
STYLED_ITEM
PRESENTATION_STYLE_ASSIGNMENT
```

如果找到这些行，说明文件包含颜色信息。例如：

```step
#123 = COLOUR_RGB('',0.8,0.2,0.1);
#124 = SURFACE_STYLE_FILL_AREA(#125);
#126 = STYLED_ITEM('',(#123),#127);
```

## 使用测试数据

在测试文件中加载：

```typescript
import { readFile } from 'fs/promises';
import { resolve } from 'path';

async function loadTestStepFile(filename: string): Promise<ArrayBuffer> {
    const filePath = resolve(__dirname, 'test-data', filename);
    const buffer = await readFile(filePath);
    return buffer.buffer as ArrayBuffer;
}

// 使用示例
const stepData = await loadTestStepFile('colored-part.step');
const result = await occt.readStep(stepData, 'test');
```

## 注意事项

1. **文件大小**: 保持测试文件小于 5MB，以加快测试速度
2. **Git 忽略**: 大型 STEP 文件应添加到 `.gitignore`
3. **版权**: 确保测试文件可以合法使用和分发
4. **文档**: 记录每个测试文件的来源和用途

## 当前状态

- [ ] colored-part.step - 待添加
- [ ] colored-assembly.step - 待添加
- [ ] no-color.step - 待添加

一旦添加测试文件，可以启用相关的集成测试用例。