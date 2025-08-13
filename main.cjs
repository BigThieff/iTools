const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 引入各工具
const subtitleTool = require('./tools/subtitle/index.cjs');
const { version } = require('./package.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
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
  return subtitleTool.extractSubtitle(videoPath, options);
});

ipcMain.handle('dialog:openFile', async () => {
  return await dialog.showOpenDialog({ properties: ['openFile'] });
});

const MODEL_DIR = path.join(__dirname, 'models', 'ggml');

ipcMain.handle('subtitle:listModels', async () => {
  try {
    const files = fs.readdirSync(MODEL_DIR)
      .filter(f => f.endsWith('.bin'));
    return files;
  } catch (e) {
    return [];
  }
});

function grantBinExecPermission() {
  const binDir = path.join(__dirname, 'bin');
  if (!fs.existsSync(binDir)) return;
  const files = fs.readdirSync(binDir);
  files.forEach(file => {
    const filePath = path.join(binDir, file);
    try {
      // 只为文件赋权，忽略目录
      if (fs.statSync(filePath).isFile()) {
        fs.chmodSync(filePath, 0o755);
      }
    } catch (e) {
      console.warn(`无法赋予执行权限: ${filePath}`, e.message);
    }
  });
}

// 在 app.whenReady() 前调用
grantBinExecPermission();

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
