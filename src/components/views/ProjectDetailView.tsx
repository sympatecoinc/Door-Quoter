'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

// Direction options are now loaded dynamically from product plan views
import { ArrowLeft, Edit, Plus, Eye, Trash2, Settings, FileText, Download, Copy, Archive, X, ChevronDown, Receipt } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'
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
  isFinishedOpening?: boolean
  openingType?: 'THINWALL' | 'FRAMED'
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
  parentPanelId?: number | null  // If set, this is a paired panel (hidden in UI)
  componentInstance?: {
    id: number
    product: {
      id: number
      name: string
      type: string
      productType: string
      minWidth?: number | null
      maxWidth?: number | null
      minHeight?: number | null
      maxHeight?: number | null
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
  const { selectedProjectId, setSelectedProjectId, selectedCustomerId, customerDetailView, setCurrentMenu, autoOpenAddOpening, setAutoOpenAddOpening, cameFromSalesDashboard, setCameFromSalesDashboard } = useAppStore()
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
  const [editingOpeningRoughWidth, setEditingOpeningRoughWidth] = useState('')
  const [editingOpeningRoughHeight, setEditingOpeningRoughHeight] = useState('')
  const [editingOpeningIsFinished, setEditingOpeningIsFinished] = useState(false)
  const [editingOpeningType, setEditingOpeningType] = useState<'THINWALL' | 'FRAMED'>('THINWALL')
  const [showSizeRedistributionModal, setShowSizeRedistributionModal] = useState(false)
  const [sizeRedistributionData, setSizeRedistributionData] = useState<{
    openingId: number
    widthDiff: number
    heightDiff: number
    newWidth: number
    newHeight: number
    panels: { id: number; name: string; width: number; height: number }[]
  } | null>(null)
  const [redistributionMethod, setRedistributionMethod] = useState<'equal' | 'single'>('equal')
  const [selectedPanelForResize, setSelectedPanelForResize] = useState<number | null>(null)
  const [isUpdatingOpening, setIsUpdatingOpening] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddOpening, setShowAddOpening] = useState(false)
  const [addingOpening, setAddingOpening] = useState(false)
  const [newOpening, setNewOpening] = useState({
    name: '',
    finishColor: '',
    // Finished Opening fields
    isFinishedOpening: false,
    openingType: 'THINWALL' as 'THINWALL' | 'FRAMED',
    roughWidth: '',
    roughHeight: '',
    widthToleranceTotal: null as number | null,
    heightToleranceTotal: null as number | null
  })
  const [toleranceDefaults, setToleranceDefaults] = useState({
    thinwallWidthTolerance: 1.0,
    thinwallHeightTolerance: 1.5,
    framedWidthTolerance: 0.5,
    framedHeightTolerance: 0.75
  })
  const [finishTypes, setFinishTypes] = useState<any[]>([])
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [selectedOpeningId, setSelectedOpeningId] = useState<number | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [componentWidth, setComponentWidth] = useState<string>('')
  const [componentHeight, setComponentHeight] = useState<string>('')
  const [widthDivisor, setWidthDivisor] = useState<string>('1')
  // Divide remaining space state
  const [showDivideSpace, setShowDivideSpace] = useState(false)
  const [divideComponentCount, setDivideComponentCount] = useState(2)
  const [divideProducts, setDivideProducts] = useState<(number | null)[]>([null, null])
  const [swingDirection, setSwingDirection] = useState<string>('Right In')
  const [slidingDirection, setSlidingDirection] = useState<string>('Left')
  const [cornerDirection, setCornerDirection] = useState<string>('Up')
  const [glassType, setGlassType] = useState<string>('')
  const [componentQuantity, setComponentQuantity] = useState<string>('1')
  const [componentValidationErrors, setComponentValidationErrors] = useState<string[]>([])
  // Hardware options for add component modal
  const [addComponentOptions, setAddComponentOptions] = useState<any[]>([])
  const [addComponentSelectedOptions, setAddComponentSelectedOptions] = useState<Record<number, number | null>>({})
  const [addComponentOptionQuantities, setAddComponentOptionQuantities] = useState<Record<string, number>>({})
  const [hardwareOptionsExpanded, setHardwareOptionsExpanded] = useState(false)
  const [showComponentEdit, setShowComponentEdit] = useState(false)
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null)
  const [componentOptions, setComponentOptions] = useState<any[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number | null>>({})
  const [editComponentOptionQuantities, setEditComponentOptionQuantities] = useState<Record<string, number>>({})
  const [editComponentProductBOMs, setEditComponentProductBOMs] = useState<any[]>([])
  const [includedOptions, setIncludedOptions] = useState<number[]>([]) // Hardware options marked as included (no charge)
  const [editingComponentWidth, setEditingComponentWidth] = useState<string>('')
  const [editingComponentHeight, setEditingComponentHeight] = useState<string>('')
  const [editWidthDivisor, setEditWidthDivisor] = useState<string>('1')
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
  const [creatingSalesOrder, setCreatingSalesOrder] = useState(false)
  const [existingSalesOrderNumber, setExistingSalesOrderNumber] = useState<string | null>(null)

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
    // If we came from sales dashboard, go back to dashboard
    if (cameFromSalesDashboard) {
      setCameFromSalesDashboard(false)
      setCurrentMenu('dashboard')
    }
    // If we came from customer detail view, go back to dashboard (which shows customer detail)
    else if (selectedCustomerId && customerDetailView) {
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

  // Cmd+N to add new opening
  const anyModalOpen = showAddOpening || showAddComponent || showEditModal || showBOM || showDrawingViewer ||
    showEditOpeningModal || showDuplicateModal || showArchiveModal || showSyncConfirmation ||
    showBulkDeleteModal || showDeleteComponentModal || showDeleteModal || showQuoteAcceptedConfirm || showComponentEdit
  useNewShortcut(() => setShowAddOpening(true), { disabled: anyModalOpen })

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
                // Check if master part itself was updated (e.g., hardware cost changed)
                if (masterPartInfo.masterPartUpdatedAt) {
                  const masterPartUpdateTime = new Date(masterPartInfo.masterPartUpdatedAt).getTime()
                  if (masterPartUpdateTime > priceCalcTime) {
                    openingNeedsSync = true
                    changedMasterParts.add(`${masterPartInfo.baseName} (${partNumber})`)
                    if (!affectedOpenings.has(opening.name)) {
                      affectedOpenings.set(opening.name, new Set())
                    }
                    affectedOpenings.get(opening.name)!.add(`pricing updated for ${masterPartInfo.baseName}`)
                  }
                }

                // Check if pricing rules were updated (for extrusions)
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

          // Check 3: Sub-option (IndividualOption) pricing changes
          if (product.productSubOptions) {
            for (const productSubOption of product.productSubOptions) {
              const category = (productSubOption as any).category
              if (category?.individualOptions) {
                for (const option of category.individualOptions) {
                  if (option.updatedAt) {
                    const optionUpdateTime = new Date(option.updatedAt).getTime()
                    if (optionUpdateTime > priceCalcTime) {
                      openingNeedsSync = true
                      changedMasterParts.add(`${option.name} (${category.name})`)
                      if (!affectedOpenings.has(opening.name)) {
                        affectedOpenings.set(opening.name, new Set())
                      }
                      affectedOpenings.get(opening.name)!.add(`option pricing updated for ${option.name}`)
                    }
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
    fetchToleranceDefaults()
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
        // Set default glass type to first available if current is empty or doesn't exist in database
        if (data.length > 0) {
          setGlassType((current) => {
            if (!current) return data[0].name
            const exists = data.some((gt: any) => gt.name === current)
            return exists ? current : data[0].name
          })
        }
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

  async function fetchToleranceDefaults() {
    try {
      const response = await fetch('/api/tolerance-settings')
      if (response.ok) {
        const data = await response.json()
        setToleranceDefaults({
          thinwallWidthTolerance: data.thinwallWidthTolerance ?? 1.0,
          thinwallHeightTolerance: data.thinwallHeightTolerance ?? 1.5,
          framedWidthTolerance: data.framedWidthTolerance ?? 0.5,
          framedHeightTolerance: data.framedHeightTolerance ?? 0.75
        })
      }
    } catch (error) {
      console.error('Error fetching tolerance defaults:', error)
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

  async function handleCreateSalesOrder() {
    if (!selectedProjectId || !project) return

    setCreatingSalesOrder(true)
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/create-sales-order`, {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess(`Sales Order ${data.salesOrder.orderNumber} created!`)
        setExistingSalesOrderNumber(data.salesOrder.orderNumber)
      } else if (response.status === 400 && data.existingOrderNumber) {
        setExistingSalesOrderNumber(data.existingOrderNumber)
        showError(`A sales order already exists: ${data.existingOrderNumber}`)
      } else {
        showError(data.error || 'Failed to create sales order')
      }
    } catch (error) {
      console.error('Error creating sales order:', error)
      showError('Error creating sales order')
    } finally {
      setCreatingSalesOrder(false)
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

    // For finished openings, validate dimensions are provided
    if (newOpening.isFinishedOpening && (!newOpening.roughWidth || !newOpening.roughHeight)) {
      showError('Rough opening dimensions are required for finished openings')
      return
    }

    setAddingOpening(true)
    try {
      // Build request body - always include openingType for product filtering and Frame auto-add
      const requestBody: any = {
        projectId: selectedProjectId,
        name: newOpening.name,
        finishColor: newOpening.finishColor,
        isFinishedOpening: newOpening.isFinishedOpening,
        openingType: newOpening.openingType // Always send for Frame auto-add and product filtering
      }

      // Add dimension fields if specified
      if (newOpening.isFinishedOpening) {
        requestBody.roughWidth = parseFloat(newOpening.roughWidth)
        requestBody.roughHeight = parseFloat(newOpening.roughHeight)
        // Only include tolerance overrides if they differ from defaults
        if (newOpening.widthToleranceTotal !== null) {
          requestBody.widthToleranceTotal = newOpening.widthToleranceTotal
        }
        if (newOpening.heightToleranceTotal !== null) {
          requestBody.heightToleranceTotal = newOpening.heightToleranceTotal
        }
      }

      const response = await fetch('/api/openings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        // Reset form and close modal first
        setNewOpening({
          name: '',
          finishColor: finishTypes.length > 0 ? finishTypes[0].finishType : '',
          isFinishedOpening: false,
          openingType: 'THINWALL',
          roughWidth: '',
          roughHeight: '',
          widthToleranceTotal: null,
          heightToleranceTotal: null
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
      setEditingOpeningRoughWidth(opening.roughWidth?.toString() || '')
      setEditingOpeningRoughHeight(opening.roughHeight?.toString() || '')
      setEditingOpeningIsFinished(opening.isFinishedOpening || false)
      setEditingOpeningType(opening.openingType || 'THINWALL')
      setShowEditOpeningModal(true)
    }

    if (!requireQuoteAcceptedConfirmation(proceedWithEdit, 'edit an opening')) {
      proceedWithEdit()
    }
  }

  async function handleUpdateOpening() {
    if (!editingOpeningId || !editingOpeningName.trim()) return

    // Check if this is a finished opening with size changes and existing panels
    const opening = project?.openings.find(o => o.id === editingOpeningId)
    if (opening?.isFinishedOpening && editingOpeningRoughWidth && editingOpeningRoughHeight) {
      const currentRoughWidth = opening.roughWidth || 0
      const currentRoughHeight = opening.roughHeight || 0
      const newRoughWidth = parseFloat(editingOpeningRoughWidth)
      const newRoughHeight = parseFloat(editingOpeningRoughHeight)

      // Get non-FRAME, non-CORNER panels
      const resizablePanels = opening.panels?.filter(p => {
        const productType = p.componentInstance?.product?.productType
        return productType !== 'FRAME' && productType !== 'CORNER_90'
      }) || []

      // Check if there are size changes and panels to redistribute
      const widthChanged = Math.abs(newRoughWidth - currentRoughWidth) > 0.001
      const heightChanged = Math.abs(newRoughHeight - currentRoughHeight) > 0.001

      if ((widthChanged || heightChanged) && resizablePanels.length > 0) {
        // Calculate new finished dimensions using tolerance
        let widthTolerance = 0
        let heightTolerance = 0
        if (editingOpeningType === 'FRAMED') {
          widthTolerance = toleranceDefaults.framedWidthTolerance
          heightTolerance = toleranceDefaults.framedHeightTolerance
        } else {
          widthTolerance = toleranceDefaults.thinwallWidthTolerance
          heightTolerance = toleranceDefaults.thinwallHeightTolerance
        }
        const newFinishedWidth = newRoughWidth - widthTolerance
        const newFinishedHeight = newRoughHeight - heightTolerance
        const currentFinishedWidth = opening.finishedWidth || 0
        const currentFinishedHeight = opening.finishedHeight || 0

        // Show redistribution modal
        setSizeRedistributionData({
          openingId: editingOpeningId,
          widthDiff: newFinishedWidth - currentFinishedWidth,
          heightDiff: newFinishedHeight - currentFinishedHeight,
          newWidth: newFinishedWidth,
          newHeight: newFinishedHeight,
          panels: resizablePanels.map((p, idx) => ({
            id: p.id,
            name: p.componentInstance?.product?.name || `Panel ${idx + 1}`,
            width: p.width,
            height: p.height
          }))
        })
        setRedistributionMethod('equal')
        setSelectedPanelForResize(resizablePanels[0]?.id || null)
        setShowSizeRedistributionModal(true)
        return
      }
    }

    // No redistribution needed, just update the opening
    await performOpeningUpdate()
  }

  async function performOpeningUpdate() {
    if (!editingOpeningId) return

    setIsUpdatingOpening(true)
    try {
      const response = await fetch(`/api/openings/${editingOpeningId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingOpeningName,
          finishColor: editingOpeningFinishColor || null,
          roughWidth: editingOpeningRoughWidth || null,
          roughHeight: editingOpeningRoughHeight || null
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
        setEditingOpeningRoughWidth('')
        setEditingOpeningRoughHeight('')
        setEditingOpeningIsFinished(false)
        setEditingOpeningType('THINWALL')
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

  async function handleApplyRedistribution() {
    if (!sizeRedistributionData) return

    setIsUpdatingOpening(true)
    try {
      const { panels, widthDiff, heightDiff, newHeight } = sizeRedistributionData

      // Calculate new panel dimensions
      const panelUpdates: { id: number; width: number; height: number }[] = []

      if (redistributionMethod === 'equal') {
        // Split width difference equally among all panels
        const widthPerPanel = widthDiff / panels.length
        for (const panel of panels) {
          panelUpdates.push({
            id: panel.id,
            width: panel.width + widthPerPanel,
            height: newHeight // All panels get the new height
          })
        }
      } else {
        // Apply width difference to single selected panel
        for (const panel of panels) {
          if (panel.id === selectedPanelForResize) {
            panelUpdates.push({
              id: panel.id,
              width: panel.width + widthDiff,
              height: newHeight
            })
          } else {
            panelUpdates.push({
              id: panel.id,
              width: panel.width,
              height: newHeight // Still update height for all
            })
          }
        }
      }

      // First update the opening
      await performOpeningUpdate()

      // Then update all panels
      for (const update of panelUpdates) {
        await fetch(`/api/panels/${update.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            width: update.width,
            height: update.height,
            skipValidation: true // Skip validation since we're doing the resize intentionally
          })
        })
      }

      // Refresh and recalculate
      const updatedProject = await refreshProject()
      if (updatedProject) {
        await calculateAllOpeningPrices(updatedProject)
      }

      // Close modals and reset state
      setShowSizeRedistributionModal(false)
      setSizeRedistributionData(null)
      setRedistributionMethod('equal')
      setSelectedPanelForResize(null)
    } catch (error) {
      console.error('Error applying redistribution:', error)
      showError('Error resizing components')
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
      // Reset all component modal state first
      setSelectedProductId(null)
      setComponentWidth('')
      setComponentQuantity('1')
      setWidthDivisor('1')
      setShowDivideSpace(false)
      setDivideProducts([null, null])
      setComponentValidationErrors([])
      setSwingDirection('Right In')
      setSlidingDirection('Left')
      setCornerDirection('Left')
      setGlassType(glassTypes[0]?.name || '')
      setHardwareOptionsExpanded(false)
      setAddComponentOptions([])
      setAddComponentSelectedOptions({})
      setAddComponentOptionQuantities({})

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
        // First panel in opening (or only Frame panels)
        // If finished opening with set height, auto-populate with finished height
        if (opening?.isFinishedOpening && opening.finishedHeight) {
          setComponentHeight(opening.finishedHeight.toString())
        } else {
          setComponentHeight('')
        }
      }

      // Fetch products filtered by opening type
      try {
        const openingType = opening?.openingType || 'THINWALL'
        const response = await fetch(`/api/products?openingType=${openingType}`)
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

  // Validate component dimensions for Finished Openings
  function validateComponentDimensions(): boolean {
    const opening = project?.openings.find(o => o.id === selectedOpeningId)
    const selectedProduct = products.find(p => p.id === selectedProductId)

    // Skip validation if not a finished opening
    if (!opening?.isFinishedOpening || !opening.finishedWidth || !opening.finishedHeight) {
      setComponentValidationErrors([])
      return true
    }

    // Skip for CORNER_90 and FRAME products
    if (selectedProduct?.productType === 'CORNER_90' || selectedProduct?.productType === 'FRAME') {
      setComponentValidationErrors([])
      return true
    }

    const width = parseFloat(componentWidth) || 0
    const height = parseFloat(componentHeight) || 0
    const quantity = parseInt(componentQuantity) || 1

    const errors: string[] = []

    // Height validation
    if (height > opening.finishedHeight) {
      errors.push(`Height (${height}") exceeds opening finished height (${opening.finishedHeight}")`)
    }

    // Width validation - sum of all panels
    const existingPanels = opening.panels.filter(p =>
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const existingWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    const totalWidth = existingWidth + (width * quantity)

    if (totalWidth > opening.finishedWidth) {
      const available = opening.finishedWidth - existingWidth
      errors.push(`Total width (${totalWidth.toFixed(3)}") exceeds opening (${opening.finishedWidth}"). Available: ${available.toFixed(3)}"`)
    }

    // Product min/max constraints
    if (selectedProduct?.minWidth && width < selectedProduct.minWidth) {
      errors.push(`Width below product minimum (${selectedProduct.minWidth}")`)
    }
    if (selectedProduct?.maxWidth && width > selectedProduct.maxWidth) {
      errors.push(`Width exceeds product maximum (${selectedProduct.maxWidth}")`)
    }
    if (selectedProduct?.minHeight && height < selectedProduct.minHeight) {
      errors.push(`Height below product minimum (${selectedProduct.minHeight}")`)
    }
    if (selectedProduct?.maxHeight && height > selectedProduct.maxHeight) {
      errors.push(`Height exceeds product maximum (${selectedProduct.maxHeight}")`)
    }

    setComponentValidationErrors(errors)
    return errors.length === 0
  }

  // Auto-size component to remaining available space
  function handleAutoSize() {
    const opening = project?.openings.find(o => o.id === selectedOpeningId)
    const selectedProduct = products.find(p => p.id === selectedProductId)

    if (!opening?.isFinishedOpening || !opening.finishedWidth || !opening.finishedHeight) {
      showError('Auto-size only works for Finished Openings')
      return
    }

    // Calculate existing panel widths (exclude corners and frames)
    const existingPanels = opening.panels.filter(p =>
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const usedWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    let availableWidth = opening.finishedWidth - usedWidth
    let finalHeight = opening.finishedHeight

    if (availableWidth <= 0) {
      showError(`No space available - existing components use ${usedWidth.toFixed(3)}" of ${opening.finishedWidth}" opening width`)
      return
    }

    // Apply product constraints
    if (selectedProduct?.minWidth && availableWidth < selectedProduct.minWidth) {
      showError(`Available space (${availableWidth.toFixed(3)}") is less than product minimum (${selectedProduct.minWidth}")`)
      return
    }

    if (selectedProduct?.maxWidth && availableWidth > selectedProduct.maxWidth) {
      availableWidth = selectedProduct.maxWidth
    }

    if (selectedProduct?.minHeight && finalHeight < selectedProduct.minHeight) {
      showError(`Opening height (${finalHeight}") is less than product minimum (${selectedProduct.minHeight}")`)
      return
    }

    if (selectedProduct?.maxHeight && finalHeight > selectedProduct.maxHeight) {
      finalHeight = selectedProduct.maxHeight
    }

    setComponentWidth(availableWidth.toFixed(3))
    setComponentHeight(finalHeight.toFixed(3))
    setComponentValidationErrors([])
    showSuccess('Dimensions auto-filled based on remaining space')
  }

  // Calculate auto width without setting state (helper function)
  function calculateAutoWidth(divisorOverride?: number): { width: number | null, error?: string } {
    const opening = project?.openings.find(o => o.id === selectedOpeningId)
    const selectedProduct = products.find(p => p.id === selectedProductId)
    const divisor = Math.max(1, divisorOverride ?? (parseInt(widthDivisor) || 1))

    if (!opening?.isFinishedOpening || !opening.finishedWidth) {
      return { width: null, error: 'Auto width only works for Finished Openings' }
    }

    // Calculate existing panel widths (exclude corners and frames)
    const existingPanels = opening.panels.filter(p =>
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const usedWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    const totalAvailableWidth = opening.finishedWidth - usedWidth

    if (totalAvailableWidth <= 0) {
      return { width: null, error: `No space available - existing components use ${usedWidth.toFixed(3)}" of ${opening.finishedWidth}" opening width` }
    }

    // Divide available width by divisor
    let widthPerComponent = totalAvailableWidth / divisor

    // Apply product constraints to the divided width
    if (selectedProduct?.minWidth && widthPerComponent < selectedProduct.minWidth) {
      return { width: null, error: `Divided width (${widthPerComponent.toFixed(3)}") is less than product minimum (${selectedProduct.minWidth}")` }
    }

    if (selectedProduct?.maxWidth && widthPerComponent > selectedProduct.maxWidth) {
      widthPerComponent = selectedProduct.maxWidth
    }

    return { width: widthPerComponent }
  }

  // Auto-fill width only to remaining available space (with optional divisor for splitting between components)
  function handleAutoWidth() {
    const divisor = Math.max(1, parseInt(widthDivisor) || 1)
    const result = calculateAutoWidth(divisor)

    if (result.error) {
      showError(result.error)
      return
    }

    if (result.width !== null) {
      setComponentWidth(result.width.toFixed(3))
      if (divisor > 1) {
        showSuccess(`Width auto-filled: ${result.width.toFixed(3)}" (divided by ${divisor})`)
      } else {
        showSuccess(`Width auto-filled: ${result.width.toFixed(3)}"`)
      }
    }
  }

  // Handle divisor change - auto-calculate width and sync quantity
  function handleDivisorChange(newDivisor: string) {
    const divisorValue = Math.max(1, parseInt(newDivisor) || 1)
    setWidthDivisor(newDivisor)

    // Sync quantity with divisor
    setComponentQuantity(divisorValue.toString())

    // Auto-calculate width based on new divisor
    const result = calculateAutoWidth(divisorValue)
    if (result.width !== null) {
      setComponentWidth(result.width.toFixed(3))
    }
  }

  // Auto-fill height only to opening height
  function handleAutoHeight() {
    const opening = project?.openings.find(o => o.id === selectedOpeningId)
    const selectedProduct = products.find(p => p.id === selectedProductId)

    if (!opening?.isFinishedOpening || !opening.finishedHeight) {
      showError('Auto height only works for Finished Openings')
      return
    }

    let finalHeight = opening.finishedHeight

    // Apply product constraints
    if (selectedProduct?.minHeight && finalHeight < selectedProduct.minHeight) {
      showError(`Opening height (${finalHeight}") is less than product minimum (${selectedProduct.minHeight}")`)
      return
    }

    if (selectedProduct?.maxHeight && finalHeight > selectedProduct.maxHeight) {
      finalHeight = selectedProduct.maxHeight
    }

    setComponentHeight(finalHeight.toFixed(3))
    showSuccess(`Height auto-filled: ${finalHeight.toFixed(3)}"`)
  }

  // Validate edit component dimensions for Finished Openings
  function validateEditComponentDimensions(): boolean {
    // Find the opening for the current panel
    const currentOpening = project?.openings.find(o => o.panels.some(p => p.id === currentPanelId))
    const currentPanel = currentOpening?.panels.find(p => p.id === currentPanelId)
    const selectedProduct = currentPanel?.componentInstance?.product

    // Skip validation if not a finished opening
    if (!currentOpening?.isFinishedOpening || !currentOpening.finishedWidth || !currentOpening.finishedHeight) {
      setComponentValidationErrors([])
      return true
    }

    // Skip for CORNER_90 and FRAME products
    if (selectedProduct?.productType === 'CORNER_90' || selectedProduct?.productType === 'FRAME') {
      setComponentValidationErrors([])
      return true
    }

    const width = parseFloat(editingComponentWidth) || 0
    const height = parseFloat(editingComponentHeight) || 0

    const errors: string[] = []

    // Height validation
    if (height > currentOpening.finishedHeight) {
      errors.push(`Height (${height}") exceeds opening finished height (${currentOpening.finishedHeight}")`)
    }

    // Width validation - exclude current panel from sum
    const otherPanels = currentOpening.panels.filter(p =>
      p.id !== currentPanelId &&
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const otherWidth = otherPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    const totalWidth = otherWidth + width

    if (totalWidth > currentOpening.finishedWidth) {
      const available = currentOpening.finishedWidth - otherWidth
      errors.push(`Total width (${totalWidth.toFixed(3)}") exceeds opening (${currentOpening.finishedWidth}"). Available: ${available.toFixed(3)}"`)
    }

    // Product min/max constraints
    if (selectedProduct?.minWidth && width < selectedProduct.minWidth) {
      errors.push(`Width below product minimum (${selectedProduct.minWidth}")`)
    }
    if (selectedProduct?.maxWidth && width > selectedProduct.maxWidth) {
      errors.push(`Width exceeds product maximum (${selectedProduct.maxWidth}")`)
    }
    if (selectedProduct?.minHeight && height < selectedProduct.minHeight) {
      errors.push(`Height below product minimum (${selectedProduct.minHeight}")`)
    }
    if (selectedProduct?.maxHeight && height > selectedProduct.maxHeight) {
      errors.push(`Height exceeds product maximum (${selectedProduct.maxHeight}")`)
    }

    setComponentValidationErrors(errors)
    return errors.length === 0
  }

  // Auto-size edit component to remaining available space
  function handleEditAutoSize() {
    const currentOpening = project?.openings.find(o => o.panels.some(p => p.id === currentPanelId))
    const currentPanel = currentOpening?.panels.find(p => p.id === currentPanelId)
    const selectedProduct = currentPanel?.componentInstance?.product

    if (!currentOpening?.isFinishedOpening || !currentOpening.finishedWidth || !currentOpening.finishedHeight) {
      showError('Auto-size only works for Finished Openings')
      return
    }

    // Calculate available width (excluding current panel)
    const otherPanels = currentOpening.panels.filter(p =>
      p.id !== currentPanelId &&
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const usedWidth = otherPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    let availableWidth = currentOpening.finishedWidth - usedWidth
    let finalHeight = currentOpening.finishedHeight

    if (availableWidth <= 0) {
      showError(`No space available - other components use ${usedWidth.toFixed(3)}" of ${currentOpening.finishedWidth}" opening width`)
      return
    }

    // Apply product constraints
    if (selectedProduct?.minWidth && availableWidth < selectedProduct.minWidth) {
      showError(`Available space (${availableWidth.toFixed(3)}") is less than product minimum (${selectedProduct.minWidth}")`)
      return
    }

    if (selectedProduct?.maxWidth && availableWidth > selectedProduct.maxWidth) {
      availableWidth = selectedProduct.maxWidth
    }

    if (selectedProduct?.minHeight && finalHeight < selectedProduct.minHeight) {
      showError(`Opening height (${finalHeight}") is less than product minimum (${selectedProduct.minHeight}")`)
      return
    }

    if (selectedProduct?.maxHeight && finalHeight > selectedProduct.maxHeight) {
      finalHeight = selectedProduct.maxHeight
    }

    setEditingComponentWidth(availableWidth.toFixed(3))
    setEditingComponentHeight(finalHeight.toFixed(3))
    setComponentValidationErrors([])
    showSuccess('Dimensions auto-filled based on remaining space')
  }

  // Auto-fill edit width only to remaining available space (with optional divisor for splitting between components)
  function handleEditAutoWidth() {
    const currentOpening = project?.openings.find(o => o.panels.some(p => p.id === currentPanelId))
    const currentPanel = currentOpening?.panels.find(p => p.id === currentPanelId)
    const selectedProduct = currentPanel?.componentInstance?.product
    const divisor = Math.max(1, parseInt(editWidthDivisor) || 1)

    if (!currentOpening?.isFinishedOpening || !currentOpening.finishedWidth) {
      showError('Auto width only works for Finished Openings')
      return
    }

    // Calculate available width (excluding current panel)
    const otherPanels = currentOpening.panels.filter(p =>
      p.id !== currentPanelId &&
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const usedWidth = otherPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    const totalAvailableWidth = currentOpening.finishedWidth - usedWidth

    if (totalAvailableWidth <= 0) {
      showError(`No space available - other components use ${usedWidth.toFixed(3)}" of ${currentOpening.finishedWidth}" opening width`)
      return
    }

    // Divide available width by divisor
    let widthPerComponent = totalAvailableWidth / divisor

    // Apply product constraints to the divided width
    if (selectedProduct?.minWidth && widthPerComponent < selectedProduct.minWidth) {
      showError(`Divided width (${widthPerComponent.toFixed(3)}") is less than product minimum (${selectedProduct.minWidth}")`)
      return
    }

    if (selectedProduct?.maxWidth && widthPerComponent > selectedProduct.maxWidth) {
      widthPerComponent = selectedProduct.maxWidth
    }

    setEditingComponentWidth(widthPerComponent.toFixed(3))
    if (divisor > 1) {
      showSuccess(`Width auto-filled: ${widthPerComponent.toFixed(3)}" (${totalAvailableWidth.toFixed(3)}" ÷ ${divisor})`)
    } else {
      showSuccess(`Width auto-filled: ${widthPerComponent.toFixed(3)}"`)
    }
  }

  // Auto-fill edit height only to opening height
  function handleEditAutoHeight() {
    const currentOpening = project?.openings.find(o => o.panels.some(p => p.id === currentPanelId))
    const currentPanel = currentOpening?.panels.find(p => p.id === currentPanelId)
    const selectedProduct = currentPanel?.componentInstance?.product

    if (!currentOpening?.isFinishedOpening || !currentOpening.finishedHeight) {
      showError('Auto height only works for Finished Openings')
      return
    }

    let finalHeight = currentOpening.finishedHeight

    // Apply product constraints
    if (selectedProduct?.minHeight && finalHeight < selectedProduct.minHeight) {
      showError(`Opening height (${finalHeight}") is less than product minimum (${selectedProduct.minHeight}")`)
      return
    }

    if (selectedProduct?.maxHeight && finalHeight > selectedProduct.maxHeight) {
      finalHeight = selectedProduct.maxHeight
    }

    setEditingComponentHeight(finalHeight.toFixed(3))
    showSuccess(`Height auto-filled: ${finalHeight.toFixed(3)}"`)
  }

  // Handle dividing remaining space between N products
  async function handleDivideRemainingSpace() {
    const selectedProducts = divideProducts.filter((p): p is number => p !== null)
    if (!selectedOpeningId || selectedProducts.length === 0) return

    const opening = project?.openings.find(o => o.id === selectedOpeningId)
    if (!opening?.isFinishedOpening || !opening.finishedWidth) {
      showError('Divide remaining space only works for finished openings')
      return
    }

    // Calculate remaining width
    const existingPanels = opening.panels.filter(p =>
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const usedWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    const remainingWidth = opening.finishedWidth - usedWidth

    if (remainingWidth <= 0) {
      showError('No remaining space to divide')
      return
    }

    const widthPerComponent = remainingWidth / selectedProducts.length

    // Get height from existing panels or opening
    const nonFramePanels = opening.panels.filter(p =>
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const height = nonFramePanels[0]?.height || opening.finishedHeight || 0

    if (height <= 0) {
      showError('Unable to determine component height')
      return
    }

    try {
      // Create panels with their component instances for each selected product
      for (const productId of selectedProducts) {
        const product = products.find(p => p.id === productId)

        // Determine panel type based on product type
        let panelType = 'Fixed Panel'
        if (product?.productType === 'SWING_DOOR') panelType = 'Swing Door'
        else if (product?.productType === 'SLIDING_DOOR') panelType = 'Sliding Door'
        else if (product?.productType === 'FIXED_PANEL') panelType = 'Fixed Panel'

        // Step 1: Create the panel
        const panelResponse = await fetch('/api/panels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            openingId: selectedOpeningId,
            type: panelType,
            width: widthPerComponent,
            height: height,
            glassType: glassTypes[0]?.name || 'N/A',
            locking: product?.productType === 'SWING_DOOR' ? 'Standard' : 'N/A',
            productId: productId,
            quantity: 1,
            swingDirection: product?.productType === 'SWING_DOOR' ? 'Right In' : undefined,
            slidingDirection: product?.productType === 'SLIDING_DOOR' ? 'Left' : undefined,
            skipValidation: true // We already calculated the exact remaining space
          })
        })

        if (!panelResponse.ok) {
          const error = await panelResponse.json()
          throw new Error(error.error || 'Failed to add component')
        }

        const panelsData = await panelResponse.json()

        // Step 2: Create component instance for each panel (links panel to product)
        for (const panelData of panelsData) {
          const componentResponse = await fetch('/api/component-instances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              panelId: panelData.id,
              productId: productId,
              subOptionSelections: {}
            })
          })

          if (!componentResponse.ok) {
            console.error('Error creating component instance for panel:', panelData.id)
          }
        }
      }

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

      // Refresh project data
      await fetchProject()

      // Reset state
      setShowDivideSpace(false)
      setDivideProducts([null, null])

      showSuccess('Both components added successfully!')
    } catch (error: any) {
      showError(error.message || 'Failed to add components')
    }
  }

  async function handleAddComponent() {
    if (!selectedOpeningId || !selectedProductId) return

    // Client-side validation first
    if (!validateComponentDimensions()) {
      showError('Please fix validation errors before adding component')
      return
    }

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
          quantity: parseInt(componentQuantity) || 1,
          productId: selectedProductId
        })
      })

      if (!panelResponse.ok) {
        const errorData = await panelResponse.json()
        // Handle validation errors from server
        if (errorData.validationErrors) {
          setComponentValidationErrors(errorData.validationErrors)
          showError('Component size validation failed')
          return
        }
        showError(errorData.error || 'Failed to add component')
        return
      }

      const panelsData = await panelResponse.json()  // Now an array

      // Create component instances for all panels
      // Merge option selections with quantity selections
      const mergedSelections = {
        ...addComponentSelectedOptions,
        ...addComponentOptionQuantities
      }

      for (const panelData of panelsData) {
        // Use paired product ID for paired panels, otherwise use selected product
        const productIdForInstance = panelData._isPairedPanel
          ? panelData._pairedProductId
          : selectedProductId

        // For paired panels (frames), don't pass sub-options - they get defaults
        const selectionsForInstance = panelData._isPairedPanel ? {} : mergedSelections

        const componentResponse = await fetch('/api/component-instances', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            panelId: panelData.id,
            productId: productIdForInstance,
            subOptionSelections: selectionsForInstance
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
      setWidthDivisor('1')
      setShowDivideSpace(false)
      setDivideProducts([null, null])
      setComponentValidationErrors([])
      setSwingDirection('Right In')
      setSlidingDirection('Left')
      setGlassType(glassTypes[0]?.name || '')
      setHardwareOptionsExpanded(false)
      setAddComponentOptions([])
      setAddComponentSelectedOptions({})
      setAddComponentOptionQuantities({})

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
          if (componentData.panel.swingDirection && componentData.panel.swingDirection !== 'None') {
            setEditingDirection(componentData.panel.swingDirection)
          } else if (componentData.panel.slidingDirection) {
            setEditingDirection(componentData.panel.slidingDirection)
          } else if (componentData.panel.cornerDirection) {
            setEditingDirection(componentData.panel.cornerDirection)
          } else {
            setEditingDirection('')
          }

          // Fetch available options for this product
          const productResponse = await fetch(`/api/products/${componentData.productId}`)
          if (productResponse.ok) {
            const productData = await productResponse.json()
            setComponentOptions(productData.productSubOptions || [])

            // Parse subOptionSelections and separate options from quantities
            const allSelections = JSON.parse(componentData.subOptionSelections || '{}')
            const options: Record<string, number | null> = {}
            const quantities: Record<string, number> = {}

            for (const [key, value] of Object.entries(allSelections)) {
              if (key.endsWith('_qty')) {
                // This is a quantity entry
                quantities[key] = value as number
              } else {
                // This is an option selection
                options[key] = value as number | null
              }
            }

            setSelectedOptions(options)
            setEditComponentOptionQuantities(quantities)
            setEditComponentProductBOMs(productData.productBOMs || [])
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
              <button
                onClick={handleShowBOM}
                className="ml-1 p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="View BOM"
              >
                <FileText className="w-4 h-4" />
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
          {/* Create Sales Order button - only for QUOTE_ACCEPTED or ACTIVE projects */}
          {(project.status === 'QUOTE_ACCEPTED' || project.status === 'ACTIVE') && !existingSalesOrderNumber && (
            <button
              onClick={handleCreateSalesOrder}
              disabled={creatingSalesOrder || project.openings.length === 0}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={project.openings.length === 0 ? 'Add openings first' : 'Create a sales order from this quote'}
            >
              {creatingSalesOrder ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Receipt className="w-5 h-5 mr-2" />
                  Create Sales Order
                </>
              )}
            </button>
          )}
          {/* Show existing sales order link if one exists */}
          {existingSalesOrderNumber && (
            <span className="flex items-center px-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm">
              <Receipt className="w-4 h-4 mr-2" />
              SO: {existingSalesOrderNumber}
            </span>
          )}
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
{`Framed Opening Size: ${opening.roughWidth}" W × ${opening.roughHeight}" H (${opening.openingType === 'THINWALL' ? 'Finished' : 'Rough'})`}
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
                    <h4 className="text-sm font-medium text-gray-700">Components ({opening.panels.filter(p => p.componentInstance && !p.parentPanelId).length})</h4>
                  </div>
                  {opening.panels.filter(p => p.componentInstance && !p.parentPanelId).length > 0 ? (
                    <DragDropContext onDragEnd={(result) => handleDragEnd(result, opening.id)}>
                      <Droppable droppableId={`opening-${opening.id}`}>
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-2"
                          >
                            {opening.panels
                              .filter(p => p.componentInstance && !p.parentPanelId)
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
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Opening</h2>
            {!newOpening.isFinishedOpening && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Opening sizes will be calculated from the components you add. BOMs can be generated per opening and per project.
                </p>
              </div>
            )}
            <div className="space-y-4">
              {/* 1. Opening Number */}
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

              {/* 2. Opening Type: Thinwall or Trimmed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Type</label>
                <select
                  value={newOpening.openingType}
                  onChange={(e) => {
                    const type = e.target.value as 'THINWALL' | 'FRAMED'
                    setNewOpening(prev => ({
                      ...prev,
                      openingType: type,
                      // Reset tolerance overrides to use new defaults
                      widthToleranceTotal: null,
                      heightToleranceTotal: null
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="THINWALL">Thinwall</option>
                  <option value="FRAMED">Trimmed</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {newOpening.openingType === 'FRAMED'
                    ? 'A Frame will be automatically added to this opening'
                    : 'Components will be filtered to show Thinwall products'}
                </p>
              </div>

              {/* 3. Extrusion Finish */}
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

              {/* 4. Specify Dimensions Toggle */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Specify Dimensions
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Enable to enter opening dimensions and apply tolerances
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewOpening(prev => ({
                      ...prev,
                      isFinishedOpening: !prev.isFinishedOpening
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      newOpening.isFinishedOpening ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        newOpening.isFinishedOpening ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 5. Dimension Fields (shown when Specify Dimensions is enabled) */}
              {newOpening.isFinishedOpening && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {/* Opening Dimensions */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {newOpening.openingType === 'THINWALL' ? 'Finished Width (in)' : 'Rough Width (in)'}
                      </label>
                      <input
                        type="number"
                        step="0.0625"
                        value={newOpening.roughWidth}
                        onChange={(e) => setNewOpening(prev => ({ ...prev, roughWidth: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {newOpening.openingType === 'THINWALL' ? 'Finished Height (in)' : 'Rough Height (in)'}
                      </label>
                      <input
                        type="number"
                        step="0.0625"
                        value={newOpening.roughHeight}
                        onChange={(e) => setNewOpening(prev => ({ ...prev, roughHeight: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="96"
                      />
                    </div>
                  </div>

                  {/* Tolerance Note */}
                  <p className="text-xs text-gray-500">
                    Tolerances are automatically applied based on opening type. Adjust defaults in Quote Settings.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 pt-6">
              <button
                onClick={() => {
                  if (!addingOpening) {
                    setShowAddOpening(false)
                    setNewOpening({
                      name: '',
                      finishColor: finishTypes.length > 0 ? finishTypes[0].finishType : '',
                      isFinishedOpening: false,
                      openingType: 'THINWALL',
                      roughWidth: '',
                      roughHeight: '',
                      widthToleranceTotal: null,
                      heightToleranceTotal: null
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
                disabled={addingOpening || !newOpening.name.trim() || (newOpening.isFinishedOpening && (!newOpening.roughWidth || !newOpening.roughHeight))}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex-shrink-0">Add Component</h2>
            <div className="overflow-y-auto flex-1 pr-2">
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

                    // Pre-fill width from product defaultWidth if available
                    if (product?.defaultWidth && product.productType !== 'CORNER_90' && product.productType !== 'FRAME') {
                      setComponentWidth(product.defaultWidth.toString())
                    }

                    // Set direction to first plan view name if available
                    if (product?.planViews?.length > 0) {
                      const firstPlanViewName = product.planViews[0].name
                      if (product.productType === 'SWING_DOOR') {
                        setSwingDirection(firstPlanViewName)
                      } else if (product.productType === 'SLIDING_DOOR') {
                        setSlidingDirection(firstPlanViewName)
                      } else if (product.productType === 'CORNER_90') {
                        setCornerDirection(firstPlanViewName)
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">Select a product...</option>
                  {products.filter(p => p.productType !== 'FRAME').map((product) => (
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

                const opening = project?.openings.find(o => o.id === selectedOpeningId)
                const showAutoButtons = opening?.isFinishedOpening && !isCornerProduct && !isFrameProduct
                const heightDisabled = (() => {
                  const nonFramePanels = opening?.panels?.filter(p =>
                    p.componentInstance?.product?.productType !== 'FRAME'
                  ) || []
                  return nonFramePanels.length > 0
                })()

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Width Input with inline Auto button */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                        <div className="flex">
                          <input
                            type="number"
                            value={componentWidth}
                            onChange={(e) => setComponentWidth(e.target.value)}
                            placeholder="Enter width"
                            step="0.01"
                            min="0"
                            className={`flex-1 min-w-0 px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                              showAutoButtons ? 'rounded-l-lg border-r-0' : 'rounded-lg'
                            } ${
                              componentWidth && parseFloat(componentWidth) <= 0
                                ? 'border-red-300 bg-red-50'
                                : 'border-gray-300'
                            }`}
                          />
                          {showAutoButtons && (
                            <button
                              type="button"
                              onClick={handleAutoWidth}
                              className="flex-shrink-0 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium border border-gray-300 rounded-r-lg"
                              title={`Auto-fill remaining width (${opening?.finishedWidth}" opening)`}
                            >
                              Auto
                            </button>
                          )}
                        </div>
                        {componentWidth && parseFloat(componentWidth) <= 0 && (
                          <p className="text-red-500 text-xs mt-1">Width must be greater than 0</p>
                        )}
                      </div>
                      {/* Height Input with inline Auto button */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                        <div className="flex">
                          <input
                            type="number"
                            value={componentHeight}
                            onChange={(e) => setComponentHeight(e.target.value)}
                            placeholder="Enter height"
                            step="0.01"
                            min="0"
                            disabled={heightDisabled}
                            className={`flex-1 min-w-0 px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                              showAutoButtons ? 'rounded-l-lg border-r-0' : 'rounded-lg'
                            } ${
                              heightDisabled
                                ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                                : componentHeight && parseFloat(componentHeight) <= 0
                                  ? 'border-red-300 bg-red-50'
                                  : 'border-gray-300'
                            }`}
                          />
                          {showAutoButtons && (
                            <button
                              type="button"
                              onClick={handleAutoHeight}
                              disabled={heightDisabled}
                              className={`flex-shrink-0 px-3 py-2 text-sm font-medium border border-gray-300 rounded-r-lg transition-colors ${
                                heightDisabled
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                              title={`Auto-fill opening height (${opening?.finishedHeight}")`}
                            >
                              Auto
                            </button>
                          )}
                        </div>
                        {componentHeight && parseFloat(componentHeight) <= 0 && (
                          <p className="text-red-500 text-xs mt-1">Height must be greater than 0</p>
                        )}
                      </div>
                    </div>
                    {/* Divide Remaining Space - only show for finished openings */}
                    {showAutoButtons && (
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowDivideSpace(!showDivideSpace)}
                          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          <span className={`transform transition-transform ${showDivideSpace ? 'rotate-90' : ''}`}>▶</span>
                          Divide Remaining Space
                        </button>
                        {showDivideSpace && (() => {
                          const opening = project?.openings.find(o => o.id === selectedOpeningId)
                          const existingPanels = opening?.panels.filter(p =>
                            p.componentInstance?.product?.productType !== 'CORNER_90' &&
                            p.componentInstance?.product?.productType !== 'FRAME'
                          ) || []
                          const usedWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
                          const remainingWidth = (opening?.finishedWidth || 0) - usedWidth
                          const selectedProducts = divideProducts.filter(p => p !== null)
                          const widthPerComponent = remainingWidth > 0 && selectedProducts.length > 0 ? remainingWidth / selectedProducts.length : 0
                          const allProductsSelected = selectedProducts.length === divideComponentCount

                          return (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-700">Remaining width:</span>
                                <span className="text-sm font-medium text-gray-900">{remainingWidth.toFixed(2)}"</span>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Number of Components</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={divideComponentCount}
                                  onChange={(e) => {
                                    const count = Math.max(1, Math.min(10, parseInt(e.target.value) || 1))
                                    setDivideComponentCount(count)
                                    // Resize the products array to match count
                                    setDivideProducts(prev => {
                                      const newProducts = [...prev]
                                      while (newProducts.length < count) newProducts.push(null)
                                      return newProducts.slice(0, count)
                                    })
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                                />
                              </div>
                              <div className="space-y-2">
                                {Array.from({ length: divideComponentCount }).map((_, index) => (
                                  <div key={index}>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Product {index + 1}</label>
                                    <select
                                      value={divideProducts[index] || ''}
                                      onChange={(e) => {
                                        const newProducts = [...divideProducts]
                                        newProducts[index] = parseInt(e.target.value) || null
                                        setDivideProducts(newProducts)
                                      }}
                                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                                    >
                                      <option value="">Select product...</option>
                                      {products.filter(p => p.productType !== 'CORNER_90' && p.productType !== 'FRAME').map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                              {selectedProducts.length > 0 && remainingWidth > 0 && (
                                <p className="text-xs text-gray-600">
                                  Each component: <span className="font-medium">{widthPerComponent.toFixed(2)}"</span> wide
                                </p>
                              )}
                              {remainingWidth <= 0 && (
                                <p className="text-xs text-red-600">No remaining space to divide</p>
                              )}
                              <button
                                type="button"
                                onClick={handleDivideRemainingSpace}
                                disabled={!allProductsSelected || remainingWidth <= 0}
                                className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Add {divideComponentCount} Component{divideComponentCount > 1 ? 's' : ''}
                              </button>
                            </div>
                          )
                        })()}
                      </div>
                    )}
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

              {/* Direction and Glass Type Selection - Side by side with separate backgrounds */}
              {selectedProductId && (() => {
                const selectedProduct = products.find(p => p.id === selectedProductId)
                const showGlassType = selectedProduct?.productType !== 'FRAME'
                const hasDirection = ['SWING_DOOR', 'SLIDING_DOOR', 'CORNER_90'].includes(selectedProduct?.productType || '')
                const planViewOptions = selectedProduct?.planViews || []
                const hasPlanViews = planViewOptions.length > 0

                // Glass Type element with its own background
                const glassTypeElement = showGlassType ? (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Glass Type</label>
                    <select
                      value={glassType}
                      onChange={(e) => setGlassType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
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
                  </div>
                ) : null

                // Direction element based on product type - each with its own background
                let directionElement = null
                if (hasDirection && !hasPlanViews) {
                  const viewType = selectedProduct?.productType === 'SWING_DOOR' ? 'elevation' : 'plan'
                  directionElement = (
                    <div className="col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        No {viewType} views have been added to this product. Please add {viewType} views in the product settings to enable direction selection.
                      </p>
                    </div>
                  )
                } else if (selectedProduct?.productType === 'SWING_DOOR') {
                  directionElement = (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Direction</label>
                      <select
                        value={swingDirection}
                        onChange={(e) => setSwingDirection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
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
                  directionElement = (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Direction</label>
                      <select
                        value={slidingDirection}
                        onChange={(e) => setSlidingDirection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      >
                        {planViewOptions.map((planView: any) => (
                          <option key={planView.id} value={planView.name}>
                            {planView.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                } else if (selectedProduct?.productType === 'CORNER_90') {
                  directionElement = (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Direction</label>
                      <select
                        value={cornerDirection}
                        onChange={(e) => setCornerDirection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      >
                        {planViewOptions.map((planView: any) => (
                          <option key={planView.id} value={planView.name}>
                            {planView.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                }

                // If both exist, show in grid. If only one, show full width
                if (directionElement && glassTypeElement) {
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      {directionElement}
                      {glassTypeElement}
                    </div>
                  )
                } else if (glassTypeElement) {
                  return glassTypeElement
                } else if (directionElement) {
                  return directionElement
                }
                return null
              })()}
              
              {/* Hardware Options - Collapsible section */}
              {selectedProductId && addComponentOptions.length > 0 && (() => {
                const allStandard = addComponentOptions.every(
                  option => addComponentSelectedOptions[option.category.id] === option.standardOptionId
                )

                return (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setHardwareOptionsExpanded(!hardwareOptionsExpanded)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-700">Hardware Options</h3>
                        {allStandard && !hardwareOptionsExpanded && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Standard Options Applied</span>
                        )}
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${hardwareOptionsExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {hardwareOptionsExpanded && (
                      <div className="p-4 space-y-3 bg-white">
                        {addComponentOptions.map((option) => {
                          const selectedOptionId = addComponentSelectedOptions[option.category.id]
                          const selectedProduct = products.find(p => p.id === selectedProductId)
                          const optionBom = selectedProduct?.productBOMs?.find(
                            (bom: any) => bom.optionId === selectedOptionId
                          )
                          const isRangeMode = optionBom?.quantityMode === 'RANGE'
                          const quantityKey = `${option.category.id}_qty`

                          return (
                            <div key={option.id}>
                              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                                {option.category.name}
                                {addComponentSelectedOptions[option.category.id] === option.standardOptionId && (
                                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Standard</span>
                                )}
                              </label>
                              <div className="flex gap-2">
                                <select
                                  value={addComponentSelectedOptions[option.category.id] === null ? 'none' : (addComponentSelectedOptions[option.category.id] || '')}
                                  onChange={(e) => {
                                    const newValue = e.target.value === 'none' ? null : (e.target.value ? parseInt(e.target.value) : undefined)
                                    setAddComponentSelectedOptions({
                                      ...addComponentSelectedOptions,
                                      [option.category.id]: newValue
                                    })
                                    // Check if new option has RANGE mode and set default quantity
                                    const newOptionBom = selectedProduct?.productBOMs?.find(
                                      (bom: any) => bom.optionId === newValue
                                    )
                                    if (newOptionBom?.quantityMode === 'RANGE') {
                                      setAddComponentOptionQuantities({
                                        ...addComponentOptionQuantities,
                                        [quantityKey]: newOptionBom.defaultQuantity || newOptionBom.minQuantity || 0
                                      })
                                    } else {
                                      // Remove quantity selection if not RANGE mode
                                      const newQuantities = { ...addComponentOptionQuantities }
                                      delete newQuantities[quantityKey]
                                      setAddComponentOptionQuantities(newQuantities)
                                    }
                                  }}
                                  className={`${isRangeMode ? 'flex-1' : 'w-full'} px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900`}
                                >
                                  <option value="">Select option...</option>
                                  <option value="none">None (No hardware)</option>
                                  {option.category.individualOptions?.map((individualOption: any) => (
                                    <option key={individualOption.id} value={individualOption.id}>
                                      {individualOption.name}
                                    </option>
                                  ))}
                                </select>
                                {isRangeMode && (
                                  <select
                                    value={addComponentOptionQuantities[quantityKey] ?? (optionBom.defaultQuantity || optionBom.minQuantity || 0)}
                                    onChange={(e) => {
                                      setAddComponentOptionQuantities({
                                        ...addComponentOptionQuantities,
                                        [quantityKey]: parseInt(e.target.value)
                                      })
                                    }}
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                    title="Select quantity"
                                  >
                                    {Array.from(
                                      { length: (optionBom.maxQuantity || 4) - (optionBom.minQuantity || 0) + 1 },
                                      (_, i) => (optionBom.minQuantity || 0) + i
                                    ).map((qty) => (
                                      <option key={qty} value={qty}>
                                        {qty}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                              {isRangeMode && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Select quantity ({optionBom.minQuantity}-{optionBom.maxQuantity})
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Validation Errors */}
              {componentValidationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-red-800 mb-1">Size Validation Errors</h4>
                  <ul className="text-sm text-red-700 list-disc list-inside">
                    {componentValidationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mandatory Options Warning */}
              {(() => {
                const mandatoryOptions = addComponentOptions.filter((opt: any) => opt.isMandatory)
                const missingMandatory = mandatoryOptions.filter((opt: any) =>
                  addComponentSelectedOptions[opt.category.id] === undefined ||
                  addComponentSelectedOptions[opt.category.id] === null
                )
                if (missingMandatory.length === 0) return null
                return (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-yellow-800 mb-1">Required Options</h4>
                    <p className="text-sm text-yellow-700">
                      Please select: {missingMandatory.map((m: any) => m.category.name).join(', ')}
                    </p>
                  </div>
                )
              })()}
            </div>
            </div>
            <div className="flex justify-end space-x-3 pt-6 flex-shrink-0 border-t mt-4">
              <button
                onClick={() => {
                  setShowAddComponent(false)
                  setSelectedOpeningId(null)
                  setSelectedProductId(null)
                  setComponentWidth('')
                  setComponentHeight('')
                  setComponentQuantity('1')
                  setWidthDivisor('1')
                  setShowDivideSpace(false)
                  setDivideProducts([null, null])
                  setComponentValidationErrors([])
                  setSwingDirection('Right In')
                  setSlidingDirection('Left')
                  setGlassType(glassTypes[0]?.name || '')
                  setHardwareOptionsExpanded(false)
                  setAddComponentOptions([])
                  setAddComponentSelectedOptions({})
                  setAddComponentOptionQuantities({})
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

                  // Check mandatory options
                  const mandatoryOptions = addComponentOptions.filter((opt: any) => opt.isMandatory)
                  const missingMandatory = mandatoryOptions.filter((opt: any) =>
                    addComponentSelectedOptions[opt.category.id] === undefined ||
                    addComponentSelectedOptions[opt.category.id] === null
                  )
                  if (missingMandatory.length > 0) return true

                  // For corner and frame components, only product selection is required
                  if (isCorner || isFrame) return false

                  // For other components, dimensions and valid quantity are required
                  const quantityValue = parseInt(componentQuantity)
                  const hasValidationErrors = componentValidationErrors.length > 0
                  return !componentWidth || !componentHeight ||
                         parseFloat(componentWidth) <= 0 ||
                         parseFloat(componentHeight) <= 0 ||
                         !quantityValue || quantityValue <= 0 ||
                         hasValidationErrors
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex-shrink-0">Edit Component</h2>
            <div className="overflow-y-auto flex-1 pr-2">
            
            {/* Dimensions Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Dimensions</h3>
              {(() => {
                const currentOpening = project?.openings.find(o => o.panels.some(p => p.id === currentPanelId))
                const currentPanel = currentOpening?.panels.find(p => p.id === currentPanelId)
                const productType = currentPanel?.componentInstance?.product?.productType
                const showAutoButtons = currentOpening?.isFinishedOpening && productType !== 'CORNER_90' && productType !== 'FRAME'

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Width Input with inline Auto button */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Width (inches)</label>
                        <div className="flex">
                          <input
                            type="number"
                            step="0.125"
                            min="0.125"
                            value={editingComponentWidth}
                            onChange={(e) => setEditingComponentWidth(e.target.value)}
                            className={`flex-1 min-w-0 px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                              showAutoButtons ? 'rounded-l-lg border-r-0' : 'rounded-lg'
                            }`}
                            placeholder="Width"
                          />
                          {showAutoButtons && (
                            <button
                              type="button"
                              onClick={handleEditAutoWidth}
                              className="flex-shrink-0 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium border border-gray-300 rounded-r-lg"
                              title={`Auto-fill remaining width (${currentOpening?.finishedWidth}" opening)`}
                            >
                              Auto
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Height Input with inline Auto button */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (inches)</label>
                        <div className="flex">
                          <input
                            type="number"
                            step="0.125"
                            min="0.125"
                            value={editingComponentHeight}
                            onChange={(e) => setEditingComponentHeight(e.target.value)}
                            className={`flex-1 min-w-0 px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                              showAutoButtons ? 'rounded-l-lg border-r-0' : 'rounded-lg'
                            }`}
                            placeholder="Height"
                          />
                          {showAutoButtons && (
                            <button
                              type="button"
                              onClick={handleEditAutoHeight}
                              className="flex-shrink-0 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium border border-gray-300 rounded-r-lg"
                              title={`Auto-fill opening height (${currentOpening?.finishedHeight}")`}
                            >
                              Auto
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
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
            {editingProductType && editingProductType !== 'FIXED_PANEL' && editingProductType !== 'FRAME' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {editingProductType === 'SWING_DOOR' ? 'Swing Direction' :
                   editingProductType === 'SLIDING_DOOR' ? 'Sliding Direction' :
                   editingProductType === 'CORNER_90' ? 'Corner Direction' : 'Direction'}
                </h3>
                {editingPlanViews.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      No plan views have been added to this product. Please add plan views in the product settings to enable direction selection.
                    </p>
                  </div>
                ) : (
                  <select
                    value={editingDirection}
                    onChange={(e) => setEditingDirection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {editingPlanViews.map((planView) => (
                      <option key={planView.id} value={planView.name}>{planView.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Options Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Product Options</h3>
              {componentOptions.length > 0 ? (
                componentOptions.map((option) => {
                  const selectedOptionId = selectedOptions[option.category.id]
                  // Convert to number for comparison since JSON parsing may have made it a string
                  const selectedOptionIdNum = selectedOptionId !== null && selectedOptionId !== undefined
                    ? Number(selectedOptionId)
                    : null
                  const optionBom = editComponentProductBOMs?.find(
                    (bom: any) => bom.optionId === selectedOptionIdNum
                  )
                  const isRangeMode = optionBom?.quantityMode === 'RANGE'
                  const quantityKey = `${option.category.id}_qty`

                  return (
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
                      <div className="flex gap-2">
                        <select
                          value={selectedOptions[option.category.id] === null ? 'none' : (selectedOptions[option.category.id] || '')}
                          onChange={(e) => {
                            const newValue = e.target.value === 'none' ? null : (e.target.value ? parseInt(e.target.value) : undefined)
                            setSelectedOptions({
                              ...selectedOptions,
                              [option.category.id]: newValue
                            })
                            // If unselecting an option, remove it from included list
                            if (!newValue && selectedOptions[option.category.id]) {
                              setIncludedOptions(includedOptions.filter(id => id !== selectedOptions[option.category.id]))
                            }
                            // Check if new option has RANGE mode and set default quantity
                            const newOptionBom = editComponentProductBOMs?.find(
                              (bom: any) => bom.optionId === newValue
                            )
                            if (newOptionBom?.quantityMode === 'RANGE') {
                              setEditComponentOptionQuantities({
                                ...editComponentOptionQuantities,
                                [quantityKey]: newOptionBom.defaultQuantity || newOptionBom.minQuantity || 0
                              })
                            } else {
                              // Remove quantity selection if not RANGE mode
                              const newQuantities = { ...editComponentOptionQuantities }
                              delete newQuantities[quantityKey]
                              setEditComponentOptionQuantities(newQuantities)
                            }
                          }}
                          className={`${isRangeMode ? 'flex-1' : 'w-full'} px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900`}
                        >
                          <option value="">Select option...</option>
                          <option value="none">None (No hardware)</option>
                          {option.category.individualOptions?.map((individualOption: any) => (
                            <option key={individualOption.id} value={individualOption.id}>
                              {individualOption.name}
                              {option.standardOptionId === individualOption.id && ' \u2605'}
                            </option>
                          ))}
                        </select>
                        {isRangeMode && (
                          <select
                            value={editComponentOptionQuantities[quantityKey] ?? (optionBom.defaultQuantity || optionBom.minQuantity || 0)}
                            onChange={(e) => {
                              setEditComponentOptionQuantities({
                                ...editComponentOptionQuantities,
                                [quantityKey]: parseInt(e.target.value)
                              })
                            }}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            title="Select quantity"
                          >
                            {Array.from(
                              { length: (optionBom.maxQuantity || 4) - (optionBom.minQuantity || 0) + 1 },
                              (_, i) => (optionBom.minQuantity || 0) + i
                            ).map((qty) => (
                              <option key={qty} value={qty}>
                                {qty}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-gray-500 text-center py-4">No configurable options for this product</p>
              )}
              {/* Validation Errors */}
              {componentValidationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                  <h4 className="text-sm font-medium text-red-800 mb-1">Size Validation Errors</h4>
                  <ul className="text-sm text-red-700 list-disc list-inside">
                    {componentValidationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            </div>
            <div className="flex justify-end space-x-3 pt-6 flex-shrink-0 border-t mt-4">
              <button
                onClick={() => {
                  setShowComponentEdit(false)
                  setSelectedComponentId(null)
                  setSelectedOptions({})
                  setEditComponentOptionQuantities({})
                  setEditComponentProductBOMs([])
                  setIncludedOptions([])
                  setEditingComponentWidth('')
                  setEditingComponentHeight('')
                  setEditWidthDivisor('1')
                  setEditingGlassType('')
                  setEditingDirection('')
                  setEditingProductType('')
                  setEditingPlanViews([])
                  setCurrentPanelId(null)
                  setComponentValidationErrors([])
                }}
                disabled={savingComponent}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedComponentId || !currentPanelId) return

                  // Client-side validation first
                  if (!validateEditComponentDimensions()) {
                    showError('Please fix validation errors before saving')
                    return
                  }

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
                    } else if (editingProductType === 'CORNER_90' && editingDirection) {
                      panelUpdateData.cornerDirection = editingDirection
                    }

                    const panelResponse = await fetch(`/api/panels/${currentPanelId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(panelUpdateData)
                    })

                    if (!panelResponse.ok) {
                      const errorData = await panelResponse.json()
                      // Handle validation errors from server
                      if (errorData.validationErrors) {
                        setComponentValidationErrors(errorData.validationErrors)
                        showError('Component size validation failed')
                        return
                      }
                      showError(errorData.error || 'Error updating component dimensions')
                      return
                    }

                    // Update component options - merge options with quantities
                    const mergedSelections = {
                      ...selectedOptions,
                      ...editComponentOptionQuantities
                    }
                    const componentResponse = await fetch(`/api/components/${selectedComponentId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        subOptionSelections: mergedSelections,
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
                    setEditComponentOptionQuantities({})
                    setEditComponentProductBOMs([])
                    setIncludedOptions([])
                    setEditingComponentWidth('')
                    setEditingComponentHeight('')
                    setEditWidthDivisor('1')
                    setEditingGlassType('')
                    setEditingDirection('')
                    setEditingProductType('')
                    setEditingPlanViews([])
                    setCurrentPanelId(null)
                    setComponentValidationErrors([])
                  } catch (error) {
                    console.error('Error updating component:', error)
                    showError('Error updating component')
                  } finally {
                    setSavingComponent(false)
                  }
                }}
                disabled={savingComponent || componentValidationErrors.length > 0}
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
                              {opening.panels.filter(p => p.componentInstance && !p.parentPanelId).length} components • ${opening.price.toLocaleString()}
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
                                                  : item.partType === 'CutStock'
                                                  ? 'bg-yellow-100 text-yellow-800'
                                                  : item.partType === 'Hardware'
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-purple-100 text-purple-800'
                                              }`}>
                                                {item.partType === 'CutStock' ? 'Cut Stock' : item.partType}
                                              </span>
                                            </td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-center text-gray-900">{item.quantity}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">
                                              {item.partType === 'Glass' ? (
                                                <div>
                                                  <div className="font-medium">{item.glassWidth?.toFixed(2)}" × {item.glassHeight?.toFixed(2)}"</div>
                                                  <div className="text-xs text-gray-500">({item.glassArea} SQ FT)</div>
                                                </div>
                                              ) : item.cutLength ? (
                                                `${item.cutLength.toFixed(2)}${item.unit === 'LF' ? "'" : '"'}`
                                              ) : (
                                                '-'
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
                            <div className="text-2xl font-bold text-blue-600">{summaryData.totalStockPiecesToOrder || 0}</div>
                            <div className="text-sm text-blue-600">Extrusion Sticks</div>
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
                                <th className="border-b border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900">Qty to Order</th>
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
                                        : item.partType === 'CutStock'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : item.partType === 'Hardware'
                                        ? 'bg-green-100 text-green-800'
                                        : item.partType === 'Glass'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-orange-100 text-orange-800'
                                    }`}>
                                      {item.partType === 'CutStock' ? 'Cut Stock' : item.partType}
                                    </span>
                                  </td>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-center font-semibold text-gray-900">
                                    {(item.partType === 'Extrusion' || item.partType === 'CutStock') && item.stockPiecesNeeded !== null
                                      ? item.stockPiecesNeeded
                                      : item.totalQuantity}
                                  </td>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                                    {(item.partType === 'Extrusion' || item.partType === 'CutStock') && item.cutLengths.length > 0 ? (
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
                                              {dim.width?.toFixed(2)}" × {dim.height?.toFixed(2)}"
                                            </span>
                                          ))}
                                          {item.glassDimensions.length > 4 && (
                                            <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                              +{item.glassDimensions.length - 4} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (item.partType === 'Hardware' || item.partType === 'Fastener') && item.calculatedLengths?.length > 0 ? (
                                      <div className="max-w-xs">
                                        <div className="text-xs text-gray-500 mb-1">
                                          {item.calculatedLengths.length} length{item.calculatedLengths.length !== 1 ? 's' : ''} ({item.totalCalculatedLength?.toFixed(2)} {item.unit} total)
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {item.calculatedLengths.slice(0, 6).map((len: number, i: number) => (
                                            <span key={i} className="inline-block px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                                              {len.toFixed(2)} {item.unit}
                                            </span>
                                          ))}
                                          {item.calculatedLengths.length > 6 && (
                                            <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                              +{item.calculatedLengths.length - 6} more
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
                  setEditingOpeningRoughWidth('')
                  setEditingOpeningRoughHeight('')
                  setEditingOpeningIsFinished(false)
                  setEditingOpeningType('THINWALL')
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
              {/* Width and Height fields for finished openings */}
              {editingOpeningIsFinished && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingOpeningType === 'THINWALL' ? 'Finished Width (in)' : 'Rough Width (in)'}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={editingOpeningRoughWidth}
                      onChange={(e) => setEditingOpeningRoughWidth(e.target.value)}
                      placeholder="Width..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingOpeningType === 'THINWALL' ? 'Finished Height (in)' : 'Rough Height (in)'}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={editingOpeningRoughHeight}
                      onChange={(e) => setEditingOpeningRoughHeight(e.target.value)}
                      placeholder="Height..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowEditOpeningModal(false)
                  setEditingOpeningId(null)
                  setEditingOpeningName('')
                  setEditingOpeningFinishColor('')
                  setEditingOpeningRoughWidth('')
                  setEditingOpeningRoughHeight('')
                  setEditingOpeningIsFinished(false)
                  setEditingOpeningType('THINWALL')
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

      {/* Size Redistribution Modal */}
      {showSizeRedistributionModal && sizeRedistributionData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Adjust Component Sizes
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              The opening size has changed. How would you like to adjust the existing components?
            </p>

            {/* Size Change Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Size Change Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Width Change:</span>
                  <span className={`ml-2 font-semibold ${sizeRedistributionData.widthDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {sizeRedistributionData.widthDiff >= 0 ? '+' : ''}{sizeRedistributionData.widthDiff.toFixed(3)}"
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Height Change:</span>
                  <span className={`ml-2 font-semibold ${sizeRedistributionData.heightDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {sizeRedistributionData.heightDiff >= 0 ? '+' : ''}{sizeRedistributionData.heightDiff.toFixed(3)}"
                  </span>
                </div>
              </div>
            </div>

            {/* Redistribution Options */}
            <div className="space-y-4 mb-6">
              <h4 className="text-sm font-medium text-gray-700">Width Adjustment Method</h4>

              {/* Equal Distribution Option */}
              <label
                className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  redistributionMethod === 'equal'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="redistribution"
                  value="equal"
                  checked={redistributionMethod === 'equal'}
                  onChange={() => setRedistributionMethod('equal')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Split Equally</div>
                  <p className="text-sm text-gray-600 mt-1">
                    Distribute the {Math.abs(sizeRedistributionData.widthDiff).toFixed(3)}" width change equally across all {sizeRedistributionData.panels.length} component{sizeRedistributionData.panels.length > 1 ? 's' : ''}.
                  </p>
                  {redistributionMethod === 'equal' && sizeRedistributionData.panels.length > 0 && (
                    <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                      <div className="text-xs font-medium text-gray-500 mb-2">Preview:</div>
                      <div className="space-y-1">
                        {sizeRedistributionData.panels.map((panel, idx) => {
                          const newWidth = panel.width + (sizeRedistributionData.widthDiff / sizeRedistributionData.panels.length)
                          return (
                            <div key={panel.id} className="flex justify-between text-sm">
                              <span className="text-gray-700">{panel.name}</span>
                              <span className="text-gray-500">
                                {panel.width.toFixed(3)}" → <span className="font-medium text-gray-900">{newWidth.toFixed(3)}"</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* Single Panel Option */}
              <label
                className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  redistributionMethod === 'single'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="redistribution"
                  value="single"
                  checked={redistributionMethod === 'single'}
                  onChange={() => setRedistributionMethod('single')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Adjust Single Component</div>
                  <p className="text-sm text-gray-600 mt-1">
                    Apply the entire width change to one specific component.
                  </p>
                  {redistributionMethod === 'single' && (
                    <div className="mt-3 space-y-3">
                      <select
                        value={selectedPanelForResize || ''}
                        onChange={(e) => setSelectedPanelForResize(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                      >
                        {sizeRedistributionData.panels.map((panel) => (
                          <option key={panel.id} value={panel.id}>
                            {panel.name} (currently {panel.width.toFixed(3)}" wide)
                          </option>
                        ))}
                      </select>
                      {selectedPanelForResize && (
                        <div className="p-3 bg-white rounded border border-blue-200">
                          <div className="text-xs font-medium text-gray-500 mb-2">Preview:</div>
                          <div className="space-y-1">
                            {sizeRedistributionData.panels.map((panel) => {
                              const isSelected = panel.id === selectedPanelForResize
                              const newWidth = isSelected ? panel.width + sizeRedistributionData.widthDiff : panel.width
                              return (
                                <div key={panel.id} className={`flex justify-between text-sm ${isSelected ? 'font-medium' : ''}`}>
                                  <span className={isSelected ? 'text-blue-700' : 'text-gray-700'}>
                                    {panel.name} {isSelected && '←'}
                                  </span>
                                  <span className="text-gray-500">
                                    {panel.width.toFixed(3)}" → <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{newWidth.toFixed(3)}"</span>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Height Note */}
            {sizeRedistributionData.heightDiff !== 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Note:</span> All component heights will be updated to {sizeRedistributionData.newHeight.toFixed(3)}" to match the new opening height.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSizeRedistributionModal(false)
                  setSizeRedistributionData(null)
                  setRedistributionMethod('equal')
                  setSelectedPanelForResize(null)
                }}
                disabled={isUpdatingOpening}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyRedistribution}
                disabled={isUpdatingOpening || (redistributionMethod === 'single' && !selectedPanelForResize)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-medium"
              >
                {isUpdatingOpening && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isUpdatingOpening ? 'Applying...' : 'Apply Changes'}
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
                      ({opening.panels.filter(p => p.componentInstance && !p.parentPanelId).length} components)
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