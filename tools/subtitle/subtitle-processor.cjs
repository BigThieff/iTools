const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const PlatformManager = require('../../utils/platform-manager.cjs');

const platformManager = new PlatformManager();

function getSubtitleFileName(videoPath, modelName, language, targetLang, subtitleOrder = 'main-first') {
  const { name, dir } = path.parse(videoPath);
  const cleanModelName = modelName.replace(/^ggml-/, '').replace('.bin', '');
  let fileName = `${name}_${cleanModelName}_${language}`;
  
  if (targetLang) {
    fileName += `_${targetLang}_${subtitleOrder}`;
  }
  
  fileName += '.srt';
  return path.join(dir, fileName);
}

function checkSubtitleExists(videoPath, modelName, language, targetLang, subtitleOrder = 'main-first') {
  try {
    const subtitlePath = getSubtitleFileName(videoPath, modelName, language, targetLang, subtitleOrder);
    const exists = fs.existsSync(subtitlePath);
    return exists;
  } catch (error) {
    return false;
  }
}

function listModels() {
  const modelsPath = getResourcePath('models', 'ggml');
  
  console.log(`[SubtitleProcessor] 查找模型目录: ${modelsPath}`);
  
  if (!fs.existsSync(modelsPath)) {
    console.log(`[SubtitleProcessor] 模型目录不存在: ${modelsPath}`);
    return [];
  }
  
  const models = fs.readdirSync(modelsPath).filter(file => file.endsWith('.bin'));
  console.log(`[SubtitleProcessor] 找到模型文件: ${models}`);
  return models;
}

async function getBinaryPaths() {
  const ffmpeg = await platformManager.getBinaryPath('ffmpeg');
  const whisperCli = await platformManager.getBinaryPath('whisper-cli');
  
  await platformManager.ensureBinaryPermissions(ffmpeg);
  await platformManager.ensureBinaryPermissions(whisperCli);
  
  return { ffmpeg, whisperCli };
}

function getResourcePath(...pathSegments) {
  // 检测是否在打包环境中
  const isPackaged = process.resourcesPath && 
                    !process.resourcesPath.includes('node_modules') &&
                    process.resourcesPath.includes('Contents/Resources');
  
  let basePath;
  if (isPackaged) {
    // 在打包环境中，extraResources 位于 process.resourcesPath
    basePath = process.resourcesPath;
    console.log(`[SubtitleProcessor] 使用打包模式资源路径: ${basePath}`);
  } else {
    // 在开发环境中，使用相对路径
    basePath = path.join(__dirname, '../../');
    console.log(`[SubtitleProcessor] 使用开发模式资源路径: ${basePath}`);
  }
  
  const fullPath = path.join(basePath, ...pathSegments);
  console.log(`[SubtitleProcessor] 构建资源路径: ${fullPath}`);
  return fullPath;
}

async function checkResources(ffmpeg, whisperBin, whisperModel) {
  console.log(`[SubtitleProcessor] 开始资源检查`);
  console.log(`[SubtitleProcessor] FFmpeg 路径: ${ffmpeg}`);
  console.log(`[SubtitleProcessor] Whisper 路径: ${whisperBin}`);
  console.log(`[SubtitleProcessor] 模型路径: ${whisperModel}`);
  
  console.log(`[SubtitleProcessor] 设置 FFmpeg 权限...`);
  const ffmpegPermissionSet = await platformManager.ensureBinaryPermissions(ffmpeg);
  if (!ffmpegPermissionSet) {
    const error = `FFmpeg 权限设置失败: ${ffmpeg}`;
    console.error(`[SubtitleProcessor] ${error}`);
    throw new Error(error);
  }
  console.log(`[SubtitleProcessor] FFmpeg 权限设置成功`);
  
  console.log(`[SubtitleProcessor] 设置 Whisper 权限...`);
  const whisperPermissionSet = await platformManager.ensureBinaryPermissions(whisperBin);
  if (!whisperPermissionSet) {
    const error = `Whisper CLI 权限设置失败: ${whisperBin}`;
    console.error(`[SubtitleProcessor] ${error}`);
    throw new Error(error);
  }
  console.log(`[SubtitleProcessor] Whisper 权限设置成功`);
  
  console.log(`[SubtitleProcessor] 验证 FFmpeg...`);
  if (!await platformManager.validateBinary(ffmpeg)) {
    const error = `FFmpeg 二进制文件验证失败: ${ffmpeg}。请检查文件是否存在且有执行权限`;
    console.error(`[SubtitleProcessor] ${error}`);
    throw new Error(error);
  }
  console.log(`[SubtitleProcessor] FFmpeg 验证通过`);
  
  console.log(`[SubtitleProcessor] 验证 Whisper...`);
  if (!await platformManager.validateBinary(whisperBin)) {
    const error = `Whisper CLI 二进制文件验证失败: ${whisperBin}。请检查文件是否存在且有执行权限`;
    console.error(`[SubtitleProcessor] ${error}`);
    throw new Error(error);
  }
  console.log(`[SubtitleProcessor] Whisper 验证通过`);
  
  console.log(`[SubtitleProcessor] 检查模型文件...`);
  if (!fs.existsSync(whisperModel)) {
    const error = `找不到模型文件: ${whisperModel}`;
    console.error(`[SubtitleProcessor] ${error}`);
    throw new Error(error);
  }
  console.log(`[SubtitleProcessor] 模型文件存在`);
  
  console.log(`[SubtitleProcessor] 所有资源检查通过`);
}

