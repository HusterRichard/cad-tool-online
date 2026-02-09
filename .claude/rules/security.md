---
name: security
description: 安全规则，涵盖 WASM 安全、敏感信息管理及依赖安全审计要求。
---

# 安全规则

## WASM 安全
- 禁止在 WASM 模块中处理用户认证信息
- 所有文件路径必须经过验证，防止路径遍历攻击
- STEP 文件解析必须有大小限制（默认 100MB）

## 敏感信息
- API 密钥只能存放在用户级配置 `~/.claude/settings.json`
- 禁止在代码中硬编码任何密钥或令牌
- `.claude/settings.json` 必须在 `.gitignore` 中

## 依赖安全
- 禁止引入未经审计的 npm 包
- OCCT WASM 只能从官方源或 chili3d 验证过的版本获取
- 定期运行 `pnpm audit` 检查漏洞
