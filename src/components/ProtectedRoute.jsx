// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllowedRolesForPath, getFirstAccessiblePath } from '../config/navigation';

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

  // A null result means this path is not in the menu config at all, so there is
  // no role rule to enforce — it is an ordinary page such as /change-password.
  if (allowedRoles !== null && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some(role => departmentRoles.includes(role));

    if (!hasAccess) {
      // THE LOOP THIS REPLACES (found 16 Oct 2026):
      //   if (!canAccessHome) return <Navigate to="/login" />
      // A restricted employee has departmentRoles: [], so canAccessHome was
      // false and they were sent to /login — which, because they are still
      // signed in, immediately navigated back to '/', where they were denied
      // again. An infinite redirect loop that fired an alert() on every pass.
      //
      // The fix is to ask the navigation config which page this person CAN
      // open, and go there. If they can open nothing, they land on /no-access,
      // which explains the situation instead of trapping them.
      const fallback = getFirstAccessiblePath(systemRole, departmentRoles);

      return (
        <Navigate
          to={fallback ?? '/no-access'}
          replace
          // Carried so the landing page can explain WHY they were moved,
          // rather than silently swallowing the attempt.
          state={{ deniedFrom: location.pathname }}
        />
      );
    }
  }

  // 3. An empty allowedRoles array still means super-admin only. Kept separate
  // from the branch above because it is a different refusal: not "you lack a
  // keycard" but "this page is reserved for the system owner".
  if (allowedRoles !== null && allowedRoles.length === 0) {
    return <Navigate to="/no-access" replace state={{ adminOnly: true, deniedFrom: location.pathname }} />;
  }

  // They passed all security checks! Let them in.
  return children;
}