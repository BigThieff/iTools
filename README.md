# 🎯 iTools - 智能视频字幕提取工具

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**基于 OpenAI Whisper 和 FFmpeg 的跨平台字幕提取桌面应用**

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [开发指南](#-开发指南) • [故障排除](#-故障排除)

</div>

## ✨ 功能特性

### � 视频处理
- **多格式支持**: MP4、MKV、AVI、MOV 等主流视频格式
- **音频提取**: 自动从视频中提取音频进行处理
- **批量处理**: 支持多个视频文件同时处理

### 🌍 字幕生成
- **多语言识别**: 自动识别中文、英文、日文、韩文等多种语言
- **双语字幕**: 支持生成原语言 + 翻译语言的双语字幕
- **时间轴精确**: 精确到毫秒级的时间轴对齐
- **格式标准**: 输出标准 SRT 字幕格式

### 💻 跨平台支持
- **macOS**: 支持 Intel 和 Apple Silicon (M1/M2) 芯片
- **Windows**: 支持 64 位和 32 位系统
- **Linux**: 支持 x64 和 ARM64 架构

### � 智能管理
- **自动权限管理**: 自动设置二进制文件执行权限
- **平台检测**: 智能检测系统平台和架构
- **错误处理**: 友好的错误提示和日志记录

## 🚀 快速开始

### 📋 系统要求

- **Node.js**: 16.0.0 或更高版本
- **内存**: 建议 4GB 以上
- **存储**: 至少 2GB 可用空间（用于模型文件）

### 📥 下载安装

#### 选项 1: 下载发布版本（推荐）
前往 [Releases](https://github.com/BigThieff/iTools/releases) 页面下载适合您系统的安装包：
- macOS: `iTools-1.0.0.dmg`
- Windows: `iTools-Setup-1.0.0.exe`
- Linux: `iTools-1.0.0.AppImage`

#### 选项 2: 从源码构建
```bash
git clone https://github.com/BigThieff/iTools.git
cd iTools
npm install
npm run build
npm start
```

### 🎮 使用方法

1. **启动应用**: 双击安装的应用图标
2. **选择视频**: 点击"选择视频文件"按钮
3. **选择模型**: 根据需要选择 Whisper 模型（推荐 base 模型）
4. **设置选项**: 
   - 选择源语言（或选择"自动检测"）
   - 如需双语字幕，选择目标翻译语言
5. **开始提取**: 点击"开始提取"按钮
6. **等待完成**: 处理完成后字幕文件将保存在视频同目录下

### 📁 输出文件命名规则
```
原视频文件: movie.mp4
输出字幕文件: movie_base_zh_en.srt
命名格式: {视频名}_{模型名}_{源语言}_{目标语言}.srt
```

## 🛠 开发指南

### 🏗 项目结构
```
iTools/
├── 📁 bin/                     # 平台特定的二进制文件
│   ├── 📁 darwin-arm64/        # macOS Apple Silicon
│   ├── 📁 darwin-x64/          # macOS Intel
│   ├── 📁 win32-x64/           # Windows 64位
│   ├── 📁 win32-ia32/          # Windows 32位
│   ├── 📁 linux-x64/           # Linux x64
│   └── 📁 linux-arm64/         # Linux ARM64
├── 📁 models/ggml/             # Whisper 模型文件存储
├── 📁 renderer/                # 前端界面源码
│   ├── 📁 components/          # React 组件
│   ├── 📄 app.html            # 主页面模板
│   └── 📄 app-renderer.js     # 渲染进程入口
├── 📁 tools/subtitle/          # 字幕处理核心逻辑
├── 📁 utils/                   # 工具类库
│   ├── 📄 platform-manager.cjs # 平台管理器
│   └── 📄 error-handler.cjs    # 错误处理器
├── 📁 scripts/                 # 构建和部署脚本
├── 📁 assets/                  # 应用图标等资源
├── 📄 electron-main.cjs        # Electron 主进程
├── 📄 electron-preload.js      # 预加载脚本
└── 📄 package.json             # 项目配置
```

### 🔧 本地开发环境搭建

#### 1. 克隆项目
```bash
git clone https://github.com/BigThieff/iTools.git
cd iTools
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 准备二进制文件
根据您的开发平台，需要准备相应的二进制文件：

<details>
<summary><strong>📱 macOS 开发环境</strong></summary>

```bash
# 自动下载脚本（推荐）
./scripts/download-binaries.sh

# 或手动下载
mkdir -p bin/darwin-arm64  # M1/M2 芯片
mkdir -p bin/darwin-x64    # Intel 芯片

# 从以下地址下载并放置到对应目录：
# FFmpeg: https://evermeet.cx/ffmpeg/
# Whisper CLI: https://github.com/ggerganov/whisper.cpp/releases
```
</details>

<details>
<summary><strong>🪟 Windows 开发环境</strong></summary>

```batch
# 自动下载脚本（推荐）
scripts\download-binaries.bat

# 或手动创建目录
mkdir bin\win32-x64
mkdir bin\win32-ia32

# 从以下地址下载并放置到对应目录：
# FFmpeg: https://www.gyan.dev/ffmpeg/builds/
# Whisper CLI: https://github.com/ggerganov/whisper.cpp/releases
```
</details>

<details>
<summary><strong>🐧 Linux 开发环境</strong></summary>

```bash
# 自动下载脚本（推荐）
./scripts/download-binaries.sh

# 或手动下载
mkdir -p bin/linux-x64
mkdir -p bin/linux-arm64

# FFmpeg: https://johnvansickle.com/ffmpeg/
# Whisper CLI: 需要从源码编译或下载预编译版本
```
</details>

#### 4. 下载模型文件
```bash
# 自动下载脚本（推荐）
./scripts/download-models.sh     # macOS/Linux
scripts\download-models.bat      # Windows

# 或手动下载到 models/ggml/ 目录
mkdir -p models/ggml
# 推荐下载 base 模型（142MB）
curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" -o models/ggml/ggml-base.bin
```

#### 5. 开发模式启动
```bash
# 构建前端代码
npm run build-renderer:dev

# 启动应用
npm start
```

### 📦 打包发布

#### 构建所有平台
```bash
npm run dist:all
```

#### 构建特定平台
```bash
npm run dist:mac        # macOS
npm run dist:win        # Windows
npm run dist:linux      # Linux
```

#### 构建注意事项
- **文件大小**: 由于包含多平台二进制文件，构建产物较大（约2GB）
- **Windows安装包**: 如果遇到NSIS内存错误，可单独构建解压版本
- **网络问题**: 构建过程需要下载Electron二进制文件，请确保网络连接稳定

#### 发布文件位置
构建完成后，安装包将生成在 `release/` 目录下：

| 平台 | 文件名 | 大小 | 说明 |
|------|-------|------|------|
| macOS (ARM64) | `iTools-1.0.0-arm64.dmg` | ~1.9GB | Apple Silicon 版本 |
| macOS (x64) | `iTools-1.0.0.dmg` | ~1.9GB | Intel 芯片版本 |
| Linux (x64) | `iTools-1.0.0.AppImage` | ~1.9GB | 通用 AppImage 格式 |
| Linux (ARM64) | `iTools-1.0.0-arm64.AppImage` | ~1.9GB | ARM64 架构版本 |
| Windows (x64) | `iTools-1.0.0-win-x64.zip` | ~2.0GB | 64位解压版本 |
| Windows (32位) | `iTools-1.0.0-win-ia32.zip` | ~2.0GB | 32位解压版本 |

### 🧪 可用脚本命令

| 命令 | 描述 |
|------|------|
| `npm start` | 启动开发环境 |
| `npm run build-renderer` | 构建前端（生产环境） |
| `npm run build-renderer:dev` | 构建前端（开发环境） |
| `npm run dist` | 打包当前平台 |
| `npm run dist:all` | 打包所有平台 |
| `npm run clean` | 清理构建产物 |

## 🔍 故障排除

### ❓ 常见问题

<details>
<summary><strong>🚫 "找不到二进制文件" 错误</strong></summary>

**原因**: 缺少 FFmpeg 或 Whisper CLI 二进制文件

**解决方案**:
1. 检查 `bin/{platform}/` 目录是否存在对应文件
2. 运行自动下载脚本: `./scripts/download-binaries.sh`
3. 手动下载并放置到正确目录
4. 确保文件有执行权限（Linux/macOS）
</details>

<details>
<summary><strong>🔒 权限被拒绝错误</strong></summary>

**原因**: 二进制文件没有执行权限

**解决方案**:
```bash
# macOS/Linux
chmod +x bin/*/ffmpeg
chmod +x bin/*/whisper-cli

# 或使用应用内的权限修复功能
```
</details>

<details>
<summary><strong>🧠 "模型文件未找到" 错误</strong></summary>

**原因**: 缺少 Whisper 模型文件

**解决方案**:
1. 运行模型下载脚本: `./scripts/download-models.sh`
2. 或手动下载模型文件到 `models/ggml/` 目录
3. 确保文件名格式正确（如 `ggml-base.bin`）
</details>

<details>
<summary><strong>💾 内存不足错误</strong></summary>

**原因**: 系统内存不足以加载大模型

**解决方案**:
1. 选择较小的模型（如 tiny 或 base）
2. 关闭其他占用内存的应用
3. 考虑升级系统内存
</details>

### 📊 性能优化建议

| 模型 | 文件大小 | 内存占用 | 处理速度 | 质量 | 推荐场景 |
|------|----------|----------|----------|------|----------|
| tiny | 39MB | ~390MB | 最快 | 一般 | 快速测试 |
| base | 142MB | ~500MB | 快 | 良好 | 日常使用 |
| small | 466MB | ~1GB | 中等 | 很好 | 高质量需求 |
| medium | 1.5GB | ~2GB | 慢 | 优秀 | 专业用途 |
| large-v3 | 2.9GB | ~4GB | 最慢 | 最佳 | 最高质量 |

### 📝 日志查看

应用运行时会在以下位置生成日志文件：
- **Windows**: `%APPDATA%/iTools/logs/`
- **macOS**: `~/Library/Logs/iTools/`
- **Linux**: `~/.config/iTools/logs/`

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 🐛 报告问题
在 [Issues](https://github.com/BigThieff/iTools/issues) 页面报告 bug 或提出功能请求。

### 💻 代码贡献
1. Fork 项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 提交 Pull Request

### 📚 文档改进
帮助改进文档和示例，让更多人能够轻松使用 iTools。

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [OpenAI Whisper](https://github.com/openai/whisper) - 强大的语音识别模型
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - C++ 实现的 Whisper 推理引擎
- [FFmpeg](https://ffmpeg.org/) - 多媒体处理框架
- [Electron](https://electronjs.org/) - 跨平台桌面应用框架

---

<div align="center">

**如果这个项目对您有帮助，请给我们一个 ⭐ Star！**

[🐛 报告问题](https://github.com/BigThieff/iTools/issues) • [💡 功能建议](https://github.com/BigThieff/iTools/issues) • [📖 更多文档](https://github.com/BigThieff/iTools/wiki)

</div>