const path = require('path');
const fs = require('fs');
const os = require('os');

class PlatformManager {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.isDev = process.env.NODE_ENV === 'development';
    this.projectRoot = path.resolve(__dirname, '..');
    this.supportedPlatforms = this.getSupportedPlatforms();
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
    
    if (!this.supportedPlatforms[platformArch]) {
      throw new Error(`不支持的平台: ${platformArch}。支持的平台: ${Object.keys(this.supportedPlatforms).join(', ')}`);
    }

    const platformConfig = this.supportedPlatforms[platformArch];
    const actualBinaryName = platformConfig.binaries[binaryName];
    
    if (!actualBinaryName) {
      throw new Error(`在平台 ${platformArch} 上找不到二进制文件 '${binaryName}'`);
    }
    
    const possiblePaths = [
      path.join(this.projectRoot, 'bin', platformArch, actualBinaryName),
      path.join(this.projectRoot, 'bin', actualBinaryName)
    ];

    for (const binaryPath of possiblePaths) {
      if (fs.existsSync(binaryPath)) {
        return binaryPath;
      }
    }
    
    const expectedPath = possiblePaths[0];
    throw new Error(`未找到二进制文件 '${binaryName}' (${actualBinaryName})，预期路径: ${expectedPath}`);
  }

  /**
   * 确保单个二进制文件权限
   */
  async ensureBinaryPermissions(binaryPath) {
    const platformArch = this.getPlatformArch();
    const platformConfig = this.supportedPlatforms[platformArch];
    
    if (!platformConfig || !platformConfig.needsPermission) {
      return true;
    }

    try {
      if (fs.existsSync(binaryPath)) {
        fs.chmodSync(binaryPath, platformConfig.execPermission);
        return true;
      } else {
        return false;
      }
    } catch (error) {
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
    try {
      if (!fs.existsSync(binaryPath)) {
        return false;
      }

      const stats = fs.statSync(binaryPath);
      if (!stats.isFile()) {
        return false;
      }
      
      if (process.platform !== 'win32') {
        const mode = stats.mode;
        const hasExecPermission = (mode & parseInt('111', 8)) !== 0;
        if (!hasExecPermission) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 创建平台目录和占位符文件
   */
  async createPlatformStructure() {
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
