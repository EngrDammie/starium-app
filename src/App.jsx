// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';

// 🎯 NEW: Updated Imports
import Dashboard from './pages/Dashboard'; // The new Command Center
import PowderDensity from './pages/PowderDensity'; // The Data Entry form

import Level9Exec from './pages/Level9Exec';
import BotExec from './pages/BotExec';
import SystemConfig from './pages/SystemConfig'; 
import UserManagement from './pages/UserManagement';
import ActiveUsers from './pages/ActiveUsers';
import EmptySilos from './pages/EmptySilos';
import EmptySilosReport from './pages/EmptySilosReport';
import StopMachine from './pages/StopMachine';
import StoppedMachinesReport from './pages/StoppedMachinesReport';
import MachineDowntimeLog from './pages/MachineDowntimeLog';
import CartonWaste from './pages/CartonWaste';
import CartonWasteReport from './pages/CartonWasteReport';
import LaminateWaste from './pages/LaminateWaste';
import LaminateWasteReport from './pages/LaminateWasteReport';
import Reports from './pages/Reports';
import QCSachetProductionChecks from './pages/QCSachetProductionChecks';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      
      {/* 🎯 NEW: Updated Routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/powder-density" element={<ProtectedRoute><PowderDensity /></ProtectedRoute>} />
      
      <Route path="/level9-exec" element={<ProtectedRoute><Level9Exec /></ProtectedRoute>} />
      <Route path="/bot-exec" element={<ProtectedRoute><BotExec /></ProtectedRoute>} />
      
      <Route path="/system-config" element={<ProtectedRoute><SystemConfig /></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/active-users" element={<ProtectedRoute><ActiveUsers /></ProtectedRoute>} />
      <Route path="/empty-silos" element={<ProtectedRoute><EmptySilos /></ProtectedRoute>} />
      <Route path="/empty-silos-report" element={<ProtectedRoute><EmptySilosReport /></ProtectedRoute>} />
      <Route path="/stop-machine" element={<ProtectedRoute><StopMachine /></ProtectedRoute>} />
      <Route path="/qc-sachet-production-checks" element={<ProtectedRoute><QCSachetProductionChecks /></ProtectedRoute>} />
      <Route path="/stopped-machines-report" element={<ProtectedRoute><StoppedMachinesReport /></ProtectedRoute>} />
      <Route path="/machine-downtime-log" element={<ProtectedRoute><MachineDowntimeLog /></ProtectedRoute>} />
      <Route path="/carton-waste" element={<ProtectedRoute><CartonWaste /></ProtectedRoute>} />
      <Route path="/carton-waste-report" element={<ProtectedRoute><CartonWasteReport /></ProtectedRoute>} />
      <Route path="/laminate-waste" element={<ProtectedRoute><LaminateWaste /></ProtectedRoute>} />
      <Route path="/laminate-waste-report" element={<ProtectedRoute><LaminateWasteReport /></ProtectedRoute>} />
      <Route path="/qc-density-report" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;