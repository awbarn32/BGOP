import type { Language } from '@/types/domain'

export const LANGUAGES: Language[] = ['en', 'th']
export const DEFAULT_LANGUAGE: Language = 'en'

// Bilingual delimiter used in data fields (e.g. "Thai text / English text")
export const BILINGUAL_DELIMITER = ' / '

/**
 * Parse a bilingual data field (e.g. "ชื่อไทย / English Name")
 * and return the portion matching the requested language.
 * Falls back to the full string if delimiter not found.
 */
export function parseBilingual(text: string | null | undefined, lang: Language): string {
  if (!text) return ''
  const parts = text.split(BILINGUAL_DELIMITER)
  if (parts.length < 2) return text
  return lang === 'th' ? parts[0].trim() : parts[1].trim()
}
