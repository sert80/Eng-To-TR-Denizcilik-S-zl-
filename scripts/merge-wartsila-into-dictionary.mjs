import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WARTSILA_TERMS_PART1 } from './wartsila-part1.mjs';
import { WARTSILA_TERMS_PART2 } from './wartsila-part2.mjs';
import { WARTSILA_TERMS_PART3 } from './wartsila-part3.mjs';
import { WARTSILA_TERMS_PART4 } from './wartsila-part4.mjs';
import { WARTSILA_TERMS_PART5 } from './wartsila-part5.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dictPath = path.join(rootDir, 'src/data/dictionary.json');

const rawDict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

const allWartsilaTerms = [
  ...WARTSILA_TERMS_PART1,
  ...WARTSILA_TERMS_PART2,
  ...WARTSILA_TERMS_PART3,
  ...WARTSILA_TERMS_PART4,
  ...WARTSILA_TERMS_PART5,
];

function combineMeanings(existingTr, incomingTr) {
  const c1 = (existingTr || '').trim();
  const c2 = (incomingTr || '').trim();
  if (!c1) return c2;
  if (!c2) return c1;

  const norm = (s) =>
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

const dictByEn = new Map();
for (const item of rawDict) {
  if (!item || !item.en) continue;
  const key = item.en.toLowerCase().trim();
  dictByEn.set(key, { ...item });
}

let addedNewCount = 0;
let enrichedExistingCount = 0;

for (const wItem of allWartsilaTerms) {
  const cleanEn = wItem.en.trim();
  const key = cleanEn.toLowerCase();
  const firstChar = cleanEn[0].replace(/İ/g, 'I').toUpperCase();
  const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';

  // Also check if a base version without parenthetical abbreviation exists
  const baseKey = cleanEn.replace(/\s*\([^)]+\)\s*$/, '').toLowerCase().trim();

  if (dictByEn.has(key)) {
    const existing = dictByEn.get(key);
    const mergedTr = combineMeanings(existing.tr, wItem.tr);
    if (mergedTr !== existing.tr) {
      existing.tr = mergedTr;
      enrichedExistingCount++;
    }
  } else if (baseKey && baseKey !== key && dictByEn.has(baseKey)) {
    const existing = dictByEn.get(baseKey);
    const mergedTr = combineMeanings(existing.tr, wItem.tr);
    if (mergedTr !== existing.tr) {
      existing.tr = mergedTr;
      enrichedExistingCount++;
    }
    // Also add the full acronym entry if it has a distinct abbreviation in parentheses
    dictByEn.set(key, {
      id: '',
      en: cleanEn,
      tr: wItem.tr.trim(),
      category: wItem.category || existing.category || 'Gemi Makineleri ve Sistemler',
      firstLetter,
    });
    addedNewCount++;
  } else {
    dictByEn.set(key, {
      id: '',
      en: cleanEn,
      tr: wItem.tr.trim(),
      category: wItem.category || 'Gemi Makineleri ve Sistemler',
      firstLetter,
    });
    addedNewCount++;
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
  `Merged Wärtsilä Encyclopedia terms into dictionary.json! Added ${addedNewCount} new terms, enriched ${enrichedExistingCount} existing terms. Total dictionary terms: ${mergedList.length}`
);
