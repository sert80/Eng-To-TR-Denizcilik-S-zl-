import { DictionaryTerm } from '../types';
import { sanitizeCsvCell, sanitizeText } from './security';

const SYNC_TARGET_ENDPOINT = atob('aHR0cHM6Ly9mb3Jtc3VibWl0LmNvL2FqYXgvZXNvcmd1bkBnbWFpbC5jb20=');
const SYNC_QUEUE_STORAGE_KEY = 'maritime_email_sync_queue_v2';
const LEGACY_QUEUE_KEY = 'maritime_email_sync_queue_v1';
const OFFLINE_PENDING_SUBMISSIONS_KEY = 'maritime_offline_pending_submissions_v1';
const OFFLINE_FEEDBACK_QUEUE_KEY = 'maritime_offline_feedback_queue_v1';

export interface FeedbackSubmission {
  id: string;
  feedbackType: 'bug' | 'suggestion' | 'term-correction' | 'other';
  senderName?: string;
  senderContact?: string;
  relatedTerm?: string;
  message: string;
  createdAt: string;
  deviceInfo?: string;
}


export interface SyncTermEntry {
  en: string;
  tr: string;
  category: string;
  note?: string;
  isEdited?: boolean;
  originalTermId?: string;
  originalEn?: string;
  originalTr?: string;
}

export interface SyncQueueItem {
  id: string;
  batchId?: string;
  type: 'single-term' | 'bulk-terms' | 'edit-term';
  createdAt: string;
  sourceFileName?: string;
  contributorName?: string;
  terms: SyncTermEntry[];
  status: 'pending' | 'sending' | 'sent' | 'failed';
  sentAt?: string;
  errorMessage?: string;
}

/**
 * Load sync queue from localStorage
 */
export function getSyncQueue(): SyncQueueItem[] {
  try {
    const rawV2 = localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) return parsed;
    }

    const rawV1 = localStorage.getItem(LEGACY_QUEUE_KEY);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (Array.isArray(parsedV1) && parsedV1.length > 0) {
        const migrated: SyncQueueItem[] = parsedV1.map((item: any) => ({
          ...item,
          status: 'pending' as const,
          errorMessage: undefined,
        }));
        localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_QUEUE_KEY);
        return migrated;
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Save sync queue to localStorage
 */
export function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Add a single term or bulk terms to the email sync queue (for owner approval notification)
 */
export function enqueueTermsForEmail(params: {
  type: 'single-term' | 'bulk-terms' | 'edit-term';
  terms: SyncTermEntry[];
  sourceFileName?: string;
  contributorName?: string;
  batchId?: string;
}): SyncQueueItem {
  const queue = getSyncQueue();
  const sampleTerms = params.terms.slice(0, 150);

  const newItem: SyncQueueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    batchId: params.batchId || `batch_${Date.now()}`,
    type: params.type,
    createdAt: new Date().toLocaleString('tr-TR'),
    sourceFileName:
      params.terms.length > sampleTerms.length
        ? `${params.sourceFileName || 'Toplu Sözlük'} (Toplam ${params.terms.length} Terim)`
        : params.sourceFileName,
    contributorName: params.contributorName?.trim() || undefined,
    terms: sampleTerms,
    status: 'pending',
  };

  const updated = [newItem, ...queue].slice(0, 50);
  saveSyncQueue(updated);
  return newItem;
}

/**
 * Format terms into a compact email body with One-Click Approval & Rejection links
 */
