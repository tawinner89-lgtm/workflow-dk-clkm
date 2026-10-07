'use client';

import React from 'react';
import { useLanguage } from './LanguageProvider';
import { Globe } from 'lucide-react';

export const LanguageSwitcher = () => {
  const { lang, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium transition"
    >
      <Globe className="w-4 h-4" />
      {lang === 'fr' ? 'FR' : 'عربية'}
    </button>
  );
};
