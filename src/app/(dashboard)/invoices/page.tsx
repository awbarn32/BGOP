import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Invoices — Butler Garage' }

export default function InvoicesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Invoices" />
      <div className="p-6">
        <p className="text-gray-400">Invoice management & AR aging — coming in Phase F</p>
      </div>
    </div>
  )
}
