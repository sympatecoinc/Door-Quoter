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

  // Audio context ref for generating beep sounds
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize audio context on first user interaction
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  const playSound = useCallback(async (success: boolean) => {
    if (!soundEnabled) return

    try {
      const audioContext = getAudioContext()
      if (!audioContext) return

      // Resume audio context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume()
        } catch {
          // Ignore resume errors (NotAllowedError)
          return
        }
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      if (success) {
        // Success: two quick high beeps
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5
        oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1) // C#6
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.2)
      } else {
        // Error: one low beep
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime) // A3
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
      }
    } catch {
      // Ignore audio errors
    }
  }, [soundEnabled, getAudioContext])

  const triggerVibration = useCallback((success: boolean) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (success) {
          navigator.vibrate([100, 50, 100]) // Success pattern: short-pause-short
        } else {
          navigator.vibrate([300]) // Error pattern: long vibration
        }
      }
    } catch {
      // Ignore vibration errors (NotAllowedError on some devices)
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
