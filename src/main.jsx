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
    {/* BrowserRouter handles moving between pages without reloading */}
    <BrowserRouter>
      {/* AuthProvider gives the whole app access to the user's info */}
      <AuthProvider>
        <NetworkProvider> {/* NetworkProvider gives the whole app access to online/offline status */}
          <ConfigProvider> 
            <App />
          </ConfigProvider>
        </NetworkProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)