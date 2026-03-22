'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Language } from '@/types/domain'
import { I18nContext, loadLocale, resolveKey } from '@/lib/i18n/useTranslation'

interface I18nProviderProps {
  initialLang: Language
  children: React.ReactNode
}

export function I18nProvider({ initialLang, children }: I18nProviderProps) {
  const [lang, setLangState] = useState<Language>(initialLang)
  const [translations, setTranslations] = useState<Record<string, unknown>>({})

  useEffect(() => {
    loadLocale(lang).then(setTranslations)
  }, [lang])

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang)
    // Persist preference in localStorage so it survives page refreshes
    try { localStorage.setItem('bgop_lang', newLang) } catch { /* ignore */ }
  }, [])

  const t = useCallback((key: string): string => {
    return resolveKey(translations, key) || key
  }, [translations])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}
