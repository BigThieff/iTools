# iTools · 智能视频字幕提取桌面应用

跨平台、本地离线、基于 OpenAI Whisper 与 FFmpeg 的字幕提取工具。支持从常见视频格式中提取音频并生成 SRT 字幕，可选双语合成并提供进度可视化与快捷键。


## 功能概览
- 多格式支持：MP4、MKV、AVI、MOV 等
- 模型选择：支持加载 ggml 系列 Whisper 模型（如 base、small 等）
- 双语字幕：原语言 + 目标语言，并支持上下顺序切换
- 进度反馈：音频提取/识别阶段的进度条与状态提示
- 结果复用：检测同参数生成的字幕是否已存在，避免重复计算
- 快捷键：
  - Cmd/Ctrl + O 选择视频
  - Cmd/Ctrl + Enter 开始提取
- 跨平台：macOS（Intel/Apple Silicon）、Windows（x64/ia32/arm64）、Linux（x64/arm64）


## 环境要求
- Node.js ≥ 18（推荐 20+）
- 磁盘空间：模型文件建议预留 ≥ 2GB
- 已安装平台二进制：
  - FFmpeg
  - whisper.cpp 的命令行工具（whisper-cli）

提示：仓库提供脚本与预置目录，便于按平台放置二进制到 `bin/{platform}/`。


## 本地搭建（开发者）

### 1. 克隆与安装依赖
```bash
git clone https://github.com/BigThieff/iTools.git
cd iTools
npm install
```

### 2. 准备平台二进制
- 推荐脚本（macOS/Linux）：
```bash
./scripts/download-binaries.sh
```
- Windows：
```bat
scripts\download-binaries.bat
```
- 或手动放置（示例目录）：
  - macOS Apple Silicon：`bin/darwin-arm64/`
  - macOS Intel：`bin/darwin-x64/`
  - Windows：`bin/win32-x64/`、`bin/win32-ia32/`、`bin/win32-arm64/`
  - Linux：`bin/linux-x64/`、`bin/linux-arm64/`

确保二进制具备可执行权限（macOS/Linux）。

### 3. 准备模型文件
- 推荐脚本：
```bash
./scripts/download-models.sh     # macOS/Linux
scripts\download-models.bat     # Windows
```
- 手动下载：将所需 ggml 模型放入 `models/ggml/`（如 `ggml-base.bin`、`ggml-small.bin`）。
- 模型下载页面（Hugging Face）：https://huggingface.co/ggerganov/whisper.cpp/tree/main

### 4. 启动开发模式
```bash
npm run build-renderer:dev   # 构建渲染进程（开发模式）
npm start                    # 启动 Electron 应用
```

### 5. 打包发布（可选）
- 打包当前平台：
```bash
npm run dist
```
- 全平台打包：
```bash
npm run dist:all
```
- 指定平台/架构（示例）：
```bash
npm run dist:mac          # macOS 通用（含 x64/arm64）
npm run dist:mac:arm64
npm run dist:mac:x64
npm run dist:win          # Windows（含 nsis 安装包与 dir 解压版）
npm run dist:win:x64
npm run dist:win:ia32
npm run dist:win:arm64
npm run dist:linux        # Linux AppImage
npm run dist:linux:x64
npm run dist:linux:arm64
```
打包产物输出目录：`release/`


## 目录结构（摘录）
```
iTools/
├─ bin/                 # 各平台二进制（ffmpeg、whisper-cli 等）
├─ models/ggml/         # Whisper 模型文件（*.bin）
├─ renderer/            # 前端界面（React + Ant Design）
│  ├─ components/
│  │  └─ SubtitleExtractor.jsx  # 字幕提取页面
│  └─ app-renderer.js           # 渲染进程入口
├─ tools/subtitle/
│  └─ subtitle-processor.cjs    # 调用 ffmpeg/whisper 的核心逻辑
├─ utils/               # 平台/错误处理等工具
│  ├─ platform-manager.cjs
│  └─ error-handler.cjs
├─ electron-main.cjs    # Electron 主进程（IPC、菜单、日志等）
├─ electron-preload.js  # 预加载桥接（Renderer ⇄ Main IPC）
└─ package.json         # 脚本与构建配置（electron-builder）
```


