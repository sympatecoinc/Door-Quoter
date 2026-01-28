'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { Camera, CameraOff, Volume2, VolumeX, RefreshCw } from 'lucide-react'

interface PackingScannerProps {
  onScan: (qrData: string) => Promise<void>
  disabled?: boolean
  lastScanResult?: {
    success: boolean
    message: string
  } | null
}

export default function PackingScanner({
  onScan,
  disabled = false,
  lastScanResult
}: PackingScannerProps) {
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastScannedData, setLastScannedData] = useState<string | null>(null)
  const [scanCooldown, setScanCooldown] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Audio refs for feedback sounds
  const successSoundRef = useRef<HTMLAudioElement | null>(null)
  const errorSoundRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Create audio elements for feedback
    if (typeof window !== 'undefined') {
      successSoundRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleTA7oeDYpnUfCEyn4c6cYhsRWbLn2ah0GAA/')
      errorSoundRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19teleXlpeam5ydnZ6telehoaGjpKWmpqamp6empqalpKOio6KhoaCfn5+enZ2cnJubmpqZmZiYl5eWlpaVlJSTk5KSkZGQkI+Pjo6NjYyMi4uKiomJiIiHh4aGhYWEhIODgoKBgYCAgH9/')
    }
  }, [])

  const playSound = useCallback((success: boolean) => {
    if (!soundEnabled) return

    const sound = success ? successSoundRef.current : errorSoundRef.current
    if (sound) {
      sound.currentTime = 0
      sound.play().catch(() => {
        // Ignore autoplay errors
      })
    }
  }, [soundEnabled])

  const triggerVibration = useCallback((success: boolean) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (success) {
        navigator.vibrate([100, 50, 100]) // Success pattern: short-pause-short
      } else {
        navigator.vibrate([300]) // Error pattern: long vibration
      }
    }
  }, [])

  const handleScan = useCallback(async (result: { rawValue: string }[]) => {
    if (disabled || isProcessing || scanCooldown || !result?.length) return

    const qrData = result[0].rawValue
    if (!qrData || qrData === lastScannedData) return

    setIsProcessing(true)
    setLastScannedData(qrData)
    setScanCooldown(true)

    try {
      await onScan(qrData)
    } finally {
      setIsProcessing(false)
      // Prevent rapid re-scanning of same code
      setTimeout(() => {
        setScanCooldown(false)
        setLastScannedData(null)
      }, 2000)
    }
  }, [disabled, isProcessing, scanCooldown, lastScannedData, onScan])

  // Play feedback when scan result changes
  useEffect(() => {
    if (lastScanResult) {
      playSound(lastScanResult.success)
      triggerVibration(lastScanResult.success)
    }
  }, [lastScanResult, playSound, triggerVibration])

  const handleCameraError = useCallback((error: Error) => {
    console.error('Camera error:', error)
    setCameraError(error.message || 'Failed to access camera')
    setCameraEnabled(false)
  }, [])

  const retryCamera = useCallback(() => {
    setCameraError(null)
    setCameraEnabled(true)
  }, [])

  return (
    <div className="relative w-full">
      {/* Scanner Controls */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCameraEnabled(!cameraEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              cameraEnabled
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-500'
            }`}
            title={cameraEnabled ? 'Disable camera' : 'Enable camera'}
          >
            {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              soundEnabled
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-500'
            }`}
            title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>

        {isProcessing && (
          <span className="text-sm text-blue-600 font-medium animate-pulse">
            Processing...
          </span>
        )}
      </div>

      {/* Camera View */}
      <div className="relative aspect-square w-full max-w-md mx-auto bg-gray-900 rounded-xl overflow-hidden">
        {cameraEnabled && !cameraError ? (
          <>
            <Scanner
              onScan={handleScan}
              onError={handleCameraError}
              constraints={{
                facingMode: 'environment'
              }}
              styles={{
                container: {
                  width: '100%',
                  height: '100%'
                },
                video: {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }
              }}
              components={{
                audio: false,
                torch: true
              }}
            />

            {/* Scanning overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner markers */}
              <div className="absolute top-8 left-8 w-16 h-16 border-l-4 border-t-4 border-white/70 rounded-tl-lg" />
              <div className="absolute top-8 right-8 w-16 h-16 border-r-4 border-t-4 border-white/70 rounded-tr-lg" />
              <div className="absolute bottom-8 left-8 w-16 h-16 border-l-4 border-b-4 border-white/70 rounded-bl-lg" />
              <div className="absolute bottom-8 right-8 w-16 h-16 border-r-4 border-b-4 border-white/70 rounded-br-lg" />

              {/* Scan line animation */}
              <div className="absolute left-8 right-8 top-1/2 h-0.5 bg-blue-400/50 animate-pulse" />
            </div>

            {/* Flash overlay for feedback */}
            {lastScanResult && (
              <div
                className={`absolute inset-0 transition-opacity duration-300 ${
                  lastScanResult.success
                    ? 'bg-green-500/30'
                    : 'bg-red-500/30'
                }`}
                style={{
                  animation: 'flash 0.3s ease-out'
                }}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white p-6">
            {cameraError ? (
              <>
                <CameraOff className="h-16 w-16 mb-4 text-gray-400" />
                <p className="text-center text-gray-300 mb-4">{cameraError}</p>
                <button
                  onClick={retryCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Camera
                </button>
              </>
            ) : (
              <>
                <CameraOff className="h-16 w-16 mb-4 text-gray-400" />
                <p className="text-center text-gray-300">
                  Camera disabled. Tap the camera icon above to enable.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Last scan result message */}
      {lastScanResult && (
        <div
          className={`mt-3 p-3 rounded-lg text-center font-medium ${
            lastScanResult.success
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {lastScanResult.message}
        </div>
      )}

      {/* Instructions */}
      <p className="mt-3 text-center text-sm text-gray-500">
        Point camera at sticker QR code to scan
      </p>

      <style jsx>{`
        @keyframes flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
