'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { CustomerForm } from '@/components/customers/CustomerForm'
import { useToast } from '@/components/ui/Toast'
import type { Customer, Vehicle } from '@/types/domain'

interface CustomerWithVehicles extends Customer {
  vehicles: Vehicle[]
}

const MAKE_LABELS: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM', other: 'Other',
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [customer, setCustomer] = useState<CustomerWithVehicles | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/customers/${id}`)
        if (res.status === 404) { router.push('/customers'); return }
        const json = await res.json()
        setCustomer(json.data)
      } catch {
        toast('Failed to load customer', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router, toast])

  function onEditSuccess(updated: Customer) {
    setEditOpen(false)
    setCustomer((prev) => prev ? { ...prev, ...updated } : null)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Customer" />
        <div className="flex justify-center items-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!customer) return null

  return (
    <div className="flex flex-col h-full">
      <Header
        title={customer.full_name}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-4xl">
        {/* Back */}
        <Link href="/customers" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to Customers
        </Link>

        {/* Contact card */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{customer.full_name}</h2>
              {customer.nationality && (
                <p className="text-sm text-gray-400">{customer.nationality}</p>
              )}
            </div>
            <div className="flex gap-2">
              {customer.dormant && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                  Dormant
                </span>
              )}
              {customer.consent_to_message ? (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-300">
                  MSG Consent
                </span>
              ) : (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-500">
                  No Consent
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Phone" value={customer.phone} />
            <InfoRow label="LINE ID" value={customer.line_id} className="text-green-400" />
            <InfoRow label="Email" value={customer.email} />
            <InfoRow label="Language" value={customer.preferred_language === 'th' ? '🇹🇭 Thai' : '🇬🇧 English'} />
            <InfoRow
              label="Source"
              value={customer.acquisition_source?.replace(/_/g, ' ') ?? null}
              className="capitalize"
            />
            <InfoRow label="Customer since" value={new Date(customer.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
          </div>

          {customer.notes && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Vehicles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Vehicles ({customer.vehicles.length})</h3>
            <Link href={`/vehicles/new?customer_id=${customer.id}`}>
              <Button size="sm" variant="ghost">+ Add Vehicle</Button>
            </Link>
          </div>

          {customer.vehicles.length === 0 ? (
            <div className="bg-gray-800/50 rounded-xl p-6 text-center border border-gray-700 border-dashed">
              <p className="text-sm text-gray-500">No vehicles registered</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customer.vehicles.map((v) => (
                <Link key={v.id} href={`/vehicles/${v.id}`} className="block group">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between group-hover:border-indigo-500/50 group-hover:bg-gray-800/80 transition-colors">
                    <div>
                      <span className="font-medium text-white group-hover:text-indigo-300 transition-colors">
                        {v.year} {MAKE_LABELS[v.make] ?? v.make} {v.model}
                      </span>
                      <div className="text-xs text-gray-400 mt-0.5 space-x-3">
                        {v.license_plate && <span>{v.license_plate}</span>}
                        {v.color && <span>{v.color}</span>}
                        {v.current_mileage && <span>{v.current_mileage.toLocaleString()} km</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.ownership_status === 'customer_owned'
                          ? 'bg-gray-700 text-gray-400'
                          : v.ownership_status === 'for_sale'
                          ? 'bg-amber-900/50 text-amber-300'
                          : 'bg-blue-900/50 text-blue-300'
                      }`}>
                        {v.ownership_status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-xs">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Customer" size="lg">
        <CustomerForm
          customer={customer}
          onSuccess={onEditSuccess}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  )
}

function InfoRow({
  label,
  value,
  className = '',
}: {
  label: string
  value: string | null | undefined
  className?: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm text-gray-200 ${className}`}>{value ?? '—'}</p>
    </div>
  )
}
