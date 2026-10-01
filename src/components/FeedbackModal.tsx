import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquarePlus,
  Send,
  Bug,
  Lightbulb,
  Edit3,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { FeedbackSubmission, sendUserFeedbackEmail } from '../utils/emailSync';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRelatedTerm?: string;
  onSuccessToast?: (msg: string) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  initialRelatedTerm = '',
  onSuccessToast,
}) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackSubmission['feedbackType']>(
    initialRelatedTerm ? 'term-correction' : 'suggestion'
  );
  const [senderName, setSenderName] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [relatedTerm, setRelatedTerm] = useState(initialRelatedTerm);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRelatedTerm(initialRelatedTerm || '');
      if (initialRelatedTerm) {
        setFeedbackType('term-correction');
      }
      setStatusMessage(null);
    }
  }, [isOpen, initialRelatedTerm]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setStatusMessage({
        type: 'error',
        text: 'Lütfen iletmek istediğiniz hata veya öneri mesajını yazın.',
      });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      const res = await sendUserFeedbackEmail({
        feedbackType,
        senderName: senderName.trim() || undefined,
        senderContact: senderContact.trim() || undefined,
        relatedTerm: relatedTerm.trim() || undefined,
        message: trimmedMsg,
      });

      if (res.ok) {
        const successText =
          res.message || 'Mesajınız başarıyla e-posta olarak iletildi. Teşekkür ederiz!';
        setStatusMessage({ type: 'success', text: successText });
        setMessage('');
        onSuccessToast?.(successText);
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Gönderim sırasında bir hata oluştu, lütfen tekrar deneyin.',
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  const typeOptions: Array<{
    id: FeedbackSubmission['feedbackType'];
    label: string;
    icon: React.ElementType;
  }> = [
    { id: 'suggestion', label: 'Öneri / İstek', icon: Lightbulb },
    { id: 'bug', label: 'Hata Bildirimi', icon: Bug },
    { id: 'term-correction', label: 'Terim Düzeltme', icon: Edit3 },
    { id: 'other', label: 'Genel Görüş', icon: MessageCircle },
  ];

  return (
    <div
      id="feedback-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-700 dark:text-cyan-400 shrink-0">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Hata / Öneri Gönder
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Yazdığınız mesaj doğrudan geliştiriciye e-posta olarak iletilir
              </p>
            </div>
          </div>

          <button
            id="feedback-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Bildirim Türü Seçin
            </label>
            <div className="grid grid-cols-2 gap-2">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = feedbackType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFeedbackType(opt.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-400'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-cyan-600 dark:text-cyan-400'}`} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Related Term (Optional or Pre-filled) */}
          <div className="space-y-1">
            <label
              htmlFor="feedback-related-term"
              className="block font-bold text-slate-700 dark:text-slate-300"
            >
              İlgili Kelime / Konu <span className="font-normal text-slate-400">(İsteğe Bağlı)</span>
            </label>
            <input
              id="feedback-related-term"
              type="text"
              value={relatedTerm}
              onChange={(e) => setRelatedTerm(e.target.value)}
              placeholder="Örn: Starboard, Seyir terimi veya uygulama özelliği..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
            />
          </div>

          {/* Message Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="feedback-message-input"
                className="block font-bold text-slate-700 dark:text-slate-300"
              >
                Mesajınız / Açıklamanız <span className="text-rose-500">*</span>
              </label>
            </div>

            <textarea
              id="feedback-message-input"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Karşılaştığınız hatayı, düzeltilmesini istediğiniz kelimeyi veya uygulama için önerinizi buraya yazın..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 leading-relaxed"
            />
          </div>

          {/* Optional Sender Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label
                htmlFor="feedback-sender-name"
                className="block font-bold text-slate-700 dark:text-slate-300"
              >
                Adınız <span className="font-normal text-slate-400">(İsteğe Bağlı)</span>
              </label>
              <input
                id="feedback-sender-name"
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Örn: Kpt. Ahmet Yılmaz"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-600"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="feedback-sender-contact"
                className="block font-bold text-slate-700 dark:text-slate-300"
              >
                E-posta / İletişim <span className="font-normal text-slate-400">(İsteğe Bağlı)</span>
              </label>
              <input
                id="feedback-sender-contact"
                type="text"
                value={senderContact}
                onChange={(e) => setSenderContact(e.target.value)}
                placeholder="Geri dönüş isterseniz yazabilirsiniz"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-600"
              />
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Submit Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition cursor-pointer"
            >
              Vazgeç
            </button>

            <button
              id="feedback-submit-btn"
              type="submit"
              disabled={isSending}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white rounded-xl font-bold transition cursor-pointer shadow-sm active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Gönderiliyor...' : 'Mail Olarak Gönder'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
