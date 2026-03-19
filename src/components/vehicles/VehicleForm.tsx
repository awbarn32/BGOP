'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormField, inputClass, selectClass } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Vehicle, OwnershipStatus } from '@/types/domain'

const MAKES = [
  'honda', 'yamaha', 'kawasaki', 'suzuki', 'ducati', 'bmw',
  'triumph', 'ktm', 'royal_enfield', 'harley_davidson', 'aprilia',
  'husqvarna', 'benelli', 'cfmoto', 'other',
]

const MAKE_LABELS: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson',
  aprilia: 'Aprilia', husqvarna: 'Husqvarna', benelli: 'Benelli',
  cfmoto: 'CFMOTO', other: 'Other',
}

interface VehicleFormProps {
  vehicle?: Vehicle
  customerId?: string  // Pre-filled when adding from customer profile
  onSuccess: (vehicle: Vehicle) => void
  onCancel: () => void
}

export function VehicleForm({ vehicle, customerId, onSuccess, onCancel }: VehicleFormProps) {
  const { toast } = useToast()
  const isEdit = !!vehicle
  const currentYear = new Date().getFullYear()

  const [form, setForm] = useState({
    customer_id: vehicle?.customer_id ?? customerId ?? '',
    make: vehicle?.make ?? 'honda',
    model: vehicle?.model ?? '',
    year: vehicle?.year ?? currentYear,
    vin: vehicle?.vin ?? '',
    engine_number: vehicle?.engine_number ?? '',
    color: vehicle?.color ?? '',
    license_plate: vehicle?.license_plate ?? '',
    ownership_status: vehicle?.ownership_status ?? 'customer_owned' as OwnershipStatus,
    current_mileage: vehicle?.current_mileage != null ? String(vehicle.current_mileage) : '',
    last_service_mileage: vehicle?.last_service_mileage != null ? String(vehicle.last_service_mileage) : '',
    last_service_date: vehicle?.last_service_date ?? '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!isEdit && !form.customer_id) next.customer_id = 'Customer ID is required'
    if (!form.make) next.make = 'Make is required'
    if (!form.model.trim()) next.model = 'Model is required'
    if (!form.year || form.year < 1970 || form.year > currentYear + 1) {
      next.year = `Year must be between 1970 and ${currentYear + 1}`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        make: form.make,
        model: form.model.trim(),
        year: form.year,
        vin: form.vin.trim() || null,
        engine_number: form.engine_number.trim() || null,
        color: form.color.trim() || null,
        license_plate: form.license_plate.trim() || null,
        ownership_status: form.ownership_status,
        current_mileage: form.current_mileage ? parseInt(form.current_mileage, 10) : null,
        last_service_mileage: form.last_service_mileage ? parseInt(form.last_service_mileage, 10) : null,
        last_service_date: form.last_service_date || null,
      }

      if (!isEdit) {
        payload.customer_id = form.customer_id
      }

      const url = isEdit ? `/api/vehicles/${vehicle.id}` : '/api/vehicles'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to save vehicle', 'error')
        return
      }

      toast(isEdit ? 'Vehicle updated' : 'Vehicle added', 'success')
      onSuccess(json.data)
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Make" htmlFor="make" required error={errors.make}>
          <select
            id="make"
            className={selectClass}
            value={form.make}
            onChange={(e) => set('make', e.target.value)}
          >
            {MAKES.map((m) => (
              <option key={m} value={m}>{MAKE_LABELS[m] ?? m}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Model" htmlFor="model" required error={errors.model}>
          <input
            id="model"
            className={inputClass}
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
            placeholder="CBR650R"
          />
        </FormField>

        <FormField label="Year" htmlFor="year" required error={errors.year}>
          <input
            id="year"
            type="number"
            min={1970}
            max={currentYear + 1}
            className={inputClass}
            value={form.year}
            onChange={(e) => set('year', parseInt(e.target.value, 10))}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="License Plate" htmlFor="license_plate">
          <input
            id="license_plate"
            className={inputClass}
            value={form.license_plate}
            onChange={(e) => set('license_plate', e.target.value)}
            placeholder="กข 1234 กรุงเทพ"
          />
        </FormField>

        <FormField label="Color" htmlFor="color">
          <input
            id="color"
            className={inputClass}
            value={form.color}
            onChange={(e) => set('color', e.target.value)}
            placeholder="Matte Black"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="VIN / Chassis No." htmlFor="vin">
          <input
            id="vin"
            className={inputClass}
            value={form.vin}
            onChange={(e) => set('vin', e.target.value)}
            placeholder="MLHPC4417..."
          />
        </FormField>

        <FormField label="Engine Number" htmlFor="engine_number">
          <input
            id="engine_number"
            className={inputClass}
            value={form.engine_number}
            onChange={(e) => set('engine_number', e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Current Mileage (km)" htmlFor="current_mileage">
          <input
            id="current_mileage"
            type="number"
            min={0}
            className={inputClass}
            value={form.current_mileage}
            onChange={(e) => set('current_mileage', e.target.value)}
            placeholder="12500"
          />
        </FormField>

        <FormField label="Last Service Mileage" htmlFor="last_service_mileage">
          <input
            id="last_service_mileage"
            type="number"
            min={0}
            className={inputClass}
            value={form.last_service_mileage}
            onChange={(e) => set('last_service_mileage', e.target.value)}
            placeholder="10000"
          />
        </FormField>

        <FormField label="Last Service Date" htmlFor="last_service_date">
          <input
            id="last_service_date"
            type="date"
            className={inputClass}
            value={form.last_service_date}
            onChange={(e) => set('last_service_date', e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Ownership Status" htmlFor="ownership_status">
        <select
          id="ownership_status"
          className={selectClass}
          value={form.ownership_status}
          onChange={(e) => set('ownership_status', e.target.value as OwnershipStatus)}
        >
          <option value="customer_owned">Customer Owned</option>
          <option value="for_sale">For Sale</option>
          <option value="for_rent">For Rent</option>
        </select>
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save Changes' : 'Add Vehicle'}
        </Button>
      </div>
    </form>
  )
}
