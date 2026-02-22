import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS } from './constants';

type Language = 'fr' | 'ht';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['fr']) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('twokaj_lang');
    return (saved as Language) || 'fr';
  });

  useEffect(() => {
    localStorage.setItem('twokaj_lang', language);
  }, [language]);

  const t = (key: keyof typeof TRANSLATIONS['fr']) => {
    return TRANSLATIONS[language][key] || TRANSLATIONS['fr'][key];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
