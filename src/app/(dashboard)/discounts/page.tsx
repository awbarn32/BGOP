'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

const STREAM_OPTIONS = [
  { value: 'service', label: 'Service' },
  { value: 'transport', label: 'Transport' },
  { value: 'dlt', label: 'DLT' },
  { value: 'sourcing', label: 'Sourcing' },
  { value: 'commission', label: 'Commission' },
  { value: 'ecu', label: 'ECU' },
  { value: 'track_day', label: 'Track Day' },
  { value: 'bike_hotel', label: 'Bike Hotel' },
] as const

const APPLICABLE_TO_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'labour', label: 'Labour' },
  { value: 'parts', label: 'Parts' },
  { value: 'service_package', label: 'Service Package' },
  { value: 'specific_streams', label: 'Specific Streams' },
] as const

type DiscountType = 'percent' | 'fixed'
type ApplicableTo = 'all' | 'labour' | 'parts' | 'service_package' | 'specific_streams'

interface Discount {
  id: string
  name: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  applicable_to: ApplicableTo
  applicable_streams: string[] | null
  min_invoice_amount: number | null
  max_discount_amount: number | null
  preapproved: boolean
  active: boolean
  sort_order: number
  created_at: string
}

interface FormState {
  name: string
  description: string
  discount_type: DiscountType
  discount_value: string
  applicable_to: ApplicableTo
  applicable_streams: string[]
  min_invoice_amount: string
  max_discount_amount: string
  preapproved: boolean
  active: boolean
}

const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  discount_type: 'percent',
  discount_value: '',
  applicable_to: 'all',
  applicable_streams: [],
  min_invoice_amount: '',
  max_discount_amount: '',
  preapproved: false,
  active: true,
}

function discountToForm(d: Discount): FormState {
  return {
    name: d.name,
    description: d.description ?? '',
    discount_type: d.discount_type,
    discount_value: String(d.discount_value),
    applicable_to: d.applicable_to,
    applicable_streams: d.applicable_streams ?? [],
    min_invoice_amount: d.min_invoice_amount != null ? String(d.min_invoice_amount) : '',
    max_discount_amount: d.max_discount_amount != null ? String(d.max_discount_amount) : '',
    preapproved: d.preapproved,
    active: d.active,
  }
}

function applicableToLabel(v: ApplicableTo): string {
  const map: Record<ApplicableTo, string> = {
    all: 'All',
    labour: 'Labour',
    parts: 'Parts',
    service_package: 'Service Package',
    specific_streams: 'Specific Streams',
  }
  return map[v]
}

