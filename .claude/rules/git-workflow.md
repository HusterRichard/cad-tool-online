# Git 工作流规则

## 分支命名
- `feature/xxx` - 新功能
- `fix/xxx` - Bug 修复
- `refactor/xxx` - 重构
- `wasm/xxx` - WASM 相关改动

## 提交信息
格式：`<type>(<scope>): <description>`

类型：
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 重构
- `test`: 测试
- `docs`: 文档
- `chore`: 构建/工具

示例：
```
feat(chili-geo): add MbsGroup embind binding
fix(chili-three): fix frame orientation calculation
```

## PR 规则
- 必须通过 CI（lint + test + build）
- WASM 相关改动必须检查文件体积变化
- 至少一人 Code Review
