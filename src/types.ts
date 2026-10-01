export interface DictionaryTerm {
  id: string;
  en: string;
  tr: string;
  category: string;
  firstLetter: string;
  isCustom?: boolean;
  isEdited?: boolean;
  originalTermId?: string;
  originalEn?: string;
  originalTr?: string;
  createdAt?: string;
  contributorName?: string;
  sourceFileName?: string;
  note?: string;
  batchId?: string;
}

export type SearchDirection = 'all' | 'en-tr' | 'tr-en';

export type ActiveTab = 'home' | 'dictionary' | 'categories' | 'favorites' | 'history' | 'quiz' | 'info' | 'add-term';

export const MARITIME_CATEGORIES = [
  'Genel Denizcilik',
  'Seyir ve Navigasyon',
  'Gemi Yapısı ve Güverte Donanımı',
  'Hukuk, Ticaret ve Sigorta',
  'Gemi Makineleri ve Sistemler',
  'Meteoroloji ve Oşinografi',
  'Denizde Emniyet ve Kurtarma',
  'Liman ve Gemi İşletmeciliği',
] as const;

export type MaritimeCategory = typeof MARITIME_CATEGORIES[number];

export interface QuizQuestion {
  term: DictionaryTerm;
  options: string[];
  correctAnswer: string;
  direction: 'en-tr' | 'tr-en';
}

export interface AppSettings {
  speechRate: number;
  fontSize: 'sm' | 'md' | 'lg';
}
