// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { NetworkProvider } from './context/NetworkContext.jsx'
import { ConfigProvider } from './context/ConfigContext.jsx'
import { AlertProvider } from './context/AlertContext.jsx' // 🎯 NEW IMPORT
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <NetworkProvider>
          <ConfigProvider>
            <AlertProvider> {/* 🎯 ADD THIS WRAPPER */}
              <App />
            </AlertProvider>
          </ConfigProvider>
        </NetworkProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)