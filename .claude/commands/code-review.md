# /review 命令

使用 Code Reviewer Agent 审查代码变更。

## 用法
```
/review [文件路径]
/review --staged    # 审查暂存的变更
/review --pr <id>   # 审查 PR
```

## 示例
```
/review packages/chili-geo/src/mbs-group.ts
/review --staged
```

## 审查维度
- 安全性（参考 rules/security.md）
- 代码风格（参考 rules/coding-style.md）
- 测试覆盖（参考 rules/testing.md）
- WASM 边界调用效率

## 输出
审查报告，包含问题列表和修改建议。
