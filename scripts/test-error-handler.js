#!/usr/bin/env node
/**
 * 测试 ErrorHandler 在不同环境下的行为
 */

const path = require('path');

// 模拟不同的 Electron 环境
function testErrorHandler(testName, mockElectron = null) {
  console.log(`\n🧪 测试: ${testName}`);
  
  // 清除之前的 require 缓存
  const errorHandlerPath = path.join(__dirname, '../utils/error-handler.cjs');
  delete require.cache[require.resolve(errorHandlerPath)];
  
  // 设置模拟的 electron 模块
  if (mockElectron) {
    require.cache[require.resolve('electron')] = { exports: mockElectron };
  } else {
    delete require.cache[require.resolve('electron')];
  }
  
  try {
    const ErrorHandler = require(errorHandlerPath);
    const errorHandler = new ErrorHandler();
    
    console.log(`✅ 成功创建 ErrorHandler`);
    console.log(`📁 日志目录: ${errorHandler.logDir}`);
    
    // 测试日志写入
    errorHandler.writeLog('info', '测试日志消息');
    console.log(`📝 日志写入测试成功`);
    
    return true;
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    return false;
  }
}

// 运行测试
console.log('🚀 开始 ErrorHandler 兼容性测试\n');

// 测试 1: 没有 Electron 环境
testErrorHandler('非 Electron 环境');

// 测试 2: Electron 环境但 app 未就绪
testErrorHandler('Electron 环境 - app 未就绪', {
  app: {
    isReady: () => false,
    getPath: () => { throw new Error('App not ready'); }
  }
});

// 测试 3: Electron 环境且 app 已就绪
const os = require('os');
testErrorHandler('Electron 环境 - app 已就绪', {
  app: {
    isReady: () => true,
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'test-itools-userdata');
      }
      throw new Error('Unknown path');
    }
  }
});

console.log('\n✨ ErrorHandler 兼容性测试完成');
