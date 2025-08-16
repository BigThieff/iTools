const path = require('path');
const fs = require('fs');

class ErrorHandler {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.maxLogFiles = 7;
    this.maxLogSize = 10 * 1024 * 1024;
    this.ensureLogDir();
    this.cleanOldLogs();
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // 清理旧日志文件
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files.filter(file => file.startsWith('itools-') && file.endsWith('.log'));
      const sortedFiles = logFiles.sort((a, b) => b.localeCompare(a));
      
      if (sortedFiles.length > this.maxLogFiles) {
        const filesToDelete = sortedFiles.slice(this.maxLogFiles);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(path.join(this.logDir, file));
          } catch (err) {
            // 忽略删除错误
          }
        });
      }
    } catch (err) {
      // 忽略清理错误
    }
  }

  // 检查日志轮转
  checkLogRotation(logFile) {
    try {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.maxLogSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFile = logFile.replace('.log', `-${timestamp}.log`);
          fs.renameSync(logFile, backupFile);
        }
      }
    } catch (err) {
      // 忽略轮转错误
    }
  }

  writeLog(level, message, error = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : null,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    };

    const logFile = path.join(this.logDir, `itools-${new Date().toISOString().split('T')[0]}.log`);
    this.checkLogRotation(logFile);
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(logFile, logLine);
    } catch (err) {
      // 忽略写入错误
    }
  }

  formatUserError(error, context = '') {
    const baseMessage = context ? `${context}: ` : '';
    
    const errorMappings = {
      'ENOENT': '文件或目录不存在',
      'EACCES': '权限不足，请以管理员身份运行',
      'EMFILE': '打开文件过多，请关闭一些应用程序',
      'ENOTDIR': '路径不是目录',
      'EISDIR': '路径是目录而非文件',
      'EEXIST': '文件已存在',
      'EBUSY': '文件被占用，请关闭相关程序',
      'ETIMEDOUT': '操作超时，请检查网络连接'
    };

    let userMessage = baseMessage;
    
    if (error.code && errorMappings[error.code]) {
      userMessage += errorMappings[error.code];
    } else if (error.message.includes('whisper-cli')) {
      userMessage += 'Whisper CLI 执行失败，请检查二进制文件是否存在且有执行权限';
    } else if (error.message.includes('ffmpeg')) {
      userMessage += 'FFmpeg 执行失败，请检查二进制文件是否存在且有执行权限';
    } else if (error.message.includes('模型文件')) {
      userMessage += '模型文件缺失，请下载相应的 Whisper 模型文件';
    } else {
      userMessage += error.message;
    }

    return userMessage;
  }

  handleIpcError(error, operation, details = {}) {
    this.writeLog('error', `IPC operation failed: ${operation}`, error);
    
    return {
      success: false,
      error: this.formatUserError(error, operation),
      details: {
        operation,
        timestamp: new Date().toISOString(),
        ...details
      }
    };
  }

  handleSubtitleError(error, videoPath, options = {}) {
    const operation = '字幕提取';
    this.writeLog('error', `Subtitle extraction failed for: ${videoPath}`, error);
    
    return this.handleIpcError(error, operation, { videoPath, options });
  }

  logSuccess(operation, details = {}) {
    this.writeLog('info', `Operation succeeded: ${operation}`, null);
  }

  logWarning(message, details = {}) {
    this.writeLog('warning', message, null);
  }
}

module.exports = ErrorHandler;
