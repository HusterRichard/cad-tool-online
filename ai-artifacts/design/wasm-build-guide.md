# WASM 编译指南 - 智能颜色功能

**日期**: 2026-02-06
**目标**: 编译包含智能随机颜色生成器的 WASM 模块

---

## 修改内容总结

### 1. 新增代码

**文件**: `packages/geo/cpp/src/geo/geo_binding.cpp`

#### 新增头文件
```cpp
// For random color generation
#include <cmath>
#include <algorithm>
```

#### 新增类 SmartColorGenerator
- 位置: 第 58-133 行（大约）
- 功能: 使用黄金角分割生成视觉协调的随机颜色
- 方法:
  - `getNextColor()`: 获取下一个颜色
  - `reset()`: 重置颜色索引

#### 全局实例
```cpp
static SmartColorGenerator g_colorGenerator;
```

### 2. 修改的函数

#### buildHierarchyJson()
- 修改位置: 颜色分配逻辑（约第 313-340 行）
- 修改内容:
  - 优先使用 STEP 文件原始颜色
  - 无颜色时使用智能随机颜色（实体零件）
  - 装配体使用中性灰色

#### readStepFromBuffer()
- 修改位置: 函数开头（约第 485 行）
- 修改内容: 添加 `g_colorGenerator.reset();`

---

## 编译步骤

### 方法 1: 使用项目构建脚本（推荐）

```bash
# 1. 进入 geo 包目录
cd packages/geo

# 2. 运行构建脚本
npm run build:wasm
# 或
pnpm build:wasm
```

## 方法 2: 手动编译

```bash
# 1. 进入 C++ 源码目录
cd packages/geo/cpp

# 2. 激活 Emscripten 环境
source ./build/emsdk/emsdk_env.sh

# 3. 创建构建目录
mkdir -p build/target/release
cd build/target/release

# 4. 运行 CMake 配置
emcmake cmake ../../..

# 5. 编译
emmake make -j$(nproc)

# 6. 复制产物到 wasm 目录
cp cad-geo.js ../../../wasm/
cp cad-geo.wasm ../../../wasm/
cp cad-geo.d.ts ../../../wasm/ 2>/dev/null || true
```

## 方法 3: 检查现有构建脚本

```bash
# 查看 package.json 中的构建命令
cd packages/geo
cat package.json | grep -A 5 "scripts"
```

---

## 验证编译结果

### 1. 检查 WASM 文件

```bash
cd packages/geo/wasm

# 检查文件是否存在
ls -lh cad-geo.wasm cad-geo.js

# 检查文件大小（应该与之前相近，增加不超过 5KB）
du -h cad-geo.wasm

# 检查是否包含新函数（可选）
strings cad-geo.wasm | grep -i "color"
```

## 2. 测试构建的完整性

```bash
# 回到根目录
cd ../..

# 运行完整构建
pnpm -r build

# 应该看到：
# ✓ packages/geo build: Done
```

---

## 编译选项说明

在 `packages/geo/cpp/CMakeLists.txt` 中，关键编译选项：

```cmake
set_target_properties(cad-geo PROPERTIES
    LINK_FLAGS "
        -s WASM=1                        # 生成 WASM
        -s MODULARIZE=1                  # 模块化
        -s EXPORT_NAME='ChiliGeo'        # 导出名称
        -s ALLOW_MEMORY_GROWTH=1         # 允许内存增长
        -s MAXIMUM_MEMORY=2GB            # 最大内存
        --bind                           # 启用 Embind
        -O3                              # 优化级别 3
        -flto                            # 链接时优化
    "
)
```

**新增代码对编译的影响**:
- ✅ 不需要修改 CMakeLists.txt
- ✅ 不需要链接额外的库
- ✅ 编译参数保持不变

---

## 可能遇到的问题

### 问题 1: Emscripten 未安装

**症状**:
```
bash: emcmake: command not found
```

**解决方案**:
```bash
# 安装 Emscripten
cd packages/geo/cpp/build/emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

## 问题 2: OCCT 库未找到

**症状**:
```
Could not find OCCT libraries
```

**解决方案**:
```bash
# 检查 OCCT 是否已编译
ls packages/geo/cpp/build/occt/

