const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// 生成规范化字幕文件名
function getSubtitleFileName(videoPath, modelName, language, targetLang) {
  const { name, dir } = path.parse(videoPath);
  // 清理模型名称（去掉 ggml- 前缀和 .bin 后缀）
  const cleanModelName = modelName.replace(/^ggml-/, '').replace('.bin', '');
  let fileName = `${name}_${cleanModelName}_${language}`;
  if (targetLang) fileName += `_${targetLang}`;
  fileName += '.srt';
  return path.join(dir, fileName);
}

// 检查字幕文件是否存在
function checkSubtitleExists(videoPath, modelName, language, targetLang) {
  try {
    console.log('检查字幕存在 - 输入参数:', { videoPath, modelName, language, targetLang });
    
    const subtitlePath = getSubtitleFileName(videoPath, modelName, language, targetLang);
    console.log('生成的字幕文件路径:', subtitlePath);
    
    const exists = fs.existsSync(subtitlePath);
    console.log('字幕文件存在状态:', exists);
    
    // 如果文件存在，显示文件信息
    if (exists) {
      const stats = fs.statSync(subtitlePath);
      console.log('字幕文件信息:', {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
    }
    
    return exists;
  } catch (error) {
    console.error('检查字幕文件失败:', error.message);
    return false;
  }
}

// 列出模型文件
function listModels() {
  const modelsPath = path.join(__dirname, '../../models/ggml');
  if (!fs.existsSync(modelsPath)) {
    return [];
  }
  return fs.readdirSync(modelsPath).filter(file => file.endsWith('.bin'));
}

// 获取资源路径
function getResourcePath(...pathSegments) {
  return path.join(__dirname, '../../', ...pathSegments);
}

// 检查资源是否存在
function checkResources(ffmpeg, WHISPER_BIN, WHISPER_MODEL) {
  if (!fs.existsSync(ffmpeg)) throw new Error(`找不到 ffmpeg: ${ffmpeg}`);
  if (!fs.existsSync(WHISPER_BIN)) throw new Error(`找不到 whisper-cli: ${WHISPER_BIN}`);
  if (!fs.existsSync(WHISPER_MODEL)) throw new Error(`找不到模型文件: ${WHISPER_MODEL}`);
}

// 提取音频
function extractAudio(ffmpeg, videoPath, wavPath) {
  return new Promise((resolve, reject) => {
    console.log('开始提取音频:', videoPath, '->', wavPath);
    execFile(ffmpeg, ['-y', '-i', videoPath, '-ac', '1', '-ar', '16000', wavPath], (err, stdout, stderr) => {
      if (err) {
        console.error('音频提取失败:', stderr || err.message);
        reject(new Error(`音频提取失败: ${stderr || err.message}`));
      } else {
        console.log('音频提取成功:', wavPath);
        resolve();
      }
    });
  });
}

// 生成字幕
function generateSubtitle(WHISPER_BIN, wavPath, WHISPER_MODEL, language, outputFile) {
  return new Promise((resolve, reject) => {
    console.log('开始生成字幕:', wavPath, '->', outputFile);
    execFile(WHISPER_BIN, [
      '-f', wavPath, '-osrt', '--model', WHISPER_MODEL, '-l', language, '--output-file', outputFile
    ], (err, stdout, stderr) => {
      if (err) {
        console.error('字幕生成失败:', stderr || err.message);
        reject(new Error(`字幕生成失败: ${stderr || err.message}`));
      } else {
        console.log('字幕生成成功:', outputFile);
        resolve();
      }
    });
  });
}

// 主要的字幕提取函数
async function extractSubtitle(videoPath, options = {}) {
  console.log('提取字幕开始，参数:', videoPath, options);
  
  try {
    const {
      modelName = 'ggml-small.bin',
      language = 'zh',
      dual = false,
      targetLang = 'en',
    } = options;

    // 使用统一的文件命名规则
    const outputFile = getSubtitleFileName(videoPath, modelName, language, dual ? targetLang : undefined);
    console.log('目标输出文件:', outputFile);

    // 资源路径
    const ffmpeg = getResourcePath('bin', 'ffmpeg');
    const WHISPER_BIN = getResourcePath('bin', 'whisper-cli');
    const WHISPER_MODEL = getResourcePath('models', 'ggml', modelName);

    console.log('资源路径:', { ffmpeg, WHISPER_BIN, WHISPER_MODEL });

    // 检查资源
    checkResources(ffmpeg, WHISPER_BIN, WHISPER_MODEL);

    // 生成临时音频文件路径
    const { name, dir } = path.parse(videoPath);
    const wavPath = path.join(dir, `${name}.wav`);

    // 提取音频
    await extractAudio(ffmpeg, videoPath, wavPath);

    // 生成字幕（注意：whisper-cli 输出时会自动加 .srt 后缀）
    const outputBaseName = outputFile.replace('.srt', '');
    await generateSubtitle(WHISPER_BIN, wavPath, WHISPER_MODEL, language, outputBaseName);

    // 检查输出文件
    if (fs.existsSync(outputFile)) {
      console.log('字幕文件生成成功:', outputFile);
      // 清理临时音频文件
      if (fs.existsSync(wavPath)) {
        fs.unlinkSync(wavPath);
      }
      return outputFile;
    } else {
      throw new Error('字幕生成失败（未找到输出文件）');
    }
  } catch (e) {
    console.error('提取字幕失败:', e.message);
    throw e;
  }
}

module.exports = {
  extractSubtitle,
  checkSubtitleExists,
  listModels,
  getSubtitleFileName,
};