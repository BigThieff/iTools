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
        this.projectRoot = process.resourcesPath;
      } else {
        // 未打包的应用
        this.projectRoot = path.resolve(__dirname, '..');
      }
    }
    
    this.supportedPlatforms = this.getSupportedPlatforms();
    
    console.log(`[PlatformManager] 初始化 - 开发模式: ${this.isDev}, 项目根目录: ${this.projectRoot}`);
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
    
    const possiblePaths = [
      path.join(this.projectRoot, 'bin', platformArch, actualBinaryName),
      path.join(this.projectRoot, 'bin', actualBinaryName)
    ];

    console.log(`[PlatformManager] 搜索路径:`, possiblePaths);

    for (const binaryPath of possiblePaths) {
      console.log(`[PlatformManager] 检查路径: ${binaryPath}`);
      if (fs.existsSync(binaryPath)) {
        console.log(`[PlatformManager] 找到二进制文件: ${binaryPath}`);
        
        // 在 macOS 上进行额外的安全检查
        if (process.platform === 'darwin') {
          try {
            const { execSync } = require('child_process');
            
            // 检查隔离属性
            try {
              const xattrOutput = execSync(`xattr -l "${binaryPath}" 2>/dev/null || echo "no-attributes"`);
              const xattrStr = xattrOutput.toString();
              if (xattrStr.includes('com.apple.quarantine')) {
                console.warn(`[PlatformManager] ⚠️  文件被隔离，可能导致执行失败: ${binaryPath}`);
                console.warn(`[PlatformManager] 建议：请在系统设置->隐私与安全性中允许此应用运行`);
              }
            } catch (xattrCheckError) {
              console.log(`[PlatformManager] 无法检查扩展属性（正常）:`, xattrCheckError.message);
            }
            
            // 检查代码签名
            try {
              const codesignOutput = execSync(`codesign -dv "${binaryPath}" 2>&1 || echo "not-signed"`);
              const codesignStr = codesignOutput.toString();
              if (codesignStr.includes('not-signed') || codesignStr.includes('code object is not signed')) {
                console.warn(`[PlatformManager] ⚠️  文件未签名，可能被 Gatekeeper 阻止: ${binaryPath}`);
                console.warn(`[PlatformManager] 系统错误 -86 通常与此相关`);
              } else {
                console.log(`[PlatformManager] ✅ 文件已签名`);
              }
            } catch (codesignCheckError) {
              console.log(`[PlatformManager] 无法检查代码签名:`, codesignCheckError.message);
            }
            
          } catch (macCheckError) {
            console.log(`[PlatformManager] macOS 安全检查失败:`, macCheckError.message);
          }
        }
        
        return binaryPath;
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
        console.log(`[PlatformManager] 文件存在，检查当前权限`);
        
        // 检查当前权限
        const stats = fs.statSync(binaryPath);
        const currentMode = stats.mode.toString(8);
        console.log(`[PlatformManager] 当前权限: ${currentMode}`);
        
        // 在 macOS 上，尝试移除扩展属性以解决 Gatekeeper 问题
        if (process.platform === 'darwin') {
          console.log(`[PlatformManager] macOS 系统，尝试移除扩展属性`);
          try {
            const { execSync } = require('child_process');
            
            // 先检查是否有隔离属性
            let hasQuarantine = false;
            try {
              const xattrCheck = execSync(`xattr -l "${binaryPath}" 2>/dev/null || echo "no-attributes"`);
              hasQuarantine = xattrCheck.toString().includes('com.apple.quarantine');
              if (hasQuarantine) {
                console.log(`[PlatformManager] 发现隔离属性，尝试移除`);
              }
            } catch (checkError) {
              console.log(`[PlatformManager] 检查扩展属性失败:`, checkError.message);
            }
            
            // 移除隔离属性
            if (hasQuarantine) {
              execSync(`xattr -dr com.apple.quarantine "${binaryPath}" 2>/dev/null || true`);
              console.log(`[PlatformManager] 成功移除隔离属性`);
            }
            
            // 尝试执行一次二进制文件以触发系统识别
            try {
              console.log(`[PlatformManager] 尝试执行二进制文件以触发系统识别`);
              if (binaryPath.includes('ffmpeg')) {
                execSync(`"${binaryPath}" -version 2>/dev/null || true`, { timeout: 3000 });
              } else if (binaryPath.includes('whisper-cli')) {
                execSync(`"${binaryPath}" --help 2>/dev/null || true`, { timeout: 3000 });
              }
              console.log(`[PlatformManager] 执行成功，系统已识别二进制文件`);
            } catch (execError) {
              console.log(`[PlatformManager] 执行失败，可能需要用户手动允许:`, execError.message);
            }
            
          } catch (xattrError) {
            console.log(`[PlatformManager] 移除扩展属性失败（这是正常的）:`, xattrError.message);
          }
        }
        
        // 设置权限
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
