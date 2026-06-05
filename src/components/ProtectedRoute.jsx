// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllowedRolesForPath } from '../config/navigation';

export default function ProtectedRoute({ children }) {
  const { currentUser, systemRole, departmentRoles, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // Wait for Firebase to check who is logged in

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // 1. Super Admins bypass everything
  if (systemRole === 'super_admin') {
    return children;
  }

  // 2. Look up the rules for this specific URL
  const allowedRoles = getAllowedRolesForPath(location.pathname);

  if (allowedRoles !== null) {
    // If the array is empty, it means ONLY super_admins are allowed
    if (allowedRoles.length === 0) {
      alert("⛔ Access Denied! Only Super Admins can access this page.");
      return <Navigate to="/" replace />;
    }

    // Check if the user has at least one of the required department keycards
    const hasAccess = allowedRoles.some(role => departmentRoles.includes(role));
    
    if (!hasAccess) {
      alert("⛔ Access Denied! You do not have the required keycard to view this page.");
      
      // Send them to the dashboard safely
      const homeRoles = getAllowedRolesForPath('/');
      const canAccessHome = homeRoles?.some(role => departmentRoles.includes(role));
      return <Navigate to={canAccessHome ? "/" : "/login"} replace />;
    }
  }

  // They passed all security checks! Let them in.
  return children;
}