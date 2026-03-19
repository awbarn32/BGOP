import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Jobs — Butler Garage' }

export default function JobsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Jobs" />
      <div className="p-6">
        <p className="text-gray-400">Job list — coming in Phase C</p>
      </div>
    </div>
  )
}
