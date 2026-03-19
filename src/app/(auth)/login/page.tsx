import { LoginForm } from '@/components/auth/LoginForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/types/domain'

const ROLE_LANDING: Record<UserRole, string> = {
  owner: '/board',
  pa: '/board',
  mechanic: '/mechanic',
  driver: '/driver',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = (user.app_metadata?.role ?? 'mechanic') as UserRole
    redirect(searchParams.next ?? ROLE_LANDING[role] ?? '/board')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Butler Garage</h1>
          <p className="mt-2 text-sm text-gray-400">Operations Platform</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
