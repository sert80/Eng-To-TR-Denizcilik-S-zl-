import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INTERNATIONAL_MARITIME_PART1 } from './international-maritime-part1.mjs';
import { INTERNATIONAL_MARITIME_PART2 } from './international-maritime-part2.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dictPath = path.join(rootDir, 'src/data/dictionary.json');

const rawDict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

// Multi-discipline disambiguations for key polysemous maritime terms
const MULTI_DISCIPLINE_ENRICHMENTS = [
  {
    en: "PITCH",
    tr: "1) [Seyir / Gemi Hareketi] Baş-Kıç Vurma: Geminin dalgalı denizde enine ekseni etrafında baş ve kıçının sırayla suya dalıp çıkması hareketi (pitching). 2) [Gemi Makineleri / Pervane] Pervane Hatvesi (Adımı): Pervanenin kayma olmaksızın bir tam dönüşte eksenel olarak ilerleyeceği teorik mesafe. 3) [Gemi Yapısı] Kalafat Zifti: Ahşap güverte armalarını kalafatlamakta kullanılan zift.",
    category: "Gemi Yapısı ve Güverte Donanımı"
  },
  {
    en: "TRIM",
    tr: "1) [Gemi İnşa / Stabilite] Trim: Geminin kıç su çekimi (da) ile baş su çekimi (df) arasındaki fark (Trim = da - df; kıç su çekimi büyükse kıça trimli -by the stern-, baş su çekimi büyükse başa trimli -by the head-). 2) [Yük Operasyonu] Yük Hafiyesi / Trimleme: Ambara dökülen kömür veya tahıl gibi dökme yüklerin boşluk kalmayacak ve kaymayacak şekilde ambar köşelerine yayılıp tesviye edilmesi.",
    category: "Gemi Yapısı ve Güverte Donanımı"
  },
  {
    en: "SLIP",
    tr: "1) [Gemi Makineleri] Pervane Kayması (Slip): Pervane hatvesine göre geminin teorik ilerleme mesafesi ile gerçekte ilerlediği mesafe arasındaki farkın teorik mesafeye yüzdesi (görünen kayma -apparent slip- ve gerçek kayma -real slip-). 2) [Tersane] Çekek Yeri / Kızak (Slipway): Gemilerin inşa veya onarım için karaya çekildiği eğimli kızak. 3) [Güverte] Boşaltma / Mona Kancası (Senhouse Slip): Demir zincirini veya filika bosasını acil durumda tek darbeyle fora etmeye yarayan kanca.",
    category: "Gemi Makineleri ve Sistemler"
  },
  {
    en: "BEARING",
    tr: "1) [Seyir ve Navigasyon] Kerteriz: Gözlemciden bir cisme, fenere veya gök cismine giden doğrultunun kuzey referansıyla (hakiki, manyetik veya pusula) ya da gemi pruvasıyla (nispi kerteriz) yaptığı yatay açı. 2) [Gemi Makineleri] Yatak (Rulman / Kaymalı Yatak): Krank mili, eksantrik mili veya pervane şaftı gibi dönen milleri destekleyen ve sürtünmeyi azaltan makine elemanı (main bearing, crosshead bearing, sterntube bearing).",
    category: "Seyir ve Navigasyon"
  },
  {
    en: "DRAFT",
    tr: "1) [Gemi İnşa / Seyir] Su Çekimi (Draft / Draught): Su yüzeyinden gemi omurgasının en alt noktasına kadar olan dikey mesafe. 2) [Gemi Makineleri] Kazan Çekişi: Kazan ocağı ve bacasında yanma havası ile duman gazlarının akışını sağlayan basınç farkı (doğal veya cebri çekiş). 3) [Deniz Ticareti] Poliçe: Deniz ticaretinde ödeme emri/poliçe.",
    category: "Gemi Yapısı ve Güverte Donanımı"
  },
  {
    en: "CLEARANCE",
    tr: "1) [Gemi Makineleri] Klerens / Boşluk: Piston-gömlek, yatak-muylu veya valf-külbütör arasındaki çalışma ve yağlama boşluğu; ayrıca piston üst ölü noktadayken kalan yanma odası hacmi (clearance volume). 2) [Liman İşletmeciliği] Gümrük / Liman Çıkış İzni (Port Clearance): Geminin tüm liman, sağlık ve gümrük işlemlerini tamamlayıp sefer izni alması. 3) [Seyir] Omurga Altı veya Köprü Altı Emniyet Mesafesi (UKC / Air Draft Clearance).",
    category: "Gemi Makineleri ve Sistemler"
  },
  {
    en: "HEEL",
    tr: "1) [Stabilite / Seyir] Meyil (Heel): Rüzgar, dalga veya dönüş sırasında merkezkaç kuvveti gibi bir dış kuvvet etkisiyle geminin sancak veya iskeleye geçici olarak yatması (geminin kendi iç ağırlık dengesizliğinden kaynaklanan kalıcı yatmaya ise 'List' denir). 2) [Gemi Yapısı] Topuk: Direk, bumba veya kıç bodoslamanın en alt ucu (heel of mast / sternpost).",
    category: "Gemi Yapısı ve Güverte Donanımı"
  },
  {
    en: "LIST",
    tr: "1) [Stabilite] Kalıcı Yatma Açısı (List): Yükün kayması, asimetrik yakıt/balast dağılımı veya su alma gibi gemi içi ağırlık merkezinin merkez hattından (centerline) sancak ya da iskeleye kaçması sonucu oluşan kalıcı yatma durumu. 2) [Gemi Dokümantasyonu] Liste / Cetvel (Crew List, Store List, Hatch List).",
    category: "Gemi Yapısı ve Güverte Donanımı"
  }
];

