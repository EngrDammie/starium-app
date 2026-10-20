// src/pages/LeavePrint.jsx
//
// The printable Leave Request Form (task 6.1).
//
// WHY A PRINT PAGE EXISTS AT ALL: HR's cabinet, the payroll file and the
// Nigerian Labour Act all still run on paper. The digital record is the
// source of truth, but HR needs to file a physical copy that looks like the
// form staff already know — same sections, same signature blocks — or the
// printout and the app become two systems to reconcile instead of one.
//
// This page renders ONE request as an A4 sheet: Section 1 the details and the
// frozen arithmetic, Section 2 the declaration, Section 3 the three
// signatures with who signed, when, and any note. window.print() then does
// what browsers do. On screen it is shown dark like the rest of the app so it
// is readable in context; only the print output is white.
//
// The route is deliberately NOT in MENU_CONFIG: nobody navigates here from
// the sidebar. It is opened from My Leave and Leave Approvals with a
// request id, and shares nothing with the dark chrome when printed.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLeaveRequest } from '../services/leaveOperations';
import { useConfig } from '../context/ConfigContext';

const fmt = (d) => {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date) ? '—'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Row = ({ label, value }) => (
  <tr className="print-row">
    <td className="label">{label}</td>
    <td className="value">{value ?? '—'}</td>
  </tr>
);

