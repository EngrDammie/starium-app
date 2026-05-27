// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { NetworkProvider } from './context/NetworkContext.jsx'
import { ConfigProvider } from './context/ConfigContext.jsx'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 🎯 FIX: We tell the router that our app lives inside the /starium-app/ folder */}
    <BrowserRouter basename="/starium-app/">
      <AuthProvider>
        <NetworkProvider>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </NetworkProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)