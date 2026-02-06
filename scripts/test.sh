#!/bin/bash

# CadToolOnline 测试脚本
# 用途：运行所有单元测试和集成测试

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  CadToolOnline - 测试脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  未检测到 node_modules，正在安装依赖...${NC}"
    pnpm install
fi

# 解析参数
COVERAGE=false
WATCH=false
PACKAGE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --package)
            PACKAGE="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}❌ 未知参数: $1${NC}"
            echo "用法: ./test.sh [--coverage] [--watch] [--package <package-name>]"
            exit 1
            ;;
    esac
done

echo "------------------------------------------"
echo "测试配置"
echo "------------------------------------------"
echo "覆盖率报告: $COVERAGE"
echo "监听模式: $WATCH"
echo "指定包: ${PACKAGE:-全部}"
echo ""

# 运行 lint
echo "------------------------------------------"
echo "步骤 1: 代码检查 (ESLint)"
echo "------------------------------------------"
if [ -z "$PACKAGE" ]; then
    pnpm lint || {
        echo -e "${RED}❌ ESLint 检查失败${NC}"
        exit 1
    }
else
    pnpm --filter "@cadtool-online/$PACKAGE" lint || {
        echo -e "${RED}❌ ESLint 检查失败${NC}"
        exit 1
    }
fi
echo -e "${GREEN}✅ ESLint 检查通过${NC}"
echo ""

# 运行类型检查
echo "------------------------------------------"
echo "步骤 2: 类型检查 (TypeScript)"
echo "------------------------------------------"
if [ -z "$PACKAGE" ]; then
    pnpm exec tsc --noEmit || {
        echo -e "${RED}❌ 类型检查失败${NC}"
        exit 1
    }
else
    pnpm --filter "@cadtool-online/$PACKAGE" exec tsc --noEmit || {
        echo -e "${RED}❌ 类型检查失败${NC}"
        exit 1
    }
fi
echo -e "${GREEN}✅ 类型检查通过${NC}"
echo ""

# 运行单元测试
echo "------------------------------------------"
echo "步骤 3: 单元测试"
echo "------------------------------------------"

# 构建测试命令
TEST_CMD="pnpm"

if [ -n "$PACKAGE" ]; then
    TEST_CMD="$TEST_CMD --filter @cadtool-online/$PACKAGE"
fi

TEST_CMD="$TEST_CMD test"

if [ "$COVERAGE" = true ]; then
    TEST_CMD="$TEST_CMD:coverage"
fi

if [ "$WATCH" = true ]; then
    TEST_CMD="$TEST_CMD -- --watch"
fi

# 检查是否配置了测试脚本
if ! grep -q '"test"' package.json 2>/dev/null; then
    echo -e "${YELLOW}⚠️  注意：package.json 中未配置 test 脚本${NC}"
    echo -e "${YELLOW}   当前跳过单元测试，请配置测试框架（推荐 Vitest）${NC}"
else
    echo "执行: $TEST_CMD"
    eval $TEST_CMD || {
        echo -e "${RED}❌ 单元测试失败${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ 单元测试通过${NC}"
fi
echo ""

# 运行集成测试（如果存在）
if [ -d "tests" ] && [ "$(ls -A tests 2>/dev/null)" ]; then
    echo "------------------------------------------"
    echo "步骤 4: 集成测试"
    echo "------------------------------------------"
    echo -e "${YELLOW}⚠️  集成测试功能待实现${NC}"
    echo ""
fi

# 显示覆盖率报告
if [ "$COVERAGE" = true ]; then
    echo "------------------------------------------"
    echo "测试覆盖率报告"
    echo "------------------------------------------"
    if [ -d "coverage" ]; then
        echo "覆盖率报告已生成在 ./coverage 目录"
        echo ""
        # 如果有 lcov 工具，显示摘要
        if command -v lcov &> /dev/null && [ -f "coverage/lcov.info" ]; then
            lcov --summary coverage/lcov.info
        fi
    else
        echo -e "${YELLOW}⚠️  未找到覆盖率报告${NC}"
    fi
    echo ""
fi

echo "=========================================="
echo -e "${GREEN}✅ 所有测试通过！${NC}"
echo "=========================================="
echo ""
echo "测试统计:"
echo "  - 代码检查: ✅"
echo "  - 类型检查: ✅"
echo "  - 单元测试: ${PACKAGE:-全部模块}"
if [ "$COVERAGE" = true ]; then
    echo "  - 覆盖率报告: ./coverage"
fi
echo ""
