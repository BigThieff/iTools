const { contextBridge, ipcRenderer, dialog } = require('electron');

// 这里先空着，后续可以用来安全地暴露Node功能给前端
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded');
});

contextBridge.exposeInMainWorld('api', {
  extractSubtitle: (videoPath, options) =>
    ipcRenderer.invoke('subtitle:extract', videoPath, options),
  selectFile: async () => {
    const { canceled, filePaths } = await ipcRenderer.invoke('dialog:openFile');
    if (canceled) return null;
    return filePaths[0];
  },
});
