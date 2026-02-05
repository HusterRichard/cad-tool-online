@echo off
REM Build script for cad-geo WASM module (Windows)
REM Prerequisites: Run setup_wasm_deps.mjs first

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set BUILD_DIR=%SCRIPT_DIR%build
set EMSDK_DIR=%BUILD_DIR%\emsdk

echo === Building cad-geo WASM module ===

REM Check if dependencies are set up
if not exist "%EMSDK_DIR%" (
    echo Error: Emscripten SDK not found. Please run setup first:
    echo   pnpm setup:wasm
    exit /b 1
)

if not exist "%BUILD_DIR%\occt" (
    echo Error: OCCT not found. Please run setup first:
    echo   pnpm setup:wasm
    exit /b 1
)

REM Activate Emscripten
echo Activating Emscripten...
call "%EMSDK_DIR%\emsdk_env.bat"

cd /d "%SCRIPT_DIR%"

REM Build type (default: release)
set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=release

echo Building %BUILD_TYPE% configuration...

REM Configure and build using CMake presets
cmake --preset %BUILD_TYPE%
if %errorlevel% neq 0 (
    echo CMake configuration failed
    exit /b 1
)

cmake --build --preset %BUILD_TYPE%
if %errorlevel% neq 0 (
    echo Build failed
    exit /b 1
)

echo === Build completed ===
echo Output files in: %SCRIPT_DIR%..\wasm\
dir "%SCRIPT_DIR%..\wasm\"

endlocal
