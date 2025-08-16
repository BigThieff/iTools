const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { extractSubtitle, checkSubtitleExists, listModels } = require('./tools/subtitle/subtitle-processor.cjs');
const PlatformManager = require('./utils/platform-manager.cjs');
const ErrorHandler = require('./utils/error-handler.cjs');
const { version } = require('./package.json');

const platformManager = new PlatformManager();
let errorHandler = null; // 延迟初始化

function createWindow() {
  if (errorHandler) {
    errorHandler.writeLog('info', '创建主窗口');
  }
  
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'app.html'));
  
  if (process.env.NODE_ENV === 'development') {
    if (errorHandler) {
      errorHandler.writeLog('info', '开发模式，打开开发者工具');
    }
    win.webContents.openDevTools();
  }
  
  return win;
}

app.whenReady().then(async () => {
  // 在应用就绪后初始化 ErrorHandler
  errorHandler = new ErrorHandler();
  await errorHandler.initialize(); // 显式初始化
  errorHandler.writeLog('info', '应用就绪，开始初始化');
  
  await initializePlatform();
  createMenu();
  createWindow();
  errorHandler.writeLog('info', '应用启动完成');
});

app.on('window-all-closed', () => {
  if (errorHandler) {
    errorHandler.writeLog('info', '所有窗口已关闭');
  }
  if (process.platform !== 'darwin') {
    if (errorHandler) {
      errorHandler.writeLog('info', '退出应用');
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (errorHandler) {
    errorHandler.writeLog('info', '应用被激活');
  }
  if (BrowserWindow.getAllWindows().length === 0) {
    if (errorHandler) {
      errorHandler.writeLog('info', '没有窗口，创建新窗口');
    }
    createWindow();
  }
});

//注册所有IPC处理器
ipcMain.handle('subtitle:extract', async (event, videoPath, options) => {
  if (errorHandler) {
    errorHandler.writeLog('info', 'IPC字幕提取请求', { videoPath, options });
  }
  try {
    // 创建进度回调函数
    const progressCallback = (progressData) => {
      event.sender.send('subtitle:progress', progressData);
    };
    
    const result = await extractSubtitle(videoPath, options, progressCallback);
    if (errorHandler) {
      errorHandler.logSuccess('字幕提取', { videoPath, options });
    }
    return { success: true, result };
  } catch (error) {
    if (errorHandler) {
      return errorHandler.handleSubtitleError(error, videoPath, options);
    } else {
      return { success: false, error: error.message };
    }
  }
});

ipcMain.handle('subtitle:checkExists', async (event, videoPath, modelName, language, targetLang, subtitleOrder) => {
  if (errorHandler) {
    errorHandler.writeLog('info', 'IPC检查字幕存在请求', { videoPath, modelName, language, targetLang, subtitleOrder });
  }
  try {
    const exists = checkSubtitleExists(videoPath, modelName, language, targetLang, subtitleOrder);
    if (errorHandler) {
      errorHandler.writeLog('info', 'IPC字幕存在检查结果', { exists, videoPath, modelName, language, targetLang, subtitleOrder });
    }
    return { success: true, exists };
  } catch (error) {
    if (errorHandler) {
      return errorHandler.handleIpcError(error, '检查字幕文件', { videoPath, modelName, language, targetLang, subtitleOrder });
    } else {
      return { success: false, error: error.message };
    }
  }
});

ipcMain.handle('subtitle:listModels', async () => {
  if (errorHandler) {
    errorHandler.writeLog('info', 'IPC获取模型列表请求');
  }
  try {
    const models = listModels();
    if (errorHandler) {
      errorHandler.writeLog('info', 'IPC模型列表获取成功', { models });
    }
    return { success: true, models };
  } catch (error) {
    if (errorHandler) {
      return errorHandler.handleIpcError(error, '获取模型列表');
    } else {
      return { success: false, error: error.message };
    }
  }
});

ipcMain.handle('dialog:openFile', async () => {
  if (errorHandler) {
    errorHandler.writeLog('info', 'IPC打开文件对话框请求');
  }
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (errorHandler) {
      errorHandler.writeLog('info', 'IPC文件对话框结果', { result });
    }
    return { success: true, result };
  } catch (error) {
    if (errorHandler) {
      return errorHandler.handleIpcError(error, '打开文件对话框');
    } else {
      return { success: false, error: error.message };
    }
  }
});

ipcMain.handle('platform:refreshPermissions', async (event, binaryName = null) => {
  if (errorHandler) {
    errorHandler.writeLog('info', 'IPC刷新二进制权限请求', { binaryName });
  }
  try {
    const result = await platformManager.refreshBinaryPermissions(binaryName);
    if (errorHandler) {
      errorHandler.logSuccess('刷新二进制权限', { binaryName, result });
    }
    return { success: true, result };
  } catch (error) {
    if (errorHandler) {
      return errorHandler.handleIpcError(error, '刷新二进制权限', { binaryName });
    } else {
      return { success: false, error: error.message };
    }
  }
});

async function initializePlatform() {
  if (errorHandler) {
    errorHandler.writeLog('info', '开始平台初始化');
  }
  try {
    const platform = platformManager.getPlatformArch();
    if (errorHandler) {
      errorHandler.writeLog('info', '当前平台', { platform });
    }
    
    await platformManager.createPlatformStructure();
    if (errorHandler) {
      errorHandler.writeLog('info', '平台目录结构创建完成');
    }
    
    // 多次尝试权限设置，确保在新系统上成功
    let permissionAttempts = 0;
    let allSuccessful = false;
    const maxAttempts = 3;
    
    while (permissionAttempts < maxAttempts && !allSuccessful) {
      permissionAttempts++;
      
      if (errorHandler) {
        errorHandler.writeLog('info', `权限设置尝试 ${permissionAttempts}/${maxAttempts}`);
      }
      
      const results = await platformManager.ensureAllBinaryPermissions();
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      if (successCount === totalCount) {
        allSuccessful = true;
        if (errorHandler) {
          errorHandler.logSuccess('二进制文件权限设置', { platform, attempt: permissionAttempts, results });
        }
      } else {
        if (errorHandler) {
          errorHandler.logWarning(`权限设置第 ${permissionAttempts} 次尝试部分成功: ${successCount}/${totalCount}`, { platform, results });
        }
        
        // 如果不是最后一次尝试，等待一秒后重试
        if (permissionAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!allSuccessful) {
      if (errorHandler) {
        errorHandler.writeLog('warning', '二进制文件权限设置未完全成功，字幕提取功能可能受影响');
      }
    }
    
    if (errorHandler) {
      errorHandler.logSuccess('平台初始化完成', { platform });
    }
  } catch (error) {
    if (errorHandler) {
      errorHandler.writeLog('error', '平台初始化失败', error);
    }
  }
}

const createMenu = () => {
  if (errorHandler) {
    errorHandler.writeLog('info', '创建应用菜单');
  }
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导出日志文件',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: async () => {
            try {
              if (errorHandler) {
                errorHandler.writeLog('info', '用户请求导出日志文件');
              }
              
              const { dialog } = require('electron');
              const path = require('path');
              const fs = require('fs');
              
              // 获取日志目录
              const logDir = errorHandler ? errorHandler.getLogDir() : null;
              if (!logDir || !fs.existsSync(logDir)) {
                dialog.showErrorBox('错误', '找不到日志目录或日志目录不存在');
                return;
              }
              
              // 让用户选择保存位置
              const result = await dialog.showSaveDialog({
                title: '导出日志文件',
                defaultPath: `iTools-logs-${new Date().toISOString().slice(0, 10)}.zip`,
                filters: [
                  { name: 'ZIP 文件', extensions: ['zip'] },
                  { name: '所有文件', extensions: ['*'] }
                ]
              });
              
              if (result.canceled) {
                return;
              }
              
              // 导出日志
              await errorHandler.exportLogs(result.filePath);
              
              dialog.showMessageBox({
                type: 'info',
                title: '导出成功',
                message: `日志文件已导出到：\n${result.filePath}`,
                buttons: ['确定']
              });
              
              if (errorHandler) {
                errorHandler.writeLog('info', '日志导出成功', { exportPath: result.filePath });
              }
            } catch (error) {
              if (errorHandler) {
                errorHandler.writeLog('error', '日志导出失败', error);
              }
              dialog.showErrorBox('导出失败', `无法导出日志文件：${error.message}`);
            }
          },
        },
        { type: 'separator' },
        {
          label: '清理日志文件',
          click: async () => {
            try {
              if (errorHandler) {
                errorHandler.writeLog('info', '用户请求清理日志文件');
              }
              
              const { dialog } = require('electron');
              const result = await dialog.showMessageBox({
                type: 'question',
                title: '确认清理',
                message: '是否要清理所有日志文件？\n此操作不可撤销。',
                buttons: ['取消', '清理'],
                defaultId: 0,
                cancelId: 0
              });
              
              if (result.response === 1) {
                await errorHandler.cleanAllLogs();
                dialog.showMessageBox({
                  type: 'info',
                  title: '清理完成',
                  message: '所有日志文件已清理完成',
                  buttons: ['确定']
                });
                
                if (errorHandler) {
                  errorHandler.writeLog('info', '日志清理完成');
                }
              }
            } catch (error) {
              if (errorHandler) {
                errorHandler.writeLog('error', '日志清理失败', error);
              }
              dialog.showErrorBox('清理失败', `无法清理日志文件：${error.message}`);
            }
          }
        }
      ]
    },
    {
      label: '诊断',
      submenu: [
        {
          label: '检查系统权限',
          click: async () => {
            try {
              if (errorHandler) {
                errorHandler.writeLog('info', '用户请求检查系统权限');
              }
              
              const { dialog } = require('electron');
              
              // 执行权限检查
              const results = await platformManager.ensureAllBinaryPermissions();
              const platform = platformManager.getPlatformArch();
              
              if (errorHandler) {
                errorHandler.writeLog('info', '权限检查结果', { platform, results });
              }
              
              const successCount = results.filter(r => r.success).length;
              const totalCount = results.length;
              
              let message = `平台：${platform}\n`;
              message += `权限检查结果：${successCount}/${totalCount} 成功\n\n`;
              
              results.forEach(result => {
                const status = result.success ? '✅' : '❌';
                message += `${status} ${result.binary}: ${result.path || '未找到'}\n`;
                if (result.error) {
                  message += `   错误：${result.error}\n`;
                }
              });
              
              dialog.showMessageBox({
                type: successCount === totalCount ? 'info' : 'warning',
                title: '权限检查结果',
                message: message,
                buttons: ['确定']
              });
            } catch (error) {
              if (errorHandler) {
                errorHandler.writeLog('error', '权限检查失败', error);
              }
              dialog.showErrorBox('检查失败', `权限检查失败：${error.message}`);
            }
          }
        },
        {
          label: '重新初始化平台',
          click: async () => {
            try {
              if (errorHandler) {
                errorHandler.writeLog('info', '用户请求重新初始化平台');
              }
              
              const { dialog } = require('electron');
              await initializePlatform();
              
              dialog.showMessageBox({
                type: 'info',
                title: '初始化完成',
                message: '平台重新初始化完成，请查看日志了解详细信息',
                buttons: ['确定']
              });
            } catch (error) {
              if (errorHandler) {
                errorHandler.writeLog('error', '平台重新初始化失败', error);
              }
              dialog.showErrorBox('初始化失败', `平台初始化失败：${error.message}`);
            }
          }
        },
        ...(process.platform === 'darwin' ? [{
          type: 'separator'
        }, {
          label: 'macOS 安全诊断',
          click: async () => {
            try {
              if (errorHandler) {
                errorHandler.writeLog('info', '用户请求 macOS 安全诊断');
              }
              
              const { dialog } = require('electron');
              const { execSync } = require('child_process');
              
              let diagnosticMessage = 'macOS 安全诊断结果：\n\n';
              
              // 检查 Gatekeeper 状态
              try {
                const gatekeeperStatus = execSync('spctl --status 2>&1').toString().trim();
                diagnosticMessage += `🔒 Gatekeeper 状态：${gatekeeperStatus}\n`;
              } catch (error) {
                diagnosticMessage += `❌ 无法检查 Gatekeeper 状态：${error.message}\n`;
              }
              
              // 检查应用隔离属性
              try {
                const appPath = process.execPath;
                const xattrOutput = execSync(`xattr -l "${appPath}" 2>/dev/null || echo "no-attributes"`).toString();
                if (xattrOutput.includes('com.apple.quarantine')) {
                  diagnosticMessage += `⚠️  应用被隔离，这可能导致执行错误\n`;
                } else {
                  diagnosticMessage += `✅ 应用未被隔离\n`;
                }
              } catch (error) {
                diagnosticMessage += `❌ 无法检查应用隔离状态：${error.message}\n`;
              }
              
              // 检查应用代码签名
              try {
                const appPath = process.execPath;
                const codesignOutput = execSync(`codesign -dv "${appPath}" 2>&1`).toString();
                if (codesignOutput.includes('not signed')) {
                  diagnosticMessage += `⚠️  应用未签名，可能被系统阻止\n`;
                } else {
                  diagnosticMessage += `✅ 应用已签名\n`;
                }
              } catch (error) {
                diagnosticMessage += `❌ 无法检查应用签名状态：${error.message}\n`;
              }
              
              // 尝试手动触发系统识别
              diagnosticMessage += '\n🔄 触发系统识别中...\n';
              try {
                const appPath = process.execPath.replace('/Contents/MacOS/iTools', '');
                execSync(`sudo spctl --assess --verbose "${appPath}" 2>&1 || true`);
                diagnosticMessage += '✅ 已尝试触发系统识别\n';
              } catch (error) {
                diagnosticMessage += '⚠️  无法触发系统识别（需要管理员权限）\n';
              }
              
              // 给出解决建议
              diagnosticMessage += '\n💡 解决方案（按顺序尝试）：\n\n';
              diagnosticMessage += '1. 首次运行方法：\n';
              diagnosticMessage += '   • 完全退出应用\n';
              diagnosticMessage += '   • 右键点击应用图标，选择"打开"\n';
              diagnosticMessage += '   • 在弹出对话框中点击"打开"\n\n';
              diagnosticMessage += '2. 如果隐私与安全性中找不到应用：\n';
              diagnosticMessage += '   • 应用可能还未被系统检测到\n';
              diagnosticMessage += '   • 重启应用让系统重新检测\n';
              diagnosticMessage += '   • 或在终端运行强制检测命令\n\n';
              diagnosticMessage += '3. 临时解决方案：\n';
              diagnosticMessage += '   • 终端运行：sudo spctl --master-disable\n';
              diagnosticMessage += '   • 使用完毕后：sudo spctl --master-enable';
              
              dialog.showMessageBox({
                type: 'info',
                title: 'macOS 安全诊断',
                message: diagnosticMessage,
                buttons: ['确定', '复制终端命令']
              }).then((result) => {
                if (result.response === 1) {
                  // 复制终端命令到剪贴板
                  const { clipboard } = require('electron');
                  const commands = `# 强制检测应用\nsudo spctl --assess --verbose /Applications/iTools.app\n\n# 临时禁用 Gatekeeper\nsudo spctl --master-disable\n\n# 重新启用 Gatekeeper\nsudo spctl --master-enable`;
                  clipboard.writeText(commands);
                  dialog.showMessageBox({
                    type: 'info',
                    title: '已复制',
                    message: '终端命令已复制到剪贴板',
                    buttons: ['确定']
                  });
                }
              });
              
              if (errorHandler) {
                errorHandler.writeLog('info', 'macOS 安全诊断完成', { result: diagnosticMessage });
              }
            } catch (error) {
              if (errorHandler) {
                errorHandler.writeLog('error', 'macOS 安全诊断失败', error);
              }
              dialog.showErrorBox('诊断失败', `macOS 安全诊断失败：${error.message}`);
            }
          }
        }, {
          label: '强制触发系统识别',
          click: async () => {
            try {
              if (errorHandler) {
                errorHandler.writeLog('info', '用户请求强制触发系统识别');
              }
              
              const { dialog } = require('electron');
              const { execSync } = require('child_process');
              
              // 获取应用路径
              const appPath = process.execPath.replace('/Contents/MacOS/iTools', '');
              
              let resultMessage = '强制触发系统识别结果：\n\n';
              
              try {
                // 执行系统识别命令
                const output = execSync(`sudo spctl --assess --verbose "${appPath}" 2>&1`, { 
                  timeout: 10000,
                  encoding: 'utf8'
                });
                resultMessage += `✅ 系统识别完成：\n${output}\n\n`;
                resultMessage += '现在应该可以在"系统设置 > 隐私与安全性"中找到应用了。';
              } catch (error) {
                resultMessage += `⚠️  命令执行结果：\n${error.message}\n\n`;
                resultMessage += '这是正常的，系统现在应该已经识别了应用。\n';
                resultMessage += '请检查"系统设置 > 隐私与安全性"。';
              }
              
              dialog.showMessageBox({
                type: 'info',
                title: '系统识别结果',
                message: resultMessage,
                buttons: ['确定']
              });
              
              if (errorHandler) {
                errorHandler.writeLog('info', '强制触发系统识别完成');
              }
            } catch (error) {
              if (errorHandler) {
                errorHandler.writeLog('error', '强制触发系统识别失败', error);
              }
              
              const { dialog } = require('electron');
              dialog.showMessageBox({
                type: 'warning',
                title: '需要管理员权限',
                message: '此操作需要管理员权限。请在终端中手动运行：\n\nsudo spctl --assess --verbose /Applications/iTools.app\n\n这将强制让系统识别应用，之后可在隐私与安全性设置中找到。',
                buttons: ['确定', '复制命令']
              }).then((result) => {
                if (result.response === 1) {
                  const { clipboard } = require('electron');
                  clipboard.writeText('sudo spctl --assess --verbose /Applications/iTools.app');
                }
              });
            }
          }
        }] : [])
      ]
    },
    {
      label: '关于',
      submenu: [
        {
          label: '关于 iTools',
          click: () => {
            if (errorHandler) {
              errorHandler.writeLog('info', '显示关于对话框');
            }
            dialog.showMessageBox({
              type: 'info',
              title: '关于 iTools',
              message: `iTools - 字幕提取工具\n版本号: ${version}\n\n这是一个用于提取视频字幕的工具，支持单语言和双语言字幕生成。`,
              buttons: ['确定'],
            });
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
