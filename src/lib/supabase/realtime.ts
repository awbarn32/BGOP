'use client'

import { createClient } from './client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type KanbanUpdate = {
  id: string
  bucket: string
  status: string
  priority: number
  mechanic_id: string | null
}

/**
 * Subscribe to real-time changes on the jobs table for the Kanban board.
 * Fires onUpdate whenever a job's bucket, status, priority, or mechanic changes.
 */
export function subscribeToKanbanUpdates(
  onUpdate: (payload: { eventType: string; job: KanbanUpdate }) => void
): RealtimeChannel {
  const supabase = createClient()

  const channel = supabase
    .channel('kanban-board')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: 'archived_at=is.null',
      },
      (payload) => {
        if (payload.eventType === 'DELETE') return

        const job = payload.new as KanbanUpdate
        onUpdate({ eventType: payload.eventType, job })
      }
    )
    .subscribe()

  return channel
}

export function unsubscribe(channel: RealtimeChannel) {
  const supabase = createClient()
  supabase.removeChannel(channel)
}
