# Git 工作流规范

## Commit 消息格式

提交标题必须使用 Conventional Commits 风格，并统一使用英文冒号 `:`

```text
<type>: <task id> <简要描述>

<变更说明>
- <变更点 1>
- <变更点 2>

<Footer>
Co-authored-by: <Name>
```

说明：
- `task id` 必填，例如 `T013`
- 如果当前提交没有正式任务号，统一使用 `T000`
- 标题要直接说明“做了什么”，不要使用“优化一些内容”“若干修改”这类空泛描述
- 正文建议用要点列出关键改动与影响
- 共同作者建议使用标准 trailer：`Co-authored-by: Name`

### 类型说明

| 类型 | 说明 |
| --- | --- |
| feat | 新功能 |
| fix | Bug 修复 |
| refactor | 重构，不改变功能 |
| docs | 文档更新 |
| test | 测试相关 |
| chore | 构建、工具、流程类变更 |
| perf | 性能优化 |
| ci | CI/CD 配置 |

### 示例

```text
feat: T002 新增节点边 CRUD 能力

- 支持节点和边的创建、查询、更新、删除
- 新增类型索引与版本字段查询
```

```text
chore: T000 统一 Windows 开发工具链

- 删除遗留 shell 脚本入口
- 修复进度文档乱码
- 补充自动推送参数说明

Co-authored-by: XXX
```

## Pull Request 工作流

1. 分析完整 commit 历史，而不只是最后一个 commit
2. 使用 `git diff [base-branch]...HEAD` 查看全部变更
3. 编写 PR 摘要，至少包含：
   - 变更概述
   - 测试计划
4. 新分支首次推送时使用 `-u`

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
