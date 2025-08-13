import React, { useState, useEffect, useRef } from 'react';
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
  const [subtitleOrder, setSubtitleOrder] = useState('main-first');
  const [isExtracting, setIsExtracting] = useState(false); // 新增状态
  const contentRef = useRef(null); // 添加 ref

  useEffect(() => {
    window.api.listModels().then((list) => {
      setModels(list);
      // 优先选择 small 模型，如果不存在则选择第一个模型
      const defaultModel =
        list.find((model) => model.includes('small')) || list[0];
      if (defaultModel) setSelectedModel(defaultModel);
    });
  }, []);

  useEffect(() => {
    if (subtitleType === 'dual' && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight; // 滚动到最下方
    }
  }, [subtitleType]);

  const handleSelectFile = async () => {
    const filePath = await window.api.selectFile();
    if (filePath) {
      setVideoPath(filePath);
      setStatus('');
    }
  };

  const handleExtract = async () => {
    setStatus('处理中...');
    setIsExtracting(true); // 禁用按钮
    try {
      const options = {
        modelName: selectedModel,
        language,
        dual: subtitleType === 'dual',
        targetLang: subtitleType === 'dual' ? targetLang : undefined,
        subtitleOrder, // 新增参数
      };
      const srtPath = await window.api.extractSubtitle(videoPath, options);
      if (subtitleType === 'dual') {
        setStatus(`双语言字幕生成成功：${srtPath}`);
        message.success('双语言字幕生成成功！');
      } else {
        setStatus(`字幕生成成功：${srtPath}`);
        message.success('字幕生成成功！');
      }
    } catch (e) {
      setStatus(`失败：${e.message}`);
      message.error('字幕生成失败');
    } finally {
      setIsExtracting(false); // 恢复按钮
    }
  };

  return (
    <Card
      className="subtitle-tool-card"
      title={<Title level={3}>🎬 字幕提取工具</Title>}
      bordered={false}
    >
      <Space
        direction="vertical"
        size="large"
        style={{ width: '100%' }}
        ref={contentRef} // 绑定 ref
      >
        {/* 模型选择 */}
        <div className="subtitle-tool-row">
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
            {models.map((m) => (
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
        <div className="subtitle-tool-row">
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
        <div className="subtitle-tool-row">
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
          <div className="subtitle-tool-row">
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
              options={LANGUAGES.filter((l) => l.value !== language)}
            />
          </div>
        )}

        {/* 字幕顺序 */}
        {subtitleType === 'dual' && (
          <div className="subtitle-tool-row">
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
        <div className="subtitle-tool-buttons">
          <Button
            type="primary"
            icon={<FileOutlined />}
            onClick={handleSelectFile}
            disabled={isExtracting} // 禁用按钮
            block
          >
            选择视频文件
          </Button>
          {videoPath && (
            <div className="subtitle-tool-path">
              <FileOutlined className="subtitle-tool-icon" />
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
            disabled={!videoPath || !selectedModel || isExtracting} // 禁用按钮
            block
          >
            提取字幕
          </Button>
        </div>
        <Text type={status.startsWith('失败') ? 'danger' : 'success'}>
          {status}
        </Text>
      </Space>
    </Card>
  );
}