export default function LeavePrint() {
  const { id } = useParams();
  const { config } = useConfig();
  const policy = config?.leavePolicy;
  const [request, setRequest] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    getLeaveRequest(id).then((r) => {
      if (!alive) return;
      if (r) setRequest(r); else setMissing(true);
    });
    return () => { alive = false; };
  }, [id]);

  if (missing) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="mb-4">That request no longer exists.</p>
        <Link to="/my-leave" className="text-primary font-bold underline">Back to My Leave</Link>
      </div>
    );
  }

  if (!request || !policy) {
    return <div className="p-8 text-center text-gray-400">Loading the form…</div>;
  }

  const stages = policy.stages || [];

  return (
    <div className="p-4 md:p-8 print:p-0 min-h-screen bg-[#121212] print:bg-white print:text-black">
      {/* Print-only styles: the dark app chrome vanishes, the sheet fills the
          page, and signature rows keep their borders on paper. */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: 100% !important; }
          .print-row td { border-bottom: 1px solid #000; padding: 6pt 4pt; }
          .print-row td.label { width: 34%; font-weight: 600; color: #000; }
          .print-row td.value { color: #000; }
          .sign-row { border: 1px solid #000; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Link to="/my-leave" className="text-primary font-bold text-sm hover:underline">← Back</Link>
        <button
          onClick={() => window.print()}
          className="bg-primary text-black font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors shadow-[0_0_15px_rgba(0,188,212,0.3)]"
        >
          🖨️ Print this form
        </button>
      </div>

      <div className="sheet bg-white text-black rounded-xl shadow-2xl max-w-[210mm] mx-auto p-8 md:p-12 print:rounded-none print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-6">
          <div>
            <div className="text-xl font-black tracking-wide">STARium RAFA</div>
            <div className="text-[11px] uppercase tracking-widest font-bold text-gray-700">
              Leave Request Form
            </div>
          </div>
          <div className="text-right text-[11px] text-gray-700">
            <div>Leave year <strong>{request.leaveYear}</strong></div>
            <div className="mono">Ref: {request.id?.slice(0, 8)?.toUpperCase()}</div>
            {request.lodgedBy && (
              <div className="mt-1 inline-block border border-gray-500 px-2 py-0.5 font-bold uppercase">
                Lodged by HR ({request.lodgedBy})
              </div>
            )}
          </div>
        </div>

        {/* Section 1 */}
        <div className="mb-6">
          <div className="font-black text-[13px] uppercase tracking-wider border-b border-black pb-1 mb-2">
            Section 1 — Leave details
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              <Row label="Name" value={request.employeeName} />
              <Row label="Cadre / Designation" value={request.cadreDesignation} />
              <Row label="SAP No." value={request.sapNumber} />
              <Row label="Department" value={request.departmentLabel || request.department} />
              <Row label="Shift" value={request.shift} />
              <Row label="Type of leave" value={request.leaveTypeLabel || request.leaveType} />
              {request.purpose && <Row label="Purpose" value={request.purpose} />}
              <Row label="Leave commences" value={fmt(request.leaveCommences)} />
              <Row label="Leave ends" value={fmt(request.leaveEnds)} />
              <Row label="Resumption date" value={fmt(request.resumptionDate)} />
              <Row
                label="Working days this vacation"
                value={<strong>{request.requestedDays}</strong>}
              />
              <Row
                label="Annual leave days entitled"
                value={<>
                  {request.entitledAtRequest}
                  {request.carryOverAtRequest ? ` (+${request.carryOverAtRequest} carried over)` : ''}
                </>}
              />
              <Row label="No. of days already taken" value={request.takenBeforeThisRequest} />
              <Row
                label="Outstanding after this vacation"
                value={<strong>{request.outstandingAfter}</strong>}
              />
              {request.excludedNonWorkingDays?.length > 0 && (
                <Row
                  label="Non-working days included (not deducted)"
                  value={request.excludedNonWorkingDays.map(d => `${d.date} (${d.label})`).join(', ')}
                />
              )}
              <Row label="Contact while away" value={[request.contactPhone, request.contactEmail].filter(Boolean).join(' · ')} />
            </tbody>
          </table>
        </div>

        {/* Section 2 */}
        <div className="mb-6">
          <div className="font-black text-[13px] uppercase tracking-wider border-b border-black pb-1 mb-2">
            Section 2 — Declaration & handover
          </div>
          <p className="text-[11px] text-gray-800 italic mb-3">
            &ldquo;I will do / I have already done my handover note to ___ and I accept to cover
            for the staff proceeding on leave.&rdquo;
          </p>
          <table className="w-full text-[12px]">
            <tbody>
              <Row label="Handing over to" value={request.handoverTo} />
              <Row label="Handover note" value={request.handoverNote} />
              <Row
                label="Applicant's signature"
                value={request.applicantConfirmed
                  ? `${request.applicantConfirmedName || '—'} (declared in the app)`
                  : 'Not yet declared'}
              />
            </tbody>
          </table>
        </div>

        {/* Section 3 */}
        <div className="mb-6">
          <div className="font-black text-[13px] uppercase tracking-wider border-b border-black pb-1 mb-2">
            Section 3 — Approvals (in order)
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-700">
                <th className="py-1">Stage</th>
                <th className="py-1">Signature</th>
                <th className="py-1">Date</th>
                <th className="py-1">Note</th>
              </tr>
            </thead>
            <tbody>
              {stages.map(stage => {
                const e = request.workflow?.[stage.id] || {};
                return (
                  <tr key={stage.id} className="sign-row">
                    <td className="py-2 pr-2 font-bold">{stage.label}</td>
                    <td className="py-2 pr-2">
                      {e.status === 'approved' || e.status === 'rejected' ? (
                        <>
                          {e.byName || '—'}
                          <div className="text-[10px] text-gray-600">
                            {e.status === 'rejected' ? 'REJECTED' : e.actedAsDeputyFor ? `standing in: ${e.actedAsDeputyFor}` : `as ${e.byRole || stage.actionRole}`}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-500">pending</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">{e.actedAt ? fmt(e.actedAt) : '—'}</td>
                    <td className="py-2 text-gray-700">{e.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {request.rejectedReason && (
            <p className="mt-2 text-[12px]">
              <strong>Reason for rejection:</strong> {request.rejectedReason}
            </p>
          )}
        </div>

        {/* Footer: the paper form's resumption block */}
        <div className="border-t border-black pt-3 text-[11px] text-gray-800">
          <div className="font-bold uppercase mb-1">Resumption of duty</div>
          <p>
            Staff should not proceed until they have received formal approval. On return, the
            employee confirms resumption in the app, which closes the record.
            {request.resumedOn ? (
              <> Confirmed {fmt(request.resumedOn)}.</>
            ) : (
              <> Not yet confirmed.</>
            )}
          </p>
          <p className="mt-2 text-gray-600">
            Printed {fmt(new Date())} from the Starium Rafa ERP · figures frozen on
            {' '}{fmt(request.requestedAt || request.createdAt)}.
          </p>
        </div>
      </div>
    </div>
  );
}
