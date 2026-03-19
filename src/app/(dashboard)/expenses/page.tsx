'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField, inputClass, selectClass, textareaClass } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import type { Expense } from '@/types/domain'

const EXPENSE_CATEGORIES = [
  'Parts & Materials', 'Rent', 'Utilities', 'Equipment', 'Marketing',
  'Staff', 'Insurance', 'Transport', 'Tools', 'Software', 'Other',
]

function ExpenseForm({
  expense,
  onSuccess,
  onCancel,
}: {
  expense?: Expense
  onSuccess: (e: Expense) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const isEdit = !!expense

  const [form, setForm] = useState({
    category: expense?.category ?? '',
    amount: expense?.amount != null ? String(expense.amount) : '',
    date: expense?.date ?? new Date().toISOString().slice(0, 10),
    description: expense?.description ?? '',
    vendor: expense?.vendor ?? '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.category) next.category = 'Category is required'
    if (!form.amount) next.amount = 'Amount is required'
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) < 0) next.amount = 'Must be a valid amount'
    if (!form.date) next.date = 'Date is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        category: form.category,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description.trim() || null,
        vendor: form.vendor.trim() || null,
      }
      const url = isEdit ? `/api/expenses/${expense.id}` : '/api/expenses'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error?.message ?? 'Failed to save expense', 'error'); return }
      toast(isEdit ? 'Expense updated' : 'Expense recorded', 'success')
      onSuccess(json.data)
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Category" htmlFor="category" required error={errors.category}>
          <select id="category" className={selectClass} value={form.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">— Select —</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label="Date" htmlFor="date" required error={errors.date}>
          <input id="date" type="date" className={inputClass} value={form.date} onChange={(e) => set('date', e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Amount (THB)" htmlFor="amount" required error={errors.amount}>
          <input id="amount" type="number" step="0.01" min="0" className={inputClass} value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
        </FormField>
        <FormField label="Vendor / Supplier" htmlFor="vendor">
          <input id="vendor" className={inputClass} value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="Shop name or vendor" />
        </FormField>
      </div>
      <FormField label="Description" htmlFor="description">
        <textarea id="description" className={textareaClass} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What was this expense for?" />
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{isEdit ? 'Save Changes' : 'Record Expense'}</Button>
      </div>
    </form>
  )
}

export default function ExpensesPage() {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [total, setTotal] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '100' })
    if (category) params.set('category', category)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    try {
      const res = await fetch(`/api/expenses?${params}`)
      const json = await res.json()
      setExpenses(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast('Failed to load expenses', 'error')
    } finally {
      setLoading(false)
    }
  }, [category, fromDate, toDate, toast])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  async function handleDelete(expense: Expense) {
    if (!confirm(`Delete this ${expense.category} expense of \u0e3f${expense.amount.toLocaleString()}?`)) return
    setDeleting(expense.id)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('Expense deleted', 'success')
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id))
      setTotal((n) => n - 1)
    } catch {
      toast('Failed to delete expense', 'error')
    } finally {
      setDeleting(null)
    }
  }

  const formatThb = (n: number) =>
    `\u0e3f${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="flex flex-col h-full">
      <Header title="Expenses" actions={<Button onClick={() => setCreateOpen(true)} size="sm">+ Record Expense</Button>} />

      <div className="px-6 pt-4 pb-2 flex flex-wrap items-center gap-3">
        <select
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={category} onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="From date" />
        <span className="text-gray-600 text-xs">to</span>
        <input type="date" className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value={toDate} onChange={(e) => setToDate(e.target.value)} title="To date" />
        {!loading && expenses.length > 0 && (
          <div className="ml-auto text-right">
            <span className="text-xs text-gray-500 block">{total} expenses</span>
            <span className="text-sm font-medium text-white">{formatThb(totalAmount)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState title="No expenses recorded" description="Track your business expenses here." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Record Expense</Button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Date</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Category</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Vendor</th>
                <th className="text-left py-2 pr-4 font-medium text-gray-400">Description</th>
                <th className="text-right py-2 font-medium text-gray-400">Amount</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {expenses.map((e) => (
                <tr key={e.id} className="group hover:bg-gray-800/50 transition-colors">
                  <td className="py-2.5 pr-4 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-300 text-xs">{e.category}</td>
                  <td className="py-2.5 pr-4 text-gray-400 text-xs">{e.vendor ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-gray-400 text-xs max-w-xs truncate">{e.description ?? '—'}</td>
                  <td className="py-2.5 text-right text-white font-mono text-xs whitespace-nowrap">{formatThb(e.amount)}</td>
                  <td className="py-2.5 pl-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditExpense(e)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" loading={deleting === e.id} onClick={() => handleDelete(e)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Record Expense">
        <ExpenseForm onSuccess={() => { setCreateOpen(false); fetchExpenses() }} onCancel={() => setCreateOpen(false)} />
      </Modal>
      <Modal open={!!editExpense} onClose={() => setEditExpense(null)} title="Edit Expense">
        {editExpense && (
          <ExpenseForm expense={editExpense} onSuccess={(updated) => { setEditExpense(null); setExpenses((prev) => prev.map((e) => e.id === updated.id ? updated : e)) }} onCancel={() => setEditExpense(null)} />
        )}
      </Modal>
    </div>
  )
}