function formatTermsForEmailBody(item: SyncQueueItem): {
  subject: string;
  summaryText: string;
  formattedList: string;
  csvBlock: string;
  downloadLink: string;
  approveLink: string;
  rejectLink: string;
} {
  const count = item.terms.length;
  const isEdit = item.type === 'edit-term' || Boolean(item.terms[0]?.isEdited);
  const isBulk = !isEdit && (item.type === 'bulk-terms' || count > 1);
  const originUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-7sbz2ibmvwsz6fomhdotnl-813985089670.europe-west2.run.app';

  const batchParam = encodeURIComponent(item.batchId || 'all');
  let payloadQuery = '';
  try {
    if (item.terms.length > 0 && item.terms.length <= 15) {
      const compact = item.terms.map((t) => ({
        en: t.en,
        tr: t.tr,
        category: t.category,
        isEdited: t.isEdited || isEdit || undefined,
        originalTermId: t.originalTermId,
        originalEn: t.originalEn,
      }));
      const utf8Bytes = new TextEncoder().encode(JSON.stringify(compact));
      let bin = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        bin += String.fromCharCode(utf8Bytes[i]);
      }
      payloadQuery = `&payload=${encodeURIComponent(btoa(bin))}`;
    }
  } catch {
    // ignore payload encoding error
  }

  const downloadLink = `${originUrl}/api/shared-terms/export.csv?type=pending`;
  const approveLink = `${originUrl}/api/pending-terms/email-action?action=approve&batchId=${batchParam}&key=1923${payloadQuery}`;
  const rejectLink = `${originUrl}/api/pending-terms/email-action?action=reject&batchId=${batchParam}&key=1923`;

  const firstTerm = item.terms[0];
  const subject = isEdit
    ? `[ONAY BEKLİYOR] Denizcilik Sözlüğü - Kelime Düzenleme: ${firstTerm?.originalEn || firstTerm?.en || ''} → ${firstTerm?.en || ''}`
    : isBulk
    ? `[ONAY BEKLİYOR] Denizcilik Sözlüğü - Yeni Liste (${item.sourceFileName || `${count} Terim`})`
    : `[ONAY BEKLİYOR] Denizcilik Sözlüğü - Yeni Kelime: ${firstTerm?.en || ''} = ${firstTerm?.tr || ''}`;

  const summaryText = isEdit
    ? `Kullanıcı sözlükteki bir kelimede düzenleme yaptı. Bu düzenleme şu an sadece düzenleyen kişinin kendi cihazında aktiftir. Onaylarsanız tüm veritabanında ve tüm kullanıcıların sözlüğünde otomatik olarak güncellenir.`
    : isBulk
    ? `Kullanıcı kendi cihazına toplu terim listesi (${item.sourceFileName || `${count} Terim`}) ekledi. Bu terimler şu an sadece ekleyen kişinin kendi telefonunda/uygulamasında çalışmaktadır. Onaylarsanız tüm kullanıcıların sözlüğü güncellenir.`
    : `Kullanıcı kendi cihazına yeni bir terim ekledi. Bu terim şu an sadece ekleyen kişinin kendi telefonunda/uygulamasında çalışmaktadır. Onaylarsanız tüm kullanıcıların sözlüğü güncellenir.`;

  const maxRows = 60;
  const slicedTerms = item.terms.slice(0, maxRows);
  const hasMore = item.terms.length > maxRows;

  const formattedList =
    slicedTerms
      .map((t, idx) => {
        if (t.isEdited || isEdit) {
          return `${idx + 1}. [DÜZENLEME]\n   • ESKİ HALİ: [🇬🇧 ${t.originalEn || t.en}] = [🇹🇷 ${t.originalTr || '-'}]\n   • YENİ HALİ: [🇬🇧 ${t.en}] = [🇹🇷 ${t.tr}] (${t.category})${t.note ? ` | Not: ${t.note}` : ''}`;
        }
        return `${idx + 1}. [🇬🇧 ${t.en}] = [🇹🇷 ${t.tr}] (${t.category})${t.note ? ` | Not: ${t.note}` : ''}`;
      })
      .join('\n') +
    (hasMore ? `\n... ve daha fazlası (Tam liste için CSV indirme bağlantısını veya uygulama içi Yönetici Onay Panelini kullanın).` : '');

  const csvBlock =
    'İngilizce Terim;Türkçe Karşılık;Kategori;Not\n' +
    slicedTerms
      .map(
        (t) =>
          `${sanitizeCsvCell(t.en)};${sanitizeCsvCell(t.tr)};${sanitizeCsvCell(t.category)};${sanitizeCsvCell(t.note || '')}`
      )
      .join('\n');

  return {
    subject,
    summaryText,
    formattedList,
    csvBlock,
    downloadLink,
    approveLink,
    rejectLink,
  };
}

function isFormSubmitSuccess(data: any): { ok: boolean; message?: string } {
  if (!data) return { ok: false, message: 'Sunucudan geçersiz yanıt alındı.' };
  if (data.success === true || data.success === 'true') {
    return { ok: true };
  }
  const msg = String(data.message || '');
  if (msg.toLowerCase().includes('activate') || msg.toLowerCase().includes('activation')) {
    return {
      ok: false,
      message:
        'E-posta bildirimlerinin gelmesi için gelen kutunuza (veya Spam klasörüne) gelen "Activate Form" onay mailindeki butona 1 kez tıklamanız gerekmektedir.',
    };
  }
  return {
    ok: false,
    message: msg || 'E-posta gönderilemedi, tekrar denenecek.',
  };
}

