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
  const modelsPath = path.join(__dirname, '../../models/ggml');
  
  if (!fs.existsSync(modelsPath)) {
    return [];
  }
  
  const models = fs.readdirSync(modelsPath).filter(file => file.endsWith('.bin'));
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
  const basePath = path.join(__dirname, '../../');
  const fullPath = path.join(basePath, ...pathSegments);
  return fullPath;
}

async function checkResources(ffmpeg, whisperBin, whisperModel) {
  console.log(`[SubtitleProcessor] 开始资源检查`);
  console.log(`[SubtitleProcessor] FFmpeg 路径: ${ffmpeg}`);
  console.log(`[SubtitleProcessor] Whisper 路径: ${whisperBin}`);
  console.log(`[SubtitleProcessor] 模型路径: ${whisperModel}`);
  
  // 首先确保二进制文件权限
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
  
  // 然后验证二进制文件
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

function extractAudio(ffmpeg, videoPath, wavPath, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: 600000, // 10分钟超时
      maxBuffer: 200 * 1024 * 1024, // 200MB 缓冲区
      killSignal: 'SIGKILL'
    };

    const process = execFile(ffmpeg, ['-y', '-i', videoPath, '-ac', '1', '-ar', '16000', wavPath], options, (err, stdout, stderr) => {
      if (err) {
        if (err.killed && err.signal === 'SIGKILL') {
          reject(new Error(`音频提取超时 (${options.timeout/1000}秒)，建议使用较短的视频片段`));
        } else {
          reject(new Error(`音频提取失败: ${stderr || err.message}`));
        }
      } else {
        if (progressCallback) progressCallback({ stage: 'audio', progress: 100 });
        resolve();
      }
    });

    // 监听进程状态和输出进度
    if (progressCallback) {
      let audioProgress = 0;
      const progressInterval = setInterval(() => {
        audioProgress = Math.min(audioProgress + Math.random() * 8 + 2, 95);
        progressCallback({ stage: 'audio', progress: audioProgress });
      }, 1000);
      
      process.on('close', () => clearInterval(progressInterval));
      process.on('error', () => clearInterval(progressInterval));
    }

    // 监听进程状态
    process.on('error', (err) => {
      reject(new Error(`FFmpeg 进程启动失败: ${err.message}`));
    });
  });
}

function generateSubtitle(whisperBin, wavPath, whisperModel, language, outputFile, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: 1200000, // 20分钟超时 (Whisper 处理时间较长)
      maxBuffer: 500 * 1024 * 1024, // 500MB 缓冲区
      killSignal: 'SIGKILL'
    };
    
    const process = execFile(whisperBin, [
      '-f', wavPath, '-osrt', '--model', whisperModel, '-l', language, '--output-file', outputFile
    ], options, (err, stdout, stderr) => {
      if (err) {
        if (err.killed && err.signal === 'SIGKILL') {
          reject(new Error(`语音识别超时 (${options.timeout/1000}秒)，建议使用较小的模型或分割视频为较短片段`));
        } else {
          reject(new Error(`字幕生成失败: ${stderr || err.message}`));
        }
      } else {
        if (progressCallback) progressCallback({ stage: 'whisper', progress: 100 });
        resolve();
      }
    });

    // 监听进程状态和输出进度
    if (progressCallback) {
      let whisperProgress = 0;
      const progressInterval = setInterval(() => {
        whisperProgress = Math.min(whisperProgress + Math.random() * 3 + 1, 95);
        progressCallback({ stage: 'whisper', progress: whisperProgress });
      }, 2000);
      
      process.on('close', () => clearInterval(progressInterval));
      process.on('error', () => clearInterval(progressInterval));
    }

    // 监听进程状态
    process.on('error', (err) => {
      reject(new Error(`Whisper CLI 进程启动失败: ${err.message}`));
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

    if (progressCallback) progressCallback({ stage: 'init', progress: 10 });

    const { name, dir } = path.parse(videoPath);
    const wavPath = path.join(dir, `${name}.wav`);

    // 音频提取阶段 (10% - 30%)
    if (progressCallback) progressCallback({ stage: 'audio', progress: 0 });
    await extractAudio(ffmpeg, videoPath, wavPath, (progress) => {
      if (progressCallback) {
        const mappedProgress = 10 + (progress.progress * 0.2); // 10-30%
        progressCallback({ stage: 'audio', progress: mappedProgress });
      }
    });

    // 语音识别阶段 (30% - 95%)
    if (progressCallback) progressCallback({ stage: 'whisper', progress: 30 });
    const outputBaseName = outputFile.replace('.srt', '');
    await generateSubtitle(whisperCli, wavPath, whisperModel, language, outputBaseName, (progress) => {
      if (progressCallback) {
        const mappedProgress = 30 + (progress.progress * 0.65); // 30-95%
        progressCallback({ stage: 'whisper', progress: mappedProgress });
      }
    });

    // 完成阶段 (95% - 100%)
    if (progressCallback) progressCallback({ stage: 'finish', progress: 95 });

    if (fs.existsSync(outputFile)) {
      if (fs.existsSync(wavPath)) {
        fs.unlinkSync(wavPath);
      }
      if (progressCallback) progressCallback({ stage: 'finish', progress: 100 });
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