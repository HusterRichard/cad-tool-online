---
name: testing
description: 测试规则，定义必测项、测试命名规范、测试数据来源及覆盖率要求。
---

# 测试规则

## 必须测试
- 所有 Embind 绑定的 C++ 类必须有对应的 TypeScript 单元测试
- 关节类型（7种）每种至少一个集成测试
- STEP 文件导入必须测试：正常文件、空文件、损坏文件、超大文件

## 测试命名
- 单元测试：`*.spec.ts`
- 集成测试：`*.test.ts`
- E2E 测试：`*.e2e.ts`

## 测试数据
- 使用 `../CADToolbox/src/python/test_use_case/` 中的模型作为测试数据
- 禁止在测试中使用真实用户数据

## 覆盖率要求
- 核心模块（chili-core, chili-geo）：>80%
- UI 模块：>60%
