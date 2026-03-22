import Image from 'next/image'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { StatusBadge, RevenueStreamBadge } from '@/components/ui/StatusBadge'
import type { JobCard as JobCardType } from '@/types/kanban'

const MAKE_SHORT: Record<string, string> = {
  honda: 'HND', yamaha: 'YAM', kawasaki: 'KAW', suzuki: 'SUZ',
  ducati: 'DUC', bmw: 'BMW', triumph: 'TRI', ktm: 'KTM',
  royal_enfield: 'RE', harley_davidson: 'H-D', aprilia: 'APR',
  husqvarna: 'HQV', benelli: 'BEN', cfmoto: 'CFM', other: '—',
}

const LOGISTICS_LABEL: Record<string, string> = {
  drop_off: 'Drop-off',
  pickup:   'Pickup',
}

interface JobCardProps {
  job: JobCardType
  isDragOverlay?: boolean
  position?: number
  canReorder?: boolean
  isFirst?: boolean
  isLast?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function JobCard({
  job,
  isDragOverlay = false,
  position,
  canReorder,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: JobCardProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: job.id, data: { job }, disabled: isDragOverlay })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Bilingual description — take the English part (after ' / ') if present
  const englishDesc = job.description.includes(' / ')
    ? job.description.split(' / ')[1].slice(0, 80)
    : job.description.slice(0, 80)

  const make = MAKE_SHORT[job.vehicle.make] ?? job.vehicle.make.slice(0, 3).toUpperCase()
  const vehicleLabel = `${job.vehicle.year} ${make} ${job.vehicle.model}`

  const daysSince = Math.floor(
    (Date.now() - new Date(job.created_at).getTime()) / 86_400_000
  )
  const isStale = daysSince >= 3
  const hasPendingScope = job.scope_changes?.some((s) => s.status === 'flagged')
  const photoUrl = job.intake_photos?.[0] ?? null

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : listeners)}
      {...(isDragOverlay ? {} : attributes)}
      className={`
        rounded-xl overflow-hidden select-none cursor-grab active:cursor-grabbing
        border transition-all duration-150
        ${isDragging && !isDragOverlay
          ? 'opacity-40 border-dashed border-gray-600'
          : 'border-gray-700 hover:border-gray-500'}
        ${isDragOverlay ? 'shadow-2xl rotate-1 border-indigo-500' : ''}
        bg-gray-800
      `}
    >
      {/* ── Photo / placeholder ── */}
      <div className="relative w-full h-[130px] bg-gray-900 overflow-hidden flex-shrink-0">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={vehicleLabel}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
            No photo yet
          </div>
        )}

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/30 to-transparent" />

        {/* Top-left: position badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {position != null && !isDragOverlay && (
            <span className="text-xs font-bold bg-black/60 text-white rounded px-1.5 py-0.5 backdrop-blur-sm">
              #{position}
            </span>
          )}
          {job.logistics_type && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium backdrop-blur-sm ${
                job.logistics_type === 'pickup'
                  ? 'bg-amber-900/80 text-amber-300'
                  : 'bg-blue-900/80 text-blue-300'
              }`}
            >
              {LOGISTICS_LABEL[job.logistics_type]}
            </span>
          )}
        </div>

        {/* Top-right: stale + scope alerts */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {hasPendingScope && !isDragOverlay && (
            <span className="w-2 h-2 rounded-full bg-orange-400" title="Scope change needs review" />
          )}
          {isStale && (
            <span className="text-xs bg-black/60 text-orange-300 rounded px-1.5 py-0.5 backdrop-blur-sm" title={`${daysSince} days old`}>
              {daysSince}d
            </span>
          )}
        </div>

        {/* Bottom: vehicle + customer overlaid on gradient */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
          <p className="text-sm font-semibold text-white truncate leading-tight drop-shadow">
            {job.vehicle.make.charAt(0).toUpperCase() + job.vehicle.make.slice(1)} {job.vehicle.model}
          </p>
          <p className="text-xs text-gray-300 truncate drop-shadow">{job.customer.full_name}</p>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="px-2.5 pt-2 pb-2.5 space-y-2">
        {/* License plate */}
        {job.vehicle.license_plate && (
          <p className="text-xs font-mono text-gray-500">{job.vehicle.license_plate}</p>
        )}

        {/* Description */}
        {englishDesc && (
          <p className="text-xs text-gray-400 line-clamp-2 leading-snug">{englishDesc}</p>
        )}

        {/* Footer row: status + revenue stream */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <StatusBadge status={job.status} size="sm" />
          <div className="flex items-center gap-1">
            {job.revenue_stream && <RevenueStreamBadge stream={job.revenue_stream} />}
          </div>
        </div>

        {/* Mechanic */}
        {job.mechanic && (
          <p className="text-xs text-gray-500 truncate">{job.mechanic.full_name}</p>
        )}
      </div>

      {!isDragOverlay && (
        <div className="border-t border-gray-700/50 px-2.5 pb-2 pt-2 space-y-2">
          <a
            href={`/jobs/${job.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="block w-full rounded-lg bg-emerald-600 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-emerald-500"
          >
            See More Details
          </a>

          {/* Priority reorder (owner/PA only) */}
          {canReorder && (
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
                disabled={isFirst}
                className="flex-1 rounded bg-gray-900 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                title="Move up (higher priority)"
              >↑</button>
              <button
                onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
                disabled={isLast}
                className="flex-1 rounded bg-gray-900 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                title="Move down (lower priority)"
              >↓</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
