'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Boxes,
  Scissors,
  Package,
  ClipboardCheck,
  Truck,
  Check,
  X,
  Loader2,
  Star
} from 'lucide-react'
import { WorkOrderStage } from '@prisma/client'

interface User {
  id: number
  name: string
  email: string
}

interface StationAssignment {
  id: string
  userId: number
  station: WorkOrderStage
  isPrimary: boolean
}

interface StationAssignmentManagerProps {
  onError?: (message: string) => void
  onSuccess?: (message: string) => void
}

const STATIONS: { stage: WorkOrderStage; label: string; icon: React.ReactNode; color: string }[] = [
  { stage: 'STAGED', label: 'Staging', icon: <Boxes className="w-4 h-4" />, color: 'gray' },
  { stage: 'CUTTING', label: 'Cutting', icon: <Scissors className="w-4 h-4" />, color: 'orange' },
  { stage: 'ASSEMBLY', label: 'Assembly', icon: <Package className="w-4 h-4" />, color: 'blue' },
  { stage: 'QC', label: 'QC', icon: <ClipboardCheck className="w-4 h-4" />, color: 'purple' },
  { stage: 'SHIP', label: 'Shipping', icon: <Truck className="w-4 h-4" />, color: 'green' },
]

export default function StationAssignmentManager({
  onError,
  onSuccess
}: StationAssignmentManagerProps) {
  const [users, setUsers] = useState<User[]>([])
  const [assignments, setAssignments] = useState<Map<number, StationAssignment[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [editingUser, setEditingUser] = useState<number | null>(null)
  const [selectedStations, setSelectedStations] = useState<Set<WorkOrderStage>>(new Set())
  const [primaryStation, setPrimaryStation] = useState<WorkOrderStage | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // Fetch users
      const usersRes = await fetch('/api/users')
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users || [])

        // Fetch assignments for each user
        const assignmentsMap = new Map<number, StationAssignment[]>()
        for (const user of data.users || []) {
          const assignRes = await fetch(`/api/users/${user.id}/stations`)
          if (assignRes.ok) {
            const assignData = await assignRes.json()
            assignmentsMap.set(user.id, assignData.assignments || [])
          }
        }
        setAssignments(assignmentsMap)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      onError?.('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function startEditing(userId: number) {
    const userAssignments = assignments.get(userId) || []
    const stations = new Set(userAssignments.map(a => a.station))
    const primary = userAssignments.find(a => a.isPrimary)?.station || null
    setSelectedStations(stations)
    setPrimaryStation(primary)
    setEditingUser(userId)
  }

  function toggleStation(station: WorkOrderStage) {
    setSelectedStations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(station)) {
        newSet.delete(station)
        if (primaryStation === station) {
          setPrimaryStation(newSet.size > 0 ? Array.from(newSet)[0] : null)
        }
      } else {
        newSet.add(station)
        if (!primaryStation) {
          setPrimaryStation(station)
        }
      }
      return newSet
    })
  }

  async function saveAssignments(userId: number) {
    if (selectedStations.size === 0) {
      onError?.('Please select at least one station')
      return
    }

    setSaving(userId)
    try {
      const response = await fetch(`/api/users/${userId}/stations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stations: Array.from(selectedStations),
          primaryStation
        })
      })

      if (response.ok) {
        const data = await response.json()
        setAssignments(prev => {
          const newMap = new Map(prev)
          newMap.set(userId, data.assignments)
          return newMap
        })
        setEditingUser(null)
        onSuccess?.('Station assignments updated')
      } else {
        const data = await response.json()
        onError?.(data.error || 'Failed to save assignments')
      }
    } catch (error) {
      console.error('Error saving assignments:', error)
      onError?.('Failed to save assignments')
    } finally {
      setSaving(null)
    }
  }

  async function clearAssignments(userId: number) {
    setSaving(userId)
    try {
      const response = await fetch(`/api/users/${userId}/stations`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAssignments(prev => {
          const newMap = new Map(prev)
          newMap.set(userId, [])
          return newMap
        })
        setEditingUser(null)
        onSuccess?.('Station assignments cleared')
      } else {
        onError?.('Failed to clear assignments')
      }
    } catch (error) {
      console.error('Error clearing assignments:', error)
      onError?.('Failed to clear assignments')
    } finally {
      setSaving(null)
    }
  }

  function getStationColor(color: string, isSelected: boolean) {
    if (!isSelected) return 'border-gray-200 bg-gray-50 text-gray-400'
    switch (color) {
      case 'gray': return 'border-gray-400 bg-gray-100 text-gray-700'
      case 'orange': return 'border-orange-400 bg-orange-100 text-orange-700'
      case 'blue': return 'border-blue-400 bg-blue-100 text-blue-700'
      case 'purple': return 'border-purple-400 bg-purple-100 text-purple-700'
      case 'green': return 'border-green-400 bg-green-100 text-green-700'
      default: return 'border-gray-400 bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Station Assignments</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Assign users to production stations. Users can only advance work orders at their assigned stations.
      </p>

      <div className="space-y-2">
        {users.map(user => {
          const userAssignments = assignments.get(user.id) || []
          const isEditing = editingUser === user.id
          const isSaving = saving === user.id

          return (
            <div
              key={user.id}
              className={`p-4 border rounded-lg ${isEditing ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => startEditing(user.id)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {STATIONS.map(({ stage, label, icon, color }) => {
                      const isSelected = selectedStations.has(stage)
                      const isPrimary = primaryStation === stage

                      return (
                        <button
                          key={stage}
                          onClick={() => toggleStation(stage)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${getStationColor(color, isSelected)}`}
                        >
                          {icon}
                          <span className="text-sm font-medium">{label}</span>
                          {isSelected && isPrimary && (
                            <Star className="w-3 h-3 fill-current" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {selectedStations.size > 1 && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Primary station: </span>
                      <select
                        value={primaryStation || ''}
                        onChange={(e) => setPrimaryStation(e.target.value as WorkOrderStage)}
                        className="ml-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {Array.from(selectedStations).map(stage => (
                          <option key={stage} value={stage}>
                            {STATIONS.find(s => s.stage === stage)?.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => saveAssignments(user.id)}
                      disabled={isSaving || selectedStations.size === 0}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => setEditingUser(null)}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    {userAssignments.length > 0 && (
                      <button
                        onClick={() => clearAssignments(user.id)}
                        disabled={isSaving}
                        className="ml-auto text-sm text-red-600 hover:text-red-700"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {userAssignments.length > 0 ? (
                    userAssignments.map(assignment => {
                      const stationInfo = STATIONS.find(s => s.stage === assignment.station)
                      return (
                        <div
                          key={assignment.id}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm ${getStationColor(stationInfo?.color || 'gray', true)}`}
                        >
                          {stationInfo?.icon}
                          <span>{stationInfo?.label}</span>
                          {assignment.isPrimary && (
                            <Star className="w-3 h-3 fill-current" />
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <span className="text-sm text-gray-400 italic">No stations assigned</span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No users found
          </div>
        )}
      </div>
    </div>
  )
}
