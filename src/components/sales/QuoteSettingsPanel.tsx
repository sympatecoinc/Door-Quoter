'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Settings, DollarSign, Percent, Wrench, RefreshCw, Image } from 'lucide-react'

interface PricingMode {
  id: number
  name: string
  description?: string
  isDefault: boolean
  extrusionCostingMethod: string
}

interface ProjectSettings {
  pricingModeId: number | null
  taxRate: number
  installationMethod: string
  installationComplexity: string
  manualInstallationCost: number
  quoteDrawingView: 'ELEVATION' | 'PLAN'
}

interface QuoteSettingsPanelProps {
  projectId: number
  onSettingsChanged?: () => void
}

const COMPLEXITY_OPTIONS = [
  { value: 'SIMPLE', label: 'Simple', multiplier: 0.9, description: '90% of base' },
  { value: 'STANDARD', label: 'Standard', multiplier: 1.0, description: '100% of base' },
  { value: 'COMPLEX', label: 'Complex', multiplier: 1.2, description: '120% of base' },
  { value: 'VERY_COMPLEX', label: 'Very Complex', multiplier: 1.5, description: '150% of base' },
]

export default function QuoteSettingsPanel({ projectId, onSettingsChanged }: QuoteSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pricingModes, setPricingModes] = useState<PricingMode[]>([])
  const [settings, setSettings] = useState<ProjectSettings>({
    pricingModeId: null,
    taxRate: 0,
    installationMethod: 'MANUAL',
    installationComplexity: 'STANDARD',
    manualInstallationCost: 0,
    quoteDrawingView: 'ELEVATION',
  })
  const [calculatedInstallation, setCalculatedInstallation] = useState<number | null>(null)

  // Fetch pricing modes and project settings
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [modesRes, projectRes] = await Promise.all([
        fetch('/api/pricing-modes'),
        fetch(`/api/projects/${projectId}`),
      ])

      if (modesRes.ok) {
        const modes = await modesRes.json()
        setPricingModes(modes)
      }

      if (projectRes.ok) {
        const project = await projectRes.json()
        setSettings({
          pricingModeId: project.pricingModeId || project.pricingMode?.id || null,
          taxRate: project.taxRate || 0,
          installationMethod: project.installationMethod || 'MANUAL',
          installationComplexity: project.installationComplexity || 'STANDARD',
          manualInstallationCost: project.manualInstallationCost || 0,
          quoteDrawingView: project.quoteDrawingView || 'ELEVATION',
        })
      }
    } catch (error) {
      console.error('Error fetching quote settings:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Fetch calculated installation cost when using PER_PRODUCT_TOTAL
  const fetchCalculatedInstallation = useCallback(async () => {
    if (settings.installationMethod !== 'PER_PRODUCT_TOTAL') {
      setCalculatedInstallation(null)
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/quote`)
      if (response.ok) {
        const data = await response.json()
        setCalculatedInstallation(data.installationCost || 0)
      }
    } catch (error) {
      console.error('Error fetching calculated installation:', error)
    }
  }, [projectId, settings.installationMethod])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!loading) {
      fetchCalculatedInstallation()
    }
  }, [fetchCalculatedInstallation, loading, settings.installationComplexity])

  // Save settings to project
  const saveSettings = async (updates: Partial<ProjectSettings>) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        setSettings(prev => ({ ...prev, ...updates }))
        onSettingsChanged?.()

        // Refetch calculated installation if method changed
        if (updates.installationMethod || updates.installationComplexity) {
          setTimeout(fetchCalculatedInstallation, 100)
        }
      } else {
        console.error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePricingModeChange = (modeId: number | null) => {
    saveSettings({ pricingModeId: modeId })
  }

  const handleTaxRateChange = (rate: number) => {
    saveSettings({ taxRate: rate / 100 }) // Convert percentage to decimal
  }

  const handleInstallationMethodChange = (method: string) => {
    saveSettings({ installationMethod: method })
  }

  const handleComplexityChange = (complexity: string) => {
    saveSettings({ installationComplexity: complexity })
  }

  const handleManualCostChange = (cost: number) => {
    saveSettings({ manualInstallationCost: cost })
  }

  const handleDrawingViewChange = (view: 'ELEVATION' | 'PLAN') => {
    saveSettings({ quoteDrawingView: view })
  }

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const selectedMode = pricingModes.find(m => m.id === settings.pricingModeId)

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-900">Quote Settings</span>
          {!isExpanded && selectedMode && (
            <span className="text-sm text-gray-500 ml-2">
              ({selectedMode.name}
              {settings.taxRate > 0 && `, ${(settings.taxRate * 100).toFixed(1)}% tax`}
              {settings.installationMethod === 'MANUAL' && settings.manualInstallationCost > 0 &&
                `, ${formatPrice(settings.manualInstallationCost)} install`}
              {settings.installationMethod === 'PER_PRODUCT_TOTAL' &&
                `, ${settings.installationComplexity.toLowerCase()} install`})
            </span>
          )}
          {saving && (
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin ml-2" />
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {loading ? (
            <div className="py-4 text-center text-gray-500">Loading settings...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-4">
              {/* Pricing Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Pricing Mode
                </label>
                <select
                  value={settings.pricingModeId || ''}
                  onChange={(e) => handlePricingModeChange(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select pricing mode</option>
                  {pricingModes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.name} {mode.isDefault && '(Default)'}
                    </option>
                  ))}
                </select>
                {selectedMode?.description && (
                  <p className="text-xs text-gray-500 mt-1">{selectedMode.description}</p>
                )}
              </div>

              {/* Tax Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Percent className="w-4 h-4" />
                  Tax Rate
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={(settings.taxRate * 100).toFixed(1)}
                    onChange={(e) => handleTaxRateChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
              </div>

              {/* Installation Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Wrench className="w-4 h-4" />
                  Installation
                </label>
                <select
                  value={settings.installationMethod}
                  onChange={(e) => handleInstallationMethodChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="MANUAL">Manual Amount</option>
                  <option value="PER_PRODUCT_TOTAL">Per Product (Auto)</option>
                </select>
              </div>

              {/* Installation Cost/Complexity */}
              <div>
                {settings.installationMethod === 'MANUAL' ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Installation Cost
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settings.manualInstallationCost}
                        onChange={(e) => handleManualCostChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 pl-7 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Complexity
                    </label>
                    <select
                      value={settings.installationComplexity}
                      onChange={(e) => handleComplexityChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      {COMPLEXITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} ({opt.description})
                        </option>
                      ))}
                    </select>
                    {calculatedInstallation !== null && (
                      <p className="text-xs text-gray-500 mt-1">
                        Calculated: {formatPrice(calculatedInstallation)}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Drawing View */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Image className="w-4 h-4" />
                  Quote Drawings
                </label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleDrawingViewChange('ELEVATION')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      settings.quoteDrawingView === 'ELEVATION'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Elevation
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDrawingViewChange('PLAN')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                      settings.quoteDrawingView === 'PLAN'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Plan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
