#!/bin/bash

# iTools 静态 Whisper CLI 构建脚本
# 用途: 编译静态链接的 whisper-cli 来避免动态库依赖问题

set -e  # 遇到错误立即退出

echo "🔨 构建静态链接的 Whisper CLI..."

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
        exit 1
        ;;
esac

# 检查必要的编译工具
if ! command -v cmake &> /dev/null; then
    echo "❌ 缺少 cmake 工具，请先安装:"
    if [[ "$OS" == "Darwin" ]]; then
        echo "   brew install cmake"
        echo "   或者从 https://cmake.org/download/ 下载"
    else
        echo "   sudo apt-get install cmake (Ubuntu/Debian)"
        echo "   sudo yum install cmake (CentOS/RHEL)"
    fi
    exit 1
fi

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

if ! command -v git &> /dev/null; then
    echo "❌ 缺少 git 工具，请先安装 git"
    exit 1
fi

# 创建目标目录
TARGET_DIR="bin/$PLATFORM"
mkdir -p "$TARGET_DIR"
echo "📁 目标目录: $TARGET_DIR"

# 清理旧的构建目录
if [[ -d "temp-whisper-rebuild" ]]; then
    echo "🧹 清理旧的构建目录..."
    rm -rf temp-whisper-rebuild
fi

# 下载源码
echo "🔧 下载 whisper.cpp 源码..."
git clone https://github.com/ggerganov/whisper.cpp.git temp-whisper-rebuild
cd temp-whisper-rebuild

# 配置cmake进行静态链接编译
echo "🔧 配置cmake进行静态链接编译..."
if [[ "$OS" == "Darwin" ]]; then
    # macOS 使用Metal后端的静态编译
    cmake -B build-static \
        -DBUILD_SHARED_LIBS=OFF \
        -DGGML_STATIC=ON \
        -DGGML_BLAS=OFF \
        -DGGML_METAL=ON \
        -DCMAKE_BUILD_TYPE=Release
else
    # Linux 静态编译
    cmake -B build-static \
        -DBUILD_SHARED_LIBS=OFF \
        -DGGML_STATIC=ON \
        -DGGML_BLAS=OFF \
        -DCMAKE_BUILD_TYPE=Release
fi

# 编译
echo "🔨 开始编译静态版本..."
cmake --build build-static --config Release -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

cd ..

# 备份现有的 whisper-cli
if [[ -f "$TARGET_DIR/whisper-cli" ]]; then
    echo "💾 备份现有的 whisper-cli..."
    cp "$TARGET_DIR/whisper-cli" "$TARGET_DIR/whisper-cli.backup.$(date +%Y%m%d_%H%M%S)"
fi

# 移动编译好的文件
echo "📦 安装新的静态 whisper-cli..."
mv temp-whisper-rebuild/build-static/bin/whisper-cli "$TARGET_DIR/whisper-cli"
chmod +x "$TARGET_DIR/whisper-cli"

# 清理临时目录
echo "🧹 清理临时文件..."
rm -rf temp-whisper-rebuild

# 验证编译结果
echo ""
echo "🔍 验证编译结果..."

if [[ -x "$TARGET_DIR/whisper-cli" ]]; then
    echo "✅ Whisper CLI: 已安装"
    
    # 检查动态库依赖
    echo "🔍 检查动态库依赖..."
    if command -v otool &> /dev/null; then
        # macOS
        DEPS=$(otool -L "$TARGET_DIR/whisper-cli" | grep -v "/usr/lib" | grep -v "/System/Library" | grep -v "$TARGET_DIR/whisper-cli:" | wc -l)
        if [[ $DEPS -eq 0 ]]; then
            echo "✅ 静态链接成功: 无外部动态库依赖"
        else
            echo "⚠️  仍有外部动态库依赖:"
            otool -L "$TARGET_DIR/whisper-cli" | grep -v "/usr/lib" | grep -v "/System/Library" | grep -v "$TARGET_DIR/whisper-cli:"
        fi
    elif command -v ldd &> /dev/null; then
        # Linux
        echo "动态库依赖情况:"
        ldd "$TARGET_DIR/whisper-cli" || echo "✅ 静态链接成功"
    fi
    
    # 测试基本功能
    echo "🧪 测试基本功能..."
    if "$TARGET_DIR/whisper-cli" --help > /dev/null 2>&1; then
        echo "✅ whisper-cli 功能正常"
    else
        echo "⚠️  whisper-cli 可能存在问题"
    fi
else
    echo "❌ Whisper CLI 构建失败"
    exit 1
fi

echo ""
echo "🎉 静态 Whisper CLI 构建完成！"
echo "📍 文件位置: $TARGET_DIR/whisper-cli"
echo ""
echo "💡 现在可以重新打包应用程序来使用新的静态版本"