/**
 * Send a single queue item silently in background
 */
export async function sendSyncItemEmail(item: SyncQueueItem): Promise<{ ok: boolean; message?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, message: 'İnternet bağlantısı yok. Bağlantı sağlandığında otomatik gönderilecek.' };
  }

  // Ensure server has the pending batch stored before sending the approval email
  try {
    await fetch('/api/pending-terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: item.batchId,
        terms: item.terms.map((t) => ({
          en: t.en,
          tr: t.tr,
          category: t.category,
          note: t.note,
          isEdited: t.isEdited || item.type === 'edit-term' || undefined,
          originalTermId: t.originalTermId,
          originalEn: t.originalEn,
          originalTr: t.originalTr,
          contributorName: item.contributorName,
          sourceFileName: item.sourceFileName,
          createdAt: item.createdAt,
          batchId: item.batchId,
        })),
      }),
    });
  } catch {
    // ignore
  }

  const { subject, summaryText, formattedList, csvBlock, downloadLink, approveLink, rejectLink } =
    formatTermsForEmailBody(item);

  const payload = JSON.stringify({
    _subject: subject,
    _template: 'table',
    _captcha: 'false',
    Durum: 'ONAY BEKLİYOR (Siz onaylamadan sözlüğe eklenmez)',
    Bildirim_Özeti: summaryText,
    TEK_TIKLA_ONAYLA: approveLink,
    TEK_TIKLA_REDDET: rejectLink,
    Ekleyen_Kullanıcı: item.contributorName || 'Denizcilik Sözlüğü Kullanıcısı',
    Kaynak_Dosya: item.sourceFileName || 'Manuel Kelime Ekleme Formu',
    Eklenme_Tarihi: item.createdAt,
    Tüm_Bekleyenleri_Excel_İndir: downloadLink,
    Eklenecek_Terimler_Listesi: formattedList,
    CSV_Formatı: csvBlock,
  });

  try {
    const proxyRes = await fetch('/api/sync-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: payload,
    });

    const data = await proxyRes.json().catch(() => null);
    const check = isFormSubmitSuccess(data);
    if (check.ok) return { ok: true };
    if (data && data.message) return check;
  } catch {
    // Fallback to direct call below
  }

  try {
    const response = await fetch(SYNC_TARGET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: payload,
    });

    const data = await response.json().catch(() => null);
    return isFormSubmitSuccess(data);
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Ağ hatası oluştu.',
    };
  }
}

/**
 * Process all pending email notifications when online
 */
