'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { FormField, inputClass, selectClass, textareaClass } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Customer, Vehicle, JobTemplate, RevenueStream, LogisticsType, Bucket } from '@/types/domain'
import type { JobCard } from '@/types/kanban'
import { BUCKET_DEFAULT_STATUS } from '@/types/kanban'

const REVENUE_STREAMS: { value: RevenueStream; label: string }[] = [
  { value: 'service', label: 'Service' },
  { value: 'ecu', label: 'ECU' },
  { value: 'sourcing', label: 'Sourcing' },
  { value: 'commission', label: 'Commission' },
  { value: 'track_day', label: 'Track Day' },
  { value: 'transport', label: 'Transport' },
  { value: 'dlt', label: 'DLT' },
  { value: 'bike_hotel', label: 'Bike Hotel' },
]

const MAKE_LABELS: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson',
  aprilia: 'Aprilia', husqvarna: 'Husqvarna', benelli: 'Benelli',
  cfmoto: 'CFMOTO', other: 'Other',
}

interface NewJobFormProps {
  defaultBucket?: Bucket
  onSuccess: (job: JobCard) => void
  onCancel: () => void
}

export function NewJobForm({ defaultBucket = 'new_requests', onSuccess, onCancel }: NewJobFormProps) {
  const { toast } = useToast()

  // Step 1: customer search
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Step 2: vehicle selection
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')

  // Step 3: job details
  const [form, setForm] = useState({
    bucket: defaultBucket,
    revenue_stream: '' as RevenueStream | '',
    logistics_type: '' as LogisticsType | '',
    description: '',
    intake_mileage: '',
    owner_notify_threshold_thb: '2000',
    template_id: '',
  })

  const [templates, setTemplates] = useState<JobTemplate[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Load templates once
  useEffect(() => {
    fetch('/api/templates?active=true')
      .then((r) => r.json())
      .then((j) => setTemplates(j.data ?? []))
      .catch(() => {})
  }, [])

  // Customer search
  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) { setCustomerResults([]); return }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&pageSize=8`)
      const json = await res.json()
      setCustomerResults(json.data ?? [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 250)
    return () => clearTimeout(t)
  }, [customerSearch, searchCustomers])

  // Load vehicles when customer is selected
  async function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
    setCustomerSearch('')
    setCustomerResults([])
    setSelectedVehicleId('')
    try {
      const res = await fetch(`/api/vehicles?customer_id=${c.id}`)
      const json = await res.json()
      setVehicles(json.data ?? [])
      if (json.data?.length === 1) {
        setSelectedVehicleId(json.data[0].id)
      }
    } catch {
      toast('Failed to load vehicles', 'error')
    }
  }

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  // Auto-fill description from template
  function handleTemplateChange(templateId: string) {
    setField('template_id', templateId)
    if (!templateId) return
    const tmpl = templates.find((t) => t.id === templateId)
    if (tmpl && !form.description.trim()) {
      setField('description', tmpl.name)
    }
    if (tmpl && !form.revenue_stream) {
      setField('revenue_stream', tmpl.revenue_stream as RevenueStream)
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!selectedCustomer) next.customer = 'Select a customer'
    if (!selectedVehicleId) next.vehicle = 'Select a vehicle'
    if (!form.description.trim()) next.description = 'Description is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const status = BUCKET_DEFAULT_STATUS[form.bucket]
      const payload: Record<string, unknown> = {
        customer_id: selectedCustomer!.id,
        vehicle_id: selectedVehicleId,
        bucket: form.bucket,
        status,
        description: form.description.trim(),
        revenue_stream: form.revenue_stream || null,
        logistics_type: form.logistics_type || null,
        intake_mileage: form.intake_mileage ? parseInt(form.intake_mileage, 10) : null,
        owner_notify_threshold_thb: parseInt(form.owner_notify_threshold_thb, 10) || 2000,
      }
      if (form.template_id) payload.template_id = form.template_id

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to create job', 'error')
        return
      }
      toast('Job created', 'success')
      onSuccess(json.data)
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Customer search */}
      <div>
        <FormField label="Customer" htmlFor="customer_search" required error={errors.customer}>
          {selectedCustomer ? (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
              <div>
                <span className="text-white text-sm font-medium">{selectedCustomer.full_name}</span>
                {selectedCustomer.phone && (
                  <span className="text-gray-400 text-xs ml-2">{selectedCustomer.phone}</span>
                )}
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-red-400 transition-colors text-xs"
                onClick={() => { setSelectedCustomer(null); setVehicles([]); setSelectedVehicleId('') }}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                id="customer_search"
                className={inputClass}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search by name, phone, LINE ID..."
                autoComplete="off"
              />
              {customerResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0"
                      onClick={() => selectCustomer(c)}
                    >
                      <p className="text-sm text-white font-medium">{c.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {[c.phone, c.line_id ? `LINE: ${c.line_id}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </FormField>
      </div>

      {/* Vehicle */}
      {selectedCustomer && (
        <FormField label="Vehicle" htmlFor="vehicle_id" required error={errors.vehicle}>
          {vehicles.length === 0 ? (
            <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-500">
              No vehicles registered for this customer.{' '}
              <a
                href={`/vehicles/new?customer_id=${selectedCustomer.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                Add one
              </a>
            </div>
          ) : (
            <select
              id="vehicle_id"
              className={selectClass}
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
            >
              <option value="">— Select vehicle —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {MAKE_LABELS[v.make] ?? v.make} {v.model}
                  {v.license_plate ? ` · ${v.license_plate}` : ''}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}

      {/* Template (optional) */}
      <FormField label="Template" htmlFor="template_id" hint="Pre-fills description and revenue stream">
        <select
          id="template_id"
          className={selectClass}
          value={form.template_id}
          onChange={(e) => handleTemplateChange(e.target.value)}
        >
          <option value="">— No template —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name.includes(' / ') ? t.name.split(' / ')[1] : t.name}
            </option>
          ))}
        </select>
      </FormField>

      {/* Description */}
      <FormField label="Description" htmlFor="description" required error={errors.description}
        hint="Use format: ไทย / English if bilingual">
        <textarea
          id="description"
          className={textareaClass}
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="เปลี่ยนน้ำมันเครื่อง / Oil change"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Revenue Stream" htmlFor="revenue_stream">
          <select
            id="revenue_stream"
            className={selectClass}
            value={form.revenue_stream}
            onChange={(e) => setField('revenue_stream', e.target.value as RevenueStream | '')}
          >
            <option value="">— None —</option>
            {REVENUE_STREAMS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Logistics" htmlFor="logistics_type">
          <select
            id="logistics_type"
            className={selectClass}
            value={form.logistics_type}
            onChange={(e) => setField('logistics_type', e.target.value as LogisticsType | '')}
          >
            <option value="">— None / Walk-in —</option>
            <option value="drop_off">Drop-off (we collect)</option>
            <option value="pickup">Pickup (customer delivers)</option>
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Starting Bucket" htmlFor="bucket">
          <select
            id="bucket"
            className={selectClass}
            value={form.bucket}
            onChange={(e) => setField('bucket', e.target.value as Bucket)}
          >
            <option value="new_requests">New Requests</option>
            <option value="intake">Intake</option>
            <option value="available_jobs">Available Jobs</option>
            <option value="wip">WIP</option>
            <option value="outbound">Outbound</option>
          </select>
        </FormField>

        <FormField label="Intake Mileage (km)" htmlFor="intake_mileage">
          <input
            id="intake_mileage"
            type="number"
            min={0}
            className={inputClass}
            value={form.intake_mileage}
            onChange={(e) => setField('intake_mileage', e.target.value)}
            placeholder="Current odometer"
          />
        </FormField>
      </div>

      <FormField
        label="Scope approval threshold (THB)"
        htmlFor="notify_threshold"
        hint="Notify owner before approving scope changes above this amount"
      >
        <input
          id="notify_threshold"
          type="number"
          min={0}
          step={500}
          className={inputClass}
          value={form.owner_notify_threshold_thb}
          onChange={(e) => setField('owner_notify_threshold_thb', e.target.value)}
        />
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Create Job
        </Button>
      </div>
    </form>
  )
}
