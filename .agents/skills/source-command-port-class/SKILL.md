---
name: "source-command-port-class"
description: "从 CADToolbox 移植 C++ 类到 WASM 模块，生成 Embind 绑定和 TypeScript 接口。"
---

# source-command-port-class

Use this skill when the user asks to run the migrated source command `port-class`.

## Command Template

# /port-class 命令

从 CADToolbox 移植 C++ 类到 WASM 模块。

## 用法
```
/port-class <类名>
```

## 示例
```
/port-class MbsGroup
/port-class MbsRevolute
```

## 执行流程
1. 在 `../CADToolbox` 中查找类定义
2. 分析依赖关系
3. 移除 Qt/Sysplorer 依赖
4. 生成精简版 C++ 代码
5. 生成 Embind 绑定
6. 生成 TypeScript 接口定义
7. 生成单元测试骨架

## 输出文件
- `packages/chili-geo/cpp/src/mbs/<class>.h`
- `packages/chili-geo/cpp/src/mbs/<class>.cpp`
- `packages/chili-geo/cpp/src/binding/<class>_binding.cpp`
- `packages/chili-geo/src/<class>.ts`
- `packages/chili-geo/src/__tests__/<class>.spec.ts`
