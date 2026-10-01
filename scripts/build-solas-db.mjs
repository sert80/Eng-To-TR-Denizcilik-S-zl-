import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SOLAS_TERMS_PART1 } from './solas-part1.mjs';
import { SOLAS_TERMS_PART2 } from './solas-part2.mjs';
import { SOLAS_TERMS_PART3 } from './solas-part3.mjs';
import { SOLAS_TERMS_PART4 } from './solas-part4.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dictPath = path.join(rootDir, 'src/data/dictionary.json');
const rawDict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

// Map existing dictionary by lowercase English key
const dictMap = new Map();
for (const entry of rawDict) {
  if (entry && entry.en) {
    dictMap.set(entry.en.toLowerCase().trim(), entry);
  }
}

// Core curated SOLAS 2024 terms across Chapters I to XV
const curatedSolasTerms = [
  ...SOLAS_TERMS_PART1,
  ...SOLAS_TERMS_PART2,
  ...SOLAS_TERMS_PART3,
  ...SOLAS_TERMS_PART4,
];

// Additional exact SOLAS vocabulary keywords to match from the existing 12,666-term dictionary
// so that every single SOLAS-relevant term in the maritime corpus is also included & classified by chapter
const SOLAS_KEYWORD_CHAPTER_RULES = [
  {
    chapter: 'Chapter I - General Provisions',
    regulation: 'SOLAS Ch. I',
    keywords: [
      /\bsolas\b/i,
      /\bpassenger ship safety\b/i,
      /\bcargo ship safety\b/i,
      /\bsafety equipment certificate\b/i,
      /\bsafety construction certificate\b/i,
      /\bsafety radio certificate\b/i,
      /\bexemption certificate\b/i,
      /\bport state control\b/i,
      /\bflag state\b/i,
      /\bclassification society\b/i,
      /\bannual survey\b/i,
      /\bintermediate survey\b/i,
      /\brenewal survey\b/i,
      /\bseaworthiness\b/i,
    ],
  },
  {
    chapter: 'Chapter II-1 - Construction: Structure, Subdivision & Stability',
    regulation: 'SOLAS Ch. II-1',
    keywords: [
      /\bwatertight bulkhead\b/i,
      /\bwatertight door\b/i,
      /\bcollision bulkhead\b/i,
      /\bdouble bottom\b/i,
      /\bbilge pump\b/i,
      /\bsteering gear\b/i,
      /\bemergency generator\b/i,
      /\bemergency switchboard\b/i,
      /\binclining experiment\b/i,
      /\binclining test\b/i,
      /\bdamage stability\b/i,
      /\bintact stability\b/i,
      /\bmetacentric height\b/i,
      /\brighting lever\b/i,
      /\brighting arm\b/i,
      /\bsubdivision load line\b/i,
      /\bmargin line\b/i,
      /\bfloodable length\b/i,
      /\bpermeability\b/i,
      /\bdeadlight\b/i,
      /\bweathertight\b/i,
      /\bemergency towing\b/i,
      /\baccommodation ladder\b/i,
    ],
  },
  {
    chapter: 'Chapter II-2 - Fire Protection, Detection & Extinction',
    regulation: 'SOLAS Ch. II-2 / FSS Code',
    keywords: [
      /\bfire main\b/i,
      /\bfire pump\b/i,
      /\bfire hydrant\b/i,
      /\bfire hose\b/i,
      /\bfire door\b/i,
      /\bfire damper\b/i,
      /\bfire detector\b/i,
      /\bfire alarm\b/i,
      /\bfire extinguisher\b/i,
      /\bfire control plan\b/i,
      /\bfireman's outfit\b/i,
      /\bfire-fighter\b/i,
      /\bbreathing apparatus\b/i,
      /\binert gas\b/i,
      /\bsmoke detector\b/i,
      /\bsprinkler\b/i,
      /\binternational shore connection\b/i,
      /\bflash point\b/i,
      /\bflashpoint\b/i,
      /\bflame arrester\b/i,
      /\bflame screen\b/i,
      /\bco2 room\b/i,
      /\bfoam monitor\b/i,
    ],
  },
  {
    chapter: 'Chapter III - Life-Saving Appliances & Arrangements',
    regulation: 'SOLAS Ch. III / LSA Code',
    keywords: [
      /\blifeboat\b/i,
      /\bliferaft\b/i,
      /\blife raft\b/i,
      /\blifebuoy\b/i,
      /\blife buoy\b/i,
      /\blifejacket\b/i,
      /\blife jacket\b/i,
      /\brescue boat\b/i,
      /\bsurvival craft\b/i,
      /\bmuster list\b/i,
      /\bmuster station\b/i,
      /\babandon ship\b/i,
      /\bimmersion suit\b/i,
      /\bthermal protective aid\b/i,
      /\bhydrostatic release\b/i,
      /\bline-throwing\b/i,
      /\bline throwing\b/i,
      /\bparachute flare\b/i,
      /\bhand flare\b/i,
      /\bbuoyant smoke\b/i,
      /\bembarkation ladder\b/i,
      /\bdavit\b/i,
      /\bsea anchor\b/i,
      /\bboat drill\b/i,
    ],
  },
  {
    chapter: 'Chapter IV - Radiocommunications (GMDSS)',
    regulation: 'SOLAS Ch. IV',
    keywords: [
      /\bgmdss\b/i,
      /\bepirb\b/i,
      /\bnavtex\b/i,
      /\bsart\b/i,
      /\bdigital selective calling\b/i,
      /\bdistress signal\b/i,
      /\bdistress frequency\b/i,
      /\bdistress call\b/i,
      /\bmayday\b/i,
      /\bpan-pan\b/i,
      /\bsecurite\b/i,
      /\binmarsat\b/i,
      /\bradio log\b/i,
    ],
  },
  {
    chapter: 'Chapter V - Safety of Navigation',
    regulation: 'SOLAS Ch. V',
    keywords: [
      /\becdis\b/i,
      /\bvoyage data recorder\b/i,
      /\bgyro compass\b/i,
      /\bgyro-compass\b/i,
      /\bmagnetic compass\b/i,
      /\becho sounder\b/i,
      /\becho-sounder\b/i,
      /\bradar reflector\b/i,
      /\bautopilot\b/i,
      /\bpilot ladder\b/i,
      /\bnautical chart\b/i,
      /\bnotice to mariners\b/i,
      /\bnorth-up\b/i,
      /\bcourse recorder\b/i,
      /\brudder indicator\b/i,
      /\btraffic separation\b/i,
      /\bvessel traffic\b/i,
      /\baldis lamp\b/i,
      /\bdaylight signalling\b/i,
      /\binternational code of signals\b/i,
    ],
  },
  {
    chapter: 'Chapter VI - Carriage of Cargoes & Oil Fuels',
    regulation: 'SOLAS Ch. VI / IMSBC / Grain Code',
    keywords: [
      /\bcargo securing\b/i,
      /\bgrain stability\b/i,
      /\bshifting board\b/i,
      /\bangle of repose\b/i,
      /\btrimming\b/i,
      /\btimber deck cargo\b/i,
      /\bfumigation\b/i,
    ],
  },
  {
    chapter: 'Chapter VII - Carriage of Dangerous Goods',
    regulation: 'SOLAS Ch. VII / IMDG / IBC / IGC',
    keywords: [
      /\bimdg\b/i,
      /\bdangerous goods\b/i,
      /\bchemical tanker\b/i,
      /\bgas carrier\b/i,
      /\bliquefied gas\b/i,
    ],
  },
  {
    chapter: 'Chapter IX - Management for the Safe Operation of Ships (ISM)',
    regulation: 'SOLAS Ch. IX / ISM Code',
    keywords: [
      /\bism code\b/i,
      /\bsafety management\b/i,
      /\bdocument of compliance\b/i,
      /\bdesignated person\b/i,
      /\bnon-conformity\b/i,
    ],
  },
  {
    chapter: 'Chapter XI-2 - Special Measures to Enhance Maritime Security (ISPS)',
    regulation: 'SOLAS Ch. XI-2 / ISPS Code',
    keywords: [
      /\bisps\b/i,
      /\bship security\b/i,
      /\bport facility security\b/i,
      /\bdeclaration of security\b/i,
    ],
  },
  {
    chapter: 'Chapter XII - Additional Safety Measures for Bulk Carriers',
    regulation: 'SOLAS Ch. XII',
    keywords: [
      /\bbulk carrier\b/i,
      /\btopside tank\b/i,
      /\bhopper tank\b/i,
      /\bloading instrument\b/i,
    ],
  },
];

