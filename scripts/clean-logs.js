#!/usr/bin/env node

/**
 * 日志清理脚本
 * 清理 iTools 应用产生的日志文件
 */

const fs = require('fs');
const path = require('path');

class LogCleaner {
  constructor() {
    this.appDataPaths = this.getAppDataPaths();
  }

  /**
   * 获取各平台的应用数据路径
   */
  getAppDataPaths() {
    const platform = process.platform;
    const homedir = require('os').homedir();
    
    switch (platform) {
      case 'win32':
        return [
          path.join(process.env.APPDATA || path.join(homedir, 'AppData/Roaming'), 'iTools/logs'),
          path.join(__dirname, '../logs') // 开发环境
        ];
      case 'darwin':
        return [
          path.join(homedir, 'Library/Logs/iTools'),
          path.join(__dirname, '../logs') // 开发环境
        ];
      case 'linux':
        return [
          path.join(homedir, '.config/iTools/logs'),
          path.join(__dirname, '../logs') // 开发环境
        ];
      default:
        return [path.join(__dirname, '../logs')];
    }
  }

  /**
   * 获取目录大小（递归）
   */
  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      if (!fs.existsSync(dirPath)) return 0;
      
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (err) {
      console.error(`获取目录大小失败: ${dirPath}`, err.message);
    }
    
    return totalSize;
  }

  /**
   * 清理指定目录的日志文件
   */
  cleanLogsInDirectory(logDir, options = {}) {
    const {
      maxDays = 7,
      maxFiles = 10,
      dryRun = false
    } = options;

    console.log(`\n📁 检查日志目录: ${logDir}`);
    
    if (!fs.existsSync(logDir)) {
      console.log('   目录不存在，跳过');
      return { deleted: 0, size: 0 };
    }

    const beforeSize = this.getDirectorySize(logDir);
    console.log(`   当前大小: ${(beforeSize / 1024 / 1024).toFixed(2)} MB`);

    try {
      const files = fs.readdirSync(logDir);
      const logFiles = files
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          stats: fs.statSync(path.join(logDir, file))
        }))
        .sort((a, b) => b.stats.mtime - a.stats.mtime);

      console.log(`   发现 ${logFiles.length} 个日志文件`);

      if (logFiles.length === 0) {
        return { deleted: 0, size: 0 };
      }

      const now = new Date();
      const maxAge = maxDays * 24 * 60 * 60 * 1000; // 转换为毫秒
      
      let deletedCount = 0;
      let deletedSize = 0;

      // 删除过期文件
      for (const file of logFiles) {
        const age = now - file.stats.mtime;
        const shouldDelete = age > maxAge || deletedCount >= maxFiles;
        
        if (shouldDelete) {
          const fileSize = file.stats.size;
          
          if (dryRun) {
            console.log(`   [试运行] 将删除: ${file.name} (${(fileSize / 1024).toFixed(1)} KB, ${Math.floor(age / (24 * 60 * 60 * 1000))} 天前)`);
          } else {
            try {
              fs.unlinkSync(file.path);
              console.log(`   ✅ 已删除: ${file.name} (${(fileSize / 1024).toFixed(1)} KB)`);
            } catch (err) {
              console.log(`   ❌ 删除失败: ${file.name} - ${err.message}`);
              continue;
            }
          }
          
          deletedCount++;
          deletedSize += fileSize;
        }
      }

      if (!dryRun) {
        const afterSize = this.getDirectorySize(logDir);
        console.log(`   清理后大小: ${(afterSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   释放空间: ${(deletedSize / 1024 / 1024).toFixed(2)} MB`);
      }

      return { deleted: deletedCount, size: deletedSize };

    } catch (err) {
      console.error(`   清理日志时出错: ${err.message}`);
      return { deleted: 0, size: 0 };
    }
  }

  /**
   * 清理所有日志文件
   */
  cleanAllLogs(options = {}) {
    console.log('🧹 开始清理 iTools 日志文件...\n');
    
    let totalDeleted = 0;
    let totalSize = 0;

    for (const logPath of this.appDataPaths) {
      const result = this.cleanLogsInDirectory(logPath, options);
      totalDeleted += result.deleted;
      totalSize += result.size;
    }

    console.log('\n📊 清理汇总:');
    console.log(`   删除文件数: ${totalDeleted}`);
    console.log(`   释放空间: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (options.dryRun) {
      console.log('\n⚠️  这是试运行，实际文件未被删除');
      console.log('   使用 --clean 参数执行实际清理');
    }
  }
}

// 命令行接口
function main() {
  const args = process.argv.slice(2);
  const options = {
    maxDays: 7,
    maxFiles: 10,
    dryRun: !args.includes('--clean')
  };

  // 解析命令行参数
  const daysIndex = args.indexOf('--days');
  if (daysIndex !== -1 && args[daysIndex + 1]) {
    options.maxDays = parseInt(args[daysIndex + 1], 10) || 7;
  }

  const filesIndex = args.indexOf('--files');
  if (filesIndex !== -1 && args[filesIndex + 1]) {
    options.maxFiles = parseInt(args[filesIndex + 1], 10) || 10;
  }

  if (args.includes('--help')) {
    console.log(`
📋 iTools 日志清理工具

用法: node scripts/clean-logs.js [选项]

选项:
  --clean           执行实际清理（默认为试运行）
  --days <数量>     保留最近几天的日志（默认: 7）
  --files <数量>    最多保留文件数量（默认: 10）
  --help           显示此帮助信息

示例:
  node scripts/clean-logs.js                    # 试运行，预览将删除的文件
  node scripts/clean-logs.js --clean            # 实际清理，保留7天
  node scripts/clean-logs.js --clean --days 3   # 清理，只保留3天的日志
`);
    return;
  }

  const cleaner = new LogCleaner();
  cleaner.cleanAllLogs(options);
}

if (require.main === module) {
  main();
}

module.exports = LogCleaner;
