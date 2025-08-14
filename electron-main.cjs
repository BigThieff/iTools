const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');

// 导入字幕工具函数
const { extractSubtitle, checkSubtitleExists, listModels } = require('./tools/subtitle/subtitle-processor.cjs');
const fs = require('fs');

// 引入各工具
const { version } = require('./package.json');

function createWindow() {
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
}

app.whenReady().then(() => {
  grantBinExecPermission(); // 先赋予权限
  createMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 统一注册IPC，便于扩展
ipcMain.handle('subtitle:extract', async (event, videoPath, options) => {
  console.log('主进程收到提取字幕请求:', videoPath, options);
  try {
    const result = await extractSubtitle(videoPath, options);
    console.log('主进程字幕提取成功:', result);
    return result;
  } catch (e) {
    console.error('主进程字幕提取失败:', e.message);
    throw e;
  }
});

ipcMain.handle('subtitle:checkExists', (event, videoPath, modelName, language, targetLang) => {
  console.log('主进程收到检查字幕存在请求:', videoPath, modelName, language, targetLang);
  return checkSubtitleExists(videoPath, modelName, language, targetLang);
});

ipcMain.handle('subtitle:listModels', () => {
  console.log('主进程收到列表模型请求');
  return listModels();
});

ipcMain.handle('dialog:openFile', async () => {
  console.log('主进程收到打开文件对话框请求');
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  console.log('文件选择结果:', result);
  return result;
});

const MODEL_DIR = path.join(__dirname, 'models', 'ggml');

function grantBinExecPermission() {
  const binDir = path.join(__dirname, 'bin');
  if (!fs.existsSync(binDir)) return;
  const files = fs.readdirSync(binDir);
  files.forEach(file => {
    const filePath = path.join(binDir, file);
    try {
      // 只为文件赋权，忽略文件夹
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        fs.chmodSync(filePath, '755');
        console.log(`赋予可执行权限: ${filePath}`);
      }
    } catch (e) {
      console.error(`赋予可执行权限失败: ${filePath}，错误: ${e.message}`);
    }
  });
}

// 设置只含"关于"的菜单
const createMenu = () => {
  const template = [
    {
      label: '关于',
      submenu: [
        {
          label: '关于 iTools',
          click: () => {
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
