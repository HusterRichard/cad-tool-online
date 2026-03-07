# Git 工作流规范

## Commit 消息格式

推荐使用 Conventional Commits 风格，使用中文来写描述，统一使用英文冒号 `:`

```text
<type>: <task id><简要描述>

<简要变更说明>
- <变更点 1>
- <变更点 2>

<Footer>
Co-authored-by: <Name>
```

说明：

- `task id` 可选，例如 `T013 `（注意后面有空格）
- 标题建议一句话说清“做了什么”，避免“一些优化”“若干修改”这类空描述
- 正文建议用要点列出关键改动与影响
- 共同作者建议使用标准 trailer：`Co-authored-by: Name`

### 类型说明

| 类型     | 说明               |
| -------- | ------------------ |
| feat     | 新功能             |
| fix      | Bug 修复           |
| refactor | 重构（不改变功能） |
| docs     | 文档更新           |
| test     | 测试相关           |
| chore    | 构建/工具变更      |
| perf     | 性能优化           |
| ci       | CI/CD 配置         |

### 示例

```text
feat: T002 新增节点边 CRUD 能力

- 支持节点/边创建、查询、更新、删除
- 新增类型索引与版本字段查询
```

```text
chore: 优化 Windows 开发工具链

- 删除 `.sh` 脚本，统一为 Windows 开发入口
- 修复 `claude-progress.txt` 中文乱码问题
- 为 `update-progress` 增加 `-AutoPush` 参数支持自动推送
- 更新相关 Markdown 文档示例

Co-authored-by: XXX
```

## Pull Request 工作流

1. 分析完整的 commit 历史（不仅是最新 commit）
2. 使用 `git diff [base-branch]...HEAD` 查看所有变更
3. 编写 PR 摘要，包含：
   - 变更概述
   - 测试计划
4. 新分支推送时使用 `-u` 标志

## 分支管理

- `main`：主分支，稳定版本
- `develop`：开发分支
- `feature/*`：功能分支
- `fix/*`：修复分支

## 提交前检查

- [ ] 代码已编译通过
- [ ] 无调试代码残留
- [ ] Commit 消息符合规范
- [ ] 修改逻辑后检查是否需要同步更新 `docs/` 下的设计文档
