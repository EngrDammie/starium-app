// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { setOnlineStatus, setOfflineStatus } from "../services/presenceOperations"; // 🎯 NEW IMPORT

const AuthContext = createContext();

const toTitleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  
  const [systemRole, setSystemRole] = useState('standard'); 
  const [departmentRoles, setDepartmentRoles] = useState([]);
  const [actionRoles, setActionRoles] = useState([]);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userFullName, setUserFullName] = useState('');

  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true);

  // --- 1. CORE AUTHENTICATION ENGINE ---
  useEffect(() => {
    let unsubscribeAuth = () => {};

    const unsubscribeSettings = onSnapshot(doc(db, 'config', 'auth_settings'), (docSnap) => {
      const isAuthEnabled = docSnap.exists() ? (docSnap.data().authEnabled !== false) : true;
      setAuthEnabled(isAuthEnabled);

      if (!isAuthEnabled) {
        setSystemRole('super_admin');
        setDepartmentRoles(['qc_manager', 'prod_manager', 'hr_manager']);
        setActionRoles(['buggy_supervisor', 'plc_operator', 'production_manager', 'qc_manager', 'qc_supervisor', 'line_leader']);
        
        setFirstName('Developer');
        setLastName('Admin');
        setUserFullName('Developer Admin');
        setCurrentUser({ email: 'development@local', uid: 'local-dev-id' }); 
        
        setLoading(false);
      } else {
        unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setLoading(true); 
            try {
              const roleDoc = await getDoc(doc(db, "user_roles", user.uid));
              const data = roleDoc.exists() ? roleDoc.data() : {};
              
              let sysRole = data.systemRole || (data.role === 'admin' ? 'super_admin' : 'standard');
              let deptRoles = data.departmentRoles || (data.role === 'admin' || data.role === 'manager' ? ['qc_manager'] : ['qc_staff']);
              let actRoles = data.actionRoles || data.approvalRoles || [];

              let fName = data.firstName || '';
              let lName = data.lastName || '';
              let displayFirst = '';
              let full = '';

              if (fName && lName) {
                displayFirst = toTitleCase(fName);
                full = `${displayFirst} ${toTitleCase(lName)}`;
              } else {
                displayFirst = user.email.split('@')[0];
                displayFirst = displayFirst.charAt(0).toUpperCase() + displayFirst.slice(1);
                full = displayFirst;
              }

              if (user.email === 'dammieoptimus@gmail.com') {
                sysRole = 'super_admin';
                if (!deptRoles.includes('qc_manager')) deptRoles.push('qc_manager');
                if (!deptRoles.includes('prod_manager')) deptRoles.push('prod_manager');
                if (!deptRoles.includes('hr_manager')) deptRoles.push('hr_manager');
              }
              console.log("====================================");
              console.log(`👤 USER LOGGED IN: ${full} (${user.email})`);
              console.log("👑 System Role:", sysRole);
              console.log("🏢 Department Roles:", deptRoles);
              console.log("⚡ Action Roles:", actRoles);
              console.log("====================================");

              setSystemRole(sysRole);
              setDepartmentRoles(deptRoles);
              setActionRoles(actRoles);
              setFirstName(displayFirst);
              setLastName(toTitleCase(lName));
              setUserFullName(full);
              
              setCurrentUser(user);
            } catch (error) {
              console.error("Error fetching role:", error);
              setSystemRole('standard'); setDepartmentRoles(['qc_staff']); setActionRoles([]);
              setFirstName(''); setLastName(''); setUserFullName('');
              setCurrentUser(user);
            }
          } else {
            setCurrentUser(null);
            setSystemRole('standard'); setDepartmentRoles([]); setActionRoles([]);
            setFirstName(''); setLastName(''); setUserFullName('');
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

  // --- 2. 🎯 NEW: THE PRESENCE HEARTBEAT ENGINE ---
  useEffect(() => {
    if (!currentUser || currentUser.uid === 'local-dev-id') return;

    const uid = currentUser.uid;
    const email = currentUser.email;

    // 1. Send the initial "Hello, I am online!" ping
    setOnlineStatus(uid, email, window.location.hash);

    // 2. Set up the 3-minute recurring heartbeat
    const intervalId = setInterval(() => {
      setOnlineStatus(uid, email, window.location.hash);
    }, 3 * 60 * 1000); // 3 minutes in milliseconds

    // 3. Set up the interceptor for when they close the browser tab
    const handleUnload = () => {
      setOfflineStatus(uid);
    };
    window.addEventListener('beforeunload', handleUnload);

    // 4. Cleanup function: When they explicitly click "Logout"
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
      setOfflineStatus(uid).catch(() => {}); // May fail if auth already cleared
    };
  }, [currentUser]);

  const logout = async () => {
    const uid = currentUser?.uid;
    if (uid) await setOfflineStatus(uid);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      systemRole, departmentRoles, actionRoles, 
      firstName, lastName, userFullName, 
      loading, authEnabled, logout
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}