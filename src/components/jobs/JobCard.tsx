'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { StatusBadge, RevenueStreamBadge } from '@/components/ui/StatusBadge'
import type { JobCard as JobCardType } from '@/types/kanban'

const MAKE_SHORT: Record<string, string> = {
  honda: 'HND', yamaha: 'YAM', kawasaki: 'KAW', suzuki: 'SUZ',
  ducati: 'DUC', bmw: 'BMW', triumph: 'TRI', ktm: 'KTM',
  royal_enfield: 'RE', harley_davidson: 'H-D', aprilia: 'APR',
  husqvarna: 'HQV', benelli: 'BEN', cfmoto: 'CFM', other: '—',
}

interface JobCardProps {
  job: JobCardType
  onClick: (job: JobCardType) => void
  isDragOverlay?: boolean
  position?: number
  canReorder?: boolean
  isFirst?: boolean
  isLast?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function JobCard({ job, onClick, isDragOverlay = false, position, canReorder, isFirst, isLast, onMoveUp, onMoveDown }: JobCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { job },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const englishDesc = job.description.includes(' / ')
    ? job.description.split(' / ')[1].slice(0, 60)
    : job.description.slice(0, 60)

  const make = MAKE_SHORT[job.vehicle.make] ?? job.vehicle.make.slice(0, 3).toUpperCase()
  const vehicleLabel = `${job.vehicle.year} ${make} ${job.vehicle.model}`

  const daysSince = Math.floor(
    (Date.now() - new Date(job.created_at).getTime()) / 86_400_000
  )
  const isStale = daysSince >= 3

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(job)}
      className={`
        bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer select-none
        hover:border-gray-500 hover:bg-gray-700/50 transition-colors
        ${isDragging && !isDragOverlay ? 'opacity-40 border-dashed' : ''}
        ${isDragOverlay ? 'shadow-2xl rotate-1 border-indigo-500' : ''}
      `}
    >
      {/* Customer + vehicle */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="min-w-0 flex items-start gap-1.5">
          {position != null && !isDragOverlay && (
            <span className="flex-shrink-0 min-w-[1.4rem] text-center text-xs font-bold bg-gray-700 text-white rounded px-1 py-0.5 leading-none mt-0.5">
              #{position}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {job.customer.full_name}
            </p>
            <p className="text-xs text-gray-400 truncate">{vehicleLabel}</p>
            {job.vehicle.license_plate && (
              <p className="text-xs font-mono text-gray-500">{job.vehicle.license_plate}</p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {job.logistics_type && (
            <span
              title={job.logistics_type === 'pickup' ? 'Pickup (we collect)' : 'Drop-off (customer delivers)'}
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              job.logistics_type === 'pickup'
                ? 'bg-amber-900/50 text-amber-300'
                : 'bg-blue-900/50 text-blue-300'
            }`}>
              {job.logistics_type === 'pickup' ? 'PU' : 'DO'}
            </span>
          )}
          {isStale && (
            <span className="text-xs text-orange-400" title={`${daysSince} days old`}>
              {daysSince}d
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {englishDesc && (
        <p className="text-xs text-gray-400 mb-2 line-clamp-2 leading-snug">{englishDesc}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <StatusBadge status={job.status} size="sm" />
        <div className="flex items-center gap-1">
          {job.revenue_stream && <RevenueStreamBadge stream={job.revenue_stream} />}
        </div>
      </div>

      {/* Mechanic */}
      {job.mechanic && (
        <p className="text-xs text-gray-500 mt-1.5 truncate">
          {job.mechanic.full_name}
        </p>
      )}

      {/* Priority reorder buttons — owner/PA only */}
      {canReorder && !isDragOverlay && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-gray-700/50">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
            disabled={isFirst}
            className="flex-1 text-xs py-0.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            title="Move up (higher priority)"
          >
            ↑
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
            disabled={isLast}
            className="flex-1 text-xs py-0.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            title="Move down (lower priority)"
          >
            ↓
          </button>
        </div>
      )}
    </div>
  )
}
