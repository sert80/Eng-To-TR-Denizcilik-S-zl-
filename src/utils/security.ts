import { DictionaryTerm } from '../types';

/**
 * Remove unwanted author/source attribution names (e.g., Refik Akdoğan) from any displayed or stored text.
 */
export function stripAuthorAttribution(text: string): string {
  if (!text) return '';
  return text
    .replace(/\(\s*(?:kaptan\s+|kpt\.?\s*)?ref[iı]k\s+akdo[gğ]an\s*\)/gi, '')
    .replace(/(?:kaptan\s+|kpt\.?\s*)?ref[iı]k\s+akdo[gğ]an/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Sanitize user-provided text against XSS, HTML/script injection, and oversized payloads.
 */
export function sanitizeText(input: unknown, maxLength = 500): string {
  if (input === null || input === undefined) return '';
  let str = String(input)
    .replace(/\0/g, '')
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|applet|meta|link|style|form|svg|math)[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/\bon[a-z]+\s*=/gi, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '');

  str = stripAuthorAttribution(str);

  if (str.length > maxLength) {
    str = str.slice(0, maxLength).trim();
  }
  return str;
}

/**
 * Prevent CSV / Excel Formula Injection (CSV DDE Injection) and delimiter breaking.
 */
export function sanitizeCsvCell(input: unknown): string {
  const clean = sanitizeText(input, 1000)
    .replace(/;/g, ',')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  if (/^[=+\-@%\t\r]/.test(clean)) {
    return `'${clean}`;
  }
  return clean;
}

/**
 * Validate and sanitize a dictionary term object.
 */
export function sanitizeTermInput(raw: Partial<DictionaryTerm> & { note?: string }): {
  en: string;
  tr: string;
  category: string;
  firstLetter: string;
  note?: string;
  contributorName?: string;
  sourceFileName?: string;
} | null {
  const en = sanitizeText(raw.en, 250);
  const tr = sanitizeText(raw.tr, 2000);
  if (!en || !tr) return null;

  const category = sanitizeText(raw.category || 'Genel Denizcilik', 100) || 'Genel Denizcilik';
  const rawFirst = sanitizeText(raw.firstLetter || en[0] || 'A', 5)
    .replace(/İ/g, 'I')
    .toUpperCase();
  const firstLetter = /^[A-Z]$/.test(rawFirst[0] || '') ? rawFirst[0] : '#';

  const note = raw.note ? sanitizeText(raw.note, 1000) : undefined;
  const contributorName = raw.contributorName ? sanitizeText(raw.contributorName, 100) : undefined;
  const sourceFileName = raw.sourceFileName ? sanitizeText(raw.sourceFileName, 150) : undefined;

  return {
    en,
    tr,
    category,
    firstLetter,
    note: note || undefined,
    contributorName: contributorName || undefined,
    sourceFileName: sourceFileName || undefined,
  };
}

/**
 * Normalize Turkish & English strings for accurate mobile/desktop search.
 * Fixes iOS/Android Turkish auto-capitalization ('İ' -> 'i\u0307') and Turkish diacritics.
 */
export function normalizeSearchText(text: string): string {
  return String(text || '')
    .replace(/[.,!?;:"'()[\]{}]+$/g, '')
    .replace(/^[.,!?;:"'()[\]{}]+/g, '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .trim();
}

/**
 * Detect whether a dictionary entry is a maritime abbreviation / acronym.
 */
export function isMaritimeAbbreviation(term: DictionaryTerm): boolean {
  const en = (term.en || '').trim();
  const tr = (term.tr || '').trim();

  // 1) Starts with an uppercase acronym followed by expansion in parentheses: e.g. "UKC (Under Keel Clearance)"
  if (/^[A-Z0-9&/.-]{2,10}\s*\([^)]+\)/.test(en)) return true;

  // 2) Ends with an uppercase acronym in parentheses: e.g. "Bow Loading System (BLS)"
  if (/\([A-Z0-9&/.-]{2,8}\)$/.test(en)) return true;

  // 3) Short dotted abbreviation: e.g. "A.B.", "A & C.P.", "B.H.P.", "C.I.F."
  if (/^[A-Z0-9&]{1,4}(\.[A-Z0-9&]{1,4})+\.?$/.test(en) || en.includes('& C.P.')) return true;

  // 4) Explicitly marked as abbreviation in Turkish explanation
  if (/kısaltması|kısa yazılışı/i.test(tr)) return true;

  return false;
}

/**
 * Extract international maritime convention / standard references from a definition.
 */
export function extractMaritimeSources(tr: string): string[] {
  if (!tr) return [];
  const sources: string[] = [];
  if (/\bSOLAS\b|\[Chapter\s+[I|V|X]/i.test(tr)) sources.push('SOLAS');
  if (/\bCOLREG\b/i.test(tr)) sources.push('COLREG 72');
  if (/\bMARPOL\b/i.test(tr)) sources.push('MARPOL');
  if (/\bIMO SMCP\b|\bSMCP\b/i.test(tr)) sources.push('IMO SMCP');
  if (/\bBIMCO\b|\bChartering\b/i.test(tr)) sources.push('BIMCO');
  if (/\bISM Code\b|\bISM Kodu\b/i.test(tr)) sources.push('ISM');
  if (/\bISPS Code\b|\bISPS Kodu\b/i.test(tr)) sources.push('ISPS');
  if (/\bSTCW\b/i.test(tr)) sources.push('STCW');
  if (/\bMLC 2006\b/i.test(tr)) sources.push('MLC 2006');
  if (/\bIGC Kodu\b|\bIBC Kodu\b|\bIMDG\b|\bIMSBC\b/i.test(tr)) sources.push('IMO Kodları');
  if (/\bIALA\b/i.test(tr)) sources.push('IALA');
  return sources;
}


