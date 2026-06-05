// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  
  const [systemRole, setSystemRole] = useState('standard'); 
  const [departmentRoles, setDepartmentRoles] = useState([]);
  const [actionRoles, setActionRoles] = useState([]);
  
  const [userRole, setUserRole] = useState(null); 
  const [approvalRoles, setApprovalRoles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true);

  useEffect(() => {
    let unsubscribeAuth = () => {};

    const unsubscribeSettings = onSnapshot(doc(db, 'config', 'auth_settings'), (docSnap) => {
      const isAuthEnabled = docSnap.exists() ? (docSnap.data().authEnabled !== false) : true;
      setAuthEnabled(isAuthEnabled);

      if (!isAuthEnabled) {
        setSystemRole('super_admin');
        setDepartmentRoles(['qc_manager', 'prod_manager', 'hr_manager']);
        setActionRoles(['buggy_supervisor', 'plc_operator', 'production_manager', 'qc_manager', 'qc_supervisor']);
        setUserRole('admin');
        setApprovalRoles(['buggy_supervisor', 'plc_operator', 'production_manager', 'qc_manager', 'qc_supervisor']);
        setCurrentUser({ email: 'development@local', uid: 'local-dev-id' }); // 🎯 Set this LAST so the app knows we are ready
        setLoading(false);
      } else {
        unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setLoading(true); // 🎯 Pause the app while we fetch roles!
            try {
              const roleDoc = await getDoc(doc(db, "user_roles", user.uid));
              const data = roleDoc.exists() ? roleDoc.data() : {};
              
              const legacyRole = data.role || 'staff';
              const legacyApprovals = data.approvalRoles || [];
              
              let sysRole = data.systemRole || (legacyRole === 'admin' ? 'super_admin' : 'standard');
              let deptRoles = data.departmentRoles || (legacyRole === 'admin' || legacyRole === 'manager' ? ['qc_manager'] : ['qc_staff']);
              let actRoles = data.actionRoles || legacyApprovals;

              if (user.email === 'dammieoptimus@gmail.com') {
                sysRole = 'super_admin';
                if (!deptRoles.includes('qc_manager')) deptRoles.push('qc_manager');
                if (!deptRoles.includes('prod_manager')) deptRoles.push('prod_manager');
                if (!deptRoles.includes('hr_manager')) deptRoles.push('hr_manager');
              }

              console.log("====================================");
              console.log("👤 USER LOGGED IN:", user.email);
              console.log("👑 System Role:", sysRole);
              console.log("🏢 Department Roles:", deptRoles);
              console.log("⚡ Action Roles:", actRoles);
              console.log("====================================");

              setSystemRole(sysRole);
              setDepartmentRoles(deptRoles);
              setActionRoles(actRoles);
              setUserRole(legacyRole);
              setApprovalRoles(legacyApprovals);
              
              // 🎯 Set the user ONLY after roles are fully loaded!
              setCurrentUser(user);
            } catch (error) {
              console.error("Error fetching role:", error);
              setSystemRole('standard'); setDepartmentRoles(['qc_staff']); setActionRoles([]);
              setUserRole('staff'); setApprovalRoles([]);
              setCurrentUser(user);
            }
          } else {
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
      systemRole, departmentRoles, actionRoles, 
      userRole, approvalRoles,                  
      loading, authEnabled 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}