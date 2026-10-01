import React from 'react';
import {
  Compass,
  Anchor,
  Scale,
  Cog,
  CloudRain,
  LifeBuoy,
  Building2,
  Book,
} from 'lucide-react';

interface CategoryFilterProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  categoryCounts: Record<string, number>;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  setActiveCategory,
  categoryCounts,
}) => {
  const categories = [
    { id: 'all', label: 'Tüm Konular', icon: Book },
    { id: 'Seyir ve Navigasyon', label: 'Seyir & Navigasyon', icon: Compass },
    { id: 'Gemi Yapısı ve Güverte Donanımı', label: 'Gemi Yapısı & Güverte', icon: Anchor },
    { id: 'Hukuk, Ticaret ve Sigorta', label: 'Hukuk, Ticaret & Sigorta', icon: Scale },
    { id: 'Gemi Makineleri ve Sistemler', label: 'Makineler & Sistemler', icon: Cog },
    { id: 'Meteoroloji ve Oşinografi', label: 'Meteoroloji & Oşinografi', icon: CloudRain },
    { id: 'Denizde Emniyet ve Kurtarma', label: 'Emniyet & Kurtarma', icon: LifeBuoy },
    { id: 'Liman ve Gemi İşletmeciliği', label: 'Liman & İşletmecilik', icon: Building2 },
    { id: 'Genel Denizcilik', label: 'Genel Denizcilik', icon: Book },
  ];

  return (
    <div className="w-full max-w-full py-0.5">
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-1.5">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeCategory === cat.id;
          const count = cat.id === 'all'
            ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
            : (categoryCounts[cat.id] || 0);

          return (
            <button
              key={cat.id}
              id={`cat-filter-${cat.id.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => setActiveCategory(cat.id)}
              className={`${
                cat.id === 'all' ? 'col-span-2 sm:col-span-1 justify-center sm:justify-start' : 'justify-between sm:justify-start'
              } min-w-0 flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer border active:scale-95 ${
                isSelected
                  ? 'bg-cyan-50 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-200 border-cyan-400 dark:border-cyan-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="text-left leading-tight break-words">{cat.label}</span>
              </div>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                    isSelected
                      ? 'bg-cyan-200/80 dark:bg-cyan-800/80 text-cyan-900 dark:text-cyan-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
