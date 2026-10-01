import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WARTSILA_COMPLETE_A_D } from './wartsila-complete-a-d.mjs';
import { WARTSILA_COMPLETE_E_L } from './wartsila-complete-e-l.mjs';
import { WARTSILA_COMPLETE_M_Z } from './wartsila-complete-m-z.mjs';
import { WARTSILA_COMPLETE_SUBTERMS } from './wartsila-complete-subterms.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dictPath = path.join(rootDir, 'src/data/dictionary.json');

const rawDict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

function combineMeanings(existingTr, incomingTr) {
  const c1 = (existingTr || '').trim();
  const c2 = (incomingTr || '').trim();
  if (!c1) return c2;
  if (!c2) return c1;

  const norm = (s) =>
    s
      .toLowerCase()
      .replace(/[.,;:!?()"'\[\]-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const n1 = norm(c1);
  const n2 = norm(c2);
  if (n1 === n2 || n1.includes(n2)) return c1;
  if (n2.includes(n1)) return c2;
  return `${c1} • ${c2}`;
}

const dictByEn = new Map();
for (const item of rawDict) {
  if (!item || !item.en) continue;
  const key = item.en.toLowerCase().trim();
  dictByEn.set(key, { ...item });
}

const allEntries = [
  ...WARTSILA_COMPLETE_A_D,
  ...WARTSILA_COMPLETE_E_L,
  ...WARTSILA_COMPLETE_M_Z,
  ...WARTSILA_COMPLETE_SUBTERMS,
];

let addedNewCount = 0;
let enrichedExistingCount = 0;

function upsertTerm(enStr, trStr, categoryStr) {
  const cleanEn = enStr.trim();
  if (!cleanEn) return;
  const key = cleanEn.toLowerCase();
  const firstChar = cleanEn[0].replace(/İ/g, 'I').toUpperCase();
  const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';

  if (dictByEn.has(key)) {
    const existing = dictByEn.get(key);
    const mergedTr = combineMeanings(existing.tr, trStr);
    if (mergedTr !== existing.tr) {
      existing.tr = mergedTr;
      enrichedExistingCount++;
    }
  } else {
    dictByEn.set(key, {
      id: '',
      en: cleanEn,
      tr: trStr.trim(),
      category: categoryStr || 'Gemi Makineleri ve Sistemler',
      firstLetter,
    });
    addedNewCount++;
  }
}

for (const item of allEntries) {
  upsertTerm(item.en, item.tr, item.category);

  // Also index individual synonyms if separated by " / " (e.g. "Cylinder Cover / Cylinder Head")
  if (item.en.includes(' / ')) {
    const parts = item.en.split(' / ').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.length >= 3) {
        upsertTerm(part, item.tr, item.category);
      }
    }
  }

  // Also index the base term without parenthetical acronym if applicable
  const baseWithoutParen = item.en.replace(/\s*\([^)]+\)\s*$/, '').trim();
  if (baseWithoutParen && baseWithoutParen !== item.en.trim() && baseWithoutParen.length >= 3) {
    upsertTerm(baseWithoutParen, item.tr, item.category);
  }
}

const mergedList = Array.from(dictByEn.values()).sort((a, b) =>
  a.en.localeCompare(b.en, 'en', { sensitivity: 'base', numeric: true })
);

mergedList.forEach((item, idx) => {
  item.id = `term_${idx + 1}`;
});

fs.writeFileSync(dictPath, JSON.stringify(mergedList, null, 2), 'utf-8');

console.log(
  `Wärtsilä Complete Audit Finished! Added ${addedNewCount} new terms/words, enriched ${enrichedExistingCount} existing entries. Total dictionary terms: ${mergedList.length}`
);
