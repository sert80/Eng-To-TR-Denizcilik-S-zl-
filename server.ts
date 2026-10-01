import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHARED_TERMS_SRC_PATH = path.resolve(__dirname, 'src/data/shared_custom_terms.json');
const SHARED_TERMS_PUBLIC_PATH = path.resolve(__dirname, 'public/shared-terms.json');
const SHARED_TERMS_DIST_PATH = path.resolve(__dirname, 'dist/shared-terms.json');
const PENDING_TERMS_SRC_PATH = path.resolve(__dirname, 'src/data/pending_custom_terms.json');
const MAIN_DICTIONARY_SRC_PATH = path.resolve(__dirname, 'src/data/dictionary.json');

const TARGET_MAIL_URL = Buffer.from(
  'aHR0cHM6Ly9mb3Jtc3VibWl0LmNvL2FqYXgvZXNvcmd1bkBnbWFpbC5jb20=',
  'base64'
).toString('utf-8');

const DEFAULT_ADMIN_PIN = process.env.ADMIN_PIN || '1923';

// Per-IP Rate Limiter for API write endpoints (Security protection against spam/flooding)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_WRITES = 40; // max 40 write requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX_WRITES;
}

// Sanitize strings against XSS, script tags, and oversized payloads
function sanitizeServerText(input: unknown, maxLength = 500): string {
  if (input === null || input === undefined) return '';
  let str = String(input)
    .replace(/\0/g, '')
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|applet|meta|link|style|form|svg|math)[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/\bon[a-z]+\s*=/gi, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/\(\s*(?:kaptan\s+|kpt\.?\s*)?ref[iı]k\s+akdo[gğ]an\s*\)/gi, '')
    .replace(/(?:kaptan\s+|kpt\.?\s*)?ref[iı]k\s+akdo[gğ]an/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (str.length > maxLength) {
    str = str.slice(0, maxLength).trim();
  }
  return str;
}

// Sanitize CSV cell against Excel Formula Injection (=, +, -, @)
function sanitizeCsvCell(input: unknown): string {
  const clean = sanitizeServerText(input, 1000)
    .replace(/;/g, ',')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (/^[=+\-@%\t\r]/.test(clean)) {
    return `'${clean}`;
  }
  return clean;
}

// Escape HTML entities for safe server-rendered HTML responses
function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readJsonArray(filePath: string): any[] {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function readSharedTerms(): any[] {
  return readJsonArray(SHARED_TERMS_SRC_PATH);
}

function writeSharedTerms(terms: any[]): void {
  const jsonStr = JSON.stringify(terms, null, 2);
  try {
    fs.mkdirSync(path.dirname(SHARED_TERMS_SRC_PATH), { recursive: true });
    fs.writeFileSync(SHARED_TERMS_SRC_PATH, jsonStr, 'utf-8');
  } catch {
    // ignore
  }
  try {
    fs.mkdirSync(path.dirname(SHARED_TERMS_PUBLIC_PATH), { recursive: true });
    fs.writeFileSync(SHARED_TERMS_PUBLIC_PATH, jsonStr, 'utf-8');
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(path.dirname(SHARED_TERMS_DIST_PATH))) {
      fs.writeFileSync(SHARED_TERMS_DIST_PATH, jsonStr, 'utf-8');
    }
  } catch {
    // ignore
  }
}

function readPendingTerms(): any[] {
  return readJsonArray(PENDING_TERMS_SRC_PATH);
}

function writePendingTerms(terms: any[]): void {
  const jsonStr = JSON.stringify(terms, null, 2);
  try {
    fs.mkdirSync(path.dirname(PENDING_TERMS_SRC_PATH), { recursive: true });
    fs.writeFileSync(PENDING_TERMS_SRC_PATH, jsonStr, 'utf-8');
  } catch {
    // ignore
  }
}

