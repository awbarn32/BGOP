'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormField, inputClass, selectClass, textareaClass } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Product, ProductCategory, ProductUnit } from '@/types/domain'

const SUBCATEGORIES: Record<ProductCategory, string[]> = {
  parts: ['engine', 'brakes', 'suspension', 'electrical', 'tyres', 'body', 'consumables', 'other'],
  labour: ['diagnostics', 'mechanical', 'electrical', 'bodywork', 'other'],
  service_package: ['basic_service', 'major_service', 'custom', 'other'],
}

interface ProductFormProps {
  product?: Product
  onSuccess: (product: Product) => void
  onCancel: () => void
}

export function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const { toast } = useToast()
  const isEdit = !!product

  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    category: product?.category ?? 'parts' as ProductCategory,
    subcategory: product?.subcategory ?? '',
    cost_price: product?.cost_price != null ? String(product.cost_price) : '',
    sale_price: product?.sale_price != null ? String(product.sale_price) : '',
    unit: product?.unit ?? 'each' as ProductUnit,
    active: product?.active ?? true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.sku.trim()) next.sku = 'SKU is required'
    if (!form.name.trim()) next.name = 'Name is required'
    if (!form.category) next.category = 'Category is required'
    if (!isEdit && !form.cost_price) next.cost_price = 'Cost price is required for new products'
    if (form.cost_price && isNaN(parseFloat(form.cost_price))) next.cost_price = 'Must be a number'
    if (!form.sale_price) next.sale_price = 'Sale price is required'
    if (isNaN(parseFloat(form.sale_price))) next.sale_price = 'Must be a number'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        subcategory: form.subcategory || null,
        sale_price: parseFloat(form.sale_price),
        unit: form.unit,
        active: form.active,
      }

      if (form.cost_price) {
        payload.cost_price = parseFloat(form.cost_price)
      }

      const url = isEdit ? `/api/products/${product.id}` : '/api/products'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to save product', 'error')
        return
      }

      toast(isEdit ? 'Product updated' : 'Product created', 'success')
      onSuccess(json.data)
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  const subcategoryOptions = SUBCATEGORIES[form.category] || []

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="SKU" htmlFor="sku" required error={errors.sku}
          hint="Unique identifier, e.g. BRK-001">
          <input
            id="sku"
            className={inputClass}
            value={form.sku}
            onChange={(e) => set('sku', e.target.value)}
            placeholder="BRK-001"
          />
        </FormField>

        <FormField label="Unit" htmlFor="unit" required>
          <select
            id="unit"
            className={selectClass}
            value={form.unit}
            onChange={(e) => set('unit', e.target.value as ProductUnit)}
          >
            <option value="each">Each</option>
            <option value="hour">Hour</option>
            <option value="set">Set</option>
            <option value="litre">Litre</option>
            <option value="metre">Metre</option>
          </select>
        </FormField>
      </div>

      <FormField label="Name" htmlFor="name" required error={errors.name}
        hint="Use format: ไทย / English">
        <input
          id="name"
          className={inputClass}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="ผ้าเบรก / Brake Pad"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Category" htmlFor="category" required error={errors.category}>
          <select
            id="category"
            className={selectClass}
            value={form.category}
            onChange={(e) => {
              set('category', e.target.value as ProductCategory)
              set('subcategory', '')
            }}
          >
            <option value="parts">Parts</option>
            <option value="labour">Labour</option>
            <option value="service_package">Service Package</option>
          </select>
        </FormField>

        <FormField label="Subcategory" htmlFor="subcategory">
          <select
            id="subcategory"
            className={selectClass}
            value={form.subcategory}
            onChange={(e) => set('subcategory', e.target.value)}
          >
            <option value="">— None —</option>
            {subcategoryOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Cost Price (THB)" htmlFor="cost_price"
          required={!isEdit} error={errors.cost_price}
          hint={isEdit ? 'Leave blank to keep current' : 'Required for new products'}>
          <input
            id="cost_price"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={form.cost_price}
            onChange={(e) => set('cost_price', e.target.value)}
            placeholder="0.00"
          />
        </FormField>

        <FormField label="Sale Price (THB)" htmlFor="sale_price" required error={errors.sale_price}>
          <input
            id="sale_price"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={form.sale_price}
            onChange={(e) => set('sale_price', e.target.value)}
            placeholder="0.00"
          />
        </FormField>
      </div>

      <FormField label="Description" htmlFor="description">
        <textarea
          id="description"
          className={textareaClass}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Optional notes about this product..."
        />
      </FormField>

      {isEdit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          <span className="text-sm text-gray-300">Active (visible to mechanics and on job forms)</span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>
    </form>
  )
}
