@echo off
REM Build script for chili-geo WASM module (Windows)
REM Prerequisites: Emscripten SDK installed and activated

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set BUILD_DIR=%SCRIPT_DIR%build
set OUTPUT_DIR=%SCRIPT_DIR%..\wasm

echo === Building chili-geo WASM module ===

REM Check Emscripten
where emcc >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Emscripten not found. Please install and activate emsdk first.
    echo   git clone https://github.com/emscripten-core/emsdk.git
    echo   cd emsdk ^&^& emsdk install latest ^&^& emsdk activate latest
    echo   emsdk_env.bat
    exit /b 1
)

REM Create build directory
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
cd /d "%BUILD_DIR%"

REM Configure with CMake
echo Configuring...
call emcmake cmake .. -DCMAKE_BUILD_TYPE=Release -G "MinGW Makefiles"
if %errorlevel% neq 0 (
    echo CMake configuration failed
    exit /b 1
)

REM Build
echo Building...
call emmake mingw32-make -j4
if %errorlevel% neq 0 (
    echo Build failed
    exit /b 1
)

REM Copy output
echo Copying output files...
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
copy /y chili-geo.js "%OUTPUT_DIR%\"
copy /y chili-geo.wasm "%OUTPUT_DIR%\"

echo === Build completed ===
echo Output files:
echo   %OUTPUT_DIR%\chili-geo.js
echo   %OUTPUT_DIR%\chili-geo.wasm

endlocal
