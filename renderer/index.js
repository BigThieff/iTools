import React from 'react';
import { createRoot } from 'react-dom/client';
import MainLayout from './components/MainLayout.jsx';
import 'antd/dist/reset.css';

const root = createRoot(document.getElementById('root'));
root.render(<MainLayout />);
