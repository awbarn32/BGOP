'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types/domain'
import { useTranslation } from '@/lib/i18n/useTranslation'

const NAV_ITEMS = [
  { href: '/board',      key: 'nav.board',      icon: '⬜', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/customers',  key: 'nav.customers',  icon: '👤', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/vehicles',   key: 'nav.vehicles',   icon: '🏍️', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/invoices',   key: 'nav.invoices',   icon: '📄', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/approvals',  key: 'nav.approvals',  icon: '✅', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/products',   key: 'nav.products',   icon: '📦', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/discounts',  key: 'nav.discounts',  icon: '🏷️', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/reminders',  key: 'nav.reminders',  icon: '🔔', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/templates',  key: 'nav.templates',  icon: '📋', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/expenses',   key: 'nav.expenses',   icon: '💰', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/messages',   key: 'nav.messages',   icon: '💬', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/reports',    key: 'nav.reports',    icon: '📊', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/intake-qr',  key: 'nav.intake_qr',  icon: '📲', roles: ['owner', 'pa'] as UserRole[] },
]

// Fallback labels if translations haven't loaded yet
const FALLBACK: Record<string, string> = {
  'nav.board': 'Job Board', 'nav.customers': 'Customers', 'nav.vehicles': 'Vehicles',
  'nav.invoices': 'Invoices', 'nav.approvals': 'Approvals', 'nav.products': 'Products',
  'nav.discounts': 'Discounts', 'nav.reminders': 'Reminders', 'nav.templates': 'Templates',
  'nav.expenses': 'Expenses', 'nav.messages': 'Messages', 'nav.reports': 'Reports',
  'nav.intake_qr': 'Intake QR',
}

interface SidebarProps {
  role: UserRole
  userName: string
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const { lang, setLang, t } = useTranslation()
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)

  // Poll pending approvals count for owner badge
  useEffect(() => {
    if (role !== 'owner' && role !== 'pa') return
    function fetchCount() {
      fetch('/api/approvals')
        .then((r) => r.ok ? r.json() : null)
        .then((j) => {
          if (j?.data) {
            const count = (j.data as Array<{ status: string }>).filter((i) => i.status === 'pending_owner_approval').length
            setPendingApprovalsCount(count)
          }
        })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60_000) // refresh every 60s
    return () => clearInterval(interval)
  }, [role])

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside className="flex flex-col w-64 h-full bg-gray-900 border-r border-gray-800 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <span className="text-xl font-bold text-white">Butler Garage</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const label = t(item.key) !== item.key ? t(item.key) : (FALLBACK[item.key] ?? item.key)
          const showBadge = item.href === '/approvals' && pendingApprovalsCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="bg-amber-700 text-amber-100 text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User info + language toggle + logout */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-gray-400">
              {t(`roles.${role}`) !== `roles.${role}` ? t(`roles.${role}`) : role}
            </p>
          </div>
        </div>

        {/* Language toggle */}
        <div className="flex gap-1.5 mb-3">
          <button
            onClick={() => setLang('en')}
            className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors ${
              lang === 'en'
                ? 'bg-indigo-700 text-white'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang('th')}
            className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors ${
              lang === 'th'
                ? 'bg-indigo-700 text-white'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            ไทย
          </button>
        </div>

        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full text-left text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {t('nav.logout') !== 'nav.logout' ? t('nav.logout') : 'Log out'}
          </button>
        </form>
      </div>
    </aside>
  )
}
