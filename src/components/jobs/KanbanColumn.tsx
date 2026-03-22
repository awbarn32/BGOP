'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { JobCard } from './JobCard'
import { BUCKET_CONFIG } from '@/types/kanban'
import type { Bucket } from '@/types/domain'
import type { JobCard as JobCardType } from '@/types/kanban'

interface KanbanColumnProps {
  bucket: Bucket
  jobs: JobCardType[]
  canReorder?: boolean
  onPriorityChange?: (jobId: string, direction: 'up' | 'down') => void
}

export function KanbanColumn({ bucket, jobs, canReorder, onPriorityChange }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: bucket })
  const config = BUCKET_CONFIG[bucket]

  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className={`bg-gray-800/80 rounded-t-xl border border-gray-700 border-t-2 ${config.color} px-3 py-2.5 flex-shrink-0`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wide ${config.textColor}`}>
            {config.label}
          </span>
          <span className="text-xs text-gray-500 bg-gray-700 rounded-full px-1.5 py-0.5 font-medium">
            {jobs.length}
          </span>
        </div>
      </div>

      {/* Drop zone — scrolls internally */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 rounded-b-xl border border-t-0 border-gray-700 p-2 space-y-2
          overflow-y-auto min-h-[100px]
          transition-colors
          ${isOver ? 'bg-gray-700/60 border-gray-500' : 'bg-gray-800/30'}
        `}
      >
        <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map((job, idx) => (
            <JobCard
              key={job.id}
              job={job}
              position={idx + 1}
              canReorder={canReorder}
              isFirst={idx === 0}
              isLast={idx === jobs.length - 1}
              onMoveUp={() => onPriorityChange?.(job.id, 'up')}
              onMoveDown={() => onPriorityChange?.(job.id, 'down')}
            />
          ))}
        </SortableContext>

        {jobs.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 text-gray-600 text-xs">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}
