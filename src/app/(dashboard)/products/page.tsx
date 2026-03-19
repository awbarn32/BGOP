'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProductForm } from '@/components/products/ProductForm'
import { useToast } from '@/components/ui/Toast'
import type { Product, ProductCategory } from '@/types/domain'

const CATEGORIES: { value: ProductCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'parts', label: 'Parts' },
  { value: 'labour', label: 'Labour' },
  { value: 'service_package', label: 'Service Packages' },
]

export default function ProductsPage() {
  const { toast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<ProductCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deactivating, setDeactivating] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      active: showInactive ? 'all' : 'true',
      ...(category !== 'all' && { category }),
      ...(search && { search }),
      pageSize: '100',
    })
    try {
      const res = await fetch(`/api/products?${params}`)
      const json = await res.json()
      setProducts(json.data ?? [])
    } catch {
      toast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }, [category, search, showInactive, toast])

  useEffect(() => {
    const t = setTimeout(fetchProducts, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchProducts, search])

  async function handleDeactivate(product: Product) {
    if (!confirm(`Deactivate "${product.name}"? It will no longer appear on job forms.`)) return
    setDeactivating(product.id)
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('Product deactivated', 'success')
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch {
      toast('Failed to deactivate product', 'error')
    } finally {
      setDeactivating(null)
    }
  }

  async function handleReactivate(product: Product) {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })
      if (!res.ok) throw new Error()
      toast('Product reactivated', 'success')
      fetchProducts()
    } catch {
      toast('Failed to reactivate product', 'error')
    }
  }

  function onCreateSuccess(product: Product) {
    setCreateOpen(false)
    setProducts((prev) => [product, ...prev])
  }

  function onEditSuccess(updated: Product) {
    setEditProduct(null)
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  const formatThb = (n: number | null) =>
    n == null ? '—' : `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const categoryLabel = (c: ProductCategory) =>
    ({ parts: 'Parts', labour: 'Labour', service_package: 'Service Package' })[c]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Products"
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            + Add Product
          </Button>
        }
      />

      {/* Filters */}
      <div className="px-6 pt-4 pb-2 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                category === c.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search by name..."
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-200">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>

        {!loading && (
          <span className="text-xs text-gray-500 ml-auto">{products.length} products</span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="No products found"
            description={search ? `No results for "${search}"` : 'Add your first product to get started.'}
            action={
              !search ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  + Add Product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium text-gray-400 whitespace-nowrap">SKU</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Name</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Category</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Unit</th>
                <th className="text-right py-2 pr-4 font-medium text-gray-400 whitespace-nowrap">Cost</th>
                <th className="text-right py-2 pr-4 font-medium text-gray-400 whitespace-nowrap">Sale</th>
                <th className="text-left py-2 font-medium text-gray-400">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className={`group hover:bg-gray-800/50 transition-colors ${!p.active ? 'opacity-50' : ''}`}
                >
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-400 whitespace-nowrap">{p.sku}</td>
                  <td className="py-2.5 pr-4">
                    <div className="text-white font-medium">
                      {p.name.includes(' / ') ? p.name.split(' / ')[1] : p.name}
                    </div>
                    {p.name.includes(' / ') && (
                      <div className="text-xs text-gray-500">{p.name.split(' / ')[0]}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-xs text-gray-400">
                      {categoryLabel(p.category)}
                      {p.subcategory && ` · ${p.subcategory.replace(/_/g, ' ')}`}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-400 capitalize">{p.unit}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-300 whitespace-nowrap font-mono text-xs">
                    {formatThb(p.cost_price)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-white whitespace-nowrap font-mono text-xs">
                    {formatThb(p.sale_price)}
                  </td>
                  <td className="py-2.5">
                    {p.active ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditProduct(p)}>
                        Edit
                      </Button>
                      {p.active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          loading={deactivating === p.id}
                          onClick={() => handleDeactivate(p)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-400 hover:text-emerald-300"
                          onClick={() => handleReactivate(p)}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Product" size="lg">
        <ProductForm onSuccess={onCreateSuccess} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={!!editProduct} onClose={() => setEditProduct(null)} title="Edit Product" size="lg">
        {editProduct && (
          <ProductForm
            product={editProduct}
            onSuccess={onEditSuccess}
            onCancel={() => setEditProduct(null)}
          />
        )}
      </Modal>
    </div>
  )
}
