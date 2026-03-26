import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// StrictMode disabled: causes Phaser to double-mount and error in dev
createRoot(document.getElementById('root')!).render(<App />)
