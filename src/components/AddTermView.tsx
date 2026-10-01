import React, { useState, useRef, useMemo } from 'react';
import {
  PlusCircle,
  FileSpreadsheet,
  ClipboardPaste,
  ListOrdered,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Save,
  X,
  Search,
  Sparkles,
  BookOpen,
  RefreshCw,
  Wifi,
  WifiOff,
  Smartphone,
} from 'lucide-react';
import { DictionaryTerm, MARITIME_CATEGORIES } from '../types';
import {
  parseExcelFile,
  parsePastedText,
  downloadSampleExcelTemplate,
  exportTermsToExcel,
  autoDetectCategory,
  ParsedTermRow,
} from '../utils/importer';
import {
  SyncQueueItem,
} from '../utils/emailSync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { normalizeSearchText, sanitizeText } from '../utils/security';

interface AddTermViewProps {
  existingTerms: DictionaryTerm[];
  customTerms: DictionaryTerm[];
  myLocalTerms: DictionaryTerm[];
  approvedCustomTerms: DictionaryTerm[];
  onAddSingleTerm: (newTerm: Omit<DictionaryTerm, 'id'> & { note?: string; contributorName?: string }) => DictionaryTerm;
  onAddBulkTerms: (
    newTerms: Array<Omit<DictionaryTerm, 'id'>>,
    overwriteDuplicates?: boolean,
    sourceFileName?: string,
    contributorName?: string
  ) => number;
  onDeleteCustomTerm: (id: string) => void;
  onEditCustomTerm: (updated: DictionaryTerm) => void;
  onClearAllCustomTerms: () => void;
  onSelectTermForDetail: (term: DictionaryTerm) => void;
  onBackToDictionary: () => void;
  syncQueue: SyncQueueItem[];
  onTriggerSync: () => void;
  initialMode?: AddMode;
}

export type AddMode = 'manual' | 'excel-file' | 'paste-text' | 'my-terms';

