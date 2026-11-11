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
import ECDensityIndex from './pages/ECDensityIndex';
import CartonWasteIndex from './pages/CartonWasteIndex';
import LaminateWasteIndex from './pages/LaminateWasteIndex';
import PalletTransferIndex from './pages/PalletTransferIndex';
import QCSachetIndex from './pages/QCSachetIndex';
import CreateCompleteUser from './pages/CreateCompleteUser';
import StringWeightAveragesReport from './pages/StringWeightAveragesReport';

// ERP Phase 0 — Procurement / Warehouse / Production
import PurchaseOrders from './pages/PurchaseOrders';
import PoApprovals from './pages/PoApprovals';
import GoodsReceipt from './pages/GoodsReceipt';
import CreditNotes from './pages/CreditNotes';
import StockTransfers from './pages/StockTransfers';
import BinView from './pages/BinView';
import Boms from './pages/Boms';
import BomApprovals from './pages/BomApprovals';
import ProductionOrders from './pages/ProductionOrders';
import PackingActuals from './pages/PackingActuals';
import ProductionVariance from './pages/ProductionVariance';

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
      <Route path="/ec-density-index" element={<ProtectedRoute><ECDensityIndex /></ProtectedRoute>} />
      <Route path="/carton-waste-index" element={<ProtectedRoute><CartonWasteIndex /></ProtectedRoute>} />
      <Route path="/laminate-waste-index" element={<ProtectedRoute><LaminateWasteIndex /></ProtectedRoute>} />
      <Route path="/pallet-transfer-index" element={<ProtectedRoute><PalletTransferIndex /></ProtectedRoute>} />
      <Route path="/qc-sachet-index" element={<ProtectedRoute><QCSachetIndex /></ProtectedRoute>} />
      <Route path="/qc-density-report" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/qc-sachet-report" element={<ProtectedRoute><QCSachetReport /></ProtectedRoute>} />
      <Route path="/string-weight-averages-report" element={<ProtectedRoute><StringWeightAveragesReport /></ProtectedRoute>} />
      <Route path="/create-complete-user" element={<ProtectedRoute><CreateCompleteUser /></ProtectedRoute>} />
      {/* ERP Phase 0 — Procurement */}
      <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
      <Route path="/po-approvals" element={<ProtectedRoute><PoApprovals /></ProtectedRoute>} />
      <Route path="/goods-receipt" element={<ProtectedRoute><GoodsReceipt /></ProtectedRoute>} />
      <Route path="/credit-notes" element={<ProtectedRoute><CreditNotes /></ProtectedRoute>} />
      {/* ERP Phase 0 — Warehouse */}
      <Route path="/stock-transfers" element={<ProtectedRoute><StockTransfers /></ProtectedRoute>} />
      <Route path="/bin-view" element={<ProtectedRoute><BinView /></ProtectedRoute>} />
      {/* ERP Phase 0 — Production */}
      <Route path="/boms" element={<ProtectedRoute><Boms /></ProtectedRoute>} />
      <Route path="/bom-approvals" element={<ProtectedRoute><BomApprovals /></ProtectedRoute>} />
      <Route path="/production-orders" element={<ProtectedRoute><ProductionOrders /></ProtectedRoute>} />
      <Route path="/packing-actuals" element={<ProtectedRoute><PackingActuals /></ProtectedRoute>} />
      <Route path="/production-variance" element={<ProtectedRoute><ProductionVariance /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;