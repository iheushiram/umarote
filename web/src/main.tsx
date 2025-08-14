import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { getHorses } from './services/horseService'
import { useHorseStore } from './store/horseStore'

// サンプルデータの読み込み
getHorses().then(horses => {
  useHorseStore.getState().setHorses(horses)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
