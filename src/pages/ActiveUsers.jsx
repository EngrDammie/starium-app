import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { subscribeToActiveUsers } from '../services/presenceOperations';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const PAGE_LABELS = {
  '#/': 'Command Center',
  '#/login': 'Login',
  '#/change-password': 'Change Password',
  '#/powder-density': 'Powder Density Tests',
  '#/level9-exec': 'Level 9 Dashboard',
  '#/bot-exec': 'BOT Dashboard',
  '#/system-config': 'System Config',
  '#/user-management': 'User Roles',
  '#/reports': 'QC Reports',
  '#/active-users': 'Active Users',
};

function formatPage(path) {
  return PAGE_LABELS[path] || path?.replace('#', '')?.replace(/\//g, ' ')?.trim() || 'Unknown';
}

const toTitleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export default function ActiveUsers() {
  const { systemRole } = useAuth();
  const [users, setUsers] = useState([]);
  const namesCache = useRef({});

  useEffect(() => {
    if (systemRole !== 'super_admin') return;

    const unsub = subscribeToActiveUsers(async (activeUsers) => {
      const enriched = await Promise.all(
        activeUsers.map(async (u) => {
          if (!namesCache.current[u.uid]) {
            try {
              const snap = await getDoc(doc(db, 'user_roles', u.uid));
              if (snap.exists()) {
                const d = snap.data();
                const first = toTitleCase(d.firstName || '');
                const last = toTitleCase(d.lastName || '');
                namesCache.current[u.uid] = first || last ? `${first} ${last}`.trim() : u.email;
              } else {
                namesCache.current[u.uid] = u.email;
              }
            } catch {
              namesCache.current[u.uid] = u.email;
            }
          }
          return {
            ...u,
            displayName: namesCache.current[u.uid],
            lastSeenDate: u.lastSeen?.toDate ? u.lastSeen.toDate() : new Date(),
          };
        })
      );
      enriched.sort((a, b) => b.lastSeenDate - a.lastSeenDate);
      setUsers(enriched);
    });

    return () => unsub();
  }, [systemRole]);

  return (
    <Layout title="Active Users" subtitle="Real-time overview of all online operators" maxWidth="max-w-5xl">
      {systemRole !== 'super_admin' ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
          <p className="text-sm">Only super admins can view this page.</p>
        </div>
      ) : (
        <div className="bg-[#1E1E1E] border border-[#333] rounded-2xl overflow-hidden animate-[fadeIn_0.3s_ease-out]">
          <div className="p-4 border-b border-[#333] flex items-center justify-between">
            <h3 className="text-white font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse shadow-[0_0_8px_rgba(0,230,118,0.8)] inline-block mr-2"></span>
              {users.length} Active{users.length !== 1 ? 's' : ''}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-[#333]">
                  <th className="p-4 font-bold">Name</th>
                  <th className="p-4 font-bold">Email</th>
                  <th className="p-4 font-bold">Current Page</th>
                  <th className="p-4 font-bold">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No active users right now.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.uid} className="border-b border-[#222] hover:bg-[#252525] transition-colors">
                      <td className="p-4 text-white font-medium">{u.displayName}</td>
                      <td className="p-4 text-gray-400">{u.email}</td>
                      <td className="p-4">
                        <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/30">
                          {formatPage(u.currentPath)}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-sm">{timeAgo(u.lastSeenDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
