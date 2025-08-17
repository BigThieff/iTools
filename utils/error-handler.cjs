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
      
      console.log(`[ErrorHandler] 日志目录初始化成功: ${this.logDir}`);
    } catch (err) {
      console.error('日志目录初始化失败:', err.message);
      // 即使失败，也尝试使用系统临时目录作为最后的备用
      try {
        const os = require('os');
        this.logDir = path.join(os.tmpdir(), 'itools-fallback-logs');
        this.ensureLogDir();
        console.log(`[ErrorHandler] 使用备用日志目录: ${this.logDir}`);
      } catch (fallbackErr) {
        console.error('备用日志目录也失败:', fallbackErr.message);
        this.logDir = null;
      }
      this.initialized = true; // 标记为已初始化，避免重复尝试
    }
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    if (!this.logDir) {
      throw new Error('日志目录路径未设置');
    }
    
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`[ErrorHandler] 创建日志目录: ${this.logDir}`);
      }
      
      // 验证目录是否可写
      const testFile = path.join(this.logDir, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(`[ErrorHandler] 日志目录可写: ${this.logDir}`);
      
    } catch (err) {
      // 如果无法创建日志目录，回退到临时目录
      console.warn('无法创建日志目录:', err.message);
      const os = require('os');
      const fallbackDir = path.join(os.tmpdir(), 'itools-logs-fallback');
      
      try {
        if (!fs.existsSync(fallbackDir)) {
          fs.mkdirSync(fallbackDir, { recursive: true });
        }
        this.logDir = fallbackDir;
        console.log(`[ErrorHandler] 使用备用日志目录: ${this.logDir}`);
      } catch (fallbackErr) {
        console.error('无法创建备用日志目录:', fallbackErr.message);
        // 完全禁用文件日志记录
        this.logDir = null;
        throw new Error('无法创建任何日志目录');
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
    
    // 通用错误处理
    if (errorText.includes('error -86') || error.code === -86 || errorText.includes('spawn unknown system error -86')) {
      userMessage += 'macOS 安全限制错误。系统阻止了未签名二进制文件的执行。请在系统设置 → 隐私与安全性中允许应用运行，或重启应用尝试自动修复。';
    }
    // 权限相关错误
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
   * 检查日志系统状态
   */
  getLogStatus() {
    const fs = require('fs');
    
    if (!this.initialized) {
      return {
        status: 'not-initialized',
        logDir: null,
        exists: false,
        writable: false,
        logFiles: 0
      };
    }
    
    if (!this.logDir) {
      return {
        status: 'no-directory',
        logDir: null,
        exists: false,
        writable: false,
        logFiles: 0
      };
    }
    
    const exists = fs.existsSync(this.logDir);
    let writable = false;
    let logFiles = 0;
    
    if (exists) {
      try {
        // 测试写入权限
        const testFile = path.join(this.logDir, '.write-test-status');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        writable = true;
        
        // 统计日志文件
        const files = fs.readdirSync(this.logDir);
        logFiles = files.filter(file => file.endsWith('.log')).length;
      } catch (error) {
        // 写入测试失败
      }
    }
    
    return {
      status: exists && writable ? 'ok' : 'error',
      logDir: this.logDir,
      exists,
      writable,
      logFiles
    };
  }

  /**
   * 导出所有日志文件为 ZIP
   */
  async exportLogs(exportPath) {
    const fs = require('fs');
    const path = require('path');
    const { execFile } = require('child_process');
    const os = require('os');

    // 确保已初始化
    if (!this.initialized) {
      await this.initialize();
    }

    // 检查日志目录
    if (!this.logDir) {
      throw new Error('日志目录未初始化或初始化失败');
    }
    
    if (!fs.existsSync(this.logDir)) {
      throw new Error(`日志目录不存在: ${this.logDir}`);
    }

    console.log(`[ErrorHandler] 开始导出日志，目录: ${this.logDir}`);

    // 获取所有日志文件
    let logFiles;
    try {
      const allFiles = fs.readdirSync(this.logDir);
      logFiles = allFiles
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(this.logDir, file));
        
      console.log(`[ErrorHandler] 找到日志文件: ${logFiles.length} 个`);
      console.log(`[ErrorHandler] 日志文件列表:`, allFiles);
    } catch (readErr) {
      throw new Error(`无法读取日志目录: ${readErr.message}`);
    }

    if (logFiles.length === 0) {
      // 即使没有日志文件，也创建一个包含系统信息的导出
      console.log(`[ErrorHandler] 没有找到日志文件，创建空导出`);
    }

    // 创建临时目录
    const tempDir = path.join(os.tmpdir(), `itools-export-${Date.now()}`);
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`[ErrorHandler] 创建临时目录: ${tempDir}`);
    } catch (tempErr) {
      throw new Error(`无法创建临时目录: ${tempErr.message}`);
    }

    try {
      // 复制日志文件到临时目录
      logFiles.forEach(logFile => {
        try {
          const fileName = path.basename(logFile);
          const tempFile = path.join(tempDir, fileName);
          fs.copyFileSync(logFile, tempFile);
          console.log(`[ErrorHandler] 复制日志文件: ${fileName}`);
        } catch (copyErr) {
          console.warn(`[ErrorHandler] 复制文件失败 ${logFile}:`, copyErr.message);
        }
      });

      // 添加系统信息文件
      const systemInfo = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        timestamp: new Date().toISOString(),
        logDir: this.logDir,
        exportPath: exportPath,
        logFilesFound: logFiles.length,
        logFilesList: logFiles.map(f => path.basename(f))
      };
      
      try {
        fs.writeFileSync(
          path.join(tempDir, 'system-info.json'),
          JSON.stringify(systemInfo, null, 2)
        );
        console.log(`[ErrorHandler] 创建系统信息文件`);
      } catch (infoErr) {
        console.warn(`[ErrorHandler] 创建系统信息文件失败:`, infoErr.message);
      }

      // 验证导出路径目录存在
      const exportDir = path.dirname(exportPath);
      if (!fs.existsSync(exportDir)) {
        try {
          fs.mkdirSync(exportDir, { recursive: true });
          console.log(`[ErrorHandler] 创建导出目录: ${exportDir}`);
        } catch (dirErr) {
          throw new Error(`无法创建导出目录: ${dirErr.message}`);
        }
      }

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

        console.log(`[ErrorHandler] 执行压缩命令: ${zipCommand} ${zipArgs.join(' ')}`);

        const zipProcess = execFile(zipCommand, zipArgs, {
          cwd: process.platform === 'win32' ? undefined : tempDir,
          timeout: 30000
        }, (error, stdout, stderr) => {
          console.log(`[ErrorHandler] 压缩命令完成`);
          if (stdout) console.log(`[ErrorHandler] 压缩输出:`, stdout);
          if (stderr) console.log(`[ErrorHandler] 压缩错误:`, stderr);
          
          // 清理临时目录
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log(`[ErrorHandler] 清理临时目录: ${tempDir}`);
          } catch (cleanupError) {
            console.warn('清理临时目录失败:', cleanupError.message);
          }

          if (error) {
            console.error(`[ErrorHandler] 压缩失败:`, error);
            reject(new Error(`创建压缩包失败: ${error.message}`));
          } else {
            // 验证导出文件是否存在
            if (fs.existsSync(exportPath)) {
              const stats = fs.statSync(exportPath);
              console.log(`[ErrorHandler] 导出成功，文件大小: ${stats.size} 字节`);
              resolve();
            } else {
              reject(new Error('压缩包创建后文件不存在'));
            }
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
