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
    errorHandler.writeLog('info', '创建主窗口', {
      windowConfig: {
        width: 900,
        height: 700,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
  }
  
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'iTools - 智能视频字幕提取工具', // 明确设置窗口标题
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
  
  // 记录窗口状态变化
  win.on('ready-to-show', () => {
    if (errorHandler) {
      errorHandler.writeLog('info', '主窗口准备显示', {
        title: win.getTitle()
      });
    }
  });
  
  win.on('closed', () => {
    if (errorHandler) {
      errorHandler.writeLog('info', '主窗口已关闭');
    }
  });
  
  return win;
}

app.whenReady().then(async () => {
  // 在应用就绪后初始化 ErrorHandler
  errorHandler = new ErrorHandler();
  await errorHandler.initialize(); // 显式初始化
  
  // 记录系统启动相关信息
  errorHandler.writeLog('info', '应用就绪，开始初始化', {
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    isDev: process.env.NODE_ENV === 'development',
    appVersion: version,
    execPath: process.execPath,
    resourcesPath: process.resourcesPath
  });
  
  await initializePlatform();
  createMenu();
  createWindow();
  
  // 记录启动完成信息
  errorHandler.writeLog('info', '应用启动完成', {
    timestamp: new Date().toISOString(),
    totalStartupTime: `启动用时约${Math.round(process.uptime() * 1000)}ms`
  });
});

app.on('window-all-closed', () => {
  if (errorHandler) {
    errorHandler.writeLog('info', '所有窗口已关闭，应用即将退出', {
      platform: process.platform,
      shouldQuit: process.platform !== 'darwin'
    });
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (errorHandler) {
    errorHandler.writeLog('info', '应用激活事件触发');
  }
  
  if (BrowserWindow.getAllWindows().length === 0) {
    if (errorHandler) {
      errorHandler.writeLog('info', '没有窗口存在，重新创建主窗口');
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
    errorHandler.writeLog('info', '开始平台初始化', {
      platform: platformManager.getPlatformArch(),
      isDev: platformManager.isDev,
      projectRoot: platformManager.projectRoot
    });
  }
  try {
    const platform = platformManager.getPlatformArch();
    if (errorHandler) {
      errorHandler.writeLog('info', '当前平台详情', { 
        platform,
        supportedPlatforms: Object.keys(platformManager.supportedPlatforms),
        platformConfig: platformManager.supportedPlatforms[platform]
      });
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
        errorHandler.writeLog('info', `二进制权限设置尝试 ${permissionAttempts}/${maxAttempts}`, {
          timestamp: new Date().toISOString()
        });
      }
      
      const results = await platformManager.ensureAllBinaryPermissions();
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      if (successCount === totalCount) {
        allSuccessful = true;
        if (errorHandler) {
          errorHandler.logSuccess('二进制文件权限设置完成', { 
            platform, 
            attempt: permissionAttempts, 
            results,
            allBinariesReady: true,
            binariesStatus: results.map(r => ({
              binary: r.binary,
              success: r.success,
              path: r.path
            }))
          });
        }
      } else {
        if (errorHandler) {
          errorHandler.logWarning(`权限设置第 ${permissionAttempts} 次尝试部分成功: ${successCount}/${totalCount}`, { 
            platform, 
            results,
            failedBinaries: results.filter(r => !r.success).map(r => ({
              binary: r.binary,
              error: r.error
            }))
          });
        }
        
        // 如果不是最后一次尝试，等待一秒后重试
        if (permissionAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!allSuccessful) {
      if (errorHandler) {
        errorHandler.writeLog('warning', '二进制文件权限设置未完全成功，字幕提取功能可能受影响', {
          recommendation: '用户可能需要手动处理权限问题',
          nextSteps: '建议重启应用或检查系统安全设置'
        });
      }
    }
    
    if (errorHandler) {
      errorHandler.logSuccess('平台初始化完成', { 
        platform,
        permissionsAllSet: allSuccessful,
        totalInitTime: `初始化完成于 ${new Date().toISOString()}`
      });
    }
  } catch (error) {
    if (errorHandler) {
      errorHandler.writeLog('error', '平台初始化失败', {
        error: error.message,
        stack: error.stack,
        platform: platformManager.getPlatformArch(),
        critical: true
      });
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
              
              // 检查日志系统状态
              if (!errorHandler) {
                dialog.showErrorBox('错误', '日志系统未初始化');
                return;
              }
              
              const logStatus = errorHandler.getLogStatus();
              console.log('[导出日志] 日志状态:', logStatus);
              
              if (logStatus.status === 'not-initialized') {
                dialog.showErrorBox('错误', '日志系统未初始化，请重启应用后重试');
                return;
              }
              
              if (logStatus.status === 'no-directory') {
                dialog.showErrorBox('错误', '日志目录未创建，可能是权限问题');
                return;
              }
              
              if (!logStatus.exists) {
                dialog.showErrorBox('错误', `日志目录不存在：${logStatus.logDir}`);
                return;
              }
              
              if (!logStatus.writable) {
                dialog.showErrorBox('错误', `日志目录不可写：${logStatus.logDir}`);
                return;
              }
              
              // 显示日志状态信息
              if (logStatus.logFiles === 0) {
                const result = await dialog.showMessageBox({
                  type: 'warning',
                  title: '没有日志文件',
                  message: `在日志目录中没有找到日志文件。\n目录：${logStatus.logDir}\n\n是否仍要导出系统信息？`,
                  buttons: ['取消', '仍要导出']
                });
                
                if (result.response === 0) {
                  return;
                }
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
                message: `日志文件已导出到：\n${result.filePath}\n\n包含：\n• ${logStatus.logFiles} 个日志文件\n• 系统信息文件`,
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
        }
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
