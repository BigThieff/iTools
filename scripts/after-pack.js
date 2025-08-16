const fs = require('fs');
const path = require('path');

/**
 * electron-builder 打包后处理脚本
 * 确保只包含当前平台的二进制文件，减小安装包大小
 */
module.exports = async function(context) {
  const { electronPlatformName, appOutDir } = context;
  
  console.log(`🔧 打包后处理开始`);
  console.log(`📋 Platform: ${electronPlatformName}`);
  console.log(`📋 Output Dir: ${appOutDir}`);
  
  // 从 appOutDir 路径推断架构 (例如: release/mac-arm64)
  let arch = 'x64'; // 默认值
  if (appOutDir.includes('arm64')) {
    arch = 'arm64';
  } else if (appOutDir.includes('x64')) {
    arch = 'x64';
  } else if (appOutDir.includes('ia32')) {
    arch = 'ia32';
  }
  
  console.log(`🔧 推断架构: ${arch}`);
  
  // 映射 electron 平台名称到我们的目录结构
  const platformMap = {
    'darwin': 'darwin',
    'win32': 'win32', 
    'linux': 'linux'
  };
  
  const currentPlatform = `${platformMap[electronPlatformName]}-${arch}`;
  console.log(`📦 当前打包平台: ${currentPlatform}`);
  
  // 查找二进制目录 (可能在不同位置)
  const possibleBinDirs = [
    path.join(appOutDir, 'iTools.app', 'Contents', 'Resources', 'bin'), // macOS app bundle
    path.join(appOutDir, 'resources', 'app', 'bin'),
    path.join(appOutDir, 'resources', 'bin'),
    path.join(appOutDir, 'bin')
  ];
  
  let binDir = null;
  for (const dir of possibleBinDirs) {
    if (fs.existsSync(dir)) {
      binDir = dir;
      break;
    }
  }
  
  if (!binDir) {
    console.log('⚠️  二进制目录不存在，跳过处理');
    return;
  }
  
  console.log(`📁 二进制目录: ${binDir}`);
  
  // 读取所有平台目录
  const allPlatformDirs = fs.readdirSync(binDir)
    .filter(item => fs.statSync(path.join(binDir, item)).isDirectory());
  
  console.log(`📋 发现平台目录: ${allPlatformDirs.join(', ')}`);
  
  // 计算删除前的总大小
  const getDirectorySize = (dirPath) => {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    return totalSize;
  };
  
  const initialSize = getDirectorySize(binDir);
  console.log(`📊 删除前总大小: ${(initialSize / 1024 / 1024).toFixed(2)} MB`);
  
  // 删除非当前平台的目录
  let deletedDirs = [];
  let deletedSize = 0;
  
  for (const platformDir of allPlatformDirs) {
    if (platformDir !== currentPlatform) {
      const dirToDelete = path.join(binDir, platformDir);
      const dirSize = getDirectorySize(dirToDelete);
      
      console.log(`🗑️  删除平台目录: ${platformDir} (${(dirSize / 1024 / 1024).toFixed(2)} MB)`);
      
      fs.rmSync(dirToDelete, { recursive: true, force: true });
      deletedDirs.push(platformDir);
      deletedSize += dirSize;
    }
  }
  
  // 设置当前平台二进制文件的执行权限
  const currentPlatformDir = path.join(binDir, currentPlatform);
  if (fs.existsSync(currentPlatformDir)) {
    console.log(`🔐 设置 ${currentPlatform} 二进制文件执行权限`);
    
    const files = fs.readdirSync(currentPlatformDir);
    for (const file of files) {
      const filePath = path.join(currentPlatformDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile() && !file.endsWith('.txt')) {
        try {
          fs.chmodSync(filePath, 0o755);
          console.log(`✅ 设置执行权限: ${file}`);
        } catch (error) {
          console.log(`❌ 权限设置失败: ${file} - ${error.message}`);
        }
      }
    }
  }
  
  const finalSize = getDirectorySize(binDir);
  
  console.log(`\n📈 优化结果:`);
  console.log(`   • 删除平台: ${deletedDirs.join(', ')}`);
  console.log(`   • 保留平台: ${currentPlatform}`);
  console.log(`   • 删除大小: ${(deletedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   • 最终大小: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   • 空间节省: ${((deletedSize / initialSize) * 100).toFixed(1)}%`);
  console.log(`✅ 打包后处理完成\n`);
};
