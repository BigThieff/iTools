const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { extractSubtitle, checkSubtitleExists, listModels } = require('./tools/subtitle/subtitle-processor.cjs');
const PlatformManager = require('./utils/platform-manager.cjs');
const ErrorHandler = require('./utils/error-handler.cjs');
const { version } = require('./package.json');

const platformManager = new PlatformManager();
const errorHandler = new ErrorHandler();

function createWindow() {
  errorHandler.writeLog('info', '创建主窗口');
  
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
    errorHandler.writeLog('info', '开发模式，打开开发者工具');
    win.webContents.openDevTools();
  }
  
  return win;
}

app.whenReady().then(async () => {
  errorHandler.writeLog('info', '应用就绪，开始初始化');
  await initializePlatform();
  createMenu();
  createWindow();
  errorHandler.writeLog('info', '应用启动完成');
});

app.on('window-all-closed', () => {
  errorHandler.writeLog('info', '所有窗口已关闭');
  if (process.platform !== 'darwin') {
    errorHandler.writeLog('info', '退出应用');
    app.quit();
  }
});

app.on('activate', () => {
  errorHandler.writeLog('info', '应用被激活');
  if (BrowserWindow.getAllWindows().length === 0) {
    errorHandler.writeLog('info', '没有窗口，创建新窗口');
    createWindow();
  }
});

//注册所有IPC处理器
ipcMain.handle('subtitle:extract', async (event, videoPath, options) => {
  errorHandler.writeLog('info', 'IPC字幕提取请求', { videoPath, options });
  try {
    const result = await extractSubtitle(videoPath, options);
    errorHandler.logSuccess('字幕提取', { videoPath, options });
    return { success: true, result };
  } catch (error) {
    return errorHandler.handleSubtitleError(error, videoPath, options);
  }
});

ipcMain.handle('subtitle:checkExists', async (event, videoPath, modelName, language, targetLang, subtitleOrder) => {
  errorHandler.writeLog('info', 'IPC检查字幕存在请求', { videoPath, modelName, language, targetLang, subtitleOrder });
  try {
    const exists = checkSubtitleExists(videoPath, modelName, language, targetLang, subtitleOrder);
    errorHandler.writeLog('info', 'IPC字幕存在检查结果', { exists, videoPath, modelName, language, targetLang, subtitleOrder });
    return { success: true, exists };
  } catch (error) {
    return errorHandler.handleIpcError(error, '检查字幕文件', { videoPath, modelName, language, targetLang, subtitleOrder });
  }
});

ipcMain.handle('subtitle:listModels', async () => {
  errorHandler.writeLog('info', 'IPC获取模型列表请求');
  try {
    const models = listModels();
    errorHandler.writeLog('info', 'IPC模型列表获取成功', { models });
    return { success: true, models };
  } catch (error) {
    return errorHandler.handleIpcError(error, '获取模型列表');
  }
});

ipcMain.handle('dialog:openFile', async () => {
  errorHandler.writeLog('info', 'IPC打开文件对话框请求');
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    errorHandler.writeLog('info', 'IPC文件对话框结果', { result });
    return { success: true, result };
  } catch (error) {
    return errorHandler.handleIpcError(error, '打开文件对话框');
  }
});

ipcMain.handle('platform:refreshPermissions', async (event, binaryName = null) => {
  errorHandler.writeLog('info', 'IPC刷新二进制权限请求', { binaryName });
  try {
    const result = await platformManager.refreshBinaryPermissions(binaryName);
    errorHandler.logSuccess('刷新二进制权限', { binaryName, result });
    return { success: true, result };
  } catch (error) {
    return errorHandler.handleIpcError(error, '刷新二进制权限', { binaryName });
  }
});

async function initializePlatform() {
  errorHandler.writeLog('info', '开始平台初始化');
  try {
    const platform = platformManager.getPlatformArch();
    errorHandler.writeLog('info', '当前平台', { platform });
    
    await platformManager.createPlatformStructure();
    errorHandler.writeLog('info', '平台目录结构创建完成');
    
    const results = await platformManager.ensureAllBinaryPermissions();
    errorHandler.writeLog('info', '二进制权限设置结果', { results });
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
      errorHandler.logSuccess('平台初始化', { platform, results });
    } else {
      errorHandler.logWarning(`平台初始化部分成功: ${successCount}/${totalCount}`, { platform, results });
    }
  } catch (error) {
    errorHandler.writeLog('error', '平台初始化失败', error);
  }
}

const createMenu = () => {
  errorHandler.writeLog('info', '创建应用菜单');
  const template = [
    {
      label: '关于',
      submenu: [
        {
          label: '关于 iTools',
          click: () => {
            errorHandler.writeLog('info', '显示关于对话框');
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
