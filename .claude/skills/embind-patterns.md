# Embind 绑定技能

## 绑定模式

### 基础类绑定
```cpp
#include <emscripten/bind.h>

EMSCRIPTEN_BINDINGS(module_name) {
    class_<ClassName>("ClassName")
        .constructor<>()
        .function("methodName", &ClassName::methodName)
        .property("propName", &ClassName::getProp, &ClassName::setProp);
}
```

### 枚举绑定
```cpp
enum_<EnumType>("EnumType")
    .value("Value1", EnumType::Value1)
    .value("Value2", EnumType::Value2);
```

### 值类型绑定（用于小型结构）
```cpp
value_array<std::array<double, 3>>("Vec3")
    .element(emscripten::index<0>())
    .element(emscripten::index<1>())
    .element(emscripten::index<2>());
```

## 内存管理
- JS 端必须调用 `.delete()` 释放 C++ 对象
- 使用 `allow_raw_pointers()` 时要特别小心
- 优先返回值类型而非指针

## TypeScript 接口生成
每个绑定类需要对应的 TS 接口：
```typescript
export interface ClassName {
    methodName(): ReturnType;
    delete(): void;  // 必须有
}
```
