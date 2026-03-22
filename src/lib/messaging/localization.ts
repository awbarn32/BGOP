export type MessageLocalization = {
  source_language: 'th' | 'en' | 'unknown'
  text_en: string | null
  text_th: string | null
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function isLocalizationReady(localization: MessageLocalization | null | undefined) {
  if (!localization) return false

  if (localization.source_language === 'en') {
    return hasText(localization.text_th) && normalize(localization.text_th) !== normalize(localization.text_en)
  }

  if (localization.source_language === 'th') {
    return hasText(localization.text_en) && normalize(localization.text_en) !== normalize(localization.text_th)
  }

  return hasText(localization.text_en) && hasText(localization.text_th)
}

export function getLocalizationStatus(localization: MessageLocalization | null | undefined) {
  if (!localization) return 'missing' as const
  return isLocalizationReady(localization) ? ('ready' as const) : ('source_only' as const)
}
