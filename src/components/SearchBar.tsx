import React, { useRef, useEffect } from 'react';
import { Search, X, Shuffle, SlidersHorizontal } from 'lucide-react';
import { SearchDirection } from '../types';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchDirection: SearchDirection;
  setSearchDirection: (direction: SearchDirection) => void;
  onRandomTerm: () => void;
  resultCount: number;
  totalCount: number;
  activeLetter: string;
  setActiveLetter: (letter: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  isSearchFocused?: boolean;
  onSearchFocusChange?: (focused: boolean) => void;
  showMobileFilters?: boolean;
  onToggleMobileFilters?: () => void;
  onlyAbbreviations?: boolean;
  onToggleAbbreviations?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  onRandomTerm,
  resultCount,
  totalCount,
  activeLetter,
  setActiveLetter,
  activeCategory,
  setActiveCategory,
  isSearchFocused = false,
  onSearchFocusChange,
  showMobileFilters = false,
  onToggleMobileFilters,
  onlyAbbreviations = false,
  onToggleAbbreviations,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  const hasActiveFilters =
    searchQuery !== '' || activeLetter !== 'all' || activeCategory !== 'all' || onlyAbbreviations;
  const hasCategoryOrLetterFilter =
    activeLetter !== 'all' || activeCategory !== 'all' || onlyAbbreviations;


  const scrollSearchToTop = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const targetTop = window.scrollY + rect.top - 6;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isSearchFocused) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const handleViewportResize = () => {
      scrollSearchToTop();
    };
    vv.addEventListener('resize', handleViewportResize);
    return () => vv.removeEventListener('resize', handleViewportResize);
  }, [isSearchFocused]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    onSearchFocusChange?.(true);
    setTimeout(scrollSearchToTop, 60);
    setTimeout(scrollSearchToTop, 250);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      onSearchFocusChange?.(false);
    }, 180);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setActiveLetter('all');
    setActiveCategory('all');
    if (onlyAbbreviations && onToggleAbbreviations) {
      onToggleAbbreviations();
    }
  };

  return (
    <div ref={containerRef} className="w-full space-y-2">
      {/* Search Input and Quick Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>

          <input
            ref={inputRef}
            id="dictionary-search-input"
            type="search"
            enterKeyHint="search"
            value={searchQuery}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              scrollSearchToTop();
            }}
            placeholder="🇬🇧 İngilizce veya 🇹🇷 Türkçe terim arayın..."
            className="w-full pl-9 pr-9 py-2 sm:py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-600 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-600/20 transition shadow-xs"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />

          {searchQuery && (
            <button
              id="clear-search-btn"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              title="Aramayı temizle"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mobile Filter Toggle Button (shows/hides A-Z & Category filters when searching on mobile) */}
        {onToggleMobileFilters && (
          <button
            type="button"
            onClick={onToggleMobileFilters}
            className={`sm:hidden flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer shrink-0 ${
              showMobileFilters || hasCategoryOrLetterFilter
                ? 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-200 border-cyan-400 dark:border-cyan-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
            title="Harf ve Kategori Filtrelerini Aç/Kapat"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Filtre</span>
          </button>
        )}

        {/* Abbreviations Quick Filter Button */}
        {onToggleAbbreviations && (
          <button
            id="abbreviations-filter-btn"
            type="button"
            onClick={onToggleAbbreviations}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer shrink-0 shadow-xs ${
              onlyAbbreviations
                ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border-slate-300 dark:border-slate-700'
            }`}
            title="Yalnızca Denizcilik Kısaltmalarını (Abbreviations) Göster"
          >
            <span>Kısaltmalar</span>
          </button>
        )}

        {/* Random Term Button */}
        <button
          id="random-term-btn"
          type="button"
          onClick={onRandomTerm}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-cyan-700 dark:text-cyan-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 shadow-xs"
          title="Rastgele bir denizcilik terimi aç"
        >
          <Shuffle className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="hidden sm:inline">Rastgele</span>
        </button>
      </div>

      {/* Dictionary Info & Result Summary */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] sm:text-xs">
        {/* En -> Tr Mode Badge with Flags (compact on mobile, hidden when keyboard is open to keep 1st result visible) */}
        <div className={`${isSearchFocused ? 'hidden sm:flex' : 'flex'} items-center gap-1.5 bg-slate-50 dark:bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold shadow-2xs`}>
          <span>🇬🇧</span>
          <span>İngilizce</span>
          <span className="text-slate-400 dark:text-slate-500 font-bold">→</span>
          <span>🇹🇷</span>
          <span>Türkçe</span>
          {activeCategory !== 'all' && (
            <span className="text-cyan-700 dark:text-cyan-300 font-bold truncate max-w-[130px] sm:max-w-none">
              • {activeCategory}
            </span>
          )}
        </div>

        {/* Results Counter & Reset Filter */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-slate-500 dark:text-slate-400 ml-auto">
          <span>
            <strong className="text-cyan-700 dark:text-cyan-400 font-bold">{resultCount.toLocaleString('tr-TR')}</strong>
            <span className="mx-1">/</span>
            <span>{totalCount.toLocaleString('tr-TR')} terim</span>
          </span>

          {hasActiveFilters && (
            <button
              id="reset-filters-btn"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={resetFilters}
              className="text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-0.5 font-semibold"
            >
              <X className="w-3 h-3" />
              <span>Temizle</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
