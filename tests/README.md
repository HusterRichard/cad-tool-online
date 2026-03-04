# 测试目录

本目录包含 CadToolOnline 项目的测试代码。

## 目录结构

```
tests/
├── unit/                    # 单元测试
│   ├── core/               # Core 模块测试
│   ├── geo/                # Geo 模块测试
│   ├── three/              # Three 模块测试
│   └── utils/              # 工具函数测试
├── integration/            # 集成测试
│   ├── step-import/        # STEP 导入测试
│   ├── joint-creation/     # 运动副创建测试
│   └── modelica-export/    # Modelica 导出测试
├── e2e/                    # 端到端测试
│   └── vscode-extension/   # VSCode 插件 E2E 测试
├── fixtures/               # 测试数据
│   ├── step-files/         # 测试用 STEP 文件
│   └── expected-outputs/   # 期望输出结果
└── helpers/                # 测试辅助工具
    └── test-utils.ts
```

## 测试框架

- **单元测试**: Vitest (推荐) 或 Jest
- **E2E 测试**: VSCode Extension Test Runner
- **断言库**: Vitest/Jest 内置
- **覆盖率**: c8 或 Istanbul

## 运行测试

### 运行所有测试

```bash
# 使用测试脚本
./scripts/test.sh

# 或直接使用 pnpm
pnpm test
```

## 运行特定模块测试

```bash
# 测试 core 模块
pnpm --filter @cadtool-online/core test

# 测试 geo 模块
pnpm --filter @cadtool-online/geo test
```

## 生成覆盖率报告

```bash
./scripts/test.sh --coverage

# 查看覆盖率报告
open coverage/index.html  # macOS
start coverage/index.html  # Windows
```

## 监听模式

```bash
./scripts/test.sh --watch
```

## 测试规范

### 文件命名

- 单元测试: `*.spec.ts`
- 集成测试: `*.test.ts`
- E2E 测试: `*.e2e.ts`

### 测试结构

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('模块名/功能名', () => {
  beforeEach(() => {
    // 测试前准备
  });

  afterEach(() => {
    // 测试后清理
  });

  describe('子功能', () => {
    it('应该满足某个条件', () => {
      // Arrange (准备)
      const input = createTestInput();

      // Act (执行)
      const result = functionUnderTest(input);

      // Assert (断言)
      expect(result).toBe(expectedOutput);
    });

    it('应该处理错误情况', () => {
      expect(() => {
        functionUnderTest(invalidInput);
      }).toThrow(ExpectedError);
    });
  });
});
```

## 必须测试的功能

### Core 模块

- [x] MbsGroup 创建和属性设置
- [ ] MbsFrame 坐标转换
- [ ] MbsJoint 约束验证
- [ ] MbsDocument 序列化/反序列化

### Geo 模块 (WASM 绑定)

- [x] STEP 文件读取
  - [ ] 正常文件
  - [ ] 空文件
  - [ ] 损坏文件
  - [ ] 超大文件 (>50MB)
- [ ] 网格生成
- [ ] 质量属性计算（与桌面版对比）

### Three 模块

- [ ] 场景初始化
- [ ] 网格渲染
- [ ] Fit View 计算
- [ ] 对象选择

### VSCode 插件

- [ ] 命令注册
- [ ] WebView 消息通信
- [ ] 文件系统访问

## 集成测试场景

### 场景 1: STEP 导入端到端

```
1. 加载 STEP 文件
2. 解析几何数据
3. 生成网格
4. 渲染到 Three.js
5. 验证渲染结果
```

### 场景 2: 运动副创建流程

```
1. 创建两个刚体组
2. 在刚体上创建坐标系
3. 创建运动副
4. 验证约束合法性
5. 导出 Modelica 代码
6. 验证导出结果
```

## 测试数据

### STEP 文件

测试用 STEP 文件存放在 `fixtures/step-files/`:

- `simple-box.step` - 简单立方体 (用于基础测试)
- `cylinder.step` - 圆柱体 (用于旋转副测试)
- `assembly.step` - 装配体 (用于多体测试)
- `large-model.step` - 大型模型 (用于性能测试)
- `invalid.step` - 损坏文件 (用于错误处理测试)

### 期望输出

期望的测试输出存放在 `fixtures/expected-outputs/`:

- Modelica 代码
- 质量属性 JSON
- 渲染快照

## 覆盖率要求

| 模块 | 目标覆盖率 |
|------|------------|
| Core | >80% |
| Geo | >80% |
| Three | >60% |
| UI | >60% |

## Mock 策略

### WASM 模块 Mock

对于 WASM 模块，使用预定义的 Mock 数据：

```typescript
// tests/helpers/geo-mock.ts
export const mockStepReader = {
  readStepFile: vi.fn().mockResolvedValue([
    { id: '1', name: 'Shape1', mesh: mockMeshData }
  ])
};
```

### VSCode API Mock

```typescript
// tests/helpers/vscode-mock.ts
export const vscode = {
  window: {
    showOpenDialog: vi.fn(),
    showInformationMessage: vi.fn()
  },
  workspace: {
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn()
    }
  }
};
```

## CI/CD 集成

测试会在以下情况自动运行：

- 提交代码时 (pre-commit hook)
- 创建 Pull Request 时
- 合并到主分支前

## 故障排查

### 问题 1: WASM 测试失败

**原因**: WASM 模块未加载
**解决**: 确保在测试前初始化 WASM 模块

### 问题 2: Three.js 测试失败

**原因**: 缺少 WebGL 上下文
**解决**: 使用 headless-gl 或 Mock Three.js

### 问题 3: VSCode API 未定义

**原因**: 测试环境缺少 VSCode 运行时
**解决**: 使用 @vscode/test-electron 或 Mock VSCode API

## 参考资料

- [Vitest 文档](https://vitest.dev/)
- [VSCode Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)