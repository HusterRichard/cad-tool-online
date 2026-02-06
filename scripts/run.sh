#!/bin/bash

# CadToolOnline 一键运行脚本
# 用途：自动化构建和启动 VSCode 插件

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  CadToolOnline - 一键运行脚本"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未检测到 Node.js，请先安装 Node.js >= 20.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ 错误：Node.js 版本过低（当前：$(node -v)），需要 >= 20.0.0"
    exit 1
fi
echo "✅ Node.js 版本检查通过：$(node -v)"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  未检测到 pnpm，正在安装..."
    npm install -g pnpm
fi
echo "✅ pnpm 版本：$(pnpm -v)"

# 检查 VSCode
if ! command -v code &> /dev/null; then
    echo "⚠️  警告：未检测到 VSCode CLI，请确保已安装 VSCode"
fi

echo ""
echo "------------------------------------------"
echo "步骤 1/4: 安装依赖"
echo "------------------------------------------"
pnpm install

echo ""
echo "------------------------------------------"
echo "步骤 2/4: 检查 WASM 模块"
echo "------------------------------------------"
if [ ! -f "packages/geo/wasm/cad-geo.wasm" ]; then
    echo "⚠️  WASM 模块不存在，尝试设置 WASM 依赖..."
    if [ -f "scripts/setup_wasm_deps.mjs" ]; then
        pnpm setup:wasm || echo "⚠️  WASM 依赖设置失败，首次运行可能需要手动编译"
    fi
else
    echo "✅ WASM 模块已存在"
fi

echo ""
echo "------------------------------------------"
echo "步骤 3/4: 构建项目"
echo "------------------------------------------"
# 如果 WASM 模块存在，仅构建 TypeScript；否则全量构建
if [ -f "packages/geo/wasm/cad-geo.wasm" ]; then
    echo "执行 TypeScript 构建..."
    pnpm build
else
    echo "执行全量构建（包括 WASM）..."
    pnpm build:all || {
        echo "⚠️  WASM 构建失败，仅构建 TypeScript 部分"
        pnpm build
    }
fi

echo ""
echo "------------------------------------------"
echo "步骤 4/4: 启动 VSCode 调试"
echo "------------------------------------------"
echo ""
echo "✅ 构建完成！"
echo ""
echo "请选择启动方式："
echo ""
echo "  方式 1（推荐）：在 VSCode 中打开本项目，按 F5 启动调试"
echo "  方式 2：运行 'code .' 打开项目，然后按 F5"
echo ""
echo "启动后，在新窗口中按 Ctrl+Shift+P，输入："
echo "  CadToolOnline: Open CAD Editor"
echo ""
echo "=========================================="
echo "  运行准备完成！"
echo "=========================================="
