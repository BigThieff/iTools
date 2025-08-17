const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  extractSubtitle: (videoPath, options) => {
    return ipcRenderer.invoke('subtitle:extract', videoPath, options);
  },
  
  // 监听进度更新
  onSubtitleProgress: (callback) => {
    ipcRenderer.on('subtitle:progress', (event, progressData) => callback(progressData));
  },
  
  // 移除进度监听器
  removeSubtitleProgressListener: () => {
    ipcRenderer.removeAllListeners('subtitle:progress');
  },
  
  selectFile: async () => {
    const response = await ipcRenderer.invoke('dialog:openFile');
    if (!response.success) {
      return null;
    }
    const { canceled, filePaths } = response.result;
    if (canceled) {
      return null;
    }
    return filePaths[0];
  },
  
  listModels: () => {
    return ipcRenderer.invoke('subtitle:listModels');
  },
  
  checkSubtitleExists: (videoPath, modelName, language, targetLang, subtitleOrder) => {
    return ipcRenderer.invoke('subtitle:checkExists', videoPath, modelName, language, targetLang, subtitleOrder);
  },
});
