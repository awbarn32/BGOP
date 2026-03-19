'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { FormField, inputClass, selectClass, textareaClass } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { JobTemplate, JobTemplateItem, Product, RevenueStream, LineType } from '@/types/domain'

interface TemplateItem {
  product_id: string | null
  line_type: LineType
  description: string
  quantity: number
  sort_order: number
  // For UI only
  _key: string
  _productName?: string
}

interface TemplateWithItems extends JobTemplate {
  items: (JobTemplateItem & { product: Product | null })[]
}

interface TemplateFormProps {
  template?: TemplateWithItems
  onSuccess: (template: TemplateWithItems) => void
  onCancel: () => void
}

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

export function TemplateForm({ template, onSuccess, onCancel }: TemplateFormProps) {
  const { toast } = useToast()
  const isEdit = !!template

  const [form, setForm] = useState({
    name: template?.name ?? '',
    description: template?.description ?? '',
    revenue_stream: template?.revenue_stream ?? 'service' as RevenueStream,
    estimated_duration_hours: template?.estimated_duration_hours != null
      ? String(template.estimated_duration_hours)
      : '',
    active: template?.active ?? true,
    sort_order: template?.sort_order ?? 0,
  })

  const [items, setItems] = useState<TemplateItem[]>(
    (template?.items ?? []).map((item, i) => ({
      product_id: item.product_id,
      line_type: item.line_type,
      description: item.description,
      quantity: item.quantity,
      sort_order: item.sort_order,
      _key: `existing-${i}`,
      _productName: item.product?.name,
    }))
  )

  // Product search state
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function setFormField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addItem(lineType: LineType) {
    const newItem: TemplateItem = {
      product_id: null,
      line_type: lineType,
      description: '',
      quantity: 1,
      sort_order: items.length,
      _key: `new-${Date.now()}`,
    }
    setItems((prev) => [...prev, newItem])
  }

  function updateItem(key: string, patch: Partial<TemplateItem>) {
    setItems((prev) => prev.map((i) => (i._key === key ? { ...i, ...patch } : i)))
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i._key !== key))
  }

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setProductResults([]); return }
    setSearchingProducts(true)
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&pageSize=10`)
      const json = await res.json()
      setProductResults(json.data ?? [])
    } catch {
      // silent
    } finally {
      setSearchingProducts(false)
    }
  }, [])

  function linkProduct(itemKey: string, product: Product) {
    updateItem(itemKey, {
      product_id: product.id,
      description: product.name,
      _productName: product.name,
    })
    setProductSearch('')
    setProductResults([])
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Name is required'
    if (!form.revenue_stream) next.revenue_stream = 'Revenue stream is required'
    for (const item of items) {
      if (!item.description.trim()) {
        next[`item_${item._key}`] = 'Description required'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        revenue_stream: form.revenue_stream,
        estimated_duration_hours: form.estimated_duration_hours
          ? parseFloat(form.estimated_duration_hours)
          : null,
        active: form.active,
        sort_order: form.sort_order,
        items: items.map((item, i) => ({
          product_id: item.product_id,
          line_type: item.line_type,
          description: item.description.trim(),
          quantity: item.quantity,
          sort_order: i,
        })),
      }

      const url = isEdit ? `/api/templates/${template.id}` : '/api/templates'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to save template', 'error')
        return
      }

      toast(isEdit ? 'Template updated' : 'Template created', 'success')
      onSuccess(json.data)
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Name" htmlFor="name" required error={errors.name}
        hint="Use format: ไทย / English">
        <input
          id="name"
          className={inputClass}
          value={form.name}
          onChange={(e) => setFormField('name', e.target.value)}
          placeholder="บริการล้างรถ / Bike Wash"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Revenue Stream" htmlFor="revenue_stream" required error={errors.revenue_stream}>
          <select
            id="revenue_stream"
            className={selectClass}
            value={form.revenue_stream}
            onChange={(e) => setFormField('revenue_stream', e.target.value as RevenueStream)}
          >
            {REVENUE_STREAMS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Est. Duration (hours)" htmlFor="duration">
          <input
            id="duration"
            type="number"
            step="0.5"
            min="0"
            className={inputClass}
            value={form.estimated_duration_hours}
            onChange={(e) => setFormField('estimated_duration_hours', e.target.value)}
            placeholder="2.5"
          />
        </FormField>
      </div>

      <FormField label="Description" htmlFor="description">
        <textarea
          id="description"
          className={textareaClass}
          value={form.description}
          onChange={(e) => setFormField('description', e.target.value)}
          placeholder="Optional notes about this template..."
        />
      </FormField>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-300">Line Items</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => addItem('labour')}>
              + Labour
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => addItem('part')}>
              + Part
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 p-4 text-center text-sm text-gray-500">
            No items yet — add labour or parts above
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item._key} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    item.line_type === 'labour'
                      ? 'bg-blue-900/50 text-blue-300'
                      : 'bg-amber-900/50 text-amber-300'
                  }`}>
                    {item.line_type}
                  </span>

                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex gap-2">
                      <input
                        className={`${inputClass} flex-1`}
                        value={item.description}
                        onChange={(e) => updateItem(item._key, { description: e.target.value })}
                        placeholder={item.line_type === 'labour' ? 'Labour description / คำอธิบาย' : 'Part name / ชื่อชิ้นส่วน'}
                      />
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        className={`${inputClass} w-20`}
                        value={item.quantity}
                        onChange={(e) => updateItem(item._key, { quantity: parseFloat(e.target.value) || 1 })}
                        title="Quantity"
                      />
                    </div>

                    {/* Product link (for parts) */}
                    {item.line_type === 'part' && !item.product_id && (
                      <div className="relative">
                        <input
                          className={`${inputClass} text-xs`}
                          placeholder="Search product catalog to link..."
                          value={productSearch}
                          onChange={(e) => {
                            setProductSearch(e.target.value)
                            searchProducts(e.target.value)
                          }}
                        />
                        {productResults.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-40 overflow-auto">
                            {productResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-800 transition-colors"
                                onClick={() => linkProduct(item._key, p)}
                              >
                                <span className="text-white">{p.name}</span>
                                <span className="text-gray-500 ml-2">{p.sku}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {item.product_id && item._productName && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span>Linked: {item._productName}</span>
                        <button
                          type="button"
                          className="text-gray-600 hover:text-red-400 transition-colors"
                          onClick={() => updateItem(item._key, { product_id: null, _productName: undefined })}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {errors[`item_${item._key}`] && (
                      <p className="text-xs text-red-400">{errors[`item_${item._key}`]}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="text-gray-600 hover:text-red-400 transition-colors mt-0.5 flex-shrink-0"
                    onClick={() => removeItem(item._key)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
            checked={form.active}
            onChange={(e) => setFormField('active', e.target.checked)}
          />
          <span className="text-sm text-gray-300">Active (available when creating new jobs)</span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>
    </form>
  )
}
