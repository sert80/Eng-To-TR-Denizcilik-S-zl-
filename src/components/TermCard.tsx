import React, { useState } from 'react';
import { Volume2, Bookmark, Check, Copy, ExternalLink, Edit2 } from 'lucide-react';
import { DictionaryTerm } from '../types';
import { speakMaritimeText } from '../utils/speech';
import { extractMaritimeSources, isMaritimeAbbreviation } from '../utils/security';

interface TermCardProps {
  term: DictionaryTerm;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onSelectTerm: (term: DictionaryTerm, openInEditMode?: boolean) => void;
  searchQuery?: string;
}

export const TermCard: React.FC<TermCardProps> = ({
  term,
  isFavorite,
  onToggleFavorite,
  onSelectTerm,
  searchQuery,
}) => {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const sources = extractMaritimeSources(term.tr);
  const isAbbr = isMaritimeAbbreviation(term);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${term.en} = ${term.tr}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakMaritimeText(term.en, {
      lang: 'en',
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(term.id);
  };

  // Helper to highlight search query matches safely
  const highlightMatch = (text: string, query?: string) => {
    if (!query || query.trim().length === 0) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-cyan-100 dark:bg-cyan-900/70 text-cyan-800 dark:text-cyan-200 px-0.5 rounded font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Clean category color mapper
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
    <article
      id={`term-card-${term.id}`}
      onClick={() => onSelectTerm(term)}
      className="group relative bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3 sm:p-4 transition-all duration-200 shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between gap-2 min-w-0"
    >
      <div className="min-w-0">
        {/* Top Header Row: Category Badge & Quick Actions */}
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border leading-tight break-words ${getCategoryBadgeClass(
                term.category
              )}`}
            >
              {term.category}
            </span>
            {term.isCustom && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                Özel Terim
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 opacity-90 group-hover:opacity-100 transition shrink-0">
            {/* Audio Pronunciation */}
            <button
              id={`speak-btn-${term.id}`}
              onClick={handleSpeak}
              className={`p-1 sm:p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
                speaking ? 'text-cyan-700 dark:text-cyan-400 animate-pulse bg-cyan-50 dark:bg-cyan-950/80' : ''
              }`}
              title="İngilizce Telaffuz Dinle (Çevrimdışı)"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>

            {/* Edit Button */}
            <button
              id={`edit-btn-${term.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTerm(term, true);
              }}
              className="p-1 sm:p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Bu Kelimeyi Düzenle"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {/* Copy Button */}
            <button
              id={`copy-btn-${term.id}`}
              onClick={handleCopy}
              className="p-1 sm:p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Kopyala"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Favorite Bookmark */}
            <button
              id={`fav-btn-${term.id}`}
              onClick={handleFavorite}
              className={`p-1 sm:p-1.5 rounded-lg transition cursor-pointer ${
                isFavorite
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60'
                  : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isFavorite ? 'Kaydedilenlerden Çıkar' : 'Kaydet'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* English Term with UK Flag */}
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-wide group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm shrink-0" role="img" aria-label="İngilizce">🇬🇧</span>
            <span className="break-words">{highlightMatch(term.en, searchQuery)}</span>
          </span>
          <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition shrink-0" />
        </h3>

        {/* Turkish Translation & Explanation with TR Flag */}
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal flex items-start gap-1.5">
          <span className="text-xs mt-0.5 shrink-0" role="img" aria-label="Türkçe">🇹🇷</span>
          <span className="break-words">{highlightMatch(term.tr, searchQuery)}</span>
        </p>
      </div>

      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <span className="font-mono text-slate-400 dark:text-slate-500 truncate">#{term.id}</span>
          {isAbbr && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                Kısaltma
              </span>
            </>
          )}
          {sources.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 truncate">
                {sources.join(' / ')}
              </span>
            </>
          )}
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition font-medium shrink-0">
          Detay, düzenle & not al →
        </span>
      </div>
    </article>
  );
};
