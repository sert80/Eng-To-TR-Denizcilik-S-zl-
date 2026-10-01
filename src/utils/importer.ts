import * as XLSX from 'xlsx';
import { DictionaryTerm, MARITIME_CATEGORIES, MaritimeCategory } from '../types';

export interface ParsedTermRow {
  en: string;
  tr: string;
  category: string;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

const CATEGORIES_REGEX: [RegExp, string][] = [
  [/(pusula|kerteriz|rota|seyr|navig|enlem|boylam|astronomi|harita|fener|almanak|azimut|meridyen|gök|radar|iskandil|transit|loksodrom|mils|silyon|borda feneri|pupa feneri)/i, 'Seyir ve Navigasyon'],
  [/(sigorta|poliçe|kloz|avarya|navlun|kon[iı]şmento|charter|tazminat|hukuk|protesto|kredi|rüsum|acente|broker|manifesto|alacak|haciz|rehin)/i, 'Hukuk, Ticaret ve Sigorta'],
  [/(makine|kazan|buhar|stim|piston|şaft|pervane|valf|pompa|tulumba|seperat|filtre|egzoz|yağlama|dizel|türbin|motor)/i, 'Gemi Makineleri ve Sistemler'],
  [/(bumba|halat|palanga|ırgat|baba|matafora|dümen|demir|zincir|loça|küpeşte|posta|kemere|sac|omurga|kaplama|bodoslama|güverte|ambar|sintine|tank|farş|vardavele)/i, 'Gemi Yapısı ve Güverte Donanımı'],
  [/(fırtına|rüzgar|bora|sis|bulut|barometre|basınç|dalga|akıntı|med-cezir|kabarma|alçalma|gelgit|nem|sıcaklık|meteor|buzul|aysberg|siklon)/i, 'Meteoroloji ve Oşinografi'],
  [/(filika|can simidi|can yeleği|can salı|tahlisiye|kurtarma|yangın|solas|marpol|role|tehlike|mayday|panpan|piroteknik|söndür)/i, 'Denizde Emniyet ve Kurtarma'],
  [/(kumanya|iaşe|kamarot|aşçı|lostromo|kaptan|zabit|çarkçı|serdümen|tayfa|gemi adamı|vardiya|liman|rıhtım|dok|havuz|yanaşma|palamar)/i, 'Liman ve Gemi İşletmeciliği'],
];

export function autoDetectCategory(en: string, tr: string, fallback: string = 'Genel Denizcilik'): string {
  const text = `${en} ${tr}`;
  for (const [pattern, cat] of CATEGORIES_REGEX) {
    if (pattern.test(text)) {
      return cat;
    }
  }
  return fallback;
}

export function normalizeCategory(catStr: string | undefined, en: string, tr: string, defaultCat: string): string {
  if (!catStr || !catStr.trim()) {
    return autoDetectCategory(en, tr, defaultCat);
  }
  const clean = catStr.trim().toLowerCase();
  const matched = MARITIME_CATEGORIES.find(c => c.toLowerCase() === clean);
  if (matched) return matched;

  // partial match
  const partial = MARITIME_CATEGORIES.find(c => c.toLowerCase().includes(clean) || clean.includes(c.toLowerCase()));
  if (partial) return partial;

  return autoDetectCategory(en, tr, defaultCat);
}

// Parse Excel file buffer or array buffer
export async function parseExcelFile(
  file: File,
  existingTerms: DictionaryTerm[],
  defaultCategory: string
): Promise<ParsedTermRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel dosyasında sayfa bulunamadı.');
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  return processRawGrid(rawRows, existingTerms, defaultCategory);
}

// Parse text copied from Excel or CSV/TSV
export function parsePastedText(
  text: string,
  existingTerms: DictionaryTerm[],
  defaultCategory: string
): ParsedTermRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect delimiter: tab, semicolon, or comma
  const sample = lines[0];
  let delimiter = '\t';
  if (sample.includes('\t')) {
    delimiter = '\t';
  } else if (sample.includes(';')) {
    delimiter = ';';
  } else if (sample.includes(',')) {
    delimiter = ',';
  }

  const rawRows = lines.map(line => {
    if (delimiter === '\t') {
      return line.split('\t').map(c => c.trim());
    } else if (delimiter === ';') {
      return line.split(';').map(c => c.trim());
    } else {
      // simple comma split
      return line.split(',').map(c => c.trim());
    }
  });

  return processRawGrid(rawRows, existingTerms, defaultCategory);
}

