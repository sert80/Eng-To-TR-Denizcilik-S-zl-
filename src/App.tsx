import React, { useState, useMemo, useEffect } from 'react';
import dictionaryData from './data/dictionary.json';
import { DictionaryTerm, SearchDirection, ActiveTab } from './types';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { LetterBar } from './components/LetterBar';
import { CategoryFilter } from './components/CategoryFilter';
import { TermCard } from './components/TermCard';
import { TermDetailModal } from './components/TermDetailModal';
import { FavoritesView } from './components/FavoritesView';
import { CategoriesView } from './components/CategoriesView';
import { QuizModal } from './components/QuizModal';
import { InfoModal } from './components/InfoModal';
import { FeedbackModal } from './components/FeedbackModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AddTermView, AddMode } from './components/AddTermView';
import { HomeView } from './components/HomeView';
import {
  getSyncQueue,
  enqueueTermsForEmail,
  processPendingSyncQueue,
  submitTermsToPendingServer,
  fetchServerDictionaryState,
  flushOfflineFeedbackQueue,
  SyncQueueItem,
} from './utils/emailSync';
import { normalizeSearchText, sanitizeTermInput, sanitizeText, stripAuthorAttribution, isMaritimeAbbreviation } from './utils/security';
import sharedCustomData from './data/shared_custom_terms.json';
import { Anchor, PlusCircle, ChevronDown, ArrowUp, Home, BookOpen, Compass, Bookmark, GraduationCap, MailCheck, X, RefreshCw } from 'lucide-react';

const rawTerms = dictionaryData as DictionaryTerm[];
const bundledSharedTerms = Array.isArray(sharedCustomData) ? (sharedCustomData as DictionaryTerm[]) : [];

