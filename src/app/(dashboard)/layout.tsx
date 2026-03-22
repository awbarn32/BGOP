import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { I18nProvider } from '@/components/providers/I18nProvider'
import type { UserRole, Language } from '@/types/domain'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = (user.app_metadata?.role ?? 'mechanic') as UserRole

  // Only owner and PA can access dashboard routes
  if (role !== 'owner' && role !== 'pa') {
    if (role === 'mechanic') redirect('/mechanic')
    if (role === 'driver') redirect('/driver')
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('users')
    .select('full_name, preferred_language')
    .eq('id', user.id)
    .single()

  const profile = profileData as { full_name: string; preferred_language: string } | null
  const userName = profile?.full_name ?? user.email ?? 'User'
  const preferredLang = (profile?.preferred_language ?? 'en') as Language

  return (
    <I18nProvider initialLang={preferredLang}>
      {/* F2: h-screen overflow-hidden keeps the sidebar fixed and main scrollable */}
      <div className="flex h-screen overflow-hidden bg-gray-950">
        {/* Desktop sidebar — fixed height, scrolls internally if nav overflows */}
        <div className="hidden md:flex flex-shrink-0">
          <Sidebar role={role} userName={userName} />
        </div>

        {/* Main content — takes remaining width, scrolls independently */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav role={role} />
      </div>
    </I18nProvider>
  )
}
