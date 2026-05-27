// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Level9Exec from './pages/Level9Exec';
import BotExec from './pages/BotExec';
import MachineManagement from './pages/MachineManagement';
import UserManagement from './pages/UserManagement';
import Reports from './pages/Reports'; // <--- NEW IMPORT

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      
      {/* Dashboards */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/level9-exec" element={<ProtectedRoute><Level9Exec /></ProtectedRoute>} />
      <Route path="/bot-exec" element={<ProtectedRoute><BotExec /></ProtectedRoute>} />
      
      {/* Admin & Reports */}
      <Route path="/machine-management" element={<ProtectedRoute><MachineManagement /></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} /> {/* <--- NEW ROUTE */}
    </Routes>
  );
}

export default App;