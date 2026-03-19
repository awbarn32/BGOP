import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'คำสั่งงาน — Butler Garage' }

export default async function DriverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (!role || !['owner', 'pa', 'driver'].includes(role)) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">คำสั่งงาน</h1>
        <span className="text-sm text-gray-400">Butler Garage</span>
      </header>

      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">มุมมองคนขับ</p>
          <p className="text-sm mt-1">Driver mobile view — coming in Phase D</p>
        </div>
      </div>
    </div>
  )
}
