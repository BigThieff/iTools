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
echo ⬇️  下载 Whisper CLI...

:: 尝试下载预编译版本
set WHISPER_URL=https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-windows.zip

curl -L "%WHISPER_URL%" -o whisper.zip
if errorlevel 1 (
    echo ⚠️  预编译版本下载失败，尝试替代源...
    
    :: 尝试从其他源下载
    curl -L "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-Win32.zip" -o whisper.zip
    if errorlevel 1 (
        echo ❌ Whisper CLI 下载失败
        echo 💡 请手动从以下地址下载:
        echo    https://github.com/ggerganov/whisper.cpp/releases
        echo    下载对应 Windows 版本，重命名为 whisper-cli.exe 并放入 %TARGET_DIR%
        pause
        exit /b 1
    )
)

powershell -command "Expand-Archive -Path whisper.zip -DestinationPath temp-whisper -Force"
if errorlevel 1 (
    echo ❌ Whisper CLI 解压失败
    del whisper.zip
    pause
    exit /b 1
)

:: 查找 whisper 可执行文件
if exist "temp-whisper\main.exe" (
    move "temp-whisper\main.exe" "%TARGET_DIR%\whisper-cli.exe"
) else if exist "temp-whisper\whisper.exe" (
    move "temp-whisper\whisper.exe" "%TARGET_DIR%\whisper-cli.exe"
) else if exist "temp-whisper\whisper-cli.exe" (
    move "temp-whisper\whisper-cli.exe" "%TARGET_DIR%\whisper-cli.exe"
) else (
    echo ❌ 在解压的文件中找不到 whisper 可执行文件
    dir temp-whisper
    echo 💡 请手动从 temp-whisper 目录中找到正确的可执行文件并重命名为 whisper-cli.exe
    pause
    rmdir /s /q temp-whisper
    del whisper.zip
    exit /b 1
)

rmdir /s /q temp-whisper
del whisper.zip
echo ✅ Whisper CLI 下载完成

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