function processRawGrid(
  rows: any[][],
  existingTerms: DictionaryTerm[],
  defaultCategory: string
): ParsedTermRow[] {
  if (rows.length === 0) return [];

  const existingEnSet = new Set(existingTerms.map(t => t.en.trim().toLowerCase()));

  // Check if first row is a header
  const firstRow = rows[0].map(c => String(c || '').trim().toLowerCase());
  let enColIdx = -1;
  let trColIdx = -1;
  let catColIdx = -1;
  let startRowIdx = 0;

  for (let i = 0; i < firstRow.length; i++) {
    const val = firstRow[i];
    if (['english', 'ingilizce', 'en', 'term', 'terim', 'kelime', 'word'].includes(val)) {
      enColIdx = i;
    } else if (['turkish', 'türkçe', 'turkce', 'tr', 'anlam', 'meaning', 'açıklama', 'aciklama', 'tanım'].includes(val)) {
      trColIdx = i;
    } else if (['category', 'kategori', 'konu', 'alan', 'bölüm'].includes(val)) {
      catColIdx = i;
    }
  }

  if (enColIdx !== -1 && trColIdx !== -1) {
    startRowIdx = 1;
  } else {
    // Default column order: Col 0 is EN, Col 1 is TR, Col 2 is Category
    enColIdx = 0;
    trColIdx = 1;
    catColIdx = 2;
    // Check if first row looks like header text
    if (
      firstRow[0]?.includes('english') ||
      firstRow[0]?.includes('terim') ||
      firstRow[1]?.includes('türkçe') ||
      firstRow[1]?.includes('anlam')
    ) {
      startRowIdx = 1;
    }
  }

  const result: ParsedTermRow[] = [];

  for (let i = startRowIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawEn = String(row[enColIdx] || '').trim();
    const rawTr = String(row[trColIdx] || '').trim();
    const rawCat = catColIdx < row.length ? String(row[catColIdx] || '').trim() : '';

    if (!rawEn && !rawTr) continue; // skip blank row

    if (!rawEn) {
      result.push({
        en: '',
        tr: rawTr,
        category: defaultCategory,
        isValid: false,
        error: 'İngilizce terim boş olamaz.',
      });
      continue;
    }

    if (!rawTr) {
      result.push({
        en: rawEn,
        tr: '',
        category: defaultCategory,
        isValid: false,
        error: 'Türkçe karşılık boş olamaz.',
      });
      continue;
    }

    const isDuplicate = existingEnSet.has(rawEn.toLowerCase());
    const category = normalizeCategory(rawCat, rawEn, rawTr, defaultCategory);

    result.push({
      en: rawEn,
      tr: rawTr,
      category,
      isValid: true,
      isDuplicate,
    });
  }

  return result;
}

// Download Sample Excel Template
export function downloadSampleExcelTemplate(): void {
  const sampleData = [
    {
      'İngilizce Terim': 'Bulkhead',
      'Türkçe Karşılık': 'Bölme, tekne içini su geçirmez kısımlara ayıran dikey perde sacları',
      'Kategori (İsteğe Bağlı)': 'Gemi Yapısı ve Güverte Donanımı',
    },
    {
      'İngilizce Terim': 'Starboard',
      'Türkçe Karşılık': 'Sancak tarafı (geminin pruvasına bakıldığında sağ tarafı)',
      'Kategori (İsteğe Bağlı)': 'Genel Denizcilik',
    },
    {
      'İngilizce Terim': 'Dead Reckoning',
      'Türkçe Karşılık': 'Parakete hesabı (önceki bilinen mevki, rota ve sürat bilgisiyle mevki tahmini)',
      'Kategori (İsteğe Bağlı)': 'Seyir ve Navigasyon',
    },
    {
      'İngilizce Terim': 'Charter Party',
      'Türkçe Karşılık': 'Çarter sözleşmesi, gemi kira kontratı',
      'Kategori (İsteğe Bağlı)': 'Hukuk, Ticaret ve Sigorta',
    },
    {
      'İngilizce Terim': 'Bilge Keel',
      'Türkçe Karşılık': 'Yalpa omurgası, geminin yalpalamasını azaltmak için bordaya yerleştirilen kanat',
      'Kategori (İsteğe Bağlı)': 'Gemi Yapısı ve Güverte Donanımı',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  // Auto column width
  ws['!cols'] = [{ wch: 25 }, { wch: 60 }, { wch: 35 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Terimler');
  XLSX.writeFile(wb, 'denizcilik_ornek_sozluk_sablonu.xlsx');
}

// Export custom terms to Excel (.xlsx)
export function exportTermsToExcel(terms: DictionaryTerm[], filename = 'denizcilik_eklenen_terimler.xlsx'): void {
  const exportData = terms.map(t => ({
    'İngilizce Terim': t.en,
    'Türkçe Karşılık': t.tr,
    'Kategori': t.category,
    'Eklenme Tarihi': t.createdAt || new Date().toLocaleDateString('tr-TR'),
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = [{ wch: 25 }, { wch: 60 }, { wch: 30 }, { wch: 15 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Terimler');
  XLSX.writeFile(wb, filename);
}
