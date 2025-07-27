import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div>
      <h2>工具主页</h2>
      <p>后续这里将展示各种工具模块</p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
