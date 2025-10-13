'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

// Direction constants matching SHOPGEN
const SWING_DIRECTIONS = ["Left In", "Right In", "Left Out", "Right Out"]
const SLIDING_DIRECTIONS = ["Left", "Right"]
const CORNER_DIRECTIONS = ["Up", "Up-Right", "Right", "Down-Right", "Down", "Down-Left", "Left", "Up-Left"]
import { ArrowLeft, Edit, Plus, Eye, Trash2, Settings, FileText, Download } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import DrawingViewer from '../ui/DrawingViewer'

interface Project {
  id: number
  name: string
  status: string
  extrusionCostingMethod?: string
  excludedPartNumbers?: string[]
  pricingModeId?: number | null
  taxRate?: number
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
  finishColor?: string
  price: number
  multiplier: number
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

export default function ProjectDetailView() {
  const { selectedProjectId, setSelectedProjectId } = useAppStore()
  const { toasts, removeToast, showSuccess, showError } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculatingPrices, setCalculatingPrices] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editExtrusionCostingMethod, setEditExtrusionCostingMethod] = useState('FULL_STOCK')
  const [editExcludedPartNumbers, setEditExcludedPartNumbers] = useState<string[]>([])
  const [editTaxRate, setEditTaxRate] = useState('0')
  const [editPricingModeId, setEditPricingModeId] = useState<number | null>(null)
  const [pricingModes, setPricingModes] = useState<any[]>([])
  const [showExcludedPartsModal, setShowExcludedPartsModal] = useState(false)
  const [projectParts, setProjectParts] = useState<any[]>([])
  const [loadingParts, setLoadingParts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddOpening, setShowAddOpening] = useState(false)
  const [addingOpening, setAddingOpening] = useState(false)
  const [newOpening, setNewOpening] = useState({
    name: '',
    quantity: '1',
    finishColor: ''
  })
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
  const [showComponentEdit, setShowComponentEdit] = useState(false)
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null)
  const [componentOptions, setComponentOptions] = useState<any[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number | null>>({})
  const [editingComponentWidth, setEditingComponentWidth] = useState<string>('')
  const [editingComponentHeight, setEditingComponentHeight] = useState<string>('')
  const [currentPanelId, setCurrentPanelId] = useState<number | null>(null)
  const [showBOM, setShowBOM] = useState(false)
  const [bomData, setBomData] = useState<any>(null)
  const [loadingBOM, setLoadingBOM] = useState(false)
  const [showDrawingViewer, setShowDrawingViewer] = useState(false)
  const [selectedDrawingOpeningId, setSelectedDrawingOpeningId] = useState<number | null>(null)
  const [selectedDrawingOpeningNumber, setSelectedDrawingOpeningNumber] = useState<string>('')
  const [glassTypes, setGlassTypes] = useState<any[]>([])
  const [needsSync, setNeedsSync] = useState(false)
  const [showSyncConfirmation, setShowSyncConfirmation] = useState(false)
  const [syncingPrices, setSyncingPrices] = useState(false)

  // Check if pricing needs sync
  useEffect(() => {
    if (project) {
      const needsSyncCheck = project.openings.some(opening => {
        const hasComponents = opening.panels.some(panel => panel.componentInstance)
        if (!hasComponents) return false

        // If price is zero or null, definitely needs sync
        if (opening.price === null || opening.price === 0) return true

        // If never calculated, needs sync
        if (!opening.priceCalculatedAt) return true

        // Check if any component's product BOM has been updated after price calculation
        const priceCalcTime = new Date(opening.priceCalculatedAt).getTime()

        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue

          const product = panel.componentInstance.product

          // Check if product BOMs were updated after price calculation
          const hasStaleProductBOM = product.productBOMs?.some((bom: any) => {
            const bomUpdateTime = new Date(bom.updatedAt).getTime()
            return bomUpdateTime > priceCalcTime
          })

          if (hasStaleProductBOM) return true
        }

        return false
      })

      setNeedsSync(needsSyncCheck)
    }
  }, [project])

  useEffect(() => {
    if (selectedProjectId) {
      fetchProject()
    }
  }, [selectedProjectId])

  useEffect(() => {
    fetchGlassTypes()
    fetchPricingModes()
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
      }
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
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

    // Check if costing method or excluded parts changed (which requires price recalculation)
    const costingMethodChanged = project?.extrusionCostingMethod !== editExtrusionCostingMethod
    const excludedPartsChanged = JSON.stringify(project?.excludedPartNumbers || []) !== JSON.stringify(editExcludedPartNumbers)
    const needsPriceRecalculation = costingMethodChanged || excludedPartsChanged

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
          extrusionCostingMethod: editExtrusionCostingMethod,
          excludedPartNumbers: editExcludedPartNumbers,
          pricingModeId: editPricingModeId,
          taxRate: parseFloat(editTaxRate)
        })
      })

      if (response.ok) {
        if (needsPriceRecalculation) {
          // Fetch the updated project data first
          const projectResponse = await fetch(`/api/projects/${selectedProjectId}`)
          if (projectResponse.ok) {
            const updatedProject = await projectResponse.json()

            // Recalculate all opening prices with the new settings
            await calculateAllOpeningPrices(updatedProject)

            showSuccess('Project updated and prices recalculated!')
          }
        } else {
          await fetchProject()
          showSuccess('Project updated successfully!')
        }
        setShowEditModal(false)
      }
    } catch (error) {
      console.error('Error updating project:', error)
      showError('Error updating project')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProject() {
    if (!selectedProjectId) return

    const confirmed = confirm(`Are you sure you want to delete the project "${project?.name}"? This action cannot be undone and will delete all openings and components.`)
    if (!confirmed) return

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        alert('Project deleted successfully!')
        setSelectedProjectId(null) // Navigate back to projects list
      } else {
        alert('Error deleting project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Error deleting project')
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

          // Refresh project one final time to show updated prices
          await fetchProject()

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

  async function fetchProjectParts() {
    if (!selectedProjectId) return

    setLoadingParts(true)
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/bom`)
      if (response.ok) {
        const data = await response.json()

        // Get unique extrusion parts from BOM
        const uniqueParts = new Map()
        data.bomItems?.forEach((item: any) => {
          if (item.partType === 'Extrusion' && item.partNumber) {
            // Use the part number as-is from the BOM (it should already be the base part number without finish codes)
            const partNumber = item.partNumber
            if (!uniqueParts.has(partNumber)) {
              uniqueParts.set(partNumber, {
                partNumber: partNumber,
                partName: item.partName,
                partType: item.partType
              })
            }
          }
        })

        setProjectParts(Array.from(uniqueParts.values()))
      }
    } catch (error) {
      console.error('Error fetching project parts:', error)
      showError('Failed to load project parts')
    } finally {
      setLoadingParts(false)
    }
  }

  async function handleAddOpening() {
    if (!selectedProjectId || !newOpening.name.trim() || !newOpening.finishColor) {
      showError('Opening number and finish color are required')
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
          quantity: parseInt(newOpening.quantity) || 1,
          finishColor: newOpening.finishColor
        })
      })

      if (response.ok) {
        // Reset form and close modal first
        setNewOpening({
          name: '',
          quantity: '1',
          finishColor: ''
        })
        setShowAddOpening(false)
        
        // Refetch project data to show the new opening
        try {
          await fetchProject()
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

  async function handleDeleteOpening(openingId: number) {
    if (!confirm('Are you sure you want to delete this opening? This will also delete all components in this opening.')) return
    
    try {
      const response = await fetch(`/api/openings/${openingId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchProject()
        alert('Opening deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting opening:', error)
      alert('Error deleting opening')
    }
  }

  function handleShowDrawings(openingId: number, name: string) {
    setSelectedDrawingOpeningId(openingId)
    setSelectedDrawingOpeningNumber(name)
    setShowDrawingViewer(true)
  }

  async function handleShowAddComponent(openingId: number) {
    setSelectedOpeningId(openingId)

    // Find the opening and check if it has existing panels
    const opening = project?.openings.find(o => o.id === openingId)
    if (opening && opening.panels && opening.panels.length > 0) {
      // Opening has existing panels - get height from first panel
      const existingHeight = opening.panels[0].height
      setComponentHeight(existingHeight.toString())
    } else {
      // First panel in opening - reset height
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

  async function handleAddComponent() {
    if (!selectedOpeningId || !selectedProductId) return
    
    const selectedProduct = products.find(p => p.id === selectedProductId)
    const isCorner = selectedProduct?.productType === 'CORNER_90'
    
    // Use default dimensions for corners, actual dimensions for other components
    const width = isCorner ? 1 : (parseFloat(componentWidth) || 0)
    const height = isCorner ? 1 : (parseFloat(componentHeight) || 0)
    
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
          glassType: glassType,
          locking: 'N/A',
          swingDirection: swingDirection,
          slidingDirection: slidingDirection,
          isCorner: isCorner,
          cornerDirection: cornerDirection
        })
      })

      if (panelResponse.ok) {
        const panelData = await panelResponse.json()
        
        // Then create the component instance
        const componentResponse = await fetch('/api/component-instances', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            panelId: panelData.id,
            productId: selectedProductId,
            subOptionSelections: {}
          })
        })

        if (componentResponse.ok) {
          setShowAddComponent(false)
          setSelectedOpeningId(null)
          setSelectedProductId(null)
          setComponentWidth('')
          setComponentHeight('')
          setSwingDirection('Right In')
          setSlidingDirection('Left')
          setGlassType('Clear')
          
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
          
          await fetchProject()
        }
      }
    } catch (error) {
      console.error('Error adding component:', error)
      alert('Error adding component')
    }
  }

  async function handleEditComponent(componentInstanceId: number) {
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
        
        // Fetch available options for this product
        const productResponse = await fetch(`/api/products/${componentData.productId}`)
        if (productResponse.ok) {
          const productData = await productResponse.json()
          setComponentOptions(productData.productSubOptions || [])
          setSelectedOptions(JSON.parse(componentData.subOptionSelections || '{}'))
          setShowComponentEdit(true)
        }
      }
    } catch (error) {
      console.error('Error fetching component details:', error)
      alert('Error fetching component details')
    }
  }

  async function handleDeleteComponent(panelId: number) {
    if (!confirm('Are you sure you want to delete this component?')) return
    
    try {
      // Get the panel info to find the opening ID for price recalculation
      const panel = project?.openings.flatMap(o => o.panels).find(p => p.id === panelId)
      const openingId = panel?.openingId || project?.openings.find(o => o.panels.some(p => p.id === panelId))?.id
      
      const response = await fetch(`/api/panels/${panelId}`, {
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
        
        await fetchProject()
      }
    } catch (error) {
      console.error('Error deleting component:', error)
      alert('Error deleting component')
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

  async function handleDownloadBOMCSV() {
    if (!selectedProjectId) return
    
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/bom/csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = 'project-bom.csv'
        if (contentDisposition && contentDisposition.includes('filename=')) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
        }
        
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        showSuccess('BOM CSV downloaded successfully!')
      } else {
        showError('Failed to download BOM CSV')
      }
    } catch (error) {
      console.error('Error downloading BOM CSV:', error)
      showError('Error downloading BOM CSV')
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

    setProject({ ...project, openings: updatedOpenings })

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
    } catch (error) {
      console.error('Error reordering panels:', error)
      showError('Failed to reorder components')
      // Revert on error
      await fetchProject()
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
          onClick={() => setSelectedProjectId(null)}
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
            onClick={() => setSelectedProjectId(null)}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
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
                  : 'bg-green-100 text-green-800'
              }`}>
                {project.status}
              </span>
              <span className="ml-4 text-gray-600">
                {project._count.openings} openings • Created {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setEditName(project.name)
              setEditStatus(project.status)
              setEditExtrusionCostingMethod(project.extrusionCostingMethod || 'FULL_STOCK')
              setEditExcludedPartNumbers(project.excludedPartNumbers || [])
              setEditPricingModeId(project.pricingModeId || null)
              setEditTaxRate((project.taxRate || 0).toString())
              setShowEditModal(true)
            }}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Project"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleShowBOM}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            title="View Bill of Materials"
          >
            <FileText className="w-4 h-4 mr-2" />
            View BOM
          </button>
          <button
            onClick={() => {
              const { setCurrentMenu } = useAppStore.getState()
              setCurrentMenu('quote')
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            title="Generate Quote"
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Quote
          </button>
          <button
            onClick={() => setShowAddOpening(true)}
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
                      <h3 className="font-bold text-gray-900">{opening.name}</h3>
                      {opening.finishColor && (
                        <span className={`px-2 py-1 text-sm font-bold rounded border ${getColorStyling(opening.finishColor)}`}>
                          {opening.finishColor}
                        </span>
                      )}
                      <span className="px-2 py-1 text-sm font-bold rounded border bg-green-600 text-white border-green-600">
                        ${opening.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleShowAddComponent(opening.id)}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center text-sm font-medium shadow-sm transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Component
                      </button>
                      <button
                        onClick={() => handleShowDrawings(opening.id, opening.name)}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center text-sm font-medium shadow-sm transition-colors"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Shop Drawings
                      </button>
                    </div>
                  </div>
                  {opening.roughWidth && opening.roughHeight && (
                    <p className="text-sm text-gray-600">
{`${opening.roughWidth}" W × ${opening.roughHeight}" H (Rough)`}
                    </p>
                  )}
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
                                <span className={`px-2 py-1 rounded-full ${
                                  (panel.componentInstance!.product as any).withTrim === 'With Trim' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {(panel.componentInstance!.product as any).withTrim}
                                </span>
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
                                onClick={() => handleDeleteComponent(panel.id)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={newOpening.quantity}
                  onChange={(e) => setNewOpening({...newOpening, quantity: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Finish Color *</label>
                <select
                  value={newOpening.finishColor}
                  onChange={(e) => setNewOpening({...newOpening, finishColor: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                >
                  <option value="">Select finish color</option>
                  <option value="Black">Black (-BL)</option>
                  <option value="Clear">Clear (-C2)</option>
                  <option value="Other">Other</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Used for extrusion part number suffixes in BOMs
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
                      quantity: '1',
                      finishColor: ''
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
                disabled={addingOpening || !newOpening.name.trim() || !newOpening.finishColor}
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

                    // Set default direction to first plan view name if available
                    const product = products.find(p => p.id === productId)
                    if (product?.planViews && product.planViews.length > 0) {
                      const firstPlanViewName = product.planViews[0].name
                      if (product.productType === 'SWING_DOOR') {
                        setSwingDirection(firstPlanViewName)
                      } else if (product.productType === 'SLIDING_DOOR') {
                        setSlidingDirection(firstPlanViewName)
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productType === 'CORNER_90' ? '90° Corner' : `${product.name} (${product.withTrim})`}
                    </option>
                  ))}
                </select>
              </div>
              {/* Dimensions - Hide for corner components */}
              {(() => {
                const selectedProduct = products.find(p => p.id === selectedProductId)
                const isCornerProduct = selectedProduct?.productType === 'CORNER_90'
                
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
                          return opening && opening.panels && opening.panels.length > 0
                        })()}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                          (() => {
                            const opening = project?.openings.find(o => o.id === selectedOpeningId)
                            const isDisabled = opening && opening.panels && opening.panels.length > 0
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
              
              {/* Direction Selection - Show for Swing, Sliding, and Corner */}
              {selectedProductId && (() => {
                const selectedProduct = products.find(p => p.id === selectedProductId)
                const availablePlanViews = selectedProduct?.planViews || []
                const planViewNames = availablePlanViews.map((pv: any) => pv.name)

                if (selectedProduct?.productType === 'SWING_DOOR') {
                  // Only show if product has plan views
                  if (planViewNames.length === 0) {
                    return null
                  }
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Swing Direction</label>
                      <select
                        value={swingDirection}
                        onChange={(e) => setSwingDirection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      >
                        {planViewNames.map((direction: string) => (
                          <option key={direction} value={direction}>
                            {direction}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                } else if (selectedProduct?.productType === 'SLIDING_DOOR') {
                  // Only show if product has plan views
                  if (planViewNames.length === 0) {
                    return null
                  }
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sliding Direction</label>
                      <select
                        value={slidingDirection}
                        onChange={(e) => setSlidingDirection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      >
                        {planViewNames.map((direction: string) => (
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Corner Direction</label>
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
              
              {/* Glass Type Selection - Show for all components */}
              {selectedProductId && (
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
                  setSwingDirection('Right In')
                  setSlidingDirection('Left')
                  setGlassType('Clear')
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
                  
                  // For corner components, only product selection is required
                  if (isCorner) return false
                  
                  // For other components, dimensions are required
                  return !componentWidth || !componentHeight || parseFloat(componentWidth) <= 0 || parseFloat(componentHeight) <= 0
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

            {/* Options Section */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-700">Product Options</h3>
              {componentOptions.length > 0 ? (
                componentOptions.map((option) => (
                  <div key={option.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {option.category.name}
                    </label>
                    {option.category.description && (
                      <p className="text-xs text-gray-500 mb-2">{option.category.description}</p>
                    )}
                    <select
                      value={selectedOptions[option.category.id] || ''}
                      onChange={(e) => setSelectedOptions({
                        ...selectedOptions,
                        [option.category.id]: e.target.value ? parseInt(e.target.value) : null
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    >
                      <option value="">Select option...</option>
                      {option.category.individualOptions?.map((individualOption: any) => (
                        <option key={individualOption.id} value={individualOption.id}>
                          {individualOption.name}
                          {individualOption.price > 0 && ` (+$${individualOption.price})`}
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
                  setEditingComponentWidth('')
                  setEditingComponentHeight('')
                  setCurrentPanelId(null)
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
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
                  
                  try {
                    // Update panel dimensions first
                    const panelResponse = await fetch(`/api/panels/${currentPanelId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        width: width,
                        height: height
                      })
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
                        subOptionSelections: selectedOptions
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

                    // Fetch updated project data
                    await fetchProject()

                  } catch (error) {
                    console.error('Error updating component:', error)
                    showError('Error updating component')
                  }

                  setShowComponentEdit(false)
                  setSelectedComponentId(null)
                  setSelectedOptions({})
                  setEditingComponentWidth('')
                  setEditingComponentHeight('')
                  setCurrentPanelId(null)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
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
                  <option value="Draft">Draft</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing Mode
                </label>
                <select
                  value={editPricingModeId || ''}
                  onChange={(e) => setEditPricingModeId(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                >
                  <option value="">No pricing mode</option>
                  {pricingModes.map((mode) => {
                    // Build description based on what markups are set
                    const parts = []
                    if (mode.extrusionMarkup > 0 || mode.hardwareMarkup > 0 || mode.glassMarkup > 0) {
                      const categoryParts = []
                      if (mode.extrusionMarkup > 0) categoryParts.push(`E:${mode.extrusionMarkup}%`)
                      if (mode.hardwareMarkup > 0) categoryParts.push(`H:${mode.hardwareMarkup}%`)
                      if (mode.glassMarkup > 0) categoryParts.push(`G:${mode.glassMarkup}%`)
                      parts.push(categoryParts.join(', '))
                    } else if (mode.markup > 0) {
                      parts.push(`+${mode.markup}%`)
                    }
                    if (mode.discount > 0) parts.push(`-${mode.discount}%`)

                    const description = parts.length > 0 ? ` (${parts.join(', ')})` : ''
                    return (
                      <option key={mode.id} value={mode.id}>
                        {mode.name}{description}
                      </option>
                    )
                  })}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Pricing mode applies markup and discount to quotes
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={editTaxRate}
                  onChange={(e) => setEditTaxRate(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Pre-populated based on delivery address, but can be overwritten
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extrusion Costing Method
                </label>
                <select
                  value={editExtrusionCostingMethod}
                  onChange={(e) => setEditExtrusionCostingMethod(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                >
                  <option value="FULL_STOCK">Full Stock Cost</option>
                  <option value="PERCENTAGE_BASED">Percentage-Based Cost</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {editExtrusionCostingMethod === 'PERCENTAGE_BASED'
                    ? 'Only charge for % of stock used when >50% remains unused'
                    : 'Always charge for the full stock length'}
                </p>
                {editExtrusionCostingMethod === 'FULL_STOCK' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcludedPartsModal(true)
                      fetchProjectParts()
                    }}
                    disabled={saving}
                    className="mt-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Exclude Parts ({editExcludedPartNumbers.length})
                  </button>
                )}
              </div>

              {/* Openings Management */}
              {project && project.openings.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Openings ({project.openings.length})
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                    {project.openings.map((opening) => (
                      <div key={opening.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{opening.name}</span>
                          <div className="text-xs text-gray-500">
                            {opening.panels.filter(p => p.componentInstance).length} components • ${opening.price.toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteOpening(opening.id)}
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
                onClick={handleDeleteProject}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Confirmation Modal */}
      {showSyncConfirmation && project && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sync All Pricing?</h2>
            <p className="text-gray-600 mb-6">
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
                    await fetchProject()
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

      {/* Excluded Parts Modal */}
      {showExcludedPartsModal && project && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Exclude Expensive Parts from Full Stock Cost</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select parts that should use percentage-based costing even when the project uses "Full Stock Cost" method.
              This is useful for expensive extrusions where you want to charge only for the percentage used.
            </p>

            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
              {loadingParts ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : projectParts.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {projectParts.map((part) => {
                    const isExcluded = editExcludedPartNumbers.includes(part.partNumber)
                    return (
                      <div key={part.partNumber} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-mono text-sm font-medium text-gray-900">{part.partNumber}</div>
                          <div className="text-sm text-gray-600">{part.partName}</div>
                        </div>
                        <button
                          onClick={() => {
                            if (isExcluded) {
                              setEditExcludedPartNumbers(editExcludedPartNumbers.filter(p => p !== part.partNumber))
                            } else {
                              setEditExcludedPartNumbers([...editExcludedPartNumbers, part.partNumber])
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            isExcluded ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isExcluded ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No extrusion parts found in this project.
                  <br />
                  <span className="text-xs">Add components to your openings to see parts here.</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowExcludedPartsModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Done
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
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Bill of Materials</h2>
                <p className="text-gray-600 mt-1">{project?.name}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDownloadBOMCSV}
                  disabled={loadingBOM || !bomData}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </button>
                <button
                  onClick={() => {
                    setShowBOM(false)
                    setBomData(null)
                  }}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6">
              {loadingBOM ? (
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
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Color</th>
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
                                            <td className="border border-gray-200 px-3 py-2 text-sm">
                                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                item.color === 'Black' 
                                                  ? 'bg-gray-800 text-white'
                                                  : item.color === 'Clear'
                                                  ? 'bg-blue-100 text-blue-800'
                                                  : item.color === 'Other'
                                                  ? 'bg-gray-100 text-gray-800'
                                                  : 'bg-gray-50 text-gray-600'
                                              }`}>
                                                {item.color}
                                              </span>
                                            </td>
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
    </div>
  )
}