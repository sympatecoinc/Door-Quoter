import { ProjectStatus, STATUS_CONFIG } from '@/types'

interface StatusBadgeProps {
  status: ProjectStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  // Fallback for undefined status (safety check)
  if (!config) {
    return (
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
        {status || 'Unknown'}
      </span>
    )
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  )
}
