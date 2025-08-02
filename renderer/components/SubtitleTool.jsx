import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  message,
  Select,
  Divider,
  Tooltip,
  Radio,
} from 'antd';
import {
  FileOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import './SubtitleTool.css';

const { Title, Text } = Typography;
const { Option } = Select;

const LANGUAGES = [
  { label: '中文', value: 'zh' },
  { label: '英文', value: 'en' },
  { label: '日文', value: 'ja' },
  { label: '韩文', value: 'ko' },
  { label: '法文', value: 'fr' },
  { label: '德文', value: 'de' },
  { label: '西班牙文', value: 'es' },
];

const MODEL_INFOS = {
  'ggml-base.bin': 'Base：速度最快，精度较低，适合快速预览',
  'ggml-small.bin': 'Small：速度快，精度中等，推荐日常使用',
  'ggml-medium.bin': 'Medium：速度较慢，精度高，适合高质量需求',
};

export default function SubtitleTool() {
  const [videoPath, setVideoPath] = useState('');
  const [status, setStatus] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [language, setLanguage] = useState('zh');
  const [subtitleType, setSubtitleType] = useState('single');
  const [targetLang, setTargetLang] = useState('en');

  useEffect(() => {
    window.api.listModels().then((list) => {
      setModels(list);
      if (list.length > 0) setSelectedModel(list[0]);
    });
  }, []);

  const handleSelectFile = async () => {
    const filePath = await window.api.selectFile();
    if (filePath) {
      setVideoPath(filePath);
      setStatus('');
    }
  };

  const handleExtract = async () => {
    setStatus('处理中...');
    try {
      const options = {
        modelName: selectedModel,
        language,
        dual: subtitleType === 'dual',
        targetLang: subtitleType === 'dual' ? targetLang : undefined,
      };
      const srtPath = await window.api.extractSubtitle(videoPath, options);
      setStatus(`字幕生成成功：${srtPath}`);
      message.success('字幕生成成功！');
    } catch (e) {
      setStatus(`失败：${e.message}`);
      message.error('字幕生成失败');
    }
  };

  return (
    <Card
      className="subtitle-tool-card"
      title={<Title level={3}>🎬 字幕提取工具</Title>}
      bordered={false}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 模型选择 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>模型选择：</span>
          <Select
            style={{ width: 200 }}
            value={selectedModel}
            onChange={setSelectedModel}
            placeholder="请选择模型"
          >
            {models.map((m) => (
              <Option key={m} value={m}>
                {m
                  .replace(/^ggml-/, '')
                  .replace('.bin', '')
                  .replace(/^(\w)/, (s) => s.toUpperCase())}
              </Option>
            ))}
          </Select>
          <Tooltip
            title={MODEL_INFOS[selectedModel] || '选择不同模型可平衡速度与精度'}
          >
            <QuestionCircleOutlined
              style={{ color: '#1677ff', cursor: 'pointer' }}
            />
          </Tooltip>
        </div>
        {/* 语言选择 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>视频语言：</span>
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
          <Tooltip title="请选择视频中说话的主要语言，影响识别准确率">
            <QuestionCircleOutlined
              style={{ color: '#1677ff', cursor: 'pointer' }}
            />
          </Tooltip>
        </div>
        {/* 字幕类型选择 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>字幕类型：</span>
          <Radio.Group
            value={subtitleType}
            onChange={(e) => setSubtitleType(e.target.value)}
            style={{ marginRight: 8 }}
          >
            <Radio value="single">单语言</Radio>
            <Radio value="dual">双语言</Radio>
          </Radio.Group>
          <Tooltip title="单语言：仅提取视频原始字幕。双语言：会自动翻译生成第二种语言，翻译质量依赖模型，可能不如原文准确。">
            <QuestionCircleOutlined
              style={{ color: '#1677ff', cursor: 'pointer' }}
            />
          </Tooltip>
        </div>
        {/* 目标语言选择，仅双语时显示 */}
        {subtitleType === 'dual' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>第二语言：</span>
            <Select
              style={{ width: 160 }}
              value={targetLang}
              onChange={setTargetLang}
              // 不允许选择与原语言相同
              options={LANGUAGES.filter((l) => l.value !== language)}
            />
            <Tooltip title="第二语言为机器翻译结果，仅供参考。">
              <QuestionCircleOutlined
                style={{ color: '#1677ff', cursor: 'pointer' }}
              />
            </Tooltip>
          </div>
        )}
        <Divider style={{ margin: '8px 0' }} />
        <Button
          type="primary"
          icon={<FileOutlined />}
          onClick={handleSelectFile}
          block
        >
          选择视频文件
        </Button>
        {videoPath && (
          <div className="subtitle-tool-path">
            <FileOutlined style={{ color: '#1677ff', marginRight: 8 }} />
            <span title={videoPath} className="subtitle-tool-path-text">
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
          disabled={!videoPath || !selectedModel}
          block
        >
          提取字幕
        </Button>
        <Text type={status.startsWith('失败') ? 'danger' : 'success'}>
          {status}
        </Text>
      </Space>
    </Card>
  );
}
