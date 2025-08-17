#!/bin/bash

# iTools 二进制文件一键下载脚本 (macOS/Linux)
# 作者: iTools Team
# 用途: 自动下载所需的 FFmpeg 和 Whisper CLI 二进制文件

set -e  # 遇到错误立即退出

echo "🚀 开始下载 iTools 所需的二进制文件..."

# 检测当前平台和架构
OS=$(uname -s)
ARCH=$(uname -m)

# 转换为项目使用的平台标识
case "$OS" in
    "Darwin")
        if [[ "$ARCH" == "arm64" ]]; then
            PLATFORM="darwin-arm64"
            echo "📍 检测到平台: macOS ARM64 (M系列芯片)"
        else
            PLATFORM="darwin-x64"
            echo "📍 检测到平台: macOS x64 (Intel芯片)"
        fi
        ;;
    "Linux")
        if [[ "$ARCH" == "aarch64" ]] || [[ "$ARCH" == "arm64" ]]; then
            PLATFORM="linux-arm64"
            echo "📍 检测到平台: Linux ARM64"
        else
            PLATFORM="linux-x64"
            echo "📍 检测到平台: Linux x64"
        fi
        ;;
    *)
        echo "❌ 不支持的操作系统: $OS"
        echo "请手动下载二进制文件或使用 Windows 脚本"
        exit 1
        ;;
esac

# 创建目标目录
TARGET_DIR="bin/$PLATFORM"
mkdir -p "$TARGET_DIR"
echo "📁 创建目录: $TARGET_DIR"

# 下载 FFmpeg
echo ""
echo "⬇️  下载 FFmpeg..."
case "$OS" in
    "Darwin")
        # macOS 使用 evermeet.cx 的静态编译版本
        curl -L "https://evermeet.cx/ffmpeg/getrelease/zip" -o ffmpeg.zip
        unzip -q ffmpeg.zip -d temp-ffmpeg
        mv temp-ffmpeg/ffmpeg "$TARGET_DIR/ffmpeg"
        chmod +x "$TARGET_DIR/ffmpeg"
        rm -rf ffmpeg.zip temp-ffmpeg
        echo "✅ FFmpeg 下载完成"
        ;;
    "Linux")
        # Linux 使用 johnvansickle.com 的静态编译版本
        if [[ "$PLATFORM" == "linux-arm64" ]]; then
            curl -L "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz" -o ffmpeg.tar.xz
        else
            curl -L "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" -o ffmpeg.tar.xz
        fi
        tar -xf ffmpeg.tar.xz
        mv ffmpeg-*-static/ffmpeg "$TARGET_DIR/ffmpeg"
        chmod +x "$TARGET_DIR/ffmpeg"
        rm -rf ffmpeg.tar.xz ffmpeg-*-static
        echo "✅ FFmpeg 下载完成"
        ;;
esac

# 下载 Whisper CLI
echo ""
echo "⬇️  下载 Whisper CLI..."

# 尝试从 GitHub releases 下载预编译版本
WHISPER_URL=""
case "$PLATFORM" in
    "darwin-arm64"|"darwin-x64")
        # macOS 通用版本
        WHISPER_URL="https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-macos.zip"
        ;;
    "linux-x64"|"linux-arm64")
        # Linux 版本
        WHISPER_URL="https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-linux.zip"
        ;;
esac

if [[ -n "$WHISPER_URL" ]]; then
    # 尝试下载预编译版本
    if curl -L "$WHISPER_URL" -o whisper.zip 2>/dev/null; then
        if unzip -q whisper.zip -d temp-whisper 2>/dev/null; then
            # 查找可执行文件
            if [[ -f "temp-whisper/main" ]]; then
                mv temp-whisper/main "$TARGET_DIR/whisper-cli"
            elif [[ -f "temp-whisper/whisper" ]]; then
                mv temp-whisper/whisper "$TARGET_DIR/whisper-cli"
            elif ls temp-whisper/ | grep -E "(main|whisper)" > /dev/null 2>&1; then
                # 使用找到的第一个匹配文件
                mv temp-whisper/$(ls temp-whisper/ | grep -E "(main|whisper)" | head -1) "$TARGET_DIR/whisper-cli"
            else
                echo "⚠️  预编译版本下载失败，将尝试从源码编译..."
                rm -rf whisper.zip temp-whisper
                COMPILE_FROM_SOURCE=true
            fi
            chmod +x "$TARGET_DIR/whisper-cli" 2>/dev/null || true
            rm -rf whisper.zip temp-whisper
            
            if [[ "$COMPILE_FROM_SOURCE" != "true" ]]; then
                echo "✅ Whisper CLI 下载完成"
            fi
        else
            echo "⚠️  预编译版本下载失败，将尝试从源码编译..."
            rm -rf whisper.zip
            COMPILE_FROM_SOURCE=true
        fi
    else
        echo "⚠️  预编译版本下载失败，将尝试从源码编译..."
        COMPILE_FROM_SOURCE=true
    fi
else
    COMPILE_FROM_SOURCE=true
fi

# 如果预编译版本失败，从源码编译
if [[ "$COMPILE_FROM_SOURCE" == "true" ]]; then
    echo "🔨 从源码编译 Whisper CLI..."
    
    # 检查必要的编译工具
    if ! command -v make &> /dev/null; then
        echo "❌ 缺少 make 工具，请先安装开发工具:"
        if [[ "$OS" == "Darwin" ]]; then
            echo "   xcode-select --install"
        else
            echo "   sudo apt-get install build-essential (Ubuntu/Debian)"
            echo "   sudo yum groupinstall 'Development Tools' (CentOS/RHEL)"
        fi
        exit 1
    fi
    
    # 下载源码并编译
    git clone https://github.com/ggerganov/whisper.cpp.git temp-whisper-source
    cd temp-whisper-source
    make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
    cd ..
    mv temp-whisper-source/main "$TARGET_DIR/whisper-cli"
    chmod +x "$TARGET_DIR/whisper-cli"
    rm -rf temp-whisper-source
    echo "✅ Whisper CLI 编译完成"
fi

# 验证下载的文件
echo ""
echo "🔍 验证下载的文件..."

if [[ -x "$TARGET_DIR/ffmpeg" ]]; then
    FFMPEG_VERSION=$("$TARGET_DIR/ffmpeg" -version 2>/dev/null | head -1 | cut -d' ' -f3 || echo "未知版本")
    echo "✅ FFmpeg: $FFMPEG_VERSION"
else
    echo "❌ FFmpeg 下载失败或不可执行"
    exit 1
fi

if [[ -x "$TARGET_DIR/whisper-cli" ]]; then
    echo "✅ Whisper CLI: 已安装"
    # Whisper CLI 可能不支持 --version 参数，所以只检查文件存在性
else
    echo "❌ Whisper CLI 下载失败或不可执行"
    exit 1
fi

echo ""
echo "🎉 所有二进制文件下载完成！"
echo "📍 文件位置: $TARGET_DIR/"
echo ""
echo "📖 接下来请:"
echo "   1. 下载 Whisper 模型文件到 models/ggml/ 目录"
echo "   2. 运行 'npm run build-renderer && npm start' 启动应用"
echo ""
echo "💡 提示: 可以使用以下命令下载基础模型:"
echo "   curl -L 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin' -o models/ggml/ggml-base.bin"