# 如果没有，需要先编译 OCCT
cd packages/geo/cpp
./build_occt_wasm.sh  # 如果有这个脚本
```

## 问题 3: 编译错误

**症状**:
```
error: 'std::fmod' is not a member of 'std'
```

**解决方案**:
确保包含了正确的头文件：
```cpp
#include <cmath>      // std::fmod
#include <algorithm>  // std::max, std::min
```

### 问题 4: 内存不足

**症状**:
```
c++: fatal error: Killed signal terminated program cc1plus
```

**解决方案**:
```bash
# 减少并行编译数
emmake make -j2  # 使用 2 个线程而不是全部

# 或者单线程编译
emmake make
```

---

## 编译后验证

### 1. 快速功能测试

创建测试文件 `test-color.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Color Generator Test</title>
</head>
<body>
    <script src="packages/geo/wasm/cad-geo.js"></script>
    <script>
        ChiliGeo().then(module => {
            console.log('WASM loaded successfully');

            // 测试颜色生成（需要实际的 STEP 文件）
            // const result = module.readStepFromBuffer(stepData, 'test');
            // console.log('Colors:', JSON.parse(result).rootNodes);
        });
    </script>
</body>
</html>
```

### 2. 在 VSCode 插件中测试

```bash
# 启动开发模式
cd packages/vscode
pnpm dev

# 在 VSCode 中：
# 1. 按 F5 启动调试
# 2. 导入一个无颜色的 STEP 文件
# 3. 检查零件是否显示不同颜色
```

---

## 编译优化建议

### 开发构建（快速编译）

```cmake
# 修改 CMakeLists.txt 用于开发
-O3        →  -O0       # 关闭优化
-flto      →  删除       # 不使用 LTO
```

开发时编译速度：~30 秒

## 生产构建（当前配置）

```cmake
-O3        # 完全优化
-flto      # 链接时优化
```

生产版编译速度：~2-5 分钟
但 WASM 文件更小，运行更快

---

## 自动化脚本

创建 `packages/geo/rebuild-wasm.sh`:

```bash
#!/bin/bash
set -e

echo "🔨 Rebuilding WASM module with smart color generator..."

# 进入 C++ 目录
cd "$(dirname "$0")/cpp"

# 激活 Emscripten
source ./build/emsdk/emsdk_env.sh

# 清理旧构建
echo "🧹 Cleaning old build..."
rm -rf build/target/release/*

# 重新构建
echo "🔧 Configuring..."
cd build/target/release
emcmake cmake ../../..

echo "⚙️  Compiling..."
emmake make -j$(nproc)

# 复制产物
echo "📦 Copying artifacts..."
cp cad-geo.js ../../../wasm/
cp cad-geo.wasm ../../../wasm/

echo "✅ WASM module rebuilt successfully!"
echo "📍 Files: packages/geo/wasm/cad-geo.{js,wasm}"
```

使用：
```bash
cd packages/geo
chmod +x rebuild-wasm.sh
./rebuild-wasm.sh
```

---

## 检查清单

编译完成后，检查以下项目：

- [ ] `cad-geo.wasm` 文件存在且大小合理（约 5-15 MB）
- [ ] `cad-geo.js` 文件存在
- [ ] `pnpm -r build` 无错误
- [ ] VSCode 插件可以启动
- [ ] 导入 STEP 文件正常工作
- [ ] 零件显示不同颜色（无原始颜色时）

---

## 下一步

编译完成后：

1. **测试**: 导入测试 STEP 文件，查看颜色效果
2. **调整**: 如需调整颜色饱和度/明度，修改 C++ 代码中的参数
3. **反馈**: 收集用户反馈，优化颜色方案

---

## 相关文档

- [智能颜色生成器说明](./smart-color-generator.md)
- [颜色功能验证](./color-feature-validation.md)
- [API 设计文档](./api-design.md)

---

**文档版本**: 1.0
**最后更新**: 2026-02-06
**状态**: ✅ 准备编译