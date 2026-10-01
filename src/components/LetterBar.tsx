import React from 'react';

interface LetterBarProps {
  activeLetter: string;
  setActiveLetter: (letter: string) => void;
  availableLetters: string[];
}

export const LetterBar: React.FC<LetterBarProps> = ({
  activeLetter,
  setActiveLetter,
  availableLetters,
}) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-1">
      <div className="flex items-center gap-1 min-w-max">
        <button
          id="letter-all-btn"
          onClick={() => setActiveLetter('all')}
          className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeLetter === 'all'
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-2xs'
          }`}
        >
          Tümü (A-Z)
        </button>

        {alphabet.map((letter) => {
          const isAvailable = availableLetters.includes(letter);
          const isSelected = activeLetter === letter;

          return (
            <button
              key={letter}
              id={`letter-btn-${letter}`}
              disabled={!isAvailable}
              onClick={() => setActiveLetter(letter)}
              className={`w-7 h-7 text-xs font-bold rounded-lg transition flex items-center justify-center cursor-pointer ${
                isSelected
                  ? 'bg-cyan-600 text-white shadow-xs scale-105'
                  : isAvailable
                  ? 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50 border border-slate-100 dark:border-slate-800/40'
              }`}
              title={isAvailable ? `${letter} harfi ile başlayan terimler` : `${letter} harfinde terim yok`}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
};
