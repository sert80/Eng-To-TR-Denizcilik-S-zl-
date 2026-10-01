import React, { useState } from 'react';
import {
  X,
  WifiOff,
  Smartphone,
  CheckCircle,
  Volume2,
  Bookmark,
  GraduationCap,
  FileSpreadsheet,
  ShieldCheck,
  Globe,
  Copy,
  Check,
  Share2,
} from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalTerms: number;
}

const PUBLIC_SHARED_URL = 'https://ais-pre-7sbz2ibmvwsz6fomhdotnl-813985089670.europe-west2.run.app';

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  totalTerms,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const activeUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : PUBLIC_SHARED_URL;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText( PUBLIC_SHARED_URL );
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Denizcilik Sözlüğü (İngilizce - Türkçe)',
          text: `${totalTerms.toLocaleString('tr-TR')} terimli çevrimdışı İngilizce-Türkçe Denizcilik Sözlüğü:`,
          url: PUBLIC_SHARED_URL,
        });
      } catch {
        // user cancelled share
      }
    } else {
      handleCopyUrl();
    }
  };

  return (
    <div
      id="info-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/60 shadow-xs shrink-0">
              <img
                src="/anchor-icon.jpg"
                alt="Çapa İkonu"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Denizcilik Sözlüğü Hakkında</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Web Adresi & Çevrimdışı (Offline) PWA Rehberi</p>
            </div>
          </div>

          <button
            id="info-close-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {/* Public Web Link & Share Box */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Globe className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>Paylaşılabilir Web Adresi</span>
              </div>
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-bold transition cursor-pointer"
              >
                <Share2 className="w-3 h-3" />
                <span>Paylaş</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-mono text-[11px] text-cyan-700 dark:text-cyan-300 truncate flex-1 select-all">
                {PUBLIC_SHARED_URL}
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold shrink-0 cursor-pointer transition"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400">Kopyalandı</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Kopyala</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ayrıca proje içine <strong>Vercel</strong> (<code>vercel.json</code>), <strong>Netlify</strong> (<code>netlify.toml</code>) ve <strong>Render</strong> (<code>render.yaml</code>) ücretsiz yayınlama ayar dosyaları eklenmiştir. Sağ üstteki <strong>GitHub</strong> ikonuyla kodu aktarıp <em>vercel.com</em>, <em>netlify.com</em> veya <em>render.com</em> üzerinden ücretsiz özel alan adıyla (örn. <code>denizcilik-sozlugu.vercel.app</code>) yayınlayabilirsiniz. (Aktif adres: <code className="text-[10px]">{activeUrl}</code>)
            </p>
          </div>

          {/* Offline Highlight Banner */}
          <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-950 dark:text-cyan-100 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sm text-cyan-900 dark:text-cyan-200">
              <WifiOff className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
              <span>%100 İnternetsiz Çalışma Garantisi</span>
            </div>
            <p className="text-xs text-cyan-900/90 dark:text-cyan-200/90 leading-relaxed">
              Bu uygulama, sağlanan çevrilmiş denizcilik sözlüğündeki tüm <strong>{totalTerms.toLocaleString('tr-TR')} terimi</strong> cihazınızın yerel hafızasına kaydeder. Açık denizde, okyanusta veya hücresel şebekenin çekmediği yerlerde hiçbir internet bağlantısı olmadan anında çalışır.
            </p>
          </div>

          {/* Security & Auto-Sync Banner */}
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-900 dark:text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Güvenlik Kalkanı & Otomatik Eşitleme Aktif</span>
            </div>
            <ul className="text-xs text-emerald-900/90 dark:text-emerald-200/90 space-y-1 list-disc pl-4">
              <li>
                <strong>Her Açılışta ve Sayfa Çekmede Eşitleme:</strong> Uygulama her açıldığında ve ekranı parmağınızla aşağı çektiğinizde (veya üstteki <em>Eşitle</em> butonuna dokunduğunuzda) son güncellemeler otomatik çekilir.
              </li>
              <li>
                <strong>Çok Katmanlı Güvenlik:</strong> XSS/Script enjeksiyon engelleme, Excel/CSV formül enjeksiyon koruması, API hız sınırı (Rate Limiting), HTTP güvenlik başlıkları (CSP/Nosniff) ve e-posta onay doğrulaması aktiftir.
              </li>
            </ul>
          </div>

          {/* Installation Instructions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Telefona Nasıl Yüklenir?</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-900 dark:text-white text-xs block">Android (Chrome)</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Tarayıcınızın sağ üstündeki <strong>üç nokta (⋮)</strong> menüsünden <strong>"Uygulamayı Yükle"</strong> veya <strong>"Ana Ekrana Ekle"</strong> diyerek kurabilirsiniz.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-900 dark:text-white text-xs block">iPhone & iPad (Safari)</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Safari'nin altındaki <strong>Paylaş</strong> ikonuna dokunun ve <strong>"Ana Ekrana Ekle"</strong> deyin.
                </p>
              </div>
            </div>
          </div>

          {/* Key Capabilities */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Öne Çıkan Özellikler
            </h4>

            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Giriş Sayfası & Arama Motoru:</strong> Ana sayfadaki güçlü arama motoruna kelime yazdığınız an terimin karşılığı, anlamı ve sesli telaffuzu anında görünür.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Çift Yönlü Anlık Arama:</strong> İngilizce'den Türkçe'ye veya Türkçe açıklamadan İngilizce terime anında arama yapın.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <Volume2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Çevrimdışı Sesli Telaffuz:</strong> İnternet olmadan cihazınızın yerleşik konuşma senteziyle İngilizce telaffuzu dinleyin.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <Bookmark className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Favoriler ve Notlar:</strong> Sık baktığınız terimleri yıldızlayın, kendi vardiya/ders notlarınızı ekleyin ve dışa aktarın.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Excel & Elle Terim Ekleme:</strong> Excel (.xlsx, .csv) dosyalarını yükleyerek veya tek tek form doldurarak sözlüğe kendi terimlerinizi ekleyebilir, düzenleyebilir ve yedekleyebilirsiniz.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <GraduationCap className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Denizcilik Testi:</strong> Terimleri pekiştirmek için 10 soruluk interaktif çoktan seçmeli test çözün.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 flex justify-end">
          <button
            id="info-ok-btn"
            onClick={onClose}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
