import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/domain'

const ROLE_LANDING: Record<UserRole, string> = {
  owner: '/board',
  pa: '/board',
  mechanic: '/mechanic',
  driver: '/driver',
}

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = (user.app_metadata?.role ?? 'mechanic') as UserRole
  redirect(ROLE_LANDING[role] ?? '/board')
}
