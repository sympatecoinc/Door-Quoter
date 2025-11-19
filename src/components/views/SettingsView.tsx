'use client'

import { useState, useEffect } from 'react'
import { Download, Save, Upload, FileUp, Plus, Trash2, Edit } from 'lucide-react'
import UserManagement from '../UserManagement'

export default function SettingsView() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [unitSystem, setUnitSystem] = useState('imperial')
  const [precision, setPrecision] = useState('2')
  const [saving, setSaving] = useState(false)

  // Import/Export state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  // Extrusion Finish Pricing state
  const [finishPricing, setFinishPricing] = useState<any[]>([])
  const [loadingFinishPricing, setLoadingFinishPricing] = useState(true)
  const [editingFinishId, setEditingFinishId] = useState<number | null>(null)
  const [editingFinishType, setEditingFinishType] = useState('')
  const [editingFinishCode, setEditingFinishCode] = useState('')
  const [editingCostPerFoot, setEditingCostPerFoot] = useState('')
  const [showAddFinish, setShowAddFinish] = useState(false)
  const [newFinishType, setNewFinishType] = useState('')
  const [newFinishCode, setNewFinishCode] = useState('')
  const [newCostPerFoot, setNewCostPerFoot] = useState('')

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
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }

    // Fetch current user session
    fetchCurrentUser()
    // Fetch finish pricing settings
    fetchFinishPricing()
  }, [])

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

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      // Here you would typically save to a database or API
      // For now, we'll just save to localStorage as a demo
      const settings = {
        companyName,
        defaultCurrency,
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

  // Extrusion Finish Pricing functions
  const fetchFinishPricing = async () => {
    setLoadingFinishPricing(true)
    try {
      const response = await fetch('/api/settings/extrusion-finish-pricing')
      if (response.ok) {
        const data = await response.json()
        setFinishPricing(data)
      }
    } catch (error) {
      console.error('Error fetching finish pricing:', error)
    } finally {
      setLoadingFinishPricing(false)
    }
  }

  const handleAddFinish = async () => {
    if (!newFinishType.trim()) {
      alert('Please enter a finish type')
      return
    }

    if (!newFinishCode.trim()) {
      alert('Please enter a finish code')
      return
    }

    if (!newCostPerFoot.trim() || isNaN(parseFloat(newCostPerFoot))) {
      alert('Please enter a valid cost per foot')
      return
    }

    try {
      const response = await fetch('/api/settings/extrusion-finish-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finishType: newFinishType,
          finishCode: newFinishCode.trim(),
          costPerFoot: parseFloat(newCostPerFoot)
        })
      })

      if (response.ok) {
        await fetchFinishPricing()
        setShowAddFinish(false)
        setNewFinishType('')
        setNewFinishCode('')
        setNewCostPerFoot('')
        alert('Finish type added successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add finish type')
      }
    } catch (error) {
      console.error('Error adding finish type:', error)
      alert('Error adding finish type')
    }
  }

  const handleUpdateFinish = async (id: number) => {
    try {
      const response = await fetch(`/api/settings/extrusion-finish-pricing/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finishType: editingFinishType,
          finishCode: editingFinishCode.trim() || null,
          costPerFoot: parseFloat(editingCostPerFoot) || 0
        })
      })

      if (response.ok) {
        await fetchFinishPricing()
        setEditingFinishId(null)
        alert('Finish pricing updated successfully')
      } else {
        alert('Failed to update finish pricing')
      }
    } catch (error) {
      console.error('Error updating finish pricing:', error)
      alert('Error updating finish pricing')
    }
  }

  const handleDeleteFinish = async (id: number) => {
    if (!confirm('Are you sure you want to delete this finish type?')) {
      return
    }

    try {
      const response = await fetch(`/api/settings/extrusion-finish-pricing/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchFinishPricing()
        alert('Finish type deleted successfully')
      } else {
        alert('Failed to delete finish type')
      }
    } catch (error) {
      console.error('Error deleting finish type:', error)
      alert('Error deleting finish type')
    }
  }

  const startEditFinish = (finish: any) => {
    setEditingFinishId(finish.id)
    setEditingFinishType(finish.finishType)
    setEditingFinishCode(finish.finishCode || '')
    setEditingCostPerFoot(finish.costPerFoot.toString())
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

        {/* Extrusion Finish Pricing Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Extrusion Finish Pricing</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure per-foot costs for different extrusion finishes. These costs will be automatically added to extrusions based on their cut length.
          </p>

          {loadingFinishPricing ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Finish Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Finish Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost Per Foot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {finishPricing.map((finish) => (
                      <tr key={finish.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingFinishId === finish.id ? (
                            <input
                              type="text"
                              value={editingFinishType}
                              onChange={(e) => setEditingFinishType(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">{finish.finishType}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingFinishId === finish.id ? (
                            <input
                              type="text"
                              value={editingFinishCode}
                              onChange={(e) => setEditingFinishCode(e.target.value)}
                              placeholder="e.g., BL"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-sm text-gray-900 font-mono">{finish.finishCode || '-'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingFinishId === finish.id ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editingCostPerFoot}
                              onChange={(e) => setEditingCostPerFoot(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">${finish.costPerFoot.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {editingFinishId === finish.id ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleUpdateFinish(finish.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingFinishId(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startEditFinish(finish)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFinish(finish.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showAddFinish ? (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Add New Finish Type</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Finish Type *</label>
                      <input
                        type="text"
                        value={newFinishType}
                        onChange={(e) => setNewFinishType(e.target.value)}
                        placeholder="e.g., Powder Coated Black"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Finish Code *</label>
                      <input
                        type="text"
                        value={newFinishCode}
                        onChange={(e) => setNewFinishCode(e.target.value)}
                        placeholder="e.g., BL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Part number suffix</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Cost Per Foot ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newCostPerFoot}
                        onChange={(e) => setNewCostPerFoot(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-3">
                    <button
                      onClick={() => {
                        setShowAddFinish(false)
                        setNewFinishType('')
                        setNewFinishCode('')
                        setNewCostPerFoot('')
                      }}
                      className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddFinish}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add Finish
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddFinish(true)}
                  className="mt-4 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Finish Type
                </button>
              )}
            </>
          )}
        </div>

        {/* User Management Section (Admin Only) */}
        {currentUser?.role === 'ADMIN' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <UserManagement />
          </div>
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