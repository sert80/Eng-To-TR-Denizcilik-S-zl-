import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dictPath = path.join(rootDir, 'src/data/dictionary.json');
const solasSrcPath = path.join(rootDir, 'src/data/solas_database.json');
const solasPubPath = path.join(rootDir, 'public/solas-database.json');

const rawDict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
const solasTerms = JSON.parse(fs.readFileSync(solasSrcPath, 'utf-8'));

function combineMeanings(existingTr, solasTr, chapter, regulation) {
  const c1 = (existingTr || '').trim();
  const c2 = (solasTr || '').trim();
  const regTag = regulation ? ` [${chapter} • ${regulation}]` : ` [${chapter}]`;
  const c2WithRef = c2.includes(regulation) || c2.includes('SOLAS') ? c2 : `${c2}${regTag}`;

  if (!c1) return c2WithRef;
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
  if (n2.includes(n1)) return c2WithRef;
  return `${c1} • ${c2WithRef}`;
}

// Map existing dictionary entries by lowercase trimmed English name
const dictByEn = new Map();
for (const item of rawDict) {
  if (!item || !item.en) continue;
  const key = item.en.toLowerCase().trim();
  dictByEn.set(key, { ...item });
}

let addedNewCount = 0;
let enrichedExistingCount = 0;

for (const solasItem of solasTerms) {
  const key = solasItem.en.toLowerCase().trim();
  const cleanEn = solasItem.en.trim();
  const firstChar = cleanEn[0].replace(/İ/g, 'I').toUpperCase();
  const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';

  if (dictByEn.has(key)) {
    const existing = dictByEn.get(key);
    const mergedTr = combineMeanings(
      existing.tr,
      solasItem.tr,
      solasItem.chapter,
      solasItem.regulation
    );
    if (mergedTr !== existing.tr) {
      existing.tr = mergedTr;
      enrichedExistingCount++;
    }
    solasItem.existsInMainDictionary = true;
    solasItem.existingDictionaryTr = existing.tr;
  } else {
    const regSuffix =
      solasItem.regulation && !solasItem.tr.includes(solasItem.regulation)
        ? ` [${solasItem.chapter} • ${solasItem.regulation}]`
        : '';
    const fullTr = `${solasItem.tr.trim()}${regSuffix}`;

    dictByEn.set(key, {
      id: '',
      en: cleanEn,
      tr: fullTr,
      category: solasItem.category || 'Denizde Emniyet ve Kurtarma',
      firstLetter,
    });
    addedNewCount++;
    solasItem.existsInMainDictionary = true;
    solasItem.existingDictionaryTr = fullTr;
  }
}

// Sort entire dictionary alphabetically A-Z
const mergedList = Array.from(dictByEn.values()).sort((a, b) =>
  a.en.localeCompare(b.en, 'en', { sensitivity: 'base', numeric: true })
);

mergedList.forEach((item, idx) => {
  item.id = `term_${idx + 1}`;
});

fs.writeFileSync(dictPath, JSON.stringify(mergedList, null, 2), 'utf-8');
fs.writeFileSync(solasSrcPath, JSON.stringify(solasTerms, null, 2), 'utf-8');
fs.writeFileSync(solasPubPath, JSON.stringify(solasTerms, null, 2), 'utf-8');

console.log(
  `Merged SOLAS 2024 database into dictionary.json! Added ${addedNewCount} new terms, enriched ${enrichedExistingCount} existing terms. Total dictionary terms: ${mergedList.length}`
);
