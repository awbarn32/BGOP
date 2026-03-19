'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types/domain'

const NAV_ITEMS = [
  { href: '/board', label: 'Job Board', icon: '⬜', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/jobs', label: 'Jobs', icon: '🔧', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/customers', label: 'Customers', icon: '👤', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/vehicles', label: 'Vehicles', icon: '🏍️', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/invoices', label: 'Invoices', icon: '📄', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/products', label: 'Products', icon: '📦', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/templates', label: 'Templates', icon: '📋', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/expenses', label: 'Expenses', icon: '💰', roles: ['owner', 'pa'] as UserRole[] },
  { href: '/reports', label: 'Reports', icon: '📊', roles: ['owner', 'pa'] as UserRole[] },
]

interface SidebarProps {
  role: UserRole
  userName: string
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gray-900 border-r border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <span className="text-xl font-bold text-white">Butler Garage</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
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
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-gray-400 capitalize">{role}</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full text-left text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </aside>
  )
}
