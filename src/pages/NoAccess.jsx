// src/pages/NoAccess.jsx
//
// Where a signed-in user lands when they can open no pages at all.
//
// WHY THIS EXISTS (found 16 Oct 2026):
// task 1.5 introduced logins with an EMPTY departmentRoles array, so a
// restricted employee could see no page in the whole app. ProtectedRoute then
// redirected them to the Command Center, refused them, and bounced them back
// to /login — an infinite loop that fired an alert() every pass.
//
// Rather than trapping them, they come here: a calm explanation of what is
// true, and who to ask. Deliberately NOT an error page — nothing is broken.
// Their login is working exactly as intended.
//
// DESIGN NOTE — no alert() anywhere:
// the old flow used window.alert, which is a blocking modal that cannot be
// styled, cannot be translated and cannot be read at a glance on a factory
// tablet. Every message on this page is rendered inline.

import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAccessiblePaths } from '../config/navigation';

export default function NoAccess() {
  const { systemRole, departmentRoles, actionRoles, userFullName, firstName, employee, logout } = useAuth();
  const location = useLocation();
  const state = location.state || {};

  const accessible = getAccessiblePaths(systemRole, departmentRoles, actionRoles);
  const isAdminOnlyPage = !!state.adminOnly;

  // The account was created on a specific day by someone else. Showing the
  // user's own name proves to them the login worked, which is the actual
  // source of confusion here.
  const accountLabel = userFullName || firstName || 'your account';

  return (
    <Layout title="Your Login Is Working" subtitle="You do not have access to any pages yet" maxWidth="max-w-3xl">
      <div className="flex flex-col gap-6 pb-16">

        {/* The reassuring part first: nothing is broken. */}
        <div className="bg-dark-card border border-[#333] rounded-xl p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl leading-none">🔑</span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white mb-2">You signed in successfully</h2>
              <p className="text-gray-400 text-sm mb-4">
                Signed in as <strong className="text-white">{accountLabel}</strong>.
                Nothing is wrong with your account — it simply has no pages assigned to it yet.
              </p>

              {employee ? (
                <p className="text-gray-400 text-sm">
                  Your employee record is{' '}
                  <strong className="text-white">{employee.fullName}</strong>
                  {' '}({employee.sapNumber}, {employee.departmentLabel}).
                  Leave access will appear here as soon as it is enabled.
                </p>
              ) : (
                <p className="text-gray-400 text-sm">
                  No employee record is linked to this login. If you expect one, HR needs to
                  add you to the roster and link this account to it.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Why they are here, if they tried to open a specific page. */}
        {state.deniedFrom && (
          <div className="bg-status-warning/10 border border-status-warning/50 rounded-xl px-5 py-4">
            <h3 className="text-status-warning font-bold text-sm mb-1">
              {isAdminOnlyPage ? 'That page is reserved for the system owner' : 'You tried to open a page you do not have access to'}
            </h3>
            <p className="text-gray-400 text-sm">
              <span className="mono text-gray-500">{state.deniedFrom}</span>
              {isAdminOnlyPage
                ? ' — only the system owner can view it.'
                : ' — your role does not include it.'}
            </p>
          </div>
        )}

        {/* What to do next. Short and concrete. */}
        <div className="bg-dark-card border border-[#333] rounded-xl p-6">
          <h3 className="text-primary font-bold uppercase tracking-wider text-xs mb-3">What happens next</h3>
          <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
            <li>Ask HR to grant you access on the <strong className="text-white">User Roles</strong> page — Administration → User Roles → Employees.</li>
            <li>HR picks you by name and staff number, then ticks the departments you need.</li>
            <li>Your pages appear the moment you refresh or sign in again.</li>
          </ol>
          <p className="text-gray-500 text-xs mt-4">
            If you are only here for leave, HR can switch on the Leave module for your account.
          </p>
        </div>

        {/* Only shown when there genuinely is something — proves the screen is
            not lying to someone who does have access. */}
        {accessible.length > 0 && (
          <div className="bg-dark-card border border-[#333] rounded-xl p-6">
            <h3 className="text-primary font-bold uppercase tracking-wider text-xs mb-3">
              Pages you can open ({accessible.length})
            </h3>
            <ul className="flex flex-wrap gap-2">
              {accessible.map(r => (
                <li key={r.path} className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-gray-300 text-xs font-semibold">
                  {r.icon} {r.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={logout}
          className="self-start px-5 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors"
        >
          🚪 Sign out
        </button>
      </div>
    </Layout>
  );
}