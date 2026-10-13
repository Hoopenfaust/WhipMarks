import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Not in the desktop app: it can't fetch service worker updates, so a worker there serves a stale UI forever
if (!('__TAURI_INTERNALS__' in window)) registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
