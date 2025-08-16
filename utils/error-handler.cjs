const path = require('path');
const fs = require('fs');

class ErrorHandler {
  constructor() {
    // 延迟初始化日志目录，避免在构造函数中调用 Electron API
    this.logDir = null;
    this.maxLogFiles = 7;
    this.maxLogSize = 10 * 1024 * 1024;
    this.initialized = false;
    
    // 延迟初始化，在第一次使用时才设置日志目录
    this.initPromise = null;
  }

  /**
   * 延迟初始化日志目录
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // 尝试使用 Electron 的用户数据目录
      const { app } = require('electron');
      const os = require('os');
      
      if (app && app.isReady()) {
        // app 已经就绪，可以安全使用 getPath
        this.logDir = path.join(app.getPath('userData'), 'logs');
      } else if (app) {
        // app 存在但未就绪，使用临时目录作为备用
        console.warn('Electron app 未就绪，使用临时日志目录');
        this.logDir = path.join(os.tmpdir(), 'itools-logs');
      } else {
        // 开发环境或非 Electron 环境，使用临时目录
        this.logDir = path.join(os.tmpdir(), 'itools-logs');
      }
      
      this.ensureLogDir();
      this.cleanOldLogs();
      this.initialized = true;
    } catch (err) {
      console.error('日志目录初始化失败:', err.message);
      this.logDir = null;
      this.initialized = true; // 标记为已初始化，避免重复尝试
    }
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      // 如果无法创建日志目录，回退到临时目录
      console.warn('无法创建日志目录:', err.message);
      const os = require('os');
      this.logDir = path.join(os.tmpdir(), 'itools-logs');
      try {
        if (!fs.existsSync(this.logDir)) {
          fs.mkdirSync(this.logDir, { recursive: true });
        }
      } catch (fallbackErr) {
        console.error('无法创建备用日志目录:', fallbackErr.message);
        // 完全禁用文件日志记录
        this.logDir = null;
      }
    }
  }

  // 清理旧日志文件
  cleanOldLogs() {
    if (!this.logDir) return; // 如果日志目录不可用，跳过清理
    
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
    if (!this.logDir) return; // 如果日志目录不可用，跳过轮转
    
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
    // 确保已初始化
    if (!this.initialized) {
      this.initialize().catch(() => {}); // 异步初始化，不阻塞
    }

    // 如果日志目录不可用，只输出到控制台
    if (!this.logDir) {
      console.log(`[${level}] ${message}`, error ? error.message : '');
      return;
    }

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
      // 如果写入失败，输出到控制台
      console.log(`[${level}] ${message}`, error ? error.message : '');
      console.warn('日志写入失败:', err.message);
    }
  }

  formatUserError(error, context = '') {
    const baseMessage = context ? `${context}: ` : '';
    
    const errorMappings = {
      'ENOENT': '文件或目录不存在',
      'EACCES': '权限不足，请检查文件权限或以管理员身份运行',
      'EMFILE': '打开文件过多，请关闭一些应用程序',
      'ENOTDIR': '路径不是目录',
      'EISDIR': '路径是目录而非文件',
      'EEXIST': '文件已存在',
      'EBUSY': '文件被占用，请关闭相关程序',
      'ETIMEDOUT': '操作超时，请检查网络连接'
    };

    let userMessage = baseMessage;
    const errorText = error.message || error.toString();
    
    // macOS 特有错误：系统错误 -86
    if (errorText.includes('error -86') || error.code === -86 || errorText.includes('swpan unknown system error -86')) {
      userMessage += 'macOS 安全限制错误（错误代码 -86）。这是 Gatekeeper 阻止未签名应用的安全机制。\n\n解决方案（按顺序尝试）：\n\n1. 首次运行方法：\n   • 右键点击应用图标，选择"打开"\n   • 在弹出对话框中点击"打开"\n\n2. 如果隐私与安全性中找不到应用：\n   • 重启应用，让系统重新检测\n   • 或运行：sudo spctl --assess --verbose /Applications/iTools.app\n\n3. 临时解决方案：\n   • 终端运行：sudo spctl --master-disable\n   • 使用完毕后重新启用：sudo spctl --master-enable';
    }
    // 优先检查权限相关错误
    else if (errorText.includes('权限设置失败') || errorText.includes('权限不足') || error.code === 'EACCES') {
      userMessage += '二进制文件权限不足。请尝试：1) 重启应用，2) 检查安装目录权限，3) 以管理员身份运行应用';
    } else if (errorText.includes('二进制文件验证失败') && errorText.includes('权限')) {
      userMessage += '二进制文件缺少执行权限。应用将尝试自动修复权限，如果问题持续请重启应用';
    } else if (error.code && errorMappings[error.code]) {
      userMessage += errorMappings[error.code];
    } else if (errorText.includes('whisper-cli')) {
      userMessage += 'Whisper CLI 执行失败，请检查二进制文件是否存在且有执行权限';
    } else if (errorText.includes('ffmpeg')) {
      userMessage += 'FFmpeg 执行失败，请检查二进制文件是否存在且有执行权限';
    } else if (errorText.includes('模型文件')) {
      userMessage += '模型文件缺失，请下载相应的 Whisper 模型文件';
    } else {
      userMessage += errorText;
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

  /**
   * 获取日志目录路径
   */
  getLogDir() {
    return this.logDir;
  }

