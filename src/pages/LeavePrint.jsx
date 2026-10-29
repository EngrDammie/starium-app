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
          .print-row td { border-bottom: 1px solid #000; padding: 3pt 3pt; }
          .print-row td.label { width: 36%; font-weight: 600; color: #000; font-size: 10pt; }
          .print-row td.value { color: #000; font-size: 10pt; }
          .sign-row { border: 1px solid #000; }
          .sign-row td { padding: 3pt 3pt; font-size: 9.5pt; }
          @page { size: A4; margin: 10mm; }
          .section-title { font-size: 11pt; margin-bottom: 4pt; }
          .sheet { padding: 8mm !important; }
          table { border-collapse: collapse; }
          p { margin: 2pt 0; }
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
        <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-4" style={{fontSize: '10pt'}}>
          <div>
            <div className="text-lg font-black tracking-wide">STARium RAFA</div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-gray-700">
              Leave Request Form
            </div>
          </div>
          <div className="text-right text-[10px] text-gray-700">
            <div>Leave year <strong>{request.leaveYear}</strong></div>
            <div className="mono">Ref: {request.id?.slice(0, 8)?.toUpperCase()}</div>
            {request.lodgedBy && (
              <div className="mt-1 inline-block border border-gray-500 px-2 py-0.5 font-bold uppercase text-[9px]">
                Lodged by HR ({request.lodgedBy})
              </div>
            )}
          </div>
        </div>

        {/* Section 1 */}
        <div className="mb-4" style={{fontSize: '10pt'}}>
          <div className="font-black uppercase tracking-wider border-b border-black pb-1 mb-2 section-title">
            Section 1 — Leave details
          </div>
          <table className="w-full" style={{fontSize: '10pt', borderCollapse: 'collapse'}}>
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
        <div className="mb-4" style={{fontSize: '10pt'}}>
          <div className="font-black uppercase tracking-wider border-b border-black pb-1 mb-2 section-title">
            Section 2 — Declaration & handover
          </div>
          <p className="text-[9px] text-gray-800 italic mb-2" style={{lineHeight: '1.3'}}>
            &ldquo;I will do / I have already done my handover note to ___ and I accept to cover
            for the staff proceeding on leave.&rdquo;
          </p>
          <table className="w-full" style={{fontSize: '10pt', borderCollapse: 'collapse'}}>
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
        <div className="mb-4" style={{fontSize: '10pt'}}>
          <div className="font-black uppercase tracking-wider border-b border-black pb-1 mb-2 section-title">
            Section 3 — Approvals (in order)
          </div>
          <table className="w-full" style={{fontSize: '9.5pt', borderCollapse: 'collapse'}}>
            <thead>
              <tr className="text-left text-[9px] uppercase text-gray-700">
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
                    <td className="py-1 pr-2 font-bold">{stage.label}</td>
                    <td className="py-1 pr-2">
                      {e.status === 'approved' || e.status === 'rejected' ? (
                        <>
                          {e.byName || '—'}
                          <div className="text-[8.5px] text-gray-600">
                            {e.status === 'rejected' ? 'REJECTED' : e.actedAsDeputyFor ? `standing in: ${e.actedAsDeputyFor}` : `as ${e.byRole || stage.actionRole}`}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-500">pending</span>
                      )}
                    </td>
                    <td className="py-1 pr-2">{e.actedAt ? fmt(e.actedAt) : '—'}</td>
                    <td className="py-1 text-gray-700">{e.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {request.rejectedReason && (
            <p className="mt-1" style={{fontSize: '10pt'}}>
              <strong>Reason for rejection:</strong> {request.rejectedReason}
            </p>
          )}
          {request.cancelledReason && (
            <p className="mt-1" style={{fontSize: '10pt'}}>
              <strong>Reason for cancellation{request.cancelledByRole ? ` (${request.cancelledByRole})` : ''}:</strong> {request.cancelledReason}
            </p>
          )}
          {(request.status === 'recalled' || request.daysConsumed != null) && (
            <p className="mt-1" style={{fontSize: '10pt'}}>
              <strong>Recalled from leave:</strong> {request.daysConsumed} of {request.requestedDays} working
              days taken; {request.daysReturned} returned to the balance.
              {request.recallReason ? ` Reason: ${request.recallReason}` : ''}
              {request.recalledBy ? ` (by ${request.recalledBy})` : ''}
            </p>
          )}
        </div>

        {/* Footer: the paper form's resumption block */}
        <div className="border-t border-black pt-2 text-[9.5px] text-gray-800" style={{lineHeight: '1.4'}}>
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
          <p className="mt-1 text-gray-600">
            Printed {fmt(new Date())} from the Starium Rafa ERP · figures frozen on
            {' '}{fmt(request.requestedAt || request.createdAt)}.
          </p>
        </div>
      </div>
    </div>
  );
}
