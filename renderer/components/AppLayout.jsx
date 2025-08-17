import React, { useState, useMemo } from 'react';
import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import Typography from 'antd/es/typography';
import SubtitleExtractor from './SubtitleExtractor.jsx';
import './AppLayout.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

export default function AppLayout() {
  const [selectedKey, setSelectedKey] = useState('subtitle');
  const [collapsed, setCollapsed] = useState(false);

  // 使用 useMemo 缓存组件实例，防止标签页切换时重新创建
  const componentInstances = useMemo(() => ({
    subtitle: <SubtitleExtractor />,
    downloader: <div style={{ padding: 32 }}>视频下载工具开发中...</div>,
    other: <div style={{ padding: 32 }}>更多工具敬请期待...</div>,
  }), []);

  const tools = [
    {
      key: 'subtitle',
      label: '字幕提取',
    },
    {
      key: 'downloader',
      label: '视频下载',
    },
    {
      key: 'other',
      label: '其他工具',
    },
  ];

  const selectedTool = tools.find((t) => t.key === selectedKey);

  return (
    <Layout className="main-layout" style={{ minHeight: '100vh' }}>
      <Sider
        className="main-sider"
        width={180}
        breakpoint="lg"
        collapsedWidth="0"
        onBreakpoint={(broken) => setCollapsed(broken)}
        onCollapse={(isCollapsed) => setCollapsed(isCollapsed)}
      >
        <div className="logo">iTools</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={(e) => {
            setSelectedKey(e.key);
          }}
          items={tools.map((tool) => ({
            key: tool.key,
            label: tool.label,
          }))}
        />
      </Sider>
      <Layout>
        <Header
          className="main-header"
          style={{
            background: '#fff',
            padding: '0 24px', // 统一左右 24px 留白，展开时也不贴边
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <span style={{ fontWeight: 600 }}>iTools</span>
          <span style={{ marginLeft: 8, color: '#999' }}>{selectedTool.label}</span>
        </Header>
        <Content
          className="main-content"
          style={{
            margin: '16px 24px', // 统一左右 24px 留白
          }}
        >
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
