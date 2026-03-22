'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { KanbanColumn } from '@/components/jobs/KanbanColumn'
import { JobCard } from '@/components/jobs/JobCard'
import { NewJobForm } from '@/components/jobs/NewJobForm'
import { useToast } from '@/components/ui/Toast'
import { subscribeToKanbanUpdates, unsubscribe } from '@/lib/supabase/realtime'
import { createClient } from '@/lib/supabase/client'
import { BUCKET_ORDER, BUCKET_DEFAULT_STATUS } from '@/types/kanban'
import type { Bucket, User } from '@/types/domain'
import type { JobCard as JobCardType } from '@/types/kanban'

const REVENUE_STREAMS = [
  { value: 'service', label: 'Service' },
  { value: 'sourcing', label: 'Sourcing' },
  { value: 'track_day', label: 'Track Day' },
  { value: 'transport', label: 'Transport' },
  { value: 'dlt', label: 'DLT' },
  { value: 'bike_hotel', label: 'Bike Hotel' },
]

export default function BoardPage() {
  const { toast } = useToast()
  const [jobs, setJobs] = useState<JobCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [mechanics, setMechanics] = useState<Pick<User, 'id' | 'full_name'>[]>([])

  const [activeJob, setActiveJob] = useState<JobCardType | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  // Board toolbar filters
  const [search, setSearch] = useState('')
  const [filterMechanic, setFilterMechanic] = useState('')
  const [filterStream, setFilterStream] = useState('')

  const channelRef = useRef<ReturnType<typeof subscribeToKanbanUpdates> | null>(null)

  // Require 8px movement to start drag — prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const fetchJobs = useCallback(async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const res = await fetch('/api/jobs', {
        signal: controller.signal,
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Failed to load jobs')
      }
      setJobs(json.data ?? [])
    } catch {
      toast('Failed to load jobs', 'error')
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    try {
      // Get current user's role for priority controls
      createClient().auth.getUser().then(({ data }) => {
        setUserRole(data.user?.app_metadata?.role ?? '')
      }).catch(() => {})

      void fetchJobs()
    } catch {
      setLoading(false)
    }

    // Load mechanics for board filtering
    fetch('/api/users', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.data) {
          setMechanics(
            j.data.filter((u: User) => u.role === 'mechanic' || u.role === 'pa' || u.role === 'owner')
          )
        }
      })
      .catch(() => {})

    try {
      // Realtime
      channelRef.current = subscribeToKanbanUpdates(({ eventType, job }) => {
        if (eventType === 'INSERT') {
          void fetchJobs()
          return
        }
        if (eventType === 'UPDATE') {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? { ...j, bucket: job.bucket as Bucket, status: job.status as JobCardType['status'], priority: job.priority, mechanic_id: job.mechanic_id }
                : j
            )
          )
        }
      })
    } catch {
      // Do not block board rendering if realtime subscription fails.
    }

    return () => {
      if (channelRef.current) unsubscribe(channelRef.current)
    }
  }, [fetchJobs])

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find((j) => j.id === event.active.id)
    if (job) setActiveJob(job)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveJob(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string
    const activeJobData = jobs.find((j) => j.id === activeId)
    if (!activeJobData) return

    const isBucketTarget = (BUCKET_ORDER as string[]).includes(overId)

    if (isBucketTarget) {
      // ── Cross-column: dropped directly onto an empty column drop zone ──
      const newBucket = overId as Bucket
      if (activeJobData.bucket === newBucket) return
      const newStatus = BUCKET_DEFAULT_STATUS[newBucket]
      const prevBucket = activeJobData.bucket
      const prevStatus = activeJobData.status

      setJobs((prev) =>
        prev.map((j) => j.id === activeId ? { ...j, bucket: newBucket, status: newStatus } : j)
      )
      try {
        const res = await fetch(`/api/jobs/${activeId}/transition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to_bucket: newBucket, to_status: newStatus }),
        })
        if (!res.ok) {
          setJobs((prev) =>
            prev.map((j) => j.id === activeId ? { ...j, bucket: prevBucket, status: prevStatus } : j)
          )
          toast('Failed to move job', 'error')
        } else {
          const json = await res.json()
          handleJobUpdated(json.data)
        }
      } catch {
        setJobs((prev) =>
          prev.map((j) => j.id === activeId ? { ...j, bucket: prevBucket, status: prevStatus } : j)
        )
        toast('Failed to move job', 'error')
      }
    } else {
      // ── Dropped onto another card ──
      const overJobData = jobs.find((j) => j.id === overId)
      if (!overJobData) return

      if (activeJobData.bucket === overJobData.bucket) {
        // Same column reorder — reassign priorities based on new order
        const bucketJobs = jobs
          .filter((j) => j.bucket === activeJobData.bucket)
          .sort((a, b) => b.priority - a.priority)

        const oldIdx = bucketJobs.findIndex((j) => j.id === activeId)
        const newIdx = bucketJobs.findIndex((j) => j.id === overId)
        const newOrder = arrayMove(bucketJobs, oldIdx, newIdx)

        // Priorities: top card = length, bottom = 1
        const total = newOrder.length
        const updates = newOrder.map((j, i) => ({ id: j.id, priority: total - i }))

        // Optimistic
        setJobs((prev) =>
          prev.map((j) => {
            const u = updates.find((u) => u.id === j.id)
            return u ? { ...j, priority: u.priority } : j
          })
        )

        // Persist all affected cards
        await Promise.all(
          updates.map((u) =>
            fetch(`/api/jobs/${u.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ priority: u.priority }),
            })
          )
        )
      } else {
        // Cross-column: dropped onto a card in a different column
        const newBucket = overJobData.bucket
        const newStatus = BUCKET_DEFAULT_STATUS[newBucket]
        const prevBucket = activeJobData.bucket
        const prevStatus = activeJobData.status

        setJobs((prev) =>
          prev.map((j) => j.id === activeId ? { ...j, bucket: newBucket, status: newStatus } : j)
        )
        try {
          const res = await fetch(`/api/jobs/${activeId}/transition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_bucket: newBucket, to_status: newStatus }),
          })
          if (!res.ok) {
            setJobs((prev) =>
              prev.map((j) => j.id === activeId ? { ...j, bucket: prevBucket, status: prevStatus } : j)
            )
            toast('Failed to move job', 'error')
          } else {
            const json = await res.json()
            handleJobUpdated(json.data)
          }
        } catch {
          setJobs((prev) =>
            prev.map((j) => j.id === activeId ? { ...j, bucket: prevBucket, status: prevStatus } : j)
          )
          toast('Failed to move job', 'error')
        }
      }
    }
  }

  function handleJobUpdated(updated: JobCardType) {
    // If archived, remove from board
    if ('archived_at' in updated && (updated as { archived_at: string | null }).archived_at) {
      setJobs((prev) => prev.filter((j) => j.id !== updated.id))
    } else {
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)))
    }
  }

  function handleJobCreated(job: JobCardType) {
    setCreateOpen(false)
    setJobs((prev) => [job, ...prev])
  }

  async function handlePriorityChange(jobId: string, direction: 'up' | 'down') {
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return
    const bucketJobs = jobs
      .filter((j) => j.bucket === job.bucket)
      .sort((a, b) => b.priority - a.priority)
    const idx = bucketJobs.findIndex((j) => j.id === jobId)
    let newPriority: number
    if (direction === 'up') {
      if (idx === 0) return
      newPriority = bucketJobs[idx - 1].priority + 1
    } else {
      if (idx === bucketJobs.length - 1) return
      newPriority = bucketJobs[idx + 1].priority - 1
    }
    // Optimistic update
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, priority: newPriority } : j))
    // Persist
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: newPriority }),
    })
  }

  const canReorder = userRole === 'owner' || userRole === 'pa'

  const searchLower = search.toLowerCase()
  const filteredJobs = jobs.filter((j) => {
    if (search && !j.customer.full_name.toLowerCase().includes(searchLower) &&
        !j.vehicle.model.toLowerCase().includes(searchLower) &&
        !j.vehicle.make.toLowerCase().includes(searchLower) &&
        !j.description.toLowerCase().includes(searchLower)) return false
    if (filterMechanic && j.mechanic_id !== filterMechanic) return false
    if (filterStream && j.revenue_stream !== filterStream) return false
    return true
  })

  const jobsByBucket = BUCKET_ORDER.reduce<Record<Bucket, JobCardType[]>>(
    (acc, bucket) => {
      acc[bucket] = filteredJobs
        .filter((j) => j.bucket === bucket)
        .sort((a, b) => b.priority - a.priority) // highest priority at top
      return acc
    },
    {} as Record<Bucket, JobCardType[]>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Job Board"
        actions={
          <div className="flex items-center gap-3">
            {!loading && (
              <span className="text-xs text-gray-500">{jobs.length} active</span>
            )}
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              + New Job
            </Button>
          </div>
        }
      />

      {/* Board toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 flex-shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="Search customer, bike…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Mechanic filter */}
        <select
          value={filterMechanic}
          onChange={(e) => setFilterMechanic(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All mechanics</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>

        {/* Revenue stream filter */}
        <select
          value={filterStream}
          onChange={(e) => setFilterStream(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All streams</option>
          {REVENUE_STREAMS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Clear filters */}
        {(search || filterMechanic || filterStream) && (
          <button
            onClick={() => { setSearch(''); setFilterMechanic(''); setFilterStream('') }}
            className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-white bg-gray-800 border border-gray-700 rounded-lg transition-colors"
          >
            Clear
          </button>
        )}

        {/* Job count when filtered */}
        {(search || filterMechanic || filterStream) && (
          <span className="text-xs text-gray-500 ml-1">
            {filteredJobs.length} of {jobs.length} jobs
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveJob(null)}
          onDragEnd={handleDragEnd}
        >
          {/* Horizontally scrollable board */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 h-full p-4" style={{ minWidth: 'max-content' }}>
              {BUCKET_ORDER.map((bucket) => (
                <div key={bucket} className="flex flex-col h-full w-[280px] flex-shrink-0">
                  <KanbanColumn
                    bucket={bucket}
                    jobs={jobsByBucket[bucket]}
                    canReorder={canReorder}
                    onPriorityChange={handlePriorityChange}
                  />
                </div>
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeJob ? (
              <div className="w-[280px]">
                <JobCard job={activeJob} isDragOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Job" size="lg">
        <NewJobForm onSuccess={handleJobCreated} onCancel={() => setCreateOpen(false)} />
      </Modal>
    </div>
  )
}
