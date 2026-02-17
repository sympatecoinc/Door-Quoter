'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, Trash2, Copy, Archive, RotateCcw, ChevronDown, ChevronRight, X, Search, Check } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { OpeningPreset, OpeningPresetPanel, OpeningPresetPart, MasterPart } from '@/types'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Product {
  id: number
  name: string
  productType: string
  productCategory: string
  frameConfig?: {
    id: number
    name: string
    productType: string
  } | null
}

interface FrameProduct {
  id: number
  name: string
  jambThickness?: number | null
}

type PartType = 'Hardware' | 'Extrusion' | 'Glass' | 'Sealant' | 'Other'

// Helper function to check if a part type supports formulas
// Based on product BOM rules: Extrusion/CutStock always need formulas, Hardware only if unit is LF/IN
function partSupportsFormula(part: { masterPart?: { partType?: string | null; unit?: string | null } | null }): boolean {
  const partType = part.masterPart?.partType
  const unit = part.masterPart?.unit

  if (partType === 'Extrusion' || partType === 'CutStock') return true
  if (partType === 'Hardware' && (unit === 'LF' || unit === 'IN')) return true
  return false
}

// Part interface for local state - must have masterPartId and masterPart
interface PresetPartLocal {
  masterPartId: number
  masterPart: MasterPart
  formula?: string | null
  quantity?: number | null
}

