import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Select,
  Radio,
  Divider,
  Typography,
  message,
  Tooltip,
  Space,
  Progress,
} from 'antd';
import {
  FileOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { LANGUAGES, MODEL_INFOS } from '../constants/languages.js';
import { getUserFriendlyError } from '../utils/errorMessages.js';
import { FILE_VALIDATION } from '../utils/fileValidation.js';
import { configManager } from '../utils/configManager.js';
import './SubtitleExtractor.css';

const { Title, Text } = Typography;
const { Option } = Select;

export default function SubtitleExtractor() {
  const [videoPath, setVideoPath] = useState('');
  const [status, setStatus] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [language, setLanguage] = useState('zh');
  const [subtitleType, setSubtitleType] = useState('single');
  const [targetLang, setTargetLang] = useState('en');
  const [subtitleOrder, setSubtitleOrder] = useState('main-first');
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const contentRef = useRef(null);

  // 加载用户配置
  useEffect(() => {
    const config = configManager.getConfig();
    if (config.rememberLastSettings) {
      setLanguage(config.defaultLanguage);
      setSubtitleType(config.defaultSubtitleType);
    }
  }, []);

  // 快捷键支持 - 使用 useRef 获取最新状态值
  const latestState = useRef();
  latestState.current = {
    isExtracting,
    videoPath,
    selectedModel,
    language,
    subtitleType,
    targetLang,
    subtitleOrder
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const current = latestState.current;
      
      // Ctrl/Cmd + O: 选择文件
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
        event.stopPropagation();
        if (!current.isExtracting) {
          handleSelectFile();
        }
        return;
      }
      
      // Ctrl/Cmd + Enter: 开始提取字幕
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !current.isExtracting && current.videoPath && current.selectedModel) {
        event.preventDefault();
        event.stopPropagation();
        handleExtract();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // 使用 capture 阶段
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []); // 空依赖数组，因为我们使用 ref 获取最新值

  useEffect(() => {
    window.api.listModels().then((response) => {
      if (response.success && Array.isArray(response.models)) {
        setModels(response.models);
        const defaultModel = response.models.find((model) => model.includes('small')) || response.models[0];
        if (defaultModel) {
          setSelectedModel(defaultModel);
        }
      } else {
        setModels([]);
      }
    }).catch((error) => {
      setModels([]);
    });
  }, []);

  useEffect(() => {
    if (subtitleType === 'dual' && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [subtitleType]);

  const handleSelectFile = async () => {
    const filePath = await window.api.selectFile();
    if (filePath) {
      // 验证文件格式
      if (!FILE_VALIDATION.validateFileFormat(filePath)) {
        message.warning({
          content: `不支持的文件格式，支持的格式：${FILE_VALIDATION.SUPPORTED_FORMATS.join(', ')}`,
          duration: 4,
        });
        return;
      }
      
      setVideoPath(filePath);
      setStatus('');
      
      // 保存用户设置
      const config = configManager.getConfig();
      if (config.rememberLastSettings) {
        configManager.saveConfig({
          defaultLanguage: language,
          defaultSubtitleType: subtitleType,
        });
      }
    }
  };

  const handleExtract = async () => {
    // 从 latestState 获取最新的状态值，确保快捷键和按钮行为一致
    const current = latestState.current;
    let progressInterval = null;
    
    try {
      const response = await window.api.checkSubtitleExists(
        current.videoPath,
        current.selectedModel,
        current.language,
        current.subtitleType === 'dual' ? current.targetLang : undefined,
        current.subtitleOrder,
      );

      const exists = response.success ? response.exists : false;
      
      console.log('字幕存在检查结果:', { 
        exists, 
        videoPath: current.videoPath, 
        model: current.selectedModel, 
        language: current.language, 
        subtitleType: current.subtitleType,
        targetLang: current.targetLang 
      });

      if (exists) {
        const modelDisplay = current.selectedModel.replace(/^ggml-/, '').replace('.bin', '');
        const langDisplay = LANGUAGES.find(l => l.value === current.language)?.label || current.language;
        let tipMessage = `已存在 ${modelDisplay} 模型的 ${langDisplay} 字幕`;
        if (current.subtitleType === 'dual') {
          const targetDisplay = LANGUAGES.find(l => l.value === current.targetLang)?.label || current.targetLang;
          tipMessage += ` 和 ${targetDisplay} 字幕`;
        }
        
        message.info({
          content: `${tipMessage}，无需重复提取`,
          duration: 5,
          style: { marginTop: '20vh' },
        });
        setStatus(`✅ ${tipMessage}`);
        return;
      }

      setIsExtracting(true);
      setProgress(0);
      setProgressText('准备中...');

      const fileName = current.videoPath.split('/').pop();
      setStatus(`正在处理：${fileName}`);

      // 优化的进度更新机制
      let currentProgress = 0;
      let currentStage = 0;
      const stages = [
        { text: '音频提取中...', maxProgress: 25, speed: 0.8 },
        { text: '语音识别中...', maxProgress: 85, speed: 0.4 },
        { text: '字幕生成中...', maxProgress: 96, speed: 0.2 }
      ];

      progressInterval = setInterval(() => {
        const stage = stages[currentStage];
        if (!stage) return;

        // 计算当前阶段的进度增长
        const increment = Math.random() * stage.speed + 0.1;
        currentProgress = Math.min(currentProgress + increment, stage.maxProgress);
        
        setProgress(currentProgress);
        setProgressText(stage.text);

        // 当接近当前阶段最大进度时，切换到下一阶段
        if (currentProgress >= stage.maxProgress - 2 && currentStage < stages.length - 1) {
          currentStage++;
        }
      }, 200); // 更频繁的更新，让进度条更流畅

      const result = await window.api.extractSubtitle(current.videoPath, {
        modelName: current.selectedModel,
        language: current.language,
        dual: current.subtitleType === 'dual',
        targetLang: current.subtitleType === 'dual' ? current.targetLang : undefined,
        subtitleOrder: current.subtitleOrder,
      });

      // 在实际完成时快速完成进度条
      if (progressInterval) clearInterval(progressInterval);
      
      // 快速推进到98%，然后到100%
      setProgress(98);
      setProgressText('正在完成...');
      
      setTimeout(() => {
        setProgress(100);
        setProgressText('完成！');
        
        setTimeout(() => {
          if (result.success) {
            if (current.subtitleType === 'dual') {
              setStatus(`双语字幕生成成功：${fileName}`);
              message.success({
                content: '双语字幕生成成功！',
                duration: 3,
              });
            } else {
              setStatus(`字幕生成成功：${fileName}`);
              message.success({
                content: '字幕生成成功！',
                duration: 3,
              });
            }
          } else {
            throw new Error(result.error || '字幕提取失败');
          }
        }, 500); // 让用户看到"完成！"状态
      }, 200);
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      setProgress(0);
      setProgressText('');
      
      const friendlyError = getUserFriendlyError(error);
      setStatus(`失败：${friendlyError}`);
      message.error({
        content: friendlyError,
        duration: 5,
      });
    } finally {
      setIsExtracting(false);
      setProgress(0);
      setProgressText('');
    }
  };

  return (
    <Card
      className="subtitle-extractor-card"
      title={<Title level={3}>🎬 字幕提取工具</Title>}
      bordered={false}
      ref={contentRef}
    >
      <Space
        direction="vertical"
        size="large"
        style={{ width: '100%', height: '100%' }}
      >
        {/* 模型选择 */}
        <div className="subtitle-extractor-row">
          <span>
            选择模型（平衡速度与精度）
            <Tooltip title="选择不同模型可平衡速度与精度">
              <QuestionCircleOutlined style={{ fontSize: 12, marginLeft: 4 }} />
            </Tooltip>
          </span>
          <Select
            style={{ width: 200 }}
            value={selectedModel}
            onChange={setSelectedModel}
            placeholder="请选择模型"
          >
            {Array.isArray(models) && models.map((m) => (
              <Option key={m} value={m}>
                {m
                  .replace(/^ggml-/, '')
                  .replace('.bin', '')
                  .replace(/^\w/, (s) => s.toUpperCase())}
              </Option>
            ))}
          </Select>
        </div>
        {/* 视频语言 */}
        <div className="subtitle-extractor-row">
          <span>
            视频主要语言
            <Tooltip title="请选择视频中说话的主要语言，影响识别准确率">
              <QuestionCircleOutlined style={{ fontSize: 12, marginLeft: 4 }} />
            </Tooltip>
          </span>
          <Select
            style={{ width: 160 }}
            value={language}
            onChange={setLanguage}
          >
            {LANGUAGES.map((l) => (
              <Option key={l.value} value={l.value}>
                {l.label}
              </Option>
            ))}
          </Select>
        </div>
        {/* 字幕类型 */}
        <div className="subtitle-extractor-row">
          <span>
            字幕生成类型
            <Tooltip title="单语言：仅提取视频原始字幕。双语言：会自动翻译生成第二种语言，翻译质量依赖模型，可能不如原文准确。">
              <QuestionCircleOutlined style={{ fontSize: 12, marginLeft: 4 }} />
            </Tooltip>
          </span>
          <Radio.Group
            value={subtitleType}
            onChange={(e) => setSubtitleType(e.target.value)}
          >
            <Radio value="single">单语言</Radio>
            <Radio value="dual">双语言</Radio>
          </Radio.Group>
        </div>

        {/* 第二语言 */}
        {subtitleType === 'dual' && (
          <div className="subtitle-extractor-row">
            <span>
              翻译目标语言
              <Tooltip title="第二语言为机器翻译结果，仅供参考。">
                <QuestionCircleOutlined
                  style={{ fontSize: 12, marginLeft: 4 }}
                />
              </Tooltip>
            </span>
            <Select
              style={{ width: 160 }}
              value={targetLang}
              onChange={setTargetLang}
              options={LANGUAGES.filter((l) => l.value !== language && l.value !== 'auto')}
            />
          </div>
        )}

        {/* 字幕顺序 */}
        {subtitleType === 'dual' && (
          <div className="subtitle-extractor-row">
            <span>
              字幕显示顺序
              <Tooltip title="选择字幕显示顺序：主语言在上或目标语言在上">
                <QuestionCircleOutlined
                  style={{ fontSize: 12, marginLeft: 4 }}
                />
              </Tooltip>
            </span>
            <Radio.Group
              value={subtitleOrder}
              onChange={(e) => setSubtitleOrder(e.target.value)}
            >
              <Radio value="main-first">主语言在上</Radio>
              <Radio value="target-first">目标语言在上</Radio>
            </Radio.Group>
          </div>
        )}
        <Divider style={{ margin: '8px 0' }} />
        <div className="subtitle-extractor-buttons">
          <Button
            type="primary"
            icon={<FileOutlined />}
            onClick={handleSelectFile}
            disabled={isExtracting}
            block
          >
            选择视频文件 <span style={{ opacity: 0.7 }}>(Ctrl+O)</span>
          </Button>
          {videoPath && (
            <div className="subtitle-extractor-path">
              <FileOutlined className="subtitle-extractor-icon" />
              <span title={videoPath} className="subtitle-extractor-path-text">
                {videoPath.length > 40
                  ? videoPath.slice(0, 18) + '...' + videoPath.slice(-18)
                  : videoPath}
              </span>
            </div>
          )}
          <Button
            type="default"
            icon={<PlayCircleOutlined />}
            onClick={handleExtract}
            disabled={!videoPath || !selectedModel || isExtracting}
            block
          >
            提取字幕 <span style={{ opacity: 0.7 }}>(Ctrl+Enter)</span>
          </Button>
        </div>
        
        {/* 进度条显示 */}
        {isExtracting && (
          <div style={{ margin: '16px 0' }}>
            <Progress 
              percent={Math.round(progress)} 
              format={() => progressText}
              status="active"
              strokeColor={{
                '0%': '#8a8a8a',
                '50%': '#a8a8a8',
                '100%': '#8a8a8a',
              }}
              trailColor="#f0f0f0"
              strokeWidth={10}
              style={{
                fontSize: '13px',
                fontWeight: '500',
              }}
              strokeLinecap="round"
            />
          </div>
        )}
        
        <Text type={status.startsWith('失败') ? 'danger' : 'success'}>
          {status}
        </Text>
      </Space>
    </Card>
  );
}
