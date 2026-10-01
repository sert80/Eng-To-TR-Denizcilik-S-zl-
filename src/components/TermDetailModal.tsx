import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  Bookmark,
  Copy,
  Check,
  Share2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Save,
  RotateCcw,
  Trash2,
  MessageSquarePlus,
  Edit2,
} from 'lucide-react';
import { DictionaryTerm, MARITIME_CATEGORIES } from '../types';
import { speakMaritimeText, stopMaritimeSpeech } from '../utils/speech';
import { sanitizeText } from '../utils/security';

interface TermDetailModalProps {
  term: DictionaryTerm | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onNextTerm?: () => void;
  onPrevTerm?: () => void;
  note: string;
  onSaveNote: (termId: string, noteText: string) => void;
  onDeleteCustomTerm?: (id: string) => void;
  onReportTermFeedback?: (termLabel: string) => void;
  onEditTerm?: (
    originalTerm: DictionaryTerm,
    updatedData: { en: string; tr: string; category: string; contributorName?: string }
  ) => void;
  initialEditMode?: boolean;
}

export const TermDetailModal: React.FC<TermDetailModalProps> = ({
  term,
  onClose,
  isFavorite,
  onToggleFavorite,
  onNextTerm,
  onPrevTerm,
  note,
  onSaveNote,
  onDeleteCustomTerm,
  onReportTermFeedback,
  onEditTerm,
  initialEditMode = false,
}) => {
  if (!term) return null;

  const [copied, setCopied] = useState(false);
  const [speakingLang, setSpeakingLang] = useState<'en' | 'tr' | null>(null);
  const [currentNote, setCurrentNote] = useState(note);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [shouldAutoFocusNote, setShouldAutoFocusNote] = useState(false);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Term Edit State (Available for ALL terms in the dictionary)
  const [isEditingTerm, setIsEditingTerm] = useState(initialEditMode);
  const [editEn, setEditEn] = useState(term.en);
  const [editTr, setEditTr] = useState(term.tr);
  const [editCategory, setEditCategory] = useState(term.category);
  const [editContributor, setEditContributor] = useState(() => {
    try {
      return localStorage.getItem('maritime_contributor_name') || '';
    } catch {
      return '';
    }
  });
  const [termEditSuccess, setTermEditSuccess] = useState(false);

  // Synchronize state when selected term changes
  useEffect(() => {
    setCurrentNote(note);
    setIsEditingNote(false);
    setConfirmDelete(false);
    setSpeakingLang(null);
    setIsEditingTerm(initialEditMode);
    setEditEn(term.en);
    setEditTr(term.tr);
    setEditCategory(term.category);
    setTermEditSuccess(false);
    stopMaritimeSpeech();
  }, [term.id, term.en, term.tr, term.category, note, initialEditMode]);

  const handleSaveTermEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEn = sanitizeText(editEn, 250);
    const cleanTr = sanitizeText(editTr, 2000);
    const cleanCat = sanitizeText(editCategory, 100) || term.category || 'Genel Denizcilik';
    const cleanContributor = sanitizeText(editContributor, 100);
    if (!cleanEn || !cleanTr || !onEditTerm) return;

    try {
      if (cleanContributor) {
        localStorage.setItem('maritime_contributor_name', cleanContributor);
      }
    } catch {
      // ignore
    }

    onEditTerm(term, {
      en: cleanEn,
      tr: cleanTr,
      category: cleanCat,
      contributorName: cleanContributor || undefined,
    });
    setIsEditingTerm(false);
    setTermEditSuccess(true);
    setTimeout(() => setTermEditSuccess(false), 5000);
  };

  // Clean up TTS when unmounting
  useEffect(() => {
    return () => {
      stopMaritimeSpeech();
    };
  }, []);

  const handleSpeak = (lang: 'en' | 'tr') => {
    const text = lang === 'en' ? term.en : term.tr;
    speakMaritimeText(text, {
      lang,
      onStart: () => setSpeakingLang(lang),
      onEnd: () => setSpeakingLang(null),
    });
  };

  const handleCopy = () => {
    const text = `${term.en} = ${term.tr} (${term.category})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: `${term.en} - Denizcilik Sözlüğü`,
      text: `${term.en}: ${term.tr} (${term.category})`,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleSaveNoteSubmit = () => {
    onSaveNote(term.id, currentNote);
    setIsEditingNote(false);
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2000);
  };

  const handleCancelNote = () => {
    setCurrentNote(note);
    setIsEditingNote(false);
  };

  // Split Turkish definition if multiple sub-meanings exist (e.g. 1) 2) or semicolons)
  const meanings = term.tr.split(/;\s*(?=[1-9]\)|\b[A-Za-zÇĞİÖŞÜçğiöşü])/).filter(Boolean);

  return (
    <div
      id="term-detail-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start sm:items-center justify-between gap-2 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 truncate max-w-[110px]">
              #{term.id}
            </span>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 leading-tight break-words">
              {term.category}
            </span>
            {term.isCustom && (
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 shrink-0">
                {term.isEdited ? 'Düzenlenmiş' : 'Özel Eklenen'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onEditTerm && (
              <button
                id="detail-edit-term-btn"
                type="button"
                onClick={() => setIsEditingTerm((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  isEditingTerm
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-cyan-50 dark:bg-cyan-950/70 hover:bg-cyan-100 dark:hover:bg-cyan-900/70 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                }`}
                title="Bu Kelimeyi Düzenle (Onay E-postasına Gönderilir)"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Düzenle</span>
              </button>
            )}
            {term.isCustom && onDeleteCustomTerm && (
              confirmDelete ? (
                <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 px-2 py-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => onDeleteCustomTerm(term.id)}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    Evet, Sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    İptal
                  </button>
                </div>
              ) : (
                <button
                  id="detail-delete-btn"
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition cursor-pointer"
                  title="Eklenen Bu Terimi Sözlükten Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}

            <button
              id="detail-fav-btn"
              onClick={() => onToggleFavorite(term.id)}
              className={`p-2 rounded-xl transition cursor-pointer border ${
                isFavorite
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent'
              }`}
              title={isFavorite ? 'Kaydedilenlerden Çıkar' : 'Favorilere Ekle'}
            >
              <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
            </button>

            <button
              id="detail-close-btn"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {termEditSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Düzenlemeniz cihazınızda aktif edildi ve onay e-postasına gönderildi. Onaylandığında tüm kullanıcıların veritabanında güncellenecektir.
              </span>
            </div>
          )}

          {isEditingTerm ? (
            <form onSubmit={handleSaveTermEdit} className="space-y-4 bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-cyan-300 dark:border-cyan-800">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <h3 className="text-sm font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                  <Edit2 className="w-4 h-4" />
                  <span>Kelime ve Açıklamayı Düzenle</span>
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Onaylandığında tüm veritabanında güncellenir
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    🇬🇧 İngilizce Terim
                  </label>
                  <input
                    type="text"
                    required
                    value={editEn}
                    onChange={(e) => setEditEn(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kategori
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {MARITIME_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  🇹🇷 Türkçe Karşılık ve Açıklama
                </label>
                <textarea
                  rows={4}
                  required
                  value={editTr}
                  onChange={(e) => setEditTr(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Düzenleyen Kişi (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={editContributor}
                  onChange={(e) => setEditContributor(e.target.value)}
                  placeholder="Adınız / Ünvanınız (Onay mailinde görünür)"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditEn(term.en);
                    setEditTr(term.tr);
                    setEditCategory(term.category);
                    setIsEditingTerm(false);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Değişikliği Kaydet ve Onaya Gönder</span>
                </button>
              </div>
            </form>
          ) : null}

          {/* English Term & Audio */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider">
              <span className="text-sm">🇬🇧</span>
              <span>İngilizce Terim</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl" role="img" aria-label="İngilizce">🇬🇧</span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                  {term.en}
                </h2>
              </div>

              <button
                id="detail-speak-en-btn"
                onClick={() => handleSpeak('en')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition cursor-pointer shrink-0 shadow-2xs text-xs font-bold ${
                  speakingLang === 'en'
                    ? 'bg-cyan-600 text-white border-cyan-600 animate-pulse ring-2 ring-cyan-400'
                    : 'bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                }`}
                title="İngilizce Telaffuz Dinle"
              >
                <Volume2 className="w-4 h-4" />
                <span>{speakingLang === 'en' ? 'Okunuyor...' : '🇬🇧 Dinle'}</span>
              </button>
            </div>
          </div>

          {/* Turkish Translation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🇹🇷</span>
                <span>Türkçe Karşılık ve Açıklama</span>
              </div>
              <button
                id="detail-speak-tr-btn"
                onClick={() => handleSpeak('tr')}
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 cursor-pointer font-semibold transition ${
                  speakingLang === 'tr'
                    ? 'bg-cyan-600 text-white border-cyan-600 animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{speakingLang === 'tr' ? 'Okunuyor...' : '🇹🇷 Türkçe Oku'}</span>
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/90 text-slate-800 dark:text-slate-200 leading-relaxed text-sm space-y-2">
              {meanings.length > 1 ? (
                <ul className="space-y-2 list-disc list-inside">
                  {meanings.map((m, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <span className="text-slate-900 dark:text-white font-medium">{m.trim()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-900 dark:text-white font-semibold text-base">{term.tr}</p>
              )}
            </div>
          </div>

          {/* User Personal Notes Section (Stored in LocalStorage) */}
          <div className="space-y-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Kişisel Notunuz</span>
              </div>

              <div className="flex items-center gap-2">
                {noteSavedFeedback && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold animate-in fade-in">
                    <Check className="w-3 h-3" /> Not kaydedildi
                  </span>
                )}
              </div>
            </div>

            {isEditingNote ? (
              <div className="space-y-2">
                <div className="relative">
                  <textarea
                    id="term-note-textarea"
                    value={currentNote}
                    onChange={(e) => setCurrentNote(e.target.value)}
                    placeholder="Bu terimle ilgili ders veya vardiya notunuzu yazın..."
                    className="w-full h-28 p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none leading-relaxed"
                    autoFocus={shouldAutoFocusNote}
                  />
                  {currentNote && (
                    <button
                      type="button"
                      onClick={() => setCurrentNote('')}
                      className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition cursor-pointer bg-slate-100 dark:bg-slate-700"
                      title="Metni Temizle"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Notunuz bu cihazda yerel olarak saklanır.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelNote}
                      className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer font-medium"
                    >
                      Vazgeç
                    </button>
                    <button
                      id="save-note-btn"
                      type="button"
                      onClick={handleSaveNoteSubmit}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs active:scale-95 transition"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Kaydet</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  setShouldAutoFocusNote(true);
                  setIsEditingNote(true);
                }}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 cursor-pointer min-h-[52px] transition flex items-center justify-between group"
              >
                {currentNote ? (
                  <span className="leading-relaxed whitespace-pre-wrap">{currentNote}</span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Bu terimle ilgili kişisel not eklemek için dokunun...</span>
                  </span>
                )}
                <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 group-hover:text-cyan-800 dark:group-hover:text-cyan-300 shrink-0 ml-2">
                  Düzenle
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 flex items-center justify-between gap-2">
          {/* Previous / Next Term in Dictionary */}
          <div className="flex items-center gap-1">
            <button
              id="detail-prev-btn"
              disabled={!onPrevTerm}
              onClick={onPrevTerm}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              title="Önceki Terim"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              id="detail-next-btn"
              disabled={!onNextTerm}
              onClick={onNextTerm}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              title="Sonraki Terim"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {onReportTermFeedback && (
              <button
                id="detail-feedback-btn"
                type="button"
                onClick={() => onReportTermFeedback(`${term.en} = ${term.tr}`)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold transition cursor-pointer border border-amber-200 dark:border-amber-800/70"
                title="Bu kelimeyle ilgili hata veya düzeltme önerisi gönder"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Hata / Öneri</span>
              </button>
            )}

            <button
              id="detail-copy-btn"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>

            <button
              id="detail-share-btn"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Paylaş</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
