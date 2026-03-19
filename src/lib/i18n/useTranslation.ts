'use client'

import { useState, useCallback, createContext, useContext } from 'react'
import type { Language } from '@/types/domain'

// Cached locale data
const localeCache: Partial<Record<Language, Record<string, unknown>>> = {}

async function loadLocale(lang: Language): Promise<Record<string, unknown>> {
  if (localeCache[lang]) return localeCache[lang]!
  const res = await fetch(`/locales/${lang}.json`)
  const data = await res.json()
  localeCache[lang] = data
  return data
}

// ============================================================
// Context
// ============================================================

type I18nContextType = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

export const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function useI18n() {
  return useContext(I18nContext)
}

// ============================================================
// Translation helper — resolves dot-notation keys
// e.g. t('buckets.wip') → "Work in Progress"
// ============================================================

export function resolveKey(translations: Record<string, unknown>, key: string): string {
  const parts = key.split('.')
  let current: unknown = translations

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key
    current = (current as Record<string, unknown>)[part]
  }

  return typeof current === 'string' ? current : key
}

// ============================================================
// Hook for use in client components
// ============================================================

export function useTranslation() {
  const { lang, setLang, t } = useI18n()
  return { lang, setLang, t }
}

export { loadLocale }
