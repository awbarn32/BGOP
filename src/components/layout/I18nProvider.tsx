'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { I18nContext, resolveKey, loadLocale } from '@/lib/i18n/useTranslation'
import { DEFAULT_LANGUAGE } from '@/lib/i18n/config'
import type { Language } from '@/types/domain'

interface I18nProviderProps {
  children: ReactNode
  initialLang?: Language
}

export function I18nProvider({ children, initialLang = DEFAULT_LANGUAGE }: I18nProviderProps) {
  const [lang, setLangState] = useState<Language>(initialLang)
  const [translations, setTranslations] = useState<Record<string, unknown>>({})

  useEffect(() => {
    loadLocale(lang).then(setTranslations)
  }, [lang])

  function setLang(newLang: Language) {
    setLangState(newLang)
    if (typeof window !== 'undefined') {
      document.cookie = `preferred_lang=${newLang};path=/;max-age=31536000`
    }
  }

  function t(key: string): string {
    return resolveKey(translations, key)
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}
