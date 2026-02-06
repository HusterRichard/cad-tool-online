@echo off
REM CadToolOnline 一键运行脚本 (Windows 版本)
REM 用途：自动化构建和启动 VSCode 插件

echo ==========================================
echo   CadToolOnline - 一键运行脚本
echo ==========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到 Node.js，请先安装 Node.js ^>= 20.0.0
    exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% lss 20 (
    echo ❌ 错误：Node.js 版本过低，需要 ^>= 20.0.0
    exit /b 1
)
echo ✅ Node.js 版本检查通过

REM 检查 pnpm
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  未检测到 pnpm，正在安装...
    npm install -g pnpm
)
echo ✅ pnpm 已安装

REM 检查 VSCode
where code >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  警告：未检测到 VSCode CLI，请确保已安装 VSCode
)

echo.
echo ------------------------------------------
echo 步骤 1/4: 安装依赖
echo ------------------------------------------
call pnpm install

echo.
echo ------------------------------------------
echo 步骤 2/4: 检查 WASM 模块
echo ------------------------------------------
if not exist "packages\geo\wasm\cad-geo.wasm" (
    echo ⚠️  WASM 模块不存在，尝试设置 WASM 依赖...
    if exist "scripts\setup_wasm_deps.mjs" (
        call pnpm setup:wasm
    )
) else (
    echo ✅ WASM 模块已存在
)

echo.
echo ------------------------------------------
echo 步骤 3/4: 构建项目
echo ------------------------------------------
if exist "packages\geo\wasm\cad-geo.wasm" (
    echo 执行 TypeScript 构建...
    call pnpm build
) else (
    echo 执行全量构建（包括 WASM）...
    call pnpm build:all
    if %errorlevel% neq 0 (
        echo ⚠️  WASM 构建失败，仅构建 TypeScript 部分
        call pnpm build
    )
)

echo.
echo ------------------------------------------
echo 步骤 4/4: 启动 VSCode 调试
echo ------------------------------------------
echo.
echo ✅ 构建完成！
echo.
echo 请选择启动方式：
echo.
echo   方式 1（推荐）：在 VSCode 中打开本项目，按 F5 启动调试
echo   方式 2：运行 'code .' 打开项目，然后按 F5
echo.
echo 启动后，在新窗口中按 Ctrl+Shift+P，输入：
echo   CadToolOnline: Open CAD Editor
echo.
echo ==========================================
echo   运行准备完成！
echo ==========================================
pause
