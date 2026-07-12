'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadPreferences, savePreferences } from '@/lib/preferences'
import { translate, type LanguageCode } from '@/lib/i18n'

interface LanguageContextValue {
  lang: LanguageCode
  setLang: (code: LanguageCode) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
})

/**
 * Provides the active UI language (persisted in preferences) and a `t()`
 * translator. Wraps the app so any component can call useTranslation().
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>('en')

  useEffect(() => {
    const p = loadPreferences()
    setLangState((p.language as LanguageCode) || 'en')
    if (typeof document !== 'undefined') {
      document.documentElement.lang = (p.language as string) || 'en'
    }
    const onPrefs = () => {
      const code = (loadPreferences().language as LanguageCode) || 'en'
      setLangState(code)
      if (typeof document !== 'undefined') document.documentElement.lang = code
    }
    window.addEventListener('autinerary:prefs', onPrefs)
    window.addEventListener('storage', onPrefs)
    return () => {
      window.removeEventListener('autinerary:prefs', onPrefs)
      window.removeEventListener('storage', onPrefs)
    }
  }, [])

  const setLang = useCallback((code: LanguageCode) => {
    setLangState(code)
    savePreferences({ language: code })
    if (typeof document !== 'undefined') document.documentElement.lang = code
  }, [])

  const t = useCallback((key: string) => translate(lang, key), [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  return useContext(LanguageContext)
}
