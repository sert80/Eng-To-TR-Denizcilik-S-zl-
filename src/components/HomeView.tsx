import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Volume2,
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  Shuffle,
  Compass,
  BookOpen,
  GraduationCap,
  Sparkles,
  ArrowRight,
  X,
  Layers,
  Radio,
  FileSpreadsheet,
  Wifi,
  WifiOff,
  Trash2,
  MessageSquarePlus,
  Edit2,
} from 'lucide-react';
import { DictionaryTerm, SearchDirection, ActiveTab } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { normalizeSearchText } from '../utils/security';
import { speakMaritimeText } from '../utils/speech';

interface HomeViewProps {
  terms: DictionaryTerm[];
  favorites: string[];
  notes: Record<string, string>;
  onToggleFavorite: (id: string) => void;
  onSelectTerm: (term: DictionaryTerm, openInEditMode?: boolean) => void;
  onNavigateToTab: (tab: ActiveTab, initialSearch?: string, category?: string) => void;
  customTermsCount: number;
  recentCustomTerms?: DictionaryTerm[];
  onOpenAddedTermsList?: () => void;
  onSearchFocusChange?: (focused: boolean) => void;
  onDeleteCustomTerm?: (id: string) => void;
  onOpenFeedback?: (relatedTerm?: string) => void;
}

const POPULAR_SEARCH_KEYWORDS = [
  { shortLabel: 'Sancak', label: 'Starboard (Sancak)', primary: 'Starboard' },
  { shortLabel: 'İskele', label: 'Port (İskele)', primary: 'Port' },
  { shortLabel: 'Pruva', label: 'Bow (Pruva)', primary: 'Bow' },
  { shortLabel: 'Pupa', label: 'Stern (Pupa)', primary: 'Stern' },
  { shortLabel: 'Irgat', label: 'Windlass (Irgat)', primary: 'Windlass' },
  { shortLabel: 'Mayday', label: 'Mayday', primary: 'Mayday' },
  { shortLabel: 'Draft', label: 'Draft (Su çekimi)', primary: 'Draft' },
  { shortLabel: 'Omurga', label: 'Keel (Omurga)', primary: 'Keel' },
  { shortLabel: 'Kerteriz', label: 'Bearing (Kerteriz)', primary: 'Bearing' },
  { shortLabel: 'Kurt Ağzı', label: 'Fairlead (Kurt ağzı)', primary: 'Fairlead' },
  { shortLabel: 'Bölme Sacı', label: 'Bulkhead (Bölme sacı)', primary: 'Bulkhead' },
  { shortLabel: 'Parakete', label: 'Dead Reckoning', primary: 'Dead Reckoning' },
];

