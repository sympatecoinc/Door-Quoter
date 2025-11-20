'use client'

import { useState, useEffect } from 'react'
import { ProjectStatusHistory } from '@/types'

interface StatusHistoryPanelProps {
  projectId: number
}

export default function StatusHistoryPanel({ projectId }: StatusHistoryPanelProps) {
  const [history, setHistory] = useState<ProjectStatusHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [projectId])

  async function fetchHistory() {
    try {
      const response = await fetch(`/api/projects/${projectId}/status-history`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      }
    } catch (error) {
      console.error('Error fetching status history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Status History</h3>
      {history.length === 0 ? (
        <p className="text-gray-500 text-sm">No status changes yet</p>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{entry.status}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(entry.changedAt).toLocaleString()}
                  </span>
                  {entry.changedBy && (
                    <span className="text-sm text-gray-500">by {entry.changedBy}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
