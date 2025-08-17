const path = require('path');
const fs = require('fs');
const os = require('os');

class PlatformManager {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.isDev = process.env.NODE_ENV === 'development';
    
    // 在打包应用中，需要使用正确的资源路径
    if (this.isDev) {
      // 开发环境：使用项目根目录
      this.projectRoot = path.resolve(__dirname, '..');
    } else {
      // 生产环境：使用 extraResources 路径
      const { app } = require('electron');
      if (app && app.isPackaged) {
        // 打包后的应用，二进制文件在 extraResources 中
        // 在 macOS 中是 iTools.app/Contents/Resources/
        // 在 Windows/Linux 中是 resources/
        this.projectRoot = process.resourcesPath;
      } else {
        // 未打包的应用
        this.projectRoot = path.resolve(__dirname, '..');
      }
    }
    
    this.supportedPlatforms = this.getSupportedPlatforms();
    
    console.log(`[PlatformManager] 初始化 - 开发模式: ${this.isDev}, 项目根目录: ${this.projectRoot}`);
    console.log(`[PlatformManager] 是否已打包: ${require('electron').app ? require('electron').app.isPackaged : 'N/A'}`);
  }

  getSupportedPlatforms() {
    return {
      'darwin-arm64': {
        binaries: { 'ffmpeg': 'ffmpeg', 'whisper-cli': 'whisper-cli' },
        execPermission: '755',
        needsPermission: true
      },
      'darwin-x64': {
        binaries: { 'ffmpeg': 'ffmpeg', 'whisper-cli': 'whisper-cli' },
        execPermission: '755',
        needsPermission: true
      },
      'win32-x64': {
        binaries: { 'ffmpeg': 'ffmpeg.exe', 'whisper-cli': 'whisper-cli.exe' },
        execPermission: null,
        needsPermission: false
      },
      'win32-ia32': {
        binaries: { 'ffmpeg': 'ffmpeg.exe', 'whisper-cli': 'whisper-cli.exe' },
        execPermission: null,
        needsPermission: false
      },
      'linux-x64': {
        binaries: { 'ffmpeg': 'ffmpeg', 'whisper-cli': 'whisper-cli' },
        execPermission: '755',
        needsPermission: true
      },
      'linux-arm64': {
        binaries: { 'ffmpeg': 'ffmpeg', 'whisper-cli': 'whisper-cli' },
        execPermission: '755',
        needsPermission: true
      }
    };
  }

  /**
   * 获取当前平台架构标识
   */
  getPlatformArch() {
    return `${this.platform}-${this.arch}`;
  }

  async getBinaryPath(binaryName) {
    const platformArch = this.getPlatformArch();
    console.log(`[PlatformManager] 获取二进制路径: ${binaryName}, 平台: ${platformArch}`);
    
    if (!this.supportedPlatforms[platformArch]) {
      const error = `不支持的平台: ${platformArch}。支持的平台: ${Object.keys(this.supportedPlatforms).join(', ')}`;
      console.error(`[PlatformManager] ${error}`);
      throw new Error(error);
    }

    const platformConfig = this.supportedPlatforms[platformArch];
    const actualBinaryName = platformConfig.binaries[binaryName];
    
    if (!actualBinaryName) {
      const error = `在平台 ${platformArch} 上找不到二进制文件 '${binaryName}'`;
      console.error(`[PlatformManager] ${error}`);
      throw new Error(error);
    }
    
    // 检查是否为打包应用
    const { app } = require('electron');
    const isPackaged = app && app.isPackaged;
    
    // 多个可能的路径，按优先级排序
    let possiblePaths;
    
    if (isPackaged) {
      // 打包后应用的路径结构
      possiblePaths = [
        // extraResources 中的平台特定路径
        path.join(process.resourcesPath, 'bin', platformArch, actualBinaryName),
        // 备用路径（如果打包结构不同）
        path.join(process.resourcesPath, 'app', 'bin', platformArch, actualBinaryName),
        path.join(process.resourcesPath, platformArch, actualBinaryName)
      ];
    } else {
      // 开发环境路径
      possiblePaths = [
        path.join(this.projectRoot, 'bin', platformArch, actualBinaryName),
        path.join(this.projectRoot, 'bin', actualBinaryName)
      ];
    }

    console.log(`[PlatformManager] 是否打包: ${isPackaged}`);
    console.log(`[PlatformManager] 搜索路径:`, possiblePaths);

    for (const binaryPath of possiblePaths) {
      console.log(`[PlatformManager] 检查路径: ${binaryPath}`);
      if (fs.existsSync(binaryPath)) {
        console.log(`[PlatformManager] 找到二进制文件: ${binaryPath}`);
        return binaryPath;
      }
    }
    
    // 如果都找不到，列出实际的目录结构以便调试
    const debugPaths = [
      process.resourcesPath,
      path.join(process.resourcesPath, 'bin'),
      this.projectRoot,
      path.join(this.projectRoot, 'bin')
    ];
    
    console.log(`[PlatformManager] 调试信息 - 检查以下目录结构:`);
    for (const debugPath of debugPaths) {
      if (fs.existsSync(debugPath)) {
        try {
          const contents = fs.readdirSync(debugPath);
          console.log(`[PlatformManager] ${debugPath}: [${contents.join(', ')}]`);
        } catch (err) {
          console.log(`[PlatformManager] ${debugPath}: 无法读取目录`);
        }
      } else {
        console.log(`[PlatformManager] ${debugPath}: 不存在`);
      }
    }
    
    const expectedPath = possiblePaths[0];
    const error = `未找到二进制文件 '${binaryName}' (${actualBinaryName})，预期路径: ${expectedPath}`;
    console.error(`[PlatformManager] ${error}`);
    throw new Error(error);
  }

  /**
   * 确保单个二进制文件权限
   */
  async ensureBinaryPermissions(binaryPath) {
    const platformArch = this.getPlatformArch();
    const platformConfig = this.supportedPlatforms[platformArch];
    
    console.log(`[PlatformManager] 开始设置权限: ${binaryPath}`);
    console.log(`[PlatformManager] 平台: ${platformArch}`);
    console.log(`[PlatformManager] 需要权限: ${platformConfig?.needsPermission}`);
    
    if (!platformConfig || !platformConfig.needsPermission) {
      console.log(`[PlatformManager] 平台不需要权限设置，跳过`);
      return true;
    }

    try {
      if (fs.existsSync(binaryPath)) {
        console.log(`[PlatformManager] 文件存在，设置权限`);
        
        // 设置标准权限
        console.log(`[PlatformManager] 设置权限为: ${platformConfig.execPermission}`);
        fs.chmodSync(binaryPath, platformConfig.execPermission);
        
        // 验证权限设置
        const newStats = fs.statSync(binaryPath);
        const newMode = newStats.mode.toString(8);
        console.log(`[PlatformManager] 权限设置后: ${newMode}`);
        
        // 检查是否有执行权限
        const hasExecPermission = (newStats.mode & parseInt('111', 8)) !== 0;
        console.log(`[PlatformManager] 执行权限检查: ${hasExecPermission}`);
        
        return hasExecPermission;
      } else {
        console.log(`[PlatformManager] 文件不存在: ${binaryPath}`);
        return false;
      }
    } catch (error) {
      console.error(`[PlatformManager] 权限设置失败:`, error);
      return false;
    }
  }

  /**
   * 批量确保所有二进制文件权限
   */
  async ensureAllBinaryPermissions() {
    const platformArch = this.getPlatformArch();
    const platformConfig = this.supportedPlatforms[platformArch];
    
    if (!platformConfig) {
      throw new Error(`不支持的平台: ${platformArch}`);
    }

    const results = [];
    for (const binaryName of Object.keys(platformConfig.binaries)) {
      try {
        const binaryPath = await this.getBinaryPath(binaryName);
        const success = await this.ensureBinaryPermissions(binaryPath);
        results.push({ binary: binaryName, path: binaryPath, success });
      } catch (error) {
        results.push({ binary: binaryName, path: null, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * 动态刷新二进制权限（用于动态下载/替换场景）
   */
  async refreshBinaryPermissions(binaryName = null) {
    if (binaryName) {
      // 刷新单个二进制文件权限
      const binaryPath = await this.getBinaryPath(binaryName);
      return await this.ensureBinaryPermissions(binaryPath);
    } else {
      // 刷新所有二进制文件权限
      return await this.ensureAllBinaryPermissions();
    }
  }

  async validateBinary(binaryPath) {
    console.log(`[PlatformManager] 开始验证二进制文件: ${binaryPath}`);
    
    try {
      if (!fs.existsSync(binaryPath)) {
        console.log(`[PlatformManager] 文件不存在`);
        return false;
      }

      const stats = fs.statSync(binaryPath);
      console.log(`[PlatformManager] 文件统计: 大小=${stats.size}, 是否为文件=${stats.isFile()}`);
      
      if (!stats.isFile()) {
        console.log(`[PlatformManager] 不是文件`);
        return false;
      }
      
      if (process.platform !== 'win32') {
        const mode = stats.mode;
        const modeStr = mode.toString(8);
        const hasExecPermission = (mode & parseInt('111', 8)) !== 0;
        console.log(`[PlatformManager] 权限模式: ${modeStr}, 执行权限: ${hasExecPermission}`);
        
        if (!hasExecPermission) {
          console.log(`[PlatformManager] 缺少执行权限`);
          return false;
        }
      }
      
      console.log(`[PlatformManager] 二进制文件验证通过`);
      return true;
    } catch (error) {
      console.error(`[PlatformManager] 验证失败:`, error);
      return false;
    }
  }

  /**
   * 创建平台目录和占位符文件
   */
  async createPlatformStructure() {
    // 在生产环境（打包后）中，extraResources 是只读的，不需要创建目录
    if (!this.isDev) {
      console.log(`[PlatformManager] 生产环境，跳过平台目录创建`);
      return;
    }
    
    console.log(`[PlatformManager] 开发环境，创建平台目录结构`);
    const platforms = Object.keys(this.supportedPlatforms);
    
    for (const platform of platforms) {
      const platformDir = path.join(this.projectRoot, 'bin', platform);
      
      // 创建平台目录
      if (!fs.existsSync(platformDir)) {
        fs.mkdirSync(platformDir, { recursive: true });
      }
      
      // 创建说明文件
      const readmePath = path.join(platformDir, 'README.txt');
      if (!fs.existsSync(readmePath)) {
        const platformConfig = this.supportedPlatforms[platform];
        const binaries = Object.values(platformConfig.binaries);
        
        const content = `此目录存放 ${platform} 平台的静态二进制文件

需要的静态二进制文件:
${binaries.map(binary => `- ${binary} (静态编译版本)`).join('\n')}

重要提示:
- 必须使用静态编译的二进制文件，避免动态链接库依赖
- FFmpeg: 下载 static 版本从 https://ffmpeg.org/download.html
- Whisper CLI: 确保使用静态编译版本从 https://github.com/ggerganov/whisper.cpp/releases

请将下载的静态二进制文件重命名为上述文件名并放置在此目录中。
`;
        
        fs.writeFileSync(readmePath, content, 'utf8');
      }
    }
  }
}

module.exports = PlatformManager;
