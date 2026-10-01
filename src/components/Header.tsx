import React, { useEffect, useState } from 'react';
import {
  Anchor,
  Bookmark,
  BookOpen,
  Compass,
  GraduationCap,
  Download,
  HelpCircle,
  PlusCircle,
  Home,
  Sun,
  Moon,
  RefreshCw,
  ShieldCheck,
  MessageSquarePlus,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  favoritesCount: number;
  customTermsCount: number;
  totalTermsCount: number;
  onOpenInfo: () => void;
  onOpenFeedback?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  favoritesCount,
  customTermsCount,
  totalTermsCount,
  onOpenInfo,
  onOpenFeedback,
  theme,
  onToggleTheme,
  onManualSync,
  isSyncing = false,
  lastSyncTime,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      onOpenInfo();
    }
  };

  return (
    <header className="md:sticky md:top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
        {/* Mobile & Desktop Header Top Area */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveTab('home')}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform overflow-hidden shrink-0 cursor-pointer"
          >
            <img
              src="/anchor-icon.jpg"
              alt="Denizcilik Sözlüğü Çapa İkonu"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Right of Logo: Full-width 2-row block on mobile, single-row split on desktop */}
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
            {/* Title & Desktop Subtitle */}
            <div
              onClick={() => setActiveTab('home')}
              className="cursor-pointer min-w-0"
            >
              {/* Row 1 on mobile: Full unobstructed width for "Denizcilik Sözlüğü" */}
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight whitespace-nowrap">
                  Denizcilik Sözlüğü
                </h1>
                <span className="hidden sm:inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 shrink-0">
                  {totalTermsCount.toLocaleString('tr-TR')} Terim
                </span>
              </div>

              {/* Desktop-only subtitle row */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Güvenli</span>
                </span>
                {lastSyncTime && (
                  <span className="truncate text-slate-400 dark:text-slate-500">
                    • Son Eşitleme: {lastSyncTime}
                  </span>
                )}
              </div>
            </div>

            {/* Row 2 on mobile (Badges on left + Action buttons on right) / Right side on desktop */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2">
              {/* Mobile Badges (Left side of Row 2) */}
              <div
                onClick={() => setActiveTab('home')}
                className="flex sm:hidden items-center gap-1.5 min-w-0 cursor-pointer"
              >
                <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 shrink-0 leading-none">
                  {totalTermsCount.toLocaleString('tr-TR')} Terim
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium shrink-0 leading-none">
                  <ShieldCheck className="w-3 h-3 shrink-0" />
                  <span>Güvenli</span>
                </span>
              </div>

              {/* Quick Action Buttons (Right side of Row 2 on mobile, Right side of Header on desktop) */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {onManualSync && (
                  <button
                    id="sync-now-btn"
                    onClick={onManualSync}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-1.5 w-7 h-7 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 text-xs font-semibold transition cursor-pointer active:scale-95 disabled:opacity-60"
                    title="Son güncellemeleri çek ve sözlüğü eşitle"
                    aria-label="Sözlüğü Eşitle"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                    <span className="hidden md:inline">
                      {isSyncing ? 'Eşitleniyor...' : 'Eşitle'}
                    </span>
                  </button>
                )}

                {!isInstalled && (
                  <button
                    id="install-pwa-btn"
                    onClick={handleInstallClick}
                    className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                    title="Uygulamayı Cihaza Yükle (İnternetsiz Kullanım)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Uygulamayı Yükle</span>
                  </button>
                )}

                {/* Light / Dark Mode Toggle Button */}
                <button
                  id="theme-toggle-btn"
                  onClick={onToggleTheme}
                  className="flex items-center justify-center gap-1.5 w-7 h-7 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer active:scale-95"
                  title={theme === 'dark' ? 'Gündüz (Açık) Moduna Geç' : 'Gece (Koyu) Moduna Geç'}
                  aria-label="Tema Değiştir"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                      <span className="hidden lg:inline text-xs font-semibold">Gündüz</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />
                      <span className="hidden lg:inline text-xs font-semibold">Gece</span>
                    </>
                  )}
                </button>

                {onOpenFeedback && (
                  <button
                    id="header-feedback-btn"
                    onClick={onOpenFeedback}
                    className="flex items-center justify-center gap-1 w-7 h-7 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/70 text-xs font-semibold transition cursor-pointer active:scale-95"
                    title="Hata veya Öneri Gönder (E-posta ile iletilir)"
                    aria-label="Hata veya Öneri Gönder"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span className="hidden md:inline">Hata / Öneri</span>
                  </button>
                )}

                <button
                  id="info-guide-btn"
                  onClick={onOpenInfo}
                  className="flex items-center justify-center w-7 h-7 sm:w-auto sm:h-auto sm:p-2 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  title="Güvenlik, Çevrimdışı Kullanım ve Kurulum Rehberi"
                  aria-label="Kurulum Rehberi"
                >
                  <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop & Tablet Navigation Tabs (Hidden on small mobile screens where bottom nav is used) */}
        <nav className="hidden md:flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            id="tab-home"
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'home'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Giriş</span>
          </button>

          <button
            id="tab-dictionary"
            onClick={() => setActiveTab('dictionary')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'dictionary'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Sözlük</span>
          </button>

          <button
            id="tab-categories"
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Kategoriler</span>
          </button>

          <button
            id="tab-favorites"
            onClick={() => setActiveTab('favorites')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Kayıtlı</span>
            {favoritesCount > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                  activeTab === 'favorites'
                    ? 'bg-white text-cyan-700'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                }`}
              >
                {favoritesCount}
              </span>
            )}
          </button>

          <button
            id="tab-quiz"
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Terim Testi</span>
          </button>

          <button
            id="tab-add-term"
            onClick={() => setActiveTab('add-term')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ml-auto ${
              activeTab === 'add-term'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Terim / Liste Ekle</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
