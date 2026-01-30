'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Pause, StopCircle, Clock, Timer } from 'lucide-react'

interface WorkOrderTimerProps {
  workOrderId: string
  initialStartedAt?: string | null
  isRunning?: boolean
  onStart?: () => Promise<void>
  onPause?: () => Promise<void>
  onStop?: () => Promise<void>
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function WorkOrderTimer({
  workOrderId,
  initialStartedAt,
  isRunning: externalIsRunning,
  onStart,
  onPause,
  onStop,
  disabled = false,
  size = 'md'
}: WorkOrderTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(externalIsRunning ?? false)
  const [startTime, setStartTime] = useState<Date | null>(
    initialStartedAt ? new Date(initialStartedAt) : null
  )
  const [isLoading, setIsLoading] = useState(false)

  // Calculate elapsed time based on startedAt
  useEffect(() => {
    if (initialStartedAt) {
      const start = new Date(initialStartedAt)
      setStartTime(start)
      const now = new Date()
      const seconds = Math.floor((now.getTime() - start.getTime()) / 1000)
      setElapsedSeconds(Math.max(0, seconds))
      setIsRunning(true)
    }
  }, [initialStartedAt])

  // Sync with external isRunning prop
  useEffect(() => {
    if (externalIsRunning !== undefined) {
      setIsRunning(externalIsRunning)
    }
  }, [externalIsRunning])

  // Timer tick
  useEffect(() => {
    if (!isRunning || !startTime) return

    const interval = setInterval(() => {
      const now = new Date()
      const seconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)
      setElapsedSeconds(Math.max(0, seconds))
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, startTime])

  const formatTime = useCallback((totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }, [])

  const handleStart = async () => {
    if (disabled || isLoading) return
    setIsLoading(true)
    try {
      if (onStart) {
        await onStart()
      } else {
        // Default API call to start work
        const response = await fetch(`/api/work-orders/${workOrderId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        if (!response.ok) throw new Error('Failed to start timer')
      }
      const now = new Date()
      setStartTime(now)
      setIsRunning(true)
    } catch (error) {
      console.error('Failed to start timer:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePause = async () => {
    if (disabled || isLoading) return
    setIsLoading(true)
    try {
      if (onPause) {
        await onPause()
      }
      setIsRunning(false)
    } catch (error) {
      console.error('Failed to pause timer:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    if (disabled || isLoading) return
    setIsLoading(true)
    try {
      if (onStop) {
        await onStop()
      }
      setIsRunning(false)
      setStartTime(null)
      setElapsedSeconds(0)
    } catch (error) {
      console.error('Failed to stop timer:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Size variants
  const sizeClasses = {
    sm: {
      container: 'p-2',
      time: 'text-xl font-mono',
      button: 'p-1.5',
      icon: 'w-4 h-4',
      label: 'text-xs'
    },
    md: {
      container: 'p-4',
      time: 'text-3xl font-mono',
      button: 'p-2',
      icon: 'w-5 h-5',
      label: 'text-sm'
    },
    lg: {
      container: 'p-6',
      time: 'text-5xl font-mono',
      button: 'p-3',
      icon: 'w-6 h-6',
      label: 'text-base'
    }
  }

  const classes = sizeClasses[size]

  return (
    <div className={`bg-gray-900 rounded-lg ${classes.container}`}>
      {/* Timer display */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <Timer className={`${classes.icon} text-gray-400`} />
        <span className={`${classes.time} text-white tabular-nums`}>
          {formatTime(elapsedSeconds)}
        </span>
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
        <span className={`${classes.label} text-gray-400`}>
          {isRunning ? 'Running' : elapsedSeconds > 0 ? 'Paused' : 'Ready'}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={disabled || isLoading}
            className={`${classes.button} bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            <Play className={classes.icon} />
            <span className={classes.label}>{elapsedSeconds > 0 ? 'Resume' : 'Start Work'}</span>
          </button>
        ) : (
          <>
            <button
              onClick={handlePause}
              disabled={disabled || isLoading}
              className={`${classes.button} bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
            >
              <Pause className={classes.icon} />
              <span className={classes.label}>Pause</span>
            </button>
          </>
        )}

        {elapsedSeconds > 0 && !isRunning && onStop && (
          <button
            onClick={handleStop}
            disabled={disabled || isLoading}
            className={`${classes.button} bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            <StopCircle className={classes.icon} />
            <span className={classes.label}>Reset</span>
          </button>
        )}
      </div>

      {/* Started at time */}
      {startTime && (
        <div className="mt-3 text-center">
          <span className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            Started at {startTime.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  )
}
