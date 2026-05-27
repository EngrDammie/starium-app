// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [approvalRoles, setApprovalRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true); // Default to secure

  useEffect(() => {
    let unsubscribeAuth = () => {};

    // 1. Listen to the Global Master Auth Toggle in real-time
    const unsubscribeSettings = onSnapshot(doc(db, 'config', 'auth_settings'), (docSnap) => {
      // Default to true if the document doesn't exist yet for safety
      const isAuthEnabled = docSnap.exists() ? (docSnap.data().authEnabled !== false) : true;
      setAuthEnabled(isAuthEnabled);

      if (!isAuthEnabled) {
        // 🎯 FIX: AUTH IS OFF! 
        // We bypass Firebase Auth entirely and inject the "Ghost Admin" just like your Vanilla app did
        setCurrentUser({ email: 'development@local', uid: 'local-dev-id' });
        setUserRole('admin');
        setApprovalRoles(['buggy_supervisor', 'plc_operator', 'production_manager', 'qc_manager', 'qc_supervisor']);
        setLoading(false);
      } else {
        // AUTH IS ON!
        // We enforce standard Firebase Authentication
        unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            try {
              const roleDoc = await getDoc(doc(db, "user_roles", user.uid));
              if (roleDoc.exists()) {
                const data = roleDoc.data();
                setUserRole(data.role); 
                setApprovalRoles(data.approvalRoles || []);
              } else {
                setUserRole("staff");
                setApprovalRoles([]);
              }
            } catch (error) {
              console.error("Error fetching role:", error);
              setUserRole("staff");
              setApprovalRoles([]);
            }
          } else {
            setCurrentUser(null);
            setUserRole(null);
            setApprovalRoles([]);
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
    <AuthContext.Provider value={{ currentUser, userRole, approvalRoles, loading, authEnabled }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}