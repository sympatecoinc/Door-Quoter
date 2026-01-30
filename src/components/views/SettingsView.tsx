'use client'

import { useState, useEffect } from 'react'
import { Download, Save, Upload, FileUp, Plus, Trash2, Edit, RefreshCw, Link as LinkIcon, CheckCircle, AlertCircle, X, Image as ImageIcon } from 'lucide-react'
import UserManagement from '../UserManagement'
import PortalManagement from '../PortalManagement'

export default function SettingsView() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [unitSystem, setUnitSystem] = useState('imperial')
  const [precision, setPrecision] = useState('2')
  const [showDashboardCRMStats, setShowDashboardCRMStats] = useState(true)
  const [saving, setSaving] = useState(false)

  // Import/Export state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  // QuickBooks state
  const [qbConnected, setQbConnected] = useState(false)
  const [qbCredentialsConfigured, setQbCredentialsConfigured] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [qbNotification, setQbNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [syncingCustomers, setSyncingCustomers] = useState(false)
  const [syncingPurchaseOrders, setSyncingPurchaseOrders] = useState(false)
  const [syncingSalesOrders, setSyncingSalesOrders] = useState(false)

  // Branding state
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#2563eb')
  const [secondaryColor, setSecondaryColor] = useState('#1e40af')
  const [loadingBranding, setLoadingBranding] = useState(true)
  const [savingBranding, setSavingBranding] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [brandingNotification, setBrandingNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Load saved settings and current user on component mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('appSettings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        setCompanyName(settings.companyName || '')
        setDefaultCurrency(settings.defaultCurrency || 'USD')
        setUnitSystem(settings.unitSystem || 'imperial')
        setPrecision(settings.precision || '2')
        setShowDashboardCRMStats(settings.showDashboardCRMStats !== undefined ? settings.showDashboardCRMStats : true)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }

    // Fetch current user session
    fetchCurrentUser()

    // Check QuickBooks status
    checkQBStatus()

    // Fetch branding settings
    fetchBrandingSettings()
  }, [])

  const fetchBrandingSettings = async () => {
    try {
      setLoadingBranding(true)
      const response = await fetch('/api/settings/branding')
      if (response.ok) {
        const data = await response.json()
        setBrandingLogo(data.logo || null)
        setPrimaryColor(data.primaryColor || '#2563eb')
        setSecondaryColor(data.secondaryColor || '#1e40af')
      }
    } catch (error) {
      console.error('Error fetching branding settings:', error)
    } finally {
      setLoadingBranding(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    setBrandingNotification(null)

    try {
      const formData = new FormData()
      formData.append('logo', file)

      const response = await fetch('/api/settings/branding', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setBrandingLogo(data.logo)
        setBrandingNotification({ type: 'success', message: 'Logo uploaded successfully!' })
      } else {
        const error = await response.json()
        setBrandingNotification({ type: 'error', message: error.error || 'Failed to upload logo' })
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      setBrandingNotification({ type: 'error', message: 'Failed to upload logo' })
    } finally {
      setUploadingLogo(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to remove the company logo?')) return

    try {
      const response = await fetch('/api/settings/branding', {
        method: 'DELETE'
      })

      if (response.ok) {
        setBrandingLogo(null)
        setBrandingNotification({ type: 'success', message: 'Logo removed successfully!' })
      } else {
        setBrandingNotification({ type: 'error', message: 'Failed to remove logo' })
      }
    } catch (error) {
      console.error('Error deleting logo:', error)
      setBrandingNotification({ type: 'error', message: 'Failed to remove logo' })
    }
  }

  const handleSaveBrandingColors = async () => {
    setSavingBranding(true)
    setBrandingNotification(null)

    try {
      const response = await fetch('/api/settings/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor, secondaryColor })
      })

      if (response.ok) {
        setBrandingNotification({ type: 'success', message: 'Brand colors saved successfully!' })
      } else {
        const error = await response.json()
        setBrandingNotification({ type: 'error', message: error.error || 'Failed to save brand colors' })
      }
    } catch (error) {
      console.error('Error saving brand colors:', error)
      setBrandingNotification({ type: 'error', message: 'Failed to save brand colors' })
    } finally {
      setSavingBranding(false)
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  const checkQBStatus = async () => {
    try {
      const response = await fetch('/api/quickbooks/status')
      if (response.ok) {
        const data = await response.json()
        setQbConnected(data.connected)
        setQbCredentialsConfigured(data.credentialsConfigured)
      }
    } catch (error) {
      console.error('Error checking QB status:', error)
    }
  }

  const handleConnectQB = async () => {
    try {
      const response = await fetch('/api/quickbooks/connect')
      if (response.ok) {
        const data = await response.json()
        window.location.href = data.authUrl
      } else {
        const error = await response.json()
        setQbNotification({ type: 'error', message: error.error || 'Failed to initiate QuickBooks connection' })
      }
    } catch (error) {
      console.error('Error connecting to QuickBooks:', error)
      setQbNotification({ type: 'error', message: 'Failed to connect to QuickBooks' })
    }
  }

  const handleSyncFromQB = async () => {
    setSyncing(true)
    setQbNotification(null)
    try {
      const response = await fetch('/api/vendors/sync')
      const data = await response.json()

      if (response.ok) {
        const parts = []
        if (data.pushed > 0) parts.push(`Pushed: ${data.pushed}`)
        if (data.created > 0) parts.push(`Created: ${data.created}`)
        if (data.updated > 0) parts.push(`Updated: ${data.updated}`)
        const message = parts.length > 0
          ? `2-way sync complete! ${parts.join(', ')}`
          : '2-way sync complete! No changes needed.'
        setQbNotification({ type: 'success', message })
      } else {
        setQbNotification({ type: 'error', message: data.error || 'Sync failed' })
      }
    } catch (error) {
      console.error('Error syncing vendors:', error)
      setQbNotification({ type: 'error', message: 'Failed to sync vendors' })
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncCustomers = async () => {
    setSyncingCustomers(true)
    setQbNotification(null)
    try {
      const response = await fetch('/api/customers/sync')
      const data = await response.json()

      if (response.ok) {
        const parts = []
        if (data.pushed > 0) parts.push(`Pushed: ${data.pushed}`)
        if (data.created > 0) parts.push(`Created: ${data.created}`)
        if (data.updated > 0) parts.push(`Updated: ${data.updated}`)
        const message = parts.length > 0
          ? `2-way sync complete! ${parts.join(', ')}`
          : '2-way sync complete! No changes needed.'
        setQbNotification({ type: 'success', message })
      } else {
        setQbNotification({ type: 'error', message: data.error || 'Customer sync failed' })
      }
    } catch (error) {
      console.error('Error syncing customers:', error)
      setQbNotification({ type: 'error', message: 'Failed to sync customers' })
    } finally {
      setSyncingCustomers(false)
    }
  }

  const handleSyncPurchaseOrders = async () => {
    setSyncingPurchaseOrders(true)
    setQbNotification(null)
    try {
      const response = await fetch('/api/purchase-orders/sync')
      const data = await response.json()

      if (response.ok) {
        const parts = []
        if (data.pushed > 0) parts.push(`Pushed: ${data.pushed}`)
        if (data.created > 0) parts.push(`Created: ${data.created}`)
        if (data.updated > 0) parts.push(`Updated: ${data.updated}`)
        const message = parts.length > 0
          ? `2-way sync complete! ${parts.join(', ')}`
          : '2-way sync complete! No changes needed.'
        setQbNotification({ type: 'success', message })
      } else {
        setQbNotification({ type: 'error', message: data.error || 'Purchase Orders sync failed' })
      }
    } catch (error) {
      console.error('Error syncing purchase orders:', error)
      setQbNotification({ type: 'error', message: 'Failed to sync purchase orders' })
    } finally {
      setSyncingPurchaseOrders(false)
    }
  }

  const handleSyncSalesOrders = async () => {
    setSyncingSalesOrders(true)
    setQbNotification(null)
    try {
      const response = await fetch('/api/sales-orders/sync')
      const data = await response.json()

      if (response.ok) {
        const parts = []
        if (data.pushed > 0) parts.push(`Pushed: ${data.pushed}`)
        if (data.created > 0) parts.push(`Created: ${data.created}`)
        if (data.updated > 0) parts.push(`Updated: ${data.updated}`)
        const message = parts.length > 0
          ? `2-way sync complete! ${parts.join(', ')}`
          : '2-way sync complete! No changes needed.'
        setQbNotification({ type: 'success', message })
      } else {
        setQbNotification({ type: 'error', message: data.error || 'Invoices sync failed' })
      }
    } catch (error) {
      console.error('Error syncing sales orders:', error)
      setQbNotification({ type: 'error', message: 'Failed to sync invoices' })
    } finally {
      setSyncingSalesOrders(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      // Here you would typically save to a database or API
      // For now, we'll just save to localStorage as a demo
      const settings = {
        companyName,
        defaultCurrency,
        unitSystem,
        precision,
        showDashboardCRMStats
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
    const csvContent = `partNumber,baseName,partType,description,unit,cost,weightPerUnit,weightPerFoot,isMillFinish,isOption,stockRule_stockLength,stockRule_minHeight,stockRule_maxHeight,stockRule_basePrice
HW-001,Phillips Head Screws,Hardware,Stainless steel screws for general assembly,EA,0.25,0.5,,,FALSE,,,,
HW-002,Door Hinges,Hardware,Heavy duty hinges for door mounting,EA,12.50,8.0,,,TRUE,,,,
HW-003,Lever Handle,Hardware,Premium lever handle for interior doors,EA,45.00,12.0,,,TRUE,,,,
ALU-001,Glass Stop Extrusion,Extrusion,Glazing bead extrusion for glass retention,IN,,,2.5,FALSE,FALSE,96,,96,45.00
ALU-001,Glass Stop Extrusion,Extrusion,Glazing bead extrusion for glass retention,IN,,,2.5,FALSE,FALSE,144,,144,65.00
ALU-002,Door Stile Extrusion,Extrusion,Vertical door frame extrusion,IN,,,4.8,FALSE,FALSE,192,,192,120.00
ALU-003,Header Extrusion,Extrusion,Top frame horizontal extrusion,IN,,,3.2,TRUE,FALSE,96,,96,38.00

# Notes:
# - BASIC FORMAT: One row per part (no stock rules) - detected when stockRule_ columns are empty
# - ENHANCED FORMAT: Multiple rows per part with stock rules - detected when stockRule_ columns have values
# - Cost is REQUIRED for Hardware parts and OPTIONAL for Extrusions
# - weightPerUnit: Weight in ounces for Hardware parts
# - weightPerFoot: Weight in ounces per linear foot for Extrusion parts
# - isMillFinish: TRUE for Extrusions that are mill finish only (no finish codes like -BL, -C2 appended to part numbers)
# - Extrusions use Stock Length Rules for pricing (stockRule_* columns)
# - stockRule_stockLength: Stock length in inches (e.g., 96, 144, 192)
# - stockRule_minHeight/maxHeight: Dimension constraints for rule application
# - stockRule_basePrice: Base price for this stock length
# - Unit should be 'IN' for Extrusions and varies for Hardware (EA, LF, SF, etc.)
# - isOption: TRUE allows Hardware to be used in Product sub-option categories
# - For Extrusions with multiple stock lengths, repeat the part row with different stockRule_ values
# - Duplicate part numbers will be SKIPPED (not updated) during import`

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

  const handleExportMasterParts = async () => {
    try {
      const response = await fetch('/api/master-parts/export-csv')

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `master-parts-export-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        alert('Master parts exported successfully!')
      } else {
        alert('Failed to export master parts')
      }
    } catch (error) {
      console.error('Error exporting master parts:', error)
      alert('Error exporting master parts')
    }
  }

  const handleImportMasterParts = async () => {
    if (!importFile) {
      alert('Please select a file to import')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('csvFile', importFile)

      const response = await fetch('/api/master-parts/import-with-rules', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        setImportResult(result)
        setImportFile(null)

        // Reset file input
        const fileInput = document.getElementById('import-file-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to import master parts')
      }
    } catch (error) {
      console.error('Error importing master parts:', error)
      alert('Error importing master parts')
    } finally {
      setImporting(false)
    }
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

        {/* Company Branding */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Branding</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure your company logo and brand colors for quotes and documents.
          </p>

          {/* Branding Notification */}
          {brandingNotification && (
            <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
              brandingNotification.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {brandingNotification.type === 'success'
                  ? <CheckCircle className="w-4 h-4" />
                  : <AlertCircle className="w-4 h-4" />
                }
                <span className="text-sm">{brandingNotification.message}</span>
              </div>
              <button
                onClick={() => setBrandingNotification(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loadingBranding ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-gray-600">Loading branding settings...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Logo Upload */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Logo</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Upload your company logo (PNG, JPG, SVG, or WebP, max 5MB). This will appear on quotes and documents.
                </p>
                <div className="flex items-start gap-4">
                  {/* Logo Preview */}
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                    {brandingLogo ? (
                      <img
                        src={brandingLogo}
                        alt="Company Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-8 h-8 text-gray-400 mx-auto" />
                        <span className="text-xs text-gray-400 mt-1 block">No logo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          uploadingLogo
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                        }`}>
                          {uploadingLogo ? (
                            <>
                              <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Logo
                            </>
                          )}
                        </span>
                      </label>
                      {brandingLogo && (
                        <button
                          onClick={handleDeleteLogo}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Recommended: Square or horizontal logo, at least 200x200 pixels
                    </p>
                  </div>
                </div>
              </div>

              {/* Brand Colors */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Brand Colors</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Set your primary and secondary brand colors for use in quotes and documents.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono text-sm"
                        placeholder="#2563eb"
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono text-sm"
                        placeholder="#1e40af"
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                  </div>
                </div>

                {/* Color Preview */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Preview:</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-16 h-8 rounded shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <div
                      className="w-16 h-8 rounded shadow-sm"
                      style={{ backgroundColor: secondaryColor }}
                    />
                    <span className="text-xs text-gray-500">Primary & Secondary</span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveBrandingColors}
                  disabled={savingBranding}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {savingBranding ? (
                    <>
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Brand Colors
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
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

        {/* Dashboard Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dashboard Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Show CRM Statistics
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Display customer stats, active leads, pipeline value, and conversion rate on the dashboard
                </p>
              </div>
              <button
                onClick={() => setShowDashboardCRMStats(!showDashboardCRMStats)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showDashboardCRMStats ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showDashboardCRMStats ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Calculation Equations Reference */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Calculation Equations Reference</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reference guide for formulas used in Product BOMs, extrusion lengths, and glass calculations.
            </p>

            <div className="bg-blue-50 rounded-lg p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Available Variables</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">width</span>
                  <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">height</span>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Variables are case-insensitive (WIDTH, Width, width all work the same)
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Supported Operations</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="bg-white rounded p-2 text-center">
                    <span className="font-mono text-blue-800 text-lg">+</span>
                    <p className="text-xs text-gray-600">Addition</p>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <span className="font-mono text-blue-800 text-lg">-</span>
                    <p className="text-xs text-gray-600">Subtraction</p>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <span className="font-mono text-blue-800 text-lg">*</span>
                    <p className="text-xs text-gray-600">Multiplication</p>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <span className="font-mono text-blue-800 text-lg">/</span>
                    <p className="text-xs text-gray-600">Division</p>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Parentheses ( ) and decimal numbers are also supported
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Formula Examples</h3>
                <div className="space-y-2 text-sm">
                  <div className="bg-white rounded p-2 flex justify-between items-center">
                    <code className="font-mono text-gray-800">width + 2</code>
                    <span className="text-xs text-gray-500">Add 2 inches to width</span>
                  </div>
                  <div className="bg-white rounded p-2 flex justify-between items-center">
                    <code className="font-mono text-gray-800">height - 4.094</code>
                    <span className="text-xs text-gray-500">Subtract from height</span>
                  </div>
                  <div className="bg-white rounded p-2 flex justify-between items-center">
                    <code className="font-mono text-gray-800">width / 4 - 4.094</code>
                    <span className="text-xs text-gray-500">Quarter width minus offset</span>
                  </div>
                  <div className="bg-white rounded p-2 flex justify-between items-center">
                    <code className="font-mono text-gray-800">(width + height) * 2</code>
                    <span className="text-xs text-gray-500">Perimeter calculation</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              These formulas are used when adding extrusion parts to Product BOMs and for glass size calculations.
            </p>
          </div>
        </div>

        {/* QuickBooks Integration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">QuickBooks Integration</h2>

          {/* QB Notification */}
          {qbNotification && (
            <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
              qbNotification.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {qbNotification.type === 'success'
                  ? <CheckCircle className="w-4 h-4" />
                  : <AlertCircle className="w-4 h-4" />
                }
                <span className="text-sm">{qbNotification.message}</span>
              </div>
              <button
                onClick={() => setQbNotification(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!qbCredentialsConfigured ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">QuickBooks Not Configured</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    To enable QuickBooks integration, add your QuickBooks API credentials to the .env file.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {qbConnected ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Connected to QuickBooks</p>
                        <p className="text-sm text-gray-600">Your account is linked and ready to sync</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-gray-900">Not Connected</p>
                        <p className="text-sm text-gray-600">Connect to sync vendors with QuickBooks</p>
                      </div>
                    </>
                  )}
                </div>
                {!qbConnected && (
                  <button
                    onClick={handleConnectQB}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Connect QuickBooks
                  </button>
                )}
              </div>

              {qbConnected && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Sync Options</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSyncFromQB}
                      disabled={syncing}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Syncing...' : 'Sync Vendors'}
                    </button>
                    <button
                      onClick={handleSyncCustomers}
                      disabled={syncingCustomers}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingCustomers ? 'animate-spin' : ''}`} />
                      {syncingCustomers ? 'Syncing...' : 'Sync Customers'}
                    </button>
                    <button
                      onClick={handleSyncPurchaseOrders}
                      disabled={syncingPurchaseOrders}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingPurchaseOrders ? 'animate-spin' : ''}`} />
                      {syncingPurchaseOrders ? 'Syncing...' : 'Sync Purchase Orders'}
                    </button>
                    <button
                      onClick={handleSyncSalesOrders}
                      disabled={syncingSalesOrders}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingSalesOrders ? 'animate-spin' : ''}`} />
                      {syncingSalesOrders ? 'Syncing...' : 'Sync Invoices'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    All syncs are 2-way: pushes local records to QuickBooks, then pulls QB records to local.
                    Records are matched by QuickBooks ID to prevent duplicates.
                  </p>
                </div>
              )}
            </div>
          )}
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

        {/* Export Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Export</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Export Master Parts</h3>
              <p className="text-sm text-gray-600 mb-3">
                Export all master parts with their pricing rules. This format includes stock length rules for extrusions and can be re-imported.
              </p>
              <button
                onClick={handleExportMasterParts}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Master Parts with Pricing Rules
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Exports to: master-parts-export-YYYY-MM-DD.csv
              </p>
            </div>
          </div>
        </div>

        {/* Import Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Import Master Parts</h3>
              <p className="text-sm text-gray-600 mb-3">
                Import master parts from CSV. Supports both basic template format and enhanced format with pricing rules. Format is automatically detected.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="flex-1 text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                  />
                  <button
                    onClick={handleImportMasterParts}
                    disabled={!importFile || importing}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? (
                      <>
                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Import
                      </>
                    )}
                  </button>
                </div>
                {importFile && (
                  <p className="text-xs text-gray-600">
                    Selected: {importFile.name}
                  </p>
                )}
              </div>

              {/* Import Results */}
              {importResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Import Results</h4>
                  <div className="space-y-2 text-sm">
                    <p className="text-green-600">
                      ✓ Successfully imported: {importResult.imported} parts
                    </p>
                    {importResult.format && (
                      <p className="text-gray-600">
                        Format detected: {importResult.format === 'enhanced' ? 'Enhanced (with pricing rules)' : 'Basic (template)'}
                      </p>
                    )}
                    {importResult.skipped && importResult.skipped.length > 0 && (
                      <div className="text-yellow-600">
                        <p className="font-medium">⚠ Skipped: {importResult.skipped.length} items</p>
                        <ul className="list-disc list-inside ml-2 text-xs mt-1">
                          {importResult.skipped.slice(0, 5).map((msg: string, i: number) => (
                            <li key={i}>{msg}</li>
                          ))}
                          {importResult.skipped.length > 5 && (
                            <li>... and {importResult.skipped.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="text-red-600">
                        <p className="font-medium">✗ Errors: {importResult.errors.length} items</p>
                        <ul className="list-disc list-inside ml-2 text-xs mt-1">
                          {importResult.errors.slice(0, 5).map((msg: string, i: number) => (
                            <li key={i}>{msg}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li>... and {importResult.errors.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User & Portal Management Sections (Admin Only) */}
        {currentUser?.role === 'ADMIN' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <PortalManagement />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <UserManagement />
            </div>
          </>
        )}

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