  /**
   * 导出所有日志文件为 ZIP
   */
  async exportLogs(exportPath) {
    const fs = require('fs');
    const path = require('path');
    const { execFile } = require('child_process');
    const os = require('os');

    if (!this.logDir || !fs.existsSync(this.logDir)) {
      throw new Error('日志目录不存在');
    }

    // 获取所有日志文件
    const logFiles = fs.readdirSync(this.logDir)
      .filter(file => file.endsWith('.log'))
      .map(file => path.join(this.logDir, file));

    if (logFiles.length === 0) {
      throw new Error('没有找到日志文件');
    }

    // 创建临时目录
    const tempDir = path.join(os.tmpdir(), `itools-export-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // 复制日志文件到临时目录
      logFiles.forEach(logFile => {
        const fileName = path.basename(logFile);
        const tempFile = path.join(tempDir, fileName);
        fs.copyFileSync(logFile, tempFile);
      });

      // 添加系统信息文件
      const systemInfo = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        timestamp: new Date().toISOString(),
        logDir: this.logDir,
        exportPath: exportPath
      };
      
      fs.writeFileSync(
        path.join(tempDir, 'system-info.json'),
        JSON.stringify(systemInfo, null, 2)
      );

      // 使用系统的 zip 命令创建压缩包
      return new Promise((resolve, reject) => {
        const zipCommand = process.platform === 'win32' ? 'powershell' : 'zip';
        let zipArgs;
        
        if (process.platform === 'win32') {
          zipArgs = [
            '-Command',
            `Compress-Archive -Path "${tempDir}\\*" -DestinationPath "${exportPath}"`
          ];
        } else {
          zipArgs = ['-r', exportPath, '.'];
        }

        const zipProcess = execFile(zipCommand, zipArgs, {
          cwd: process.platform === 'win32' ? undefined : tempDir,
          timeout: 30000
        }, (error, stdout, stderr) => {
          // 清理临时目录
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.warn('清理临时目录失败:', cleanupError.message);
          }

          if (error) {
            reject(new Error(`创建压缩包失败: ${error.message}`));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      // 清理临时目录
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('清理临时目录失败:', cleanupError.message);
      }
      throw error;
    }
  }

  /**
   * 清理所有日志文件
   */
  async cleanAllLogs() {
    const fs = require('fs');
    
    if (!this.logDir || !fs.existsSync(this.logDir)) {
      return;
    }

    const logFiles = fs.readdirSync(this.logDir)
      .filter(file => file.endsWith('.log'))
      .map(file => path.join(this.logDir, file));

    logFiles.forEach(logFile => {
      try {
        fs.unlinkSync(logFile);
      } catch (error) {
        console.warn(`删除日志文件失败: ${logFile}`, error.message);
      }
    });
  }
}

module.exports = ErrorHandler;
