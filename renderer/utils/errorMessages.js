// 错误消息映射
export const ERROR_MESSAGES = {
  FFMPEG_NOT_FOUND: 'FFmpeg 程序未找到，请检查安装',
  WHISPER_NOT_FOUND: 'Whisper 程序未找到，请检查安装',
  MODEL_NOT_FOUND: '模型文件未找到，请先下载模型',
  VIDEO_NOT_FOUND: '视频文件不存在或无法访问',
  AUDIO_EXTRACT_FAILED: '音频提取失败，请检查视频文件格式',
  SUBTITLE_GENERATE_FAILED: '字幕生成失败，请尝试其他模型',
  PERMISSION_DENIED: '权限不足，请检查文件访问权限',
  INSUFFICIENT_MEMORY: '内存不足，请关闭其他应用或选择较小的模型',
  NETWORK_ERROR: '网络错误，请检查网络连接',
  UNKNOWN_ERROR: '未知错误，请重试'
};

// 根据错误信息返回用户友好的提示
export function getUserFriendlyError(error) {
  const message = error.message || error.toString();
  
  if (message.includes('ffmpeg')) {
    return ERROR_MESSAGES.FFMPEG_NOT_FOUND;
  }
  if (message.includes('whisper')) {
    return ERROR_MESSAGES.WHISPER_NOT_FOUND;
  }
  if (message.includes('model') || message.includes('ggml')) {
    return ERROR_MESSAGES.MODEL_NOT_FOUND;
  }
  if (message.includes('ENOENT') || message.includes('not found')) {
    return ERROR_MESSAGES.VIDEO_NOT_FOUND;
  }
  if (message.includes('permission') || message.includes('EACCES')) {
    return ERROR_MESSAGES.PERMISSION_DENIED;
  }
  if (message.includes('memory') || message.includes('OOM')) {
    return ERROR_MESSAGES.INSUFFICIENT_MEMORY;
  }
  if (message.includes('network') || message.includes('timeout')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  return message || ERROR_MESSAGES.UNKNOWN_ERROR;
}
