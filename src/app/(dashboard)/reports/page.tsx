import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Reports — Butler Garage' }

export default function ReportsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Reports" />
      <div className="p-6">
        <p className="text-gray-400">EOD summary, AR aging, CSV export — coming in Phase F</p>
      </div>
    </div>
  )
}
