# 测试数据目录

本目录包含测试用的 STEP 文件。

## 文件清单

### simple-box.step
- **描述**: 简单的立方体 (1m x 1m x 1m)
- **用途**: 基础功能测试
- **大小**: ~5KB
- **来源**: [待添加]

### cylinder.step
- **描述**: 圆柱体 (半径 0.5m, 高度 1m)
- **用途**: 旋转副测试
- **大小**: ~8KB
- **来源**: [待添加]

### assembly.step
- **描述**: 简单装配体 (2个零件)
- **用途**: 多体建模测试
- **大小**: ~15KB
- **来源**: [待添加]

### large-model.step
- **描述**: 复杂模型 (用于性能测试)
- **用途**: 性能和内存测试
- **大小**: ~50MB
- **来源**: [待添加]

### invalid.step
- **描述**: 损坏的 STEP 文件
- **用途**: 错误处理测试
- **大小**: ~1KB
- **来源**: 手动创建

## 使用说明

在测试代码中引用这些文件：

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const stepFilePath = join(__dirname, '../../fixtures/step-files/simple-box.step');
const stepData = readFileSync(stepFilePath);
```

## 注意事项

- 请勿提交过大的 STEP 文件（>100MB）
- 确保所有测试文件都是合法的 CAD 文件
- 敏感或受版权保护的文件请勿添加