export default function OpeningPresetsView() {
  const [presets, setPresets] = useState<OpeningPreset[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [frameProducts, setFrameProducts] = useState<FrameProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  // Editor state
  const [editingPreset, setEditingPreset] = useState<OpeningPreset | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete/Archive confirmation
  const [confirmDelete, setConfirmDelete] = useState<OpeningPreset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState<OpeningPreset | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultRoughWidth: '',
    defaultRoughHeight: '',
    defaultFinishedWidth: '',
    defaultFinishedHeight: '',
    openingType: '' as '' | 'THINWALL' | 'FRAMED',
    frameProductId: null as number | null
  })
  const [panels, setPanels] = useState<Partial<OpeningPresetPanel>[]>([])
  const [openComponentDropdown, setOpenComponentDropdown] = useState<number | null>(null)
  const [parts, setParts] = useState<PresetPartLocal[]>([])

  // Master Parts state for part selector
  const [masterParts, setMasterParts] = useState<MasterPart[]>([])
  const [partSearchQuery, setPartSearchQuery] = useState('')
  const [showPartSelector, setShowPartSelector] = useState(false)
  const [masterPartsLoading, setMasterPartsLoading] = useState(false)

  // Tolerance settings
  const [tolerances, setTolerances] = useState({
    thinwallWidthTolerance: 1.0,
    thinwallHeightTolerance: 1.5,
    framedWidthTolerance: 0.5,
    framedHeightTolerance: 0.75,
  })

  const [expandedSections, setExpandedSections] = useState({
    dimensions: true,
    panels: true,
    parts: true
  })

  useEscapeKey([
    { isOpen: confirmArchive !== null, isBlocked: false, onClose: () => setConfirmArchive(null) },
    { isOpen: confirmDelete !== null, isBlocked: deleting, onClose: () => setConfirmDelete(null) },
    { isOpen: showEditor, isBlocked: saving, onClose: () => closeEditor() }
  ])

  useEffect(() => {
    loadData()
  }, [showArchived])

  async function loadData() {
    setLoading(true)
    try {
      await Promise.all([fetchPresets(), fetchProducts(), fetchFrameProducts(), fetchTolerances()])
    } finally {
      setLoading(false)
    }
  }

  async function fetchTolerances() {
    try {
      const response = await fetch('/api/tolerance-settings')
      if (response.ok) {
        const data = await response.json()
        setTolerances(data)
      }
    } catch (error) {
      console.error('Error fetching tolerances:', error)
    }
  }

  async function fetchPresets() {
    try {
      const url = showArchived ? '/api/opening-presets?includeArchived=true' : '/api/opening-presets'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPresets(data.presets || [])
      }
    } catch (error) {
      console.error('Error fetching presets:', error)
    }
  }

  async function fetchProducts(openingType?: 'THINWALL' | 'FRAMED', frameId?: number | null) {
    try {
      // For FRAMED with a selected frame, filter by frameProductId
      // For THINWALL or no frame selected, filter by openingType
      let url = '/api/products'
      if (frameId) {
        url = `/api/products?frameProductId=${frameId}`
      } else if (openingType) {
        url = `/api/products?openingType=${openingType}`
      }
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.filter((p: Product) => p.productType !== 'FRAME'))
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  async function fetchFrameProducts() {
    try {
      const res = await fetch('/api/products?includeArchived=false')
      if (res.ok) {
        const data = await res.json()
        setFrameProducts(data.filter((p: any) => p.productType === 'FRAME').map((p: any) => ({
          id: p.id,
          name: p.name,
          jambThickness: p.jambThickness
        })))
      }
    } catch (err) {
      console.error('Error fetching frame products:', err)
    }
  }

  async function fetchMasterParts(search?: string) {
    setMasterPartsLoading(true)
    try {
      // Only fetch parts marked for jamb kit
      let url = '/api/master-parts?jambKitOnly=true'
      if (search) {
        url += `&search=${encodeURIComponent(search)}`
      }
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setMasterParts(data)
      }
    } catch (error) {
      console.error('Error fetching master parts:', error)
    } finally {
      setMasterPartsLoading(false)
    }
  }

  function openNewEditor() {
    setEditingPreset(null)
    setFormData({
      name: '',
      description: '',
      defaultRoughWidth: '',
      defaultRoughHeight: '',
      defaultFinishedWidth: '',
      defaultFinishedHeight: '',
      openingType: '',
      frameProductId: null
    })
    setPanels([])
    setParts([])
    setProducts([]) // Clear products - will be loaded when opening type is selected
    setShowEditor(true)
    fetchMasterParts() // Load master parts for the selector
  }

  function openEditEditor(preset: OpeningPreset) {
    // Determine opening type - fall back to isFinishedOpening for legacy presets
    const resolvedOpeningType = preset.openingType || (preset.isFinishedOpening ? 'FRAMED' : 'THINWALL')

    setEditingPreset(preset)
    setFormData({
      name: preset.name,
      description: preset.description || '',
      defaultRoughWidth: preset.defaultRoughWidth?.toString() || '',
      defaultRoughHeight: preset.defaultRoughHeight?.toString() || '',
      defaultFinishedWidth: preset.defaultFinishedWidth?.toString() || '',
      defaultFinishedHeight: preset.defaultFinishedHeight?.toString() || '',
      openingType: resolvedOpeningType as 'THINWALL' | 'FRAMED',
      frameProductId: preset.frameProductId || null
    })
    setPanels(preset.panels || [])
    setParts(preset.parts || [])
    setShowEditor(true)
    fetchMasterParts() // Load master parts for the selector
    // Load products filtered by the preset's opening type and frame
    if (resolvedOpeningType === 'FRAMED' && preset.frameProductId) {
      fetchProducts(resolvedOpeningType, preset.frameProductId)
    } else {
      fetchProducts(resolvedOpeningType as 'THINWALL' | 'FRAMED')
    }
  }

  function closeEditor() {
    setShowEditor(false)
    setEditingPreset(null)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      alert('Preset name is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        defaultRoughWidth: formData.defaultRoughWidth ? parseFloat(formData.defaultRoughWidth) : null,
        defaultRoughHeight: formData.defaultRoughHeight ? parseFloat(formData.defaultRoughHeight) : null,
        defaultFinishedWidth: formData.defaultFinishedWidth ? parseFloat(formData.defaultFinishedWidth) : null,
        defaultFinishedHeight: formData.defaultFinishedHeight ? parseFloat(formData.defaultFinishedHeight) : null,
        openingType: formData.openingType || null,
        frameProductId: formData.openingType === 'FRAMED' ? formData.frameProductId : null,
        panels: panels.map((p, idx) => ({
          type: p.type || 'Component',
          productId: p.productId || null,
          widthFormula: p.widthFormula || null,
          heightFormula: p.heightFormula || null,
          glassType: p.glassType || 'Clear',
          locking: p.locking || 'None',
          swingDirection: p.swingDirection || 'None',
          slidingDirection: p.slidingDirection || 'Left',
          subOptionSelections: p.subOptionSelections || '{}',
          includedOptions: p.includedOptions || '[]',
          variantSelections: p.variantSelections || '{}',
          displayOrder: idx
        })),
        parts: parts
          .filter(p => p.masterPartId) // Only include parts with masterPartId
          .map((p, idx) => ({
            masterPartId: p.masterPartId,
            formula: p.formula || null,
            quantity: p.quantity ?? null,
            displayOrder: idx
          }))
      }

      const url = editingPreset
        ? `/api/opening-presets/${editingPreset.id}`
        : '/api/opening-presets'
      const method = editingPreset ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        closeEditor()
        fetchPresets()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save preset')
      }
    } catch (error) {
      console.error('Error saving preset:', error)
      alert('Error saving preset')
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate(preset: OpeningPreset) {
    setSaving(true)
    try {
      // Create a copy with modified name
      const payload = {
        name: `${preset.name} (Copy)`,
        description: preset.description,
        defaultRoughWidth: preset.defaultRoughWidth,
        defaultRoughHeight: preset.defaultRoughHeight,
        defaultFinishedWidth: preset.defaultFinishedWidth,
        defaultFinishedHeight: preset.defaultFinishedHeight,
        openingType: preset.openingType,
        frameProductId: preset.frameProductId || null,
        panels: preset.panels?.map((p, idx) => ({
          type: p.type,
          productId: p.productId,
          widthFormula: p.widthFormula,
          heightFormula: p.heightFormula,
          glassType: p.glassType,
          locking: p.locking,
          swingDirection: p.swingDirection,
          slidingDirection: p.slidingDirection,
          subOptionSelections: p.subOptionSelections,
          includedOptions: p.includedOptions,
          variantSelections: p.variantSelections,
          displayOrder: idx
        })) || [],
        parts: preset.parts
          ?.filter(p => p.masterPartId)
          .map((p, idx) => ({
            masterPartId: p.masterPartId,
            formula: p.formula,
            quantity: p.quantity,
            displayOrder: idx
          })) || []
      }

      const response = await fetch('/api/opening-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        fetchPresets()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to duplicate preset')
      }
    } catch (error) {
      console.error('Error duplicating preset:', error)
      alert('Error duplicating preset')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveToggle(preset: OpeningPreset) {
    try {
      if (preset.isArchived) {
        // Restore from archive
        const response = await fetch(`/api/opening-presets/${preset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isArchived: false })
        })
        if (response.ok) {
          fetchPresets()
        }
      } else {
        // Archive (soft delete)
        const response = await fetch(`/api/opening-presets/${preset.id}`, {
          method: 'DELETE'
        })
        if (response.ok) {
          fetchPresets()
        }
      }
    } catch (error) {
      console.error('Error toggling archive:', error)
    }
  }

  async function handleHardDelete() {
    if (!confirmDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/opening-presets/${confirmDelete.id}?hard=true`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setConfirmDelete(null)
        fetchPresets()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete preset')
      }
    } catch (error) {
      console.error('Error deleting preset:', error)
      alert('Error deleting preset')
    } finally {
      setDeleting(false)
    }
  }

  function addPanel() {
    setPanels([...panels, {
      type: 'Component',
      productId: null,
      widthFormula: '',
      heightFormula: '',
      glassType: 'Clear',
      locking: 'None',
      swingDirection: 'None',
      slidingDirection: 'Left'
    }])
  }

  // Get the selected frame's jamb thickness (for FRAMED presets)
  const selectedFrameJambThickness = formData.frameProductId
    ? frameProducts.find(fp => fp.id === formData.frameProductId)?.jambThickness || 0
    : 0

  // Calculate auto width based on preset dimensions and panel count
  function handleAutoWidth(panelIndex: number) {
    // Get base dimension based on opening type
    let baseWidth = formData.openingType === 'THINWALL'
      ? parseFloat(formData.defaultFinishedWidth) || 0
      : parseFloat(formData.defaultRoughWidth) || 0

    if (baseWidth <= 0) {
      alert('Please set default dimensions first')
      return
    }

    // Apply tolerance: entered dimension → minus tolerance = component-fit dimension
    if (formData.openingType === 'THINWALL') {
      baseWidth = baseWidth - tolerances.thinwallWidthTolerance
    } else if (formData.openingType === 'FRAMED') {
      // FRAMED: rough → minus tolerance = finished → minus jamb = interior
      baseWidth = baseWidth - tolerances.framedWidthTolerance
      if (selectedFrameJambThickness > 0) {
        baseWidth = baseWidth - (2 * selectedFrameJambThickness)
      }
    }

    // Subtract widths already set on OTHER panels, then divide remaining
    // among panels without a width (including the current one)
    let otherPanelsWidth = 0
    let panelsWithoutWidth = 0

    panels.forEach((p, i) => {
      if (i === panelIndex) {
        panelsWithoutWidth++
      } else {
        const w = parseFloat(p.widthFormula || '') || 0
        if (w > 0) {
          otherPanelsWidth += w
        } else {
          panelsWithoutWidth++
        }
      }
    })

    const remainingWidth = baseWidth - otherPanelsWidth
    const panelWidth = remainingWidth / Math.max(panelsWithoutWidth, 1)

    // Set as static numeric value
    updatePanel(panelIndex, 'widthFormula', panelWidth.toFixed(3))
  }

  // Calculate auto height based on preset dimensions
  function handleAutoHeight(panelIndex: number) {
    // Get base dimension based on opening type
    let baseHeight = formData.openingType === 'THINWALL'
      ? parseFloat(formData.defaultFinishedHeight) || 0
      : parseFloat(formData.defaultRoughHeight) || 0

    if (baseHeight <= 0) {
      alert('Please set default dimensions first')
      return
    }

    // Apply tolerance: entered dimension → minus tolerance = component-fit dimension
    if (formData.openingType === 'THINWALL') {
      baseHeight = baseHeight - tolerances.thinwallHeightTolerance
    } else if (formData.openingType === 'FRAMED') {
      // FRAMED: rough → minus tolerance = finished → minus jamb = interior
      baseHeight = baseHeight - tolerances.framedHeightTolerance
      if (selectedFrameJambThickness > 0) {
        baseHeight = baseHeight - selectedFrameJambThickness
      }
    }

    // Set as static numeric value
    updatePanel(panelIndex, 'heightFormula', baseHeight.toFixed(3))
  }

  // Check if Auto buttons should be enabled (has preset dimensions)
  const hasPresetDimensions = formData.openingType && (
    (formData.openingType === 'THINWALL' && (parseFloat(formData.defaultFinishedWidth) > 0 || parseFloat(formData.defaultFinishedHeight) > 0)) ||
    (formData.openingType === 'FRAMED' && (parseFloat(formData.defaultRoughWidth) > 0 || parseFloat(formData.defaultRoughHeight) > 0))
  )

  function removePanel(index: number) {
    setPanels(panels.filter((_, i) => i !== index))
  }

  function updatePanel(index: number, field: string, value: any) {
    setPanels(panels.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function selectMasterPart(masterPart: MasterPart) {
    const newPart: PresetPartLocal = {
      masterPartId: masterPart.id,
      masterPart: masterPart,
      formula: null,
      quantity: 1
    }
    setParts([...parts, newPart])
    setShowPartSelector(false)
    setPartSearchQuery('')
  }

  function removePart(index: number) {
    setParts(parts.filter((_, i) => i !== index))
  }

  function updatePart(index: number, field: string, value: any) {
    setParts(parts.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  // Group master parts by type for the selector modal
  const groupedMasterParts = useMemo(() => {
    const filtered = partSearchQuery
      ? masterParts.filter(mp =>
          mp.baseName.toLowerCase().includes(partSearchQuery.toLowerCase()) ||
          mp.partNumber.toLowerCase().includes(partSearchQuery.toLowerCase()) ||
          (mp.description && mp.description.toLowerCase().includes(partSearchQuery.toLowerCase()))
        )
      : masterParts

    const grouped: Record<string, MasterPart[]> = {}
    for (const part of filtered) {
      const type = part.partType || 'Other'
      if (!grouped[type]) grouped[type] = []
      grouped[type].push(part)
    }
    return grouped
  }, [masterParts, partSearchQuery])

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const formatDimensions = (preset: OpeningPreset) => {
    const parts = []
    if (preset.defaultRoughWidth || preset.defaultRoughHeight) {
      parts.push(`R: ${preset.defaultRoughWidth || '?'}×${preset.defaultRoughHeight || '?'}`)
    }
    if (preset.defaultFinishedWidth || preset.defaultFinishedHeight) {
      parts.push(`F: ${preset.defaultFinishedWidth || '?'}×${preset.defaultFinishedHeight || '?'}`)
    }
    return parts.length > 0 ? parts.join(' / ') : 'No defaults'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show Archived
          </label>
        </div>
        <button
          onClick={openNewEditor}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Preset
        </button>
      </div>

      {/* Presets Table */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : presets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No presets found.</p>
          <button
            onClick={openNewEditor}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Create your first preset
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Default Dimensions</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Components</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Parts</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Times Used</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((preset) => (
                <tr
                  key={preset.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${preset.isArchived ? 'opacity-50' : ''}`}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{preset.name}</div>
                    {preset.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">{preset.description}</div>
                    )}
                    {preset.isArchived && (
                      <span className="text-xs text-orange-600 font-medium">(Archived)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDimensions(preset)}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">
                    {preset._count?.panels || 0}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">
                    {preset._count?.parts || 0}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">
                    {preset._count?.appliedOpenings || 0}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditEditor(preset)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(preset)}
                        disabled={saving}
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {preset.isArchived ? (
                        <>
                          <button
                            onClick={() => handleArchiveToggle(preset)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Restore"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(preset)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Permanently Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmArchive(preset)}
                          className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                          title="Archive"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmArchive !== null}
        title="Archive Preset"
        message={`Are you sure you want to archive "${confirmArchive?.name}"? It will be hidden from the active list but can be restored later.`}
        confirmLabel="Archive"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          if (confirmArchive) {
            handleArchiveToggle(confirmArchive)
          }
          setConfirmArchive(null)
        }}
        onCancel={() => setConfirmArchive(null)}
      />

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Permanently Delete Preset</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to permanently delete <strong>{confirmDelete.name}</strong>?
              This action cannot be undone.
            </p>
            {confirmDelete._count?.appliedOpenings && confirmDelete._count.appliedOpenings > 0 && (
              <p className="text-amber-600 text-sm mb-4">
                This preset has been used in {confirmDelete._count.appliedOpenings} opening(s).
                You cannot delete presets that are in use.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleHardDelete}
                disabled={deleting || (confirmDelete._count?.appliedOpenings || 0) > 0}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPreset ? 'Edit Preset' : 'New Preset'}
              </h2>
              <button
                onClick={closeEditor}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preset Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Standard Swing Door"
                  />
                </div>
              </div>

              {/* Opening Type - FIRST (required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Type *</label>
                <select
                  value={formData.openingType}
                  disabled={!!editingPreset || (formData.openingType !== '' && panels.length > 0)}
                  onChange={(e) => {
                    const newType = e.target.value as '' | 'THINWALL' | 'FRAMED'

                    setFormData({
                      ...formData,
                      openingType: newType,
                      frameProductId: null,
                      defaultRoughWidth: newType === 'THINWALL' ? '' : formData.defaultRoughWidth,
                      defaultRoughHeight: newType === 'THINWALL' ? '' : formData.defaultRoughHeight,
                      defaultFinishedWidth: newType === 'FRAMED' ? '' : formData.defaultFinishedWidth,
                      defaultFinishedHeight: newType === 'FRAMED' ? '' : formData.defaultFinishedHeight,
                    })

                    // Re-fetch products filtered by the new opening type
                    if (newType) {
                      fetchProducts(newType)
                    }
                  }}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editingPreset || (formData.openingType !== '' && panels.length > 0) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">Select type...</option>
                  <option value="THINWALL">Thinwall</option>
                  <option value="FRAMED">Trimmed</option>
                </select>
                {editingPreset && (
                  <p className="text-xs text-gray-500 mt-1">
                    Opening type cannot be changed after creation.
                  </p>
                )}
                {!editingPreset && formData.openingType !== '' && panels.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Remove all components to change the opening type.
                  </p>
                )}
              </div>

              {/* Frame Selection - only for FRAMED opening type */}
              {formData.openingType === 'FRAMED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frame Type *</label>
                  <select
                    value={formData.frameProductId || ''}
                    disabled={!!editingPreset || (formData.frameProductId !== null && panels.length > 0)}
                    onChange={(e) => {
                      const newFrameId = e.target.value ? parseInt(e.target.value) : null
                      setFormData({ ...formData, frameProductId: newFrameId })

                      // Re-fetch products filtered by the selected frame
                      if (newFrameId) {
                        fetchProducts('FRAMED', newFrameId)
                      } else {
                        fetchProducts('FRAMED')
                      }
                    }}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      editingPreset || (formData.frameProductId !== null && panels.length > 0) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="">Select frame...</option>
                    {frameProducts.map(fp => (
                      <option key={fp.id} value={fp.id}>
                        {fp.name}{fp.jambThickness ? ` (${fp.jambThickness}" jamb)` : ''}
                      </option>
                    ))}
                  </select>
                  {editingPreset && formData.frameProductId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Frame type cannot be changed after creation.
                    </p>
                  )}
                  {!editingPreset && formData.frameProductId !== null && panels.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Remove all components to change the frame type.
                    </p>
                  )}
                </div>
              )}

              {/* Dimensions - requires opening type + frame (for FRAMED) */}
              {formData.openingType && (formData.openingType !== 'FRAMED' || formData.frameProductId) && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {formData.openingType === 'THINWALL' ? 'Finished Opening Size' : 'Rough Opening Size'}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {formData.openingType === 'THINWALL' ? (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Width</label>
                          <input
                            type="number"
                            step="0.125"
                            value={formData.defaultFinishedWidth}
                            onChange={(e) => setFormData({ ...formData, defaultFinishedWidth: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="inches"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Height</label>
                          <input
                            type="number"
                            step="0.125"
                            value={formData.defaultFinishedHeight}
                            onChange={(e) => setFormData({ ...formData, defaultFinishedHeight: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="inches"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Width</label>
                          <input
                            type="number"
                            step="0.125"
                            value={formData.defaultRoughWidth}
                            onChange={(e) => setFormData({ ...formData, defaultRoughWidth: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="inches"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Height</label>
                          <input
                            type="number"
                            step="0.125"
                            value={formData.defaultRoughHeight}
                            onChange={(e) => setFormData({ ...formData, defaultRoughHeight: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="inches"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {/* Tolerance + dimension info */}
                  {(() => {
                    if (formData.openingType === 'THINWALL') {
                      const enteredW = parseFloat(formData.defaultFinishedWidth) || 0
                      const enteredH = parseFloat(formData.defaultFinishedHeight) || 0
                      if (enteredW > 0 || enteredH > 0) {
                        const componentW = enteredW > 0 ? enteredW - tolerances.thinwallWidthTolerance : 0
                        const componentH = enteredH > 0 ? enteredH - tolerances.thinwallHeightTolerance : 0
                        return (
                          <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2 mt-3">
                            Component dimensions: {componentW > 0 ? componentW.toFixed(3) : '?'}" W × {componentH > 0 ? componentH.toFixed(3) : '?'}" H
                            {' '}(after {tolerances.thinwallWidthTolerance}" W / {tolerances.thinwallHeightTolerance}" H tolerance)
                          </p>
                        )
                      }
                    } else if (formData.openingType === 'FRAMED') {
                      const roughW = parseFloat(formData.defaultRoughWidth) || 0
                      const roughH = parseFloat(formData.defaultRoughHeight) || 0
                      if (roughW > 0 || roughH > 0) {
                        const finishedW = roughW > 0 ? roughW - tolerances.framedWidthTolerance : 0
                        const finishedH = roughH > 0 ? roughH - tolerances.framedHeightTolerance : 0
                        const hasJamb = formData.frameProductId && selectedFrameJambThickness > 0
                        const interiorW = hasJamb && finishedW > 0 ? finishedW - (2 * selectedFrameJambThickness) : finishedW
                        const interiorH = hasJamb && finishedH > 0 ? finishedH - selectedFrameJambThickness : finishedH
                        return (
                          <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2 mt-3 space-y-1">
                            <p>
                              Finished dimensions: {finishedW > 0 ? finishedW.toFixed(3) : '?'}" W × {finishedH > 0 ? finishedH.toFixed(3) : '?'}" H
                              {' '}(after {tolerances.framedWidthTolerance}" W / {tolerances.framedHeightTolerance}" H tolerance)
                            </p>
                            {hasJamb && (
                              <p>
                                Interior dimensions: {interiorW > 0 ? interiorW.toFixed(3) : '?'}" W × {interiorH > 0 ? interiorH.toFixed(3) : '?'}" H
                                {' '}(after deducting {selectedFrameJambThickness}" jamb thickness)
                              </p>
                            )}
                          </div>
                        )
                      }
                    }
                    return null
                  })()}
                </div>
              )}

              {/* Components Section - requires opening type + frame (for FRAMED) to be selected first */}
              {(() => {
                // Components are unlocked when: opening type selected, AND frame selected (if FRAMED)
                const componentsReady = formData.openingType && (formData.openingType !== 'FRAMED' || formData.frameProductId)
                // Determine what's missing for the hint text
                const missingStep = !formData.openingType
                  ? 'Select opening type first'
                  : formData.openingType === 'FRAMED' && !formData.frameProductId
                    ? 'Select frame type first'
                    : null
                return (
              <div className={`border rounded-lg ${componentsReady ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                <button
                  type="button"
                  onClick={() => componentsReady && toggleSection('panels')}
                  disabled={!componentsReady}
                  className={`w-full px-4 py-3 flex items-center justify-between text-left ${componentsReady ? 'hover:bg-gray-50' : 'cursor-not-allowed'}`}
                >
                  <span className={`font-medium ${componentsReady ? 'text-gray-900' : 'text-gray-400'}`}>
                    Components ({panels.length})
                    {missingStep && <span className="ml-2 text-xs font-normal">&mdash; {missingStep}</span>}
                  </span>
                  {componentsReady && (
                    expandedSections.panels ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {componentsReady && expandedSections.panels && (
                  <div className="px-4 pb-4 space-y-4">
                    <p className="text-sm text-gray-500">
                      {formData.openingType === 'FRAMED' && formData.frameProductId
                        ? `Showing products assigned to ${frameProducts.find(fp => fp.id === formData.frameProductId)?.name || 'selected frame'}.`
                        : `Showing ${formData.openingType === 'THINWALL' ? 'Thinwall' : 'Trimmed'} compatible products only.`
                      }
                    </p>
                    {panels.map((panel, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-medium text-gray-700">Component {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removePanel(index)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Component</label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenComponentDropdown(openComponentDropdown === index ? null : index)}
                                className="w-full px-4 py-2.5 text-left border border-gray-300 rounded-lg flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                              >
                                <span className={panel.productId ? 'font-medium text-gray-900' : 'text-gray-400'}>
                                  {panel.productId
                                    ? (() => {
                                        const p = products.find(pr => pr.id === panel.productId)
                                        return p ? (p.productType === 'CORNER_90' ? '90° Corner' : p.name) : 'Select component...'
                                      })()
                                    : 'Select component...'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openComponentDropdown === index ? 'rotate-180' : ''}`} />
                              </button>
                              {openComponentDropdown === index && (
                                <div className="absolute z-10 w-full mt-1 border border-gray-300 rounded-lg overflow-hidden max-h-80 overflow-y-auto shadow-lg bg-white">
                                  {(() => {
                                    const typeOrder = ['SWING_DOOR', 'SLIDING_DOOR', 'FIXED_PANEL', 'CORNER_90'] as const
                                    const typeLabels: Record<string, string> = {
                                      'SWING_DOOR': 'Swing Doors',
                                      'SLIDING_DOOR': 'Sliding Doors',
                                      'FIXED_PANEL': 'Fixed Panels',
                                      'CORNER_90': 'Corners'
                                    }
                                    const groupedProducts = typeOrder.map(type => ({
                                      type,
                                      label: typeLabels[type],
                                      products: products.filter(p => p.productType === type)
                                    })).filter(group => group.products.length > 0)

                                    return groupedProducts.map((group) => (
                                      <div key={group.type}>
                                        <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-200">
                                          {group.label}
                                        </div>
                                        {group.products.map((product) => {
                                          const isSelected = panel.productId === product.id
                                          return (
                                            <button
                                              key={product.id}
                                              type="button"
                                              onClick={() => {
                                                const productId = product.id
                                                const typeMap: Record<string, string> = {
                                                  SWING_DOOR: 'Swing Door',
                                                  SLIDING_DOOR: 'Sliding Door',
                                                  FIXED_PANEL: 'Fixed Panel',
                                                  CORNER_90: '90° Corner'
                                                }
                                                const inferredType = typeMap[product.productType] || 'Component'
                                                setPanels(panels.map((p, i) => i === index ? { ...p, productId, type: inferredType } : p))
                                                setOpenComponentDropdown(null)
                                              }}
                                              className={`w-full px-4 py-3 text-left flex items-center justify-between border-b border-gray-200 last:border-b-0 transition-colors ${
                                                isSelected
                                                  ? 'bg-blue-100 text-blue-900'
                                                  : 'bg-white hover:bg-gray-50 text-gray-900'
                                              }`}
                                            >
                                              <span className="font-medium">{product.productType === 'CORNER_90' ? '90° Corner' : product.name}</span>
                                              {isSelected && <Check className="w-5 h-5 text-blue-600" />}
                                            </button>
                                          )
                                        })}
                                      </div>
                                    ))
                                  })()}
                                </div>
                              )}
                            </div>
                            {(() => {
                              const selectedProduct = panel.productId ? products.find(p => p.id === panel.productId) : null
                              if (selectedProduct?.frameConfig) {
                                return (
                                  <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1 mt-1">
                                    Linked frame: {selectedProduct.frameConfig.name} (auto-included when preset is applied)
                                  </p>
                                )
                              }
                              return null
                            })()}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Width</label>
                            <div className="flex">
                              <input
                                type="text"
                                value={panel.widthFormula || ''}
                                onChange={(e) => updatePanel(index, 'widthFormula', e.target.value)}
                                className={`flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${hasPresetDimensions ? 'rounded-l-lg border-r-0' : 'rounded-lg'}`}
                                placeholder="e.g., 47.75"
                              />
                              {hasPresetDimensions && (
                                <button
                                  type="button"
                                  onClick={() => handleAutoWidth(index)}
                                  className="flex-shrink-0 px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-medium border border-gray-300 rounded-r-lg"
                                  title="Auto-calculate width based on opening dimensions and panel count"
                                >
                                  Auto
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Height</label>
                            <div className="flex">
                              <input
                                type="text"
                                value={panel.heightFormula || ''}
                                onChange={(e) => updatePanel(index, 'heightFormula', e.target.value)}
                                className={`flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${hasPresetDimensions ? 'rounded-l-lg border-r-0' : 'rounded-lg'}`}
                                placeholder="e.g., 95.875"
                              />
                              {hasPresetDimensions && (
                                <button
                                  type="button"
                                  onClick={() => handleAutoHeight(index)}
                                  className="flex-shrink-0 px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-medium border border-gray-300 rounded-r-lg"
                                  title="Auto-calculate height based on opening dimensions"
                                >
                                  Auto
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addPanel}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Component
                    </button>
                  </div>
                )}
              </div>
                )
              })()}

              {/* Parts Section */}
              <div className="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleSection('parts')}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">
                    Parts ({parts.length})
                  </span>
                  {expandedSections.parts ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </button>
                {expandedSections.parts && (
                  <div className="px-4 pb-4 space-y-4">
                    <p className="text-sm text-gray-500">
                      Parts added here will be locked when the preset is applied.
                      Use formulas like <code className="bg-gray-100 px-1 rounded">width * 2</code> or
                      <code className="bg-gray-100 px-1 rounded">height - 0.75</code> for dynamic quantities.
                    </p>
                    {parts.map((part, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              part.masterPart?.partType === 'Extrusion' ? 'bg-purple-100 text-purple-700' :
                              part.masterPart?.partType === 'Hardware' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {part.masterPart?.partType || 'Unknown'}
                            </span>
                            <span className="font-medium text-gray-900">{part.masterPart?.baseName || 'Unknown Part'}</span>
                            <span className="text-sm text-gray-500">({part.masterPart?.partNumber})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePart(index)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                            <input
                              type="number"
                              step="1"
                              value={part.quantity ?? ''}
                              onChange={(e) => updatePart(index, 'quantity', e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Fixed qty"
                            />
                          </div>
                          {/* Only show formula field for Extrusion, CutStock, or Hardware with LF/IN unit */}
                          {partSupportsFormula(part) && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Length Formula {(part.masterPart?.partType === 'Extrusion' || part.masterPart?.partType === 'CutStock') && '*'}
                              </label>
                              <input
                                type="text"
                                value={part.formula || ''}
                                onChange={(e) => updatePart(index, 'formula', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., height - 0.75"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowPartSelector(true)}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Part from Master Parts
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Part Selector Modal */}
            {showPartSelector && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Select Part from Master Parts</h3>
                    <button
                      onClick={() => {
                        setShowPartSelector(false)
                        setPartSearchQuery('')
                      }}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="px-6 py-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={partSearchQuery}
                        onChange={(e) => setPartSearchQuery(e.target.value)}
                        placeholder="Search by name, part number, or description..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {masterPartsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : Object.keys(groupedMasterParts).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No parts found matching your search.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(groupedMasterParts).map(([type, typeParts]) => (
                          <div key={type}>
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                              {type} ({typeParts.length})
                            </div>
                            <div className="space-y-1">
                              {typeParts.slice(0, 20).map((mp) => (
                                <button
                                  key={mp.id}
                                  type="button"
                                  onClick={() => selectMasterPart(mp)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-gray-900">{mp.baseName}</span>
                                      <span className="ml-2 text-sm text-gray-500">({mp.partNumber})</span>
                                    </div>
                                    <span className="text-xs text-gray-400">{mp.unit}</span>
                                  </div>
                                  {mp.description && (
                                    <div className="text-sm text-gray-500 truncate">{mp.description}</div>
                                  )}
                                </button>
                              ))}
                              {typeParts.length > 20 && (
                                <div className="text-sm text-gray-400 text-center py-2">
                                  And {typeParts.length - 20} more... Use search to narrow results.
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeEditor}
                disabled={saving}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  editingPreset ? 'Save Changes' : 'Create Preset'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
