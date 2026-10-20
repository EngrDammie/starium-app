// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessRoute, findRoute, getFirstAccessiblePath } from '../config/navigation';

export default function ProtectedRoute({ children }) {
  const { currentUser, systemRole, departmentRoles, actionRoles, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // Wait for Firebase to check who is logged in

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // 1. Super Admins bypass everything
  if (systemRole === 'super_admin') {
    return children;
  }

  // 2. Ask the navigation config whether this person may open this page.
  //
  // THIS ROUTE USED TO RE-DERIVE the answer from `allowedRoles` alone, which
  // is the bug this comment replaces. It read the rule as "empty allowedRoles
  // means super-admin only" and sent everyone else to /no-access with
  // adminOnly set — so a route marked `openToAll: true` (which is spelled
  // allowedRoles: [] because there are no roles to list) locked out every
  // employee it was written to admit. The system owner still got in, because
  // step 1 bypasses all of this, which made it look like a permissions
  // problem rather than a broken check.
  //
  // canAccessRoute is the single source of truth and already handles openToAll.
  // Sidebar, Login and this guard now all call it, so they cannot drift apart
  // again.
  const route = findRoute(location.pathname);

  if (route && !canAccessRoute(route, systemRole, departmentRoles, actionRoles)) {
    // WHY THE ADMIN-ONLY CASE IS SEPARATE: /system-config and /active-users
    // list no roles because they are reserved for the system owner, not
    // because nobody was ever meant to click them. Someone who types the URL
    // deserves the explanation on /no-access ("that page is reserved") rather
    // than a silent redirect to an unrelated page they can open. openToAll
    // routes are exempt — an empty allowedRoles on those means "no roles to
    // list", not "no roles, therefore owner-only".
    const adminOnly = !route.openToAll && (!route.allowedRoles || route.allowedRoles.length === 0);
    if (adminOnly) {
      return <Navigate to="/no-access" replace state={{ adminOnly: true, deniedFrom: location.pathname }} />;
    }

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
    const fallback = getFirstAccessiblePath(systemRole, departmentRoles, actionRoles);

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

  // They passed all security checks! Let them in.
  return children;
}