function combineTermMeanings(trPrimary: string, trSecondary: string): string {
  const c1 = (trPrimary || '').trim();
  const c2 = (trSecondary || '').trim();
  if (!c1) return c2;
  if (!c2) return c1;
  const norm = (s: string) =>
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

const APPROVED_STORAGE_KEY = 'maritime_approved_custom_terms_v1';
const MY_LOCAL_TERMS_KEY = 'maritime_my_local_terms_v1';
const PENDING_STORAGE_KEY = 'maritime_pending_custom_terms_v1';
const LEGACY_CUSTOM_KEY = 'maritime_custom_terms';
const DELETED_CUSTOM_TERMS_KEY = 'maritime_deleted_custom_terms_v1';
const LAST_SYNC_TIME_KEY = 'maritime_last_sync_time_v1';
const ACTIVE_BUILD_VERSION_KEY = 'maritime_active_build_version_v1';

export default function App() {
  // Navigation & View State (Default to Home / Giriş Sayfası)
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [addTermInitialMode, setAddTermInitialMode] = useState<AddMode>('manual');
  const [selectedTerm, setSelectedTerm] = useState<DictionaryTerm | null>(null);
  const [openModalInEditMode, setOpenModalInEditMode] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const handleSelectTerm = (term: DictionaryTerm | null, editMode = false) => {
    setOpenModalInEditMode(Boolean(editMode));
    setSelectedTerm(term);
  };
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackRelatedTerm, setFeedbackRelatedTerm] = useState<string>('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDirection, setSearchDirection] = useState<SearchDirection>('en-tr');
  const [activeLetter, setActiveLetter] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [onlyAbbreviations, setOnlyAbbreviations] = useState<boolean>(false);
  const [isMobileSearchFocused, setIsMobileSearchFocused] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Pagination for smooth mobile performance
  const [displayLimit, setDisplayLimit] = useState(40);

  // Track deleted custom term keys so deleted terms never reappear from bundle/cache
  const [deletedCustomKeys, setDeletedCustomKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(DELETED_CUSTOM_TERMS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 1. GLOBALLY APPROVED Custom Terms (Newest approved terms at index 0)
  const [customTerms, setCustomTerms] = useState<DictionaryTerm[]>(() => {
    let localApproved: DictionaryTerm[] = [];
    try {
      const saved = localStorage.getItem(APPROVED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          localApproved = parsed.filter((t: any) => t?.batchId !== 'initial_pending_sync');
        }
      }
    } catch {
      // ignore
    }
    if (bundledSharedTerms.length === 0) return localApproved;
    if (localApproved.length === 0) return bundledSharedTerms;

    // Keep bundledSharedTerms order (which has newest approved terms at top) plus any newly cached localApproved items at the very top
    const bundledKeys = new Set(bundledSharedTerms.map((t) => t.en?.toLowerCase().trim()).filter(Boolean));
    const newerInLocal = localApproved.filter(
      (t) => t?.en && !bundledKeys.has(t.en.toLowerCase().trim())
    );
    return [...newerInLocal, ...bundledSharedTerms];
  });

  // 2. UPLOADER'S OWN DEVICE TERMS (Works immediately on uploader's own phone/computer, offline or awaiting approval)
  const [myLocalTerms, setMyLocalTerms] = useState<DictionaryTerm[]>(() => {
    let list: DictionaryTerm[] = [];
    try {
      const savedLocal = localStorage.getItem(MY_LOCAL_TERMS_KEY);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        if (Array.isArray(parsed)) list = parsed;
      }
      // Migrate any previously stored device terms from pending or legacy keys
      const savedPending = localStorage.getItem(PENDING_STORAGE_KEY);
      if (savedPending) {
        const parsedPending = JSON.parse(savedPending);
        if (Array.isArray(parsedPending) && parsedPending.length > 0) {
          list = [...parsedPending, ...list];
        }
        localStorage.removeItem(PENDING_STORAGE_KEY);
      }
      const legacyRaw = localStorage.getItem(LEGACY_CUSTOM_KEY);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
          list = [...legacyParsed, ...list];
        }
        localStorage.removeItem(LEGACY_CUSTOM_KEY);
      }
    } catch {
      // ignore
    }

    const mapByEn = new Map<string, DictionaryTerm>();
    for (const item of list) {
      if (item?.en) {
        mapByEn.set(item.en.toLowerCase().trim(), item);
      }
    }
    return Array.from(mapByEn.values());
  });

  // LocalStorage for Favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('maritime_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // LocalStorage for Notes
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('maritime_notes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Email Sync & Pull-to-Refresh State
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(() => getSyncQueue());
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_SYNC_TIME_KEY) || null;
    } catch {
      return null;
    }
  });

  // Pull-to-refresh touch gesture state (Sayfayı aşağı çekerek eşitleme)
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  // Trigger cross-device sync, Service Worker update check, and email queue processing
  const triggerEmailSync = async (showFeedbackIfSent = false) => {
    setIsSyncing(true);
    try {
      // Check for PWA Service Worker & Server Build Version updates automatically without clearing user data
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) =>
            regs.forEach((r) => {
              r.update().catch(() => {});
              if (r.waiting) {
                r.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
            })
          )
          .catch(() => {});
      }

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        fetch(`/api/app-version?t=${Date.now()}`, { cache: 'no-store' })
          .then((res) => (res.ok ? res.json() : null))
          .then(async (verData) => {
            const serverVer = verData?.buildVersion;
            if (!serverVer) return;
            const prevVer = localStorage.getItem(ACTIVE_BUILD_VERSION_KEY);
            if (prevVer && prevVer !== serverVer) {
              localStorage.setItem(ACTIVE_BUILD_VERSION_KEY, serverVer);
              if ('caches' in window) {
                try {
                  const keys = await caches.keys();
                  await Promise.all(
                    keys
                      .filter((k) => k !== 'denizcilik-sozlugu-v30')
                      .map((k) => caches.delete(k))
                  );
                } catch {
                  // ignore
                }
              }
            } else if (!prevVer) {
              localStorage.setItem(ACTIVE_BUILD_VERSION_KEY, serverVer);
            }
          })
          .catch(() => {});
      }

      // 1. Fetch latest globally approved terms & edits from server automatically on startup and on manual/pull sync
      const { approvedTerms } = await fetchServerDictionaryState();
      if (Array.isArray(approvedTerms)) {
        setCustomTerms(approvedTerms);
        // Ensure globally approved edits are never blocked by old local deletion keys or stale local copies
        const approvedKeys = new Set(
          approvedTerms.map((t) => t?.en?.toLowerCase().trim()).filter(Boolean) as string[]
        );
        if (approvedKeys.size > 0) {
          setDeletedCustomKeys((prev) => prev.filter((k) => !approvedKeys.has(k.toLowerCase().trim())));
        }
      }

      // Flush any offline queued bug reports / suggestions
      flushOfflineFeedbackQueue().catch(() => {});

      const nowStr = new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSyncTime(nowStr);
      try {
        localStorage.setItem(LAST_SYNC_TIME_KEY, nowStr);
      } catch {
        // ignore
      }

      setSyncQueue(getSyncQueue());

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (showFeedbackIfSent) {
          setSyncToast('Çevrimdışı mod aktif • Cihazdaki yerel sözlük güncel.');
          setTimeout(() => setSyncToast(null), 4000);
        }
        return;
      }

      const { sentCount, lastError } = await processPendingSyncQueue((updatedQueue) => {
        setSyncQueue([...updatedQueue]);
      });

      if (sentCount > 0 && showFeedbackIfSent) {
        setSyncToast(
          'Eklediğiniz terimler cihazınızda aktif ve genel sözlük onayı için iletildi.'
        );
        setTimeout(() => setSyncToast(null), 5000);
      } else if (lastError && showFeedbackIfSent) {
        setSyncToast(lastError);
        setTimeout(() => setSyncToast(null), 8000);
      } else if (showFeedbackIfSent) {
        setSyncToast(`Son güncellemeler çekildi ve sözlük eşitlendi (${nowStr}).`);
        setTimeout(() => setSyncToast(null), 3500);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Support email approval query fallback if opened directly at root URL
    try {
      const params = new URLSearchParams(window.location.search);
      const emailAction = params.get('emailAction') || params.get('action');
      const key = params.get('key');
      if ((emailAction === 'approve' || emailAction === 'reject') && key === '1923') {
        fetch(`/api/pending-terms/email-action${window.location.search}`)
          .then(() => fetchServerDictionaryState())
          .then(({ approvedTerms }) => {
            if (approvedTerms) setCustomTerms(approvedTerms);
            setSyncToast(
              emailAction === 'approve'
                ? 'Terimler onaylandı ve tüm uygulama için güncellendi!'
                : 'Ekleme genel sözlük için reddedildi.'
            );
            setTimeout(() => setSyncToast(null), 6000);
            window.history.replaceState({}, '', window.location.pathname);
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }

    // Perform latest update & dictionary synchronization on every startup
    triggerEmailSync(false);

    const handleOnline = () => {
      triggerEmailSync(true);
    };

    const handleFocus = () => {
      if (navigator.onLine) {
        triggerEmailSync(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        triggerEmailSync(false);
      }
    };

    const handlePageShow = () => {
      if (navigator.onLine) {
        triggerEmailSync(false);
      }
    };

    // Periodically check for newly approved terms & app updates every 45s while online
    const intervalId = window.setInterval(() => {
      if (navigator.onLine) {
        fetchServerDictionaryState().then(({ approvedTerms }) => {
          if (Array.isArray(approvedTerms)) setCustomTerms(approvedTerms);
        });
      }
    }, 45000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  // Touch Pull-to-Refresh Handlers (Sayfa Çekme Eşitleme)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5 && e.touches.length === 1) {
      setPullStartY(e.touches[0].clientY);
    } else {
      setPullStartY(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY === null) return;
    if (window.scrollY > 5) {
      setPullStartY(null);
      setPullDistance(0);
      return;
    }
    const deltaY = e.touches[0].clientY - pullStartY;
    if (deltaY > 12) {
      setPullDistance(Math.min(95, (deltaY - 12) * 0.55));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 60 && !isSyncing) {
      triggerEmailSync(true);
    }
    setPullStartY(null);
    setPullDistance(0);
  };

  // Theme State ('light' | 'dark') - Defaults to light or stored preference
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('maritime_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // fallback
    }
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('maritime_theme', theme);
    } catch {
      // ignore
    }

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0b1120' : '#0284c7');
    }
    const metaAppleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (metaAppleStatus) {
      metaAppleStatus.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    try {
      localStorage.setItem(APPROVED_STORAGE_KEY, JSON.stringify(customTerms));
    } catch {
      // ignore
    }
  }, [customTerms]);

  useEffect(() => {
    try {
      localStorage.setItem(MY_LOCAL_TERMS_KEY, JSON.stringify(myLocalTerms));
    } catch {
      // ignore
    }
  }, [myLocalTerms]);

  useEffect(() => {
    try {
      localStorage.setItem(DELETED_CUSTOM_TERMS_KEY, JSON.stringify(deletedCustomKeys));
    } catch {
      // ignore
    }
  }, [deletedCustomKeys]);

  useEffect(() => {
    try {
      localStorage.setItem('maritime_favorites', JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem('maritime_notes', JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  // Combined custom & edited terms on this device: Uploader's own local terms/edits + globally approved terms/edits
  const deviceCustomTerms = useMemo(() => {
    const deletedSet = new Set(deletedCustomKeys.map((k) => k.toLowerCase().trim()));
    const mapByEn = new Map<string, DictionaryTerm>();
    const cleanTerm = (item: DictionaryTerm): DictionaryTerm | null => {
      const en = stripAuthorAttribution(item?.en || '');
      const tr = stripAuthorAttribution(item?.tr || '');
      if (!en || !tr) return null;
      return {
        ...item,
        en,
        tr,
        contributorName: item.contributorName ? stripAuthorAttribution(item.contributorName) : undefined,
        sourceFileName: item.sourceFileName ? stripAuthorAttribution(item.sourceFileName) : undefined,
        note: item.note ? stripAuthorAttribution(item.note) : undefined,
      };
    };
    // Globally approved server edits/terms first, then local unapproved device edits/terms
    for (const rawItem of myLocalTerms) {
      const item = cleanTerm(rawItem);
      const k = item?.en?.toLowerCase().trim();
      if (item && k && !deletedSet.has(k)) mapByEn.set(k, item);
    }
    for (const rawItem of customTerms) {
      const item = cleanTerm(rawItem);
      const k = item?.en?.toLowerCase().trim();
      if (item && k && !deletedSet.has(k)) {
        // If server has an approved edit or local doesn't have it, use server approved version
        if (!mapByEn.has(k) || item.isEdited) {
          mapByEn.set(k, item);
        }
      }
    }
    return Array.from(mapByEn.values());
  }, [customTerms, myLocalTerms, deletedCustomKeys]);

  // Combined terms list: Globally approved terms/edits + uploader's own local terms/edits + raw dictionary terms
  const allTerms = useMemo(() => {
    if (deviceCustomTerms.length === 0) return rawTerms;

    const rawByEn = new Map(rawTerms.map((t) => [t.en.toLowerCase().trim(), t]));
    const rawById = new Map(rawTerms.map((t) => [t.id, t]));
    const replacedRawEnSet = new Set<string>();
    const replacedRawIdSet = new Set<string>();

    const mergedCustom = deviceCustomTerms.map((ct) => {
      const lowerEn = ct.en.toLowerCase().trim();
      const lowerOrigEn = ct.originalEn ? ct.originalEn.toLowerCase().trim() : lowerEn;
      const targetId = ct.originalTermId || ct.id;

      replacedRawEnSet.add(lowerEn);
      replacedRawEnSet.add(lowerOrigEn);
      if (targetId) replacedRawIdSet.add(targetId);

      const matchingRaw =
        (targetId ? rawById.get(targetId) : undefined) ||
        rawByEn.get(lowerOrigEn) ||
        rawByEn.get(lowerEn);

      if (!matchingRaw) return ct;

      // If this term was explicitly edited, replace the old definition instead of concatenating
      if (ct.isEdited || ct.sourceFileName === 'Kelime Düzenleme') {
        return {
          ...matchingRaw,
          ...ct,
          id: matchingRaw.id,
          en: ct.en,
          tr: ct.tr,
          category: ct.category || matchingRaw.category,
          firstLetter: ct.firstLetter || ct.en[0].replace(/İ/g, 'I').toUpperCase(),
          isCustom: true,
          isEdited: true,
        };
      }

      return {
        ...ct,
        tr: combineTermMeanings(ct.tr, matchingRaw.tr),
      };
    });

    const remainingRaw = rawTerms.filter(
      (t) => !replacedRawIdSet.has(t.id) && !replacedRawEnSet.has(t.en.toLowerCase().trim())
    );
    return [...mergedCustom, ...remainingRaw];
  }, [deviceCustomTerms]);

  // Reset pagination limit when search or filter changes
  useEffect(() => {
    setDisplayLimit(40);
  }, [searchQuery, searchDirection, activeLetter, activeCategory]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveNote = (termId: string, noteText: string) => {
    setNotes((prev) => ({
      ...prev,
      [termId]: noteText,
    }));
  };

  // Add single term handler -> Works IMMEDIATELY on uploader's own device, and sends email for global approval
  const handleAddSingleTerm = (
    newTermData: Omit<DictionaryTerm, 'id'> & { note?: string; contributorName?: string }
  ): DictionaryTerm => {
    const newId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const batchId = `batch_${Date.now()}`;
    const lowerEnKey = newTermData.en.toLowerCase().trim();
    const existingMatch = allTerms.find((t) => t.en.toLowerCase().trim() === lowerEnKey);
    const mergedTr = existingMatch
      ? combineTermMeanings(existingMatch.tr, newTermData.tr)
      : newTermData.tr;

    const term: DictionaryTerm = {
      id: newId,
      en: newTermData.en,
      tr: mergedTr,
      category: newTermData.category,
      firstLetter: newTermData.firstLetter || newTermData.en[0].toUpperCase(),
      isCustom: true,
      createdAt: new Date().toLocaleDateString('tr-TR'),
      contributorName: newTermData.contributorName,
      sourceFileName: 'Tekil Kelime Ekleme',
      note: newTermData.note,
      batchId,
    };

    if (newTermData.note) {
      setNotes((prev) => ({
        ...prev,
        [newId]: newTermData.note!,
      }));
    }

    // 1. Activate immediately in uploader's own app (works offline & while awaiting approval)
    setDeletedCustomKeys((prev) => prev.filter((k) => k !== lowerEnKey));
    setMyLocalTerms((prev) => {
      const filtered = prev.filter((t) => t.en.toLowerCase().trim() !== lowerEnKey);
      return [term, ...filtered];
    });

    // 2. Submit to pending queue on server + send approval email to owner for global dictionary update
    submitTermsToPendingServer([term], batchId);
    enqueueTermsForEmail({
      type: 'single-term',
      batchId,
      contributorName: newTermData.contributorName,
      sourceFileName: 'Tekil Kelime Ekleme',
      terms: [
        {
          en: term.en,
          tr: term.tr,
          category: term.category,
          note: newTermData.note,
        },
      ],
    });
    setSyncQueue(getSyncQueue());
    triggerEmailSync(false);

    return term;
  };

  // Bulk add terms handler -> Works IMMEDIATELY on uploader's own device, and sends email for global approval
  const handleAddBulkTerms = (
    newTermsList: Array<Omit<DictionaryTerm, 'id'>>,
    overwriteDuplicates = true,
    sourceFileName?: string,
    contributorName?: string
  ): number => {
    const existingLocalEnMap = new Map(myLocalTerms.map((t) => [t.en.toLowerCase().trim(), t]));
    const existingAllEnMap = new Map(allTerms.map((t) => [t.en.toLowerCase().trim(), t]));
    const processed: DictionaryTerm[] = [];
    const batchId = `batch_${Date.now()}`;

    newTermsList.forEach((item) => {
      const cleanEn = item.en.trim();
      const lowerEn = cleanEn.toLowerCase();

      if (existingLocalEnMap.has(lowerEn) && !overwriteDuplicates) {
        return;
      }

      const prevMatch = existingLocalEnMap.get(lowerEn) || existingAllEnMap.get(lowerEn);
      const mergedTr = prevMatch
        ? combineTermMeanings(prevMatch.tr, item.tr.trim())
        : item.tr.trim();

      const term: DictionaryTerm = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        en: cleanEn,
        tr: mergedTr,
        category: item.category,
        firstLetter: item.firstLetter || cleanEn[0].toUpperCase(),
        isCustom: true,
        createdAt: new Date().toLocaleDateString('tr-TR'),
        contributorName,
        sourceFileName: sourceFileName || 'Toplu Sözlük / Excel Yüklemesi',
        batchId,
      };

      processed.push(term);
      existingLocalEnMap.set(lowerEn, term);
      existingAllEnMap.set(lowerEn, term);
    });

    // 1. Activate immediately in uploader's own app (works offline & while awaiting approval)
    const incomingEnSetForDelete = new Set(processed.map((t) => t.en.toLowerCase().trim()));
    setDeletedCustomKeys((prev) => prev.filter((k) => !incomingEnSetForDelete.has(k)));
    setMyLocalTerms((prev) => {
      let next: DictionaryTerm[];
      if (overwriteDuplicates) {
        const incomingEnSet = new Set(processed.map((t) => t.en.toLowerCase().trim()));
        const kept = prev.filter((t) => !incomingEnSet.has(t.en.toLowerCase().trim()));
        next = [...processed, ...kept];
      } else {
        next = [...processed, ...prev];
      }
      return next;
    });

    // 2. Submit to pending queue on server + send approval email to owner for global dictionary update
    if (processed.length > 0) {
      submitTermsToPendingServer(processed, batchId);
      enqueueTermsForEmail({
        type: 'bulk-terms',
        batchId,
        sourceFileName: sourceFileName || 'Toplu Sözlük / Excel Yüklemesi',
        contributorName,
        terms: processed.map((t) => ({
          en: t.en,
          tr: t.tr,
          category: t.category,
        })),
      });
      setSyncQueue(getSyncQueue());
      triggerEmailSync(false);
    }

    return processed.length;
  };

  // Delete custom term from device and server
  const handleDeleteCustomTerm = (id: string) => {
    const targetTerm =
      myLocalTerms.find((t) => t.id === id) ||
      customTerms.find((t) => t.id === id) ||
      deviceCustomTerms.find((t) => t.id === id);
    const targetEn = targetTerm?.en?.toLowerCase().trim();

    setMyLocalTerms((prev) =>
      prev.filter((t) => t.id !== id && (!targetEn || t.en.toLowerCase().trim() !== targetEn))
    );
    setCustomTerms((prev) =>
      prev.filter((t) => t.id !== id && (!targetEn || t.en.toLowerCase().trim() !== targetEn))
    );
    if (targetEn) {
      setDeletedCustomKeys((prev) => (prev.includes(targetEn) ? prev : [...prev, targetEn]));
    }
    setFavorites((prev) => prev.filter((item) => item !== id));
    setNotes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedTerm?.id === id) {
      setSelectedTerm(null);
    }

    fetch('/api/custom-terms/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, en: targetTerm?.en }),
    }).catch(() => {});

    setSyncToast(
      targetTerm?.en
        ? `"${targetTerm.en}" terimi sözlükten silindi.`
        : 'Eklenen terim sözlükten silindi.'
    );
    setTimeout(() => setSyncToast(null), 3500);
  };

  // Edit ANY term in the dictionary (base dictionary term or custom term):
  // Immediately updates on user's device AND sends approval email to update across the entire database once approved
  const handleEditAnyTerm = (
    originalTerm: DictionaryTerm,
    updatedData: { en: string; tr: string; category: string; contributorName?: string }
  ) => {
    const cleanEn = updatedData.en.trim();
    const cleanTr = updatedData.tr.trim();
    const cleanCat = updatedData.category.trim() || originalTerm.category || 'Genel Denizcilik';
    if (!cleanEn || !cleanTr) return;

    const firstChar = cleanEn[0].replace(/İ/g, 'I').toUpperCase();
    const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
    const batchId = `edit_${Date.now()}`;
    const originalTermId = originalTerm.originalTermId || originalTerm.id;
    const originalEn = originalTerm.originalEn || originalTerm.en;
    const originalTr = originalTerm.originalTr || originalTerm.tr;

    const editedTerm: DictionaryTerm = {
      ...originalTerm,
      id: originalTermId,
      en: cleanEn,
      tr: cleanTr,
      category: cleanCat,
      firstLetter,
      isCustom: true,
      isEdited: true,
      originalTermId,
      originalEn,
      originalTr,
      createdAt: new Date().toLocaleDateString('tr-TR'),
      contributorName: updatedData.contributorName || originalTerm.contributorName,
      sourceFileName: 'Kelime Düzenleme',
      batchId,
    };

    const lowerNewEn = cleanEn.toLowerCase();
    const lowerOldEn = originalEn.toLowerCase().trim();

    setDeletedCustomKeys((prev) =>
      prev.filter((k) => k !== lowerNewEn && k !== lowerOldEn)
    );

    setMyLocalTerms((prev) => {
      const filtered = prev.filter(
        (t) =>
          t.id !== originalTerm.id &&
          t.id !== originalTermId &&
          t.en.toLowerCase().trim() !== lowerNewEn &&
          t.en.toLowerCase().trim() !== lowerOldEn
      );
      return [editedTerm, ...filtered];
    });

    if (selectedTerm && (selectedTerm.id === originalTerm.id || selectedTerm.id === originalTermId)) {
      setSelectedTerm(editedTerm);
    }

    // Submit to pending server queue + send approval email to owner so once approved, all databases update
    submitTermsToPendingServer([editedTerm], batchId);
    enqueueTermsForEmail({
      type: 'edit-term',
      batchId,
      contributorName: updatedData.contributorName,
      sourceFileName: 'Kelime Düzenleme',
      terms: [
        {
          en: editedTerm.en,
          tr: editedTerm.tr,
          category: editedTerm.category,
          isEdited: true,
          originalTermId,
          originalEn,
          originalTr,
        },
      ],
    });
    setSyncQueue(getSyncQueue());
    triggerEmailSync(false);

    setSyncToast(
      `"${editedTerm.en}" düzenlemesi kaydedildi ve tüm veritabanında güncellenmesi için onay e-postasına gönderildi.`
    );
    setTimeout(() => setSyncToast(null), 5000);
  };

  // Edit uploader's local custom term on their own device (also routes through approval email)
  const handleEditCustomTerm = (updated: DictionaryTerm) => {
    const existing =
      allTerms.find((t) => t.id === updated.id) ||
      myLocalTerms.find((t) => t.id === updated.id) ||
      updated;
    handleEditAnyTerm(existing, {
      en: updated.en,
      tr: updated.tr,
      category: updated.category,
      contributorName: updated.contributorName,
    });
  };

  // Clear all custom terms on device
  const handleClearAllCustomTerms = () => {
    const allKeys = deviceCustomTerms
      .map((t) => t.en?.toLowerCase().trim())
      .filter(Boolean) as string[];
    setDeletedCustomKeys((prev) => Array.from(new Set([...prev, ...allKeys])));
    setMyLocalTerms([]);
    setCustomTerms([]);
    setSyncToast('Eklenen tüm özel terimler temizlendi.');
    setTimeout(() => setSyncToast(null), 3500);
  };

  // Pre-calculate category counts & available letters over all terms
  const { categoryCounts, availableLetters } = useMemo(() => {
    const catMap: Record<string, number> = {};
    const letSet = new Set<string>();

    for (const item of allTerms) {
      catMap[item.category] = (catMap[item.category] || 0) + 1;
      if (item.firstLetter && item.firstLetter !== '#') {
        letSet.add(item.firstLetter);
      }
    }
    return {
      categoryCounts: catMap,
      availableLetters: Array.from(letSet).sort(),
    };
  }, [allTerms]);

  // Helper to normalize Turkish & English characters (fixes mobile 'İ' -> 'i\u0307' issue)
  const normalizeText = normalizeSearchText;

  // Helper to escape regex special characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Helper to compute relevance score for terms (closest match first)
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

    // 3. Exact word boundary match
    try {
      const boundaryRegex = new RegExp(`(^|[\\s/()[\\]-])(${escapeRegex(normQ)})($|[\\s/()[\\]-])`, 'i');
      if (boundaryRegex.test(enNorm)) {
        return 40000 - Math.min(500, (enNorm.length - normQ.length) * 10);
      }
    } catch {
      // fallback
    }

    // 4. Any token / word starts with query
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

  // Filtered terms (supports both English term name and Turkish meaning, sorted by relevance)
  const filteredTerms = useMemo(() => {
    const rawQuery = searchQuery.trim();
    if (!rawQuery && activeLetter === 'all' && activeCategory === 'all' && !onlyAbbreviations) {
      return allTerms;
    }

    const q = rawQuery.toLowerCase();
    const normalizedQ = normalizeText(rawQuery);

    const matches = allTerms.filter((item) => {
      // Abbreviations filter
      if (onlyAbbreviations && !isMaritimeAbbreviation(item)) {
        return false;
      }

      // Letter filter
      if (activeLetter !== 'all' && item.firstLetter !== activeLetter) {
        return false;
      }

      // Category filter
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      if (!rawQuery) return true;

      const enLower = item.en.toLowerCase();
      const enNorm = normalizeText(item.en);
      if (enLower.includes(q) || enNorm.includes(normalizedQ)) {
        return true;
      }

      const trNorm = normalizeText(item.tr);
      return trNorm.includes(normalizedQ);
    });

    // If there is an active search query, sort by relevance (closest match first)
    if (rawQuery) {
      return matches.sort((a, b) => {
        const scoreA = getRelevanceScore(a, q, normalizedQ);
        const scoreB = getRelevanceScore(b, q, normalizedQ);
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return a.en.localeCompare(b.en, 'en', { sensitivity: 'base' });
      });
    }

    return matches;
  }, [allTerms, searchQuery, activeLetter, activeCategory, onlyAbbreviations]);

  // Visible slice of terms
  const visibleTerms = useMemo(() => {
    return filteredTerms.slice(0, displayLimit);
  }, [filteredTerms, displayLimit]);

  // Favorite terms list
  const favoriteTermsList = useMemo(() => {
    return allTerms.filter((t) => favorites.includes(t.id));
  }, [allTerms, favorites]);

  // Pick random term
  const handleRandomTerm = () => {
    const randomIndex = Math.floor(Math.random() * allTerms.length);
    setSelectedTerm(allTerms[randomIndex]);
  };

  // Next / Previous term inside Detail Modal
  const currentIndexInFiltered = selectedTerm
    ? filteredTerms.findIndex((t) => t.id === selectedTerm.id)
    : -1;

  const handleNextTerm = () => {
    if (currentIndexInFiltered >= 0 && currentIndexInFiltered + 1 < filteredTerms.length) {
      setSelectedTerm(filteredTerms[currentIndexInFiltered + 1]);
    }
  };

  const handlePrevTerm = () => {
    if (currentIndexInFiltered > 0) {
      setSelectedTerm(filteredTerms[currentIndexInFiltered - 1]);
    }
  };

  const handleSelectCategoryFromView = (catName: string) => {
    setActiveCategory(catName);
    setActiveTab('dictionary');
  };

  const handleNavigateToTab = (tab: ActiveTab, initialSearch?: string, category?: string) => {
    if (initialSearch !== undefined) {
      setSearchQuery(initialSearch);
    }
    if (category !== undefined) {
      setActiveCategory(category);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-20 md:pb-8 transition-colors duration-200"
    >
      {/* Pull-to-Refresh (Sayfa Çekme Eşitleme) Indicator Banner */}
      {(pullDistance > 0 || isSyncing) && (
        <div
          style={{ height: isSyncing ? 42 : Math.min(64, pullDistance) }}
          className="w-full bg-cyan-600/95 dark:bg-cyan-900/95 text-white flex items-center justify-center gap-2 text-xs font-semibold overflow-hidden transition-all duration-150 shadow-inner"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              isSyncing || pullDistance >= 60 ? 'animate-spin' : ''
            }`}
          />
          <span>
            {isSyncing
              ? 'Son güncellemeler çekiliyor ve eşitleniyor...'
              : pullDistance >= 60
              ? 'Bırakın, sözlük şimdi eşitlensin'
              : 'Güncellemek ve eşitlemek için aşağı çekin'}
          </span>
        </div>
      )}

      {/* Header with Navigation, Sync Button, and Offline PWA install button */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'add-term') setAddTermInitialMode('manual');
          setActiveTab(tab);
        }}
        favoritesCount={favorites.length}
        customTermsCount={deviceCustomTerms.length}
        totalTermsCount={allTerms.length}
        onOpenInfo={() => setIsInfoOpen(true)}
        onOpenFeedback={() => {
          setFeedbackRelatedTerm('');
          setIsFeedbackOpen(true);
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        onManualSync={() => triggerEmailSync(true)}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-2.5 sm:px-4 py-2.5 sm:py-6 space-y-3 sm:space-y-4 overflow-x-hidden">
        {/* TAB 0: HOME / GİRİŞ SAYFASI & ARAMA MOTORU */}
        {activeTab === 'home' && (
          <HomeView
            terms={allTerms}
            favorites={favorites}
            notes={notes}
            onToggleFavorite={toggleFavorite}
            onSelectTerm={handleSelectTerm}
            onNavigateToTab={handleNavigateToTab}
            customTermsCount={deviceCustomTerms.length}
            recentCustomTerms={deviceCustomTerms}
            onSearchFocusChange={setIsMobileSearchFocused}
            onDeleteCustomTerm={handleDeleteCustomTerm}
            onOpenFeedback={(relatedTerm) => {
              setFeedbackRelatedTerm(relatedTerm || '');
              setIsFeedbackOpen(true);
            }}
            onOpenAddedTermsList={() => {
              setAddTermInitialMode('my-terms');
              setActiveTab('add-term');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* TAB 1: DICTIONARY (Main Search & Terms List) */}
        {activeTab === 'dictionary' && (
          <div className="space-y-2.5 sm:space-y-4">
            {/* Search Bar & Direction Filters (Sticky on mobile when searching so keyboard never covers it) */}
            <div
              className={`${
                isMobileSearchFocused || searchQuery.trim().length > 0
                  ? 'sticky top-0 z-30 shadow-md sm:static sm:shadow-xs'
                  : ''
              } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-4 shadow-xs`}
            >
              <SearchBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchDirection={searchDirection}
                setSearchDirection={setSearchDirection}
                onRandomTerm={handleRandomTerm}
                resultCount={filteredTerms.length}
                totalCount={allTerms.length}
                activeLetter={activeLetter}
                setActiveLetter={setActiveLetter}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                isSearchFocused={isMobileSearchFocused}
                onSearchFocusChange={setIsMobileSearchFocused}
                showMobileFilters={showMobileFilters}
                onToggleMobileFilters={() => setShowMobileFilters((prev) => !prev)}
                onlyAbbreviations={onlyAbbreviations}
                onToggleAbbreviations={() => setOnlyAbbreviations((prev) => !prev)}
              />
            </div>

            {/* Quick Letter Navigation Bar (A to Z) - Hidden on mobile while actively typing search query so 1st matching word is visible right under search bar */}
            <div
              className={`${
                (isMobileSearchFocused || searchQuery.trim().length > 0) && !showMobileFilters
                  ? 'hidden sm:block'
                  : 'block'
              } bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-2xs`}
            >
              <LetterBar
                activeLetter={activeLetter}
                setActiveLetter={setActiveLetter}
                availableLetters={availableLetters}
              />
            </div>

            {/* Category Filter Chips - Hidden on mobile while actively typing search query so 1st matching word is visible right under search bar */}
            <div
              className={
                (isMobileSearchFocused || searchQuery.trim().length > 0) && !showMobileFilters
                  ? 'hidden sm:block'
                  : 'block'
              }
            >
              <CategoryFilter
                activeCategory={activeCategory}
                setActiveCategory={(cat) => {
                  setActiveCategory(cat);
                  setShowMobileFilters(false);
                }}
                categoryCounts={categoryCounts}
              />
            </div>

            {/* Terms List Grid */}
            {visibleTerms.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleTerms.map((term) => (
                    <TermCard
                      key={term.id}
                      term={term}
                      isFavorite={favorites.includes(term.id)}
                      onToggleFavorite={toggleFavorite}
                      onSelectTerm={handleSelectTerm}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                {visibleTerms.length < filteredTerms.length && (
                  <div className="flex justify-center pt-2 pb-4">
                    <button
                      id="load-more-btn"
                      onClick={() => setDisplayLimit((prev) => prev + 40)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 text-cyan-800 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <ChevronDown className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>
                        Daha Fazla Göster ({visibleTerms.length} / {filteredTerms.length})
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Empty Search Results State with Quick Add Term Action */
              <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-xs">
                <Anchor className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Aradığınız kriterlere uygun terim bulunamadı
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Arama kelimesini değiştirebilir veya aradığınız kelimeyi sözlüğe kendiniz ekleyebilirsiniz.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackRelatedTerm(searchQuery.trim());
                        setIsFeedbackOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <span>"{searchQuery.trim()}" Terimini Yöneticiye Bildir</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveLetter('all');
                      setActiveCategory('all');
                      setOnlyAbbreviations(false);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Tüm Filtreleri Temizle
                  </button>

                  <button
                    onClick={() => setActiveTab('add-term')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Bu Terimi Sözlüğe Ekle</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CATEGORIES VIEW */}
        {activeTab === 'categories' && (
          <CategoriesView
            onSelectCategory={handleSelectCategoryFromView}
            categoryCounts={categoryCounts}
            terms={allTerms}
          />
        )}

        {/* TAB 3: FAVORITES VIEW */}
        {activeTab === 'favorites' && (
          <FavoritesView
            favoriteTerms={favoriteTermsList}
            onToggleFavorite={toggleFavorite}
            onSelectTerm={handleSelectTerm}
            onClearAllFavorites={() => setFavorites([])}
            onBackToDictionary={() => setActiveTab('dictionary')}
          />
        )}

        {/* TAB 4: QUIZ / TEST MODE */}
        {activeTab === 'quiz' && (
          <QuizModal
            terms={allTerms}
            onClose={() => setActiveTab('dictionary')}
            onSelectTerm={(term) => handleSelectTerm(term, false)}
          />
        )}

        {/* TAB 5: ADD TERM / EXCEL IMPORT MODE */}
        {activeTab === 'add-term' && (
          <AddTermView
            existingTerms={allTerms}
            customTerms={deviceCustomTerms}
            myLocalTerms={myLocalTerms}
            approvedCustomTerms={customTerms}
            onAddSingleTerm={handleAddSingleTerm}
            onAddBulkTerms={handleAddBulkTerms}
            onDeleteCustomTerm={handleDeleteCustomTerm}
            onEditCustomTerm={handleEditCustomTerm}
            onClearAllCustomTerms={handleClearAllCustomTerms}
            onSelectTermForDetail={setSelectedTerm}
            onBackToDictionary={() => setActiveTab('dictionary')}
            syncQueue={syncQueue}
            onTriggerSync={() => triggerEmailSync(true)}
            initialMode={addTermInitialMode}
          />
        )}
      </main>

      {/* Automatic Email Sync Toast Notification */}
      {syncToast && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-16 md:max-w-md z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-500 flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in">
          <div className="flex items-center gap-2">
            <MailCheck className="w-4 h-4 shrink-0 text-emerald-200" />
            <span>{syncToast}</span>
          </div>
          <button
            onClick={() => setSyncToast(null)}
            className="text-emerald-200 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Scroll to Top Button (Hidden on mobile when keyboard is open) */}
      <button
        id="scroll-to-top-btn"
        onClick={scrollToTop}
        className={`${
          isMobileSearchFocused ? 'hidden md:block' : 'block'
        } fixed bottom-16 md:bottom-4 right-3 md:right-4 z-30 p-2.5 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-100 dark:hover:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 rounded-xl shadow-md transition active:scale-95 cursor-pointer backdrop-blur-xs`}
        title="Sayfa Başına Dön"
      >
        <ArrowUp className="w-4 h-4" />
      </button>

      {/* Mobile Bottom Navigation Bar - Hidden while mobile search keyboard is active so it doesn't cover search results */}
      <nav
        className={`${
          isMobileSearchFocused ? 'hidden' : 'flex'
        } md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1 py-1 items-center justify-around text-[10px] select-none shadow-lg pb-[max(0.35rem,env(safe-area-inset-bottom))]`}
      >
        <button
          id="mobile-nav-home"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition cursor-pointer flex-1 ${
            activeTab === 'home' ? 'text-cyan-700 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="mt-0.5">Giriş</span>
        </button>

        <button
          id="mobile-nav-dictionary"
          onClick={() => setActiveTab('dictionary')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition cursor-pointer flex-1 ${
            activeTab === 'dictionary' ? 'text-cyan-700 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className={`w-5 h-5 ${activeTab === 'dictionary' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="mt-0.5">Sözlük</span>
        </button>

        <button
          id="mobile-nav-categories"
          onClick={() => setActiveTab('categories')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition cursor-pointer flex-1 ${
            activeTab === 'categories' ? 'text-cyan-700 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'categories' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="mt-0.5">Kategori</span>
        </button>

        <button
          id="mobile-nav-favorites"
          onClick={() => setActiveTab('favorites')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition cursor-pointer flex-1 relative ${
            activeTab === 'favorites' ? 'text-cyan-700 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Bookmark className={`w-5 h-5 ${activeTab === 'favorites' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-2 px-1 text-[9px] font-bold rounded-full bg-amber-500 text-white min-w-3.5 text-center leading-3">
                {favorites.length}
              </span>
            )}
          </div>
          <span className="mt-0.5">Kayıtlar</span>
        </button>

        <button
          id="mobile-nav-quiz"
          onClick={() => setActiveTab('quiz')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition cursor-pointer flex-1 ${
            activeTab === 'quiz' ? 'text-cyan-700 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <GraduationCap className={`w-5 h-5 ${activeTab === 'quiz' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="mt-0.5">Test</span>
        </button>

        <button
          id="mobile-nav-add"
          onClick={() => {
            setAddTermInitialMode('manual');
            setActiveTab('add-term');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition cursor-pointer flex-1 relative ${
            activeTab === 'add-term' ? 'text-cyan-700 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <PlusCircle className={`w-5 h-5 ${activeTab === 'add-term' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="mt-0.5">Ekle</span>
        </button>
      </nav>

      {/* Term Detail Modal */}
      {selectedTerm && (
        <TermDetailModal
          term={selectedTerm}
          onClose={() => {
            setSelectedTerm(null);
            setOpenModalInEditMode(false);
          }}
          isFavorite={favorites.includes(selectedTerm.id)}
          onToggleFavorite={toggleFavorite}
          onDeleteCustomTerm={handleDeleteCustomTerm}
          onEditTerm={handleEditAnyTerm}
          initialEditMode={openModalInEditMode}
          onReportTermFeedback={(termLabel) => {
            setSelectedTerm(null);
            setOpenModalInEditMode(false);
            setFeedbackRelatedTerm(termLabel);
            setIsFeedbackOpen(true);
          }}
          onNextTerm={
            currentIndexInFiltered >= 0 && currentIndexInFiltered + 1 < filteredTerms.length
              ? handleNextTerm
              : undefined
          }
          onPrevTerm={currentIndexInFiltered > 0 ? handlePrevTerm : undefined}
          note={notes[selectedTerm.id] || ''}
          onSaveNote={handleSaveNote}
        />
      )}

      {/* Bug Report & Suggestion (Hata / Öneri Gönder) Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        initialRelatedTerm={feedbackRelatedTerm}
        onSuccessToast={(msg) => {
          setSyncToast(msg);
          setTimeout(() => setSyncToast(null), 5000);
        }}
      />

      {/* Info & Offline Guide Modal */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        totalTerms={allTerms.length}
      />

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />
    </div>
  );
}
