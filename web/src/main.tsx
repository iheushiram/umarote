import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// 起動時の全馬データの一括取得は無効化（不要な /api/race-results 連続呼び出しを防止）

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
