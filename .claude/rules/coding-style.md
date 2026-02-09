---
name: coding-style
description: 代码风格规则，涵盖 TypeScript/C++ 编码规范、命名约定及禁止规则。
---

# 代码风格规则

## TypeScript
- 使用 ESLint + Prettier，配置继承自根目录
- 优先使用 `interface` 而非 `type`（除非需要联合类型）
- 禁止 `any`，必须显式类型标注
- 使用 `readonly` 标记不可变属性

## C++ (WASM)
- 遵循 Google C++ Style Guide
- 使用 `std::unique_ptr` / `std::shared_ptr` 管理内存
- Embind 绑定的类必须有 `delete()` 方法
- 禁止裸指针跨 WASM 边界传递

## 命名约定
| 类型 | 风格 | 示例 |
|------|------|------|
| 类/接口 | PascalCase | `MbsGroup`, `JointType` |
| 函数/方法 | camelCase | `calculateMass()` |
| 常量 | UPPER_SNAKE | `OCCT_MIN_ACCURACY` |
| 文件 | kebab-case | `mbs-group.ts` |

## 禁止规则
- **禁止使用 `chili` 前缀**：文件名、目录名、包名均不允许使用 `chili-` 或 `chili` 前缀

## 注释
- 只在"为什么"不明显时写注释，不解释"是什么"
- 公共 API 必须有 JSDoc/Doxygen
- TODO 格式：`// TODO(username): description`
