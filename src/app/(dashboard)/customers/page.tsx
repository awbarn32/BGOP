'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { CustomerForm } from '@/components/customers/CustomerForm'
import { useToast } from '@/components/ui/Toast'
import type { Customer, AcquisitionSource } from '@/types/domain'

const SOURCE_LABELS: Record<AcquisitionSource, string> = {
  word_of_mouth: 'Word of Mouth',
  seo: 'SEO',
  chatgpt: 'ChatGPT',
  walk_in: 'Walk-in',
  referral: 'Referral',
  social_media: 'Social Media',
  repeat: 'Repeat',
  other: 'Other',
}

export default function CustomersPage() {
  const { toast } = useToast()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dormantFilter, setDormantFilter] = useState<'' | 'false' | 'true'>('false')
  const [total, setTotal] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '100' })
    if (search) params.set('search', search)
    if (dormantFilter) params.set('dormant', dormantFilter)

    try {
      const res = await fetch(`/api/customers?${params}`)
      const json = await res.json()
      setCustomers(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast('Failed to load customers', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, dormantFilter, toast])

  useEffect(() => {
    const t = setTimeout(fetchCustomers, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchCustomers, search])

  function onCreateSuccess(customer: Customer) {
    setCreateOpen(false)
    setCustomers((prev) => [customer, ...prev])
    setTotal((n) => n + 1)
  }

  function onEditSuccess(updated: Customer) {
    setEditCustomer(null)
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  const tabs: { value: '' | 'false' | 'true'; label: string }[] = [
    { value: 'false', label: 'Active' },
    { value: 'true', label: 'Dormant' },
    { value: '', label: 'All' },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Customers"
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            + Add Customer
          </Button>
        }
      />

      {/* Filters */}
      <div className="px-6 pt-4 pb-2 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setDormantFilter(t.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dormantFilter === t.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search name, phone, email, LINE ID..."
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {!loading && (
          <span className="text-xs text-gray-500 ml-auto">{total} customers</span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            description={search ? `No results for "${search}"` : 'Add your first customer to get started.'}
            action={
              !search ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  + Add Customer
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Name</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Contact</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Language</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Source</th>
                <th className="text-left py-2 font-medium text-gray-400">Messaging</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {customers.map((c) => (
                <tr key={c.id} className="group hover:bg-gray-800/50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-white font-medium hover:text-indigo-300 transition-colors"
                    >
                      {c.full_name}
                    </Link>
                    {c.dormant && (
                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-400">
                        Dormant
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="space-y-0.5">
                      {c.phone && <div className="text-gray-300 text-xs">{c.phone}</div>}
                      {c.line_id && (
                        <div className="text-green-400 text-xs">LINE: {c.line_id}</div>
                      )}
                      {c.email && <div className="text-gray-500 text-xs">{c.email}</div>}
                      {!c.phone && !c.line_id && !c.email && (
                        <span className="text-gray-600 text-xs">No contact info</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs text-gray-400">
                      {c.preferred_language === 'th' ? '🇹🇭 Thai' : '🇬🇧 English'}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {c.acquisition_source ? (
                      <span className="text-xs text-gray-400">
                        {SOURCE_LABELS[c.acquisition_source]}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {c.consent_to_message ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-300">
                        Consented
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-500">
                        No consent
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditCustomer(c)}>
                        Edit
                      </Button>
                      <Link href={`/customers/${c.id}`}>
                        <Button size="sm" variant="secondary">
                          View
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Customer" size="lg">
        <CustomerForm onSuccess={onCreateSuccess} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={!!editCustomer} onClose={() => setEditCustomer(null)} title="Edit Customer" size="lg">
        {editCustomer && (
          <CustomerForm
            customer={editCustomer}
            onSuccess={onEditSuccess}
            onCancel={() => setEditCustomer(null)}
          />
        )}
      </Modal>
    </div>
  )
}
