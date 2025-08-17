@echo off
setlocal enabledelayedexpansion

:: iTools 二进制文件一键下载脚本 (Windows)
:: 作者: iTools Team
:: 用途: 自动下载所需的 FFmpeg 和 Whisper CLI 二进制文件

echo 🚀 开始下载 iTools 所需的二进制文件...

:: 检测系统架构
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set PLATFORM=win32-x64
    set ARCH_DISPLAY=x64
) else if "%PROCESSOR_ARCHITECTURE%"=="x86" (
    set PLATFORM=win32-ia32
    set ARCH_DISPLAY=x86
) else (
    echo ❌ 不支持的系统架构: %PROCESSOR_ARCHITECTURE%
    pause
    exit /b 1
)

echo 📍 检测到平台: Windows %ARCH_DISPLAY%

:: 创建目标目录
set TARGET_DIR=bin\%PLATFORM%
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
echo 📁 创建目录: %TARGET_DIR%

:: 检查 curl 是否可用
curl --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 需要 curl 命令，请确保 Windows 10 1803+ 或安装 curl
    pause
    exit /b 1
)

:: 检查 PowerShell 是否可用
powershell -command "Get-Host" >nul 2>&1
if errorlevel 1 (
    echo ❌ 需要 PowerShell 来解压文件
    pause
    exit /b 1
)

:: 下载 FFmpeg
echo.
echo ⬇️  下载 FFmpeg...

if "%PLATFORM%"=="win32-x64" (
    set FFMPEG_URL=https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip
    set FFMPEG_FOLDER=ffmpeg-master-latest-win64-gpl
) else (
    set FFMPEG_URL=https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win32-gpl.zip
    set FFMPEG_FOLDER=ffmpeg-master-latest-win32-gpl
)

curl -L "%FFMPEG_URL%" -o ffmpeg.zip
if errorlevel 1 (
    echo ❌ FFmpeg 下载失败
    pause
    exit /b 1
)

powershell -command "Expand-Archive -Path ffmpeg.zip -DestinationPath temp-ffmpeg -Force"
if errorlevel 1 (
    echo ❌ FFmpeg 解压失败
    del ffmpeg.zip
    pause
    exit /b 1
)

move "temp-ffmpeg\%FFMPEG_FOLDER%\bin\ffmpeg.exe" "%TARGET_DIR%\ffmpeg.exe"
if errorlevel 1 (
    echo ❌ FFmpeg 文件移动失败
    rmdir /s /q temp-ffmpeg
    del ffmpeg.zip
    pause
    exit /b 1
)

rmdir /s /q temp-ffmpeg
del ffmpeg.zip
echo ✅ FFmpeg 下载完成

:: 下载 Whisper CLI
echo.
echo ⬇️  编译 Whisper CLI 静态版本...

:: 强制从源码编译静态版本以避免动态库依赖问题
echo 🔨 从源码编译 Whisper CLI (静态链接版本)...

:: 检查 Git 是否可用
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 需要 Git 来下载源码，请先安装 Git
    echo 💡 下载地址: https://git-scm.com/download/win
    pause
    exit /b 1
)

:: 检查 CMake 是否可用
cmake --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 需要 CMake 来编译源码，请先安装 CMake
    echo 💡 下载地址: https://cmake.org/download/
    pause
    exit /b 1
)

:: 检查 Visual Studio Build Tools 或 Visual Studio
where cl.exe >nul 2>&1
if errorlevel 1 (
    :: 尝试查找 Visual Studio 环境
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "C:\Program Files\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
    ) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
    ) else (
        echo ❌ 需要 Visual Studio Build Tools 或 Visual Studio 来编译源码
        echo 💡 请安装 Visual Studio Build Tools 或 Visual Studio Community
        echo    Build Tools 下载: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio
        pause
        exit /b 1
    )
)

:: 下载源码并编译静态版本
echo 🔧 下载 whisper.cpp 源码...
git clone https://github.com/ggerganov/whisper.cpp.git temp-whisper-source
if errorlevel 1 (
    echo ❌ 下载源码失败
    pause
    exit /b 1
)

cd temp-whisper-source

:: 配置cmake进行静态链接编译
echo 🔧 配置cmake进行静态链接编译...
cmake -B build-static ^
    -DBUILD_SHARED_LIBS=OFF ^
    -DGGML_STATIC=ON ^
    -DCMAKE_BUILD_TYPE=Release ^
    -A x64

if errorlevel 1 (
    echo ❌ CMake 配置失败
    cd ..
    rmdir /s /q temp-whisper-source
    pause
    exit /b 1
)

:: 编译
echo 🔨 开始编译静态版本...
cmake --build build-static --config Release

if errorlevel 1 (
    echo ❌ 编译失败
    cd ..
    rmdir /s /q temp-whisper-source
    pause
    exit /b 1
)

cd ..

:: 移动编译好的文件
if exist "temp-whisper-source\build-static\bin\Release\whisper-cli.exe" (
    move "temp-whisper-source\build-static\bin\Release\whisper-cli.exe" "%TARGET_DIR%\whisper-cli.exe"
) else if exist "temp-whisper-source\build-static\bin\whisper-cli.exe" (
    move "temp-whisper-source\build-static\bin\whisper-cli.exe" "%TARGET_DIR%\whisper-cli.exe"
) else if exist "temp-whisper-source\build-static\Release\whisper-cli.exe" (
    move "temp-whisper-source\build-static\Release\whisper-cli.exe" "%TARGET_DIR%\whisper-cli.exe"
) else (
    echo ❌ 编译的可执行文件位置不符合预期
    echo 🔍 查找编译结果...
    dir temp-whisper-source\build-static /s /b | findstr whisper
    pause
    rmdir /s /q temp-whisper-source
    exit /b 1
)

rmdir /s /q temp-whisper-source
echo ✅ Whisper CLI 静态链接版本编译完成

:: 验证下载的文件
echo.
echo 🔍 验证下载的文件...

if exist "%TARGET_DIR%\ffmpeg.exe" (
    "%TARGET_DIR%\ffmpeg.exe" -version >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  FFmpeg 可能损坏，但文件已下载
    ) else (
        echo ✅ FFmpeg: 已安装并可执行
    )
) else (
    echo ❌ FFmpeg 文件不存在
    pause
    exit /b 1
)

if exist "%TARGET_DIR%\whisper-cli.exe" (
    echo ✅ Whisper CLI: 已安装
) else (
    echo ❌ Whisper CLI 文件不存在
    pause
    exit /b 1
)

echo.
echo 🎉 所有二进制文件下载完成！
echo 📍 文件位置: %TARGET_DIR%\
echo.
echo 📖 接下来请:
echo    1. 下载 Whisper 模型文件到 models\ggml\ 目录
echo    2. 运行 'npm run build-renderer ^&^& npm start' 启动应用
echo.
echo 💡 提示: 可以使用以下命令下载基础模型:
echo    curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" -o models\ggml\ggml-base.bin

pause