## 使用说明（简要）
1) 启动应用后，选择 Whisper 模型与视频主要语言；
2) 选择“单语言”或“双语言”，双语可设定目标语言及上下顺序；
3) 选择视频文件后开始提取；
4) 处理完成后在原视频目录得到 `.srt` 文件。

命名规则：`{视频名}_{模型名去前缀}_{源语言}[_{目标语言}_{顺序}].srt`


## 故障排除（精选）
- 找不到二进制：确认 `bin/{platform}/` 下存在 ffmpeg 与 whisper-cli，并有执行权限
- 找不到模型：`models/ggml/` 下是否有对应 `.bin` 模型文件
- macOS 执行被阻止：可能为 Gatekeeper 或隔离属性导致，确保文件未被隔离且具备可执行位
- 日志位置：
  - macOS：`~/Library/Logs/iTools/`
  - Windows：`%APPDATA%/iTools/logs/`
  - Linux：`~/.config/iTools/logs/`


## MR 日志

合入时间：2025-08-17

本次合入功能（分支 auto-gen-subtitles）：
- 提供本地离线字幕生成能力（Whisper + FFmpeg），输出标准 SRT。
- 支持模型选择（ggml 系列）与视频主要语言选择。
- 支持双语字幕及显示顺序切换（主语言在上/目标语言在上）。
- 进度可视化：音频提取与识别阶段实时进度展示。
- 快捷键：Cmd/Ctrl + O 选择视频；Cmd/Ctrl + Enter 开始提取。
- 已有结果复用：自动检测相同参数生成的字幕是否已存在，避免重复处理。
- 跨平台适配：平台二进制定位与权限校验、基础错误日志与导出。
- 打包配置：提供 macOS（dmg）/ Windows（nsis/dir）/ Linux（AppImage）的构建脚本。

合入影响：
- 新增字幕提取 UI 与主进程 IPC；完善平台初始化与日志记录。
- 完全离线运行；需按 README 准备模型与二进制后使用。

验证建议：
- 在 macOS/Windows/Linux 各完成一次端到端测试；验证双语与顺序、重复检测、打包产物可运行。


## Release 安装包适用平台
在 Release 页面中提供的安装包适用于以下平台：

- **macOS**：
  - 如果您使用的是 Apple Silicon（M1/M2 等芯片）的 Mac，请下载：`iTools-1.0.0-arm64.dmg`
  - 如果您使用的是 Intel 芯片的 Mac，请下载：`iTools-1.0.0.dmg`
- **Windows**：
  - 如果您的电脑是 64 位系统，请下载：`iTools-1.0.0-x64.exe`
  - 如果您的电脑是 32 位系统，请下载：`iTools-1.0.0-ia32.exe`
  - 如果您的电脑是 ARM 架构，请下载：`iTools-1.0.0-arm64.exe`
  - 如果您不想安装，可以下载解压版（无需安装）：`iTools-1.0.0-win32-x64.zip` 等
- **Linux（暂未提供）**：
  - 如果您使用的是 64 位系统，请下载：`iTools-1.0.0-x64.AppImage`
  - 如果您使用的是 ARM 架构，请下载：`iTools-1.0.0-arm64.AppImage`

**注意**：
- macOS 用户可能需要在“系统偏好设置 > 安全性与隐私”中允许运行。
- Windows 用户请确保安装包未被防病毒软件误报。
- Linux 用户需赋予 AppImage 文件可执行权限：
  ```bash
  chmod +x iTools-1.0.0-x64.AppImage
  ```


## 许可证
MIT（详见 `LICENSE`）。