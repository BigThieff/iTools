import React, { useState, useMemo } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { FileTextOutlined, CloudDownloadOutlined, ToolOutlined } from '@ant-design/icons';
import SubtitleExtractor from './SubtitleExtractor.jsx';
import './AppLayout.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

export default function AppLayout() {
  const [selectedKey, setSelectedKey] = useState('subtitle');

  // 使用 useMemo 缓存组件实例，防止标签页切换时重新创建
  const componentInstances = useMemo(() => ({
    subtitle: <SubtitleExtractor />,
    downloader: <div style={{ padding: 32 }}>视频下载工具开发中...</div>,
    other: <div style={{ padding: 32 }}>更多工具敬请期待...</div>,
  }), []);

  const tools = [
    {
      key: 'subtitle',
      icon: <FileTextOutlined />,
      label: '字幕提取',
    },
    {
      key: 'downloader',
      icon: <CloudDownloadOutlined />,
      label: '视频下载',
    },
    {
      key: 'other',
      icon: <ToolOutlined />,
      label: '其他工具',
    },
  ];

  const selectedTool = tools.find((t) => t.key === selectedKey);

  return (
    <Layout className="main-layout">
      <Sider className="main-sider" width={180}>
        <div className="main-title">
          <Title level={3}>iTools</Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={(e) => {
            setSelectedKey(e.key);
          }}
          items={tools.map((tool) => ({
            key: tool.key,
            icon: tool.icon,
            label: tool.label,
          }))}
        />
      </Sider>
      <Layout>
        <Header className="main-header">
          <Title level={4} style={{ margin: 0, color: '#232946' }}>
            {selectedTool.label}
          </Title>
        </Header>
        <Content className="main-content">
          <div style={{ display: selectedKey === 'subtitle' ? 'block' : 'none' }}>
            {componentInstances.subtitle}
          </div>
          <div style={{ display: selectedKey === 'downloader' ? 'block' : 'none' }}>
            {componentInstances.downloader}
          </div>
          <div style={{ display: selectedKey === 'other' ? 'block' : 'none' }}>
            {componentInstances.other}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
