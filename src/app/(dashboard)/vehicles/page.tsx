'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { VehicleForm } from '@/components/vehicles/VehicleForm'
import { useToast } from '@/components/ui/Toast'
import type { Vehicle } from '@/types/domain'

const MAKE_LABELS: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson',
  aprilia: 'Aprilia', husqvarna: 'Husqvarna', benelli: 'Benelli',
  cfmoto: 'CFMOTO', other: 'Other',
}

interface VehicleWithCustomer extends Vehicle {
  customer: { id: string; full_name: string } | null
}

export default function VehiclesPage() {
  const { toast } = useToast()

  const [vehicles, setVehicles] = useState<VehicleWithCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null)

  const fetchVehicles = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '100' })
    if (search) params.set('search', search)

    try {
      const res = await fetch(`/api/vehicles?${params}`)
      const json = await res.json()
      setVehicles(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast('Failed to load vehicles', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, toast])

  useEffect(() => {
    const t = setTimeout(fetchVehicles, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchVehicles, search])

  function onCreateSuccess(_vehicle: Vehicle) {
    setCreateOpen(false)
    fetchVehicles()
  }

  function onEditSuccess(updated: Vehicle) {
    setEditVehicle(null)
    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)))
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Vehicles"
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            + Add Vehicle
          </Button>
        }
      />

      <div className="px-6 pt-4 pb-2 flex items-center gap-3">
        <input
          type="search"
          placeholder="Search make, model, plate..."
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!loading && (
          <span className="text-xs text-gray-500 ml-auto">{total} vehicles</span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState
            title="No vehicles found"
            description={search ? `No results for "${search}"` : 'Add your first vehicle to get started.'}
            action={
              !search ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>+ Add Vehicle</Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Vehicle</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Customer</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Plate</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Mileage</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Last Service</th>
                <th className="text-left py-2 font-medium text-gray-400">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {vehicles.map((v) => (
                <tr key={v.id} className="group hover:bg-gray-800/50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/vehicles/${v.id}`} className="text-white font-medium hover:text-indigo-300 transition-colors">
                      {v.year} {MAKE_LABELS[v.make] ?? v.make} {v.model}
                    </Link>
                    {v.color && <div className="text-xs text-gray-500">{v.color}</div>}
                  </td>
                  <td className="py-3 pr-4">
                    {v.customer ? (
                      <Link
                        href={`/customers/${v.customer.id}`}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
                      >
                        {v.customer.full_name}
                      </Link>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-300 text-xs font-mono">
                    {v.license_plate ?? '—'}
                  </td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">
                    {v.current_mileage != null ? `${v.current_mileage.toLocaleString()} km` : '—'}
                  </td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">
                    {v.last_service_date
                      ? new Date(v.last_service_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      v.ownership_status === 'customer_owned'
                        ? 'bg-gray-700 text-gray-400'
                        : v.ownership_status === 'for_sale'
                        ? 'bg-amber-900/50 text-amber-300'
                        : 'bg-blue-900/50 text-blue-300'
                    }`}>
                      {v.ownership_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 pl-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditVehicle(v)}>
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Vehicle" size="lg">
        <VehicleForm onSuccess={onCreateSuccess} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={!!editVehicle} onClose={() => setEditVehicle(null)} title="Edit Vehicle" size="lg">
        {editVehicle && (
          <VehicleForm
            vehicle={editVehicle}
            onSuccess={onEditSuccess}
            onCancel={() => setEditVehicle(null)}
          />
        )}
      </Modal>
    </div>
  )
}
