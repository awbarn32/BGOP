'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormField, inputClass, selectClass, textareaClass } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Customer, AcquisitionSource } from '@/types/domain'

const ACQUISITION_SOURCES: { value: AcquisitionSource; label: string }[] = [
  { value: 'word_of_mouth', label: 'Word of Mouth' },
  { value: 'seo', label: 'SEO / Google' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'repeat', label: 'Repeat Customer' },
  { value: 'other', label: 'Other' },
]

interface CustomerFormProps {
  customer?: Customer
  onSuccess: (customer: Customer) => void
  onCancel: () => void
}

export function CustomerForm({ customer, onSuccess, onCancel }: CustomerFormProps) {
  const { toast } = useToast()
  const isEdit = !!customer

  const [form, setForm] = useState({
    full_name: customer?.full_name ?? '',
    phone: customer?.phone ?? '',
    line_id: customer?.line_id ?? '',
    email: customer?.email ?? '',
    nationality: customer?.nationality ?? '',
    preferred_language: customer?.preferred_language ?? 'th',
    consent_to_message: customer?.consent_to_message ?? false,
    acquisition_source: customer?.acquisition_source ?? '',
    notes: customer?.notes ?? '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.full_name.trim()) next.full_name = 'Name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Invalid email address'
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
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        line_id: form.line_id.trim() || null,
        email: form.email.trim() || null,
        nationality: form.nationality.trim() || null,
        preferred_language: form.preferred_language,
        consent_to_message: form.consent_to_message,
        acquisition_source: form.acquisition_source || null,
        notes: form.notes.trim() || null,
      }

      const url = isEdit ? `/api/customers/${customer.id}` : '/api/customers'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to save customer', 'error')
        return
      }

      toast(isEdit ? 'Customer updated' : 'Customer created', 'success')
      onSuccess(json.data)
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Full Name" htmlFor="full_name" required error={errors.full_name}>
        <input
          id="full_name"
          className={inputClass}
          value={form.full_name}
          onChange={(e) => set('full_name', e.target.value)}
          placeholder="Somchai Jaidee"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Phone" htmlFor="phone">
          <input
            id="phone"
            type="tel"
            className={inputClass}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+66 81 234 5678"
          />
        </FormField>

        <FormField label="LINE ID" htmlFor="line_id">
          <input
            id="line_id"
            className={inputClass}
            value={form.line_id}
            onChange={(e) => set('line_id', e.target.value)}
            placeholder="somchai123"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="somchai@email.com"
          />
        </FormField>

        <FormField label="Nationality" htmlFor="nationality">
          <input
            id="nationality"
            className={inputClass}
            value={form.nationality}
            onChange={(e) => set('nationality', e.target.value)}
            placeholder="Thai"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Preferred Language" htmlFor="preferred_language">
          <select
            id="preferred_language"
            className={selectClass}
            value={form.preferred_language}
            onChange={(e) => set('preferred_language', e.target.value as 'en' | 'th')}
          >
            <option value="th">Thai (ภาษาไทย)</option>
            <option value="en">English</option>
          </select>
        </FormField>

        <FormField label="How did they find us?" htmlFor="acquisition_source">
          <select
            id="acquisition_source"
            className={selectClass}
            value={form.acquisition_source}
            onChange={(e) => set('acquisition_source', e.target.value)}
          >
            <option value="">— Unknown —</option>
            {ACQUISITION_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          className={textareaClass}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Any notes about this customer..."
        />
      </FormField>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
          checked={form.consent_to_message}
          onChange={(e) => set('consent_to_message', e.target.checked)}
        />
        <span className="text-sm text-gray-300">Customer consents to LINE/SMS messages</span>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save Changes' : 'Add Customer'}
        </Button>
      </div>
    </form>
  )
}
