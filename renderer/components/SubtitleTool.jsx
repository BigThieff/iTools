import React, { useState } from 'react';

export default function SubtitleTool() {
  const [videoPath, setVideoPath] = useState('');
  const [status, setStatus] = useState('');

  const handleSelectFile = async () => {
    const filePath = await window.api.selectFile();
    if (filePath) setVideoPath(filePath);
  };

  const handleExtract = async () => {
    setStatus('处理中...');
    try {
      const srtPath = await window.api.extractSubtitle(videoPath, {});
      setStatus(`字幕生成成功: ${srtPath}`);
    } catch (e) {
      setStatus(`失败: ${e.message}`);
    }
  };

  return (
    <div>
      <button onClick={handleSelectFile}>选择视频文件</button>
      <span style={{ marginLeft: 8 }}>{videoPath}</span>
      <button
        onClick={handleExtract}
        disabled={!videoPath}
        style={{ marginLeft: 8 }}
      >
        提取字幕
      </button>
      <div style={{ marginTop: 16 }}>{status}</div>
    </div>
  );
}
