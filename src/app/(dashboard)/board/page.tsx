import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Job Board — Butler Garage' }

export default function BoardPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Job Board"
        actions={
          <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
            + New Job
          </button>
        }
      />
      <div className="flex-1 p-6">
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <p className="text-lg font-medium">Kanban Board</p>
            <p className="text-sm mt-1">Coming in Phase C — 5-bucket real-time Kanban</p>
          </div>
        </div>
      </div>
    </div>
  )
}
