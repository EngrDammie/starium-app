// src/smtp.js — speaking SMTP over a TLS socket, by hand.
//
// WHY THIS EXISTS: Cloudflare Workers have no SMTP library and no raw
// networking beyond TCP sockets, and this project sends through Gmail's own
// SMTP servers (chosen because mail authenticated there is signed by Google
// and lands well — not the workers.dev-spam kind). So here is the smallest
// honest SMTP client: connect with TLS from the first byte (port 465),
// authenticate, deliver one message to N recipients, quit.
//
// Two hardening choices, both about encoding rather than cleverness:
//   - The SUBJECT is RFC 2047 base64 encoded-word (the templates contain
//     em dashes; a raw UTF-8 subject line is only tolerated by servers,
//     never guaranteed).
//   - The BODY is base64, which also removes the dot-stuffing question:
//     base64 lines can never begin with a dot.
//
// The password arrives as a Worker secret and never leaves this module
// except base64'd into the AUTH conversation, which is how SMTP AUTH LOGIN
// works. It is never logged, and errors are returned without it.

import { connect } from 'cloudflare:sockets';

const CRLF = '\r\n';
const encoder = new TextEncoder();

class SmtpError extends Error {
  constructor(expected, reply) {
    super(`SMTP expected ${expected}, got: ${reply}`);
    this.name = 'SmtpError';
  }
}

// A line reader over the socket's byte stream. SMTP replies are CRLF
// terminated; multiline replies continue with "NNN-" until a final "NNN ".
function createLineReader(reader) {
  let buffer = '';
  const decoder = new TextDecoder();

  async function readLine() {
    for (;;) {
      const idx = buffer.indexOf(CRLF);
      if (idx !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + CRLF.length);
        return line;
      }
      const { done, value } = await reader.read();
      if (done) throw new SmtpError('connection closed', buffer || '');
      buffer += decoder.decode(value, { stream: true });
    }
  }

  async function readReply() {
    // Reads a full SMTP reply, including "-continuation" lines.
    const lines = [];
    for (;;) {
      const line = await readLine();
      lines.push(line);
      if (/^\d{3} /.test(line)) return lines.join(' / ');
      if (!/^\d{3}-/.test(line)) return lines.join(' / '); // tolerate odd servers
    }
  }

  return { readLine, readReply };
}

function b64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

// RFC 2047 encoded-word, chunked so no line exceeds the 78-char convention.
function encodeHeader(value) {
  const raw = b64(value);
  const words = raw.match(/.{1,60}/g) || [''];
  return words.map((w) => `=?UTF-8?B?${w}?=`).join(CRLF + ' ');
}

async function sendMail({ host, port, user, password, fromName, recipients, subject, body }) {
  const socket = await connect(`${host}:${port}`, { secureTransport: 'on' });
  const writer = socket.writable.getWriter();
  const lineReader = createLineReader(socket.readable.getReader());

  const send = async (line) => {
    await writer.write(encoder.encode(line + CRLF));
  };
  const expect = async (code) => {
    const reply = await lineReader.readReply();
    if (!reply.startsWith(String(code))) throw new SmtpError(code, reply);
    return reply;
  };

  try {
    await expect(220);                       // greeting
    await send(`EHLO starium-rafa-worker`);
    await expect(250);                       // capabilities (multiline)
    await send('AUTH LOGIN');
    await expect(334);
    await send(b64(user));
    await expect(334);
    await send(b64(password));
    await expect(235);                       // authenticated

    await send(`MAIL FROM:<${user}>`);
    await expect(250);

    const accepted = [];
    let rejected = 0;
    for (const to of recipients) {
      await send(`RCPT TO:<${to}>`);
      try {
        await expect(250);
        accepted.push(to);
      } catch {
        rejected += 1; // one bad address must not sink the rest
      }
    }
    if (accepted.length === 0) throw new SmtpError('at least one recipient', 'all recipients rejected');

    await send('DATA');
    await expect(354);

    const headers = [
      `From: ${fromName ? `"${fromName}" ` : ''}<${user}>`,
      `To: ${recipients.join(', ')}`,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@starium-rafa>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
    ].join(CRLF);

    const encodedBody = (b64(body).match(/.{1,76}/g) || ['']).join(CRLF);
    await writer.write(encoder.encode(headers + CRLF + CRLF + encodedBody + CRLF + '.' + CRLF));
    await expect(250);                       // message accepted

    await send('QUIT');
    return { accepted, rejected };
  } finally {
    try { await writer.close(); } catch { /* the socket may already be gone */ }
  }
}

export { sendMail, SmtpError };
