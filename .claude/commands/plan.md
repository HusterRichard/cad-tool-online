---
name: plan
description: 使用 Planner Agent 分析需求并生成带优先级的结构化任务计划。
---

# /plan 命令

使用 Planner Agent 分析需求并生成任务计划。

## 用法
```
/plan <需求描述>
```

## 示例
```
/plan 实现 MbsGroup 类的 Embind 绑定
```

## 执行流程
1. 读取 `../CADToolbox` 中的相关 C++ 代码
2. 分析需要暴露的接口
3. 生成分阶段的任务清单
4. 识别依赖和风险点

## 输出
结构化的任务清单，包含优先级和依赖关系。
