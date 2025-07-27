const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

function getResourcePath(...segments) {
  return path.join(__dirname, '..', '..', ...segments);
}

/**
 * 提取字幕
 * @param {string} videoPath 视频文件路径
 * @param {Object} options 可选项
 * @param {string} [options.modelName='ggml-small.bin'] 模型文件名
 * @param {string} [options.language='zh'] 识别语言
 * @returns {Promise<string>} srt 文件路径
 */
async function extractSubtitle(videoPath, options = {}) {
  try {
    const {
      modelName = 'ggml-small.bin',
      language = 'zh'
    } = options;

    const baseName = path.basename(videoPath, path.extname(videoPath));
    const dirName = path.dirname(videoPath);
    const safeName = baseName.replace(/（/g, '(').replace(/）/g, ')').replace(/ /g, '_');
    const wavPath = path.join(dirName, `${baseName}.wav`);
    const outputFile = path.join(dirName, `${safeName}_sub`);

    const ffmpeg = getResourcePath('bin', 'ffmpeg');
    const WHISPER_BIN = getResourcePath('bin', 'whisper-cli');
    const WHISPER_MODEL = getResourcePath('models', modelName);

    // 检查可执行文件和模型
    if (!fs.existsSync(ffmpeg)) throw new Error(`找不到 ffmpeg: ${ffmpeg}`);
    if (!fs.existsSync(WHISPER_BIN)) throw new Error(`找不到 whisper-cli: ${WHISPER_BIN}`);
    if (!fs.existsSync(WHISPER_MODEL)) throw new Error(`找不到模型文件: ${WHISPER_MODEL}`);

    // 1. 提取音频
    await new Promise((resolve, reject) => {
      execFile(ffmpeg, ['-y', '-i', videoPath, '-ac', '1', '-ar', '16000', wavPath], (err, stdout, stderr) => {
        if (err) reject(new Error(`音频提取失败: ${stderr || err.message}`));
        else resolve();
      });
    });

    // 2. 调用 whisper-cli
    await new Promise((resolve, reject) => {
      execFile(WHISPER_BIN, [
        '-f', wavPath, '-osrt', '--model', WHISPER_MODEL, '-l', language, '--output-file', outputFile
      ], (err, stdout, stderr) => {
        if (err) reject(new Error(`字幕生成失败: ${stderr || err.message}`));
        else resolve();
      });
    });

    // 3. 检查输出
    if (fs.existsSync(`${outputFile}.srt`)) {
      return `${outputFile}.srt`;
    } else {
      throw new Error('字幕生成失败（未找到输出文件）');
    }
  } catch (e) {
    throw e;
  }
}

module.exports = { extractSubtitle };