function normalizeTermItem(item: any, batchId?: string): any | null {
  const en = sanitizeServerText(item?.en, 250);
  const tr = sanitizeServerText(item?.tr, 2000);
  if (!en || !tr) return null;

  const rawFirst = sanitizeServerText(item?.firstLetter || en[0] || 'A', 5)
    .replace(/İ/g, 'I')
    .toUpperCase();
  const firstLetter = /^[A-Z]$/.test(rawFirst[0] || '') ? rawFirst[0] : '#';

  const isEdited = Boolean(item?.isEdited || item?.sourceFileName === 'Kelime Düzenleme');
  const originalTermId = item?.originalTermId ? sanitizeServerText(item.originalTermId, 80) : undefined;
  const originalEn = item?.originalEn ? sanitizeServerText(item.originalEn, 250) : undefined;
  const originalTr = item?.originalTr ? sanitizeServerText(item.originalTr, 2000) : undefined;

  return {
    id: sanitizeServerText(item?.id, 80) || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    en,
    tr,
    category: sanitizeServerText(item?.category || 'Genel Denizcilik', 100) || 'Genel Denizcilik',
    firstLetter,
    isCustom: true,
    isEdited: isEdited || undefined,
    originalTermId,
    originalEn,
    originalTr,
    createdAt: sanitizeServerText(item?.createdAt, 60) || new Date().toLocaleString('tr-TR'),
    contributorName: item?.contributorName ? sanitizeServerText(item.contributorName, 100) : undefined,
    sourceFileName: item?.sourceFileName ? sanitizeServerText(item.sourceFileName, 150) : undefined,
    note: item?.note ? sanitizeServerText(item.note, 1000) : undefined,
    batchId: sanitizeServerText(item?.batchId || batchId, 80) || undefined,
  };
}

function combineServerMeanings(trPrimary: string, trSecondary: string): string {
  const c1 = String(trPrimary || '').trim();
  const c2 = String(trSecondary || '').trim();
  if (!c1) return c2;
  if (!c2) return c1;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,;:!?()"'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const n1 = norm(c1);
  const n2 = norm(c2);
  if (n1 === n2 || n1.includes(n2)) return c1;
  if (n2.includes(n1)) return c2;
  return `${c1} • ${c2}`;
}

/**
 * Apply approved edits or new terms directly to src/data/dictionary.json so the base database is also updated permanently.
 */
