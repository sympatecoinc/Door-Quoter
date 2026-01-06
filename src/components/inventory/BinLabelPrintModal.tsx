'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Printer, Download } from 'lucide-react'
import { BinLocation } from '@/types/bin-location'
import QRCode from 'qrcode'

interface BinLabelPrintModalProps {
  binLocation: BinLocation
  onClose: () => void
}

type LabelSize = 'small' | 'medium' | 'large'

const LABEL_SIZES = {
  small: { width: 200, height: 150, qrSize: 80, fontSize: { code: 16, name: 12, desc: 10 } },
  medium: { width: 300, height: 200, qrSize: 120, fontSize: { code: 24, name: 14, desc: 12 } },
  large: { width: 400, height: 280, qrSize: 160, fontSize: { code: 32, name: 18, desc: 14 } }
}

export default function BinLabelPrintModal({ binLocation, onClose }: BinLabelPrintModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [labelSize, setLabelSize] = useState<LabelSize>('medium')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate scan URL
  const scanUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/scan/${binLocation.accessToken}`
    : ''

  useEffect(() => {
    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(scanUrl, {
          width: LABEL_SIZES[labelSize].qrSize,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        })
        setQrDataUrl(dataUrl)
      } catch (err) {
        console.error('Error generating QR code:', err)
      }
    }

    if (scanUrl) {
      generateQR()
    }
  }, [scanUrl, labelSize])

  // Draw label on canvas
  useEffect(() => {
    if (!qrDataUrl || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = LABEL_SIZES[labelSize]
    canvas.width = size.width
    canvas.height = size.height

    // Clear and fill white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)

    // Draw border
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, size.width - 2, size.height - 2)

    // Load and draw QR code
    const qrImg = new Image()
    qrImg.onload = () => {
      // Center QR code horizontally, position at top with padding
      const qrX = (size.width - size.qrSize) / 2
      const qrY = 15
      ctx.drawImage(qrImg, qrX, qrY, size.qrSize, size.qrSize)

      // Draw bin code (large, bold)
      ctx.fillStyle = '#000000'
      ctx.font = `bold ${size.fontSize.code}px system-ui, -apple-system, sans-serif`
      ctx.textAlign = 'center'
      const codeY = qrY + size.qrSize + size.fontSize.code + 10
      ctx.fillText(binLocation.code, size.width / 2, codeY)

      // Draw bin name
      ctx.font = `${size.fontSize.name}px system-ui, -apple-system, sans-serif`
      const nameY = codeY + size.fontSize.name + 5
      ctx.fillText(binLocation.name, size.width / 2, nameY)

      // Draw description if exists (truncate if too long)
      if (binLocation.description) {
        ctx.fillStyle = '#6b7280'
        ctx.font = `${size.fontSize.desc}px system-ui, -apple-system, sans-serif`
        const maxWidth = size.width - 20
        let desc = binLocation.description
        if (ctx.measureText(desc).width > maxWidth) {
          while (ctx.measureText(desc + '...').width > maxWidth && desc.length > 0) {
            desc = desc.slice(0, -1)
          }
          desc += '...'
        }
        const descY = nameY + size.fontSize.desc + 5
        ctx.fillText(desc, size.width / 2, descY)
      }
    }
    qrImg.src = qrDataUrl
  }, [qrDataUrl, binLocation, labelSize])

  const handlePrint = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const imgData = canvas.toDataURL('image/png')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bin Label - ${binLocation.code}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              img { max-width: 100%; }
            }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          <img src="${imgData}" alt="Bin Label" />
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `bin-label-${binLocation.code}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Print Bin Label
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Size Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label Size
            </label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as LabelSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setLabelSize(size)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    labelSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Label Preview */}
          <div className="border rounded-lg p-4 bg-gray-50 flex justify-center">
            <canvas
              ref={canvasRef}
              className="border border-gray-200 shadow-sm"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>

          {/* Scan URL Info */}
          <div className="text-xs text-gray-500 text-center">
            <p>Scan URL: <code className="bg-gray-100 px-1 py-0.5 rounded">{scanUrl}</code></p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
