'use client'

import { useTranslation } from '@/lib/i18n/useTranslation'

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  const { lang, setLang } = useTranslation()

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-gray-800 bg-gray-900">
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
          className="px-3 py-1 text-xs font-medium rounded-md border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          title="Toggle language"
        >
          {lang === 'en' ? 'ภาษาไทย' : 'English'}
        </button>

        {actions}
      </div>
    </header>
  )
}
