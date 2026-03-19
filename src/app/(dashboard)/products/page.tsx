import { Header } from '@/components/layout/Header'

export const metadata = { title: 'Products — Butler Garage' }

export default function ProductsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Products" />
      <div className="p-6">
        <p className="text-gray-400">Product catalog — coming in Phase B</p>
      </div>
    </div>
  )
}
