'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types/domain'

const MOBILE_NAV_ITEMS = [
  { href: '/board', label: 'Board', icon: '⬜', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/jobs', label: 'Jobs', icon: '🔧', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/customers', label: 'Customers', icon: '👤', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/invoices', label: 'Invoices', icon: '📄', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/reports', label: 'Reports', icon: '📊', roles: ['owner', 'pa'] as UserRole[] },
]

interface MobileNavProps {
  role: UserRole
}

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname()
  const visibleItems = MOBILE_NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex bg-gray-900 border-t border-gray-800 md:hidden">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
