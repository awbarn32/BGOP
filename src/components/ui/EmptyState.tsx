interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <span className="text-2xl">🏍️</span>
      </div>
      <h3 className="text-base font-semibold text-gray-200 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
