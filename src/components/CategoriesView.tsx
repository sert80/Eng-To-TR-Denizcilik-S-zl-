import React, { useState } from 'react';
import {
  Compass,
  Anchor,
  Scale,
  Cog,
  CloudRain,
  LifeBuoy,
  Building2,
  Book,
  ArrowRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import { DictionaryTerm } from '../types';

interface CategoriesViewProps {
  onSelectCategory: (categoryName: string) => void;
  categoryCounts: Record<string, number>;
  terms: DictionaryTerm[];
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  onSelectCategory,
  categoryCounts,
  terms,
}) => {
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');

  const categoryDefs = [
    {
      id: 'Seyir ve Navigasyon',
      title: 'Seyir ve Navigasyon',
      shortDesc: 'Pusula, kerteriz, harita ve rota',
      description: 'Pusula, kerteriz, astronomi, seyrüsefer, harita ve rota tayini ile ilgili teknik terimler.',
      icon: Compass,
      color: 'from-blue-600 to-indigo-700',
      sample: 'Dead Reckoning, Gyro, Azimuth',
    },
    {
      id: 'Gemi Yapısı ve Güverte Donanımı',
      title: 'Gemi Yapısı ve Güverte Donanımı',
      shortDesc: 'Omurga, kemere, ırgat, donanım',
      description: 'Omurga, kemere, posta, bumba, halatlar, ırgat, demir donanımı ve tekne yapı elemanları.',
      icon: Anchor,
      color: 'from-cyan-600 to-blue-700',
      sample: 'Keel, Bulkhead, Windlass, Davit',
    },
    {
      id: 'Hukuk, Ticaret ve Sigorta',
      title: 'Hukuk, Ticaret ve Sigorta',
      shortDesc: 'Konişmento, navlun, sigorta, charter',
      description: 'Konişmento, navlun, charter sözleşmeleri, deniz sigortası, müşterek avarya ve deniz hukuku.',
      icon: Scale,
      color: 'from-amber-600 to-yellow-700',
      sample: 'Bill of Lading, Charter Party',
    },
    {
      id: 'Gemi Makineleri ve Sistemler',
      title: 'Gemi Makineleri ve Sistemler',
      shortDesc: 'Ana makine, kazan, türbin, tulumba',
      description: 'Ana makine, kazan, türbin, seperatör, tulumba, pervaneler ve tahrik sistemleri.',
      icon: Cog,
      color: 'from-purple-600 to-pink-700',
      sample: 'Propeller, Bilge Pump, Boiler',
    },
    {
      id: 'Meteoroloji ve Oşinografi',
      title: 'Meteoroloji ve Oşinografi',
      shortDesc: 'Rüzgarlar, fırtına, dalga, akıntı',
      description: 'Rüzgarlar, fırtınalar, dalga boyları, akıntılar, gelgit olayları ve deniz atmosferi.',
      icon: CloudRain,
      color: 'from-sky-600 to-cyan-700',
      sample: 'Beaufort Scale, Cyclone, Swell',
    },
    {
      id: 'Denizde Emniyet ve Kurtarma',
      title: 'Denizde Emniyet ve Kurtarma',
      shortDesc: 'SOLAS, filika, can salı, tahlisiye',
      description: 'SOLAS, can filikaları, can salları, yangınla mücadele, tehlike sinyalleri ve tahlisiye.',
      icon: LifeBuoy,
      color: 'from-rose-600 to-red-700',
      sample: 'Lifeboat, Mayday, EPIRB',
    },
    {
      id: 'Liman ve Gemi İşletmeciliği',
      title: 'Liman ve Gemi İşletmeciliği',
      shortDesc: 'Rıhtım, doklama, kılavuzluk, palamar',
      description: 'Rıhtım, doklama, kılavuzluk, palamar, yanaşma manevraları ve gemi personeli yönetimi.',
      icon: Building2,
      color: 'from-emerald-600 to-teal-700',
      sample: 'Pilotage, Berth, Mooring, Tug',
    },
    {
      id: 'Genel Denizcilik',
      title: 'Genel Denizcilik',
      shortDesc: 'Deniz gelenekleri, temel terimler',
      description: 'Deniz gelenekleri, temel deniz terimleri ve genel denizcilik jargonu.',
      icon: Book,
      color: 'from-slate-600 to-slate-700',
      sample: 'Abeam, Aft, Port, Starboard',
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4 max-w-5xl mx-auto w-full">
      {/* Üst Bilgi ve Görünüm Değiştirici */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs transition-colors flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Denizcilik Uzmanlık Alanları</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 font-bold border border-cyan-200 dark:border-cyan-800">
              8 Kategori
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sözlükteki {terms.length.toLocaleString('tr-TR')} terim uzmanlık alanına göre gruplandırılmıştır.
          </p>
        </div>

        {/* Görünüm Seçici (Kompakt / Detaylı) */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode('compact')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'compact'
                ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Kompakt Izgara Görünümü"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="text-[11px]">Kompakt</span>
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'detailed'
                ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Detaylı Liste Görünümü"
          >
            <List className="w-3.5 h-3.5" />
            <span className="text-[11px]">Detaylı</span>
          </button>
        </div>
      </div>

      {/* KOMPAKT IZGARA MODU (Mobilde 2 sütun, kategori adları tam görünür ve kesilmez) */}
      {viewMode === 'compact' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {categoryDefs.map((cat) => {
            const Icon = cat.icon;
            const count = categoryCounts[cat.id] || 0;

            return (
              <div
                key={cat.id}
                id={`cat-card-${cat.id.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => onSelectCategory(cat.id)}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/90 border border-slate-200 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-600 rounded-xl p-2.5 sm:p-3.5 transition-all duration-150 cursor-pointer group flex flex-col justify-between shadow-2xs active:scale-[0.98] min-w-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr ${cat.color} flex items-center justify-center text-white shadow-2xs shrink-0`}>
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-cyan-800 dark:text-cyan-300 border border-slate-200 dark:border-slate-700 shrink-0">
                      {count.toLocaleString('tr-TR')}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors leading-snug break-words">
                    {cat.title}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-tight">
                    {cat.shortDesc}
                  </p>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-cyan-700 dark:text-cyan-400 font-semibold">
                  <span>Terimleri Gör</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DETAYLI LİSTE MODU */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categoryDefs.map((cat) => {
            const Icon = cat.icon;
            const count = categoryCounts[cat.id] || 0;

            return (
              <div
                key={cat.id}
                id={`cat-card-${cat.id.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => onSelectCategory(cat.id)}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3.5 sm:p-4 transition-all duration-150 cursor-pointer group flex flex-col justify-between shadow-2xs min-w-0"
              >
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${cat.color} flex items-center justify-center text-white shadow-xs shrink-0`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors leading-snug break-words">
                        {cat.title}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-slate-100 dark:bg-slate-800 text-cyan-800 dark:text-cyan-300 border border-slate-200 dark:border-slate-700 shrink-0">
                      {count.toLocaleString('tr-TR')} Terim
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px] sm:max-w-xs font-mono">
                    Örn: {cat.sample}
                  </span>
                  <span className="text-cyan-700 dark:text-cyan-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform shrink-0">
                    <span>Terimleri Gör</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
