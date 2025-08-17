// 用户配置管理
export class ConfigManager {
  constructor() {
    this.storageKey = 'itools-config';
    this.defaultConfig = {
      defaultLanguage: 'zh',
      defaultModel: 'ggml-small.bin',
      defaultSubtitleType: 'single',
      autoOpenSubtitleFile: true,
      rememberLastSettings: true,
      outputDirectory: null, // null表示使用视频文件同目录
    };
  }
  
  // 获取配置
  getConfig() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return { ...this.defaultConfig, ...JSON.parse(stored) };
      }
    } catch (error) {
      // 静默处理读取错误，返回默认配置
    }
    return this.defaultConfig;
  }
  
  // 保存配置
  saveConfig(config) {
    try {
      const mergedConfig = { ...this.getConfig(), ...config };
      localStorage.setItem(this.storageKey, JSON.stringify(mergedConfig));
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // 重置为默认配置
  resetConfig() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // 导出配置
  exportConfig() {
    const config = this.getConfig();
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'itools-config.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  
  // 导入配置
  importConfig(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);
          if (this.saveConfig(config)) {
            resolve(config);
          } else {
            reject(new Error('保存配置失败'));
          }
        } catch (error) {
          reject(new Error('配置文件格式错误'));
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }
}

export const configManager = new ConfigManager();
