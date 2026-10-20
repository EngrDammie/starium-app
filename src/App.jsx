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
import EmployeeRoster from './pages/EmployeeRoster';
import NoAccess from './pages/NoAccess';
import MyLeave from './pages/MyLeave';
import LeaveApprovals from './pages/LeaveApprovals';
import LeavePrint from './pages/LeavePrint';
import LeaveReport from './pages/LeaveReport';
import EmptySilos from './pages/EmptySilos';
import EmptySilosReport from './pages/EmptySilosReport';
import StopMachine from './pages/StopMachine';
import StoppedMachinesReport from './pages/StoppedMachinesReport';
import MachineDowntimeLog from './pages/MachineDowntimeLog';
import CartonWaste from './pages/CartonWaste';
import CartonWasteReport from './pages/CartonWasteReport';
import LaminateWaste from './pages/LaminateWaste';
import LaminateWasteReport from './pages/LaminateWasteReport';
import PalletTransfer from './pages/PalletTransfer';
import PalletTransferReport from './pages/PalletTransferReport';
import Reports from './pages/Reports';
import QCSachetProductionChecks from './pages/QCSachetProductionChecks';
import QCSachetReport from './pages/QCSachetReport';

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
      <Route path="/employees" element={<ProtectedRoute><EmployeeRoster /></ProtectedRoute>} />
      <Route path="/my-leave" element={<ProtectedRoute><MyLeave /></ProtectedRoute>} />
      {/* Placeholders for tasks 5.2 and 6.3. They resolve to /no-access for
          now rather than 404ing, so the HR menu never advertises a dead link. */}
      <Route path="/leave-approvals" element={<ProtectedRoute><LeaveApprovals /></ProtectedRoute>} />
      {/* The printable form. Deliberately NOT in MENU_CONFIG — it is reached
          from a Print button on a specific request, not from the sidebar. */}
      <Route path="/print/leave/:id" element={<ProtectedRoute><LeavePrint /></ProtectedRoute>} />
      {/* Placeholder for task 6.3. It resolves to /no-access until the report
          lands rather than 404ing, so the HR menu never advertises a dead link. */}
      <Route path="/leave-report" element={<ProtectedRoute><LeaveReport /></ProtectedRoute>} />
      {/* Deliberately NOT in MENU_CONFIG, so getAllowedRolesForPath returns
          null and ProtectedRoute lets any signed-in user through. This is the
          landing page for an account with no permissions yet, so it must be
          reachable by exactly the people who can open nothing else. */}
      <Route path="/no-access" element={<ProtectedRoute><NoAccess /></ProtectedRoute>} />
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
      <Route path="/pallet-transfer" element={<ProtectedRoute><PalletTransfer /></ProtectedRoute>} />
      <Route path="/pallet-transfer-report" element={<ProtectedRoute><PalletTransferReport /></ProtectedRoute>} />
      <Route path="/qc-density-report" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/qc-sachet-report" element={<ProtectedRoute><QCSachetReport /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;