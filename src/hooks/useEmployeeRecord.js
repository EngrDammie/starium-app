// src/hooks/useEmployeeRecord.js
//
// Resolves "which employee record is this screen acting for?" in one place.
//
// Three sources, in priority order:
//   1. `explicit` — HR lodging on behalf of someone (EmployeeRoster → lodge).
//   2. The record AuthContext already linked to this login.
//   3. A one-off lookup by email, for someone who registered before HR had
//      time to link them by hand.
//
// WHY IT IS A HOOK AND NOT INLINE STATE:
// the first two sources are available on the render that needs them. Copying
// them into useState means an effect that copies state on every render — an
// extra render pass per screen and a class of bug where the copy goes stale
// when the linked record is updated. Only the third source is genuinely
// asynchronous, so only that one sets state, and only in a callback.
//
// Used by both LeaveRequestForm and MyLeave; they must resolve identically, or
// a balance shown on one screen could disagree with the one on the other.

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getEmployeeByLinkedIdentity } from '../services/employeeOperations';

export function useEmployeeRecord(explicit = null) {
  const { currentUser, employee: authEmployee } = useAuth();
  const [lookedUp, setLookedUp] = useState(null);

  useEffect(() => {
    if (authEmployee || explicit || !currentUser?.email) return;
    let cancelled = false;
    getEmployeeByLinkedIdentity({ email: currentUser.email, uid: currentUser.uid })
      .then((found) => { if (!cancelled) setLookedUp(found); })
      .catch(() => { /* handled in the service; nothing to add here */ });
    return () => { cancelled = true; };
  }, [authEmployee, explicit, currentUser]);

  return explicit || authEmployee || lookedUp;
}
