// src/templates.js — the six emails, as plain text.
//
// Deliberately plain text, not HTML, for v1: these are internal
// notifications, and plain text renders correctly everywhere a factory
// phone can display mail — including the oldest client anyone owns.
//
// THE PRIVACY RULE, carried over from the app: no leave PURPOSE appears in
// any email. A compassionate-leave reason can involve family bereavement;
// mailboxes get forwarded, screenshotted and left open. Approvers read
// purposes in the app, where the access rules already govern them.
//
// Every template names the event in its first line, so a mailbox search for
// "leave" tells the whole story without opening anything.

const fmt = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d) ? String(value)
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const range = (r) => `${fmt(r.leaveCommences)} to ${fmt(r.leaveEnds)}`;

// The signature block every mail ends with — where it came from, and the
// one true place to look. Links rather than attachments: the app is the
// record, the mail is only the knock on the door.
const footer = (appUrl, linkLine) => [
  linkLine,
  '',
  'This message was sent automatically by the Starium Rafa ERP.',
  `The app is the source of truth: ${appUrl}`,
].join('\n');

export function buildMessage(event, { request, stageLabel, reason, actorEmail, appUrl }) {
  const name = request.employeeName || 'a member of staff';
  const days = request.requestedDays;
  const approveUrl = `${appUrl}/#/leave-approvals`;
  const myUrl = `${appUrl}/#/my-leave`;

  switch (event) {
    case 'submitted':
      return {
        subject: `Leave request awaiting your signature — ${name}`,
        body:
          `${name} has requested ${days} working days of leave, ${range(request)}.\n\n` +
          `It is waiting for the ${stageLabel || 'first approver'} to sign. The full details — ` +
          `type of leave, handover and the balance arithmetic — are in the app.\n\n` +
          footer(appUrl, `Review and sign it here: ${approveUrl}`),
      };

    case 'stage_signed':
      return {
        subject: `Leave request now with you — ${name}`,
        body:
          `A leave request from ${name} (${days} working days, ${range(request)}) has been signed ` +
          `at the previous stage and is now waiting for the ${stageLabel || 'next approver'}.\n\n` +
          footer(appUrl, `Review and sign it here: ${approveUrl}`),
      };

    case 'approved':
      return {
        subject: `Your leave is approved — ${range(request)}`,
        body:
          `Good news: your leave from ${range(request)} (${days} working days) has been approved ` +
          `by all three signatories.\n\n` +
          `Your resumption date is ${fmt(request.resumptionDate)} — the first working day after your leave ends.\n` +
          `You do not need to do anything else now. When you are back, the app will ask you to ` +
          `confirm your return, which closes the record.\n\n` +
          footer(appUrl, `Your leave, and a printable copy of the form: ${myUrl}`),
      };

    case 'rejected':
      return {
        subject: `Your leave request was not approved`,
        body:
          `Your request for ${days} working days from ${range(request)} was not approved.\n\n` +
          `The reason given:\n\n    "${reason || 'No reason was recorded.'}"\n\n` +
          `This is usually about cover, not about you. Speak to the approver or to HR, and if the ` +
          `dates were the problem you can simply request different ones.\n\n` +
          footer(appUrl, `The full request, and the place to submit new dates: ${myUrl}`),
      };

    case 'lodged':
      return {
        subject: `A leave request was lodged for you — ${range(request)}`,
        body:
          `HR has lodged a leave request on your behalf: ${days} working days from ${range(request)}.\n\n` +
          `You do not need to do anything — it is already moving through the approvals, and the ` +
          `approvers have been notified. This message is your receipt.\n\n` +
          footer(appUrl, `If you have a login, you can follow it here: ${myUrl}`),
      };

    case 'cancelled':
      return {
        subject: `Leave cancelled — ${range(request)}`,
        body:
          `The leave request for ${name} (${days} working days, ${range(request)}) has been cancelled` +
          `${actorEmail ? ` by ${actorEmail}` : ''}.\n` +
          `${reason ? `The reason recorded:\n\n    "${reason}"\n\n` : '\n'}` +
          `The days have been returned to the balance — nothing has been spent.\n\n` +
          footer(appUrl, `The full history of this request: ${appUrl}/#/leave-approvals`),
      };

    case 'recalled':
      return {
        subject: `Your leave was cut short — days returned to your balance`,
        body:
          `Your approved leave from ${range(request)} was cut short by ${actorEmail || 'the company'}.\n\n` +
          `${request.daysConsumed} of ${request.requestedDays} working days were taken before the recall; ` +
          `the remaining ${request.daysReturned} have been returned to your balance.\n` +
          `${reason ? `The reason recorded:\n\n    "${reason}"\n\n` : '\n'}` +
          `The app has the full record, including the days taken and the reason.\n\n` +
          footer(appUrl, `Your leave history: ${myUrl}`),
      };

    default:
      return null;
  }
}
