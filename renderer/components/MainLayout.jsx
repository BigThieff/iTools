import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import {
  FileTextOutlined,
  CloudDownloadOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import SubtitleTool from './SubtitleTool.jsx';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const tools = [
  {
    key: 'subtitle',
    icon: <FileTextOutlined />,
    label: '字幕提取',
    component: <SubtitleTool />,
  },
  {
    key: 'downloader',
    icon: <CloudDownloadOutlined />,
    label: '视频下载',
    component: <div style={{ padding: 32 }}>视频下载工具开发中...</div>,
  },
  {
    key: 'other',
    icon: <ToolOutlined />,
    label: '其他工具',
    component: <div style={{ padding: 32 }}>更多工具敬请期待...</div>,
  },
];

export default function MainLayout() {
  const [selectedKey, setSelectedKey] = useState('subtitle');
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
          onClick={(e) => setSelectedKey(e.key)}
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
        <Content className="main-content">{selectedTool.component}</Content>
      </Layout>
    </Layout>
  );
}
