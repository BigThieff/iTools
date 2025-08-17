#!/bin/bash

# iTools Whisper 模型文件下载脚本
# 作者: iTools Team
# 用途: 自动下载 Whisper 模型文件

set -e

echo "🎯 Whisper 模型文件下载工具"
echo ""

# 创建模型目录
mkdir -p models/ggml
echo "📁 创建/检查模型目录: models/ggml"

# 模型信息
declare -A MODELS=(
    ["tiny"]="ggml-tiny.bin|39MB|最快速度，质量一般，适合快速测试"
    ["base"]="ggml-base.bin|142MB|平衡选择，推荐日常使用"
    ["small"]="ggml-small.bin|466MB|质量较好，速度适中"
    ["medium"]="ggml-medium.bin|1.5GB|质量很好，处理较慢"
    ["large"]="ggml-large-v1.bin|2.9GB|最佳质量，处理最慢"
    ["large-v2"]="ggml-large-v2.bin|2.9GB|最新版本，质量最佳"
    ["large-v3"]="ggml-large-v3.bin|2.9GB|最新版本，支持更多语言"
)

# 显示可用模型
echo "📋 可用的 Whisper 模型:"
echo ""
for model in tiny base small medium large large-v2 large-v3; do
    IFS='|' read -r filename size description <<< "${MODELS[$model]}"
    printf "   %-12s %-20s %s\n" "[$model]" "($size)" "$description"
done

echo ""
echo "💡 推荐模型："
echo "   - 快速测试: tiny"
echo "   - 日常使用: base 或 small"
echo "   - 高质量需求: medium 或 large-v3"
echo ""

# 获取用户选择
if [[ $# -eq 0 ]]; then
    read -p "请选择要下载的模型 (输入模型名称，如 base): " SELECTED_MODEL
else
    SELECTED_MODEL=$1
fi

# 验证选择
if [[ -z "${MODELS[$SELECTED_MODEL]}" ]]; then
    echo "❌ 无效的模型选择: $SELECTED_MODEL"
    echo "可用模型: ${!MODELS[@]}"
    exit 1
fi

# 解析模型信息
IFS='|' read -r filename size description <<< "${MODELS[$SELECTED_MODEL]}"
target_path="models/ggml/$filename"

# 检查文件是否已存在
if [[ -f "$target_path" ]]; then
    echo "📁 模型文件已存在: $target_path"
    read -p "是否重新下载? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ 使用现有模型文件"
        exit 0
    fi
    echo "🗑️  删除现有文件..."
    rm "$target_path"
fi

# 构造下载 URL
base_url="https://huggingface.co/ggerganov/whisper.cpp/resolve/main"
download_url="$base_url/$filename"

echo ""
echo "⬇️  开始下载 $SELECTED_MODEL 模型..."
echo "📊 文件大小: $size"
echo "📝 说明: $description"
echo "🔗 下载地址: $download_url"
echo ""

# 下载文件
if command -v wget &> /dev/null; then
    # 使用 wget (显示进度条)
    wget --progress=bar:force:noscroll -O "$target_path" "$download_url"
elif command -v curl &> /dev/null; then
    # 使用 curl (显示进度条)
    curl -L --progress-bar -o "$target_path" "$download_url"
else
    echo "❌ 需要 wget 或 curl 来下载文件"
    exit 1
fi

# 验证下载
if [[ -f "$target_path" ]]; then
    file_size=$(du -h "$target_path" | cut -f1)
    echo ""
    echo "✅ 模型下载完成!"
    echo "📍 文件位置: $target_path"
    echo "📊 文件大小: $file_size"
    echo ""
    echo "🎉 现在可以启动 iTools 应用了:"
    echo "   npm run build-renderer && npm start"
else
    echo "❌ 下载失败，请检查网络连接或手动下载"
    exit 1
fi
