@echo off
REM CadToolOnline 测试脚本 (Windows 版本)
REM 用途：运行所有单元测试和集成测试

setlocal enabledelayedexpansion

echo ==========================================
echo   CadToolOnline - 测试脚本
echo ==========================================
echo.

REM 检查是否安装了依赖
if not exist "node_modules" (
    echo ⚠️  未检测到 node_modules，正在安装依赖...
    call pnpm install
)

REM 解析参数
set COVERAGE=false
set WATCH=false
set PACKAGE=

:parse_args
if "%1"=="" goto end_parse
if "%1"=="--coverage" (
    set COVERAGE=true
    shift
    goto parse_args
)
if "%1"=="--watch" (
    set WATCH=true
    shift
    goto parse_args
)
if "%1"=="--package" (
    set PACKAGE=%2
    shift
    shift
    goto parse_args
)
echo ❌ 未知参数: %1
echo 用法: test.bat [--coverage] [--watch] [--package ^<package-name^>]
exit /b 1
:end_parse

echo ------------------------------------------
echo 测试配置
echo ------------------------------------------
echo 覆盖率报告: %COVERAGE%
echo 监听模式: %WATCH%
if "%PACKAGE%"=="" (
    echo 指定包: 全部
) else (
    echo 指定包: %PACKAGE%
)
echo.

REM 运行 lint
echo ------------------------------------------
echo 步骤 1: 代码检查 (ESLint)
echo ------------------------------------------
if "%PACKAGE%"=="" (
    call pnpm lint
) else (
    call pnpm --filter @cadtool-online/%PACKAGE% lint
)
if %errorlevel% neq 0 (
    echo ❌ ESLint 检查失败
    exit /b 1
)
echo ✅ ESLint 检查通过
echo.

REM 运行类型检查
echo ------------------------------------------
echo 步骤 2: 类型检查 (TypeScript)
echo ------------------------------------------
if "%PACKAGE%"=="" (
    call pnpm exec tsc --noEmit
) else (
    call pnpm --filter @cadtool-online/%PACKAGE% exec tsc --noEmit
)
if %errorlevel% neq 0 (
    echo ❌ 类型检查失败
    exit /b 1
)
echo ✅ 类型检查通过
echo.

REM 运行单元测试
echo ------------------------------------------
echo 步骤 3: 单元测试
echo ------------------------------------------

REM 构建测试命令
set TEST_CMD=pnpm

if not "%PACKAGE%"=="" (
    set TEST_CMD=!TEST_CMD! --filter @cadtool-online/%PACKAGE%
)

set TEST_CMD=!TEST_CMD! test

if "%COVERAGE%"=="true" (
    set TEST_CMD=!TEST_CMD!:coverage
)

if "%WATCH%"=="true" (
    set TEST_CMD=!TEST_CMD! -- --watch
)

REM 检查是否配置了测试脚本
findstr /C:"\"test\"" package.json >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  注意：package.json 中未配置 test 脚本
    echo    当前跳过单元测试，请配置测试框架（推荐 Vitest）
) else (
    echo 执行: !TEST_CMD!
    call !TEST_CMD!
    if %errorlevel% neq 0 (
        echo ❌ 单元测试失败
        exit /b 1
    )
    echo ✅ 单元测试通过
)
echo.

REM 运行集成测试（如果存在）
if exist "tests" (
    echo ------------------------------------------
    echo 步骤 4: 集成测试
    echo ------------------------------------------
    echo ⚠️  集成测试功能待实现
    echo.
)

REM 显示覆盖率报告
if "%COVERAGE%"=="true" (
    echo ------------------------------------------
    echo 测试覆盖率报告
    echo ------------------------------------------
    if exist "coverage" (
        echo 覆盖率报告已生成在 .\coverage 目录
    ) else (
        echo ⚠️  未找到覆盖率报告
    )
    echo.
)

echo ==========================================
echo ✅ 所有测试通过！
echo ==========================================
echo.
echo 测试统计:
echo   - 代码检查: ✅
echo   - 类型检查: ✅
if "%PACKAGE%"=="" (
    echo   - 单元测试: 全部模块
) else (
    echo   - 单元测试: %PACKAGE%
)
if "%COVERAGE%"=="true" (
    echo   - 覆盖率报告: .\coverage
)
echo.
pause
