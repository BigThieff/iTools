const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  checkSubtitleExists: (videoPath, modelName, language, targetLang) =>
    ipcRenderer.invoke(
      'subtitle:checkExists',
      videoPath,
      modelName,
      language,
      targetLang,
    ),
  extractSubtitle: (videoPath, options) =>
    ipcRenderer.invoke('subtitle:extract', videoPath, options),
  // ...其他API...
});
