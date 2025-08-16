// 文件验证工具
export const FILE_VALIDATION = {
  // 最大文件大小限制 (MB)
  MAX_FILE_SIZE_MB: 500,
  
  // 支持的视频格式
  SUPPORTED_FORMATS: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v'],
  
  // 验证文件大小
  validateFileSize(filePath) {
    try {
      // 在实际应用中，这里应该调用后端API获取文件信息
      return { valid: true, size: 0 };
    } catch (error) {
      return { valid: false, error: '无法获取文件信息' };
    }
  },
  
  // 验证文件格式
  validateFileFormat(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    return this.SUPPORTED_FORMATS.includes(extension);
  },
  
  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

// 获取推荐的模型基于文件大小
export function getRecommendedModel(fileSizeMB) {
  if (fileSizeMB < 50) {
    return 'ggml-base.bin'; // 小文件用快速模型
  } else if (fileSizeMB < 200) {
    return 'ggml-small.bin'; // 中等文件用平衡模型
  } else {
    return 'ggml-medium.bin'; // 大文件用高质量模型
  }
}