export const AddTermView: React.FC<AddTermViewProps> = ({
  existingTerms,
  customTerms,
  myLocalTerms,
  approvedCustomTerms,
  onAddSingleTerm,
  onAddBulkTerms,
  onDeleteCustomTerm,
  onEditCustomTerm,
  onClearAllCustomTerms,
  onSelectTermForDetail,
  onBackToDictionary,
  syncQueue,
  onTriggerSync,
  initialMode = 'manual',
}) => {
  const [activeMode, setActiveMode] = useState<AddMode>(initialMode);
  const [myTermsSubFilter, setMyTermsSubFilter] = useState<'all' | 'local-only'>('all');
  const isOnline = useOnlineStatus();

  React.useEffect(() => {
    if (initialMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);

  // Optional contributor name (persisted locally for convenience)
  const [contributorName, setContributorName] = useState<string>(() => {
    try {
      return localStorage.getItem('maritime_contributor_name') || '';
    } catch {
      return '';
    }
  });

  const handleContributorChange = (val: string) => {
    setContributorName(val);
    try {
      localStorage.setItem('maritime_contributor_name', val);
    } catch {
      // ignore
    }
  };

  // Sync queue stats
  const pendingCount = useMemo(
    () => syncQueue.filter((item) => item.status === 'pending' || item.status === 'failed' || item.status === 'sending').length,
    [syncQueue]
  );
  const sentCount = useMemo(
    () => syncQueue.filter((item) => item.status === 'sent').length,
    [syncQueue]
  );

  // Single word form state
  const [manualEn, setManualEn] = useState('');
  const [manualTr, setManualTr] = useState('');
  const [manualCat, setManualCat] = useState<string>('Genel Denizcilik');
  const [manualNote, setManualNote] = useState('');
  const [singleSuccess, setSingleSuccess] = useState<DictionaryTerm | null>(null);

  // File upload state
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTermRow[]>([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [defaultCategory, setDefaultCategory] = useState<string>('Genel Denizcilik');
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste text state
  const [pastedText, setPastedText] = useState('');

  // My terms search & edit state
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [editingTerm, setEditingTerm] = useState<DictionaryTerm | null>(null);
  const [editEn, setEditEn] = useState('');
  const [editTr, setEditTr] = useState('');
  const [editCat, setEditCat] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Check duplicate for manual entry
  const duplicateCheck = useMemo(() => {
    const cleanEn = manualEn.trim().toLowerCase();
    if (!cleanEn) return null;
    return existingTerms.find(t => t.en.trim().toLowerCase() === cleanEn);
  }, [manualEn, existingTerms]);

  // Handle auto-categorize in manual mode
  const handleAutoCategorize = () => {
    if (!manualEn && !manualTr) return;
    const detected = autoDetectCategory(manualEn, manualTr, 'Genel Denizcilik');
    setManualCat(detected);
  };

  // Submit single term
  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEn = sanitizeText(manualEn, 250);
    const cleanTr = sanitizeText(manualTr, 2000);
    if (!cleanEn || !cleanTr) return;

    const added = onAddSingleTerm({
      en: cleanEn,
      tr: cleanTr,
      category: sanitizeText(manualCat, 100) || 'Genel Denizcilik',
      firstLetter: cleanEn[0].replace(/İ/g, 'I').toUpperCase(),
      note: sanitizeText(manualNote, 1000) || undefined,
      contributorName: sanitizeText(contributorName, 100) || undefined,
    });

    setSingleSuccess(added);
    setManualEn('');
    setManualTr('');
    setManualNote('');
  };

  // Handle Excel File Upload
  const handleFileUpload = async (file: File) => {
    try {
      setFileLoading(true);
      setUploadedFileName(file.name);
      setImportFeedback(null);

      const rows = await parseExcelFile(file, existingTerms, defaultCategory);
      setParsedRows(rows);
      // Select all valid rows by default
      const validIndices = new Set<number>();
      rows.forEach((r, idx) => {
        if (r.isValid) validIndices.add(idx);
      });
      setSelectedRowIndices(validIndices);
    } catch (err: any) {
      alert(`Dosya işlenirken hata oluştu: ${err?.message || 'Bilinmeyen hata'}`);
      setParsedRows([]);
    } finally {
      setFileLoading(false);
    }
  };

  // Handle file input change
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = '';
  };

  // Handle drag and drop
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Parse pasted text
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    const rows = parsePastedText(pastedText, existingTerms, defaultCategory);
    setParsedRows(rows);
    setUploadedFileName('Yapıştırılan Metin');
    const validIndices = new Set<number>();
    rows.forEach((r, idx) => {
      if (r.isValid) validIndices.add(idx);
    });
    setSelectedRowIndices(validIndices);
  };

  // Confirm bulk import
  const handleConfirmImport = () => {
    const termsToImport: Array<Omit<DictionaryTerm, 'id'>> = [];

    parsedRows.forEach((row, idx) => {
      if (selectedRowIndices.has(idx) && row.isValid) {
        termsToImport.push({
          en: row.en,
          tr: row.tr,
          category: row.category,
          firstLetter: row.en[0].toUpperCase(),
          isCustom: true,
          createdAt: new Date().toLocaleDateString('tr-TR'),
        });
      }
    });

    if (termsToImport.length === 0) {
      alert('İçe aktarılacak geçerli terim seçilmedi.');
      return;
    }

    const count = onAddBulkTerms(
      termsToImport,
      overwriteExisting,
      uploadedFileName || 'Toplu Sözlük / Excel Yüklemesi',
      contributorName.trim() || undefined
    );
    setImportFeedback(
      `${count} adet terim kendi uygulamanıza eklendi! Şu an çevrimdışı ve çevrimiçi olarak telefonunuzda/cihazınızda hemen kullanabilirsiniz.`
    );
    setParsedRows([]);
    setSelectedRowIndices(new Set());
    setUploadedFileName(null);
    setPastedText('');
  };

  // Toggle row selection in preview
  const toggleRowSelect = (idx: number) => {
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Select all or deselect all
  const toggleSelectAll = () => {
    if (selectedRowIndices.size === parsedRows.filter(r => r.isValid).length) {
      setSelectedRowIndices(new Set());
    } else {
      const allValid = new Set<number>();
      parsedRows.forEach((r, i) => {
        if (r.isValid) allValid.add(i);
      });
      setSelectedRowIndices(allValid);
    }
  };

  const approvedEnSet = useMemo(
    () => new Set(approvedCustomTerms.map((t) => t.en.toLowerCase().trim())),
    [approvedCustomTerms]
  );

  const localEnSet = useMemo(
    () => new Set(myLocalTerms.map((t) => t.en.toLowerCase().trim())),
    [myLocalTerms]
  );

  // Filter custom terms (either all active custom terms on device, or only local/pending ones added on this device)
  const filteredCustomTerms = useMemo(() => {
    const sourceList = myTermsSubFilter === 'local-only' ? myLocalTerms : customTerms;
    const rawQ = customSearchQuery.trim();
    if (!rawQ) return sourceList;
    const normQ = normalizeSearchText(rawQ);
    const q = rawQ.toLowerCase();
    return sourceList.filter(
      (t) =>
        normalizeSearchText(t.en).includes(normQ) ||
        normalizeSearchText(t.tr).includes(normQ) ||
        normalizeSearchText(t.category).includes(normQ) ||
        t.en.toLowerCase().includes(q) ||
        t.tr.toLowerCase().includes(q)
    );
  }, [customTerms, myLocalTerms, myTermsSubFilter, customSearchQuery]);

  // Edit custom term
  const startEditing = (term: DictionaryTerm) => {
    setEditingTerm(term);
    setEditEn(term.en);
    setEditTr(term.tr);
    setEditCat(term.category);
  };

  const handleSaveEdit = () => {
    if (!editingTerm || !editEn.trim() || !editTr.trim()) return;
    onEditCustomTerm({
      ...editingTerm,
      en: editEn.trim(),
      tr: editTr.trim(),
      category: editCat,
      firstLetter: editEn.trim()[0].toUpperCase(),
    });
    setEditingTerm(null);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Banner & Mode Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 flex items-center justify-center text-white shadow-xs">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>Sözlüğe Terim ve Excel Ekle</span>
                {customTerms.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-semibold">
                    {customTerms.length} Özel Terim Aktif
                  </span>
                )}
                {myLocalTerms.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                    {myLocalTerms.length} Bu Cihazda Eklenen
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Eklediğiniz kelime ve dosyalar çevrimdışı/çevrimiçi olarak <strong>kendi cihazınızda anında çalışır</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={onBackToDictionary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Sözlüğe Dön</span>
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <button
            id="mode-manual-btn"
            onClick={() => {
              setActiveMode('manual');
              setSingleSuccess(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeMode === 'manual'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Elle Tek Tek Ekle</span>
          </button>

          <button
            id="mode-excel-btn"
            onClick={() => setActiveMode('excel-file')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeMode === 'excel-file'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel / CSV Dosyası Yükle</span>
          </button>

          <button
            id="mode-paste-btn"
            onClick={() => setActiveMode('paste-text')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeMode === 'paste-text'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Metin Yapıştır</span>
          </button>

          <button
            id="mode-my-terms-btn"
            onClick={() => setActiveMode('my-terms')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition cursor-pointer ${
              activeMode === 'my-terms'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Eklediğim & Özel Terimler ({customTerms.length})</span>
          </button>
        </div>

        {/* Automatic Sync Info & Offline Queue Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isOnline
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                <span>Kişisel Cihaz & Merkezi Sözlük Eşitleme</span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    isOnline
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  <span>{isOnline ? 'Çevrimiçi Aktif' : 'Çevrimdışı Cihazda Aktif'}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Yüklediğiniz kelime ve dosyalar <strong>kendi telefonunuzda/uygulamanızda anında (çevrimdışı dahil) çalışır</strong>; onaylandığında tüm kullanıcılara açılır.
              </p>
              {syncQueue.find((q) => q.errorMessage)?.errorMessage && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-1">
                  Not: {syncQueue.find((q) => q.errorMessage)?.errorMessage}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onTriggerSync}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition cursor-pointer shadow-xs"
              title="Sözlüğü şimdi eşitle"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{pendingCount > 0 ? `Bekleyen (${pendingCount}) Eşitle` : 'Şimdi Eşitle'}</span>
            </button>

            {sentCount > 0 && (
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                {sentCount} Paket İletildi
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SUCCESS BANNER FOR IMPORT */}
      {importFeedback && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{importFeedback}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMyTermsSubFilter('local-only');
                setActiveMode('my-terms');
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition cursor-pointer"
            >
              Eklediğim Terimleri Gör
            </button>
            <button
              onClick={() => setImportFeedback(null)}
              className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODE 1: MANUAL SINGLE TERM ADDITION */}
      {activeMode === 'manual' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs transition-colors">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Yeni Terim Ekleme Formu</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              İngilizce terimi, Türkçe anlamını ve konusunu girin. Eklediğiniz terim <strong>kendi cihazınızda anında</strong> kullanıma açılır.
            </p>
          </div>

          {singleSuccess && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>"{singleSuccess.en}"</strong> terimi <strong>cihazınızdaki sözlüğe eklendi!</strong> Çevrimdışı ve çevrimiçi olarak hemen kullanabilirsiniz.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectTermForDetail(singleSuccess)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition cursor-pointer"
                >
                  Kartı Gör
                </button>
                <button
                  onClick={() => setSingleSuccess(null)}
                  className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSingleSubmit} className="space-y-4">
            {/* English Word Input with 🇬🇧 flag */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="text-sm" role="img" aria-label="English">🇬🇧</span>
                  <span>İngilizce Terim</span>
                  <span className="text-rose-500">*</span>
                </label>
              </div>
              <input
                id="manual-en-input"
                type="text"
                required
                value={manualEn}
                onChange={(e) => setManualEn(e.target.value)}
                placeholder="Örn: Bulkhead, Windlass, Heave to, Fairlead..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            {/* Duplicate Notice */}
            {duplicateCheck && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Bu terim sözlükte zaten yer alıyor:</span>
                </div>
                <p className="text-[11px] text-amber-900 dark:text-amber-200 pl-5">
                  <strong>{duplicateCheck.en}</strong>: {duplicateCheck.tr} ({duplicateCheck.category})
                </p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 pl-5">
                  * Yine de eklerseniz yeni tanımınız sözlükte öncelikli ve özel olarak saklanacaktır.
                </p>
              </div>
            )}

            {/* Turkish Meaning Input with 🇹🇷 flag */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="text-sm" role="img" aria-label="Turkish">🇹🇷</span>
                  <span>Türkçe Karşılık ve Açıklama</span>
                  <span className="text-rose-500">*</span>
                </label>
              </div>
              <textarea
                id="manual-tr-input"
                required
                rows={3}
                value={manualTr}
                onChange={(e) => setManualTr(e.target.value)}
                placeholder="Örn: Bölme; tekne gövdesini dikey olarak bölümlere ayıran su ve yangın geçirmez perdeler..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 leading-relaxed"
              />
            </div>

            {/* Category Dropdown & Smart Auto-detect */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Kategori / Uzmanlık Alanı
                </label>
                <select
                  id="manual-category-select"
                  value={manualCat}
                  onChange={(e) => setManualCat(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:border-cyan-500"
                >
                  {MARITIME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <button
                  type="button"
                  onClick={handleAutoCategorize}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                  title="Yazdığınız kelimelere göre konuyu otomatik tespit et"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Kategoriyi Otomatik Öner</span>
                </button>
              </div>
            </div>

            {/* Optional Note & Contributor Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Kişisel Ders / Vardiya Notu (İsteğe Bağlı)
                </label>
                <input
                  id="manual-note-input"
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Örn: Vardiya zabitliği sınavında çıkmıştı..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ekleyen Kişi / Gemi Adı (İsteğe Bağlı)
                </label>
                <input
                  id="contributor-name-input"
                  type="text"
                  value={contributorName}
                  onChange={(e) => handleContributorChange(e.target.value)}
                  placeholder="Örn: Kpt. Ahmet / M/V Karadeniz..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setManualEn('');
                  setManualTr('');
                  setManualNote('');
                }}
                className="px-4 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Temizle
              </button>

              <button
                type="submit"
                id="submit-single-term-btn"
                className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Sözlüğe Ekle</span>
              </button>
            </div>
          </form>

          {/* Quick Preview of Recently Added Terms right below manual form on mobile & desktop */}
          {customTerms.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Son Eklenen Kelimeler ({customTerms.length.toLocaleString('tr-TR')})</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveMode('my-terms')}
                  className="text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Tüm Eklenenleri Yönet →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customTerms.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectTermForDetail(item)}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-cyan-50/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        🇬🇧 {item.en}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        🇹🇷 {item.tr}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold">
                        Aktif
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteCustomTerm(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                        title="Bu kelimeyi sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: EXCEL / CSV FILE UPLOAD */}
      {activeMode === 'excel-file' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Excel veya CSV Dosyasından Toplu Aktar</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                .xlsx, .xls veya .csv dosyanızı yükleyin; sözlüğe anında yüzlerce terim ekleyin.
              </p>
            </div>

            {/* Download Sample Excel Template */}
            <button
              id="download-template-btn"
              onClick={downloadSampleExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0"
              title="Örnek sütun formatını içeren Excel şablonunu indirin"
            >
              <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Örnek Excel Şablonu İndir (.xlsx)</span>
            </button>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-400 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-cyan-50/20 dark:hover:bg-slate-800/80 rounded-2xl p-8 text-center cursor-pointer transition space-y-3 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv, .tsv, .txt"
              className="hidden"
              onChange={onFileInputChange}
            />

            <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-700 dark:text-cyan-300 mx-auto transition">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                {fileLoading ? 'Dosya okunuyor...' : 'Excel veya CSV dosyasını buraya sürükleyin'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                veya bilgisayarınızdan/telefonunuzdan seçmek için dokunun (.xlsx, .xls, .csv)
              </p>
            </div>

            <div className="inline-flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span>Sütun Düzeni:</span>
              <span className="text-cyan-700 dark:text-cyan-300 font-bold">1. Sütun: 🇬🇧 İngilizce</span>
              <span>•</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">2. Sütun: 🇹🇷 Türkçe</span>
              <span>•</span>
              <span className="text-amber-700 dark:text-amber-300 font-bold">3. Sütun: Kategori</span>
            </div>
          </div>

          {/* Fallback category setting */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Kategorisi belirtilmemiş satırlar için varsayılan konu:</span>
              <select
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white"
              >
                {MARITIME_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
              />
              <span>Sözlükte var olan terimleri güncelle</span>
            </label>
          </div>
        </div>
      )}

      {/* MODE 3: PASTE TEXT FROM EXCEL / SPREADSHEETS */}
      {activeMode === 'paste-text' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs transition-colors">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Excel'den Kopyala / Yapıştır</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Excel veya Google E-Tablolar'daki hücreleri kopyalayın (Ctrl+C / Cmd+C) ve aşağıdaki kutucuğa yapıştırın (Ctrl+V / Cmd+V).
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              id="paste-text-input"
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Örnek kopyalama formatı (Sekme veya noktalı virgül ile ayrılmış):\nBulkhead\tBölme sacı\tGemi Yapısı ve Güverte Donanımı\nDead Reckoning\tParakete hesabı\tSeyir ve Navigasyon\nWindlass\tIrgat\tGemi Yapısı ve Güverte Donanımı`}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:border-cyan-500 leading-relaxed"
            />

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{pastedText ? `${pastedText.split('\n').filter(Boolean).length} satır girildi` : 'Metin bekleniyor'}</span>
              <button
                id="parse-paste-btn"
                onClick={handleParsePastedText}
                disabled={!pastedText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-semibold transition cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Satırları Çözümle ve Önizle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW TABLE (When rows are parsed from Excel or Paste) */}
      {parsedRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs animate-in fade-in transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>İçe Aktarma Önizlemesi</span>
                {uploadedFileName && (
                  <span className="text-xs font-mono text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800">
                    {uploadedFileName}
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Toplam <strong>{parsedRows.length}</strong> satırdan{' '}
                <strong className="text-cyan-700 dark:text-cyan-400">{selectedRowIndices.size}</strong> adedi seçildi.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer font-medium"
              >
                {selectedRowIndices.size === parsedRows.filter(r => r.isValid).length
                  ? 'Seçimi Kaldır'
                  : 'Tümünü Seç'}
              </button>

              <button
                id="confirm-import-btn"
                onClick={handleConfirmImport}
                disabled={selectedRowIndices.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Seçilen {selectedRowIndices.size} Terimi Sözlüğe Aktar</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5"><span className="mr-1">🇬🇧</span> İngilizce Terim</th>
                  <th className="p-2.5"><span className="mr-1">🇹🇷</span> Türkçe Karşılık</th>
                  <th className="p-2.5">Kategori</th>
                  <th className="p-2.5 w-24">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                {parsedRows.map((row, idx) => {
                  const isSelected = selectedRowIndices.has(idx);

                  return (
                    <tr
                      key={idx}
                      onClick={() => row.isValid && toggleRowSelect(idx)}
                      className={`cursor-pointer transition ${
                        !row.isValid
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                          : isSelected
                          ? 'bg-cyan-50/70 dark:bg-cyan-950/50 text-slate-900 dark:text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          disabled={!row.isValid}
                          checked={isSelected}
                          onChange={() => toggleRowSelect(idx)}
                          className="rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
                        />
                      </td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">{row.en || '—'}</td>
                      <td className="p-2.5 max-w-xs truncate">{row.tr || '—'}</td>
                      <td className="p-2.5 text-[11px] text-cyan-800 dark:text-cyan-300">{row.category}</td>
                      <td className="p-2.5">
                        {!row.isValid ? (
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                            <AlertCircle className="w-3 h-3" /> Hata
                          </span>
                        ) : row.isDuplicate ? (
                          <span className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-semibold">
                            Güncelleme
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-semibold">
                            Yeni
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE 4: MY LOCAL & APPROVED CUSTOM TERMS VIEW */}
      {activeMode === 'my-terms' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Eklediğim & Özel Terimler ({customTerms.length})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kendi eklediğiniz kelimeler ve dosyalar (onay beklese veya çevrimdışı olsanız bile) cihazınızda hemen çalışır.
              </p>
            </div>

            {customTerms.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="export-custom-excel-btn"
                  onClick={() => exportTermsToExcel(filteredCustomTerms)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                  title="Listedeki kelimeleri Excel dosyası olarak indirin"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Excel Olarak İndir (.xlsx)</span>
                </button>

                {confirmClearAll ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 px-2.5 py-1 rounded-xl">
                    <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">Tümü silinsin mi?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllCustomTerms();
                        setConfirmClearAll(false);
                      }}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      Evet, Sil
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <button
                    id="clear-all-custom-btn"
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Tüm Eklenenleri Temizle</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sub-filter: All vs Added on this device */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMyTermsSubFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                myTermsSubFilter === 'all'
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Tüm Özel Terimler ({customTerms.length})
            </button>
            <button
              type="button"
              onClick={() => setMyTermsSubFilter('local-only')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                myTermsSubFilter === 'local-only'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Bu Cihazda Eklediklerim / Onay Bekleyenler ({myLocalTerms.length})
            </button>
          </div>

          {filteredCustomTerms.length > 0 ? (
            <div className="space-y-3">
              {/* Search Filter for Custom Words */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={customSearchQuery}
                  onChange={(e) => setCustomSearchQuery(e.target.value)}
                  placeholder="Eklenen kelimeler arasında ara..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800/90 focus:border-cyan-500"
                />
              </div>

              {/* Custom terms list (paginated to 60 for smooth performance) */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {filteredCustomTerms.slice(0, 60).map((term) => {
                  const lowerKey = term.en.toLowerCase().trim();
                  const isGloballyApproved = approvedEnSet.has(lowerKey);
                  const isMyLocal = localEnSet.has(lowerKey);

                  return (
                    <div
                      key={term.id}
                      className="p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition"
                    >
                      <div
                        onClick={() => onSelectTermForDetail(term)}
                        className="cursor-pointer space-y-1 flex-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm hover:text-cyan-700 dark:hover:text-cyan-400 flex items-center gap-1">
                            <span role="img" aria-label="English">🇬🇧</span> {term.en}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-medium">
                            {term.category}
                          </span>
                          {isGloballyApproved ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                              Genel Sözlükte Aktif
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold">
                              Bu Cihazda Aktif • Onay Bekliyor
                            </span>
                          )}
                          {term.createdAt && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {term.createdAt}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 flex items-baseline gap-1">
                          <span className="text-[11px]" role="img" aria-label="Turkish">🇹🇷</span>
                          <span>{term.tr}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(term)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-400 bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Düzenle</span>
                        </button>

                        {confirmDeleteId === term.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 px-2 py-1 rounded-lg">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteCustomTerm(term.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Evet, Sil
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(term.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/70 rounded-lg transition cursor-pointer"
                            title="Kelimeyi Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Sil</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredCustomTerms.length > 60 && (
                <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  Toplam {filteredCustomTerms.length} terimden ilk 60 tanesi gösteriliyor. Diğerlerini bulmak için yukarıdaki arama kutusunu kullanabilirsiniz.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <ListOrdered className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                {myTermsSubFilter === 'local-only'
                  ? 'Bu cihazda henüz yeni eklediğiniz bir terim bulunmuyor'
                  : 'Henüz özel bir terim bulunmuyor'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Elle veya Excel ile eklediğiniz kelimeler anında burada ve sözlük aramasında aktif olur.
              </p>
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL FOR LOCAL CUSTOM TERM */}
      {editingTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl text-slate-900 dark:text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Terimi Düzenle</span>
              </h4>
              <button
                onClick={() => setEditingTerm(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <span role="img" aria-label="English">🇬🇧</span>
                  <span>İngilizce Terim</span>
                </label>
                <input
                  type="text"
                  value={editEn}
                  onChange={(e) => setEditEn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <span role="img" aria-label="Turkish">🇹🇷</span>
                  <span>Türkçe Karşılık</span>
                </label>
                <textarea
                  rows={3}
                  value={editTr}
                  onChange={(e) => setEditTr(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori
                </label>
                <select
                  value={editCat}
                  onChange={(e) => setEditCat(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-cyan-500 focus:outline-none"
                >
                  {MARITIME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingTerm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Değişiklikleri Kaydet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