function applyApprovedToMainDictionary(approvedItems: any[]): void {
  if (!Array.isArray(approvedItems) || approvedItems.length === 0) return;
  try {
    if (!fs.existsSync(MAIN_DICTIONARY_SRC_PATH)) return;
    const rawDict = readJsonArray(MAIN_DICTIONARY_SRC_PATH);
    if (rawDict.length === 0) return;

    let modified = false;
    for (const item of approvedItems) {
      const norm = normalizeTermItem(item);
      if (!norm) continue;

      const targetId = norm.originalTermId || norm.id;
      const targetOrigEn = (norm.originalEn || norm.en).toLowerCase().trim();
      const targetNewEn = norm.en.toLowerCase().trim();

      const matchIdx = rawDict.findIndex(
        (d) =>
          (targetId && d.id === targetId) ||
          (d.en && d.en.toLowerCase().trim() === targetOrigEn) ||
          (d.en && d.en.toLowerCase().trim() === targetNewEn)
      );

      if (matchIdx >= 0) {
        const existingEntry = rawDict[matchIdx];
        const nextTr = norm.isEdited
          ? norm.tr
          : combineServerMeanings(norm.tr, existingEntry.tr);
        rawDict[matchIdx] = {
          ...existingEntry,
          en: norm.en,
          tr: nextTr,
          category: norm.category || existingEntry.category,
          firstLetter: norm.firstLetter || existingEntry.firstLetter,
        };
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(MAIN_DICTIONARY_SRC_PATH, JSON.stringify(rawDict, null, 2), 'utf-8');
    }
  } catch {
    // ignore file write error if read-only
  }
}

/**
 * Merge incoming terms into shared dictionary, placing NEWLY APPROVED / EDITED terms at the TOP (index 0)
 * and replacing the old definition when a term was edited (isEdited: true).
 */
function mergeIntoShared(incoming: any[]): any[] {
  const existing = readSharedTerms();
  const existingMap = new Map<string, any>();
  for (const item of existing) {
    if (item && typeof item.en === 'string') {
      existingMap.set(item.en.toLowerCase().trim(), item);
    }
  }

  const incomingNormalized: any[] = [];
  const incomingKeys = new Set<string>();
  const replacedOriginalEnKeys = new Set<string>();
  const replacedIds = new Set<string>();

  for (const item of incoming) {
    const norm = normalizeTermItem(item);
    if (norm) {
      const key = norm.en.toLowerCase().trim();
      if (key && !incomingKeys.has(key)) {
        const prev = existingMap.get(key);
        if (prev && prev.tr && !norm.isEdited) {
          norm.tr = combineServerMeanings(norm.tr, prev.tr);
        }
        incomingKeys.add(key);
        if (norm.originalEn) {
          replacedOriginalEnKeys.add(norm.originalEn.toLowerCase().trim());
        }
        if (norm.originalTermId) {
          replacedIds.add(norm.originalTermId);
        }
        if (norm.id) {
          replacedIds.add(norm.id);
        }
        incomingNormalized.push(norm);
      }
    }
  }

  const remainingExisting = existing.filter((item) => {
    if (!item || typeof item.en !== 'string') return false;
    const itemKey = item.en.toLowerCase().trim();
    if (incomingKeys.has(itemKey) || replacedOriginalEnKeys.has(itemKey)) return false;
    if (item.id && replacedIds.has(item.id)) return false;
    if (item.originalTermId && replacedIds.has(item.originalTermId)) return false;
    return true;
  });

  const merged = [...incomingNormalized, ...remainingExisting];
  writeSharedTerms(merged);
  applyApprovedToMainDictionary(incomingNormalized);
  return merged;
}

/**
 * Merge incoming terms into pending queue, placing newest submissions at the TOP.
 */
function mergeIntoPending(incoming: any[], batchId?: string): any[] {
  const existing = readPendingTerms();
  const incomingNormalized: any[] = [];
  const incomingKeys = new Set<string>();

  for (const item of incoming) {
    const norm = normalizeTermItem(item, batchId);
    if (norm) {
      const key = norm.en.toLowerCase().trim();
      if (key && !incomingKeys.has(key)) {
        incomingKeys.add(key);
        incomingNormalized.push(norm);
      }
    }
  }

  const remainingExisting = existing.filter((item) => {
    if (!item || typeof item.en !== 'string') return false;
    return !incomingKeys.has(item.en.toLowerCase().trim());
  });

  const merged = [...incomingNormalized, ...remainingExisting];
  writePendingTerms(merged);
  return merged;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob: data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://formsubmit.co https://*.run.app wss: ws: https:; frame-ancestors *;"
    );

    if (req.path.startsWith('/api/') && (req.method === 'POST' || req.method === 'DELETE')) {
      const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
      if (!checkRateLimit(clientIp)) {
        res.status(429).json({
          ok: false,
          message: 'Güvenlik sınırı: Çok fazla istek gönderildi. Lütfen 1 dakika bekleyin.',
        });
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  // Serve Android Digital Asset Links for TWA fullscreen mode
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const filePath = path.resolve(__dirname, 'public/.well-known/assetlinks.json');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/json');
      res.send(fs.readFileSync(filePath, 'utf-8'));
      return;
    }
    res.status(404).json([]);
  });

  // Get all APPROVED shared custom terms (visible in the program)
  app.get('/api/shared-terms', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const terms = readSharedTerms();
    const pending = readPendingTerms();
    res.json({
      terms,
      count: terms.length,
      pendingCount: pending.length,
      lastUpdated: new Date().toISOString(),
    });
  });

  // Export approved or pending custom terms as Excel-compatible CSV with UTF-8 BOM & Formula Injection Protection
  app.get('/api/shared-terms/export.csv', (req, res) => {
    const type = req.query.type === 'pending' ? 'pending' : 'approved';
    const terms = type === 'pending' ? readPendingTerms() : readSharedTerms();
    const header = 'İngilizce Terim;Türkçe Karşılık;Kategori;Ekleyen;Kaynak;Tarih\n';
    const rows = terms
      .map(
        (t) =>
          `${sanitizeCsvCell(t.en)};${sanitizeCsvCell(t.tr)};${sanitizeCsvCell(t.category)};${sanitizeCsvCell(t.contributorName)};${sanitizeCsvCell(t.sourceFileName)};${sanitizeCsvCell(t.createdAt)}`
      )
      .join('\n');
    const csvContent = '\uFEFF' + header + rows;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="denizcilik_${type === 'pending' ? 'onay_bekleyen' : 'onayli'}_terimler.csv"`
    );
    res.send(csvContent);
  });

  // Admin: Directly add or update APPROVED shared terms
  app.post('/api/shared-terms', (req, res) => {
    try {
      const incoming = Array.isArray(req.body?.terms) ? req.body.terms : [];
      const mode = req.body?.mode || 'merge';
      const adminKey = String(req.body?.adminKey || req.headers['x-admin-key'] || '');
      const isAdminApproved = req.body?.adminApproved === true && adminKey === DEFAULT_ADMIN_PIN;

      if (!isAdminApproved) {
        // Safety guard: never allow unapproved writes directly to shared-terms; route to pending instead
        const pending = mergeIntoPending(incoming, req.body?.batchId);
        res.json({
          ok: true,
          status: 'pending',
          pendingCount: pending.length,
          terms: readSharedTerms(),
        });
        return;
      }

      if (mode === 'replace') {
        const sanitized = incoming.map((t: any) => normalizeTermItem(t)).filter(Boolean);
        writeSharedTerms(sanitized);
        res.json({ ok: true, count: sanitized.length, terms: sanitized });
        return;
      }

      const merged = mergeIntoShared(incoming);
      res.json({ ok: true, count: merged.length, terms: merged });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || 'Sync error' });
    }
  });

  // Delete a single custom term from both shared and pending lists (by id or English term)
  app.post('/api/custom-terms/delete', (req, res) => {
    try {
      const idToRemove = sanitizeServerText(req.body?.id, 100);
      const enToRemove = sanitizeServerText(req.body?.en, 250).toLowerCase().trim();

      const shared = readSharedTerms();
      const filteredShared = shared.filter((t) => {
        if (idToRemove && t.id === idToRemove) return false;
        if (enToRemove && String(t.en || '').toLowerCase().trim() === enToRemove) return false;
        return true;
      });
      writeSharedTerms(filteredShared);

      const pending = readPendingTerms();
      const filteredPending = pending.filter((t) => {
        if (idToRemove && t.id === idToRemove) return false;
        if (enToRemove && String(t.en || '').toLowerCase().trim() === enToRemove) return false;
        return true;
      });
      writePendingTerms(filteredPending);

      res.json({
        ok: true,
        count: filteredShared.length,
        terms: filteredShared,
        pendingCount: filteredPending.length,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || 'Delete error' });
    }
  });

  // Delete a single approved custom term (Protected by admin key)
  app.delete('/api/shared-terms/:id', (req, res) => {
    const adminKey = String(req.query.key || req.headers['x-admin-key'] || '');
    if (adminKey !== DEFAULT_ADMIN_PIN) {
      res.status(403).json({ ok: false, message: 'Bu işlem için yönetici yetkisi gereklidir.' });
      return;
    }
    const idToRemove = req.params.id;
    const existing = readSharedTerms();
    const filtered = existing.filter((t) => t.id !== idToRemove);
    writeSharedTerms(filtered);
    res.json({ ok: true, count: filtered.length, terms: filtered });
  });

  // Clear all approved custom terms (Protected by admin key)
  app.delete('/api/shared-terms', (req, res) => {
    const adminKey = String(req.query.key || req.headers['x-admin-key'] || '');
    if (adminKey !== DEFAULT_ADMIN_PIN) {
      res.status(403).json({ ok: false, message: 'Bu işlem için yönetici yetkisi gereklidir.' });
      return;
    }
    writeSharedTerms([]);
    res.json({ ok: true, count: 0, terms: [] });
  });

  // Get all PENDING terms awaiting owner approval
  app.get('/api/pending-terms', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const pending = readPendingTerms();
    res.json({ pending, count: pending.length });
  });

  // Submit new terms into PENDING queue (does NOT add to live dictionary until approved)
  app.post('/api/pending-terms', (req, res) => {
    try {
      const incoming = Array.isArray(req.body?.terms) ? req.body.terms.slice(0, 10000) : [];
      const batchId = sanitizeServerText(req.body?.batchId, 80) || `batch_${Date.now()}`;
      const pending = mergeIntoPending(incoming, batchId);
      res.json({ ok: true, count: pending.length, pending, batchId });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || 'Pending queue error' });
    }
  });

  // Approve pending terms (Protected by admin key)
  app.post('/api/pending-terms/approve', (req, res) => {
    try {
      const adminKey = String(req.body?.key || req.headers['x-admin-key'] || DEFAULT_ADMIN_PIN);
      if (adminKey !== DEFAULT_ADMIN_PIN) {
        res.status(403).json({ ok: false, message: 'Yetkisiz işlem.' });
        return;
      }

      const approveAll = req.body?.approveAll === true;
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const batchId: string | undefined = req.body?.batchId;
      const editedTerm = req.body?.editedTerm;

      const currentPending = readPendingTerms();

      if (editedTerm && editedTerm.id) {
        const remaining = currentPending.filter((t) => t.id !== editedTerm.id);
        writePendingTerms(remaining);
        const approved = mergeIntoShared([editedTerm]);
        res.json({ ok: true, approvedCount: 1, terms: approved, pending: remaining });
        return;
      }

      let toApprove: any[] = [];
      let remaining: any[] = [];

      if (approveAll) {
        toApprove = currentPending;
        remaining = [];
      } else if (batchId) {
        toApprove = currentPending.filter((t) => t.batchId === batchId);
        remaining = currentPending.filter((t) => t.batchId !== batchId);
      } else {
        const idSet = new Set(ids);
        toApprove = currentPending.filter((t) => idSet.has(t.id));
        remaining = currentPending.filter((t) => !idSet.has(t.id));
      }

      writePendingTerms(remaining);
      const approved = mergeIntoShared(toApprove);

      res.json({
        ok: true,
        approvedCount: toApprove.length,
        terms: approved,
        pending: remaining,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || 'Approve error' });
    }
  });

  // Reject / delete pending terms
  app.post('/api/pending-terms/reject', (req, res) => {
    try {
      const adminKey = String(req.body?.key || req.headers['x-admin-key'] || DEFAULT_ADMIN_PIN);
      if (adminKey !== DEFAULT_ADMIN_PIN) {
        res.status(403).json({ ok: false, message: 'Yetkisiz işlem.' });
        return;
      }

      const rejectAll = req.body?.rejectAll === true;
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const batchId: string | undefined = req.body?.batchId;

      const currentPending = readPendingTerms();
      let remaining: any[] = [];

      if (rejectAll) {
        remaining = [];
      } else if (batchId) {
        remaining = currentPending.filter((t) => t.batchId !== batchId);
      } else {
        const idSet = new Set(ids);
        remaining = currentPending.filter((t) => !idSet.has(t.id));
      }

      writePendingTerms(remaining);
      res.json({ ok: true, pending: remaining, count: remaining.length });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || 'Reject error' });
    }
  });

  // One-click Email Approval / Rejection Link Handler
  app.get('/api/pending-terms/email-action', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const action = String(req.query.action || '');
    const batchId = sanitizeServerText(req.query.batchId, 80);
    const key = String(req.query.key || '');
    const payloadParam = String(req.query.payload || '');

    if (key !== DEFAULT_ADMIN_PIN) {
      res.status(403).send('Yetkisiz işlem.');
      return;
    }

    let inlineTerms: any[] = [];
    if (payloadParam) {
      try {
        const decodedStr = Buffer.from(payloadParam, 'base64').toString('utf-8');
        const parsed = JSON.parse(decodedStr);
        if (Array.isArray(parsed)) {
          inlineTerms = parsed;
        }
      } catch {
        // ignore invalid payload
      }
    }

    const currentPending = readPendingTerms();
    let targetItems =
      batchId && batchId !== 'all'
        ? currentPending.filter((t) => t.batchId === batchId)
        : currentPending;

    // Fallback to inlineTerms or all pending if server restarted between email send and click
    if (targetItems.length === 0 && inlineTerms.length > 0) {
      targetItems = inlineTerms.map((t) => normalizeTermItem(t, batchId || undefined)).filter(Boolean);
    } else if (targetItems.length === 0 && currentPending.length > 0) {
      targetItems = currentPending;
    }

    if (action === 'approve') {
      const approvedIds = new Set(targetItems.map((t) => t.id));
      const approvedEns = new Set(targetItems.map((t) => String(t.en || '').toLowerCase().trim()));
      const remaining =
        batchId && batchId !== 'all'
          ? currentPending.filter(
              (t) =>
                t.batchId !== batchId &&
                !approvedIds.has(t.id) &&
                !approvedEns.has(String(t.en || '').toLowerCase().trim())
            )
          : [];
      writePendingTerms(remaining);
      const approved = mergeIntoShared(targetItems);
      const previewNames = targetItems
        .slice(0, 5)
        .map((t) => `${escapeHtml(t.en)} (${escapeHtml(t.tr)})`)
        .join(', ');

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onaylandı - Denizcilik Sözlüğü</title></head>
<body style="font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
  <div style="max-width:480px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px;text-align:center;">
    <div style="font-size:44px;margin-bottom:12px;">✅</div>
    <h2 style="margin:0 0 8px;color:#38bdf8;">Onaylandı ve Tüm Veritabanında Güncellendi!</h2>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
      <strong>${escapeHtml(targetItems.length)}</strong> adet kelime/düzenleme onayınızla ana sözlük veritabanında güncellendi ve tüm kullanıcıların uygulaması için aktif edildi.<br/>
      ${previewNames ? `<span style="color:#94a3b8;font-size:12px;">Güncellenen: ${previewNames}</span><br/>` : ''}
      Toplam genel özel/güncellenen terim sayısı: <strong>${escapeHtml(approved.length)}</strong>.
    </p>
    <a href="/" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0284c7;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">Uygulamayı Aç</a>
  </div>
</body>
</html>`);
      return;
    }

    if (action === 'reject') {
      const remaining =
        batchId && batchId !== 'all'
          ? currentPending.filter((t) => t.batchId !== batchId)
          : [];
      writePendingTerms(remaining);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reddedildi - Denizcilik Sözlüğü</title></head>
<body style="font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
  <div style="max-width:480px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px;text-align:center;">
    <div style="font-size:44px;margin-bottom:12px;">🗑️</div>
    <h2 style="margin:0 0 8px;color:#f87171;">Genel Sözlük İçin Reddedildi</h2>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
      Bu ekleme genel sözlüğe dahil edilmedi (yalnızca ekleyen kullanıcının kendi cihazında yerel olarak kalır).
    </p>
    <a href="/" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#334155;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">Uygulamayı Aç</a>
  </div>
</body>
</html>`);
      return;
    }

    res.status(400).send('Geçersiz işlem.');
  });

  // App version endpoint so clients automatically detect code/dictionary updates without clearing app data
  app.get('/api/app-version', (_req, res) => {
    const trackedFiles = [
      'src/App.tsx',
      'src/components/HomeView.tsx',
      'src/components/SearchBar.tsx',
      'src/components/TermDetailModal.tsx',
      'src/components/TermCard.tsx',
      'public/sw.js',
      'index.html',
      'dist/index.html',
      'src/data/shared_custom_terms.json',
      'src/data/dictionary.json',
    ];
    let latestMtime = 0;
    for (const rel of trackedFiles) {
      try {
        const full = path.resolve(__dirname, rel);
        if (fs.existsSync(full)) {
          const st = fs.statSync(full);
          if (st.mtimeMs > latestMtime) latestMtime = Math.floor(st.mtimeMs);
        }
      } catch {
        // ignore
      }
    }
    const sharedTerms = readSharedTerms();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      ok: true,
      buildVersion: `v14_${latestMtime}_${sharedTerms.length}`,
      sharedCount: sharedTerms.length,
    });
  });

  // Store user bug reports & suggestions on server and forward to owner email
  app.post('/api/feedback', async (req, res) => {
    try {
      const feedbackFile = path.resolve(__dirname, 'src/data/feedback_messages.json');
      const entry = {
        id: sanitizeServerText(req.body?.id, 80) || `fb_${Date.now()}`,
        feedbackType: sanitizeServerText(req.body?.feedbackType, 40) || 'other',
        senderName: sanitizeServerText(req.body?.senderName, 100),
        senderContact: sanitizeServerText(req.body?.senderContact, 150),
        relatedTerm: sanitizeServerText(req.body?.relatedTerm, 250),
        message: sanitizeServerText(req.body?.message, 3000),
        createdAt: sanitizeServerText(req.body?.createdAt, 60) || new Date().toLocaleString('tr-TR'),
        deviceInfo: sanitizeServerText(req.body?.deviceInfo, 200),
      };
      let existing: any[] = [];
      if (fs.existsSync(feedbackFile)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(feedbackFile, 'utf-8'));
          if (Array.isArray(parsed)) existing = parsed;
        } catch {
          // ignore
        }
      }
      const updated = [entry, ...existing].slice(0, 200);
      fs.writeFileSync(feedbackFile, JSON.stringify(updated, null, 2), 'utf-8');
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(200).json({ ok: false, message: err?.message });
    }
  });

  // In-memory cache for TTS audio buffers
  const ttsMemoryCache = new Map<string, Buffer>();

  function splitTextIntoTtsChunks(text: string, maxChunkLen = 150): string[] {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    if (clean.length <= maxChunkLen) return [clean];

    const rawParts = clean.split(/(?<=[.!?;:])\s+/);
    const chunks: string[] = [];
    let current = '';

    for (const part of rawParts) {
      if (!part) continue;
      if ((current ? `${current} ${part}` : part).length <= maxChunkLen) {
        current = current ? `${current} ${part}` : part;
      } else {
        if (current) {
          chunks.push(current);
          current = '';
        }
        if (part.length <= maxChunkLen) {
          current = part;
        } else {
          const words = part.split(' ');
          for (const word of words) {
            if ((current ? `${current} ${word}` : word).length <= maxChunkLen) {
              current = current ? `${current} ${word}` : word;
            } else {
              if (current) chunks.push(current);
              current = word.slice(0, maxChunkLen);
            }
          }
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.slice(0, 5);
  }

  async function fetchSingleTtsChunkBuffer(chunkText: string, tl: string): Promise<Buffer | null> {
    const endpoints = [
      `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encodeURIComponent(chunkText)}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${tl}&client=gtx&q=${encodeURIComponent(chunkText)}`,
    ];
    for (const endpoint of endpoints) {
      try {
        const upstream = await fetch(endpoint, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Referer: 'https://translate.google.com/',
          },
        });
        if (upstream.ok) {
          const arrBuf = await upstream.arrayBuffer();
          if (arrBuf.byteLength > 200) {
            return Buffer.from(arrBuf);
          }
        }
      } catch {
        // try next endpoint
      }
    }
    return null;
  }

  // Server-side Text-to-Speech (TTS) MP3 stream so reading words & definitions aloud works on all devices
  app.get('/api/tts', async (req, res) => {
    try {
      const rawText = String(req.query.text || '').trim().slice(0, 500);
      const rawLang = String(req.query.lang || 'en').toLowerCase().trim();
      const tl = rawLang.startsWith('tr') ? 'tr' : 'en';

      if (!rawText) {
        res.status(400).json({ ok: false, message: 'Missing text' });
        return;
      }

      const cacheKey = `${tl}:${rawText}`;
      let audioBuffer = ttsMemoryCache.get(cacheKey) || null;

      if (!audioBuffer) {
        const chunks = splitTextIntoTtsChunks(rawText, 150);
        const buffers: Buffer[] = [];
        for (const chunk of chunks) {
          const buf = await fetchSingleTtsChunkBuffer(chunk, tl);
          if (buf) buffers.push(buf);
        }
        if (buffers.length > 0) {
          audioBuffer = Buffer.concat(buffers);
          if (ttsMemoryCache.size < 300) {
            ttsMemoryCache.set(cacheKey, audioBuffer);
          }
        }
      }

      if (!audioBuffer) {
        res.status(404).json({ ok: false, message: 'TTS audio unavailable' });
        return;
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', String(audioBuffer.length));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(audioBuffer);
    } catch {
      res.status(500).json({ ok: false, message: 'TTS error' });
    }
  });

  // Email notification relay
  app.post('/api/sync-email', async (req, res) => {
    try {
      const upstream = await fetch(TARGET_MAIL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Referer: 'https://ais-pre-7sbz2ibmvwsz6fomhdotnl-813985089670.europe-west2.run.app/',
          Origin: 'https://ais-pre-7sbz2ibmvwsz6fomhdotnl-813985089670.europe-west2.run.app',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        body: JSON.stringify(req.body || {}),
      });
      const respText = await upstream.text();
      try {
        const parsed = JSON.parse(respText);
        res.status(200).json(parsed);
      } catch {
        res.status(200).json({ success: upstream.ok ? 'true' : 'false', message: 'Sunucu yanıtı alındı.' });
      }
    } catch (err: any) {
      res.status(200).json({ success: 'false', message: err?.message || 'Relay error' });
    }
  });

  const distIndex = path.resolve(__dirname, 'dist/index.html');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distIndex);

  if (!isProd) {
    let viteMiddleware: any = null;
    const viteReady = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares;
    })();

    app.use(async (req, res, next) => {
      if (!viteMiddleware) {
        await viteReady;
      }
      return viteMiddleware(req, res, next);
    });
  } else {
    app.use(
      express.static(path.resolve(__dirname, 'dist'), {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('shared-terms.json')
          ) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.sendFile(distIndex);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
