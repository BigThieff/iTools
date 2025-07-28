import React, { useState } from 'react';
import { Card, Button, Typography, Space, message } from 'antd';
import { FileOutlined, PlayCircleOutlined } from '@ant-design/icons';
import './SubtitleTool.css';

const { Title, Text } = Typography;

export default function SubtitleTool() {
  const [videoPath, setVideoPath] = useState('');
  const [status, setStatus] = useState('');

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
      const srtPath = await window.api.extractSubtitle(videoPath, {});
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
          disabled={!videoPath}
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
