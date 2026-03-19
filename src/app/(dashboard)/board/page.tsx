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
import { JobDrawer } from '@/components/jobs/JobDrawer'
import { NewJobForm } from '@/components/jobs/NewJobForm'
import { useToast } from '@/components/ui/Toast'
import { subscribeToKanbanUpdates, unsubscribe } from '@/lib/supabase/realtime'
import { createClient } from '@/lib/supabase/client'
import { BUCKET_ORDER, BUCKET_DEFAULT_STATUS } from '@/types/kanban'
import type { Bucket, User } from '@/types/domain'
import type { JobCard as JobCardType } from '@/types/kanban'

export default function BoardPage() {
  const { toast } = useToast()
  const [jobs, setJobs] = useState<JobCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [mechanics, setMechanics] = useState<Pick<User, 'id' | 'full_name'>[]>([])

  const [activeJob, setActiveJob] = useState<JobCardType | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')

  const channelRef = useRef<ReturnType<typeof subscribeToKanbanUpdates> | null>(null)

  // Require 8px movement to start drag — prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      const json = await res.json()
      setJobs(json.data ?? [])
    } catch {
      toast('Failed to load jobs', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // Get current user's role for priority controls
    createClient().auth.getUser().then(({ data }) => {
      setUserRole(data.user?.app_metadata?.role ?? '')
    })

    fetchJobs()

    // Load mechanics for JobDrawer assignment dropdown
    fetch('/api/users')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.data) {
          setMechanics(
            j.data.filter((u: User) => u.role === 'mechanic' || u.role === 'pa' || u.role === 'owner')
          )
        }
      })
      .catch(() => {})

    // Realtime
    channelRef.current = subscribeToKanbanUpdates(({ eventType, job }) => {
      if (eventType === 'INSERT') {
        // Refetch to get joined customer/vehicle data
        fetchJobs()
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
        const res = await fetch(`/api/jobs/${activeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket: newBucket, status: newStatus }),
        })
        if (!res.ok) {
          setJobs((prev) =>
            prev.map((j) => j.id === activeId ? { ...j, bucket: prevBucket, status: prevStatus } : j)
          )
          toast('Failed to move job', 'error')
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
          const res = await fetch(`/api/jobs/${activeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucket: newBucket, status: newStatus }),
          })
          if (!res.ok) {
            setJobs((prev) =>
              prev.map((j) => j.id === activeId ? { ...j, bucket: prevBucket, status: prevStatus } : j)
            )
            toast('Failed to move job', 'error')
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

  const jobsByBucket = BUCKET_ORDER.reduce<Record<Bucket, JobCardType[]>>(
    (acc, bucket) => {
      acc[bucket] = jobs
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

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Horizontally scrollable board */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 h-full p-4" style={{ minWidth: 'max-content' }}>
              {BUCKET_ORDER.map((bucket) => (
                <div key={bucket} className="flex flex-col h-full w-[248px] flex-shrink-0">
                  <KanbanColumn
                    bucket={bucket}
                    jobs={jobsByBucket[bucket]}
                    onCardClick={(job) => setSelectedJobId(job.id)}
                    canReorder={canReorder}
                    onPriorityChange={handlePriorityChange}
                  />
                </div>
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeJob ? (
              <div className="w-[248px]">
                <JobCard job={activeJob} onClick={() => {}} isDragOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Job" size="lg">
        <NewJobForm onSuccess={handleJobCreated} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <JobDrawer
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onJobUpdated={handleJobUpdated}
        mechanics={mechanics}
      />
    </div>
  )
}