const combinedMap = new Map();

// 1. Add all curated SOLAS 2024 terms first
for (const item of curatedSolasTerms) {
  const key = item.en.toLowerCase().trim();
  const cleanEn = item.en.trim();
  const firstChar = cleanEn[0].replace(/İ/g, 'I').toUpperCase();
  const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';

  // Check if this term (or base term without parentheses) already exists in main dictionary
  const baseEn = cleanEn.replace(/\s*\([^)]*\)\s*/g, '').toLowerCase().trim();
  const existingExact = dictMap.get(key) || dictMap.get(baseEn);

  combinedMap.set(key, {
    id: '',
    en: cleanEn,
    tr: item.tr.trim(),
    chapter: item.chapter,
    regulation: item.regulation,
    category: item.category || 'Denizde Emniyet ve Kurtarma',
    firstLetter,
    edition: 'SOLAS Consolidated Edition 2024',
    existsInMainDictionary: Boolean(existingExact),
    existingDictionaryTr: existingExact ? existingExact.tr : undefined,
  });
}

// 2. Scan rawDict for additional SOLAS terms matching the chapter rules
for (const entry of rawDict) {
  if (!entry || !entry.en || !entry.tr) continue;
  const key = entry.en.toLowerCase().trim();
  if (combinedMap.has(key)) continue;

  // Format English term nicely (Title Case if all uppercase and > 4 chars, except acronyms)
  const textToCheck = `${entry.en} ${entry.tr}`;
  let matchedRule = null;

  for (const rule of SOLAS_KEYWORD_CHAPTER_RULES) {
    if (rule.keywords.some((rx) => rx.test(entry.en) || (/\bsolas\b/i.test(entry.tr) && rx.test(textToCheck)))) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule && /\bsolas\b/i.test(entry.tr)) {
    matchedRule = {
      chapter: 'Chapter I - General Provisions',
      regulation: 'SOLAS Convention',
    };
  }

  if (matchedRule) {
    const cleanEn = entry.en.trim();
    const firstChar = cleanEn[0].replace(/İ/g, 'I').toUpperCase();
    const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';

    combinedMap.set(key, {
      id: '',
      en: cleanEn,
      tr: entry.tr.trim(),
      chapter: matchedRule.chapter,
      regulation: matchedRule.regulation,
      category: entry.category || 'Denizde Emniyet ve Kurtarma',
      firstLetter,
      edition: 'SOLAS Consolidated Edition 2024',
      existsInMainDictionary: true,
      existingDictionaryTr: entry.tr.trim(),
    });
  }
}

// 3. Sort strictly in alphabetical order (A to Z) by English term
const sortedList = Array.from(combinedMap.values()).sort((a, b) =>
  a.en.localeCompare(b.en, 'en', { sensitivity: 'base', numeric: true })
);

// Assign sequential IDs after alphabetical sort
sortedList.forEach((item, index) => {
  item.id = `solas_2024_${index + 1}`;
});

const outSrcPath = path.join(rootDir, 'src/data/solas_database.json');
const outPublicPath = path.join(rootDir, 'public/solas-database.json');

fs.writeFileSync(outSrcPath, JSON.stringify(sortedList, null, 2), 'utf-8');
fs.writeFileSync(outPublicPath, JSON.stringify(sortedList, null, 2), 'utf-8');

console.log(`Generated SOLAS 2024 Database with ${sortedList.length} alphabetically sorted terms.`);
const newCount = sortedList.filter((t) => !t.existsInMainDictionary).length;
const existingCount = sortedList.filter((t) => t.existsInMainDictionary).length;
console.log(`New SOLAS 2024 terms: ${newCount}, Existing/Matched in Dictionary: ${existingCount}`);
