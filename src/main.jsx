// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 🎯 FIX: We swap BrowserRouter for HashRouter!
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { NetworkProvider } from './context/NetworkContext.jsx'
import { ConfigProvider } from './context/ConfigContext.jsx'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 🎯 FIX: HashRouter doesn't even need the basename, it figures it out automatically! */}
    <HashRouter>
      <AuthProvider>
        <NetworkProvider>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </NetworkProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)