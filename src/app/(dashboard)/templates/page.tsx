'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { RevenueStreamBadge } from '@/components/ui/StatusBadge'
import { TemplateForm } from '@/components/templates/TemplateForm'
import { useToast } from '@/components/ui/Toast'
import type { JobTemplate, JobTemplateItem, Product } from '@/types/domain'

interface TemplateWithItems extends JobTemplate {
  items: (JobTemplateItem & { product: Product | null })[]
}

export default function TemplatesPage() {
  const { toast } = useToast()

  const [templates, setTemplates] = useState<TemplateWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<TemplateWithItems | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ active: showInactive ? 'false' : 'true' })
    try {
      const res = await fetch(`/api/templates?${params}`)
      const json = await res.json()
      setTemplates(json.data ?? [])
    } catch {
      toast('Failed to load templates', 'error')
    } finally {
      setLoading(false)
    }
  }, [showInactive, toast])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  async function handleDeactivate(template: TemplateWithItems) {
    if (!confirm(`Deactivate "${template.name}"?`)) return
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })
      if (!res.ok) throw new Error()
      toast('Template deactivated', 'success')
      fetchTemplates()
    } catch {
      toast('Failed to deactivate', 'error')
    }
  }

  async function handleReactivate(template: TemplateWithItems) {
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })
      if (!res.ok) throw new Error()
      toast('Template reactivated', 'success')
      fetchTemplates()
    } catch {
      toast('Failed to reactivate', 'error')
    }
  }

  function onCreateSuccess(template: TemplateWithItems) {
    setCreateOpen(false)
    setTemplates((prev) => [template, ...prev])
  }

  function onEditSuccess(updated: TemplateWithItems) {
    setEditTemplate(null)
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Job Templates"
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            + New Template
          </Button>
        }
      />

      <div className="px-6 pt-4 pb-2 flex items-center gap-3">
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
          <span className="text-xs text-gray-500 ml-auto">{templates.length} templates</span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="No templates yet"
            description="Create canned job templates to speed up job creation."
            action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ New Template</Button>}
          />
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`bg-gray-800 rounded-xl p-4 border border-gray-700 ${!t.active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-medium">
                        {t.name.includes(' / ') ? t.name.split(' / ')[1] : t.name}
                      </span>
                      {t.name.includes(' / ') && (
                        <span className="text-xs text-gray-500">{t.name.split(' / ')[0]}</span>
                      )}
                      <RevenueStreamBadge stream={t.revenue_stream} />
                      {!t.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>

                    {t.description && (
                      <p className="text-xs text-gray-400 mb-2">{t.description}</p>
                    )}

                    {t.items.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {t.items.map((item) => (
                          <span
                            key={item.id}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                              item.line_type === 'labour'
                                ? 'bg-blue-900/30 text-blue-300'
                                : 'bg-amber-900/30 text-amber-300'
                            }`}
                          >
                            {item.quantity > 1 && `${item.quantity}\u00d7 `}
                            {(item.description.includes(' / ')
                              ? item.description.split(' / ')[1]
                              : item.description).trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {t.estimated_duration_hours && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        Est. {t.estimated_duration_hours}h
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditTemplate(t)}>
                      Edit
                    </Button>
                    {t.active ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleDeactivate(t)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-400 hover:text-emerald-300"
                        onClick={() => handleReactivate(t)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Job Template" size="lg">
        <TemplateForm onSuccess={onCreateSuccess} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={!!editTemplate} onClose={() => setEditTemplate(null)} title="Edit Template" size="lg">
        {editTemplate && (
          <TemplateForm
            template={editTemplate}
            onSuccess={onEditSuccess}
            onCancel={() => setEditTemplate(null)}
          />
        )}
      </Modal>
    </div>
  )
}