export default function DiscountsPage() {
  const { toast } = useToast()

  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editDiscount, setEditDiscount] = useState<Discount | null>(null)
  const [deactivating, setDeactivating] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [previewMessageOpen, setPreviewMessageOpen] = useState(false)

  // Fetch user role from Supabase auth
  useEffect(() => {
    async function fetchRole() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        setUserRole(user?.app_metadata?.role ?? null)
      } catch {
        setUserRole(null)
      }
    }
    fetchRole()
  }, [])

  const fetchDiscounts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(showInactive ? {} : { active: 'true' }),
      })
      const res = await fetch(`/api/discounts?${params}`)
      const json = await res.json()
      setDiscounts(json.data ?? [])
    } catch {
      toast('Failed to load discounts', 'error')
    } finally {
      setLoading(false)
    }
  }, [showInactive, toast])

  useEffect(() => {
    fetchDiscounts()
  }, [fetchDiscounts])

  function openCreate() {
    setForm(DEFAULT_FORM)
    setCreateOpen(true)
  }

  function openEdit(discount: Discount) {
    setForm(discountToForm(discount))
    setEditDiscount(discount)
  }

  function closeCreate() {
    setCreateOpen(false)
    setForm(DEFAULT_FORM)
  }

  function closeEdit() {
    setEditDiscount(null)
    setForm(DEFAULT_FORM)
  }

  function handleFormChange(field: keyof FormState, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleStream(stream: string) {
    setForm((prev) => {
      const streams = prev.applicable_streams.includes(stream)
        ? prev.applicable_streams.filter((s) => s !== stream)
        : [...prev.applicable_streams, stream]
      return { ...prev, applicable_streams: streams }
    })
  }

  function buildPayload(f: FormState) {
    return {
      name: f.name,
      description: f.description || null,
      discount_type: f.discount_type,
      discount_value: parseFloat(f.discount_value),
      applicable_to: f.applicable_to,
      applicable_streams: f.applicable_to === 'specific_streams' ? f.applicable_streams : null,
      min_invoice_amount: f.min_invoice_amount ? parseFloat(f.min_invoice_amount) : null,
      max_discount_amount: f.max_discount_amount ? parseFloat(f.max_discount_amount) : null,
      preapproved: f.preapproved,
      active: f.active,
    }
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to create discount', 'error')
        return
      }
      toast('Discount created', 'success')
      setCreateOpen(false)
      setDiscounts((prev) => [json.data, ...prev])
    } catch {
      toast('Failed to create discount', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit() {
    if (!editDiscount) return
    setSaving(true)
    try {
      const res = await fetch(`/api/discounts/${editDiscount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to update discount', 'error')
        return
      }
      toast('Discount updated', 'success')
      setEditDiscount(null)
      setDiscounts((prev) => prev.map((d) => (d.id === editDiscount.id ? json.data : d)))
    } catch {
      toast('Failed to update discount', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(discount: Discount) {
    if (!confirm(`Deactivate "${discount.name}"?`)) return
    setDeactivating(discount.id)
    try {
      const res = await fetch(`/api/discounts/${discount.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('Discount deactivated', 'success')
      if (!showInactive) {
        setDiscounts((prev) => prev.filter((d) => d.id !== discount.id))
      } else {
        setDiscounts((prev) => prev.map((d) => (d.id === discount.id ? { ...d, active: false } : d)))
      }
    } catch {
      toast('Failed to deactivate discount', 'error')
    } finally {
      setDeactivating(null)
    }
  }

  const isOwner = userRole === 'owner'

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Discounts"
        actions={
          isOwner ? (
            <Button onClick={openCreate} size="sm">
              + Add Discount
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="px-6 pt-4 pb-2 flex flex-wrap items-center gap-3">
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
          <span className="text-xs text-gray-500 ml-auto">{discounts.length} discounts</span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : discounts.length === 0 ? (
          <EmptyState
            title="No discounts found"
            description="Add your first discount to get started."
            action={
              isOwner ? (
                <Button size="sm" onClick={openCreate}>
                  + Add Discount
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Name</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400 whitespace-nowrap">Type</th>
                <th className="text-right py-2 pr-4 font-medium text-gray-400 whitespace-nowrap">Value</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400 whitespace-nowrap">Applies To</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400 whitespace-nowrap">Pre-approved</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Active</th>
                {isOwner && <th className="py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {discounts.map((d) => (
                <tr
                  key={d.id}
                  className={`group hover:bg-gray-800/50 transition-colors ${!d.active ? 'opacity-50' : ''}`}
                >
                  <td className="py-2.5 pr-4">
                    <div className="text-white font-medium">
                      {d.name.includes(' / ') ? d.name.split(' / ')[1] : d.name}
                    </div>
                    {d.name.includes(' / ') && (
                      <div className="text-xs text-gray-500">{d.name.split(' / ')[0]}</div>
                    )}
                    {d.description && (
                      <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{d.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-300 text-xs whitespace-nowrap">
                    {d.discount_type === 'percent' ? '%' : 'Fixed THB'}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs text-white whitespace-nowrap">
                    {d.discount_type === 'percent'
                      ? `${d.discount_value}%`
                      : `฿${d.discount_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-xs text-gray-400">
                      {applicableToLabel(d.applicable_to)}
                      {d.applicable_to === 'specific_streams' && d.applicable_streams?.length ? (
                        <span className="ml-1 text-gray-500">
                          ({d.applicable_streams.join(', ')})
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {d.preapproved ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-300">
                        Pre-approved
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {d.active ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  {isOwner && (
                    <td className="py-2.5 pl-2">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                          Edit
                        </Button>
                        {d.active && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300"
                            loading={deactivating === d.id}
                            onClick={() => handleDeactivate(d)}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={closeCreate} title="Add Discount" size="lg">
        <DiscountForm
          form={form}
          onChange={handleFormChange}
          onToggleStream={toggleStream}
          onSubmit={handleCreate}
          onCancel={closeCreate}
          saving={saving}
          isOwner={isOwner}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editDiscount} onClose={closeEdit} title="Edit Discount" size="lg">
        {editDiscount && (
          <DiscountForm
            form={form}
            onChange={handleFormChange}
            onToggleStream={toggleStream}
            onSubmit={handleEdit}
            onCancel={closeEdit}
            saving={saving}
            isOwner={isOwner}
          />
        )}
      </Modal>
    </div>
  )
}

interface DiscountFormProps {
  form: FormState
  onChange: (field: keyof FormState, value: unknown) => void
  onToggleStream: (stream: string) => void
  onSubmit: () => void
  onCancel: () => void
  saving: boolean
  isOwner: boolean
}

function DiscountForm({ form, onChange, onToggleStream, onSubmit, onCancel, saving, isOwner }: DiscountFormProps) {
  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Name <span className="text-gray-500">(bilingual: Thai / English)</span>
        </label>
        <input
          type="text"
          placeholder="ส่วนลด / Discount"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Description (optional)</label>
        <textarea
          rows={2}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
        />
      </div>

      {/* Discount Type */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">Discount Type</label>
        <div className="flex gap-4">
          {(['percent', 'fixed'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
              <input
                type="radio"
                name="discount_type"
                value={t}
                checked={form.discount_type === t}
                onChange={() => onChange('discount_type', t)}
                className="text-indigo-500 focus:ring-indigo-500 border-gray-600 bg-gray-800"
              />
              {t === 'percent' ? 'Percentage (%)' : 'Fixed (THB)'}
            </label>
          ))}
        </div>
      </div>

      {/* Discount Value */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Value{form.discount_type === 'percent' ? ' (0–100%)' : ' (THB)'}
        </label>
        <input
          type="number"
          min="0"
          max={form.discount_type === 'percent' ? 100 : undefined}
          step="0.01"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.discount_value}
          onChange={(e) => onChange('discount_value', e.target.value)}
        />
      </div>

      {/* Applicable To */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Applies To</label>
        <select
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.applicable_to}
          onChange={(e) => onChange('applicable_to', e.target.value as ApplicableTo)}
        >
          {APPLICABLE_TO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Applicable Streams — shown only when applicable_to = 'specific_streams' */}
      {form.applicable_to === 'specific_streams' && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Applicable Streams</label>
          <div className="grid grid-cols-2 gap-2">
            {STREAM_OPTIONS.map((s) => (
              <label key={s.value} className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.applicable_streams.includes(s.value)}
                  onChange={() => onToggleStream(s.value)}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Min Invoice Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Min Invoice Amount (THB, optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.min_invoice_amount}
            onChange={(e) => onChange('min_invoice_amount', e.target.value)}
            placeholder="No minimum"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Max Discount Amount (THB, optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.max_discount_amount}
            onChange={(e) => onChange('max_discount_amount', e.target.value)}
            placeholder="No cap"
          />
        </div>
      </div>

      {/* Pre-approved — Owner only */}
      {isOwner && (
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
          <input
            type="checkbox"
            checked={form.preapproved}
            onChange={(e) => onChange('preapproved', e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
          />
          Pre-approved — PA can apply without extra approval
        </label>
      )}

      {/* Active */}
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => onChange('active', e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
        />
        Active
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-700">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSubmit} loading={saving} disabled={!form.name || !form.discount_value}>
          Save Discount
        </Button>
      </div>
    </div>
  )
}
