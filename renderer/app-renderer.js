import React from 'react';
import { createRoot } from 'react-dom/client';
import AppLayout from './components/AppLayout.jsx';
import 'antd/dist/reset.css';

const root = createRoot(document.getElementById('root'));
root.render(<AppLayout />);