function extractAudio(ffmpeg, videoPath, wavPath) {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: 600000,
      maxBuffer: 200 * 1024 * 1024,
      killSignal: 'SIGKILL'
    };

    const args = ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', wavPath];
    execFile(ffmpeg, args, options, (err, stdout, stderr) => {
      if (err) {
        if (err.killed && err.signal === 'SIGKILL') {
          reject(new Error(`音频提取超时 (${options.timeout/1000}秒)，建议使用较短的视频片段`));
        } else {
          reject(new Error(`音频提取失败: ${stderr || err.message}`));
        }
      } else {
        resolve();
      }
    });
  });
}

function generateSubtitle(whisperBin, wavPath, whisperModel, language, outputFile) {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: 1200000,
      maxBuffer: 500 * 1024 * 1024,
      killSignal: 'SIGKILL'
    };

    execFile(whisperBin, [
      '-f', wavPath, '-osrt', '--model', whisperModel, '-l', language, '--output-file', outputFile
    ], options, (err, stdout, stderr) => {
      if (err) {
        if (err.killed && err.signal === 'SIGKILL') {
          reject(new Error(`语音识别超时 (${options.timeout/1000}秒)，建议使用较小的模型或分割视频为较短片段`));
        } else {
          reject(new Error(`字幕生成失败: ${stderr || err.message}`));
        }
      } else {
        resolve();
      }
    });
  });
}

async function extractSubtitle(videoPath, options = {}, progressCallback = null) {
  try {
    const {
      modelName = 'ggml-small.bin',
      language = 'zh',
      dual = false,
      targetLang = 'en',
      subtitleOrder = 'main-first',
    } = options;

    if (progressCallback) progressCallback({ stage: 'init', progress: 0 });

    const outputFile = getSubtitleFileName(videoPath, modelName, language, dual ? targetLang : undefined, subtitleOrder);

    const { ffmpeg, whisperCli } = await getBinaryPaths();
    const whisperModel = getResourcePath('models', 'ggml', modelName);

    await checkResources(ffmpeg, whisperCli, whisperModel);

    // 基础进度：音频 10% -> 50%
    if (progressCallback) progressCallback({ stage: 'audio', progress: 10 });
    const { name, dir } = path.parse(videoPath);
    const wavPath = path.join(dir, `${name}.wav`);
    await extractAudio(ffmpeg, videoPath, wavPath);
    if (progressCallback) progressCallback({ stage: 'audio', progress: 50 });

    // 基础进度：识别 50% -> 90%
    if (progressCallback) progressCallback({ stage: 'whisper', progress: 50 });
    const outputBaseName = outputFile.replace('.srt', '');
    await generateSubtitle(whisperCli, wavPath, whisperModel, language, outputBaseName);
    if (progressCallback) progressCallback({ stage: 'whisper', progress: 90 });

    // 完成 100%
    if (progressCallback) progressCallback({ stage: 'finish', progress: 100 });

    if (fs.existsSync(outputFile)) {
      if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
      return outputFile;
    } else {
      throw new Error('字幕生成失败（未找到输出文件）');
    }
  } catch (error) {
    throw error;
  }
}

module.exports = {
  extractSubtitle,
  checkSubtitleExists,
  listModels,
  getSubtitleFileName,
};