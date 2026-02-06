# AI 产物目录

本目录记录使用 AI 工具（Claude、ChatGPT 等）在项目开发过程中生成的设计文档和输出结果。

## 目录结构

```
ai-artifacts/
├── design/              # 设计文档（需求分析、架构设计等）
│   ├── requirements.md  # 需求分析文档
│   ├── api-design.md    # API 设计文档
│   └── data-model.md    # 数据模型设计
└── outputs/             # AI 输出结果示例
    ├── code-snippets/   # 代码片段
    ├── test-cases/      # 测试用例
    └── documentation/   # 文档片段
```

## 使用说明

### design/ - 设计文档

记录 AI 辅助生成的设计类文档，包括但不限于：

- **需求分析**: 功能需求、非功能需求、用户故事
- **架构设计**: 系统架构、模块设计、接口定义
- **数据模型**: 实体关系、类图、状态机
- **算法设计**: 伪代码、流程图、复杂度分析

### outputs/ - AI 输出结果

保存 AI 生成的各类产物示例，用于展示 AI 辅助开发的效果：

- **code-snippets/**: 关键代码片段（算法实现、配置文件等）
- **test-cases/**: 单元测试、集成测试用例
- **documentation/**: 注释、README、API 文档片段

## 贡献指南

### 添加设计文档

1. 在 `design/` 目录下创建 Markdown 文件
2. 文件名使用 kebab-case，如 `joint-system-design.md`
3. 文档开头标注生成信息：
   ```markdown
   # [文档标题]

   **生成工具**: Claude Sonnet 4.5
   **生成日期**: YYYY-MM-DD
   **Prompt**: [简述使用的 Prompt]
   ```

### 添加输出结果

1. 根据类型放入相应子目录
2. 添加元数据文件 `meta.json`：
   ```json
   {
     "tool": "Claude Sonnet 4.5",
     "date": "2026-02-06",
     "prompt": "生成 STEP 文件读取的单元测试",
     "files": ["step_reader.spec.ts"]
   }
   ```

## 注意事项

- **版权声明**: AI 生成的代码需遵循项目许可证
- **代码审查**: AI 生成的代码必须经过人工审查后才能合并到主代码库
- **安全检查**: 避免 AI 生成的代码包含硬编码的密钥、密码等敏感信息
- **测试验证**: AI 生成的测试用例需验证其正确性和覆盖率

## 更新日志

| 日期 | 更新内容 |
|------|----------|
| 待填写 | 初始化 AI 产物目录结构 |
