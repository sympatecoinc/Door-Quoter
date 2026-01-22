'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'

// Direction options are now loaded dynamically from product plan views
import { ArrowLeft, Edit, Plus, Eye, Trash2, Settings, FileText, Download, Copy, Archive, X, ChevronDown, Receipt, Check, Lock, GitBranch } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'
import DrawingViewer from '../ui/DrawingViewer'
import { ProjectStatus, STATUS_CONFIG, isProjectLocked, ProjectVersion, ProjectVersionsResponse } from '@/types'

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
  toleranceProductId?: number | null  // If set, tolerances have been applied to this opening
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
      productCategory?: string
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
  const { selectedProjectId, setSelectedProjectId, selectedCustomerId, customerDetailView, setCurrentMenu, autoOpenAddOpening, setAutoOpenAddOpening, cameFromSalesDashboard, setCameFromSalesDashboard, salesLeadId, setShowSalesLeadView } = useAppStore()
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
  const [pendingDeletePanelId, setPendingDeletePanelId] = useState<number | null>(null)
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
    totalComponentWidth: number
    panels: { id: number; name: string; width: number; height: number }[]
  } | null>(null)
  const [redistributionMethod, setRedistributionMethod] = useState<'none' | 'selected'>('none')
  const [selectedPanelsForResize, setSelectedPanelsForResize] = useState<number[]>([])
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
  const [swingDirection, setSwingDirection] = useState<string>('')
  const [slidingDirection, setSlidingDirection] = useState<string>('')
  const [cornerDirection, setCornerDirection] = useState<string>('')
  const [glassType, setGlassType] = useState<string>('')
  const [componentQuantity, setComponentQuantity] = useState<string>('1')
  const [componentValidationErrors, setComponentValidationErrors] = useState<string[]>([])
  // Hardware options for add component modal
  const [addComponentOptions, setAddComponentOptions] = useState<any[]>([])
  const [addComponentSelectedOptions, setAddComponentSelectedOptions] = useState<Record<number, number | null>>({})
  const [addComponentOptionQuantities, setAddComponentOptionQuantities] = useState<Record<string, number>>({})
  const [hardwareOptionsExpanded, setHardwareOptionsExpanded] = useState(false)
  // Wizard step tracking for add component modal
  const [addComponentStep, setAddComponentStep] = useState<'product' | 'dimensions' | 'direction' | 'glassType' | 'options' | 'ready'>('product')
  const [currentMandatoryOptionIndex, setCurrentMandatoryOptionIndex] = useState<number>(0)
  // Multi-panel mode state
  const [addComponentMode, setAddComponentMode] = useState<'single' | 'multiple' | null>(null)
  const [multiPanelCount, setMultiPanelCount] = useState<number>(2)
  const [multiPanelCountInput, setMultiPanelCountInput] = useState<string>('2')
  const [currentPanelIndex, setCurrentPanelIndex] = useState<number>(0)
  const [multiPanelConfigs, setMultiPanelConfigs] = useState<{
    index: number
    width: number
    height: number
    glassType: string
    selectedOptions: Record<number, number | null>
    optionQuantities: Record<string, number>
    variantSelections: Record<string, number>
    isConfigured: boolean
  }[]>([])
  const [firstPanelOptionsComplete, setFirstPanelOptionsComplete] = useState<boolean>(false)
  const [showApplyToRemaining, setShowApplyToRemaining] = useState<boolean>(false)
  const [excludedOptionsFromApply, setExcludedOptionsFromApply] = useState<Set<number>>(new Set())
  const [showComponentEdit, setShowComponentEdit] = useState(false)
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null)
  const [componentOptions, setComponentOptions] = useState<any[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number | null>>({})
  const [editComponentOptionQuantities, setEditComponentOptionQuantities] = useState<Record<string, number>>({})
  const [editComponentProductBOMs, setEditComponentProductBOMs] = useState<any[]>([])
  const [includedOptions, setIncludedOptions] = useState<number[]>([]) // Hardware options marked as included (no charge)
  const [variantSelections, setVariantSelections] = useState<Record<string, number>>({}) // { [optionId]: variantId }
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

  // Project versioning state
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([])
  const [showVersionSelector, setShowVersionSelector] = useState(false)
  const [creatingRevision, setCreatingRevision] = useState(false)

  // Bulk delete state
  const [selectedOpeningIds, setSelectedOpeningIds] = useState<Set<number>>(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Quote accepted edit confirmation state
  const [showQuoteAcceptedConfirm, setShowQuoteAcceptedConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [pendingActionDescription, setPendingActionDescription] = useState('')

  // Tolerance-eligible product types for opening size calculations
  const TOLERANCE_ELIGIBLE_TYPES = ['SWING_DOOR', 'SLIDING_DOOR', 'FIXED_PANEL']

  // Helper to calculate effective finished dimensions for an opening
  // Uses existing finishedWidth/finishedHeight if tolerances have been applied,
  // otherwise calculates from rough dimensions and selected product tolerances
  function getEffectiveFinishedDimensions(
    opening: Opening | undefined,
    selectedProduct: any | undefined
  ): { width: number | null; height: number | null } {
    if (!opening) {
      return { width: null, height: null }
    }

    // If tolerances have already been applied to this opening (toleranceProductId is set),
    // use the stored finished dimensions
    if (opening.toleranceProductId && opening.finishedWidth && opening.finishedHeight) {
      return { width: opening.finishedWidth, height: opening.finishedHeight }
    }

    // For finished openings where tolerances haven't been applied yet
    // (first tolerance-eligible product being added)
    if (opening.isFinishedOpening && opening.roughWidth && opening.roughHeight) {
      // If a tolerance-eligible product is selected, use its tolerances to calculate effective dimensions
      if (selectedProduct && TOLERANCE_ELIGIBLE_TYPES.includes(selectedProduct.productType)) {
        const widthTolerance = selectedProduct.widthTolerance || 0
        const heightTolerance = selectedProduct.heightTolerance || 0
        return {
          width: opening.roughWidth - widthTolerance,
          height: opening.roughHeight - heightTolerance
        }
      }
      // If no product selected or not tolerance-eligible, use rough dimensions (0 tolerance)
      return { width: opening.roughWidth, height: opening.roughHeight }
    }

    return { width: null, height: null }
  }

  // Handle back navigation
  const handleBack = () => {
    setSelectedProjectId(null)
    // If we came from sales dashboard, go back to dashboard and reopen the sales lead view
    if (cameFromSalesDashboard) {
      setCameFromSalesDashboard(false)
      setCurrentMenu('dashboard')
      // Reopen the sales lead view for the project we were editing
      if (salesLeadId) {
        setShowSalesLeadView(true)
      }
    }
    // If we came from customer detail view, go back to dashboard (which shows customer detail)
    else if (selectedCustomerId && customerDetailView) {
      setCurrentMenu('dashboard')
    }
    // Otherwise stay on projects menu (will show projects list)
  }

  // Check if project is in a locked status and require confirmation for modifications
  const requireQuoteAcceptedConfirmation = (action: () => void, actionDescription: string): boolean => {
    if (project && isProjectLocked(project.status as ProjectStatus)) {
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
    { isOpen: showVersionSelector, onClose: () => setShowVersionSelector(false) },
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

  // Click outside to dismiss pending delete confirmation
  useEffect(() => {
    if (pendingDeletePanelId === null) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Don't dismiss if clicking on a confirm button
      if (target.closest('[data-delete-confirm]')) return
      setPendingDeletePanelId(null)
    }

    // Small delay to avoid dismissing immediately on the same click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [pendingDeletePanelId])

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
      fetchProjectVersions()
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

  // Fetch project versions for version switcher
  async function fetchProjectVersions() {
    if (!selectedProjectId) return

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/revisions`)
      if (response.ok) {
        const data: ProjectVersionsResponse = await response.json()
        setProjectVersions(data.versions)
      }
    } catch (error) {
      console.error('Error fetching project versions:', error)
    }
  }

  // Create a new revision from a locked project
  async function handleCreateRevision() {
    if (!selectedProjectId) return

    setCreatingRevision(true)
    setCalculatingPrices(true)
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/revisions`, {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()

        // Fetch the new revision's full project data
        const projectResponse = await fetch(`/api/projects/${data.revision.id}`)
        if (projectResponse.ok) {
          const newProjectData = await projectResponse.json()

          // Calculate prices for all openings in the new revision
          await calculateAllOpeningPrices(newProjectData)

          // Navigate to the new revision
          setSelectedProjectId(data.revision.id)

          showSuccess(`Revision v${data.revision.version} created and prices calculated`)
        } else {
          // Still navigate even if price calculation fails
          setSelectedProjectId(data.revision.id)
          showSuccess(`Revision v${data.revision.version} created successfully`)
        }
      } else {
        const error = await response.json()
        showError(error.error || 'Failed to create revision')
      }
    } catch (error) {
      console.error('Error creating revision:', error)
      showError('Failed to create revision')
    } finally {
      setCreatingRevision(false)
      setCalculatingPrices(false)
    }
  }

  // Switch to a different version
  function handleSwitchVersion(versionId: number) {
    if (versionId !== selectedProjectId) {
      setSelectedProjectId(versionId)
      setShowVersionSelector(false)
    }
  }

  // Check if project is in a locked status
  const projectIsLocked = project ? isProjectLocked(project.status as ProjectStatus) : false

  // Check if viewing the current version (not a historical version)
  const isViewingCurrentVersion = projectVersions.length === 0 || projectVersions.find(v => v.id === selectedProjectId)?.isCurrentVersion === true

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

        // Calculate total component width
        const totalComponentWidth = resizablePanels.reduce((sum, p) => sum + p.width, 0)

        // Determine if components exceed new opening width (requires adjustment)
        const componentsExceedOpening = totalComponentWidth > newFinishedWidth + 0.001

        // Show redistribution modal
        setSizeRedistributionData({
          openingId: editingOpeningId,
          widthDiff: newFinishedWidth - currentFinishedWidth,
          heightDiff: newFinishedHeight - currentFinishedHeight,
          newWidth: newFinishedWidth,
          newHeight: newFinishedHeight,
          totalComponentWidth,
          panels: resizablePanels.map((p, idx) => ({
            id: p.id,
            name: p.componentInstance?.product?.name || `Panel ${idx + 1}`,
            width: p.width,
            height: p.height
          }))
        })
        // If components exceed opening, force 'selected' mode - user must choose what to shrink
        setRedistributionMethod(componentsExceedOpening ? 'selected' : 'none')
        setSelectedPanelsForResize([])
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

      if (redistributionMethod === 'none') {
        // Keep widths as-is, only update heights (leave a gap)
        for (const panel of panels) {
          panelUpdates.push({
            id: panel.id,
            width: panel.width, // Keep original width
            height: newHeight // All panels get the new height
          })
        }
      } else {
        // Distribute width difference evenly among selected panels
        const widthPerSelectedPanel = selectedPanelsForResize.length > 0
          ? widthDiff / selectedPanelsForResize.length
          : 0
        for (const panel of panels) {
          const isSelected = selectedPanelsForResize.includes(panel.id)
          panelUpdates.push({
            id: panel.id,
            width: isSelected ? panel.width + widthPerSelectedPanel : panel.width,
            height: newHeight // All panels get the new height
          })
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
      setRedistributionMethod('none')
      setSelectedPanelsForResize([])
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
      setComponentValidationErrors([])
      setSwingDirection('Right In')
      setSlidingDirection('Left')
      setCornerDirection('Left')
      setGlassType(glassTypes[0]?.name || '')
      setHardwareOptionsExpanded(false)
      setAddComponentOptions([])
      setAddComponentSelectedOptions({})
      setAddComponentOptionQuantities({})
      setAddComponentStep('product')
      setCurrentMandatoryOptionIndex(0)

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
        // Only auto-populate height if tolerances have already been applied to the opening
        // If tolerances haven't been applied yet, leave blank - user should use "Auto" after selecting product
        if (opening?.isFinishedOpening && opening.finishedHeight && opening.toleranceProductId) {
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

    // Get effective finished dimensions (uses product tolerances if finishedWidth/Height not yet calculated)
    const effectiveDimensions = getEffectiveFinishedDimensions(opening, selectedProduct)

    // Skip validation if not a finished opening or no effective dimensions
    if (!opening?.isFinishedOpening || !effectiveDimensions.width || !effectiveDimensions.height) {
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
    if (height > effectiveDimensions.height) {
      errors.push(`Height (${height}") exceeds opening finished height (${effectiveDimensions.height}")`)
    }

    // Width validation - sum of all panels
    const existingPanels = opening.panels.filter(p =>
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const existingWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    const totalWidth = existingWidth + (width * quantity)

    if (totalWidth > effectiveDimensions.width) {
      const available = effectiveDimensions.width - existingWidth
      errors.push(`Total width (${totalWidth.toFixed(3)}") exceeds opening (${effectiveDimensions.width}"). Available: ${available.toFixed(3)}"`)
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

    // Get effective finished dimensions (uses product tolerances if finishedWidth/Height not yet calculated)
    const effectiveDimensions = getEffectiveFinishedDimensions(opening, selectedProduct)

    if (!opening?.isFinishedOpening || !effectiveDimensions.width || !effectiveDimensions.height) {
      showError('Auto-size only works for Finished Openings with dimensions set')
      return
    }

    // Calculate existing panel widths (exclude corners and frames)
    const existingPanels = opening.panels.filter(p =>
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const usedWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    let availableWidth = effectiveDimensions.width - usedWidth
    let finalHeight = effectiveDimensions.height

    if (availableWidth <= 0) {
      showError(`No space available - existing components use ${usedWidth.toFixed(3)}" of ${effectiveDimensions.width}" opening width`)
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
  function calculateAutoWidth(): { width: number | null, error?: string } {
    const opening = project?.openings.find(o => o.id === selectedOpeningId)
    const selectedProduct = products.find(p => p.id === selectedProductId)

    // Get effective finished dimensions (uses product tolerances if finishedWidth/Height not yet calculated)
    const effectiveDimensions = getEffectiveFinishedDimensions(opening, selectedProduct)

    if (!opening?.isFinishedOpening || !effectiveDimensions.width) {
      return { width: null, error: 'Auto width only works for Finished Openings with dimensions set' }
    }

    // Calculate existing panel widths (exclude corners and frames)
    const existingPanels = opening.panels.filter(p =>
      p.componentInstance?.product?.productType !== 'CORNER_90' &&
      p.componentInstance?.product?.productType !== 'FRAME'
    )
    const usedWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
    let availableWidth = effectiveDimensions.width - usedWidth

    if (availableWidth <= 0) {
      return { width: null, error: `No space available - existing components use ${usedWidth.toFixed(3)}" of ${effectiveDimensions.width}" opening width` }
    }

    // Apply product constraints
    if (selectedProduct?.minWidth && availableWidth < selectedProduct.minWidth) {
      return { width: null, error: `Available width (${availableWidth.toFixed(3)}") is less than product minimum (${selectedProduct.minWidth}")` }
    }

    if (selectedProduct?.maxWidth && availableWidth > selectedProduct.maxWidth) {
      availableWidth = selectedProduct.maxWidth
    }

    return { width: availableWidth }
  }

  // Auto-fill width only to remaining available space
  function handleAutoWidth() {
    const result = calculateAutoWidth()

    if (result.error) {
      showError(result.error)
      return
    }

    if (result.width !== null) {
      setComponentWidth(result.width.toFixed(3))
      showSuccess(`Width auto-filled: ${result.width.toFixed(3)}"`)
    }
  }

  // Auto-fill height only to opening height
  function handleAutoHeight() {
    const opening = project?.openings.find(o => o.id === selectedOpeningId)
    const selectedProduct = products.find(p => p.id === selectedProductId)

    // Get effective finished dimensions (uses product tolerances if finishedWidth/Height not yet calculated)
    const effectiveDimensions = getEffectiveFinishedDimensions(opening, selectedProduct)

    if (!opening?.isFinishedOpening || !effectiveDimensions.height) {
      showError('Auto height only works for Finished Openings with dimensions set')
      return
    }

    let finalHeight = effectiveDimensions.height

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
            subOptionSelections: selectionsForInstance,
            variantSelections: panelData._isPairedPanel ? {} : variantSelections
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
      setComponentValidationErrors([])
      setSwingDirection('Right In')
      setSlidingDirection('Left')
      setGlassType(glassTypes[0]?.name || '')
      setHardwareOptionsExpanded(false)
      setAddComponentOptions([])
      setAddComponentSelectedOptions({})
      setAddComponentOptionQuantities({})
      setVariantSelections({})

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

  // Handler for adding multiple panels at once
  async function handleAddMultiplePanels() {
    if (!selectedOpeningId || !selectedProductId || multiPanelConfigs.length === 0) return

    try {
      // Loop through all panel configs and create each panel
      for (const config of multiPanelConfigs) {
        // Create panel
        const panelResponse = await fetch('/api/panels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            openingId: selectedOpeningId,
            type: 'Component',
            width: config.width,
            height: config.height,
            glassType: config.glassType || glassType,
            locking: 'N/A',
            swingDirection: '',
            slidingDirection: '',
            isCorner: false,
            cornerDirection: '',
            quantity: 1,
            productId: selectedProductId,
            skipValidation: true
          })
        })

        if (!panelResponse.ok) {
          const errorData = await panelResponse.json()
          showError(errorData.error || `Failed to add panel ${config.index + 1}`)
          continue
        }

        const panelsData = await panelResponse.json()

        // Create component instance for the panel
        const mergedSelections = {
          ...config.selectedOptions,
          ...config.optionQuantities
        }

        for (const panelData of panelsData) {
          const componentResponse = await fetch('/api/component-instances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              panelId: panelData.id,
              productId: selectedProductId,
              subOptionSelections: mergedSelections,
              variantSelections: config.variantSelections
            })
          })

          if (!componentResponse.ok) {
            console.error('Error creating component instance for panel:', panelData.id)
          }
        }
      }

      // Reset form and close modal
      setShowAddComponent(false)
      setSelectedOpeningId(null)
      setSelectedProductId(null)
      setComponentWidth('')
      setComponentHeight('')
      setComponentQuantity('1')
      setComponentValidationErrors([])
      setSwingDirection('')
      setSlidingDirection('')
      setCornerDirection('')
      setGlassType('')
      setHardwareOptionsExpanded(false)
      setAddComponentOptions([])
      setAddComponentSelectedOptions({})
      setAddComponentOptionQuantities({})
      setVariantSelections({})
      // Reset multi-panel state
      setAddComponentMode(null)
      setMultiPanelCount(2)
      setMultiPanelCountInput('2')
      setCurrentPanelIndex(0)
      setMultiPanelConfigs([])
      setFirstPanelOptionsComplete(false)
      setShowApplyToRemaining(false)
      setExcludedOptionsFromApply(new Set())
      setAddComponentStep('product')

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
      showSuccess(`Successfully added ${multiPanelConfigs.length} panels`)
    } catch (error) {
      console.error('Error adding multiple panels:', error)
      showError('Error adding panels')
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
            setVariantSelections(JSON.parse(componentData.variantSelections || '{}'))
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

  async function confirmInlineDeleteComponent(panelId: number) {
    setIsDeletingComponent(true)
    try {
      const panel = project?.openings.flatMap(o => o.panels).find(p => p.id === panelId)
      const openingId = panel?.openingId || project?.openings.find(o => o.panels.some(p => p.id === panelId))?.id

      const response = await fetch(`/api/panels/${panelId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        if (openingId) {
          try {
            await fetch(`/api/openings/${openingId}/calculate-price`, {
              method: 'POST'
            })
          } catch (error) {
            console.error('Error recalculating opening price:', error)
          }
        }
        await refreshProject()
        setPendingDeletePanelId(null)
      }
    } catch (error) {
      console.error('Error deleting component:', error)
      showError('Error deleting component')
    } finally {
      setIsDeletingComponent(false)
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
              {isViewingCurrentVersion && needsSync && !calculatingPrices && project.status !== 'QUOTE_ACCEPTED' && (
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
              {/* For historical versions, only show Editing Locked badge */}
              {!isViewingCurrentVersion ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                  <Lock className="w-3 h-3 mr-1" />
                  Editing Locked
                </span>
              ) : (
                <>
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
                  {/* Lock indicator for locked statuses */}
                  {projectIsLocked && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                      <Lock className="w-3 h-3 mr-1" />
                      Editing Locked
                    </span>
                  )}
                </>
              )}
              {/* Version indicator and switcher */}
              {projectVersions.length > 1 && (
                <div className="ml-2 relative">
                  <button
                    onClick={() => setShowVersionSelector(!showVersionSelector)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200"
                  >
                    <GitBranch className="w-3 h-3 mr-1" />
                    v{projectVersions.find(v => v.id === selectedProjectId)?.version || 1}
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </button>
                  {showVersionSelector && (
                    <div className="absolute left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-2 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500">Project Versions</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {projectVersions.map((version) => (
                          <button
                            key={version.id}
                            onClick={() => handleSwitchVersion(version.id)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                              version.id === selectedProjectId ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-center">
                              <span className={`font-medium ${version.id === selectedProjectId ? 'text-blue-600' : 'text-gray-900'}`}>
                                v{version.version}
                              </span>
                              {version.isCurrentVersion && (
                                <span className="ml-2 text-xs text-green-600">(current)</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {version._count.openings} openings
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className="ml-4 text-gray-600">
                {project._count.openings} openings • Created {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Create Sales Order button - only for ACTIVE projects on current version */}
          {isViewingCurrentVersion && project.status === 'ACTIVE' && !existingSalesOrderNumber && (
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
          {/* Create Revision button - only shown when project is locked and viewing current version (not for QUOTE_ACCEPTED) */}
          {isViewingCurrentVersion && projectIsLocked && project.status !== 'QUOTE_ACCEPTED' && (
            <button
              onClick={handleCreateRevision}
              disabled={creatingRevision}
              className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              title="Create a new editable revision of this project"
            >
              {creatingRevision ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <GitBranch className="w-5 h-5 mr-2" />
                  Create Revision
                </>
              )}
            </button>
          )}
          <button
            onClick={handleShowAddOpeningModal}
            disabled={projectIsLocked}
            className={`flex items-center px-4 py-2 rounded-lg ${
              projectIsLocked
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title={projectIsLocked ? 'Project is locked. Create a revision to add openings.' : 'Add a new opening'}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Opening
          </button>
        </div>
      </div>

      {/* Openings Section */}
      {project.openings.length > 0 ? (
          <div className="space-y-4">
            {project.openings.map((opening) => (
              <div key={opening.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -ml-2 transition-colors"
                        onClick={() => handleShowEditOpeningModal(opening)}
                        title="Click to edit opening settings"
                      >
                        <h3 className="font-bold text-gray-900">{opening.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${opening.openingType === 'FRAMED' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {opening.openingType === 'FRAMED' ? 'Trimmed' : 'Thinwall'}
                        </span>
                        {opening.finishColor && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Finish: <span className="font-medium text-gray-700">{opening.finishColor}</span>
                          </span>
                        )}
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
{`${opening.openingType === 'THINWALL' ? 'Finished' : 'Rough'} Opening Size: ${opening.roughWidth}" W × ${opening.roughHeight}" H`}
                      </span>
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
                              {panel.isCorner && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                                    ⊥ {panel.cornerDirection}
                                  </span>
                                </div>
                              )}
                              <div className="text-gray-500 text-xs">
                                {panel.isCorner ? (
                                  <span className="text-orange-600 font-medium">
                                    Directional corner - no dimensions
                                  </span>
                                ) : (
                                  `${Number(panel.width).toFixed(3)}" W × ${Number(panel.height).toFixed(3)}" H`
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
                                    const variantSelectionsStr = panel.componentInstance!.variantSelections || '{}'
                                    const variantSelectionsData = JSON.parse(variantSelectionsStr)
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
                                            // Check for variant selection
                                            let variantSuffix = ''
                                            const selectedVariantId = variantSelectionsData[String(optionId)]
                                            if (selectedVariantId && individualOption.variants) {
                                              const selectedVariant = individualOption.variants.find((v: any) => v.id === selectedVariantId)
                                              if (selectedVariant) {
                                                variantSuffix = ` (${selectedVariant.name})`
                                              }
                                            }
                                            optionItems.push({
                                              categoryName: productOption.category.name,
                                              optionName: `${individualOption.name}${variantSuffix}`
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
                            <div
                              className="relative"
                              style={{ minWidth: pendingDeletePanelId === panel.id ? '54px' : '20px', transition: 'min-width 200ms ease-out' }}
                              data-delete-confirm
                            >
                              <button
                                onClick={() => setPendingDeletePanelId(panel.id)}
                                data-delete-confirm
                                className={`absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full transition-all duration-200 ease-out ${
                                  pendingDeletePanelId === panel.id ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                                }`}
                                title="Delete Component"
                              >
                                <X className="w-3 h-3 text-gray-500" strokeWidth={3} />
                              </button>
                              <button
                                onClick={() => confirmInlineDeleteComponent(panel.id)}
                                disabled={isDeletingComponent}
                                data-delete-confirm
                                className={`absolute top-0 right-0 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-all duration-200 ease-out whitespace-nowrap ${
                                  pendingDeletePanelId === panel.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                                }`}
                              >
                                {isDeletingComponent ? '...' : 'Confirm'}
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
                      {finish.finishType} {finish.costPerSqFt > 0 ? `(+$${finish.costPerSqFt.toFixed(2)}/sq ft)` : ''}
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
                      Enable to enter opening dimensions
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
                    Tolerances are automatically applied based on Components added to the opening.
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
              {/* Step 1: Mode Selection Tiles - show when on product step with no mode selected */}
              {addComponentStep === 'product' && addComponentMode === null && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">Choose how to add components:</p>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Single Component Tile */}
                    <button
                      type="button"
                      onClick={() => setAddComponentMode('single')}
                      className="p-6 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200">
                          <Plus className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-lg font-semibold text-gray-900">Add Component</span>
                      </div>
                      <p className="text-sm text-gray-500">Add a single component with full configuration options</p>
                    </button>

                    {/* Multiple Panels Tile - only show if FIXED_PANEL products exist */}
                    {products.some(p => p.productType === 'FIXED_PANEL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddComponentMode('multiple')
                          // Auto-select the first FIXED_PANEL product
                          const fixedPanelProduct = products.find(p => p.productType === 'FIXED_PANEL')
                          if (fixedPanelProduct) {
                            setSelectedProductId(fixedPanelProduct.id)
                            // Load hardware options for the selected product
                            if (fixedPanelProduct.productSubOptions && fixedPanelProduct.productSubOptions.length > 0) {
                              setAddComponentOptions(fixedPanelProduct.productSubOptions)
                              const preselected: Record<number, number | null> = {}
                              const preselectedVariants: Record<string, number> = {}
                              for (const pso of fixedPanelProduct.productSubOptions) {
                                if (pso.standardOptionId) {
                                  preselected[pso.category.id] = pso.standardOptionId
                                  const standardOption = pso.category.individualOptions?.find(
                                    (opt: any) => opt.id === pso.standardOptionId
                                  )
                                  if (standardOption?.variants?.length > 0) {
                                    const defaultVariant = standardOption.variants.find((v: any) => v.isDefault)
                                    if (defaultVariant) {
                                      preselectedVariants[String(pso.standardOptionId)] = defaultVariant.id
                                    }
                                  }
                                }
                              }
                              setAddComponentSelectedOptions(preselected)
                              setVariantSelections(preselectedVariants)
                            }
                          }
                        }}
                        className="p-6 border-2 border-green-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200">
                            <Copy className="w-5 h-5 text-green-600" />
                          </div>
                          <span className="text-lg font-semibold text-gray-900">Add Multiple Panels</span>
                        </div>
                        <p className="text-sm text-gray-500">Quickly add multiple fixed panels with shared options</p>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Single Component Mode - Product Selection */}
              {addComponentStep === 'product' && addComponentMode === 'single' && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddComponentMode(null)
                      setSelectedProductId(null)
                      setAddComponentOptions([])
                      setAddComponentSelectedOptions({})
                      setVariantSelections({})
                    }}
                    className="mb-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to selection
                  </button>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
                  <Listbox
                    value={selectedProductId || null}
                    onChange={(productId: number | null) => {
                      if (!productId) return
                      setSelectedProductId(productId)

                      // Load hardware options for the selected product
                      const product = products.find(p => p.id === productId)
                      if (product?.productSubOptions && product.productSubOptions.length > 0) {
                        setAddComponentOptions(product.productSubOptions)
                        // Pre-select standard options and their default variants
                        const preselected: Record<number, number | null> = {}
                        const preselectedVariants: Record<string, number> = {}
                        for (const pso of product.productSubOptions) {
                          if (pso.standardOptionId) {
                            preselected[pso.category.id] = pso.standardOptionId
                            // Find the standard option and check for default variant
                            const standardOption = pso.category.individualOptions?.find(
                              (opt: any) => opt.id === pso.standardOptionId
                            )
                            if (standardOption?.variants?.length > 0) {
                              const defaultVariant = standardOption.variants.find((v: any) => v.isDefault)
                              if (defaultVariant) {
                                preselectedVariants[String(pso.standardOptionId)] = defaultVariant.id
                              }
                            }
                          }
                        }
                        setAddComponentSelectedOptions(preselected)
                        setVariantSelections(preselectedVariants)
                      } else {
                        setAddComponentOptions([])
                        setAddComponentSelectedOptions({})
                        setVariantSelections({})
                      }

                      // Auto-calculate width and height based on opening dimensions and product tolerances
                      if (product && product.productType !== 'CORNER_90' && product.productType !== 'FRAME') {
                        const opening = project?.openings.find(o => o.id === selectedOpeningId)

                        // Calculate effective dimensions with product tolerances
                        const effectiveDims = getEffectiveFinishedDimensions(opening, product)

                        // Get existing panels to calculate remaining space
                        const nonFramePanels = opening?.panels?.filter(p =>
                          p.componentInstance?.product?.productType !== 'FRAME' &&
                          p.componentInstance?.product?.productType !== 'CORNER_90'
                        ) || []

                        // Calculate remaining width
                        const usedWidth = nonFramePanels.reduce((sum, p) => sum + (p.width || 0), 0)
                        const remainingWidth = (effectiveDims.width || 0) - usedWidth

                        // Auto-calculate width: use remaining space or defaultWidth, whichever is smaller
                        if (opening?.isFinishedOpening && effectiveDims.width) {
                          let finalWidth = remainingWidth
                          // If product has defaultWidth and it's smaller than remaining, use defaultWidth
                          if (product.defaultWidth && product.defaultWidth < remainingWidth) {
                            finalWidth = product.defaultWidth
                          }
                          // Apply product maxWidth constraint
                          if (product.maxWidth && finalWidth > product.maxWidth) {
                            finalWidth = product.maxWidth
                          }
                          // Apply product minWidth constraint
                          if (product.minWidth && finalWidth < product.minWidth) {
                            finalWidth = product.minWidth
                          }
                          if (finalWidth > 0) {
                            setComponentWidth(finalWidth.toString())
                          }
                        } else if (product.defaultWidth) {
                          // Non-finished opening: just use defaultWidth
                          setComponentWidth(product.defaultWidth.toString())
                        }

                        // Auto-calculate height
                        if (opening?.isFinishedOpening && opening.roughHeight) {
                          if (nonFramePanels.length > 0) {
                            // Use existing panel height for consistency
                            setComponentHeight(nonFramePanels[0].height.toString())
                          } else if (effectiveDims.height) {
                            // First panel - use effective height with product tolerances
                            let finalHeight = effectiveDims.height
                            if (product.maxHeight && finalHeight > product.maxHeight) {
                              finalHeight = product.maxHeight
                            }
                            if (product.minHeight && finalHeight < product.minHeight) {
                              finalHeight = product.minHeight
                            }
                            setComponentHeight(finalHeight.toString())
                          }
                        }
                      }

                      // Reset direction selections when product changes (no default selection)
                      setSwingDirection('')
                      setSlidingDirection('')
                      setCornerDirection('')
                      setGlassType('')

                      // Reset current mandatory option index
                      setCurrentMandatoryOptionIndex(0)
                    }}
                  >
                    <div className="relative">
                      <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-left flex items-center justify-between">
                        {(() => {
                          const selectedProduct = products.find(p => p.id === selectedProductId)
                          if (selectedProduct) {
                            return <span>{selectedProduct.productType === 'CORNER_90' ? '90° Corner' : selectedProduct.name}</span>
                          }
                          return <span className="text-gray-500">Select a product...</span>
                        })()}
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </ListboxButton>
                      <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                        {products.filter(p => p.productType !== 'FRAME').map((product) => (
                          <ListboxOption
                            key={product.id}
                            value={product.id}
                            className="cursor-pointer select-none px-3 py-2 hover:bg-blue-50 data-[selected]:bg-blue-100 flex items-center justify-between"
                          >
                            {({ selected }) => (
                              <>
                                <span>{product.productType === 'CORNER_90' ? '90° Corner' : product.name}</span>
                                {selected && <Check className="w-4 h-4 text-blue-600" />}
                              </>
                            )}
                          </ListboxOption>
                        ))}
                      </ListboxOptions>
                    </div>
                  </Listbox>
                  {/* Next button - only show when product is selected */}
                  {selectedProductId && (
                    <div className="flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => setAddComponentStep('dimensions')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        Next
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Multiple Panels Mode - Product Selection */}
              {addComponentStep === 'product' && addComponentMode === 'multiple' && (() => {
                const currentOpening = project?.openings.find(o => o.id === selectedOpeningId)
                const isFinishedOpening = !!(currentOpening?.isFinishedOpening && currentOpening?.finishedWidth)
                const existingPanels = currentOpening?.panels.filter(p =>
                  p.componentInstance?.product?.productType !== 'CORNER_90' &&
                  p.componentInstance?.product?.productType !== 'FRAME'
                ) || []
                const usedWidth = existingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
                const remainingWidth = (currentOpening?.finishedWidth || 0) - usedWidth
                const widthPerPanel = multiPanelCount > 0 ? remainingWidth / multiPanelCount : 0
                const fixedPanelProducts = products.filter(p => p.productType === 'FIXED_PANEL')

                return (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setAddComponentMode(null)
                        setSelectedProductId(null)
                        setAddComponentOptions([])
                        setAddComponentSelectedOptions({})
                        setVariantSelections({})
                        setMultiPanelCount(2)
                        setMultiPanelCountInput('2')
                        setMultiPanelConfigs([])
                      }}
                      className="mb-4 text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to selection
                    </button>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Copy className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Add Multiple Fixed Panels</span>
                      </div>
                      <p className="text-sm text-green-700">Configure options once, apply to all panels</p>
                    </div>

                    {/* Product Selection - Fixed Panels Only */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Panel Product</label>
                      <Listbox
                        value={selectedProductId || null}
                        onChange={(productId: number | null) => {
                          if (!productId) return
                          setSelectedProductId(productId)
                          const product = products.find(p => p.id === productId)
                          if (product?.productSubOptions && product.productSubOptions.length > 0) {
                            setAddComponentOptions(product.productSubOptions)
                            const preselected: Record<number, number | null> = {}
                            const preselectedVariants: Record<string, number> = {}
                            for (const pso of product.productSubOptions) {
                              if (pso.standardOptionId) {
                                preselected[pso.category.id] = pso.standardOptionId
                                const standardOption = pso.category.individualOptions?.find(
                                  (opt: any) => opt.id === pso.standardOptionId
                                )
                                if (standardOption?.variants?.length > 0) {
                                  const defaultVariant = standardOption.variants.find((v: any) => v.isDefault)
                                  if (defaultVariant) {
                                    preselectedVariants[String(pso.standardOptionId)] = defaultVariant.id
                                  }
                                }
                              }
                            }
                            setAddComponentSelectedOptions(preselected)
                            setVariantSelections(preselectedVariants)
                          }
                          setGlassType('')
                          setCurrentMandatoryOptionIndex(0)
                        }}
                      >
                        <div className="relative">
                          <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white text-left flex items-center justify-between">
                            {(() => {
                              const selectedProduct = products.find(p => p.id === selectedProductId)
                              if (selectedProduct) {
                                return <span>{selectedProduct.name}</span>
                              }
                              return <span className="text-gray-500">Select fixed panel product...</span>
                            })()}
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </ListboxButton>
                          <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                            {fixedPanelProducts.map((product) => (
                              <ListboxOption
                                key={product.id}
                                value={product.id}
                                className="cursor-pointer select-none px-3 py-2 hover:bg-green-50 data-[selected]:bg-green-100 flex items-center justify-between"
                              >
                                {({ selected }) => (
                                  <>
                                    <span>{product.name}</span>
                                    {selected && <Check className="w-4 h-4 text-green-600" />}
                                  </>
                                )}
                              </ListboxOption>
                            ))}
                          </ListboxOptions>
                        </div>
                      </Listbox>
                    </div>

                    {/* Number of Panels */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Panels</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={multiPanelCountInput}
                        onChange={(e) => {
                          const value = e.target.value
                          // Allow empty or digits only
                          if (value !== '' && !/^\d+$/.test(value)) return
                          setMultiPanelCountInput(value)
                          // Update actual count if valid
                          if (value !== '') {
                            const count = parseInt(value)
                            if (!isNaN(count) && count >= 1 && count <= 10) {
                              setMultiPanelCount(count)
                              // Reset configs when count changes
                              setMultiPanelConfigs([])
                              setCurrentPanelIndex(0)
                              setFirstPanelOptionsComplete(false)
                            }
                          }
                        }}
                        onBlur={() => {
                          // Clamp value on blur
                          const count = parseInt(multiPanelCountInput) || 2
                          const clamped = Math.max(2, Math.min(10, count))
                          setMultiPanelCount(clamped)
                          setMultiPanelCountInput(String(clamped))
                          if (clamped !== multiPanelCount) {
                            setMultiPanelConfigs([])
                            setCurrentPanelIndex(0)
                            setFirstPanelOptionsComplete(false)
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Between 2 and 10 panels</p>
                    </div>

                    {/* Opening Size Info */}
                    {isFinishedOpening ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Opening Width Breakdown</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-blue-700">
                            <span>Total opening width:</span>
                            <span className="font-medium">{currentOpening?.finishedWidth}"</span>
                          </div>
                          <div className="flex justify-between text-blue-700">
                            <span>Used by existing panels:</span>
                            <span className="font-medium">{usedWidth.toFixed(2)}"</span>
                          </div>
                          <div className="flex justify-between text-blue-800 font-medium border-t border-blue-200 pt-1 mt-1">
                            <span>Remaining width:</span>
                            <span>{remainingWidth.toFixed(2)}"</span>
                          </div>
                          {remainingWidth > 0 && multiPanelCount > 0 && (
                            <div className="flex justify-between text-green-700 bg-green-100 -mx-4 px-4 py-2 mt-2 rounded-b-lg">
                              <span>Width per panel ({multiPanelCount} panels):</span>
                              <span className="font-medium">{widthPerPanel.toFixed(2)}"</span>
                            </div>
                          )}
                          {remainingWidth <= 0 && (
                            <p className="text-red-600 text-xs mt-2">No remaining space available for new panels</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-amber-800">
                          Opening size not determined. You'll specify dimensions in the next step.
                        </p>
                      </div>
                    )}

                    {/* Next button */}
                    {selectedProductId && (
                      <div className="flex justify-end pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            // Initialize multi-panel configs
                            const opening = project?.openings.find(o => o.id === selectedOpeningId)
                            const selectedProduct = products.find(p => p.id === selectedProductId)
                            const existingNonFramePanels = opening?.panels.filter(p =>
                              p.componentInstance?.product?.productType !== 'CORNER_90' &&
                              p.componentInstance?.product?.productType !== 'FRAME'
                            ) || []

                            // Calculate effective dimensions with product tolerances
                            const effectiveDims = getEffectiveFinishedDimensions(opening, selectedProduct)

                            const usedW = existingNonFramePanels.reduce((sum, p) => sum + (p.width || 0), 0)
                            const remainingW = (effectiveDims.width || 0) - usedW
                            let wPerPanel = multiPanelCount > 0 ? remainingW / multiPanelCount : 0

                            // Apply product width constraints to per-panel width
                            if (selectedProduct?.maxWidth && wPerPanel > selectedProduct.maxWidth) {
                              wPerPanel = selectedProduct.maxWidth
                            }
                            if (selectedProduct?.minWidth && wPerPanel < selectedProduct.minWidth) {
                              wPerPanel = selectedProduct.minWidth
                            }

                            // Calculate height: use existing panel height or effective finished height with tolerances
                            let defaultHeight = existingNonFramePanels.length > 0
                              ? Math.max(...existingNonFramePanels.map(p => p.height || 0))
                              : (effectiveDims.height || 0)

                            // Apply product height constraints
                            if (selectedProduct?.maxHeight && defaultHeight > selectedProduct.maxHeight) {
                              defaultHeight = selectedProduct.maxHeight
                            }
                            if (selectedProduct?.minHeight && defaultHeight < selectedProduct.minHeight) {
                              defaultHeight = selectedProduct.minHeight
                            }

                            const configs = Array.from({ length: multiPanelCount }, (_, i) => ({
                              index: i,
                              width: opening?.isFinishedOpening && effectiveDims.width ? wPerPanel : 0,
                              height: defaultHeight,
                              glassType: '',
                              selectedOptions: { ...addComponentSelectedOptions },
                              optionQuantities: { ...addComponentOptionQuantities },
                              variantSelections: { ...variantSelections },
                              isConfigured: false
                            }))
                            setMultiPanelConfigs(configs)
                            setCurrentPanelIndex(0)
                            setAddComponentStep('dimensions')
                          }}
                          disabled={remainingWidth <= 0 && isFinishedOpening}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          Next
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}
              {/* Dimensions - Hide for corner and frame components, and hide when past dimensions step */}
              {addComponentStep === 'dimensions' && (() => {
                const selectedProduct = products.find(p => p.id === selectedProductId)
                const isCornerProduct = selectedProduct?.productType === 'CORNER_90'
                const isFrameProduct = selectedProduct?.productType === 'FRAME'

                // Multi-panel mode dimensions view
                if (addComponentMode === 'multiple') {
                  const opening = project?.openings.find(o => o.id === selectedOpeningId)
                  const isFinishedOpening = !!(opening?.isFinishedOpening && opening?.finishedWidth)

                  return (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Copy className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-800">Panel Dimensions</span>
                          <span className="text-sm text-green-600">({multiPanelCount} panels)</span>
                        </div>

                        {isFinishedOpening ? (
                          <div className="space-y-3">
                            <p className="text-sm text-green-700 mb-3">
                              Dimensions auto-calculated from opening size. Each panel will be equal width.
                            </p>
                            <div className="bg-white rounded-lg border border-green-200 divide-y divide-green-100">
                              {multiPanelConfigs.map((config, idx) => (
                                <div key={idx} className="flex justify-between items-center px-4 py-2">
                                  <span className="text-sm font-medium text-gray-700">Panel {idx + 1}</span>
                                  <span className="text-sm text-gray-600">
                                    {config.width.toFixed(2)}" W × {config.height.toFixed(2)}" H
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                              Opening size not determined. Enter dimensions for the panels below.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Width (all panels)</label>
                                <input
                                  type="number"
                                  value={multiPanelConfigs[0]?.width || ''}
                                  onChange={(e) => {
                                    const newWidth = parseFloat(e.target.value) || 0
                                    setMultiPanelConfigs(prev => prev.map(c => ({ ...c, width: newWidth })))
                                  }}
                                  placeholder="Enter width"
                                  step="0.01"
                                  min="0"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Height (all panels)</label>
                                <input
                                  type="number"
                                  value={multiPanelConfigs[0]?.height || ''}
                                  onChange={(e) => {
                                    const newHeight = parseFloat(e.target.value) || 0
                                    setMultiPanelConfigs(prev => prev.map(c => ({ ...c, height: newHeight })))
                                  }}
                                  placeholder="Enter height"
                                  step="0.01"
                                  min="0"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Navigation buttons for multi-panel mode */}
                      <div className="flex justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setAddComponentStep('product')}
                          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddComponentStep('glassType')}
                          disabled={!multiPanelConfigs.every(c => c.width > 0 && c.height > 0)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          Next
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                }

                if (isCornerProduct) {
                  return (
                    <div className="space-y-4">
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
                  </div>
                )
              })()}


              {/* Wizard Step Navigation for Required Options */}
              {selectedProductId && (() => {
                const selectedProduct = products.find(p => p.id === selectedProductId)
                const isCornerProduct = selectedProduct?.productType === 'CORNER_90'
                const isFrameProduct = selectedProduct?.productType === 'FRAME'
                const showGlassType = selectedProduct?.productType !== 'FRAME'
                const hasDirection = ['SWING_DOOR', 'SLIDING_DOOR', 'CORNER_90'].includes(selectedProduct?.productType || '')
                // Get unique direction options from both plan views and elevation views
                const planViewNames = selectedProduct?.planViews?.map((v: any) => v.name) || []
                const elevationViewNames = selectedProduct?.elevationViews?.map((v: any) => v.name) || []
                const uniqueDirectionNames = [...new Set([...planViewNames, ...elevationViewNames])]
                const planViewOptions = uniqueDirectionNames.map((name, idx) => ({ id: idx, name }))
                const hasPlanViews = planViewOptions.length > 0
                // All options (mandatory and non-mandatory) shown in wizard flow, with required first
                const allOptions = [...addComponentOptions].sort((a: any, b: any) => {
                  if (a.isMandatory && !b.isMandatory) return -1
                  if (!a.isMandatory && b.isMandatory) return 1
                  return 0
                })

                // Get current direction value based on product type
                const getCurrentDirection = () => {
                  if (selectedProduct?.productType === 'SWING_DOOR') return swingDirection
                  if (selectedProduct?.productType === 'SLIDING_DOOR') return slidingDirection
                  if (selectedProduct?.productType === 'CORNER_90') return cornerDirection
                  return ''
                }
                const setCurrentDirection = (value: string) => {
                  if (selectedProduct?.productType === 'SWING_DOOR') setSwingDirection(value)
                  else if (selectedProduct?.productType === 'SLIDING_DOOR') setSlidingDirection(value)
                  else if (selectedProduct?.productType === 'CORNER_90') setCornerDirection(value)
                }

                // Check if dimensions are valid
                const dimensionsValid = isCornerProduct || isFrameProduct || (
                  componentWidth && parseFloat(componentWidth) > 0 &&
                  componentHeight && parseFloat(componentHeight) > 0 &&
                  componentValidationErrors.length === 0
                )

                // Check if direction is selected (or not needed)
                const directionSelected = !hasDirection || !hasPlanViews || getCurrentDirection() !== ''

                // Check if glass type is selected (or not needed)
                const glassTypeSelected = !showGlassType || glassType !== ''

                // Determine what steps are needed
                const needsDirection = hasDirection && hasPlanViews
                const needsGlassType = showGlassType
                const needsOptions = allOptions.length > 0

                // Helper function to auto-select option and set default quantity for RANGE mode
                // Only auto-selects for mandatory options; non-required options default to "None"
                const autoSelectOption = (optionIndex: number) => {
                  const option = allOptions[optionIndex]
                  if (!option) return

                  // Check if already selected
                  if (addComponentSelectedOptions[option.category.id] !== undefined) return

                  // Only auto-select for mandatory options
                  if (!option.isMandatory) return

                  // Auto-select: prefer standard option, otherwise first option
                  const optionToSelect = option.standardOptionId || option.category.individualOptions?.[0]?.id
                  if (optionToSelect) {
                    setAddComponentSelectedOptions(prev => ({
                      ...prev,
                      [option.category.id]: optionToSelect
                    }))

                    // Check if option has RANGE mode and set default quantity
                    const optionBom = selectedProduct?.productBOMs?.find(
                      (bom: any) => bom.optionId === optionToSelect
                    )
                    if (optionBom?.quantityMode === 'RANGE') {
                      const quantityKey = `${option.category.id}_qty`
                      setAddComponentOptionQuantities(prev => ({
                        ...prev,
                        [quantityKey]: optionBom.defaultQuantity || optionBom.minQuantity || 0
                      }))
                    }
                  }
                }

                // Navigation helper functions
                const goToNextStep = () => {
                  if (addComponentStep === 'dimensions') {
                    if (needsDirection) {
                      setAddComponentStep('direction')
                    } else if (needsGlassType) {
                      setAddComponentStep('glassType')
                    } else if (needsOptions) {
                      setAddComponentStep('options')
                      setCurrentMandatoryOptionIndex(0)
                      autoSelectOption(0)
                    } else {
                      setAddComponentStep('ready')
                    }
                  } else if (addComponentStep === 'direction') {
                    if (needsGlassType) {
                      setAddComponentStep('glassType')
                    } else if (needsOptions) {
                      setAddComponentStep('options')
                      setCurrentMandatoryOptionIndex(0)
                      autoSelectOption(0)
                    } else {
                      setAddComponentStep('ready')
                    }
                  } else if (addComponentStep === 'glassType') {
                    if (needsOptions) {
                      setAddComponentStep('options')
                      setCurrentMandatoryOptionIndex(0)
                      autoSelectOption(0)
                    } else {
                      setAddComponentStep('ready')
                    }
                  } else if (addComponentStep === 'options') {
                    if (currentMandatoryOptionIndex < allOptions.length - 1) {
                      const nextIndex = currentMandatoryOptionIndex + 1
                      setCurrentMandatoryOptionIndex(nextIndex)
                      autoSelectOption(nextIndex)
                    } else {
                      setAddComponentStep('ready')
                    }
                  }
                }

                const goToPreviousStep = () => {
                  if (addComponentStep === 'dimensions') {
                    setAddComponentStep('product')
                  } else if (addComponentStep === 'direction') {
                    setAddComponentStep('dimensions')
                  } else if (addComponentStep === 'glassType') {
                    if (needsDirection) {
                      setAddComponentStep('direction')
                    } else {
                      setAddComponentStep('dimensions')
                    }
                  } else if (addComponentStep === 'options') {
                    if (currentMandatoryOptionIndex > 0) {
                      setCurrentMandatoryOptionIndex(currentMandatoryOptionIndex - 1)
                    } else if (needsGlassType) {
                      setAddComponentStep('glassType')
                    } else if (needsDirection) {
                      setAddComponentStep('direction')
                    } else {
                      setAddComponentStep('dimensions')
                    }
                  } else if (addComponentStep === 'ready') {
                    if (needsOptions) {
                      setAddComponentStep('options')
                      setCurrentMandatoryOptionIndex(allOptions.length - 1)
                    } else if (needsGlassType) {
                      setAddComponentStep('glassType')
                    } else if (needsDirection) {
                      setAddComponentStep('direction')
                    } else {
                      setAddComponentStep('dimensions')
                    }
                  }
                }

                // Current option (if on options step)
                const currentOption = allOptions[currentMandatoryOptionIndex]

                return (
                  <>
                    {/* Step: Dimensions - Show Back/Next buttons for single mode only (multi-panel has its own) */}
                    {addComponentStep === 'dimensions' && addComponentMode !== 'multiple' && (
                      <div className="flex justify-between pt-2">
                        <button
                          type="button"
                          onClick={goToPreviousStep}
                          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={goToNextStep}
                          disabled={!dimensionsValid}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          Next
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Step 2: Opening Direction */}
                    {addComponentStep === 'direction' && needsDirection && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-medium">2</span>
                          <h4 className="text-sm font-semibold text-gray-800">Opening Direction</h4>
                        </div>
                        <Listbox
                          value={getCurrentDirection() || null}
                          onChange={(value: string | null) => setCurrentDirection(value || '')}
                        >
                          <div className="relative">
                            <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-left flex items-center justify-between">
                              {getCurrentDirection() ? (
                                <span>{getCurrentDirection()}</span>
                              ) : (
                                <span className="text-gray-500">Select opening direction...</span>
                              )}
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </ListboxButton>
                            <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                              {planViewOptions.map((planView: any) => (
                                <ListboxOption
                                  key={planView.id}
                                  value={planView.name}
                                  className="cursor-pointer select-none px-3 py-2 hover:bg-blue-50 data-[selected]:bg-blue-100 flex items-center justify-between"
                                >
                                  {({ selected }) => (
                                    <>
                                      <span>{planView.name}</span>
                                      {selected && <Check className="w-4 h-4 text-blue-600" />}
                                    </>
                                  )}
                                </ListboxOption>
                              ))}
                            </ListboxOptions>
                          </div>
                        </Listbox>
                        <div className="flex justify-between pt-2">
                          <button
                            type="button"
                            onClick={goToPreviousStep}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={goToNextStep}
                            disabled={getCurrentDirection() === ''}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            Next
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Glass Type for Multi-Panel Mode */}
                    {addComponentStep === 'glassType' && addComponentMode === 'multiple' && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-sm font-medium">2</span>
                          <h4 className="text-sm font-semibold text-gray-800">Glass Type (All Panels)</h4>
                        </div>
                        <p className="text-sm text-green-700">Select glass type for all {multiPanelCount} panels</p>
                        <Listbox
                          value={glassType || null}
                          onChange={(value: string | null) => {
                            setGlassType(value || '')
                            // Update all panel configs with the selected glass type
                            setMultiPanelConfigs(prev => prev.map(c => ({ ...c, glassType: value || '' })))
                          }}
                        >
                          <div className="relative">
                            <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white text-left flex items-center justify-between">
                              {(() => {
                                const selectedGlassType = glassTypes.find(t => t.name === glassType)
                                if (selectedGlassType) {
                                  return <span>{selectedGlassType.name} (${selectedGlassType.pricePerSqFt}/sqft)</span>
                                }
                                return <span className="text-gray-500">Select glass type...</span>
                              })()}
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </ListboxButton>
                            <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                              {glassTypes.map((type) => (
                                <ListboxOption
                                  key={type.id}
                                  value={type.name}
                                  className="cursor-pointer select-none px-3 py-2 hover:bg-green-50 data-[selected]:bg-green-100 flex items-center justify-between"
                                >
                                  {({ selected }) => (
                                    <>
                                      <span>{type.name} (${type.pricePerSqFt}/sqft)</span>
                                      {selected && <Check className="w-4 h-4 text-green-600" />}
                                    </>
                                  )}
                                </ListboxOption>
                              ))}
                            </ListboxOptions>
                          </div>
                        </Listbox>
                        <div className="flex justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => setAddComponentStep('dimensions')}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              // Move to options step if there are options, otherwise to ready
                              if (addComponentOptions.length > 0) {
                                setCurrentPanelIndex(0)
                                setCurrentMandatoryOptionIndex(0)
                                setFirstPanelOptionsComplete(false)
                                setAddComponentStep('options')
                              } else {
                                setAddComponentStep('ready')
                              }
                            }}
                            disabled={glassType === ''}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {addComponentOptions.length > 0 ? 'Configure Options' : 'Review'}
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Glass Type (Single Mode) */}
                    {addComponentStep === 'glassType' && addComponentMode !== 'multiple' && needsGlassType && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-medium">{needsDirection ? '3' : '2'}</span>
                          <h4 className="text-sm font-semibold text-gray-800">Glass Type</h4>
                        </div>
                        <Listbox
                          value={glassType || null}
                          onChange={(value: string | null) => setGlassType(value || '')}
                        >
                          <div className="relative">
                            <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-left flex items-center justify-between">
                              {(() => {
                                const selectedGlassType = glassTypes.find(t => t.name === glassType)
                                if (selectedGlassType) {
                                  return <span>{selectedGlassType.name} (${selectedGlassType.pricePerSqFt}/sqft)</span>
                                }
                                return <span className="text-gray-500">Select glass type...</span>
                              })()}
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </ListboxButton>
                            <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                              {glassTypes.map((type) => (
                                <ListboxOption
                                  key={type.id}
                                  value={type.name}
                                  className="cursor-pointer select-none px-3 py-2 hover:bg-blue-50 data-[selected]:bg-blue-100 flex items-center justify-between"
                                >
                                  {({ selected }) => (
                                    <>
                                      <span>{type.name} (${type.pricePerSqFt}/sqft)</span>
                                      {selected && <Check className="w-4 h-4 text-blue-600" />}
                                    </>
                                  )}
                                </ListboxOption>
                              ))}
                            </ListboxOptions>
                          </div>
                        </Listbox>
                        <div className="flex justify-between pt-2">
                          <button
                            type="button"
                            onClick={goToPreviousStep}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={goToNextStep}
                            disabled={glassType === ''}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            Next
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Multi-Panel Options - Apply to Remaining Dialog */}
                    {addComponentStep === 'options' && addComponentMode === 'multiple' && showApplyToRemaining && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Copy className="w-5 h-5 text-green-600" />
                          <h4 className="text-sm font-semibold text-green-800">Apply Options to Remaining Panels?</h4>
                        </div>
                        <p className="text-sm text-green-700">
                          You've configured Panel 1. Apply these options to the remaining {multiPanelCount - 1} panel{multiPanelCount > 2 ? 's' : ''}?
                        </p>

                        {/* Option categories to exclude */}
                        {addComponentOptions.length > 0 && (
                          <div className="bg-white rounded-lg border border-green-200 p-3">
                            <p className="text-xs font-medium text-gray-700 mb-2">Exclude these options (will need to configure individually):</p>
                            <div className="space-y-2">
                              {addComponentOptions.map((opt: any) => (
                                <label key={opt.category.id} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={excludedOptionsFromApply.has(opt.category.id)}
                                    onChange={(e) => {
                                      const newExcluded = new Set(excludedOptionsFromApply)
                                      if (e.target.checked) {
                                        newExcluded.add(opt.category.id)
                                      } else {
                                        newExcluded.delete(opt.category.id)
                                      }
                                      setExcludedOptionsFromApply(newExcluded)
                                    }}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  {opt.category.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              // Apply current options to all remaining panels (minus excluded)
                              setMultiPanelConfigs(prev => prev.map((config, idx) => {
                                if (idx === 0) return config // First panel already configured
                                const newOptions: Record<number, number | null> = {}
                                const newQuantities: Record<string, number> = {}
                                const newVariants: Record<string, number> = {}

                                // Copy options not in excluded list
                                for (const [key, value] of Object.entries(addComponentSelectedOptions)) {
                                  if (!excludedOptionsFromApply.has(Number(key))) {
                                    newOptions[Number(key)] = value
                                  }
                                }
                                for (const [key, value] of Object.entries(addComponentOptionQuantities)) {
                                  const categoryId = parseInt(key.replace('_qty', ''))
                                  if (!excludedOptionsFromApply.has(categoryId)) {
                                    newQuantities[key] = value
                                  }
                                }
                                for (const [key, value] of Object.entries(variantSelections)) {
                                  newVariants[key] = value
                                }

                                return {
                                  ...config,
                                  glassType,
                                  selectedOptions: newOptions,
                                  optionQuantities: newQuantities,
                                  variantSelections: newVariants,
                                  isConfigured: true
                                }
                              }))
                              // Also update first panel
                              setMultiPanelConfigs(prev => {
                                const updated = [...prev]
                                updated[0] = {
                                  ...updated[0],
                                  glassType,
                                  selectedOptions: { ...addComponentSelectedOptions },
                                  optionQuantities: { ...addComponentOptionQuantities },
                                  variantSelections: { ...variantSelections },
                                  isConfigured: true
                                }
                                return updated
                              })
                              setShowApplyToRemaining(false)
                              setAddComponentStep('ready')
                            }}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Apply to All Remaining
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              // Save first panel config and move to panel 2
                              setMultiPanelConfigs(prev => {
                                const updated = [...prev]
                                updated[0] = {
                                  ...updated[0],
                                  glassType,
                                  selectedOptions: { ...addComponentSelectedOptions },
                                  optionQuantities: { ...addComponentOptionQuantities },
                                  variantSelections: { ...variantSelections },
                                  isConfigured: true
                                }
                                return updated
                              })
                              setShowApplyToRemaining(false)
                              setCurrentPanelIndex(1)
                              setCurrentMandatoryOptionIndex(0)
                              // Pre-populate with first panel's options (for easier modification)
                              // Keep current selections as they are
                            }}
                            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Configure Each Individually
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 4+: Hardware Options (one at a time) */}
                    {addComponentStep === 'options' && currentOption && !showApplyToRemaining && (() => {
                      const selectedOptionId = addComponentSelectedOptions[currentOption.category.id]
                      const optionBom = selectedProduct?.productBOMs?.find(
                        (bom: any) => bom.optionId === selectedOptionId
                      )
                      const isRangeMode = optionBom?.quantityMode === 'RANGE'
                      const quantityKey = `${currentOption.category.id}_qty`

                      // Find selected option and check for variants
                      const selectedIndividualOption = selectedOptionId
                        ? currentOption.category.individualOptions?.find((opt: any) => opt.id === selectedOptionId)
                        : null
                      const optionVariants = selectedIndividualOption?.variants || []
                      const hasVariants = optionVariants.length > 0

                      // Multi-panel indicator
                      const isMultiPanelMode = addComponentMode === 'multiple'

                      return (
                        <div className={`p-4 rounded-lg border space-y-4 ${isMultiPanelMode ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                          {/* Multi-panel progress indicator */}
                          {isMultiPanelMode && (
                            <div className="flex items-center justify-between pb-2 border-b border-green-200 mb-2">
                              <div className="flex items-center gap-2">
                                <Copy className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-green-800">
                                  Configure Panel {currentPanelIndex + 1} of {multiPanelCount}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                {Array.from({ length: multiPanelCount }).map((_, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-2 h-2 rounded-full ${
                                      idx < currentPanelIndex ? 'bg-green-500' :
                                      idx === currentPanelIndex ? 'bg-green-600 ring-2 ring-green-300' :
                                      'bg-green-200'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-sm font-medium ${isMultiPanelMode ? 'bg-green-600' : 'bg-blue-600'}`}>
                                {(needsDirection ? 1 : 0) + (needsGlassType ? 1 : 0) + 2 + currentMandatoryOptionIndex}
                              </span>
                              <h4 className="text-sm font-semibold text-gray-800">{currentOption.category.name}</h4>
                              {currentOption.isMandatory && (
                                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Required</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {currentMandatoryOptionIndex + 1} of {allOptions.length}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Listbox
                              value={addComponentSelectedOptions[currentOption.category.id] || null}
                              onChange={(newValue: number | null) => {
                                if (newValue === null) {
                                  // Remove the selection (set to undefined by deleting key)
                                  const newOptions = { ...addComponentSelectedOptions }
                                  delete newOptions[currentOption.category.id]
                                  setAddComponentSelectedOptions(newOptions)
                                  // Also remove quantity if any
                                  const newQuantities = { ...addComponentOptionQuantities }
                                  delete newQuantities[quantityKey]
                                  setAddComponentOptionQuantities(newQuantities)
                                  // Clear variant selection for the old option
                                  if (selectedOptionId) {
                                    const newVariantSelections = { ...variantSelections }
                                    delete newVariantSelections[String(selectedOptionId)]
                                    setVariantSelections(newVariantSelections)
                                  }
                                } else {
                                  setAddComponentSelectedOptions({
                                    ...addComponentSelectedOptions,
                                    [currentOption.category.id]: newValue
                                  })
                                  // Clear old variant selection and auto-select default variant for new option
                                  const newVariantSelections = { ...variantSelections }
                                  if (selectedOptionId) {
                                    delete newVariantSelections[String(selectedOptionId)]
                                  }
                                  // Find the new option and check for default variant
                                  const newOption = currentOption.category.individualOptions?.find(
                                    (opt: any) => opt.id === newValue
                                  )
                                  if (newOption?.variants?.length > 0) {
                                    const defaultVariant = newOption.variants.find((v: any) => v.isDefault)
                                    if (defaultVariant) {
                                      newVariantSelections[String(newValue)] = defaultVariant.id
                                    }
                                  }
                                  setVariantSelections(newVariantSelections)
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
                                }
                              }}
                            >
                              <div className={`${isRangeMode || hasVariants ? 'flex-1' : 'w-full'} relative`}>
                                <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-left flex items-center justify-between">
                                  {(() => {
                                    const selectedOpt = currentOption.category.individualOptions?.find((opt: any) => opt.id === addComponentSelectedOptions[currentOption.category.id])
                                    if (selectedOpt) {
                                      return (
                                        <span className="flex items-center gap-2">
                                          {selectedOpt.name}
                                          {selectedOpt.id === currentOption.standardOptionId && (
                                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium">Standard</span>
                                          )}
                                        </span>
                                      )
                                    }
                                    return <span className="text-gray-500">Select {currentOption.category.name}...</span>
                                  })()}
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                </ListboxButton>
                                <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                  {currentOption.category.individualOptions?.map((opt: any) => (
                                    <ListboxOption
                                      key={opt.id}
                                      value={opt.id}
                                      className="cursor-pointer select-none px-3 py-2 hover:bg-blue-50 data-[selected]:bg-blue-100 flex items-center justify-between"
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className="flex items-center gap-2">
                                            {opt.name}
                                            {opt.id === currentOption.standardOptionId && (
                                              <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium">Standard</span>
                                            )}
                                          </span>
                                          {selected && <Check className="w-4 h-4 text-blue-600" />}
                                        </>
                                      )}
                                    </ListboxOption>
                                  ))}
                                </ListboxOptions>
                              </div>
                            </Listbox>
                            {isRangeMode && (
                              <Listbox
                                value={addComponentOptionQuantities[quantityKey] ?? (optionBom.defaultQuantity || optionBom.minQuantity || 0)}
                                onChange={(value: number) => {
                                  setAddComponentOptionQuantities({
                                    ...addComponentOptionQuantities,
                                    [quantityKey]: value
                                  })
                                }}
                              >
                                <div className="relative w-20">
                                  <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-left flex items-center justify-between">
                                    <span>{addComponentOptionQuantities[quantityKey] ?? (optionBom.defaultQuantity || optionBom.minQuantity || 0)}</span>
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  </ListboxButton>
                                  <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                    {Array.from(
                                      { length: (optionBom.maxQuantity || 4) - (optionBom.minQuantity || 0) + 1 },
                                      (_, i) => (optionBom.minQuantity || 0) + i
                                    ).map((qty) => (
                                      <ListboxOption
                                        key={qty}
                                        value={qty}
                                        className="cursor-pointer select-none px-3 py-2 hover:bg-blue-50 data-[selected]:bg-blue-100 flex items-center justify-between"
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span>{qty}</span>
                                            {selected && <Check className="w-4 h-4 text-blue-600" />}
                                          </>
                                        )}
                                      </ListboxOption>
                                    ))}
                                  </ListboxOptions>
                                </div>
                              </Listbox>
                            )}
                            {hasVariants && (
                              <Listbox
                                value={variantSelections[String(selectedOptionId)] || null}
                                onChange={(value: number | null) => {
                                  if (value === null) {
                                    const newVariantSelections = { ...variantSelections }
                                    delete newVariantSelections[String(selectedOptionId)]
                                    setVariantSelections(newVariantSelections)
                                  } else {
                                    setVariantSelections({
                                      ...variantSelections,
                                      [String(selectedOptionId)]: value
                                    })
                                  }
                                }}
                              >
                                <div className="relative w-40">
                                  <ListboxButton className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-purple-50 text-left flex items-center justify-between">
                                    {(() => {
                                      const selectedVariant = optionVariants.find((v: any) => v.id === variantSelections[String(selectedOptionId)])
                                      if (selectedVariant) {
                                        return (
                                          <span className="flex items-center gap-2">
                                            {selectedVariant.name}
                                            {selectedVariant.isDefault && (
                                              <span className="px-1.5 py-0.5 text-xs bg-purple-200 text-purple-700 rounded font-medium">Default</span>
                                            )}
                                          </span>
                                        )
                                      }
                                      return <span className="text-gray-500">Choose Variant...</span>
                                    })()}
                                    <ChevronDown className="w-4 h-4 text-purple-400" />
                                  </ListboxButton>
                                  <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-purple-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                    {optionVariants.map((variant: any) => (
                                      <ListboxOption
                                        key={variant.id}
                                        value={variant.id}
                                        className="cursor-pointer select-none px-3 py-2 hover:bg-purple-50 data-[selected]:bg-purple-100 flex items-center justify-between"
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span className="flex items-center gap-2">
                                              {variant.name}
                                              {variant.isDefault && (
                                                <span className="px-1.5 py-0.5 text-xs bg-purple-200 text-purple-700 rounded font-medium">Default</span>
                                              )}
                                            </span>
                                            {selected && <Check className="w-4 h-4 text-purple-600" />}
                                          </>
                                        )}
                                      </ListboxOption>
                                    ))}
                                  </ListboxOptions>
                                </div>
                              </Listbox>
                            )}
                          </div>
                          {isRangeMode && (
                            <p className="text-xs text-gray-500">
                              Select quantity ({optionBom.minQuantity}-{optionBom.maxQuantity})
                            </p>
                          )}
                          <div className="flex justify-between pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                // Multi-panel back button handling
                                if (isMultiPanelMode && currentMandatoryOptionIndex === 0 && currentPanelIndex > 0) {
                                  // Go back to previous panel's last option
                                  setCurrentPanelIndex(currentPanelIndex - 1)
                                  setCurrentMandatoryOptionIndex(allOptions.length - 1)
                                } else {
                                  goToPreviousStep()
                                }
                              }}
                              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                // Multi-panel next button handling
                                if (isMultiPanelMode) {
                                  if (currentMandatoryOptionIndex < allOptions.length - 1) {
                                    // More options to configure for this panel
                                    setCurrentMandatoryOptionIndex(currentMandatoryOptionIndex + 1)
                                  } else {
                                    // Finished all options for this panel
                                    if (currentPanelIndex === 0) {
                                      // First panel done - show Apply to Remaining dialog
                                      setFirstPanelOptionsComplete(true)
                                      setShowApplyToRemaining(true)
                                    } else if (currentPanelIndex < multiPanelCount - 1) {
                                      // Save current panel config and move to next panel
                                      setMultiPanelConfigs(prev => {
                                        const updated = [...prev]
                                        updated[currentPanelIndex] = {
                                          ...updated[currentPanelIndex],
                                          glassType,
                                          selectedOptions: { ...addComponentSelectedOptions },
                                          optionQuantities: { ...addComponentOptionQuantities },
                                          variantSelections: { ...variantSelections },
                                          isConfigured: true
                                        }
                                        return updated
                                      })
                                      setCurrentPanelIndex(currentPanelIndex + 1)
                                      setCurrentMandatoryOptionIndex(0)
                                    } else {
                                      // Last panel done - save and go to ready
                                      setMultiPanelConfigs(prev => {
                                        const updated = [...prev]
                                        updated[currentPanelIndex] = {
                                          ...updated[currentPanelIndex],
                                          glassType,
                                          selectedOptions: { ...addComponentSelectedOptions },
                                          optionQuantities: { ...addComponentOptionQuantities },
                                          variantSelections: { ...variantSelections },
                                          isConfigured: true
                                        }
                                        return updated
                                      })
                                      setAddComponentStep('ready')
                                    }
                                  }
                                } else {
                                  goToNextStep()
                                }
                              }}
                              disabled={
                                (currentOption.isMandatory && addComponentSelectedOptions[currentOption.category.id] === undefined) ||
                                (hasVariants && !variantSelections[String(selectedOptionId)])
                              }
                              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                                isMultiPanelMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {currentMandatoryOptionIndex < allOptions.length - 1 ? 'Next' :
                                isMultiPanelMode && currentPanelIndex === 0 ? 'Continue' :
                                isMultiPanelMode && currentPanelIndex < multiPanelCount - 1 ? `Panel ${currentPanelIndex + 2}` :
                                'Finish'}
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Ready step - Multi-panel mode summary */}
                    {addComponentStep === 'ready' && addComponentMode === 'multiple' && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Copy className="w-5 h-5 text-green-600" />
                          <h4 className="text-sm font-semibold text-green-800">Ready to Add {multiPanelCount} Panels</h4>
                        </div>
                        <div className="text-sm text-gray-700 space-y-2">
                          <p>Product: <span className="font-medium">{selectedProduct?.name}</span></p>
                          <p>Glass Type: <span className="font-medium">{glassType}</span></p>

                          {/* Panel breakdown */}
                          <div className="mt-3">
                            <p className="font-medium mb-2">Panel Summary:</p>
                            <div className="bg-white rounded-lg border border-green-200 divide-y divide-green-100 max-h-48 overflow-y-auto">
                              {multiPanelConfigs.map((config, idx) => (
                                <div key={idx} className="px-3 py-2">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-800">Panel {idx + 1}</span>
                                    <span className="text-gray-600 text-xs">
                                      {config.width.toFixed(2)}" W × {config.height.toFixed(2)}" H
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-start pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              // Go back to product step to restart
                              setAddComponentStep('product')
                              setCurrentPanelIndex(0)
                              setCurrentMandatoryOptionIndex(0)
                              setFirstPanelOptionsComplete(false)
                              setShowApplyToRemaining(false)
                            }}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Edit
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ready step - Single mode summary */}
                    {addComponentStep === 'ready' && addComponentMode !== 'multiple' && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <h4 className="text-sm font-semibold text-green-800">Ready to Add Component</h4>
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p>Product: <span className="font-medium">{selectedProduct?.name}</span></p>
                          {!isCornerProduct && !isFrameProduct && (
                            <p>Size: <span className="font-medium">{componentWidth}" W × {componentHeight}" H</span></p>
                          )}
                          {needsDirection && getCurrentDirection() && (
                            <p>Direction: <span className="font-medium">{getCurrentDirection()}</span></p>
                          )}
                          {needsGlassType && glassType && (
                            <p>Glass Type: <span className="font-medium">{glassType}</span></p>
                          )}
                          {allOptions.length > 0 && (
                            <div>
                              <p className="font-medium">Hardware Options:</p>
                              <ul className="ml-4 text-xs text-gray-600">
                                {allOptions.map((opt: any) => {
                                  const selectedValue = addComponentSelectedOptions[opt.category.id]
                                  const selectedOpt = selectedValue ? opt.category.individualOptions?.find((o: any) => o.id === selectedValue) : null
                                  const selectedOptName = selectedOpt?.name || 'Not selected'
                                  const quantityKey = `${opt.category.id}_qty`
                                  const optionBom = selectedProduct?.productBOMs?.find(
                                    (bom: any) => bom.optionId === selectedValue
                                  )
                                  const isRangeMode = optionBom?.quantityMode === 'RANGE'
                                  const quantity = addComponentOptionQuantities[quantityKey]
                                  // Get variant name if selected
                                  const selectedVariantId = selectedValue ? variantSelections[String(selectedValue)] : null
                                  const selectedVariant = selectedVariantId && selectedOpt?.variants?.find((v: any) => v.id === selectedVariantId)
                                  const variantName = selectedVariant?.name
                                  return (
                                    <li key={opt.id}>
                                      - {opt.category.name}: {selectedOptName}
                                      {variantName && ` - ${variantName}`}
                                      {isRangeMode && quantity !== undefined && ` (Qty: ${quantity})`}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-start pt-2">
                          <button
                            type="button"
                            onClick={() => setAddComponentStep('product')}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Edit
                          </button>
                        </div>
                      </div>
                    )}
                  </>
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
                  setComponentValidationErrors([])
                  setSwingDirection('')
                  setSlidingDirection('')
                  setCornerDirection('')
                  setGlassType('')
                  setHardwareOptionsExpanded(false)
                  setAddComponentOptions([])
                  setAddComponentSelectedOptions({})
                  setAddComponentOptionQuantities({})
                  // Reset wizard state
                  setAddComponentStep('product')
                  setCurrentMandatoryOptionIndex(0)
                  // Reset multi-panel state
                  setAddComponentMode(null)
                  setMultiPanelCount(2)
                  setMultiPanelCountInput('2')
                  setCurrentPanelIndex(0)
                  setMultiPanelConfigs([])
                  setFirstPanelOptionsComplete(false)
                  setShowApplyToRemaining(false)
                  setExcludedOptionsFromApply(new Set())
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addComponentMode === 'multiple' ? handleAddMultiplePanels : handleAddComponent}
                disabled={(() => {
                  // Multi-panel mode validation
                  if (addComponentMode === 'multiple') {
                    if (addComponentStep !== 'ready') return true
                    if (multiPanelConfigs.length === 0) return true
                    if (!multiPanelConfigs.every(c => c.width > 0 && c.height > 0)) return true
                    return false
                  }

                  // Single mode validation (existing logic)
                  if (!selectedProductId) return true
                  const selectedProduct = products.find(p => p.id === selectedProductId)
                  const isCorner = selectedProduct?.productType === 'CORNER_90'
                  const isFrame = selectedProduct?.productType === 'FRAME'

                  // Check mandatory options
                  const mandatoryOptions = addComponentOptions.filter((opt: any) => opt.isMandatory)
                  const missingMandatory = mandatoryOptions.filter((opt: any) =>
                    addComponentSelectedOptions[opt.category.id] === undefined
                  )
                  if (missingMandatory.length > 0) return true

                  // For corner and frame components, only product selection is required
                  if (isCorner || isFrame) return false

                  // For other components, wizard must be on 'ready' step
                  if (addComponentStep !== 'ready') return true

                  // Also verify dimensions and quantity are valid
                  const quantityValue = parseInt(componentQuantity)
                  const hasValidationErrors = componentValidationErrors.length > 0
                  return !componentWidth || !componentHeight ||
                         parseFloat(componentWidth) <= 0 ||
                         parseFloat(componentHeight) <= 0 ||
                         !quantityValue || quantityValue <= 0 ||
                         hasValidationErrors
                })()}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                  addComponentMode === 'multiple'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {addComponentMode === 'multiple' ? `Add ${multiPanelCount} Panels` : 'Add Component'}
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

                  // Find the selected individual option to check if it has variants
                  const selectedIndividualOption = selectedOptionIdNum
                    ? option.category.individualOptions?.find((opt: any) => opt.id === selectedOptionIdNum)
                    : null
                  const optionVariants = selectedIndividualOption?.variants || []
                  const hasVariants = optionVariants.length > 0

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
                        <Listbox
                          value={selectedOptions[option.category.id] === null ? 'none' : (selectedOptions[option.category.id] || null)}
                          onChange={(newValue: number | string | null) => {
                            const processedValue = newValue === 'none' ? null : (typeof newValue === 'number' ? newValue : undefined)
                            setSelectedOptions({
                              ...selectedOptions,
                              [option.category.id]: processedValue
                            })
                            // If unselecting an option, remove it from included list and clear variant selection
                            if (!processedValue && selectedOptions[option.category.id]) {
                              setIncludedOptions(includedOptions.filter(id => id !== selectedOptions[option.category.id]))
                              // Clear variant selection for the old option
                              const newVariantSelections = { ...variantSelections }
                              delete newVariantSelections[String(selectedOptions[option.category.id])]
                              setVariantSelections(newVariantSelections)
                            }
                            // If selecting a new option, set default variant if available
                            if (processedValue) {
                              const newIndividualOption = option.category.individualOptions?.find((opt: any) => opt.id === processedValue)
                              const newVariants = newIndividualOption?.variants || []
                              if (newVariants.length > 0) {
                                const defaultVariant = newVariants.find((v: any) => v.isDefault) || newVariants[0]
                                setVariantSelections({
                                  ...variantSelections,
                                  [String(processedValue)]: defaultVariant.id
                                })
                              }
                            }
                            // Check if new option has RANGE mode and set default quantity
                            const newOptionBom = editComponentProductBOMs?.find(
                              (bom: any) => bom.optionId === processedValue
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
                        >
                          <div className={`${isRangeMode || hasVariants ? 'flex-1' : 'w-full'} relative`}>
                            <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-left flex items-center justify-between">
                              {(() => {
                                if (selectedOptions[option.category.id] === null) {
                                  return <span className="text-gray-700">None (No hardware)</span>
                                }
                                const selectedOpt = option.category.individualOptions?.find((opt: any) => opt.id === selectedOptions[option.category.id])
                                if (selectedOpt) {
                                  return (
                                    <span className="flex items-center gap-2">
                                      {selectedOpt.name}
                                      {selectedOpt.id === option.standardOptionId && (
                                        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium">Standard</span>
                                      )}
                                    </span>
                                  )
                                }
                                return <span className="text-gray-500">Select {option.category.name}...</span>
                              })()}
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </ListboxButton>
                            <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                              <ListboxOption
                                value="none"
                                className="cursor-pointer select-none px-3 py-2 hover:bg-blue-50 data-[selected]:bg-blue-100 flex items-center justify-between"
                              >
                                {({ selected }) => (
                                  <>
                                    <span>None (No hardware)</span>
                                    {selected && <Check className="w-4 h-4 text-blue-600" />}
                                  </>
                                )}
                              </ListboxOption>
                              {option.category.individualOptions?.map((opt: any) => (
                                <ListboxOption
                                  key={opt.id}
                                  value={opt.id}
                                  className="cursor-pointer select-none px-3 py-2 hover:bg-blue-50 data-[selected]:bg-blue-100 flex items-center justify-between"
                                >
                                  {({ selected }) => (
                                    <>
                                      <span className="flex items-center gap-2">
                                        {opt.name}
                                        {opt.id === option.standardOptionId && (
                                          <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium">Standard</span>
                                        )}
                                      </span>
                                      {selected && <Check className="w-4 h-4 text-blue-600" />}
                                    </>
                                  )}
                                </ListboxOption>
                              ))}
                            </ListboxOptions>
                          </div>
                        </Listbox>
                        {hasVariants && (
                          <Listbox
                            value={variantSelections[String(selectedOptionIdNum)] || null}
                            onChange={(value: number | null) => {
                              if (value === null) {
                                const newVariantSelections = { ...variantSelections }
                                delete newVariantSelections[String(selectedOptionIdNum)]
                                setVariantSelections(newVariantSelections)
                              } else {
                                setVariantSelections({
                                  ...variantSelections,
                                  [String(selectedOptionIdNum)]: value
                                })
                              }
                            }}
                          >
                            <div className="relative w-40">
                              <ListboxButton className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-purple-50 text-left flex items-center justify-between">
                                {(() => {
                                  const selectedVariant = optionVariants.find((v: any) => v.id === variantSelections[String(selectedOptionIdNum)])
                                  if (selectedVariant) {
                                    return (
                                      <span className="flex items-center gap-2">
                                        {selectedVariant.name}
                                        {selectedVariant.isDefault && (
                                          <span className="px-1.5 py-0.5 text-xs bg-purple-200 text-purple-700 rounded font-medium">Default</span>
                                        )}
                                      </span>
                                    )
                                  }
                                  return <span className="text-gray-500">Choose Variant...</span>
                                })()}
                                <ChevronDown className="w-4 h-4 text-purple-400" />
                              </ListboxButton>
                              <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-purple-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                {optionVariants.map((variant: any) => (
                                  <ListboxOption
                                    key={variant.id}
                                    value={variant.id}
                                    className="cursor-pointer select-none px-3 py-2 hover:bg-purple-50 data-[selected]:bg-purple-100 flex items-center justify-between"
                                  >
                                    {({ selected }) => (
                                      <>
                                        <span className="flex items-center gap-2">
                                          {variant.name}
                                          {variant.isDefault && (
                                            <span className="px-1.5 py-0.5 text-xs bg-purple-200 text-purple-700 rounded font-medium">Default</span>
                                          )}
                                        </span>
                                        {selected && <Check className="w-4 h-4 text-purple-600" />}
                                      </>
                                    )}
                                  </ListboxOption>
                                ))}
                              </ListboxOptions>
                            </div>
                          </Listbox>
                        )}
                        {isRangeMode && (
                          <Listbox
                            value={editComponentOptionQuantities[quantityKey] ?? (optionBom.defaultQuantity || optionBom.minQuantity || 0)}
                            onChange={(value: number) => {
                              setEditComponentOptionQuantities({
                                ...editComponentOptionQuantities,
                                [quantityKey]: value
                              })
                            }}
                          >
                            <div className="relative w-20">
                              <ListboxButton className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white text-left flex items-center justify-between">
                                <span>{editComponentOptionQuantities[quantityKey] ?? (optionBom.defaultQuantity || optionBom.minQuantity || 0)}</span>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              </ListboxButton>
                              <ListboxOptions anchor="bottom start" className="z-50 mt-1 w-[var(--button-width)] bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                                {Array.from(
                                  { length: (optionBom.maxQuantity || 4) - (optionBom.minQuantity || 0) + 1 },
                                  (_, i) => (optionBom.minQuantity || 0) + i
                                ).map((qty) => (
                                  <ListboxOption
                                    key={qty}
                                    value={qty}
                                    className="cursor-pointer select-none px-3 py-2 hover:bg-blue-50 data-[selected]:bg-blue-100 flex items-center justify-between"
                                  >
                                    {({ selected }) => (
                                      <>
                                        <span>{qty}</span>
                                        {selected && <Check className="w-4 h-4 text-blue-600" />}
                                      </>
                                    )}
                                  </ListboxOption>
                                ))}
                              </ListboxOptions>
                            </div>
                          </Listbox>
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
                        includedOptions: includedOptions,
                        variantSelections: variantSelections
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
                    setVariantSelections({})
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
                                          {Number(component.panelWidth).toFixed(3)}" W × {Number(component.panelHeight).toFixed(3)}" H
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

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={() => {
                  setShowEditOpeningModal(false)
                  handleShowDeleteModal(editingOpeningId!, editingOpeningName)
                }}
                disabled={isUpdatingOpening}
                className="p-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
                title="Delete Opening"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <div className="flex space-x-2">
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

              {/* Warning if components exceed opening */}
              {sizeRedistributionData.totalComponentWidth > sizeRedistributionData.newWidth + 0.001 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                  <p className="text-sm text-amber-800 font-medium">
                    Components ({sizeRedistributionData.totalComponentWidth.toFixed(3)}") exceed the new opening width ({sizeRedistributionData.newWidth.toFixed(3)}").
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    You must select which components to reduce in size.
                  </p>
                </div>
              )}

              {/* Do Nothing Option */}
              {(() => {
                const componentsExceedOpening = sizeRedistributionData.totalComponentWidth > sizeRedistributionData.newWidth + 0.001
                return (
                  <label
                    className={`flex items-start p-4 border-2 rounded-lg transition-all ${
                      componentsExceedOpening
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                        : redistributionMethod === 'none'
                          ? 'border-blue-500 bg-blue-50 cursor-pointer'
                          : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="redistribution"
                      value="none"
                      checked={redistributionMethod === 'none'}
                      onChange={() => !componentsExceedOpening && setRedistributionMethod('none')}
                      disabled={componentsExceedOpening}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${componentsExceedOpening ? 'text-gray-500' : 'text-gray-900'}`}>
                        Do Nothing
                      </div>
                      <p className={`text-sm mt-1 ${componentsExceedOpening ? 'text-gray-400' : 'text-gray-600'}`}>
                        {componentsExceedOpening
                          ? 'Not available - components would not fit in the opening.'
                          : 'Keep component widths as-is. This may leave a gap in the opening.'
                        }
                      </p>
                    </div>
                  </label>
                )
              })()}

              {/* Adjust Selected Components Option */}
              <label
                className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  redistributionMethod === 'selected'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="redistribution"
                  value="selected"
                  checked={redistributionMethod === 'selected'}
                  onChange={() => setRedistributionMethod('selected')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Adjust Selected Components</div>
                  <p className="text-sm text-gray-600 mt-1">
                    The {sizeRedistributionData.widthDiff >= 0 ? 'added' : 'reduced'} {Math.abs(sizeRedistributionData.widthDiff).toFixed(3)}" will be distributed evenly between the selected components.
                  </p>
                  {redistributionMethod === 'selected' && (
                    <div className="mt-3 space-y-3">
                      {/* Component Checkboxes */}
                      <div className="space-y-2">
                        {sizeRedistributionData.panels.map((panel) => {
                          const isChecked = selectedPanelsForResize.includes(panel.id)
                          return (
                            <label
                              key={panel.id}
                              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                                isChecked
                                  ? 'border-blue-400 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPanelsForResize([...selectedPanelsForResize, panel.id])
                                  } else {
                                    setSelectedPanelsForResize(selectedPanelsForResize.filter(id => id !== panel.id))
                                  }
                                }}
                                className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="flex-1 text-sm text-gray-900">{panel.name}</span>
                              <span className="text-sm text-gray-500">{panel.width.toFixed(3)}" wide</span>
                            </label>
                          )
                        })}
                      </div>
                      {/* Select All / Clear All buttons */}
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPanelsForResize(sizeRedistributionData.panels.map(p => p.id))}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPanelsForResize([])}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Clear All
                        </button>
                      </div>
                      {/* Preview */}
                      {selectedPanelsForResize.length > 0 && (
                        <div className="p-3 bg-white rounded border border-blue-200">
                          <div className="text-xs font-medium text-gray-500 mb-2">Preview:</div>
                          <div className="space-y-1">
                            {sizeRedistributionData.panels.map((panel) => {
                              const isSelected = selectedPanelsForResize.includes(panel.id)
                              const widthChange = isSelected
                                ? sizeRedistributionData.widthDiff / selectedPanelsForResize.length
                                : 0
                              const newWidth = panel.width + widthChange
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
                  setRedistributionMethod('none')
                  setSelectedPanelsForResize([])
                }}
                disabled={isUpdatingOpening}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyRedistribution}
                disabled={isUpdatingOpening || (redistributionMethod === 'selected' && selectedPanelsForResize.length === 0)}
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
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Project is Locked
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              This project is in <strong>{project?.status === 'QUOTE_ACCEPTED' ? 'Quote Accepted' : project?.status}</strong> status and is locked for editing.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-700">
                You attempted to {pendingActionDescription}. To make changes, you can either:
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <GitBranch className="w-4 h-4 mr-2 text-amber-600" />
                  Create a Revision (Recommended)
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Creates a new editable copy while preserving this version as read-only history.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelQuoteAcceptedEdit}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleCancelQuoteAcceptedEdit()
                  handleCreateRevision()
                }}
                disabled={creatingRevision}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center"
              >
                {creatingRevision ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4 mr-2" />
                    Create Revision
                  </>
                )}
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