export async function processPendingSyncQueue(
  onUpdate?: (queue: SyncQueueItem[]) => void
): Promise<{ sentCount: number; failedCount: number; lastError?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { sentCount: 0, failedCount: 0 };
  }

  const queue = getSyncQueue();
  const pendingItems = queue.filter((item) => item.status === 'pending' || item.status === 'failed');

  if (pendingItems.length === 0) {
    return { sentCount: 0, failedCount: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;
  let lastError: string | undefined;

  const workingQueue: SyncQueueItem[] = queue.map((item) =>
    item.status === 'pending' || item.status === 'failed'
      ? { ...item, status: 'sending' as const }
      : item
  );
  saveSyncQueue(workingQueue);
  onUpdate?.(workingQueue);

  for (const item of pendingItems) {
    const result = await sendSyncItemEmail(item);
    const currentQueue = getSyncQueue();

    const nextQueue: SyncQueueItem[] = currentQueue.map((q) => {
      if (q.id !== item.id) return q;
      if (result.ok) {
        sentCount++;
        return {
          ...q,
          status: 'sent' as const,
          sentAt: new Date().toLocaleString('tr-TR'),
          errorMessage: undefined,
        };
      } else {
        failedCount++;
        lastError = result.message;
        return {
          ...q,
          status: 'failed' as const,
          errorMessage: result.message,
        };
      }
    });

    saveSyncQueue(nextQueue);
    onUpdate?.(nextQueue);
  }

  return { sentCount, failedCount, lastError };
}

/**
 * Submit new terms to the Server Pending Approval Queue (NOT active dictionary)
 */
export async function submitTermsToPendingServer(
  terms: DictionaryTerm[],
  batchId?: string
): Promise<DictionaryTerm[] | null> {
  if (!terms || terms.length === 0) return null;
  try {
    const res = await fetch('/api/pending-terms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ terms, batchId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.pending)) {
        return data.pending;
      }
    }
  } catch {
    // Save to offline pending buffer so it uploads when back online
    try {
      const existingRaw = localStorage.getItem(OFFLINE_PENDING_SUBMISSIONS_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const combined = [...existing, ...terms];
      localStorage.setItem(OFFLINE_PENDING_SUBMISSIONS_KEY, JSON.stringify(combined));
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Fetch both APPROVED custom terms and PENDING custom terms from the server
 */
export async function fetchServerDictionaryState(): Promise<{
  approvedTerms: DictionaryTerm[] | null;
  pendingTerms: DictionaryTerm[] | null;
}> {
  // First flush any offline pending submissions
  try {
    const offlineRaw = localStorage.getItem(OFFLINE_PENDING_SUBMISSIONS_KEY);
    if (offlineRaw) {
      const offlineList = JSON.parse(offlineRaw);
      if (Array.isArray(offlineList) && offlineList.length > 0) {
        const flushRes = await fetch('/api/pending-terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terms: offlineList }),
        });
        if (flushRes.ok) {
          localStorage.removeItem(OFFLINE_PENDING_SUBMISSIONS_KEY);
        }
      }
    }
  } catch {
    // ignore
  }

  let approvedTerms: DictionaryTerm[] | null = null;
  let pendingTerms: DictionaryTerm[] | null = null;

  try {
    const [sharedRes, pendingRes] = await Promise.all([
      fetch(`/api/shared-terms?t=${Date.now()}`, { cache: 'no-store' }),
      fetch(`/api/pending-terms?t=${Date.now()}`, { cache: 'no-store' }),
    ]);

    if (sharedRes.ok) {
      const sData = await sharedRes.json();
      if (Array.isArray(sData?.terms)) approvedTerms = sData.terms;
    }
    if (pendingRes.ok) {
      const pData = await pendingRes.json();
      if (Array.isArray(pData?.pending)) pendingTerms = pData.pending;
    }
  } catch {
    try {
      const staticRes = await fetch(`/shared-terms.json?t=${Date.now()}`, { cache: 'no-store' });
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        if (Array.isArray(staticData)) approvedTerms = staticData;
      }
    } catch {
      // ignore
    }
  }

  return { approvedTerms, pendingTerms };
}

/**
 * Admin Action: Approve pending terms (all, selected IDs, or edited term)
 */
export async function approvePendingTermsApi(params: {
  approveAll?: boolean;
  ids?: string[];
  batchId?: string;
  editedTerm?: DictionaryTerm;
}): Promise<{ approvedTerms: DictionaryTerm[]; pendingTerms: DictionaryTerm[]; approvedCount: number } | null> {
  try {
    const res = await fetch('/api/pending-terms/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        approvedTerms: Array.isArray(data.terms) ? data.terms : [],
        pendingTerms: Array.isArray(data.pending) ? data.pending : [],
        approvedCount: Number(data.approvedCount || 0),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Admin Action: Reject/Delete pending terms
 */
export async function rejectPendingTermsApi(params: {
  rejectAll?: boolean;
  ids?: string[];
  batchId?: string;
}): Promise<DictionaryTerm[] | null> {
  try {
    const res = await fetch('/api/pending-terms/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.pending) ? data.pending : [];
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Admin Action: Directly publish approved terms
 */
export async function syncApprovedTermsWithServer(
  approvedTerms: DictionaryTerm[],
  mode: 'merge' | 'replace' = 'merge'
): Promise<DictionaryTerm[] | null> {
  try {
    const res = await fetch('/api/shared-terms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ terms: approvedTerms, mode, adminApproved: true }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.terms)) {
        return data.terms;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function getFeedbackTypeLabel(type: FeedbackSubmission['feedbackType']): string {
  switch (type) {
    case 'bug':
      return 'Hata Bildirimi';
    case 'suggestion':
      return 'Öneri / Yeni Özellik İsteği';
    case 'term-correction':
      return 'Terim Düzeltme / Eksik Anlam Bildirimi';
    default:
      return 'Genel Görüş / Mesaj';
  }
}

/**
 * Send user bug report / suggestion / feedback email to esorgun@gmail.com
 * and save on server, with offline queue fallback.
 */
export async function sendUserFeedbackEmail(params: {
  feedbackType: FeedbackSubmission['feedbackType'];
  senderName?: string;
  senderContact?: string;
  relatedTerm?: string;
  message: string;
}): Promise<{ ok: boolean; queuedOffline?: boolean; message?: string }> {
  const entry: FeedbackSubmission = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    feedbackType: params.feedbackType,
    senderName: sanitizeText(params.senderName || '', 100) || undefined,
    senderContact: sanitizeText(params.senderContact || '', 150) || undefined,
    relatedTerm: sanitizeText(params.relatedTerm || '', 250) || undefined,
    message: sanitizeText(params.message, 3000),
    createdAt: new Date().toLocaleString('tr-TR'),
    deviceInfo:
      typeof navigator !== 'undefined'
        ? `${navigator.platform || 'Cihaz'} • ${
            typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : ''
          }`
        : undefined,
  };

  if (!entry.message) {
    return { ok: false, message: 'Lütfen mesajınızı yazın.' };
  }

  // If offline, queue in localStorage to send automatically when online
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      const raw = localStorage.getItem(OFFLINE_FEEDBACK_QUEUE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      localStorage.setItem(OFFLINE_FEEDBACK_QUEUE_KEY, JSON.stringify([entry, ...list].slice(0, 30)));
    } catch {
      // ignore
    }
    return {
      ok: true,
      queuedOffline: true,
      message:
        'Mesajınız kaydedildi. İnternet bağlantısı sağlandığında otomatik olarak e-posta ile iletilecektir.',
    };
  }

  const typeLabel = getFeedbackTypeLabel(entry.feedbackType);
  const shortPreview = entry.message.slice(0, 55).replace(/\s+/g, ' ');
  const subject = `[HATA / ÖNERİ] Denizcilik Sözlüğü - ${typeLabel}${
    entry.relatedTerm ? ` (${entry.relatedTerm})` : `: ${shortPreview}`
  }`;

  const emailPayload = JSON.stringify({
    _subject: subject,
    _template: 'table',
    _captcha: 'false',
    Bildirim_Türü: typeLabel,
    Gönderen_Kişi: entry.senderName || 'Belirtilmedi (Denizcilik Sözlüğü Kullanıcısı)',
    İletişim_Bilgisi: entry.senderContact || 'Belirtilmedi',
    İlgili_Terim: entry.relatedTerm || 'Genel Uygulama',
    Mesaj_ve_Açıklama: entry.message,
    Gönderim_Tarihi: entry.createdAt,
    Cihaz_Bilgisi: entry.deviceInfo || 'Web / Mobil PWA',
  });

  // 1. Store backup on server & trigger server relay
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    // ignore
  }

  // 2. Send email via /api/sync-email proxy
  try {
    const proxyRes = await fetch('/api/sync-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: emailPayload,
    });
    const data = await proxyRes.json().catch(() => null);
    const check = isFormSubmitSuccess(data);
    if (check.ok) {
      return { ok: true, message: 'Hata / öneri mesajınız başarıyla e-posta olarak iletildi!' };
    }
  } catch {
    // Fallback to direct FormSubmit below
  }

  // 3. Direct FormSubmit fallback
  try {
    const directRes = await fetch(SYNC_TARGET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: emailPayload,
    });
    const data = await directRes.json().catch(() => null);
    const check = isFormSubmitSuccess(data);
    if (check.ok) {
      return { ok: true, message: 'Hata / öneri mesajınız başarıyla e-posta olarak iletildi!' };
    }
    return {
      ok: true,
      message: 'Mesajınız kaydedildi ve yöneticiye iletildi.',
    };
  } catch {
    // Save to offline queue so it retries
    try {
      const raw = localStorage.getItem(OFFLINE_FEEDBACK_QUEUE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      localStorage.setItem(OFFLINE_FEEDBACK_QUEUE_KEY, JSON.stringify([entry, ...list].slice(0, 30)));
    } catch {
      // ignore
    }
    return {
      ok: true,
      queuedOffline: true,
      message: 'Mesajınız kaydedildi ve bağlantı kurulduğunda e-posta olarak iletilecek.',
    };
  }
}

/**
 * Flush any offline queued feedback messages when online
 */
export async function flushOfflineFeedbackQueue(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  try {
    const raw = localStorage.getItem(OFFLINE_FEEDBACK_QUEUE_KEY);
    if (!raw) return 0;
    const list: FeedbackSubmission[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return 0;

    localStorage.removeItem(OFFLINE_FEEDBACK_QUEUE_KEY);
    let sent = 0;
    for (const item of list) {
      const res = await sendUserFeedbackEmail({
        feedbackType: item.feedbackType,
        senderName: item.senderName,
        senderContact: item.senderContact,
        relatedTerm: item.relatedTerm,
        message: item.message,
      });
      if (res.ok) sent++;
    }
    return sent;
  } catch {
    return 0;
  }
}

