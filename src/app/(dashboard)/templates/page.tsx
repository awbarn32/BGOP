import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Job Templates — Butler Garage' }

export default function TemplatesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Job Templates" />
      <div className="p-6">
        <p className="text-gray-400">Canned job templates — coming in Phase B</p>
      </div>
    </div>
  )
}
