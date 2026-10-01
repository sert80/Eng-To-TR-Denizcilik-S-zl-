import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  ArrowRight,
  Volume2,
} from 'lucide-react';
import { DictionaryTerm } from '../types';
import { speakMaritimeText } from '../utils/speech';

interface QuizModalProps {
  terms: DictionaryTerm[];
  onClose: () => void;
  onSelectTerm: (term: DictionaryTerm) => void;
}

interface Question {
  term: DictionaryTerm;
  questionText: string;
  correctAnswer: string;
  options: string[];
  direction: 'en-tr' | 'tr-en';
}

export const QuizModal: React.FC<QuizModalProps> = ({
  terms,
  onClose,
  onSelectTerm,
}) => {
  const [direction, setDirection] = useState<'en-tr' | 'tr-en'>('en-tr');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Generate 10 quiz questions
  const generateQuiz = (selectedDir: 'en-tr' | 'tr-en') => {
    if (terms.length < 10) return;

    // Shuffle terms copy
    const shuffled = [...terms].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);

    const generated: Question[] = selected.map((item) => {
      const isEnToTr = selectedDir === 'en-tr';
      const questionText = isEnToTr ? item.en : item.tr;
      const correctAnswer = isEnToTr ? item.tr : item.en;

      // 3 wrong distractors from other terms in same or general category
      const otherTerms = terms.filter((t) => t.id !== item.id);
      const distractorsShuffled = otherTerms.sort(() => 0.5 - Math.random()).slice(0, 3);
      const wrongOptions = distractorsShuffled.map((t) => (isEnToTr ? t.tr : t.en));

      const allOptions = [correctAnswer, ...wrongOptions].sort(() => 0.5 - Math.random());

      return {
        term: item,
        questionText,
        correctAnswer,
        options: allOptions,
        direction: selectedDir,
      };
    });

    setQuestions(generated);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
  };

  useEffect(() => {
    generateQuiz(direction);
  }, [direction]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);

    if (option === currentQ.correctAnswer) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleSpeak = (text: string, lang: 'en' | 'tr') => {
    speakMaritimeText(text, { lang });
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Quiz Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Denizcilik Terim Testi</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {terms.length.toLocaleString('tr-TR')} çevrimdışı terim arasından bilginizi sınayın
            </p>
          </div>
        </div>

        {/* Direction Switcher with flags */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setDirection('en-tr')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
              direction === 'en-tr' ? 'bg-cyan-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🇬🇧 EN</span>
            <span>→</span>
            <span>🇹🇷 TR</span>
          </button>
          <button
            onClick={() => setDirection('tr-en')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
              direction === 'tr-en' ? 'bg-cyan-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🇹🇷 TR</span>
            <span>→</span>
            <span>🇬🇧 EN</span>
          </button>
        </div>
      </div>

      {/* Quiz Body */}
      {isFinished ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-5 animate-in zoom-in-95 duration-200 shadow-xs transition-colors">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-500 flex items-center justify-center mx-auto shadow-xs">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Test Tamamlandı!</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              10 sorudan <strong className="text-cyan-700 dark:text-cyan-400 font-bold">{score}</strong> tanesini doğru bildiniz.
            </p>
          </div>

          <div className="inline-block px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Başarı Oranı: %{score * 10}
            {score >= 8 ? ' ⚓ Harika Kaptan!' : score >= 5 ? ' 👍 İyi Seviye' : ' 🧭 Pratik Yapmaya Devam'}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => generateQuiz(direction)}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Yeni Test Başlat</span>
            </button>
          </div>
        </div>
      ) : currentQ ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs transition-colors">
          {/* Progress bar and counter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-cyan-800 dark:text-cyan-300">
                Soru {currentIndex + 1} / {questions.length}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Skor: {score} Doğru</span>
            </div>

            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-600 transition-all duration-300 rounded-full"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Text */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>{currentQ.direction === 'en-tr' ? '🇬🇧' : '🇹🇷'}</span>
                <span>{currentQ.direction === 'en-tr' ? 'Bu İngilizce terimin Türkçe anlamı nedir?' : 'Bu Türkçe terimin İngilizcesi nedir?'}</span>
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium">
                {currentQ.term.category}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                {currentQ.questionText}
              </p>
              {currentQ.direction === 'en-tr' && (
                <button
                  onClick={() => handleSpeak(currentQ.questionText, 'en')}
                  className="p-2 text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                  title="Sesli Dinle"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="space-y-2.5">
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentQ.correctAnswer;

              let btnClass = 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-2xs';
              if (isAnswered) {
                if (isCorrect) {
                  btnClass = 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 font-semibold';
                } else if (isSelected) {
                  btnClass = 'bg-rose-50 dark:bg-rose-950/70 border-rose-400 dark:border-rose-600 text-rose-900 dark:text-rose-200 font-semibold';
                } else {
                  btnClass = 'bg-slate-50 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-60';
                }
              }

              return (
                <button
                  key={idx}
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(option)}
                  className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition cursor-pointer flex items-center justify-between gap-3 ${btnClass}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </div>

                  {isAnswered && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  {isAnswered && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Next Button / Explanation when answered */}
          {isAnswered && (
            <div className="pt-2 flex items-center justify-between animate-in fade-in">
              <button
                onClick={() => onSelectTerm(currentQ.term)}
                className="text-xs text-cyan-700 dark:text-cyan-400 hover:underline cursor-pointer font-semibold"
              >
                Terim detayını gör →
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <span>{currentIndex + 1 === questions.length ? 'Sonuçları Gör' : 'Sonraki Soru'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
