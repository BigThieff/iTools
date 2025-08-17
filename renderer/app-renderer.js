import React from 'react';
import { createRoot } from 'react-dom/client';
// 懒加载主界面，减少初始包体积
const AppLayout = React.lazy(() => import('./components/AppLayout.jsx'));
import 'antd/dist/reset.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 静默处理错误，在生产环境中可以发送到错误监控服务
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red' }}>
          <h1>应用出现错误</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>重新加载</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <React.Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}>
      <AppLayout />
    </React.Suspense>
  </ErrorBoundary>
);
