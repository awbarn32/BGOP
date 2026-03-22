import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import type { UserRole } from '@/types/domain'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

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
    .select('full_name')
    .eq('id', user.id)
    .single()

  const profile = profileData as { full_name: string } | null
  const userName = profile?.full_name ?? user.email ?? 'User'

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar role={role} userName={userName} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav role={role} />
    </div>
  )
}
