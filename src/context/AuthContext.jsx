// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);

  // The New Enterprise Keycard System
  const [systemRole, setSystemRole] = useState('standard');
  const [departmentRoles, setDepartmentRoles] = useState([]);
  const [actionRoles, setActionRoles] = useState([]);

  // Legacy support (Kept temporarily so your current pages don't crash today)
  const [userRole, setUserRole] = useState(null);
  const [approvalRoles, setApprovalRoles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true);

  useEffect(() => {
    let unsubscribeAuth = () => { };

    const unsubscribeSettings = onSnapshot(doc(db, 'config', 'auth_settings'), (docSnap) => {
      const isAuthEnabled = docSnap.exists() ? (docSnap.data().authEnabled !== false) : true;
      setAuthEnabled(isAuthEnabled);

      if (!isAuthEnabled) {
        // AUTH IS OFF: Inject "Ghost Super Admin"
        setCurrentUser({ email: 'development@local', uid: 'local-dev-id' });

        // New Schema
        setSystemRole('super_admin');
        setDepartmentRoles(['qc_manager', 'prod_manager', 'hr_manager']);
        setActionRoles(['buggy_supervisor', 'plc_operator', 'production_manager', 'qc_manager', 'qc_supervisor']);

        // Legacy Schema (so old pages don't break)
        setUserRole('admin');
        setApprovalRoles(['buggy_supervisor', 'plc_operator', 'production_manager', 'qc_manager', 'qc_supervisor']);

        setLoading(false);
      } else {
        // AUTH IS ON: Listen to real users
        unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            try {
              const roleDoc = await getDoc(doc(db, "user_roles", user.uid));
              if (roleDoc.exists()) {
                const data = roleDoc.data();

                // 🎯 ON-THE-FLY MIGRATION: Convert old users to new keycards instantly in memory
                const legacyRole = data.role || 'staff';
                const legacyApprovals = data.approvalRoles || [];

                const sysRole = data.systemRole || (legacyRole === 'admin' ? 'super_admin' : 'standard');
                const deptRoles = data.departmentRoles || (legacyRole === 'admin' || legacyRole === 'manager' ? ['qc_manager'] : ['qc_staff']);
                const actRoles = data.actionRoles || legacyApprovals;

                // Set New Schema
                setSystemRole(sysRole);
                setDepartmentRoles(deptRoles);
                setActionRoles(actRoles);

                // Set Legacy Schema
                setUserRole(legacyRole);
                setApprovalRoles(legacyApprovals);

              } else {
                // Completely new user without a doc
                setSystemRole('standard'); setDepartmentRoles(['qc_staff']); setActionRoles([]);
                setUserRole('staff'); setApprovalRoles([]);
              }
            } catch (error) {
              console.error("Error fetching role:", error);
              setSystemRole('standard'); setDepartmentRoles(['qc_staff']); setActionRoles([]);
              setUserRole('staff'); setApprovalRoles([]);
            }
          } else {
            // Logged out
            setCurrentUser(null);
            setSystemRole('standard'); setDepartmentRoles([]); setActionRoles([]);
            setUserRole(null); setApprovalRoles([]);
          }
          setLoading(false);
        });
      }
    }, (error) => {
      console.error("Error reading auth settings:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeSettings();
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser,
      systemRole, departmentRoles, actionRoles, // New Enterprise Roles
      userRole, approvalRoles,                  // Legacy Roles (temporary)
      loading, authEnabled
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}