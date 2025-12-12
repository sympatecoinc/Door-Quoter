'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

// Direction constants matching SHOPGEN
const SLIDING_DIRECTIONS = ["Left", "Right"]
const CORNER_DIRECTIONS = ["Up", "Down"]
import { ArrowLeft, Edit, Plus, Eye, Trash2, Settings, FileText, Download, Copy, Archive, X, ChevronDown, Package } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import DrawingViewer from '../ui/DrawingViewer'
import { ProjectStatus, STATUS_CONFIG } from '@/types'

interface Project {
  id: number
  name: string
  status: string
  extrusionCostingMethod?: string
  excludedPartNumbers?: string[]
  pricingModeId?: number | null
  createdAt: string
  updatedAt: string
  openings: Opening[]
  _count: {
    openings: number
    boms: number
  }
}

interface Opening {
  id: number
  projectId: number
  name: string
  roughWidth?: number
  roughHeight?: number
  finishedWidth?: number
  finishedHeight?: number
  price: number
  multiplier: number
  priceCalculatedAt?: string | null
  finishColor?: string
  panels: Panel[]
}

interface Panel {
  id: number
  openingId: number
  type: string
  width: number
  height: number
  glassType: string
  locking: string
  swingDirection: string
  slidingDirection: string
  isCorner: boolean
  cornerDirection: string
  componentInstance?: {
    id: number
    product: {
      id: number
      name: string
      type: string
      productType: string
      productBOMs?: {
        id: number
        updatedAt: string
      }[]
    }
    subOptionSelections: string
  }
}

interface Component {
  id: number
  product: {
    id: number
    name: string
    type: string
  }
  subOptionSelections: Record<string, number | null>
}

// Function to get color-specific styling for finish colors
function getColorStyling(color: string) {
  const colorMap: Record<string, string> = {
    'Black': 'bg-black text-white border-black',
    'Clear': 'bg-blue-600 text-white border-blue-600',
    'Other': 'bg-gray-600 text-white border-gray-600',
    // Keep other colors with their original styling for backwards compatibility
    'White': 'bg-gray-50 text-gray-800 border-gray-200',
    'Brown': 'bg-amber-100 text-amber-800 border-amber-300',
    'Bronze': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Silver': 'bg-slate-100 text-slate-700 border-slate-300',
    'Gold': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'Red': 'bg-red-100 text-red-800 border-red-300',
    'Blue': 'bg-blue-100 text-blue-800 border-blue-300',
    'Green': 'bg-green-100 text-green-800 border-green-300',
    'Gray': 'bg-gray-100 text-gray-700 border-gray-300'
  }

  // Default to gray styling if color not found
  return colorMap[color] || 'bg-gray-600 text-white border-gray-600'
}

/**
 * Intelligently increments a base name that may contain numbers.
 * Matches backend logic for consistent preview.
 */
function smartIncrementName(baseName: string, index: number): string {
  const trimmed = baseName.trim()

  if (/^\d+$/.test(trimmed)) {
    const baseNumber = parseInt(trimmed)
    return (baseNumber + index).toString()
  }

  const match = trimmed.match(/^(.*?)(\d+)$/)
  if (match) {
    const prefix = match[1]
    const number = parseInt(match[2])
    return `${prefix}${number + index}`
  }

  return `${trimmed}${index}`
}

