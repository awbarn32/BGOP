import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Vehicles — Butler Garage' }

export default function VehiclesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Vehicles" />
      <div className="p-6">
        <p className="text-gray-400">Vehicle registry — coming in Phase B</p>
      </div>
    </div>
  )
}