function cleanText(str) {
  if (!str) return '';
  return str
    // Remove any accidental author attribution if present
    .replace(/Refik Akdoğan['’]?ın\s*/gi, '')
    .replace(/Jan Babicz['’]?in\s*/gi, '')
    // Normalize multiple bullets or spaces
    .replace(/\s*•\s*•\s*/g, ' • ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function combineMeanings(existingTr, incomingTr) {
  const c1 = cleanText(existingTr);
  const c2 = cleanText(incomingTr);
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
let cleanedCount = 0;

for (const item of rawDict) {
  if (!item || !item.en) continue;
  const cleanEn = item.en.replace(/\s{2,}/g, ' ').trim();
  const cleanedTr = cleanText(item.tr);
  if (cleanedTr !== item.tr) cleanedCount++;

  const key = cleanEn.toLowerCase();
  if (dictByEn.has(key)) {
    const prev = dictByEn.get(key);
    prev.tr = combineMeanings(prev.tr, cleanedTr);
  } else {
    dictByEn.set(key, {
      ...item,
      en: cleanEn,
      tr: cleanedTr,
    });
  }
}

const allNewInternational = [
  ...INTERNATIONAL_MARITIME_PART1,
  ...INTERNATIONAL_MARITIME_PART2,
  ...MULTI_DISCIPLINE_ENRICHMENTS,
];

let addedNewCount = 0;
let enrichedExistingCount = 0;

for (const newItem of allNewInternational) {
  const cleanEn = newItem.en.trim();
  const key = cleanEn.toLowerCase();
  const firstChar = cleanEn[0].replace(/İ/g, 'I').toUpperCase();
  const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';

  const baseKey = cleanEn.replace(/\s*\([^)]+\)\s*$/, '').toLowerCase().trim();

  if (dictByEn.has(key)) {
    const existing = dictByEn.get(key);
    const mergedTr = combineMeanings(existing.tr, newItem.tr);
    if (mergedTr !== existing.tr) {
      existing.tr = mergedTr;
      enrichedExistingCount++;
    }
  } else if (baseKey && baseKey !== key && dictByEn.has(baseKey)) {
    const existing = dictByEn.get(baseKey);
    const mergedTr = combineMeanings(existing.tr, newItem.tr);
    if (mergedTr !== existing.tr) {
      existing.tr = mergedTr;
      enrichedExistingCount++;
    }
    dictByEn.set(key, {
      id: '',
      en: cleanEn,
      tr: cleanText(newItem.tr),
      category: newItem.category || existing.category || 'Seyir ve Navigasyon',
      firstLetter,
    });
    addedNewCount++;
  } else {
    dictByEn.set(key, {
      id: '',
      en: cleanEn,
      tr: cleanText(newItem.tr),
      category: newItem.category || 'Seyir ve Navigasyon',
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
  `Step 1 & 2 Complete! Added ${addedNewCount} new international terms/abbreviations, enriched ${enrichedExistingCount} existing terms, cleaned ${cleanedCount} entries. Total dictionary terms: ${mergedList.length}`
);
