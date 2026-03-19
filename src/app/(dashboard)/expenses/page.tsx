import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Expenses — Butler Garage' }

export default function ExpensesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Expenses" />
      <div className="p-6">
        <p className="text-gray-400">Expense tracking — coming in Phase B</p>
      </div>
    </div>
  )
}
