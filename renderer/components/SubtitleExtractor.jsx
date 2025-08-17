import React, { useState, useEffect, useRef } from 'react';
import Card from 'antd/es/card';
import Button from 'antd/es/button';
import Select from 'antd/es/select';
import Radio from 'antd/es/radio';
import Divider from 'antd/es/divider';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import Tooltip from 'antd/es/tooltip';
import Space from 'antd/es/space';
import Progress from 'antd/es/progress';
import { LANGUAGES } from '../constants/languages.js';
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
  const [stage, setStage] = useState('');
  const smoothTimerRef = useRef(null);
  const contentRef = useRef(null);

  const clearSmoothTimer = () => {
    if (smoothTimerRef.current) {
      clearInterval(smoothTimerRef.current);
      smoothTimerRef.current = null;
    }
  };

  const stageCeiling = (st) => {
    switch (st) {
      case 'init': return 8;      // 初始化最多到 8%
      case 'audio': return 48;    // 音频阶段最多到 48%
      case 'whisper': return 88;  // 识别阶段最多到 88%
      default: return 0;
    }
  };

  const getStageSpeed = (st) => {
    switch (st) {
      case 'init': return 0.5;    // 初始化较快
      case 'audio': return 0.4;   // 音频提取中等速度
      case 'whisper': return 0.15; // 语音识别较慢，反映真实处理时间
      default: return 0.3;
    }
  };

  // 加载用户配置与进度监听
  useEffect(() => {
    const config = configManager.getConfig();
    if (config.rememberLastSettings) {
      setLanguage(config.defaultLanguage);
      setSubtitleType(config.defaultSubtitleType);
    }

    window.api.onSubtitleProgress((progressData) => {
      const { stage: st, progress: p } = progressData;
      setStage(st);
      switch (st) {
        case 'init':
          setProgressText('准备中...');
          setProgress(prev => Math.max(prev, 2));
          break;
        case 'audio': {
          setProgressText('音频提取中...');
          if (typeof p === 'number') {
            if (p >= 50) {
              setProgress(prev => Math.max(prev, 50)); // 阶段结束
            } else if (p >= 10) {
              setProgress(prev => Math.max(prev, 10)); // 阶段开始
            }
          } else {
            setProgress(prev => Math.max(prev, 10));
          }
          break;
        }
        case 'whisper': {
          setProgressText('语音识别中...');
          if (typeof p === 'number') {
            if (p >= 90) {
              setProgress(prev => Math.max(prev, 90));
            } else if (p >= 50) {
              setProgress(prev => Math.max(prev, 52));
            }
          } else {
            setProgress(prev => Math.max(prev, 52));
          }
          break;
        }
        case 'finish':
          setProgressText('完成');
          clearSmoothTimer();
          setProgress(100);
          break;
        default:
          setProgressText('处理中...');
      }
    });

    return () => {
      window.api.removeSubtitleProgressListener();
      clearSmoothTimer();
    };
  }, []);

  // 阶段平滑推进：根据不同阶段使用不同速度
  useEffect(() => {
    clearSmoothTimer();
    if (!isExtracting) return;
    if (!stage || stage === 'finish') return;

    const ceiling = stageCeiling(stage);
    if (ceiling <= 0) return;

    const speed = getStageSpeed(stage);
    
    smoothTimerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= ceiling) return prev;
        const step = speed; // 使用阶段特定的速度
        const next = Math.min(ceiling, prev + step);
        return next;
      });
    }, 100);

    return clearSmoothTimer;
  }, [stage, isExtracting]);

  // 快捷键支持
  const latestState = useRef();
  latestState.current = { isExtracting, videoPath, selectedModel, language, subtitleType, targetLang, subtitleOrder };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const current = latestState.current;
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
        event.stopPropagation();
        if (!current.isExtracting) {
          handleSelectFile();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !current.isExtracting && current.videoPath && current.selectedModel) {
        event.preventDefault();
        event.stopPropagation();
        handleExtract();
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  useEffect(() => {
    window.api.listModels().then((response) => {
      if (response.success && Array.isArray(response.models)) {
        setModels(response.models);
        const def = response.models.find((m) => m.includes('small')) || response.models[0];
        if (def) setSelectedModel(def);
      } else {
        setModels([]);
      }
    }).catch(() => setModels([]));
  }, []);

  useEffect(() => {
    if (subtitleType === 'dual' && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [subtitleType]);

  const handleSelectFile = async () => {
    const filePath = await window.api.selectFile();
    if (filePath) {
      if (!FILE_VALIDATION.validateFileFormat(filePath)) {
        message.warning({ content: `不支持的文件格式，支持的格式：${FILE_VALIDATION.SUPPORTED_FORMATS.join(', ')}`, duration: 4 });
        return;
      }
      setVideoPath(filePath);
      setStatus('');
      const config = configManager.getConfig();
      if (config.rememberLastSettings) {
        configManager.saveConfig({ defaultLanguage: language, defaultSubtitleType: subtitleType });
      }
    }
  };

  const handleExtract = async () => {
    const current = latestState.current;
    let completed = false;
    try {
      const response = await window.api.checkSubtitleExists(
        current.videoPath,
        current.selectedModel,
        current.language,
        current.subtitleType === 'dual' ? current.targetLang : undefined,
        current.subtitleOrder,
      );
      const exists = response.success ? response.exists : false;
      if (exists) {
        const modelDisplay = current.selectedModel.replace(/^ggml-/, '').replace('.bin', '');
        const langDisplay = LANGUAGES.find(l => l.value === current.language)?.label || current.language;
        let tipMessage = `已存在 ${modelDisplay} 模型的 ${langDisplay} 字幕`;
        if (current.subtitleType === 'dual') {
          const targetDisplay = LANGUAGES.find(l => l.value === current.targetLang)?.label || current.targetLang;
          tipMessage += ` 和 ${targetDisplay} 字幕`;
        }
        message.info({ content: `${tipMessage}，无需重复提取`, duration: 5, style: { marginTop: '20vh' } });
        setStatus(`✅ ${tipMessage}`);
        return;
      }

      setIsExtracting(true);
      setStage('init');
      setProgress(0);
      setProgressText('准备中...');
      const fileName = current.videoPath.split('/').pop();
      setStatus(`正在处理：${fileName}`);

      const result = await window.api.extractSubtitle(current.videoPath, {
        modelName: current.selectedModel,
        language: current.language,
        dual: current.subtitleType === 'dual',
        targetLang: current.subtitleType === 'dual' ? current.targetLang : undefined,
        subtitleOrder: current.subtitleOrder,
      });

      if (result.success) {
        setStage('finish');
        setProgress(100);
        setProgressText('完成');
        if (current.subtitleType === 'dual') {
          setStatus(`双语字幕生成成功：${fileName}`);
          message.success({ content: '双语字幕生成成功！', duration: 3 });
        } else {
          setStatus(`字幕生成成功：${fileName}`);
          message.success({ content: '字幕生成成功！', duration: 3 });
        }
        completed = true;
      } else {
        throw new Error(result.error || '字幕提取失败');
      }
    } catch (error) {
      setProgress(0);
      setStage('');
      setProgressText('');
      const friendlyError = getUserFriendlyError(error);
      setStatus(`失败：${friendlyError}`);
      message.error({ content: friendlyError, duration: 5 });
    } finally {
      if (completed) {
        setTimeout(() => {
          setIsExtracting(false);
          clearSmoothTimer();
          setTimeout(() => { setProgress(0); setProgressText(''); }, 300);
        }, 1200);
      } else {
        setIsExtracting(false);
        clearSmoothTimer();
        setTimeout(() => { setProgress(0); setProgressText(''); }, 500);
      }
    }
  };

  return (
    <Card className="subtitle-extractor-card" title={<Title level={3}>字幕提取工具</Title>} bordered={false} ref={contentRef}>
      <Space direction="vertical" size="large" style={{ width: '100%', height: '100%' }}>
        {/* 模型选择 */}
        <div className="subtitle-extractor-row">
          <span className="label-with-q">
            选择模型（平衡速度与精度）
            <Tooltip title="选择不同模型可平衡速度与精度">
              <span className="qmark">?</span>
            </Tooltip>
          </span>
          <Select style={{ width: 200 }} value={selectedModel} onChange={setSelectedModel} placeholder="请选择模型">
            {Array.isArray(models) && models.map((m) => (
              <Option key={m} value={m}>
                {m.replace(/^ggml-/, '').replace('.bin', '').replace(/^\w/, (s) => s.toUpperCase())}
              </Option>
            ))}
          </Select>
        </div>
        
        {/* 视频语言 */}
        <div className="subtitle-extractor-row">
          <span className="label-with-q">
            视频主要语言
            <Tooltip title="请选择视频中说话的主要语言，影响识别准确率">
              <span className="qmark">?</span>
            </Tooltip>
          </span>
          <Select style={{ width: 160 }} value={language} onChange={setLanguage}>
            {LANGUAGES.map((l) => (
              <Option key={l.value} value={l.value}>{l.label}</Option>
            ))}
          </Select>
        </div>

        {/* 字幕类型 */}
        <div className="subtitle-extractor-row">
          <span className="label-with-q">
            字幕生成类型
            <Tooltip title="单语言：仅提取视频原始字幕。双语言：会自动翻译生成第二种语言，翻译质量依赖模型，可能不如原文准确。">
              <span className="qmark">?</span>
            </Tooltip>
          </span>
          <Radio.Group value={subtitleType} onChange={(e) => setSubtitleType(e.target.value)}>
            <Radio value="single">单语言</Radio>
            <Radio value="dual">双语言</Radio>
          </Radio.Group>
        </div>

        {/* 第二语言 */}
        {subtitleType === 'dual' && (
          <div className="subtitle-extractor-row">
            <span className="label-with-q">
              翻译目标语言
              <Tooltip title="第二语言为机器翻译结果，仅供参考。">
                <span className="qmark">?</span>
              </Tooltip>
            </span>
            <Select style={{ width: 160 }} value={targetLang} onChange={setTargetLang} options={LANGUAGES.filter((l) => l.value !== language && l.value !== 'auto')} />
          </div>
        )}

        {/* 字幕顺序 */}
        {subtitleType === 'dual' && (
          <div className="subtitle-extractor-row">
            <span className="label-with-q">
              字幕显示顺序
              <Tooltip title="选择字幕显示顺序：主语言在上或目标语言在上">
                <span className="qmark">?</span>
              </Tooltip>
            </span>
            <Radio.Group value={subtitleOrder} onChange={(e) => setSubtitleOrder(e.target.value)}>
              <Radio value="main-first">主语言在上</Radio>
              <Radio value="target-first">目标语言在上</Radio>
            </Radio.Group>
          </div>
        )}

        <Divider style={{ margin: '8px 0' }} />
        <div className="subtitle-extractor-buttons">
          <Button type="primary" onClick={handleSelectFile} disabled={isExtracting} block>
            选择视频文件 <span style={{ opacity: 0.7 }}>(Ctrl+O)</span>
          </Button>
          {videoPath && (
            <div className="subtitle-extractor-path">
              <span title={videoPath} className="subtitle-extractor-path-text">
                {videoPath.length > 40 ? videoPath.slice(0, 18) + '...' + videoPath.slice(-18) : videoPath}
              </span>
            </div>
          )}
          <Button type="default" onClick={handleExtract} disabled={!videoPath || !selectedModel || isExtracting} block>
            提取字幕 <span style={{ opacity: 0.7 }}>(Ctrl+Enter)</span>
          </Button>
        </div>
        
        {isExtracting && (
          <div style={{ margin: '16px 0' }}>
            <Progress percent={Math.round(progress)} format={() => progressText} status="active" strokeColor="#1677ff" trailColor="#f0f0f0" strokeWidth={10} style={{ fontSize: '13px', fontWeight: '500' }} strokeLinecap="round" />
          </div>
        )}
        
        <Text type={status.startsWith('失败') ? 'danger' : 'success'}>{status}</Text>
      </Space>
    </Card>
  );
}
