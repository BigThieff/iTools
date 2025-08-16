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
  if (!await platformManager.validateBinary(ffmpeg)) {
    throw new Error(`FFmpeg 二进制文件验证失败: ${ffmpeg}`);
  }
  
  if (!await platformManager.validateBinary(whisperBin)) {
    throw new Error(`Whisper CLI 二进制文件验证失败: ${whisperBin}`);
  }
  
  if (!fs.existsSync(whisperModel)) {
    throw new Error(`找不到模型文件: ${whisperModel}`);
  }
}

function extractAudio(ffmpeg, videoPath, wavPath) {
  return new Promise((resolve, reject) => {
    execFile(ffmpeg, ['-y', '-i', videoPath, '-ac', '1', '-ar', '16000', wavPath], (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`音频提取失败: ${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
}

function generateSubtitle(whisperBin, wavPath, whisperModel, language, outputFile) {
  return new Promise((resolve, reject) => {
    execFile(whisperBin, [
      '-f', wavPath, '-osrt', '--model', whisperModel, '-l', language, '--output-file', outputFile
    ], (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`字幕生成失败: ${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
}

async function extractSubtitle(videoPath, options = {}) {
  try {
    const {
      modelName = 'ggml-small.bin',
      language = 'zh',
      dual = false,
      targetLang = 'en',
      subtitleOrder = 'main-first',
    } = options;

    const outputFile = getSubtitleFileName(videoPath, modelName, language, dual ? targetLang : undefined, subtitleOrder);

    const { ffmpeg, whisperCli } = await getBinaryPaths();
    const whisperModel = getResourcePath('models', 'ggml', modelName);

    await checkResources(ffmpeg, whisperCli, whisperModel);

    const { name, dir } = path.parse(videoPath);
    const wavPath = path.join(dir, `${name}.wav`);

    await extractAudio(ffmpeg, videoPath, wavPath);

    const outputBaseName = outputFile.replace('.srt', '');
    await generateSubtitle(whisperCli, wavPath, whisperModel, language, outputBaseName);

    if (fs.existsSync(outputFile)) {
      if (fs.existsSync(wavPath)) {
        fs.unlinkSync(wavPath);
      }
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