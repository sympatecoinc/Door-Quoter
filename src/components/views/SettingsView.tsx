'use client'

import { useState, useEffect } from 'react'
import { Download, Save } from 'lucide-react'

export default function SettingsView() {
  const [companyName, setCompanyName] = useState('')
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [defaultMarkup, setDefaultMarkup] = useState('')
  const [quoteValidity, setQuoteValidity] = useState('')
  const [unitSystem, setUnitSystem] = useState('imperial')
  const [precision, setPrecision] = useState('2')
  const [saving, setSaving] = useState(false)

  // Load saved settings on component mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('appSettings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        setCompanyName(settings.companyName || '')
        setDefaultCurrency(settings.defaultCurrency || 'USD')
        setDefaultMarkup(settings.defaultMarkup || '')
        setQuoteValidity(settings.quoteValidity || '')
        setUnitSystem(settings.unitSystem || 'imperial')
        setPrecision(settings.precision || '2')
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }, [])

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      // Here you would typically save to a database or API
      // For now, we'll just save to localStorage as a demo
      const settings = {
        companyName,
        defaultCurrency,
        defaultMarkup,
        quoteValidity,
        unitSystem,
        precision
      }
      
      localStorage.setItem('appSettings', JSON.stringify(settings))
      alert('Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const downloadBOMTemplate = () => {
    const csvContent = `partNumber,quantity,formula
HW-001,4,
HW-002,3,
ALU-001,2,width + 2
ALU-002,2,height + 4
ALU-003,1,width + 1`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'product-bom-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadMasterPartsTemplate = () => {
    const csvContent = `partNumber,baseName,partType,description,unit,cost,category,orientation,isOption
HW-001,Phillips Head Screws,Hardware,Stainless steel screws for general assembly,EA,0.25,Fasteners,,FALSE
HW-002,Door Hinges,Hardware,Heavy duty hinges for door mounting,EA,12.50,Hardware,,TRUE
HW-003,Lever Handle,Hardware,Premium lever handle for interior doors,EA,45.00,Hardware,,TRUE
ALU-001,Head Jamb Extrusion,Extrusion,Top horizontal aluminum extrusion,IN,,Extrusions,Horizontal,FALSE
ALU-002,Side Jamb Extrusion,Extrusion,Vertical side aluminum extrusion,IN,,Extrusions,Vertical,FALSE
ALU-003,Sill Extrusion,Extrusion,Bottom horizontal aluminum extrusion,IN,,Extrusions,Horizontal,FALSE`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'master-parts-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Configure application preferences and defaults</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Your Company Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Currency
              </label>
              <select 
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="USD">USD ($)</option>
                <option value="CAD">CAD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quote Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Markup Percentage
              </label>
              <input
                type="number"
                value={defaultMarkup}
                onChange={(e) => setDefaultMarkup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="15"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quote Validity (Days)
              </label>
              <input
                type="number"
                value={quoteValidity}
                onChange={(e) => setQuoteValidity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="30"
                min="1"
              />
            </div>
          </div>
        </div>

        {/* Units & Measurements */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Units & Measurements</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Unit System
              </label>
              <select 
                value={unitSystem}
                onChange={(e) => setUnitSystem(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="imperial">Imperial (IN, feet)</option>
                <option value="metric">Metric (mm, cm, m)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precision (Decimal Places)
              </label>
              <select 
                value={precision}
                onChange={(e) => setPrecision(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="1">1 decimal place</option>
                <option value="2">2 decimal places</option>
                <option value="3">3 decimal places</option>
              </select>
            </div>
          </div>
        </div>

        {/* Templates & Downloads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Templates & Downloads</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">CSV Templates</h3>
              <p className="text-sm text-gray-600 mb-3">
                Download template files to help you format your data correctly for bulk imports.
              </p>
              <div className="space-y-3">
                <div>
                  <button
                    onClick={downloadMasterPartsTemplate}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Master Parts CSV Template
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    For importing parts into the master parts catalog. Includes partNumber, baseName, partType, etc.
                  </p>
                </div>
                <div>
                  <button
                    onClick={downloadBOMTemplate}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Product BOM CSV Template
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    For importing BOMs into specific products. Includes partNumber, quantity, and formula only.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}