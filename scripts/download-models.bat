@echo off
setlocal enabledelayedexpansion

:: iTools Whisper 模型文件下载脚本 (Windows)
:: 作者: iTools Team
:: 用途: 自动下载 Whisper 模型文件

echo 🎯 Whisper 模型文件下载工具
echo.

:: 创建模型目录
if not exist "models\ggml" mkdir "models\ggml"
echo 📁 创建/检查模型目录: models\ggml

:: 显示可用模型
echo.
echo 📋 可用的 Whisper 模型:
echo.
echo    [tiny]       (39MB)     最快速度，质量一般，适合快速测试
echo    [base]       (142MB)    平衡选择，推荐日常使用
echo    [small]      (466MB)    质量较好，速度适中
echo    [medium]     (1.5GB)    质量很好，处理较慢
echo    [large]      (2.9GB)    最佳质量，处理最慢 (v1)
echo    [large-v2]   (2.9GB)    最新版本，质量最佳
echo    [large-v3]   (2.9GB)    最新版本，支持更多语言
echo.
echo 💡 推荐模型：
echo    - 快速测试: tiny
echo    - 日常使用: base 或 small
echo    - 高质量需求: medium 或 large-v3
echo.

:: 获取用户选择
if "%~1"=="" (
    set /p SELECTED_MODEL=请选择要下载的模型 (输入模型名称，如 base): 
) else (
    set SELECTED_MODEL=%~1
)

:: 验证选择并设置文件信息
if "%SELECTED_MODEL%"=="tiny" (
    set FILENAME=ggml-tiny.bin
    set SIZE=39MB
    set DESCRIPTION=最快速度，质量一般，适合快速测试
) else if "%SELECTED_MODEL%"=="base" (
    set FILENAME=ggml-base.bin
    set SIZE=142MB
    set DESCRIPTION=平衡选择，推荐日常使用
) else if "%SELECTED_MODEL%"=="small" (
    set FILENAME=ggml-small.bin
    set SIZE=466MB
    set DESCRIPTION=质量较好，速度适中
) else if "%SELECTED_MODEL%"=="medium" (
    set FILENAME=ggml-medium.bin
    set SIZE=1.5GB
    set DESCRIPTION=质量很好，处理较慢
) else if "%SELECTED_MODEL%"=="large" (
    set FILENAME=ggml-large-v1.bin
    set SIZE=2.9GB
    set DESCRIPTION=最佳质量，处理最慢 (v1)
) else if "%SELECTED_MODEL%"=="large-v2" (
    set FILENAME=ggml-large-v2.bin
    set SIZE=2.9GB
    set DESCRIPTION=最新版本，质量最佳
) else if "%SELECTED_MODEL%"=="large-v3" (
    set FILENAME=ggml-large-v3.bin
    set SIZE=2.9GB
    set DESCRIPTION=最新版本，支持更多语言
) else (
    echo ❌ 无效的模型选择: %SELECTED_MODEL%
    echo 可用模型: tiny, base, small, medium, large, large-v2, large-v3
    pause
    exit /b 1
)

set TARGET_PATH=models\ggml\%FILENAME%

:: 检查文件是否已存在
if exist "%TARGET_PATH%" (
    echo 📁 模型文件已存在: %TARGET_PATH%
    set /p CONFIRM=是否重新下载? (y/N): 
    if /i not "!CONFIRM!"=="y" (
        echo ✅ 使用现有模型文件
        pause
        exit /b 0
    )
    echo 🗑️  删除现有文件...
    del "%TARGET_PATH%"
)

:: 构造下载 URL
set BASE_URL=https://huggingface.co/ggerganov/whisper.cpp/resolve/main
set DOWNLOAD_URL=%BASE_URL%/%FILENAME%

echo.
echo ⬇️  开始下载 %SELECTED_MODEL% 模型...
echo 📊 文件大小: %SIZE%
echo 📝 说明: %DESCRIPTION%
echo 🔗 下载地址: %DOWNLOAD_URL%
echo.

:: 检查 curl 是否可用
curl --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 需要 curl 命令，请确保 Windows 10 1803+ 或安装 curl
    echo 💡 或者手动从以下地址下载:
    echo    %DOWNLOAD_URL%
    echo    并保存为: %TARGET_PATH%
    pause
    exit /b 1
)

:: 下载文件
curl -L --progress-bar -o "%TARGET_PATH%" "%DOWNLOAD_URL%"
if errorlevel 1 (
    echo ❌ 下载失败，请检查网络连接或手动下载
    echo 💡 手动下载地址: %DOWNLOAD_URL%
    echo    保存为: %TARGET_PATH%
    pause
    exit /b 1
)

:: 验证下载
if exist "%TARGET_PATH%" (
    echo.
    echo ✅ 模型下载完成!
    echo 📍 文件位置: %TARGET_PATH%
    
    :: 显示文件大小
    for %%F in ("%TARGET_PATH%") do set FILE_SIZE=%%~zF
    set /a FILE_SIZE_MB=!FILE_SIZE!/1048576
    echo 📊 文件大小: !FILE_SIZE_MB! MB
    
    echo.
    echo 🎉 现在可以启动 iTools 应用了:
    echo    npm run build-renderer ^&^& npm start
) else (
    echo ❌ 下载失败，请检查网络连接或手动下载
    exit /b 1
)

pause