export default function ProjectDetailView() {
  const { selectedProjectId, setSelectedProjectId, selectedCustomerId, customerDetailView, setCurrentMenu, autoOpenAddOpening, setAutoOpenAddOpening } = useAppStore()
  const { toasts, removeToast, showSuccess, showError } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculatingPrices, setCalculatingPrices] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editPricingModeId, setEditPricingModeId] = useState<number | null>(null)
  const [pricingModes, setPricingModes] = useState<any[]>([])
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicatingOpeningId, setDuplicatingOpeningId] = useState<number | null>(null)
  const [duplicatingOpeningName, setDuplicatingOpeningName] = useState('')
  const [duplicateNewName, setDuplicateNewName] = useState('')
  const [duplicateCount, setDuplicateCount] = useState('1')
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [autoIncrement, setAutoIncrement] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingOpeningId, setDeletingOpeningId] = useState<number | null>(null)
  const [deletingOpeningName, setDeletingOpeningName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteComponentModal, setShowDeleteComponentModal] = useState(false)
  const [deletingComponentId, setDeletingComponentId] = useState<number | null>(null)
  const [deletingComponentName, setDeletingComponentName] = useState('')
  const [isDeletingComponent, setIsDeletingComponent] = useState(false)
  const [showEditOpeningModal, setShowEditOpeningModal] = useState(false)
  const [editingOpeningId, setEditingOpeningId] = useState<number | null>(null)
  const [editingOpeningName, setEditingOpeningName] = useState('')
  const [editingOpeningFinishColor, setEditingOpeningFinishColor] = useState('')
  const [isUpdatingOpening, setIsUpdatingOpening] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddOpening, setShowAddOpening] = useState(false)
  const [addingOpening, setAddingOpening] = useState(false)
  const [newOpening, setNewOpening] = useState({
    name: '',
    finishColor: ''
  })
  const [finishTypes, setFinishTypes] = useState<any[]>([])
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [selectedOpeningId, setSelectedOpeningId] = useState<number | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [componentWidth, setComponentWidth] = useState<string>('')
  const [componentHeight, setComponentHeight] = useState<string>('')
  const [swingDirection, setSwingDirection] = useState<string>('Right In')
  const [slidingDirection, setSlidingDirection] = useState<string>('Left')
  const [cornerDirection, setCornerDirection] = useState<string>('Up')
  const [glassType, setGlassType] = useState<string>('Clear')
  const [componentQuantity, setComponentQuantity] = useState<string>('1')
  // Hardware options for add component modal
  const [addComponentOptions, setAddComponentOptions] = useState<any[]>([])
  const [addComponentSelectedOptions, setAddComponentSelectedOptions] = useState<Record<number, number | null>>({})
  const [showComponentEdit, setShowComponentEdit] = useState(false)
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null)
  const [componentOptions, setComponentOptions] = useState<any[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number | null>>({})
  const [includedOptions, setIncludedOptions] = useState<number[]>([]) // Hardware options marked as included (no charge)
  const [editingComponentWidth, setEditingComponentWidth] = useState<string>('')
  const [editingComponentHeight, setEditingComponentHeight] = useState<string>('')
  const [editingGlassType, setEditingGlassType] = useState<string>('')
  const [editingDirection, setEditingDirection] = useState<string>('')
  const [editingProductType, setEditingProductType] = useState<string>('')
  const [editingPlanViews, setEditingPlanViews] = useState<any[]>([])
  const [currentPanelId, setCurrentPanelId] = useState<number | null>(null)
  const [savingComponent, setSavingComponent] = useState(false)
  const [showBOM, setShowBOM] = useState(false)
  const [bomData, setBomData] = useState<any>(null)
  const [loadingBOM, setLoadingBOM] = useState(false)
  const [bomViewMode, setBomViewMode] = useState<'byOpening' | 'summary'>('byOpening')
  const [showBOMDownloadMenu, setShowBOMDownloadMenu] = useState(false)
  const [showBOMDownloadDialog, setShowBOMDownloadDialog] = useState(false)
  const [uniqueBomList, setUniqueBomList] = useState<any[]>([])
  const [selectedBomHashes, setSelectedBomHashes] = useState<Set<string>>(new Set())
  const [loadingUniqueBoms, setLoadingUniqueBoms] = useState(false)
  const [summaryData, setSummaryData] = useState<any>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [showDrawingViewer, setShowDrawingViewer] = useState(false)
  const [selectedDrawingOpeningId, setSelectedDrawingOpeningId] = useState<number | null>(null)
  const [selectedDrawingOpeningNumber, setSelectedDrawingOpeningNumber] = useState<string>('')
  const [glassTypes, setGlassTypes] = useState<any[]>([])
  const [needsSync, setNeedsSync] = useState(false)
  const [showSyncConfirmation, setShowSyncConfirmation] = useState(false)
  const [syncingPrices, setSyncingPrices] = useState(false)
  const [syncDetails, setSyncDetails] = useState<string[]>([])

  // Bulk delete state
  const [selectedOpeningIds, setSelectedOpeningIds] = useState<Set<number>>(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Quote accepted edit confirmation state
  const [showQuoteAcceptedConfirm, setShowQuoteAcceptedConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [pendingActionDescription, setPendingActionDescription] = useState('')

  // Handle back navigation
  const handleBack = () => {
    setSelectedProjectId(null)
    // If we came from customer detail view, go back to dashboard (which shows customer detail)
    if (selectedCustomerId && customerDetailView) {
      setCurrentMenu('dashboard')
    }
    // Otherwise stay on projects menu (will show projects list)
  }

  // Check if project has quote accepted status and require confirmation for modifications
  const requireQuoteAcceptedConfirmation = (action: () => void, actionDescription: string): boolean => {
    if (project?.status === ProjectStatus.QUOTE_ACCEPTED) {
      setPendingAction(() => action)
      setPendingActionDescription(actionDescription)
      setShowQuoteAcceptedConfirm(true)
      return true // Confirmation required, action deferred
    }
    return false // No confirmation needed, proceed immediately
  }

  const handleConfirmQuoteAcceptedEdit = () => {
    if (pendingAction) {
      pendingAction()
    }
    setShowQuoteAcceptedConfirm(false)
    setPendingAction(null)
    setPendingActionDescription('')
  }

  const handleCancelQuoteAcceptedEdit = () => {
    setShowQuoteAcceptedConfirm(false)
    setPendingAction(null)
    setPendingActionDescription('')
  }

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: showQuoteAcceptedConfirm, onClose: () => { setShowQuoteAcceptedConfirm(false); setPendingAction(null); setPendingActionDescription('') } },
    { isOpen: showDeleteModal, isBlocked: isDeleting, onClose: () => { setShowDeleteModal(false); setDeletingOpeningId(null); setDeletingOpeningName('') } },
    { isOpen: showDeleteComponentModal, isBlocked: isDeletingComponent, onClose: () => { setShowDeleteComponentModal(false); setDeletingComponentId(null); setDeletingComponentName('') } },
    { isOpen: showBulkDeleteModal, isBlocked: isBulkDeleting, onClose: () => setShowBulkDeleteModal(false) },
    { isOpen: showSyncConfirmation, isBlocked: syncingPrices, onClose: () => setShowSyncConfirmation(false) },
    { isOpen: showArchiveModal, onClose: () => setShowArchiveModal(false) },
    { isOpen: showDuplicateModal, isBlocked: isDuplicating, onClose: () => { setShowDuplicateModal(false); setDuplicatingOpeningId(null) } },
    { isOpen: showEditOpeningModal, isBlocked: isUpdatingOpening, onClose: () => { setShowEditOpeningModal(false); setEditingOpeningId(null) } },
    { isOpen: showComponentEdit, isBlocked: savingComponent, onClose: () => setShowComponentEdit(false) },
    { isOpen: showAddComponent, onClose: () => setShowAddComponent(false) },
    { isOpen: showAddOpening, isBlocked: addingOpening, onClose: () => setShowAddOpening(false) },
    { isOpen: showDrawingViewer, onClose: () => setShowDrawingViewer(false) },
    { isOpen: showBOM, onClose: () => setShowBOM(false) },
    { isOpen: showEditModal, isBlocked: saving, onClose: () => setShowEditModal(false) },
  ])

  // Check if pricing needs sync and generate details
  useEffect(() => {
    if (project) {
      const details: string[] = []
      const affectedOpenings = new Map<string, Set<string>>() // opening name -> Set of change reasons
      const changedMasterParts = new Set<string>()
      const changedProducts = new Set<string>()
      const changedFormulas = new Set<string>()
      let hasNeverCalculated = false

      const needsSyncCheck = project.openings.some(opening => {
        const hasComponents = opening.panels.some(panel => panel.componentInstance)
        if (!hasComponents) return false

        // If never calculated, needs sync
        if (!opening.priceCalculatedAt) {
          hasNeverCalculated = true
          if (!affectedOpenings.has(opening.name)) {
            affectedOpenings.set(opening.name, new Set())
          }
          affectedOpenings.get(opening.name)!.add('never priced')
          return true
        }

        const priceCalcTime = new Date(opening.priceCalculatedAt).getTime()
        let openingNeedsSync = false

        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue

          const product = panel.componentInstance.product

          // Check 1: Product BOM updates
          const hasStaleProductBOM = product.productBOMs?.some((bom: any) => {
            const bomUpdateTime = new Date(bom.updatedAt).getTime()
            return bomUpdateTime > priceCalcTime
          })

          if (hasStaleProductBOM) {
            openingNeedsSync = true
            changedProducts.add(product.name)
            if (!affectedOpenings.has(opening.name)) {
              affectedOpenings.set(opening.name, new Set())
            }
            affectedOpenings.get(opening.name)!.add(`${product.name} BOM updated`)
          }

          // Check 2: Master part pricing changes
          if ((project as any)._syncInfo?.masterParts) {
            const bomPartNumbers = product.productBOMs?.map((bom: any) => bom.partNumber).filter(Boolean) || []

            for (const partNumber of bomPartNumbers) {
              const masterPartInfo = (project as any)._syncInfo.masterParts.find(
                (mp: any) => mp.partNumber === partNumber
              )

              if (masterPartInfo) {
                // Check if pricing rules were updated
                if (masterPartInfo.latestPricingRuleUpdate) {
                  const pricingUpdateTime = new Date(masterPartInfo.latestPricingRuleUpdate).getTime()
                  if (pricingUpdateTime > priceCalcTime) {
                    openingNeedsSync = true
                    changedMasterParts.add(`${masterPartInfo.baseName} (${partNumber})`)
                    if (!affectedOpenings.has(opening.name)) {
                      affectedOpenings.set(opening.name, new Set())
                    }
                    affectedOpenings.get(opening.name)!.add(`pricing updated for ${masterPartInfo.baseName}`)
                  }
                }

                // Check if stock length rules were updated (affects extrusion formulas)
                if (masterPartInfo.latestStockLengthRuleUpdate) {
                  const stockUpdateTime = new Date(masterPartInfo.latestStockLengthRuleUpdate).getTime()
                  if (stockUpdateTime > priceCalcTime) {
                    openingNeedsSync = true
                    changedFormulas.add(`${masterPartInfo.baseName} (${partNumber})`)
                    if (!affectedOpenings.has(opening.name)) {
                      affectedOpenings.set(opening.name, new Set())
                    }
                    affectedOpenings.get(opening.name)!.add(`formula updated for ${masterPartInfo.baseName}`)
                  }
                }
              }
            }
          }
        }

        return openingNeedsSync
      })

      // Build detailed sync messages
      if (hasNeverCalculated) {
        const neverPricedOpenings = Array.from(affectedOpenings.entries())
          .filter(([_, reasons]) => reasons.has('never priced'))
          .map(([name, _]) => name)

        if (neverPricedOpenings.length > 0) {
          details.push(`🆕 ${neverPricedOpenings.length} opening${neverPricedOpenings.length > 1 ? 's have' : ' has'} never been priced`)
        }
      }

      if (changedMasterParts.size > 0) {
        const partsList = Array.from(changedMasterParts).slice(0, 3).join(', ')
        const remaining = changedMasterParts.size - 3
        details.push(
          `💰 Master part pricing updated: ${partsList}${remaining > 0 ? ` and ${remaining} more` : ''}`
        )
      }

      if (changedFormulas.size > 0) {
        const formulaList = Array.from(changedFormulas).slice(0, 3).join(', ')
        const remaining = changedFormulas.size - 3
        details.push(
          `📏 Extrusion formulas updated: ${formulaList}${remaining > 0 ? ` and ${remaining} more` : ''}`
        )
      }

      if (changedProducts.size > 0) {
        const productList = Array.from(changedProducts).slice(0, 3).join(', ')
        const remaining = changedProducts.size - 3
        details.push(
          `🔧 Product BOMs updated: ${productList}${remaining > 0 ? ` and ${remaining} more` : ''}`
        )
      }

      // Add affected openings summary
      if (affectedOpenings.size > 0 && !hasNeverCalculated) {
        const openingsList = Array.from(affectedOpenings.keys()).slice(0, 3).join(', ')
        const remaining = affectedOpenings.size - 3
        details.push(
          `📍 Affected openings: ${openingsList}${remaining > 0 ? ` and ${remaining} more` : ''}`
        )
      }

      setNeedsSync(needsSyncCheck)
      setSyncDetails(details.length > 0 ? details : ['Pricing data has been updated'])
    }
  }, [project])

  useEffect(() => {
    if (selectedProjectId) {
      fetchProject()
    }
  }, [selectedProjectId])

  // Auto-open Add Opening modal when navigating from "Add Openings" button
  useEffect(() => {
    if (autoOpenAddOpening && project) {
      setAutoOpenAddOpening(false) // Reset the flag first
      // Check for quote accepted status before showing modal
      if (project.status === ProjectStatus.QUOTE_ACCEPTED) {
        setPendingAction(() => () => setShowAddOpening(true))
        setPendingActionDescription('add an opening')
        setShowQuoteAcceptedConfirm(true)
      } else {
        setShowAddOpening(true)
      }
    }
  }, [autoOpenAddOpening, project, setAutoOpenAddOpening])

  useEffect(() => {
    fetchGlassTypes()
    fetchPricingModes()
    fetchFinishTypes()
  }, [])

  async function fetchProject() {
    if (!selectedProjectId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`)
      if (response.ok) {
        const projectData = await response.json()
        setProject(projectData)
        setEditName(projectData.name)
        setEditStatus(projectData.status)
        return projectData
      }
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
    }
  }

  // Silent refresh - updates project data without showing loading spinner or affecting scroll position
  async function refreshProject() {
    if (!selectedProjectId) return

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`)
      if (response.ok) {
        const projectData = await response.json()
        setProject(projectData)
        return projectData
      }
    } catch (error) {
      console.error('Error refreshing project:', error)
    }
  }

  async function fetchGlassTypes() {
    try {
      const response = await fetch('/api/glass-types')
      if (response.ok) {
        const data = await response.json()
        setGlassTypes(data)
      }
    } catch (error) {
      console.error('Error fetching glass types:', error)
    }
  }

  async function fetchFinishTypes() {
    try {
      const response = await fetch('/api/settings/extrusion-finish-pricing')
      if (response.ok) {
        const data = await response.json()
        const activeFinishes = data.filter((f: any) => f.isActive)
        setFinishTypes(activeFinishes)

        // Set default finish color to first available finish type if not already set
        if (activeFinishes.length > 0 && (!newOpening.finishColor || newOpening.finishColor === 'Mill Finish')) {
          setNewOpening(prev => ({
            ...prev,
            finishColor: activeFinishes[0].finishType
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching finish types:', error)
    }
  }

  async function fetchPricingModes() {
    try {
      const response = await fetch('/api/pricing-modes')
      if (response.ok) {
        const data = await response.json()
        setPricingModes(data)
      }
    } catch (error) {
      console.error('Error fetching pricing modes:', error)
    }
  }

  async function calculateAllOpeningPrices(projectData: Project) {
    // Get all openings that need price calculation
    const openingsToCalculate = projectData.openings.filter(opening => 
      opening.panels.some(panel => panel.componentInstance)
    )
    
    if (openingsToCalculate.length === 0) return
    
    setCalculatingPrices(true)
    
    try {
      // Calculate prices for all openings in parallel
      const priceCalculations = openingsToCalculate.map(opening => 
        fetch(`/api/openings/${opening.id}/calculate-price`, {
          method: 'POST'
        }).catch(error => {
          console.error(`Error calculating price for opening ${opening.id}:`, error)
        })
      )
      
      // Wait for all price calculations to complete
      await Promise.allSettled(priceCalculations)
      
      // Refetch the project data to get updated prices
      try {
        const response = await fetch(`/api/projects/${selectedProjectId}`)
        if (response.ok) {
          const updatedProjectData = await response.json()
          setProject(updatedProjectData)
        }
      } catch (error) {
        console.error('Error refetching project after price calculation:', error)
      }
    } finally {
      setCalculatingPrices(false)
    }
  }

  async function handleSaveProject() {
    if (!selectedProjectId || !editName.trim()) return

    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          status: editStatus,
          pricingModeId: editPricingModeId
        })
      })

      if (response.ok) {
        // Silent refresh to preserve scroll position
        await refreshProject()
        showSuccess('Project updated successfully!')
        setShowEditModal(false)
      }
    } catch (error) {
      console.error('Error updating project:', error)
      showError('Error updating project')
    } finally {
      setSaving(false)
    }
  }

  function handleArchiveProject() {
    setShowArchiveModal(true)
  }

  async function confirmArchiveProject() {
    if (!selectedProjectId || !project) return

    setShowArchiveModal(false)
    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.name,
          status: 'Archive'
        })
      })

      if (response.ok) {
        showSuccess('Project archived successfully!')
        setSelectedProjectId(null) // Navigate back to projects list
      } else {
        showError('Failed to archive project')
      }
    } catch (error) {
      console.error('Error archiving project:', error)
      showError('Error archiving project')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateExtrusionCostingMethod(method: string) {
    if (!selectedProjectId || !project) return

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: project.name,
          status: project.status,
          extrusionCostingMethod: method
        })
      })

      if (response.ok) {
        // Fetch the full project data with openings
        const projectResponse = await fetch(`/api/projects/${selectedProjectId}`)
        if (projectResponse.ok) {
          const updatedProject = await projectResponse.json()

          // Recalculate all opening prices with the new costing method
          await calculateAllOpeningPrices(updatedProject)

          // Silent refresh to show updated prices without losing scroll position
          await refreshProject()

          showSuccess('Extrusion costing method updated and prices recalculated!')
        }
      } else {
        showError('Failed to update extrusion costing method')
      }
    } catch (error) {
      console.error('Error updating extrusion costing method:', error)
      showError('Network error. Please try again.')
    }
  }

  async function handleAddOpening() {
    if (!selectedProjectId || !newOpening.name.trim()) {
      showError('Opening number is required')
      return
    }
    
    setAddingOpening(true)
    try {
      const response = await fetch('/api/openings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          name: newOpening.name,
          finishColor: newOpening.finishColor
        })
      })

      if (response.ok) {
        // Reset form and close modal first
        setNewOpening({
          name: '',
          finishColor: finishTypes.length > 0 ? finishTypes[0].finishType : ''
        })
        setShowAddOpening(false)

        // Silent refresh to preserve scroll position
        try {
          await refreshProject()
          showSuccess('Opening added successfully!')
        } catch (fetchError) {
          console.error('Error refreshing project data:', fetchError)
          showError('Opening created but failed to refresh the list. Please refresh the page.')
        }
      } else {
        // Handle API errors
        try {
          const errorData = await response.json()
          showError(errorData.error || 'Failed to add opening')
        } catch {
          showError('Failed to add opening. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error adding opening:', error)
      showError('Network error. Please check your connection and try again.')
    } finally {
      setAddingOpening(false)
    }
  }

  function handleShowAddOpeningModal() {
    const proceedWithShowModal = () => {
      setShowAddOpening(true)
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithShowModal, 'add an opening')) {
      proceedWithShowModal()
    }
  }

  function handleShowDeleteModal(openingId: number, openingName: string) {
    const proceedWithDelete = () => {
      setDeletingOpeningId(openingId)
      setDeletingOpeningName(openingName)
      setShowDeleteModal(true)
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithDelete, 'delete an opening')) {
      proceedWithDelete()
    }
  }

  async function handleConfirmDelete() {
    if (!deletingOpeningId) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/openings/${deletingOpeningId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Silent refresh to preserve scroll position
        await refreshProject()
        setShowDeleteModal(false)
        setDeletingOpeningId(null)
        setDeletingOpeningName('')
      } else {
        showError('Error deleting opening')
      }
    } catch (error) {
      console.error('Error deleting opening:', error)
      showError('Error deleting opening')
    } finally {
      setIsDeleting(false)
    }
  }

  // Bulk selection handlers
  function toggleOpeningSelection(openingId: number) {
    setSelectedOpeningIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(openingId)) {
        newSet.delete(openingId)
      } else {
        newSet.add(openingId)
      }
      return newSet
    })
  }

  function toggleSelectAll() {
    if (!project) return
    if (selectedOpeningIds.size === project.openings.length) {
      setSelectedOpeningIds(new Set())
    } else {
      setSelectedOpeningIds(new Set(project.openings.map(o => o.id)))
    }
  }

  function clearSelection() {
    setSelectedOpeningIds(new Set())
  }

  function handleShowBulkDeleteModal() {
    const proceedWithBulkDelete = () => {
      setShowBulkDeleteModal(true)
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithBulkDelete, 'delete multiple openings')) {
      proceedWithBulkDelete()
    }
  }

  async function handleBulkDelete() {
    if (selectedOpeningIds.size === 0) return

    setIsBulkDeleting(true)
    try {
      const response = await fetch('/api/openings/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openingIds: Array.from(selectedOpeningIds)
        })
      })

      if (response.ok) {
        const result = await response.json()
        // Silent refresh to preserve scroll position
        await refreshProject()
        setShowBulkDeleteModal(false)
        setSelectedOpeningIds(new Set())
        showSuccess(`Deleted ${result.deletedCount} opening${result.deletedCount !== 1 ? 's' : ''}`)
      } else {
        showError('Error deleting openings')
      }
    } catch (error) {
      console.error('Error bulk deleting openings:', error)
      showError('Error deleting openings')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  function handleShowEditOpeningModal(opening: Opening) {
    const proceedWithEdit = () => {
      setEditingOpeningId(opening.id)
      setEditingOpeningName(opening.name)
      setEditingOpeningFinishColor(opening.finishColor || '')
      setShowEditOpeningModal(true)
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithEdit, 'edit an opening')) {
      proceedWithEdit()
    }
  }

  async function handleUpdateOpening() {
    if (!editingOpeningId || !editingOpeningName.trim()) return

    setIsUpdatingOpening(true)
    try {
      const response = await fetch(`/api/openings/${editingOpeningId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingOpeningName,
          finishColor: editingOpeningFinishColor || null
        }),
      })

      if (response.ok) {
        // Use silent refresh to avoid scroll position reset
        const updatedProject = await refreshProject()

        // Recalculate prices since finish color affects extrusion costs
        if (updatedProject) {
          await calculateAllOpeningPrices(updatedProject)
        }

        setShowEditOpeningModal(false)
        setEditingOpeningId(null)
        setEditingOpeningName('')
        setEditingOpeningFinishColor('')
      } else {
        showError('Error updating opening')
      }
    } catch (error) {
      console.error('Error updating opening:', error)
      showError('Error updating opening')
    } finally {
      setIsUpdatingOpening(false)
    }
  }

  function handleShowDrawings(openingId: number, name: string) {
    setSelectedDrawingOpeningId(openingId)
    setSelectedDrawingOpeningNumber(name)
    setShowDrawingViewer(true)
  }

  function handleShowDuplicateModal(openingId: number, openingName: string) {
    const proceedWithDuplicate = () => {
      setDuplicatingOpeningId(openingId)
      setDuplicatingOpeningName(openingName)
      setDuplicateNewName(openingName) // Default to original name
      setDuplicateCount('1')
      setAutoIncrement(false)
      setShowDuplicateModal(true)
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithDuplicate, 'duplicate an opening')) {
      proceedWithDuplicate()
    }
  }

  // Helper function to safely parse and validate duplicate count
  function getSafeDuplicateCount(): number {
    const count = parseInt(duplicateCount)
    if (isNaN(count) || count < 1 || count > 50) {
      return 0 // Return 0 for invalid values (will prevent array creation)
    }
    return count
  }

  // Helper function to check if any of the generated names already exist
  function getNameConflicts(): string[] {
    if (!project || !duplicateNewName.trim()) return []

    const trimmedBaseName = duplicateNewName.trim()
    const safeCount = getSafeDuplicateCount()
    if (safeCount < 1) return []

    const namesToCheck: string[] = []

    if (autoIncrement) {
      // Auto-increment: check smart incremented names
      for (let i = 0; i <= safeCount; i++) {
        namesToCheck.push(smartIncrementName(trimmedBaseName, i))
      }
    } else {
      // Non-auto-increment: check exact name or smart incremented names
      if (safeCount === 1) {
        namesToCheck.push(trimmedBaseName)
      } else {
        for (let i = 1; i <= safeCount; i++) {
          namesToCheck.push(smartIncrementName(trimmedBaseName, i))
        }
      }
    }

    // Find which names already exist (excluding the opening being duplicated if auto-increment)
    const existingNames = project.openings
      .filter(opening => {
        // In auto-increment mode, the original will be renamed, so don't count it as a conflict
        if (autoIncrement && opening.id === duplicatingOpeningId) {
          return false
        }
        return namesToCheck.includes(opening.name)
      })
      .map(opening => opening.name)

    return existingNames
  }

  async function handleDuplicateOpening() {
    if (!duplicatingOpeningId) return

    if (!duplicateNewName.trim()) {
      showError('Please enter a base name for the opening(s)')
      return
    }

    // Validate count
    const count = parseInt(duplicateCount)
    if (isNaN(count) || count < 1 || count > 50) {
      showError('Count must be between 1 and 50')
      return
    }

    setIsDuplicating(true)

    try {
      const response = await fetch(`/api/openings/${duplicatingOpeningId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          baseName: duplicateNewName.trim(),
          count: count,
          autoIncrement: autoIncrement
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to duplicate opening')
      }

      const result = await response.json()

      // Close modal and reset state
      setShowDuplicateModal(false)
      setDuplicatingOpeningId(null)
      setDuplicatingOpeningName('')
      setDuplicateNewName('')
      setDuplicateCount('1')
      setAutoIncrement(false)

      // Silent refresh to preserve scroll position
      await refreshProject()

      const message = autoIncrement
        ? `Successfully created ${count} duplicate(s) and renamed original`
        : `Successfully created ${count} duplicate(s)`
      showSuccess(message)

      // Auto-calculate prices for all created openings
      if (result.openings && result.openings.length > 0) {
        try {
          for (const opening of result.openings) {
            if (opening.panels && opening.panels.length > 0) {
              await fetch(`/api/openings/${opening.id}/calculate-price`, {
                method: 'POST'
              })
            }
          }
          // Silent refresh after all calculations to preserve scroll
          await refreshProject()
        } catch (calcError) {
          console.error('Error calculating prices:', calcError)
          showError('Openings duplicated but some price calculations failed')
        }
      }
    } catch (error: any) {
      console.error('Error duplicating opening:', error)
      showError(error.message || 'Failed to duplicate opening')
    } finally {
      setIsDuplicating(false)
    }
  }

  async function handleShowAddComponent(openingId: number) {
    const proceedWithAddComponent = async () => {
      setSelectedOpeningId(openingId)

      // Find the opening and check if it has existing panels (excluding FRAME panels)
      const opening = project?.openings.find(o => o.id === openingId)
      const nonFramePanels = opening?.panels?.filter(p =>
        p.componentInstance?.product?.productType !== 'FRAME'
      ) || []
      if (nonFramePanels.length > 0) {
        // Opening has existing non-frame panels - get height from first panel
        const existingHeight = nonFramePanels[0].height
        setComponentHeight(existingHeight.toString())
      } else {
        // First panel in opening (or only Frame panels) - reset height
        setComponentHeight('')
      }

      // Fetch products
      try {
        const response = await fetch('/api/products')
        if (response.ok) {
          const productsData = await response.json()
          setProducts(productsData)
          setShowAddComponent(true)
        }
      } catch (error) {
        console.error('Error fetching products:', error)
        alert('Error fetching products')
      }
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithAddComponent, 'add a component')) {
      proceedWithAddComponent()
    }
  }

  async function handleAddComponent() {
    if (!selectedOpeningId || !selectedProductId) return

    const selectedProduct = products.find(p => p.id === selectedProductId)
    const isCorner = selectedProduct?.productType === 'CORNER_90'
    const isFrame = selectedProduct?.productType === 'FRAME'

    // Calculate dimensions based on product type
    let width: number
    let height: number

    if (isCorner) {
      // Corners use placeholder 1x1 dimensions
      width = 1
      height = 1
    } else if (isFrame) {
      // Frame dimensions = sum of existing panel widths × max panel height
      const currentOpening = project?.openings.find(o => o.id === selectedOpeningId)
      const existingPanels = currentOpening?.panels.filter(p =>
        p.componentInstance?.product?.productType !== 'FRAME'
      ) || []
      width = existingPanels.reduce((sum, panel) => sum + (panel.width || 0), 0)
      height = existingPanels.length > 0 ? Math.max(...existingPanels.map(p => p.height || 0)) : 0
    } else {
      width = parseFloat(componentWidth) || 0
      height = parseFloat(componentHeight) || 0
    }

    // For FRAME products, always use 'N/A' glass type
    const effectiveGlassType = isFrame ? 'N/A' : glassType

    try {
      // First create a default panel for this component
      const panelResponse = await fetch('/api/panels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openingId: selectedOpeningId,
          type: 'Component',
          width: width,
          height: height,
          glassType: effectiveGlassType,
          locking: 'N/A',
          swingDirection: swingDirection,
          slidingDirection: slidingDirection,
          isCorner: isCorner,
          cornerDirection: cornerDirection,
          quantity: parseInt(componentQuantity) || 1
        })
      })

      if (panelResponse.ok) {
        const panelsData = await panelResponse.json()  // Now an array

        // Create component instances for all panels
        for (const panelData of panelsData) {
          const componentResponse = await fetch('/api/component-instances', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              panelId: panelData.id,
              productId: selectedProductId,
              subOptionSelections: addComponentSelectedOptions
            })
          })

          if (!componentResponse.ok) {
            console.error('Error creating component instance for panel:', panelData.id)
          }
        }

        // Reset form and close modal
        setShowAddComponent(false)
        setSelectedOpeningId(null)
        setSelectedProductId(null)
        setComponentWidth('')
        setComponentHeight('')
        setComponentQuantity('1')
        setSwingDirection('Right In')
        setSlidingDirection('Left')
        setGlassType('Clear')
        setAddComponentOptions([])
        setAddComponentSelectedOptions({})

        // Recalculate opening price
        if (selectedOpeningId) {
          try {
            await fetch(`/api/openings/${selectedOpeningId}/calculate-price`, {
              method: 'POST'
            })
          } catch (error) {
            console.error('Error recalculating opening price:', error)
          }
        }

        // Silent refresh to preserve scroll position
        await refreshProject()
      }
    } catch (error) {
      console.error('Error adding component:', error)
      alert('Error adding component')
    }
  }

  async function handleEditComponent(componentInstanceId: number) {
    const proceedWithEditComponent = async () => {
      setSelectedComponentId(componentInstanceId)

      try {
        // Fetch component instance details
        const componentResponse = await fetch(`/api/component-instances/${componentInstanceId}`)
        if (componentResponse.ok) {
          const componentData = await componentResponse.json()

          // Set current dimensions for editing
          setEditingComponentWidth(componentData.panel.width?.toString() || '')
          setEditingComponentHeight(componentData.panel.height?.toString() || '')
          setCurrentPanelId(componentData.panel.id)

          // Set glass type and direction for editing
          setEditingGlassType(componentData.panel.glassType || '')
          // Set direction based on product type
          if (componentData.panel.swingDirection) {
            setEditingDirection(componentData.panel.swingDirection)
          } else if (componentData.panel.slidingDirection) {
            setEditingDirection(componentData.panel.slidingDirection)
          } else {
            setEditingDirection('')
          }

          // Fetch available options for this product
          const productResponse = await fetch(`/api/products/${componentData.productId}`)
          if (productResponse.ok) {
            const productData = await productResponse.json()
            setComponentOptions(productData.productSubOptions || [])
            setSelectedOptions(JSON.parse(componentData.subOptionSelections || '{}'))
            setIncludedOptions(JSON.parse(componentData.includedOptions || '[]'))
            setEditingProductType(productData.productType || '')
            setEditingPlanViews(productData.planViews || [])
            setShowComponentEdit(true)
          }
        }
      } catch (error) {
        console.error('Error fetching component details:', error)
        alert('Error fetching component details')
      }
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithEditComponent, 'edit a component')) {
      proceedWithEditComponent()
    }
  }

  function handleDeleteComponent(panelId: number, componentName: string) {
    const proceedWithDeleteComponent = () => {
      setDeletingComponentId(panelId)
      setDeletingComponentName(componentName)
      setShowDeleteComponentModal(true)
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithDeleteComponent, 'delete a component')) {
      proceedWithDeleteComponent()
    }
  }

  async function confirmDeleteComponent() {
    if (!deletingComponentId) return

    setIsDeletingComponent(true)
    try {
      // Get the panel info to find the opening ID for price recalculation
      const panel = project?.openings.flatMap(o => o.panels).find(p => p.id === deletingComponentId)
      const openingId = panel?.openingId || project?.openings.find(o => o.panels.some(p => p.id === deletingComponentId))?.id

      const response = await fetch(`/api/panels/${deletingComponentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Recalculate opening price after component deletion
        if (openingId) {
          try {
            await fetch(`/api/openings/${openingId}/calculate-price`, {
              method: 'POST'
            })
          } catch (error) {
            console.error('Error recalculating opening price:', error)
          }
        }

        // Silent refresh to preserve scroll position
        await refreshProject()

        // Close the modal
        setShowDeleteComponentModal(false)
        setDeletingComponentId(null)
        setDeletingComponentName('')
      }
    } catch (error) {
      console.error('Error deleting component:', error)
      showError('Error deleting component')
    } finally {
      setIsDeletingComponent(false)
    }
  }

  async function handleShowBOM() {
    if (!selectedProjectId) return
    
    setLoadingBOM(true)
    setShowBOM(true)
    
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/bom`)
      if (response.ok) {
        const bomData = await response.json()
        setBomData(bomData)
      } else {
        showError('Failed to generate BOM')
        setShowBOM(false)
      }
    } catch (error) {
      console.error('Error fetching BOM:', error)
      showError('Error fetching BOM')
      setShowBOM(false)
    } finally {
      setLoadingBOM(false)
    }
  }

  async function handleDownloadBOMZip(uniqueOnly: boolean) {
    if (!selectedProjectId) return
    setShowBOMDownloadDialog(false)

    try {
      const url = uniqueOnly
        ? `/api/projects/${selectedProjectId}/bom/csv?zip=true&unique=true`
        : `/api/projects/${selectedProjectId}/bom/csv?zip=true`
      const response = await fetch(url)
      if (response.ok) {
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = uniqueOnly ? 'unique-boms.zip' : 'all-boms.zip'
        if (contentDisposition && contentDisposition.includes('filename=')) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
        }

        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(blobUrl)

        showSuccess(uniqueOnly ? 'Unique BOMs ZIP downloaded!' : 'All BOMs ZIP downloaded!')
      } else {
        showError('Failed to download BOMs')
      }
    } catch (error) {
      console.error('Error downloading BOMs:', error)
      showError('Error downloading BOMs')
    }
  }

  async function fetchUniqueBoms() {
    if (!selectedProjectId) return
    setLoadingUniqueBoms(true)
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/bom/csv?listOnly=true`)
      if (response.ok) {
        const data = await response.json()
        setUniqueBomList(data.uniqueComponents || [])
        // Select all by default
        setSelectedBomHashes(new Set(data.uniqueComponents?.map((c: any) => c.hash) || []))
      } else {
        showError('Failed to load unique BOMs')
      }
    } catch (error) {
      console.error('Error fetching unique BOMs:', error)
      showError('Error fetching unique BOMs')
    } finally {
      setLoadingUniqueBoms(false)
    }
  }

  async function handleDownloadSelectedBOMs() {
    if (!selectedProjectId || selectedBomHashes.size === 0) return
    setShowBOMDownloadDialog(false)

    try {
      const selectedParam = Array.from(selectedBomHashes).join('|')
      const url = `/api/projects/${selectedProjectId}/bom/csv?zip=true&unique=true&selected=${encodeURIComponent(selectedParam)}`
      const response = await fetch(url)
      if (response.ok) {
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = 'selected-boms.zip'
        if (contentDisposition && contentDisposition.includes('filename=')) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
        }

        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(blobUrl)

        showSuccess('Selected BOMs downloaded!')
      } else {
        showError('Failed to download BOMs')
      }
    } catch (error) {
      console.error('Error downloading BOMs:', error)
      showError('Error downloading BOMs')
    }
  }

  async function handleFetchSummary() {
    if (!selectedProjectId) return

    setLoadingSummary(true)

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/bom?summary=true`)
      if (response.ok) {
        const data = await response.json()
        setSummaryData(data)
      } else {
        showError('Failed to load purchasing summary')
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
      showError('Error fetching purchasing summary')
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleDownloadSummaryCSV() {
    if (!selectedProjectId) return

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/bom?summary=true&format=csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = 'purchasing-summary.csv'
        if (contentDisposition && contentDisposition.includes('filename=')) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
        }

        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        showSuccess('Purchasing summary CSV downloaded!')
      } else {
        showError('Failed to download purchasing summary CSV')
      }
    } catch (error) {
      console.error('Error downloading summary CSV:', error)
      showError('Error downloading purchasing summary CSV')
    }
  }

  function handleBomViewModeChange(mode: 'byOpening' | 'summary') {
    setBomViewMode(mode)
    if (mode === 'summary' && !summaryData) {
      handleFetchSummary()
    }
  }

  async function handleDownloadComponentBOM(panelId: number) {
    if (!selectedProjectId) return

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/bom/component/${panelId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = 'component-bom.csv'
        if (contentDisposition && contentDisposition.includes('filename=')) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
        }

        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        showSuccess('Component BOM downloaded successfully!')
      } else {
        showError('Failed to download component BOM')
      }
    } catch (error) {
      console.error('Error downloading component BOM:', error)
      showError('Error downloading component BOM')
    }
  }

  async function handleDragEnd(result: DropResult, openingId: number) {
    if (!result.destination || !project) return

    const sourceIndex = result.source.index
    const destIndex = result.destination.index

    if (sourceIndex === destIndex) return

    // Find the opening and its panels
    const opening = project.openings.find(o => o.id === openingId)
    if (!opening) return

    const panels = opening.panels.filter(p => p.componentInstance)

    // Reorder the panels array
    const reorderedPanels = Array.from(panels)
    const [removed] = reorderedPanels.splice(sourceIndex, 1)
    reorderedPanels.splice(destIndex, 0, removed)

    // Create new order mapping
    const panelOrders = reorderedPanels.map((panel, index) => ({
      id: panel.id,
      displayOrder: index
    }))

    // Optimistically update UI
    const updatedOpenings = project.openings.map(o => {
      if (o.id === openingId) {
        // Update displayOrder for all panels
        const updatedPanels = o.panels.map(panel => {
          const newOrder = panelOrders.find(po => po.id === panel.id)
          if (newOrder) {
            return { ...panel, displayOrder: newOrder.displayOrder }
          }
          return panel
        })

        return {
          ...o,
          panels: updatedPanels
        }
      }
      return o
    })

    // Sort panels by displayOrder to ensure UI updates immediately
    const sortedOpenings = updatedOpenings.map(opening => ({
      ...opening,
      panels: [...opening.panels].sort((a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      )
    }))

    setProject(prev => prev ? { ...prev, openings: sortedOpenings } : null)

    // Send update to server
    try {
      const response = await fetch('/api/panels/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ panelOrders })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reorder')
      }

      console.log('Panels reordered successfully:', panelOrders)
      // Silent refresh to preserve scroll position
      await refreshProject()
    } catch (error) {
      console.error('Error reordering panels:', error)
      showError('Failed to reorder components')
      // Revert on error (silent refresh to preserve scroll)
      await refreshProject()
    }
  }


  if (!selectedProjectId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No project selected</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Project not found</p>
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <button
                onClick={() => {
                  setEditName(project.name)
                  setEditStatus(project.status)
                  setEditPricingModeId(project.pricingModeId || null)
                  setShowEditModal(true)
                }}
                className="ml-3 p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit Project"
              >
                <Edit className="w-4 h-4" />
              </button>
              {needsSync && !calculatingPrices && (
                <button
                  onClick={() => setShowSyncConfirmation(true)}
                  className="ml-3 flex items-center text-sm text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                  title="Pricing is out of sync. Click to sync all opening prices with latest product BOMs and parts pricing."
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Needs Sync
                </button>
              )}
              {calculatingPrices && (
                <div className="ml-3 flex items-center text-sm text-blue-600">
                  <div className="w-4 h-4 border border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Calculating prices...
                </div>
              )}
            </div>
            <div className="flex items-center mt-2">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                project.status === 'Draft'
                  ? 'bg-gray-100 text-gray-800'
                  : project.status === 'In Progress'
                  ? 'bg-blue-100 text-blue-800'
                  : project.status === 'Completed'
                  ? 'bg-green-100 text-green-800'
                  : project.status === 'Archive'
                  ? 'bg-orange-100 text-orange-800'
                  : project.status === 'QUOTE_ACCEPTED'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {project.status === 'QUOTE_ACCEPTED' ? 'Quote Accepted' : project.status}
              </span>
              <span className="ml-4 text-gray-600">
                {project._count.openings} openings • Created {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleShowBOM}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <FileText className="w-5 h-5 mr-2" />
            View BOM
          </button>
          <button
            onClick={handleShowAddOpeningModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Opening
          </button>
        </div>
      </div>

      {/* Openings Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Openings</h2>
        </div>

        {project.openings.length > 0 ? (
          <div className="space-y-4">
            {project.openings.map((opening) => (
              <div key={opening.id} className="border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <h3 className="font-bold text-gray-900">{opening.name}</h3>
                        <button
                          onClick={() => handleShowEditOpeningModal(opening)}
                          className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                          title="Edit opening name and finish"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                      </div>
                      <span className="px-2 py-1 text-sm font-bold rounded border bg-green-600 text-white border-green-600">
                        ${opening.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleShowDrawings(opening.id, opening.name)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Shop Drawings"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShowDuplicateModal(opening.id, opening.name)}
                        className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Duplicate this opening with all components"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShowAddComponent(opening.id)}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center text-sm font-medium shadow-sm transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Component
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {opening.roughWidth && opening.roughHeight && (
                      <span>
{`${opening.roughWidth}" W × ${opening.roughHeight}" H (Rough)`}
                      </span>
                    )}
                    {opening.finishColor && (
                      <>
                        {opening.roughWidth && opening.roughHeight && <span>•</span>}
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          Finish: <span className="font-medium text-gray-700">{opening.finishColor}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Components */}
                <div className="mt-4">
                  <div className="mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Components ({opening.panels.filter(p => p.componentInstance).length})</h4>
                  </div>
                  {opening.panels.filter(p => p.componentInstance).length > 0 ? (
                    <DragDropContext onDragEnd={(result) => handleDragEnd(result, opening.id)}>
                      <Droppable droppableId={`opening-${opening.id}`}>
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-2"
                          >
                            {opening.panels
                              .filter(p => p.componentInstance)
                              .sort((a, b) => a.displayOrder - b.displayOrder)
                              .map((panel, index) => (
                              <Draggable key={panel.id} draggableId={`panel-${panel.id}`} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`text-sm rounded p-3 cursor-grab active:cursor-grabbing ${panel.isCorner ? 'bg-orange-50 border-2 border-orange-200' : 'bg-gray-50'} ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                  >
                          <div className={`flex justify-between items-start ${panel.isCorner ? 'relative' : ''}`}>
                            {panel.isCorner && (
                              <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                                90° Corner
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-blue-600 cursor-pointer hover:text-blue-800"
                                   onClick={() => handleEditComponent(panel.componentInstance!.id)}>
                                {panel.componentInstance!.product.name}
                                {panel.isCorner && ` (${panel.cornerDirection})`}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-600">{panel.componentInstance!.product.type}</span>
                                {panel.isCorner && (
                                  <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                                    ⊥ {panel.cornerDirection}
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-500 text-xs">
                                {panel.isCorner ? (
                                  <span className="text-orange-600 font-medium">
                                    Directional corner - no dimensions
                                  </span>
                                ) : (
                                  `${panel.width}" W × ${panel.height}" H`
                                )}
                              </div>
                              {/* Glass Type Display */}
                              {panel.glassType && panel.glassType !== 'N/A' && (
                                <div className="text-gray-500 text-xs mt-1">
                                  <div className="pl-2 border-l-2 border-gray-200">
                                    Glass: {panel.glassType}
                                  </div>
                                </div>
                              )}
                              {/* Hardware Options Display */}
                              <div className="text-gray-500 text-xs mt-1">
                                {(() => {
                                  try {
                                    const selectionsStr = panel.componentInstance!.subOptionSelections || '{}'
                                    const selections = JSON.parse(selectionsStr)
                                    const product = panel.componentInstance!.product
                                    const optionItems: Array<{ categoryName: string; optionName: string }> = []

                                    // Only process if there are actual selections
                                    if (Object.keys(selections).length === 0) {
                                      return null
                                    }

                                    Object.entries(selections).forEach(([categoryId, optionId]) => {
                                      if (optionId) {
                                        // Find the category and option
                                        const productOption = (product as any).productSubOptions?.find((pso: any) =>
                                          pso.category.id === parseInt(categoryId)
                                        )
                                        if (productOption) {
                                          const individualOption = productOption.category.individualOptions?.find((opt: any) =>
                                            opt.id === Number(optionId)
                                          )
                                          if (individualOption) {
                                            optionItems.push({
                                              categoryName: productOption.category.name,
                                              optionName: individualOption.name
                                            })
                                          }
                                        }
                                      }
                                    })

                                    if (optionItems.length === 0) return null

                                    return (
                                      <>
                                        {optionItems.map((item, index) => (
                                          <div key={index} className="pl-2 border-l-2 border-gray-200">
                                            {item.categoryName}: {item.optionName}
                                          </div>
                                        ))}
                                      </>
                                    )
                                  } catch (e) {
                                    return null
                                  }
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleEditComponent(panel.componentInstance!.id)}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Edit Options"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteComponent(panel.id, panel.componentInstance!.product.name)}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Component"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  ) : (
                    <p className="text-sm text-gray-500">No components added yet</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No openings added yet. Create your first opening to get started!
          </div>
        )}
      </div>

      {/* Add Opening Modal */}
      {showAddOpening && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Opening</h2>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Opening sizes will be calculated from the components you add. BOMs can be generated per opening and per project.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Number</label>
                <input
                  type="text"
                  value={newOpening.name}
                  onChange={(e) => setNewOpening({...newOpening, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="e.g., 001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Extrusion Finish</label>
                <select
                  value={newOpening.finishColor}
                  onChange={(e) => setNewOpening({...newOpening, finishColor: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  {finishTypes.map((finish) => (
                    <option key={finish.id} value={finish.finishType}>
                      {finish.finishType} {finish.costPerFoot > 0 ? `(+$${finish.costPerFoot.toFixed(2)}/ft)` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  This finish will apply to all extrusions in this opening
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-6">
              <button
                onClick={() => {
                  if (!addingOpening) {
                    setShowAddOpening(false)
                    setNewOpening({
                      name: '',
                      finishColor: finishTypes.length > 0 ? finishTypes[0].finishType : ''
                    })
                  }
                }}
                disabled={addingOpening}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOpening}
                disabled={addingOpening || !newOpening.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {addingOpening && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {addingOpening ? 'Adding...' : 'Add Opening'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Component Modal */}
      {showAddComponent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Component</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={selectedProductId || ''}
                  onChange={(e) => {
                    const productId = parseInt(e.target.value)
                    setSelectedProductId(productId)

                    // Load hardware options for the selected product
                    const product = products.find(p => p.id === productId)
                    if (product?.productSubOptions && product.productSubOptions.length > 0) {
                      setAddComponentOptions(product.productSubOptions)
                      // Pre-select standard options
                      const preselected: Record<number, number | null> = {}
                      for (const pso of product.productSubOptions) {
                        if (pso.standardOptionId) {
                          preselected[pso.category.id] = pso.standardOptionId
                        }
                      }
                      setAddComponentSelectedOptions(preselected)
                    } else {
                      setAddComponentOptions([])
                      setAddComponentSelectedOptions({})
                    }

                    // Set swing direction to first plan view name if available
                    if (product?.productType === 'SWING_DOOR' && product.planViews?.length > 0) {
                      setSwingDirection(product.planViews[0].name)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productType === 'CORNER_90' ? '90° Corner' : product.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Dimensions - Hide for corner and frame components */}
              {(() => {
                const selectedProduct = products.find(p => p.id === selectedProductId)
                const isCornerProduct = selectedProduct?.productType === 'CORNER_90'
                const isFrameProduct = selectedProduct?.productType === 'FRAME'

                if (isCornerProduct) {
                  return (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full mr-3">
                          90°
                        </div>
                        <div>
                          <p className="text-sm font-medium text-orange-800">Directional Corner</p>
                          <p className="text-xs text-orange-600">No dimensions required - represents change in direction</p>
                        </div>
                      </div>
                    </div>
                  )
                }

                if (isFrameProduct) {
                  const currentOpening = project?.openings.find(o => o.id === selectedOpeningId)
                  const existingPanels = currentOpening?.panels.filter(p =>
                    p.componentInstance?.product?.productType !== 'FRAME'
                  ) || []
                  const calculatedWidth = existingPanels.reduce((sum, panel) => sum + (panel.width || 0), 0)
                  const calculatedHeight = existingPanels.length > 0 ? Math.max(...existingPanels.map(p => p.height || 0)) : 0

                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full mr-3">
                          Frame
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-800">Auto-Calculated Dimensions</p>
                          <p className="text-xs text-blue-600">
                            {existingPanels.length > 0
                              ? `Width: ${calculatedWidth}" (sum of panels) × Height: ${calculatedHeight}" (max panel height)`
                              : 'Add components first - frame dimensions calculated from opening components'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                }
                
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                      <input
                        type="number"
                        value={componentWidth}
                        onChange={(e) => setComponentWidth(e.target.value)}
                        placeholder="Enter width"
                        step="0.01"
                        min="0"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                          componentWidth && parseFloat(componentWidth) <= 0 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-300'
                        }`}
                      />
                      {componentWidth && parseFloat(componentWidth) <= 0 && (
                        <p className="text-red-500 text-xs mt-1">Width must be greater than 0</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                      <input
                        type="number"
                        value={componentHeight}
                        onChange={(e) => setComponentHeight(e.target.value)}
                        placeholder="Enter height"
                        step="0.01"
                        min="0"
                        disabled={(() => {
                          const opening = project?.openings.find(o => o.id === selectedOpeningId)
                          const nonFramePanels = opening?.panels?.filter(p =>
                            p.componentInstance?.product?.productType !== 'FRAME'
                          ) || []
                          return nonFramePanels.length > 0
                        })()}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                          (() => {
                            const opening = project?.openings.find(o => o.id === selectedOpeningId)
                            const nonFramePanels = opening?.panels?.filter(p =>
                              p.componentInstance?.product?.productType !== 'FRAME'
                            ) || []
                            const isDisabled = nonFramePanels.length > 0
                            if (isDisabled) {
                              return 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                            }
                            return componentHeight && parseFloat(componentHeight) <= 0
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-300'
                          })()
                        }`}
                      />
                      {componentHeight && parseFloat(componentHeight) <= 0 && (
                        <p className="text-red-500 text-xs mt-1">Height must be greater than 0</p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Quantity field - show for all non-corner/non-frame components */}
              {(() => {
                const selectedProduct = products.find(p => p.id === selectedProductId)
                const isCornerProduct = selectedProduct?.productType === 'CORNER_90'
                const isFrameProduct = selectedProduct?.productType === 'FRAME'

                if (isCornerProduct || isFrameProduct) return null

                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={componentQuantity}
                      onChange={(e) => setComponentQuantity(e.target.value)}
                      placeholder="Enter quantity"
                      step="1"
                      min="1"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        componentQuantity && parseInt(componentQuantity) <= 0
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    {componentQuantity && parseInt(componentQuantity) <= 0 && (
                      <p className="text-red-500 text-xs mt-1">Quantity must be at least 1</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Number of identical components to add
                    </p>
                  </div>
                )
              })()}

              {/* Direction Selection - Show for Swing, Sliding, and Corner */}
              {selectedProductId && (() => {
                const selectedProduct = products.find(p => p.id === selectedProductId)

                if (selectedProduct?.productType === 'SWING_DOOR') {
                  const planViewOptions = selectedProduct.planViews || []

                  if (planViewOptions.length === 0) {
                    return (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          No elevation views have been added to this product. Please add elevation views in the product settings to enable direction selection.
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Direction</label>
                      <select
                        value={swingDirection}
                        onChange={(e) => setSwingDirection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      >
                        {planViewOptions.map((planView: any) => (
                          <option key={planView.id} value={planView.name}>
                            {planView.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                } else if (selectedProduct?.productType === 'SLIDING_DOOR') {
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Direction</label>
                      <select
                        value={slidingDirection}
                        onChange={(e) => setSlidingDirection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      >
                        {SLIDING_DIRECTIONS.map((direction) => (
                          <option key={direction} value={direction}>
                            {direction}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                } else if (selectedProduct?.productType === 'CORNER_90') {
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Direction</label>
                      <select
                        value={cornerDirection}
                        onChange={(e) => setCornerDirection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      >
                        {CORNER_DIRECTIONS.map((direction) => (
                          <option key={direction} value={direction}>
                            {direction}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Corner components will be added perpendicular to this direction
                      </p>
                    </div>
                  )
                }
                return null
              })()}
              
              {/* Hardware Options - Show after direction selection */}
              {selectedProductId && addComponentOptions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Hardware Options</h3>
                  {addComponentOptions.map((option) => (
                    <div key={option.id}>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                        {option.category.name}
                        {addComponentSelectedOptions[option.category.id] === option.standardOptionId && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Standard Option Applied</span>
                        )}
                      </label>
                      <select
                        value={addComponentSelectedOptions[option.category.id] || ''}
                        onChange={(e) => {
                          const newValue = e.target.value ? parseInt(e.target.value) : null
                          setAddComponentSelectedOptions({
                            ...addComponentSelectedOptions,
                            [option.category.id]: newValue
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      >
                        <option value="">Select option...</option>
                        {option.category.individualOptions?.map((individualOption: any) => (
                          <option key={individualOption.id} value={individualOption.id}>
                            {individualOption.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* Glass Type Selection - Show for all components except FRAME */}
              {selectedProductId && products.find(p => p.id === selectedProductId)?.productType !== 'FRAME' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Glass Type</label>
                  <select
                    value={glassType}
                    onChange={(e) => setGlassType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {glassTypes.length > 0 ? (
                      glassTypes.map((type) => (
                        <option key={type.id} value={type.name}>
                          {type.name} (${type.pricePerSqFt}/sqft)
                        </option>
                      ))
                    ) : (
                      <option value="">No glass types available</option>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select the type of glass for this component
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 pt-6">
              <button
                onClick={() => {
                  setShowAddComponent(false)
                  setSelectedOpeningId(null)
                  setSelectedProductId(null)
                  setComponentWidth('')
                  setComponentHeight('')
                  setComponentQuantity('1')
                  setSwingDirection('Right In')
                  setSlidingDirection('Left')
                  setGlassType('Clear')
                  setAddComponentOptions([])
                  setAddComponentSelectedOptions({})
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComponent}
                disabled={(() => {
                  if (!selectedProductId) return true
                  const selectedProduct = products.find(p => p.id === selectedProductId)
                  const isCorner = selectedProduct?.productType === 'CORNER_90'
                  const isFrame = selectedProduct?.productType === 'FRAME'

                  // For corner and frame components, only product selection is required
                  if (isCorner || isFrame) return false

                  // For other components, dimensions and valid quantity are required
                  const quantityValue = parseInt(componentQuantity)
                  return !componentWidth || !componentHeight ||
                         parseFloat(componentWidth) <= 0 ||
                         parseFloat(componentHeight) <= 0 ||
                         !quantityValue || quantityValue <= 0
                })()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Component
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Component Edit Modal */}
      {showComponentEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Component</h2>
            
            {/* Dimensions Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Dimensions</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width (inches)
                  </label>
                  <input
                    type="number"
                    step="0.125"
                    min="0.125"
                    value={editingComponentWidth}
                    onChange={(e) => setEditingComponentWidth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Width"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (inches)
                  </label>
                  <input
                    type="number"
                    step="0.125"
                    min="0.125"
                    value={editingComponentHeight}
                    onChange={(e) => setEditingComponentHeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Height"
                  />
                </div>
              </div>
            </div>

            {/* Glass Type Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Glass Type</h3>
              <select
                value={editingGlassType}
                onChange={(e) => setEditingGlassType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="">Select glass type...</option>
                {glassTypes.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name} {type.pricePerSqFt > 0 && `(+$${type.pricePerSqFt}/sq ft)`}
                  </option>
                ))}
              </select>
            </div>

            {/* Direction Section - Show based on product type */}
            {editingProductType && editingProductType !== 'FIXED_PANEL' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {editingProductType === 'SWING_DOOR' ? 'Swing Direction' : 'Sliding Direction'}
                </h3>
                {editingProductType === 'SWING_DOOR' && editingPlanViews.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      No elevation views have been added to this product. Please add elevation views in the product settings.
                    </p>
                  </div>
                ) : (
                  <select
                    value={editingDirection}
                    onChange={(e) => setEditingDirection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {editingProductType === 'SWING_DOOR' ? (
                      editingPlanViews.map((planView) => (
                        <option key={planView.id} value={planView.name}>{planView.name}</option>
                      ))
                    ) : (
                      SLIDING_DIRECTIONS.map((dir) => (
                        <option key={dir} value={dir}>{dir}</option>
                      ))
                    )}
                  </select>
                )}
              </div>
            )}

            {/* Options Section */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-700">Product Options</h3>
              {componentOptions.length > 0 ? (
                componentOptions.map((option) => (
                  <div key={option.id}>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      {option.category.name}
                      {selectedOptions[option.category.id] === option.standardOptionId && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Standard Option Applied</span>
                      )}
                    </label>
                    {option.category.description && (
                      <p className="text-xs text-gray-500 mb-2">{option.category.description}</p>
                    )}
                    <select
                      value={selectedOptions[option.category.id] || ''}
                      onChange={(e) => {
                        const newValue = e.target.value ? parseInt(e.target.value) : null
                        setSelectedOptions({
                          ...selectedOptions,
                          [option.category.id]: newValue
                        })
                        // If unselecting an option, remove it from included list
                        if (!newValue && selectedOptions[option.category.id]) {
                          setIncludedOptions(includedOptions.filter(id => id !== selectedOptions[option.category.id]))
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    >
                      <option value="">Select option...</option>
                      {option.category.individualOptions?.map((individualOption: any) => (
                        <option key={individualOption.id} value={individualOption.id}>
                          {individualOption.name}
                          {option.standardOptionId === individualOption.id && ' \u2605'}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No configurable options for this product</p>
              )}
            </div>
            <div className="flex justify-end space-x-3 pt-6">
              <button
                onClick={() => {
                  setShowComponentEdit(false)
                  setSelectedComponentId(null)
                  setSelectedOptions({})
                  setIncludedOptions([])
                  setEditingComponentWidth('')
                  setEditingComponentHeight('')
                  setEditingGlassType('')
                  setEditingDirection('')
                  setEditingProductType('')
                  setEditingPlanViews([])
                  setCurrentPanelId(null)
                }}
                disabled={savingComponent}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedComponentId || !currentPanelId) return

                  const width = parseFloat(editingComponentWidth)
                  const height = parseFloat(editingComponentHeight)

                  if (!width || width <= 0 || !height || height <= 0) {
                    showError('Please enter valid dimensions')
                    return
                  }

                  setSavingComponent(true)
                  try {
                    // Update panel dimensions, glass type, and direction
                    const panelUpdateData: Record<string, any> = {
                      width: width,
                      height: height,
                      glassType: editingGlassType || undefined
                    }

                    // Add direction based on product type
                    if (editingProductType === 'SWING_DOOR' && editingDirection) {
                      panelUpdateData.swingDirection = editingDirection
                    } else if (editingProductType === 'SLIDING_DOOR' && editingDirection) {
                      panelUpdateData.slidingDirection = editingDirection
                    }

                    const panelResponse = await fetch(`/api/panels/${currentPanelId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(panelUpdateData)
                    })

                    if (!panelResponse.ok) {
                      showError('Error updating component dimensions')
                      return
                    }

                    // Update component options
                    const componentResponse = await fetch(`/api/components/${selectedComponentId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        subOptionSelections: selectedOptions,
                        includedOptions: includedOptions
                      })
                    })

                    if (!componentResponse.ok) {
                      showError('Error saving component options')
                      return
                    }

                    showSuccess('Component updated successfully!')

                    // Recalculate opening price
                    const panel = project?.openings.flatMap(o => o.panels).find(p => p.id === currentPanelId)
                    const openingId = panel?.openingId || project?.openings.find(o => o.panels.some(p => p.id === currentPanelId))?.id

                    if (openingId) {
                      try {
                        await fetch(`/api/openings/${openingId}/calculate-price`, {
                          method: 'POST'
                        })
                      } catch (error) {
                        console.error('Error recalculating opening price:', error)
                      }
                    }

                    // Fetch updated project data (silent refresh to preserve scroll)
                    await refreshProject()

                    setShowComponentEdit(false)
                    setSelectedComponentId(null)
                    setSelectedOptions({})
                    setIncludedOptions([])
                    setEditingComponentWidth('')
                    setEditingComponentHeight('')
                    setEditingGlassType('')
                    setEditingDirection('')
                    setEditingProductType('')
                    setEditingPlanViews([])
                    setCurrentPanelId(null)
                  } catch (error) {
                    console.error('Error updating component:', error)
                    showError('Error updating component')
                  } finally {
                    setSavingComponent(false)
                  }
                }}
                disabled={savingComponent}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {savingComponent && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {savingComponent ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md relative">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                  placeholder="Enter project name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                >
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Openings Management */}
              {project && project.openings.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Openings ({project.openings.length})
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedOpeningIds.size === project.openings.length && project.openings.length > 0}
                        onChange={toggleSelectAll}
                        disabled={saving}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      Select All
                    </label>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                    {project.openings.map((opening) => (
                      <div key={opening.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedOpeningIds.has(opening.id)}
                            onChange={() => toggleOpeningSelection(opening.id)}
                            disabled={saving}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{opening.name}</span>
                            <div className="text-xs text-gray-500">
                              {opening.panels.filter(p => p.componentInstance).length} components • ${opening.price.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleShowDeleteModal(opening.id, opening.name)}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                          title="Delete Opening"
                          disabled={saving}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-200">
              <button
                onClick={handleArchiveProject}
                className="p-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                title="Archive Project"
                disabled={saving}
              >
                <Archive className="w-4 h-4" />
              </button>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedOpeningIds(new Set())
                  }}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                {selectedOpeningIds.size > 0 ? (
                  <>
                    <span className="text-sm text-gray-600">
                      {selectedOpeningIds.size} selected
                    </span>
                    <button
                      onClick={handleShowBulkDeleteModal}
                      disabled={saving}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      Delete Selected
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleSaveProject}
                    disabled={saving || !editName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {saving && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Confirmation Modal */}
      {showSyncConfirmation && project && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sync All Pricing?</h2>

            {/* What Changed Section */}
            {syncDetails.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">What changed:</h3>
                <ul className="text-sm text-amber-800 space-y-2">
                  {syncDetails.map((detail, index) => (
                    <li key={index} className="flex items-start">
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-gray-600 mb-6 text-left">
              This will recalculate all opening prices with the latest product BOMs, master parts pricing, and glass types.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setShowSyncConfirmation(false)}
                disabled={syncingPrices}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                No, Cancel
              </button>
              <button
                onClick={async () => {
                  setSyncingPrices(true)
                  setCalculatingPrices(true)
                  try {
                    // Recalculate all opening prices
                    const calculations = project.openings.map(opening =>
                      fetch(`/api/openings/${opening.id}/calculate-price`, {
                        method: 'POST'
                      }).catch(error => {
                        console.error(`Error recalculating price for opening ${opening.id}:`, error)
                      })
                    )

                    await Promise.allSettled(calculations)
                    // Silent refresh to preserve scroll position
                    await refreshProject()
                    showSuccess('All pricing synced successfully!')
                    setShowSyncConfirmation(false)
                  } catch (error) {
                    console.error('Error syncing prices:', error)
                    showError('Error syncing prices')
                  } finally {
                    setSyncingPrices(false)
                    setCalculatingPrices(false)
                  }
                }}
                disabled={syncingPrices}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                {syncingPrices ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Syncing...
                  </>
                ) : (
                  'Yes, Sync Now'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOM Modal */}
      {showBOM && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-6xl h-5/6 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Bill of Materials</h2>
                  <p className="text-gray-600 mt-1">{project?.name}</p>
                </div>
                <div className="flex items-center space-x-3">
                  {bomViewMode === 'byOpening' ? (
                    <button
                      onClick={() => {
                        setShowBOMDownloadDialog(true)
                        fetchUniqueBoms()
                      }}
                      disabled={loadingBOM || !bomData}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download BOMs
                    </button>
                  ) : (
                    <button
                      onClick={handleDownloadSummaryCSV}
                      disabled={loadingSummary || !summaryData}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Purchasing CSV
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowBOM(false)
                      setBomData(null)
                      setSummaryData(null)
                      setBomViewMode('byOpening')
                    }}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="mt-4 flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                  onClick={() => handleBomViewModeChange('byOpening')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    bomViewMode === 'byOpening'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  By Opening
                </button>
                <button
                  onClick={() => handleBomViewModeChange('summary')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    bomViewMode === 'summary'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Purchasing Summary
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6">
              {bomViewMode === 'byOpening' ? (
                /* By Opening View */
                loadingBOM ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Generating BOM...</p>
                    </div>
                  </div>
                ) : bomData ? (
                  <div className="h-full overflow-auto">
                    {bomData.groupedBomItems && Object.keys(bomData.groupedBomItems).length > 0 ? (
                      <>
                        <div className="mb-6 text-sm text-gray-600">
                          <strong>{bomData.bomItems?.length || 0}</strong> total items across <strong>{Object.keys(bomData.groupedBomItems).length}</strong> openings
                        </div>

                        <div className="space-y-8">
                          {Object.entries(bomData.groupedBomItems).map(([openingName, components]: [string, any]) => (
                            <div key={openingName} className="border border-gray-200 rounded-lg">
                              {/* Opening Header */}
                              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                                <h3 className="text-lg font-semibold text-gray-900">Opening: {openingName}</h3>
                                <p className="text-sm text-gray-600">
                                  {Object.keys(components).length} component{Object.keys(components).length !== 1 ? 's' : ''}
                                </p>
                              </div>

                              {/* Components */}
                            <div className="p-4 space-y-6">
                              {Object.entries(components).map(([componentKey, component]: [string, any]) => (
                                <div key={componentKey} className="border border-gray-100 rounded-lg">
                                  {/* Component Header */}
                                  <div className="bg-blue-50 px-4 py-2 border-b border-gray-100 rounded-t-lg">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <h4 className="font-medium text-blue-900">{component.productName}</h4>
                                        <p className="text-sm text-blue-700">
                                          {component.panelWidth}" W × {component.panelHeight}" H
                                        </p>
                                      </div>
                                      <div className="flex items-center space-x-3">
                                        <div className="text-sm text-blue-600">
                                          {component.items.length} part{component.items.length !== 1 ? 's' : ''}
                                        </div>
                                        <button
                                          onClick={() => handleDownloadComponentBOM(component.panelId)}
                                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                          title="Download Component BOM"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Component BOM Table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                      <thead>
                                        <tr className="bg-gray-50">
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Part Number</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Part Name</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Type</th>
                                          <th className="border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-900">Qty</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Cut Length</th>
                                          <th className="border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-900">% of Stock</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Unit</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Description</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {component.items.map((item: any, index: number) => (
                                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border border-gray-200 px-3 py-2 text-sm font-mono text-gray-900">{item.partNumber}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">{item.partName}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm">
                                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                item.partType === 'Extrusion' 
                                                  ? 'bg-blue-100 text-blue-800'
                                                  : item.partType === 'Hardware'
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-purple-100 text-purple-800'
                                              }`}>
                                                {item.partType}
                                              </span>
                                            </td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-center text-gray-900">{item.quantity}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">
                                              {item.partType === 'Glass' ? (
                                                <div>
                                                  <div className="font-medium">{item.glassWidth?.toFixed(2)}" × {item.glassHeight?.toFixed(2)}"</div>
                                                  <div className="text-xs text-gray-500">({item.glassArea} SQ FT)</div>
                                                </div>
                                              ) : (
                                                item.cutLength ? `${item.cutLength.toFixed(2)}"` : '-'
                                              )}
                                            </td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-center text-gray-900">
                                              {item.percentOfStock !== null && item.percentOfStock !== undefined ? (
                                                `${item.percentOfStock.toFixed(1)}%`
                                              ) : (
                                                '-'
                                              )}
                                            </td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">{item.unit}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-500">{item.description}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No BOM Items Found</h3>
                        <p className="text-gray-600">Add components to your openings to generate a bill of materials.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>Failed to load BOM data</p>
                  </div>
                )
              ) : (
                /* Purchasing Summary View */
                loadingSummary ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading purchasing summary...</p>
                    </div>
                  </div>
                ) : summaryData ? (
                  <div className="h-full overflow-auto">
                    {summaryData.summaryItems && summaryData.summaryItems.length > 0 ? (
                      <>
                        {/* Summary Stats */}
                        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-gray-900">{summaryData.totalParts}</div>
                            <div className="text-sm text-gray-600">Total Parts</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-blue-600">{summaryData.totalExtrusions}</div>
                            <div className="text-sm text-blue-600">Extrusions</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-green-600">{summaryData.totalHardware}</div>
                            <div className="text-sm text-green-600">Hardware</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-purple-600">{summaryData.totalGlass}</div>
                            <div className="text-sm text-purple-600">Glass</div>
                          </div>
                          <div className="bg-orange-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-orange-600">{summaryData.totalOptions}</div>
                            <div className="text-sm text-orange-600">Options</div>
                          </div>
                        </div>

                        {/* Summary Table */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">Part Number</th>
                                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">Part Name</th>
                                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                                <th className="border-b border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900">Total Qty</th>
                                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">Unit</th>
                                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">Cut Lengths / Dimensions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summaryData.summaryItems.map((item: any, index: number) => (
                                <tr key={item.partNumber} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm font-mono text-gray-900">{item.partNumber}</td>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-900">{item.partName}</td>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                      item.partType === 'Extrusion'
                                        ? 'bg-blue-100 text-blue-800'
                                        : item.partType === 'Hardware'
                                        ? 'bg-green-100 text-green-800'
                                        : item.partType === 'Glass'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-orange-100 text-orange-800'
                                    }`}>
                                      {item.partType}
                                    </span>
                                  </td>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-center font-semibold text-gray-900">{item.totalQuantity}</td>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                                    {item.partType === 'Extrusion' && item.cutLengths.length > 0 ? (
                                      <div className="max-w-xs">
                                        <div className="text-xs text-gray-500 mb-1">
                                          {item.cutLengths.length} cut{item.cutLengths.length !== 1 ? 's' : ''}
                                          {item.stockLength && ` from ${item.stockLength}" stock`}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {item.cutLengths.slice(0, 6).map((len: number, i: number) => (
                                            <span key={i} className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                                              {len.toFixed(2)}"
                                            </span>
                                          ))}
                                          {item.cutLengths.length > 6 && (
                                            <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                              +{item.cutLengths.length - 6} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : item.partType === 'Glass' && item.glassDimensions.length > 0 ? (
                                      <div className="max-w-xs">
                                        <div className="flex flex-wrap gap-1">
                                          {item.glassDimensions.slice(0, 4).map((dim: any, i: number) => (
                                            <span key={i} className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                                              {dim.width?.toFixed(1)}" × {dim.height?.toFixed(1)}"
                                            </span>
                                          ))}
                                          {item.glassDimensions.length > 4 && (
                                            <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                              +{item.glassDimensions.length - 4} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Parts Found</h3>
                        <p className="text-gray-600">Add components to your openings to generate a purchasing summary.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>Failed to load purchasing summary</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Drawing Viewer Modal */}
      {selectedDrawingOpeningId && (
        <DrawingViewer
          openingId={selectedDrawingOpeningId}
          openingNumber={selectedDrawingOpeningNumber}
          isOpen={showDrawingViewer}
          onClose={() => {
            setShowDrawingViewer(false)
            setSelectedDrawingOpeningId(null)
            setSelectedDrawingOpeningNumber('')
          }}
        />
      )}

      {/* Delete Opening Confirmation Modal */}
      {/* Edit Opening Modal */}
      {showEditOpeningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Edit Opening</h3>
              <button
                onClick={() => {
                  setShowEditOpeningModal(false)
                  setEditingOpeningId(null)
                  setEditingOpeningName('')
                  setEditingOpeningFinishColor('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opening Name *
                </label>
                <input
                  type="text"
                  value={editingOpeningName}
                  onChange={(e) => setEditingOpeningName(e.target.value)}
                  placeholder="Enter opening name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Finish Color
                </label>
                <select
                  value={editingOpeningFinishColor}
                  onChange={(e) => setEditingOpeningFinishColor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None</option>
                  {finishTypes.map((finish) => (
                    <option key={finish.id} value={finish.finishType}>
                      {finish.finishType}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowEditOpeningModal(false)
                  setEditingOpeningId(null)
                  setEditingOpeningName('')
                  setEditingOpeningFinishColor('')
                }}
                disabled={isUpdatingOpening}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateOpening}
                disabled={isUpdatingOpening || !editingOpeningName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isUpdatingOpening && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isUpdatingOpening ? 'Updating...' : 'Update Opening'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Accepted Edit Confirmation Modal */}
      {showQuoteAcceptedConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Edit Accepted Quote
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              This project has a quote that has been <strong>accepted by the customer</strong>.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-amber-700">
                You are about to {pendingActionDescription}. Making changes may affect the accepted quote. Are you sure you want to proceed?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelQuoteAcceptedEdit}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmQuoteAcceptedEdit}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Delete Opening
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "<strong>{deletingOpeningName}</strong>"? This will also delete all components in this opening.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingOpeningId(null)
                  setDeletingOpeningName('')
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isDeleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isDeleting ? 'Deleting...' : 'Delete Opening'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Component Confirmation Modal */}
      {showDeleteComponentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Delete Component
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "<strong>{deletingComponentName}</strong>"?
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteComponentModal(false)
                  setDeletingComponentId(null)
                  setDeletingComponentName('')
                }}
                disabled={isDeletingComponent}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteComponent}
                disabled={isDeletingComponent}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isDeletingComponent && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isDeletingComponent ? 'Deleting...' : 'Delete Component'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOM Download Dialog */}
      {showBOMDownloadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Select BOMs to Download
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select the unique component BOMs you want to include in the ZIP download.
            </p>

            {loadingUniqueBoms ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : uniqueBomList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No components found in this project.
              </div>
            ) : (
              <>
                {/* Select All / Deselect All */}
                <div className="flex items-center space-x-3 mb-4">
                  <button
                    onClick={() => setSelectedBomHashes(new Set(uniqueBomList.map(c => c.hash)))}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setSelectedBomHashes(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Deselect All
                  </button>
                </div>

                {/* Checkbox List */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {uniqueBomList.map((component) => (
                    <label
                      key={component.hash}
                      className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBomHashes.has(component.hash)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedBomHashes)
                          if (e.target.checked) {
                            newSelected.add(component.hash)
                          } else {
                            newSelected.delete(component.hash)
                          }
                          setSelectedBomHashes(newSelected)
                        }}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-900">
                          {component.productName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {component.width}" × {component.height}" &bull; {component.finishColor} &bull; {component.glassType || 'None'} &bull; <span className="font-medium">×{component.quantity}</span>
                        </div>
                        {component.hardware && component.hardware.length > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            Hardware: {component.hardware.join(', ')}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {/* Selection Count */}
                <div className="mt-3 text-sm text-gray-600">
                  Selected: {selectedBomHashes.size} of {uniqueBomList.length}
                </div>
              </>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowBOMDownloadDialog(false)
                  setUniqueBomList([])
                  setSelectedBomHashes(new Set())
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadSelectedBOMs}
                disabled={selectedBomHashes.size === 0 || loadingUniqueBoms}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download ZIP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && project && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Delete {selectedOpeningIds.size} Opening{selectedOpeningIds.size !== 1 ? 's' : ''}
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete these openings? This will also delete all components in each opening.
            </p>

            <div className="max-h-40 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
              {project.openings
                .filter(o => selectedOpeningIds.has(o.id))
                .map(opening => (
                  <div key={opening.id} className="px-3 py-2 border-b border-gray-100 last:border-b-0">
                    <span className="text-sm font-medium text-gray-900">{opening.name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({opening.panels.filter(p => p.componentInstance).length} components)
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowBulkDeleteModal(false)
                  setSelectedOpeningIds(new Set())
                }}
                disabled={isBulkDeleting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isBulkDeleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedOpeningIds.size} Opening${selectedOpeningIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Opening Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Duplicate Opening
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                This will create {getSafeDuplicateCount() > 1 ? 'copies' : 'a copy'} of "{duplicatingOpeningName}" with all components and settings.
              </p>

              {/* Count Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Additional Openings <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={duplicateCount}
                  onChange={(e) => setDuplicateCount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter number of additional openings"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum 50 additional openings at once
                </p>
              </div>

              {/* Auto-Increment Toggle */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoIncrement}
                    onChange={(e) => setAutoIncrement(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Auto-Increment Names</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  {autoIncrement
                    ? 'Original opening will be renamed, and duplicates will be numbered sequentially'
                    : 'Duplicates will be created with "(Copy)" appended to the name'}
                </p>
              </div>

              {/* Base Name Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {autoIncrement ? 'Base Name' : 'New Opening Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={duplicateNewName}
                  onChange={(e) => setDuplicateNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder={autoIncrement ? "Enter base name for numbered openings" : "Enter name for duplicated opening"}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isDuplicating && duplicateNewName.trim() && getSafeDuplicateCount() >= 1 && getNameConflicts().length === 0) {
                      handleDuplicateOpening()
                    }
                  }}
                />
              </div>

              {/* Name Conflict Warning */}
              {(() => {
                const conflicts = getNameConflicts()
                return conflicts.length > 0 ? (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm font-medium text-red-800 mb-2">⚠️ Name Conflict</p>
                    <p className="text-xs text-red-700 mb-2">
                      The following opening name(s) already exist:
                    </p>
                    <div className="text-xs text-red-700">
                      {conflicts.map((name, i) => (
                        <p key={i} className="mb-1">• {name}</p>
                      ))}
                    </div>
                    <p className="text-xs text-red-700 mt-2">
                      Please choose a different name to continue.
                    </p>
                  </div>
                ) : null
              })()}

              {/* Preview */}
              {duplicateNewName.trim() && getNameConflicts().length === 0 && (() => {
                const safeCount = getSafeDuplicateCount()
                return safeCount > 0 ? (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                    {autoIncrement ? (
                      <div className="text-xs text-gray-600">
                        <p className="mb-1">• {smartIncrementName(duplicateNewName, 0)} (original renamed)</p>
                        {[...Array(Math.min(3, safeCount))].map((_, i) => (
                          <p key={i} className="mb-1">• {smartIncrementName(duplicateNewName, i + 1)}</p>
                        ))}
                        {safeCount > 3 && (
                          <p className="mb-1">• ...</p>
                        )}
                        {safeCount > 3 && (
                          <p className="mb-1">• {smartIncrementName(duplicateNewName, safeCount)} (last)</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600">
                        {safeCount === 1 ? (
                          <p>• {duplicateNewName.trim()}</p>
                        ) : (
                          <>
                            {[...Array(Math.min(3, safeCount))].map((_, i) => (
                              <p key={i} className="mb-1">• {smartIncrementName(duplicateNewName, i + 1)}</p>
                            ))}
                            {safeCount > 3 && (
                              <p className="mb-1">• ...</p>
                            )}
                            {safeCount > 3 && (
                              <p className="mb-1">• {smartIncrementName(duplicateNewName, safeCount)} (last)</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : null
              })()}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDuplicateModal(false)
                  setDuplicatingOpeningId(null)
                  setDuplicatingOpeningName('')
                  setDuplicateNewName('')
                  setDuplicateCount('1')
                  setAutoIncrement(false)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isDuplicating}
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicateOpening}
                disabled={isDuplicating || !duplicateNewName.trim() || getSafeDuplicateCount() < 1 || getNameConflicts().length > 0}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isDuplicating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Duplicating...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Archive Project?</h2>
            <p className="text-gray-700 mb-6">
              This project will be hidden from the main projects list but will remain accessible in the customer view and can be restored later.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowArchiveModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmArchiveProject}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Archive Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}