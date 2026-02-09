---
name: build-fix
description: 使用 Build Error Resolver Agent 诊断并修复构建错误。
---

# /build-fix 命令

使用 Build Error Resolver Agent 诊断并修复构建错误。

## 用法
```
/build-fix           # 自动检测最近的构建错误
/build-fix <错误信息>  # 分析指定错误
```

## 示例
```
/build-fix
/build-fix "error: undefined symbol: _ZN3mbs8MbsGroupC1Ev"
```

## 执行流程
1. 解析错误信息
2. 定位错误来源（WASM/TS/Vite）
3. 分析根因
4. 生成修复步骤
5. 提供验证命令

## 常见场景
- Emscripten 编译失败
- TypeScript 类型错误
- WASM 模块加载失败
- 链接错误
