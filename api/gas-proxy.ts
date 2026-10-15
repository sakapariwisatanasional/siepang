/**
 * SiEpang — Vercel server-side Google Apps Script gateway.
 * Source of truth remains GAS. No caching, no mock responses, no token/OTP logging.
 * Place at repository root: api/gas-proxy.ts
 * Required Vercel Environment Variable: SIEPANG_GAS_WEB_APP_URL
 */

const MAX_REQUEST_BYTES = 4_000_000;
const GAS_TIMEOUT_MS = 55_000;

function sendJson(res: any, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, data: null, error: { code: 'METHOD_NOT_ALLOWED', message: 'Gunakan POST.' } });
  }

  const backendUrl = process.env.SIEPANG_GAS_WEB_APP_URL?.trim();
  if (!backendUrl || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(backendUrl)) {
    return sendJson(res, 503, { ok: false, data: null, error: { code: 'GAS_NOT_CONFIGURED', message: 'Endpoint backend belum dikonfigurasi pada Vercel.' } });
  }

  // Vercel normally parses application/json automatically; text/plain may be unparsed.
  let raw: string;
  try {
    if (typeof req.body === 'string') raw = req.body;
    else if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8');
    else if (req.body && typeof req.body === 'object') raw = JSON.stringify(req.body);
    else {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const part of req) {
        const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
        bytes += chunk.length;
        if (bytes > MAX_REQUEST_BYTES) return sendJson(res, 413, { ok: false, data: null, error: { code: 'REQUEST_TOO_LARGE', message: 'Permintaan terlalu besar.' } });
        chunks.push(chunk);
      }
      raw = Buffer.concat(chunks).toString('utf8');
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BYTES) {
      return sendJson(res, 413, { ok: false, data: null, error: { code: 'REQUEST_TOO_LARGE', message: 'Permintaan terlalu besar.' } });
    }
  } catch {
    return sendJson(res, 400, { ok: false, data: null, error: { code: 'INVALID_REQUEST', message: 'Permintaan tidak dapat dibaca.' } });
  }

  let envelope: any;
  try { envelope = JSON.parse(raw); } catch {
    return sendJson(res, 400, { ok: false, data: null, error: { code: 'INVALID_JSON', message: 'Format permintaan tidak valid.' } });
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
      typeof envelope.action !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{1,100}$/.test(envelope.action)) {
    return sendJson(res, 400, { ok: false, data: null, error: { code: 'INVALID_ACTION', message: 'Action API tidak valid.' } });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GAS_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: raw,
        redirect: 'follow',
        cache: 'no-store',
        signal: controller.signal,
      });
      const body = await upstream.text();
      if (!upstream.ok) {
        return sendJson(res, 502, { ok: false, request_id: envelope.request_id || null, data: null, error: { code: 'GAS_HTTP_ERROR', message: `GAS mengembalikan HTTP ${upstream.status}.` } });
      }
      let parsed: any;
      try { parsed = JSON.parse(body); } catch {
        return sendJson(res, 502, { ok: false, request_id: envelope.request_id || null, data: null, error: { code: 'GAS_INVALID_JSON', message: 'Respons GAS bukan JSON yang valid.' } });
      }
      if (!parsed || typeof parsed !== 'object' ||
          (typeof parsed.ok !== 'boolean' && typeof parsed.success !== 'boolean')) {
        return sendJson(res, 502, { ok: false, request_id: envelope.request_id || null, data: null, error: { code: 'GAS_INVALID_ENVELOPE', message: 'Respons GAS tidak memiliki status keberhasilan yang valid.' } });
      }
      return sendJson(res, 200, parsed);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    const timeout = err?.name === 'AbortError';
    return sendJson(res, timeout ? 504 : 502, {
      ok: false, request_id: envelope.request_id || null, data: null,
      error: { code: timeout ? 'GAS_TIMEOUT' : 'GAS_NETWORK_ERROR', message: timeout ? 'Respons GAS melewati batas waktu. Periksa status sebelum mengulangi tindakan.' : 'Server tidak dapat membaca respons GAS.' },
    });
  }
}
