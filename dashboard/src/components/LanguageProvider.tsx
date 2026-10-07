'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/lib/i18n';

type Language = 'fr' | 'ar';

interface LanguageContextType {
  lang: Language;
  t: (key: keyof typeof translations.fr) => string;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'fr',
  t: (key) => translations.fr[key],
  toggleLanguage: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>('fr');

  useEffect(() => {
    const saved = localStorage.getItem('app_language') as Language;
    if (saved === 'fr' || saved === 'ar') {
      setLang(saved);
    }
  }, []);

  const toggleLanguage = () => {
    const newLang = lang === 'fr' ? 'ar' : 'fr';
    setLang(newLang);
    localStorage.setItem('app_language', newLang);
  };

  const t = (key: keyof typeof translations.fr) => {
    return translations[lang][key] || translations.fr[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLanguage }}>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className={lang === 'ar' ? 'font-arabic' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};
