import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Customers — Butler Garage' }

export default function CustomersPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Customers" />
      <div className="p-6">
        <p className="text-gray-400">Customer CRM — coming in Phase B</p>
      </div>
    </div>
  )
}
