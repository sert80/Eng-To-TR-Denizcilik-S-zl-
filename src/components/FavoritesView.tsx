import React, { useState } from 'react';
import { Bookmark, Download, Trash2, Search, BookOpen } from 'lucide-react';
import { DictionaryTerm } from '../types';
import { TermCard } from './TermCard';

interface FavoritesViewProps {
  favoriteTerms: DictionaryTerm[];
  onToggleFavorite: (id: string) => void;
  onSelectTerm: (term: DictionaryTerm, openInEditMode?: boolean) => void;
  onClearAllFavorites: () => void;
  onBackToDictionary: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favoriteTerms,
  onToggleFavorite,
  onSelectTerm,
  onClearAllFavorites,
  onBackToDictionary,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filtered = favoriteTerms.filter(
    (t) =>
      t.en.toLowerCase().includes(filterQuery.toLowerCase()) ||
      t.tr.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleExportText = () => {
    if (favoriteTerms.length === 0) return;
    const content = favoriteTerms
      .map((t, idx) => `${idx + 1}. ${t.en} = ${t.tr} [${t.category}]`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `denizcilik_favori_terimler_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-500">
            <Bookmark className="w-5 h-5 fill-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Kaydedilen Terimler</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {favoriteTerms.length} adet favori denizcilik terimi kaydedildi
            </p>
          </div>
        </div>

        {favoriteTerms.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              id="export-favorites-btn"
              onClick={handleExportText}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Metin dosyası (.txt) olarak indir"
            >
              <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Dışa Aktar (.txt)</span>
            </button>

            <button
              id="clear-favorites-btn"
              onClick={() => {
                if (window.confirm('Tüm favori terimleri silmek istediğinize emin misiniz?')) {
                  onClearAllFavorites();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Tüm favorileri temizle"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Temizle</span>
            </button>
          </div>
        )}
      </div>

      {favoriteTerms.length > 0 ? (
        <>
          {/* Search within favorites */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Kaydedilenler içinde filtrele..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-600 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-600/20 shadow-2xs"
            />
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((term) => (
              <TermCard
                key={term.id}
                term={term}
                isFavorite={true}
                onToggleFavorite={onToggleFavorite}
                onSelectTerm={onSelectTerm}
                searchQuery={filterQuery}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs">
              Arama kriterinize uyan kaydedilmiş terim bulunamadı.
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-xs">
          <Bookmark className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Henüz Kayıtlı Terim Yok</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Sözlükte gezinirken veya arama yaparken terim kartlarındaki kitap ayracı butonuna dokunarak önemli bulduğunuz terimleri buraya ekleyebilirsiniz.
          </p>
          <button
            onClick={onBackToDictionary}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer mt-2 shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Sözlüğe Dön</span>
          </button>
        </div>
      )}
    </div>
  );
};
