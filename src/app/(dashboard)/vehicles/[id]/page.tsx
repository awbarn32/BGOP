'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { VehicleForm } from '@/components/vehicles/VehicleForm'
import { useToast } from '@/components/ui/Toast'
import type { Vehicle } from '@/types/domain'

interface VehicleWithCustomer extends Vehicle {
  customer: { id: string; full_name: string; phone: string | null; email: string | null } | null
}

const MAKE_LABELS: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson',
  aprilia: 'Aprilia', husqvarna: 'Husqvarna', benelli: 'Benelli',
  cfmoto: 'CFMOTO', other: 'Other',
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [vehicle, setVehicle] = useState<VehicleWithCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/vehicles/${id}`)
        if (res.status === 404) { router.push('/vehicles'); return }
        const json = await res.json()
        setVehicle(json.data)
      } catch {
        toast('Failed to load vehicle', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router, toast])

  function onEditSuccess(updated: Vehicle) {
    setEditOpen(false)
    setVehicle((prev) => prev ? { ...prev, ...updated } : null)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Vehicle" />
        <div className="flex justify-center items-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!vehicle) return null

  const title = `${vehicle.year} ${MAKE_LABELS[vehicle.make] ?? vehicle.make} ${vehicle.model}`

  return (
    <div className="flex flex-col h-full">
      <Header
        title={title}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-3xl">
        {/* Back */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <Link href="/vehicles" className="hover:text-gray-300 transition-colors">← Vehicles</Link>
          {vehicle.customer && (
            <>
              <span>/</span>
              <Link href={`/customers/${vehicle.customer.id}`} className="hover:text-gray-300 transition-colors">
                {vehicle.customer.full_name}
              </Link>
            </>
          )}
        </div>

        {/* Vehicle details */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {vehicle.color && <p className="text-sm text-gray-400">{vehicle.color}</p>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              vehicle.ownership_status === 'customer_owned'
                ? 'bg-gray-700 text-gray-400'
                : vehicle.ownership_status === 'for_sale'
                ? 'bg-amber-900/50 text-amber-300'
                : 'bg-blue-900/50 text-blue-300'
            }`}>
              {vehicle.ownership_status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Make" value={MAKE_LABELS[vehicle.make] ?? vehicle.make} />
            <InfoRow label="Model" value={vehicle.model} />
            <InfoRow label="Year" value={String(vehicle.year)} />
            <InfoRow label="License Plate" value={vehicle.license_plate} className="font-mono" />
            <InfoRow label="VIN" value={vehicle.vin} className="font-mono text-xs" />
            <InfoRow label="Engine No." value={vehicle.engine_number} className="font-mono text-xs" />
            <InfoRow
              label="Current Mileage"
              value={vehicle.current_mileage != null ? `${vehicle.current_mileage.toLocaleString()} km` : null}
            />
            <InfoRow
              label="Last Service"
              value={vehicle.last_service_date
                ? new Date(vehicle.last_service_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : null}
            />
            {vehicle.last_service_mileage != null && (
              <InfoRow label="Last Service Mileage" value={`${vehicle.last_service_mileage.toLocaleString()} km`} />
            )}
          </div>
        </div>

        {/* Owner */}
        {vehicle.customer && (
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Owner</h3>
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href={`/customers/${vehicle.customer.id}`}
                  className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  {vehicle.customer.full_name}
                </Link>
                <div className="text-xs text-gray-400 mt-0.5 space-x-3">
                  {vehicle.customer.phone && <span>{vehicle.customer.phone}</span>}
                  {vehicle.customer.email && <span>{vehicle.customer.email}</span>}
                </div>
              </div>
              <Link href={`/customers/${vehicle.customer.id}`}>
                <Button size="sm" variant="ghost">View Profile →</Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Vehicle" size="lg">
        <VehicleForm
          vehicle={vehicle}
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
