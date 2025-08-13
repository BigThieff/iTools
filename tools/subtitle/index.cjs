const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// 工具函数
function getResourcePath(...segments) {
  return path.join(__dirname, '..', '..', ...segments);
}

// 提取字幕主函数
async function extractSubtitle(videoPath, options = {}) {
  try {
    const {
      modelName = 'ggml-small.bin',
      language = 'zh',
      dual = false,
      targetLang = 'en'
    } = options;

    // 路径和文件名处理
    const baseName = path.basename(videoPath, path.extname(videoPath));
    const dirName = path.dirname(videoPath);
    const safeName = baseName.replace(/（/g, '(').replace(/）/g, ')').replace(/ /g, '_');
    const wavPath = path.join(dirName, `${baseName}.wav`);
    const outputFile = path.join(dirName, `${safeName}_sub`);

    // 资源路径
    const ffmpeg = getResourcePath('bin', 'ffmpeg');
    const WHISPER_BIN = getResourcePath('bin', 'whisper-cli');
    const WHISPER_MODEL = getResourcePath('models','ggml', modelName);

    // 检查资源
    checkResources(ffmpeg, WHISPER_BIN, WHISPER_MODEL);

    // 提取音频
    await extractAudio(ffmpeg, videoPath, wavPath);

    // 生成主语言字幕
    await generateSubtitle(WHISPER_BIN, wavPath, WHISPER_MODEL, language, outputFile);

    // 如果启用双语言模式
    if (dual) {
      const dualOutputFile = await generateDualSubtitle(
        WHISPER_BIN,
        wavPath,
        WHISPER_MODEL,
        targetLang,
        outputFile,
        dirName,
        safeName,
        options.subtitleOrder // 新增参数
      );
      return dualOutputFile;
    }

    // 检查输出
    if (fs.existsSync(`${outputFile}.srt`)) {
      return `${outputFile}.srt`;
    } else {
      throw new Error('字幕生成失败（未找到输出文件）');
    }
  } catch (e) {
    throw e;
  }
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
    execFile(ffmpeg, ['-y', '-i', videoPath, '-ac', '1', '-ar', '16000', wavPath], (err, stdout, stderr) => {
      if (err) reject(new Error(`音频提取失败: ${stderr || err.message}`));
      else resolve();
    });
  });
}

// 生成字幕
function generateSubtitle(WHISPER_BIN, wavPath, WHISPER_MODEL, language, outputFile) {
  return new Promise((resolve, reject) => {
    execFile(WHISPER_BIN, [
      '-f', wavPath, '-osrt', '--model', WHISPER_MODEL, '-l', language, '--output-file', outputFile
    ], (err, stdout, stderr) => {
      if (err) reject(new Error(`字幕生成失败: ${stderr || err.message}`));
      else resolve();
    });
  });
}

// 生成双语言字幕
async function generateDualSubtitle(WHISPER_BIN, wavPath, WHISPER_MODEL, targetLang, outputFile, dirName, safeName, subtitleOrder) {
  console.log('生成双语言字幕的参数：', {
    WHISPER_BIN,
    wavPath,
    WHISPER_MODEL,
    targetLang,
    outputFile,
    subtitleOrder,
  });

  const targetOutputFile = path.join(dirName, `${safeName}_sub_target`);
  await generateSubtitle(WHISPER_BIN, wavPath, WHISPER_MODEL, targetLang, targetOutputFile);

  const dualOutputFile = `${outputFile}.dual.srt`;
  const mainSubtitles = fs.readFileSync(`${outputFile}.srt`, 'utf-8').split('\n');
  const targetSubtitles = fs.readFileSync(`${targetOutputFile}.srt`, 'utf-8').split('\n');

  const mergedSubtitles = mainSubtitles.map((line, index) => {
    const targetLine = targetSubtitles[index] || '';
    if (subtitleOrder === 'main-first') {
      return `${line}\n${targetLine}`;
    } else {
      return `${targetLine}\n${line}`;
    }
  }).join('\n');

  fs.writeFileSync(dualOutputFile, mergedSubtitles, 'utf-8');
  return dualOutputFile; // 确保返回双语言字幕路径
}

module.exports = { extractSubtitle };