export const HomeView: React.FC<HomeViewProps> = ({
  terms,
  favorites,
  notes,
  onToggleFavorite,
  onSelectTerm,
  onNavigateToTab,
  customTermsCount,
  recentCustomTerms = [],
  onOpenAddedTermsList,
  onSearchFocusChange,
  onDeleteCustomTerm,
  onOpenFeedback,
}) => {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [randomTermIndex, setRandomTermIndex] = useState(0);
  const [visibleOtherLimit, setVisibleOtherLimit] = useState(50);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchSectionRef = useRef<HTMLElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const isOnline = useOnlineStatus();

  const scrollSearchToTop = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    if (searchSectionRef.current) {
      const rect = searchSectionRef.current.getBoundingClientRect();
      const targetTop = window.scrollY + rect.top - 4;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isInputFocused) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      scrollSearchToTop();
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [isInputFocused]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleInputFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsInputFocused(true);
    onSearchFocusChange?.(true);
    setTimeout(scrollSearchToTop, 50);
    setTimeout(scrollSearchToTop, 250);
  };

  const handleInputBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsInputFocused(false);
      onSearchFocusChange?.(false);
    }, 180);
  };

  // Reset pagination limit whenever query changes
  useEffect(() => {
    setVisibleOtherLimit(50);
  }, [query]);

  // Helper for Turkish & English character normalization (fixes iOS/Android 'İ' -> 'i\u0307' issue)
  const normalizeText = normalizeSearchText;

  // Helper to escape regex special characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Compute relevance score for terms (closest English match first, then Turkish meaning match)
  const getRelevanceScore = (item: DictionaryTerm, q: string, normQ: string): number => {
    const en = item.en;
    const enLower = en.toLowerCase().trim();
    const enNorm = normalizeText(en);

    // 1. Exact match (highest priority)
    if (enLower === q || enNorm === normQ) {
      return 100000;
    }

    // 2. Starts with query as full prefix
    if (enLower.startsWith(q) || enNorm.startsWith(normQ)) {
      const nextChar = enLower[q.length];
      if (nextChar === ' ' || nextChar === '-' || nextChar === '(' || nextChar === '/') {
        return 80000 - Math.min(500, (enLower.length - q.length) * 10);
      }
      return 60000 - Math.min(500, (enLower.length - q.length) * 10);
    }

    // 3. Exact word boundary match (e.g. "free port" when searching "port")
    try {
      const boundaryRegex = new RegExp(`(^|[\\s/()[\\]-])(${escapeRegex(normQ)})($|[\\s/()[\\]-])`, 'i');
      if (boundaryRegex.test(enNorm)) {
        return 40000 - Math.min(500, (enNorm.length - normQ.length) * 10);
      }
    } catch {
      // fallback
    }

    // 4. Any token / word inside term starts with query
    const words = enNorm.split(/[\s/()[\],-]+/).filter(Boolean);
    if (words.some((w) => w.startsWith(normQ))) {
      return 30000 - Math.min(500, (enNorm.length - normQ.length) * 10);
    }

    // 5. Contains substring in English term
    if (enLower.includes(q) || enNorm.includes(normQ)) {
      return 10000 - Math.min(500, (enNorm.length - normQ.length) * 10);
    }

    // 6. Matches in Turkish meaning
    const trNorm = normalizeText(item.tr);
    if (trNorm === normQ) return 6000;
    if (trNorm.startsWith(normQ)) return 5000;
    if (trNorm.includes(normQ)) return 4000;

    return 0;
  };

  // Set an initial random term on mount
  useEffect(() => {
    if (terms.length > 0) {
      setRandomTermIndex(Math.floor(Math.random() * terms.length));
    }
  }, [terms.length]);

  const featuredRandomTerm = useMemo(() => {
    if (terms.length === 0) return null;
    return terms[randomTermIndex % terms.length];
  }, [terms, randomTermIndex]);

  const handleNextRandom = () => {
    if (terms.length === 0) return;
    setRandomTermIndex((prev) => (prev + 1 + Math.floor(Math.random() * 50)) % terms.length);
  };

  // Search results: search in English term name and Turkish meaning, sorted by closest relevance
  const searchResults = useMemo(() => {
    const rawQ = query.trim();
    if (!rawQ) return [];

    const q = rawQ.toLowerCase();
    const normalizedQ = normalizeText(rawQ);

    const matches = terms.filter((item) => {
      const enNorm = normalizeText(item.en);
      if (enNorm.includes(normalizedQ) || item.en.toLowerCase().includes(q)) {
        return true;
      }
      const trNorm = normalizeText(item.tr);
      return trNorm.includes(normalizedQ);
    });

    // Sort by relevance score (closest match first)
    return matches.sort((a, b) => {
      const scoreA = getRelevanceScore(a, q, normalizedQ);
      const scoreB = getRelevanceScore(b, q, normalizedQ);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return a.en.localeCompare(b.en, 'en', { sensitivity: 'base' });
    });
  }, [terms, query]);

  // Determine top match: searchResults is already sorted by relevance, index 0 is closest
  const topMatch = useMemo(() => {
    if (searchResults.length === 0) return null;
    return searchResults[0];
  }, [searchResults]);

  // If a term has multiple meanings (same English term, multiple entries), collect ALL of them
  const exactMatches = useMemo(() => {
    if (!topMatch) return [];
    const targetEn = topMatch.en.toLowerCase().trim();
    return searchResults.filter((t) => t.en.toLowerCase().trim() === targetEn);
  }, [searchResults, topMatch]);

  // Other matching results (excluding the exact matches of topMatch)
  // Shows ALL matches without arbitrary 8-item restriction!
  const otherMatches = useMemo(() => {
    if (!topMatch) return [];
    const exactIds = new Set(exactMatches.map((m) => m.id));
    return searchResults.filter((t) => !exactIds.has(t.id));
  }, [searchResults, topMatch, exactMatches]);

  // Paginated slice for smooth rendering if there are very many results
  const visibleOtherMatches = useMemo(() => {
    return otherMatches.slice(0, visibleOtherLimit);
  }, [otherMatches, visibleOtherLimit]);

  const handleSpeak = (
    text: string,
    id: string,
    e?: React.MouseEvent,
    lang: 'en' | 'tr' = 'en'
  ) => {
    e?.stopPropagation();
    speakMaritimeText(text, {
      lang,
      onStart: () => setSpeakingId(id),
      onEnd: () => setSpeakingId(null),
    });
  };

  const handleCopy = (term: DictionaryTerm, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(`${term.en} = ${term.tr} (${term.category})`);
    setCopiedId(term.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Seyir ve Navigasyon':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Gemi Yapısı ve Güverte Donanımı':
        return 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
      case 'Hukuk, Ticaret ve Sigorta':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Gemi Makineleri ve Sistemler':
        return 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Meteoroloji ve Oşinografi':
        return 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'Denizde Emniyet ve Kurtarma':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'Liman ve Gemi İşletmeciliği':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-5 max-w-4xl mx-auto">
      {/* SADE VE ODAKLI ARAMA BÖLÜMÜ (Mobilde klavye açıldığında en üstte sabit kalır) */}
      <section
        ref={searchSectionRef}
        className={`${
          isInputFocused || query.trim().length > 0 ? 'sticky top-0 z-30 shadow-md sm:static sm:shadow-xs' : ''
        } bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-2.5 sm:p-5 rounded-2xl shadow-xs text-center space-y-2 sm:space-y-3.5 transition-colors duration-200`}
      >
        {/* Masaüstü başlık (Mobilde ferah kullanım) */}
        <div className="hidden sm:block space-y-1 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
            <img
              src="/anchor-icon.jpg"
              alt="Çapa İkonu"
              className="w-4 h-4 rounded-full object-cover border border-cyan-500/60 shrink-0"
              referrerPolicy="no-referrer"
            />
            <span>Denizcilik Terimleri Arama Motoru</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                <Wifi className="w-3 h-3" /> Çevrimiçi
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
                <WifiOff className="w-3 h-3" /> Çevrimdışı
              </span>
            )}
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Aradığınız Denizcilik Kelimesini Yazın
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {terms.length.toLocaleString('tr-TR')} terim • Açık denizde internetsiz anında karşılık
          </p>
        </div>

        {/* ARAMA GİRİŞ ALANI - Dikey telefon kullanımında başparmakla anında erişim */}
        <div className="max-w-xl mx-auto space-y-1.5">
          <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/90 sm:bg-white sm:dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-2xl shadow-2xs focus-within:border-cyan-600 dark:focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-600/20 transition">
            <div className="pl-3 pr-1.5 text-cyan-600 dark:text-cyan-400 shrink-0">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>

            <input
              id="home-search-engine-input"
              type="search"
              enterKeyHint="search"
              value={query}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onChange={(e) => {
                setQuery(e.target.value);
                scrollSearchToTop();
              }}
              placeholder="🇬🇧 İngilizce / 🇹🇷 Türkçe ara..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="w-full py-2.5 sm:py-3.5 px-1 bg-transparent text-[13px] sm:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            />

            {query && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery('')}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer shrink-0 mr-1"
                title="Aramayı Temizle"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (query.trim()) {
                  onNavigateToTab('dictionary', query.trim());
                }
              }}
              className="hidden sm:flex items-center gap-1 mx-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 shadow-xs"
            >
              <span>Sözlükte Aç</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* İngilizce - Türkçe Sözlük Göstergesi (Klavye açıkken gizlenir, ilk kelimenin hemen görünmesini sağlar) */}
          <div
            className={`${
              isInputFocused || query.trim().length > 0 ? 'hidden sm:inline-flex' : 'inline-flex'
            } items-center gap-1.5 sm:gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 font-semibold shadow-2xs whitespace-nowrap`}
          >
            <span className="text-xs sm:text-sm">🇬🇧</span>
            <span>İngilizce</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">→</span>
            <span className="text-xs sm:text-sm">🇹🇷</span>
            <span>Türkçe Terim Arama</span>
          </div>
        </div>

        {/* HIZLI ARAMA ETİKETLERİ (Boşken tek satırda kaydırılabilir) */}
        {!query && (
          <div className="pt-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 justify-start sm:justify-center">
              {POPULAR_SEARCH_KEYWORDS.slice(0, 8).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setQuery(item.primary)}
                  className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-700 text-slate-700 dark:text-slate-300 hover:text-cyan-800 dark:hover:text-cyan-300 text-[11px] shrink-0 whitespace-nowrap transition cursor-pointer active:scale-95 font-medium"
                >
                  {item.shortLabel}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ARAMA SONUÇLARI - Klavye açıkken arama kutusunun hemen altında ilk uygun kelime görünür */}
      {query.trim().length > 0 && (
        <section className="space-y-2 sm:space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="truncate">
                "{query}" İlk Uygun Sonuç{' '}
                <span className="text-slate-500 dark:text-slate-400 font-normal">({searchResults.length} terim)</span>
              </span>
            </h3>

            {searchResults.length > 0 && (
              <button
                onClick={() => onNavigateToTab('dictionary', query.trim())}
                className="text-[11px] sm:text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Sözlükte Filtrele</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {topMatch ? (
            <div className="space-y-2.5 sm:space-y-3">
              {/* EN İYİ EŞLEŞEN TERİM KARTI (Klavye açıkken ilk uygun kelime tam görünür) */}
              <div
                id={`featured-match-${topMatch.id}`}
                onClick={() => onSelectTerm(topMatch)}
                className="bg-white dark:bg-slate-900 border-2 border-cyan-500/40 dark:border-cyan-500/40 rounded-2xl p-3 sm:p-5 shadow-sm space-y-2 sm:space-y-3.5 cursor-pointer"
              >
                {/* Üst Kategori & Aksiyon Butonları */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span
                      className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-md border leading-tight break-words ${getCategoryBadgeClass(
                        topMatch.category
                      )}`}
                    >
                      {topMatch.category}
                    </span>
                    {topMatch.isCustom && (
                      <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                        Özel Terim
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleSpeak(topMatch.en, topMatch.id, e, 'en')}
                      className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-xs ${
                        speakingId === topMatch.id
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 border-slate-200 dark:border-slate-700'
                      }`}
                      title="İngilizce Telaffuz Dinle"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">🇬🇧 Dinle</span>
                    </button>

                    <button
                      onClick={(e) => handleSpeak(topMatch.tr, `${topMatch.id}_tr`, e, 'tr')}
                      className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-xs ${
                        speakingId === `${topMatch.id}_tr`
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                      title="Türkçe Açıklamayı Sesli Oku"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[11px] font-medium">🇹🇷 Oku</span>
                    </button>

                    <button
                      onClick={() => onToggleFavorite(topMatch.id)}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        favorites.includes(topMatch.id)
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                      title={favorites.includes(topMatch.id) ? 'Favorilerden Çıkar' : 'Kaydet'}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${favorites.includes(topMatch.id) ? 'fill-amber-500' : ''}`} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTerm(topMatch, true);
                      }}
                      className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/70 hover:bg-cyan-100 dark:hover:bg-cyan-900/70 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                      title="Bu Kelimeyi Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[11px]">Düzenle</span>
                    </button>

                    <button
                      onClick={(e) => handleCopy(topMatch, e)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      title="Kopyala"
                    >
                      {copiedId === topMatch.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Terim Başlığı & Türkçe Karşılığı / Tüm Anlamları */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-lg sm:text-2xl shrink-0" role="img" aria-label="İngilizce">🇬🇧</span>
                      <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight break-words">
                        {topMatch.en}
                      </h3>
                    </div>
                    {exactMatches.length > 1 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 shrink-0">
                        {exactMatches.length} Anlam
                      </span>
                    )}
                  </div>

                  {exactMatches.length > 1 ? (
                    <div className="space-y-1.5">
                      <div className="space-y-1.5">
                        {exactMatches.map((item, idx) => (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTerm(item);
                            }}
                            className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 sm:p-3.5 text-slate-800 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-600"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400 font-mono shrink-0">
                                  #{idx + 1}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border leading-tight break-words ${getCategoryBadgeClass(
                                    item.category
                                  )}`}
                                >
                                  {item.category}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={(e) => handleCopy(item, e)}
                                  className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 cursor-pointer"
                                  title="Kopyala"
                                >
                                  {copiedId === item.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectTerm(item);
                                  }}
                                  className="text-[11px] text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                >
                                  Detay <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="text-sm mt-0.5 shrink-0" role="img" aria-label="Türkçe">🇹🇷</span>
                              <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base leading-snug">
                                {item.tr}
                              </p>
                            </div>
                            {notes[item.id] && (
                              <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-1 italic pl-5">
                                Not: {notes[item.id]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-2.5 sm:p-3.5 text-slate-800 dark:text-slate-200 text-sm leading-snug">
                      <div className="flex items-start gap-1.5">
                        <span className="text-sm mt-0.5 shrink-0" role="img" aria-label="Türkçe">🇹🇷</span>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">{topMatch.tr}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Kişisel Not */}
                {notes[topMatch.id] && exactMatches.length <= 1 && (
                  <div className="p-2 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs text-cyan-900 dark:text-cyan-200">
                    <span className="font-bold text-cyan-800 dark:text-cyan-300">Notunuz:</span> {notes[topMatch.id]}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTerm(topMatch, true);
                    }}
                    className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Kelimeyi Düzenle</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTerm(topMatch);
                    }}
                    className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 font-semibold flex items-center gap-1.5 cursor-pointer hover:underline"
                  >
                    <span>Detay & Not Al</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              </div>

              {/* DİĞER EŞLEŞEN TERİMLER (Bütün eşleşmeler, sınırlandırılmamış) */}
              {otherMatches.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-0.5">
                    <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Diğer Eşleşmeler ({otherMatches.length})
                    </h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      En yakın sonuca göre sıralandı
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visibleOtherMatches.map((term) => (
                      <div
                        key={term.id}
                        onClick={() => onSelectTerm(term)}
                        className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3 transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs min-w-0"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-start justify-between gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-sm hover:text-cyan-700 dark:hover:text-cyan-400 transition flex items-center gap-1.5 min-w-0">
                              <span className="text-xs shrink-0" role="img" aria-label="İngilizce">🇬🇧</span>
                              <span className="break-words">{term.en}</span>
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium leading-tight break-words">
                              {term.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 flex items-start gap-1">
                            <span className="text-xs mt-0.5 shrink-0" role="img" aria-label="Türkçe">🇹🇷</span>
                            <span className="break-words">{term.tr}</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={(e) => handleSpeak(term.en, term.id, e)}
                              className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-400 cursor-pointer"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Dinle</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTerm(term, true);
                              }}
                              className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-400 cursor-pointer font-medium"
                              title="Bu Kelimeyi Düzenle"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Düzenle</span>
                            </button>
                          </div>
                          <span className="text-cyan-700 dark:text-cyan-400 flex items-center gap-1 font-semibold">
                            İncele <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {otherMatches.length > visibleOtherLimit && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={() => setVisibleOtherLimit((prev) => prev + 50)}
                        className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-slate-300 dark:border-slate-700 hover:border-cyan-600 dark:hover:border-cyan-500 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                      >
                        Kalan {otherMatches.length - visibleOtherLimit} Eşleşmeyi Daha Göster
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* BULUNAMADI */
            <div className="text-center py-8 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5 shadow-xs">
              <Search className="w-7 h-7 text-slate-400 dark:text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                "{query}" Terimi Bulunamadı
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Bu terimi sözlüğe eklenmek üzere doğrudan yöneticiye bildirebilir veya yeni kelime olarak ekleyebilirsiniz.
              </p>
              <div className="pt-1.5 flex flex-wrap items-center justify-center gap-2">
                {onOpenFeedback && (
                  <button
                    id="report-missing-term-home-btn"
                    type="button"
                    onClick={() => onOpenFeedback(query.trim())}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>"{query.trim()}" Terimini Yöneticiye Bildir</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateToTab('add-term')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                >
                  Yeni Kelime Olarak Ekle
                </button>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs cursor-pointer font-medium"
                >
                  Aramayı Temizle
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* SON EKLENEN / GÜNCEL TERİMLER (Mobilde ve Masaüstünde Arama Boşken Hemen Görünür) */}
      {!query && recentCustomTerms.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-xs transition-colors duration-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Son Eklenen Kelimeler ({customTermsCount.toLocaleString('tr-TR')})</span>
            </span>
            <button
              onClick={() =>
                onOpenAddedTermsList ? onOpenAddedTermsList() : onNavigateToTab('add-term')
              }
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Tümünü Gör</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {recentCustomTerms.slice(0, 6).map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectTerm(item)}
                className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-800/80 hover:bg-emerald-100/60 dark:hover:bg-slate-800 border border-emerald-200/70 dark:border-slate-700 transition cursor-pointer flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate flex items-center gap-1 min-w-0">
                    <span className="text-xs shrink-0" role="img" aria-label="İngilizce">🇬🇧</span>
                    <span className="truncate">{item.en}</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold">
                      Yeni
                    </span>
                    {onDeleteCustomTerm && (
                      <button
                        type="button"
                        onClick={() => onDeleteCustomTerm(item.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                        title="Bu eklenen kelimeyi sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 flex items-center gap-1">
                  <span className="text-xs shrink-0" role="img" aria-label="Türkçe">🇹🇷</span>
                  <span className="truncate">{item.tr}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GÜNÜN RASTGELE TERİMİ (Arama Boşken - Klavye açıkken ilk sırada görünür) */}
      {!query && featuredRandomTerm && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-5 space-y-2 shadow-xs transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
              <img
                src="/anchor-icon.jpg"
                alt="Çapa İkonu"
                className="w-4 h-4 rounded-full object-cover border border-cyan-500/50 shrink-0"
                referrerPolicy="no-referrer"
              />
              <span>Günün Terimi</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleSpeak(featuredRandomTerm.en, featuredRandomTerm.id, e)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer text-xs flex items-center gap-1"
                title="Sesli Telaffuz Dinle"
              >
                <Volume2 className="w-3 h-3" />
                <span className="hidden sm:inline text-[10px] font-semibold">Dinle</span>
              </button>

              <button
                onClick={handleNextRandom}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition cursor-pointer p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Başka Rastgele Terim Getir"
              >
                <Shuffle className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span className="text-[11px] sm:text-xs font-medium">Farklı Terim</span>
              </button>
            </div>
          </div>

          <div
            onClick={() => onSelectTerm(featuredRandomTerm)}
            className="cursor-pointer space-y-1.5 group bg-slate-50 dark:bg-slate-800/80 hover:bg-cyan-50/50 dark:hover:bg-slate-800 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-700 transition min-w-0"
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition flex items-center gap-1.5 min-w-0">
                <span className="text-base shrink-0" role="img" aria-label="İngilizce">🇬🇧</span>
                <span className="break-words">{featuredRandomTerm.en}</span>
              </h4>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border leading-tight break-words ${getCategoryBadgeClass(
                  featuredRandomTerm.category
                )}`}
              >
                {featuredRandomTerm.category}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal flex items-start gap-1.5">
              <span className="text-sm mt-0.5 shrink-0" role="img" aria-label="Türkçe">🇹🇷</span>
              <span className="break-words">{featuredRandomTerm.tr}</span>
            </p>
          </div>
        </section>
      )}

      {/* HIZLI ERİŞİM KARTLARI (Masaüstünde 4'lü ızgara) */}
      {!query && (
        <section className="hidden md:grid md:grid-cols-4 gap-2.5">
          <div
            onClick={() => onNavigateToTab('dictionary')}
            className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-600 rounded-xl cursor-pointer transition space-y-1.5 group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition">
              <BookOpen className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition">
              A-Z Sözlük
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Tüm terimleri alfabetik sırayla inceleyin.
            </p>
          </div>

          <div
            onClick={() => onNavigateToTab('add-term')}
            className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-xl cursor-pointer transition space-y-1.5 group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition flex items-center gap-1">
              <span>Kelime Ekle</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Excel yükleyin veya elle terim kaydedin.
            </p>
          </div>

          <div
            onClick={() => onNavigateToTab('quiz')}
            className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 rounded-xl cursor-pointer transition space-y-1.5 group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition">
              <GraduationCap className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-purple-700 dark:group-hover:text-purple-400 transition">
              Denizcilik Testi
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              10 soruluk test ile bilginizi ölçün.
            </p>
          </div>

          <div
            onClick={() => onNavigateToTab('categories')}
            className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 rounded-xl cursor-pointer transition space-y-1.5 group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition">
              <Layers className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-amber-700 dark:group-hover:text-amber-400 transition">
              Kategoriler
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              8 ana uzmanlık alanına göre filtreleyin.
            </p>
          </div>
        </section>
      )}

      {/* ALT BİLGİ & HATA / ÖNERİ GÖNDER BUTONU (Mobil ve Masaüstünde görünür) */}
      {!query && (
        <section className="py-1 flex flex-wrap items-center justify-center gap-2 text-center">
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Açık Denizde Çevrimdışı Çalışır • Otomatik Güncellenir</span>
          </div>

          {onOpenFeedback && (
            <button
              id="home-feedback-btn"
              type="button"
              onClick={() => onOpenFeedback()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-cyan-50 dark:hover:bg-slate-800 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Hata / Öneri Gönder</span>
            </button>
          )}
        </section>
      )}
    </div>
  );
};
