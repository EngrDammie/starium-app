// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { setOnlineStatus, setOfflineStatus } from "../services/presenceOperations"; // 🎯 NEW IMPORT
import {
  getEmployeeByLinkedIdentity,
  linkEmployeeToUser,
} from "../services/employeeOperations";

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

  // ─── HR employee record link ──────────────────────────────────────────────
  // `user_roles` is a door-key list: who can log in and what they may do. It
  // has no SAP number, job title, department or shift, and it cannot describe
  // someone who never logs in. Leave Management needs those fields, so they
  // live in the `employees` collection instead.
  //
  // `employee` is the signed-in user's HR record, or null when they have none.
  // Null is a NORMAL state, not an error: super admins and developers often
  // have no employee record, and staff without logins are not signed in here.
  const [employee, setEmployee] = useState(null);

  // Resolve the signed-in user to an HR record and back-fill the link.
  // Runs AFTER the role data is set so a failure here can never prevent login.
  const attachEmployeeRecord = async (authUser) => {
    try {
      // The dev-mode ghost ('local-dev-id') is not a person. Looking it up
      // would just log a confusing permission error on every boot.
      if (!authUser || authUser.uid === 'local-dev-id') {
        setEmployee(null);
        return;
      }

      const record = await getEmployeeByLinkedIdentity({
        email: authUser.email,
        uid: authUser.uid,
      });

      if (!record) {
        // No HR record. This is expected for admins and for anyone who has not
        // been added to the roster yet — callers must handle null.
        setEmployee(null);
        return;
      }

      // Back-fill the link if HR matched on the employee's contact email but
      // nobody has recorded the login yet. Only writes when something is
      // actually missing, so this is quiet for the normal case.
      if (record.linkedUserUid !== authUser.uid) {
        await linkEmployeeToUser(record.id, { uid: authUser.uid, email: authUser.email });
        setEmployee({ ...record, linkedUserUid: authUser.uid, linkedUserEmail: authUser.email });
      } else {
        setEmployee(record);
      }
    } catch (error) {
      // Deliberately non-fatal. Someone must still be able to log in and run
      // the factory even if the employee roster is unreachable.
      if (error?.code !== 'permission-denied') {
        console.error('Error linking employee record:', error);
      }
      setEmployee(null);
    }
  };

  // --- 1. CORE AUTHENTICATION ENGINE ---
  useEffect(() => {
    let unsubscribeAuth = () => {};
    let unsubscribeSettings = () => {};

    const handleUserLoggedIn = async (user) => {
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

        // Fire-and-forget: roles are already set, so the UI is usable whether
        // or not this resolves. Never awaited inside the try/catch above —
        // an employee-lookup failure must not roll the user back to
        // 'standard' with no department roles.
        attachEmployeeRecord(user);
      } catch (error) {
        console.error("Error fetching role:", error);
        setSystemRole('standard'); setDepartmentRoles(['qc_staff']); setActionRoles([]);
        setFirstName(''); setLastName(''); setUserFullName('');
        setEmployee(null);
        setCurrentUser(user);
      }
      setLoading(false);
    };

    const setupSettingsListener = () => {
      unsubscribeSettings = onSnapshot(doc(db, 'config', 'auth_settings'), (snap) => {
        const enabled = snap.exists() ? (snap.data().authEnabled !== false) : true;
        setAuthEnabled(enabled);
      }, (err) => {
        if (err.code !== 'permission-denied') {
          console.error("Error reading auth settings:", err);
        }
      });
    };

    const user = auth.currentUser;
    if (user) {
      getDoc(doc(db, 'config', 'auth_settings')).then((docSnap) => {
        const isAuthEnabled = docSnap.exists() ? (docSnap.data().authEnabled !== false) : true;
        setAuthEnabled(isAuthEnabled);
        if (!isAuthEnabled) {
          setSystemRole('super_admin');
          setDepartmentRoles(['qc_manager', 'prod_manager', 'hr_manager']);
          setActionRoles(['buggy_supervisor', 'plc_operator', 'production_manager', 'qc_manager', 'qc_supervisor', 'line_leader']);
          setFirstName('Developer');
          setLastName('Admin');
          setUserFullName('Developer Admin');
          // The dev-mode ghost is not a person; never look up an employee
          // record for it, or every boot logs a permission error.
          setEmployee(null);
          setCurrentUser({ email: 'development@local', uid: 'local-dev-id' });
          setLoading(false);
          return;
        }
        setupSettingsListener();
        handleUserLoggedIn(user);
      }).catch(() => {
        setAuthEnabled(true);
        setupSettingsListener();
        handleUserLoggedIn(user);
      });
    } else {
      setAuthEnabled(true);
      unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
        if (authUser) {
          getDoc(doc(db, 'config', 'auth_settings')).then((docSnap) => {
            const isAuthEnabled = docSnap.exists() ? (docSnap.data().authEnabled !== false) : true;
            setAuthEnabled(isAuthEnabled);
            if (!isAuthEnabled) {
              setSystemRole('super_admin');
              setDepartmentRoles(['qc_manager', 'prod_manager', 'hr_manager']);
              setActionRoles(['buggy_supervisor', 'plc_operator', 'production_manager', 'qc_manager', 'qc_supervisor', 'line_leader']);
              setFirstName('Developer');
              setLastName('Admin');
              setUserFullName('Developer Admin');
              setEmployee(null);
              setCurrentUser({ email: 'development@local', uid: 'local-dev-id' });
              setLoading(false);
              return;
            }
            setupSettingsListener();
            handleUserLoggedIn(authUser);
          }).catch(() => {
            setAuthEnabled(true);
            setupSettingsListener();
            handleUserLoggedIn(authUser);
          });
        } else {
          setCurrentUser(null);
          setSystemRole('standard'); setDepartmentRoles([]); setActionRoles([]);
          setFirstName(''); setLastName(''); setUserFullName('');
          setEmployee(null);
          setLoading(false);
        }
      });
    }

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

  // ORDER MATTERS: the presence write requires a valid Firebase auth token
  // (see firestore.rules `presence` block), so we must signal offline BEFORE
  // signOut() clears the token. Reversing these two lines causes
  // "Missing or insufficient permissions" and leaves a ghost online user.
  const logout = async () => {
    const uid = currentUser?.uid;
    if (uid) await setOfflineStatus(uid);
    // Clear the HR record before signOut. Do not move this below signOut —
    // the note above explains why the token must still be valid at write time.
    setEmployee(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      systemRole, departmentRoles, actionRoles, 
      firstName, lastName, userFullName, 
      // The signed-in user's HR record, or null when they have none. Null is a
      // NORMAL state — super admins and developers usually have no employee
      // record — so every consumer must handle it rather than assume an object.
      employee, isEmployee: !!employee,
      loading, authEnabled, logout
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}