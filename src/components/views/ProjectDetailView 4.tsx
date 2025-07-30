'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Edit, Plus, Eye, Trash2, Settings, FileText, Download } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'

interface Project {
  id: number
  name: string
  status: string
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
  componentInstance?: {
    id: number
    product: {
      id: number
      name: string
      type: string
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

export default function ProjectDetailView() {
  const { selectedProjectId, setSelectedProjectId } = useAppStore()
  const { toasts, removeToast, showSuccess, showError } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddOpening, setShowAddOpening] = useState(false)
  const [addingOpening, setAddingOpening] = useState(false)
  const [newOpening, setNewOpening] = useState({
    openingNumber: '',
    quantity: '1',
    finishColor: ''
  })
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [selectedOpeningId, setSelectedOpeningId] = useState<number | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [componentWidth, setComponentWidth] = useState<string>('')
  const [componentHeight, setComponentHeight] = useState<string>('')
  const [showComponentEdit, setShowComponentEdit] = useState(false)
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null)
  const [componentOptions, setComponentOptions] = useState<any[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number | null>>({})
  const [showBOM, setShowBOM] = useState(false)
  const [bomData, setBomData] = useState<any>(null)
  const [loadingBOM, setLoadingBOM] = useState(false)

  useEffect(() => {
    if (selectedProjectId) {
      fetchProject()
    }
  }, [selectedProjectId])

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
        
        // Calculate prices for all openings
        await calculateAllOpeningPrices(projectData)
      }
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
    }
  }

  async function calculateAllOpeningPrices(projectData: Project) {
    // Calculate prices for all openings that have components
    for (const opening of projectData.openings) {
      if (opening.panels.some(panel => panel.componentInstance)) {
        try {
          await fetch(`/api/openings/${opening.id}/calculate-price`, {
            method: 'POST'
          })
        } catch (error) {
          console.error(`Error calculating price for opening ${opening.id}:`, error)
        }
      }
    }
    
    // Refetch the project data to get updated prices
    if (projectData.openings.some(opening => opening.panels.some(panel => panel.componentInstance))) {
      try {
        const response = await fetch(`/api/projects/${selectedProjectId}`)
        if (response.ok) {
          const updatedProjectData = await response.json()
          setProject(updatedProjectData)
        }
      } catch (error) {
        console.error('Error refetching project after price calculation:', error)
      }
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
          status: editStatus
        })
      })

      if (response.ok) {
        await fetchProject()
        setShowEditModal(false)
        alert('Project updated successfully!')
      }
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Error updating project')
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

  async function handleAddOpening() {
    if (!selectedProjectId || !newOpening.openingNumber.trim() || !newOpening.finishColor) {
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
          openingNumber: newOpening.openingNumber,
          quantity: parseInt(newOpening.quantity) || 1,
          finishColor: newOpening.finishColor
        })
      })

      if (response.ok) {
        // Reset form and close modal first
        setNewOpening({
          openingNumber: '',
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

  async function handleShowAddComponent(openingId: number) {
    setSelectedOpeningId(openingId)
    
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
    
    const width = parseFloat(componentWidth) || 0
    const height = parseFloat(componentHeight) || 0
    
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
          glassType: 'N/A',
          locking: 'N/A',
          swingDirection: 'None'
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
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
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
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-gray-900">Opening {opening.name}</h3>
                    {opening.finishColor && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-sm rounded border border-blue-200">
                        {opening.finishColor}
                      </span>
                    )}
                    <span className="text-lg font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                      ${opening.price.toLocaleString()}
                    </span>
                  </div>
                  {opening.roughWidth && opening.roughHeight && (
                    <p className="text-sm text-gray-600">
{`${opening.roughWidth}" W × ${opening.roughHeight}" H (Rough)`}
                    </p>
                  )}
                </div>
                
                {/* Components */}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Components ({opening.panels.filter(p => p.componentInstance).length})</h4>
                    <button
                      onClick={() => handleShowAddComponent(opening.id)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center font-medium shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Component
                    </button>
                  </div>
                  {opening.panels.filter(p => p.componentInstance).length > 0 ? (
                    <div className="space-y-2">
                      {opening.panels.filter(p => p.componentInstance).map((panel) => (
                        <div key={panel.id} className="text-sm bg-gray-50 rounded p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-blue-600 cursor-pointer hover:text-blue-800"
                                   onClick={() => handleEditComponent(panel.componentInstance!.id)}>
                                {panel.componentInstance!.product.name}
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
                              </div>
                              <div className="text-gray-500 text-xs">
                                {panel.width}" W × {panel.height}" H
                              </div>
                              {/* Glass Type Display */}
                              {panel.glassType && panel.glassType !== 'N/A' && (
                                <div className="text-gray-500 text-xs mt-1">
                                  <div className="pl-2 border-l-2 border-gray-200">
                                    Glass: {panel.glassType}
                                  </div>
                                </div>
                              )}
                              {panel.componentInstance!.subOptionSelections && 
                               panel.componentInstance!.subOptionSelections !== '{}' && (
                                <div className="text-gray-500 text-xs mt-1">
                                  {(() => {
                                    try {
                                      const selections = JSON.parse(panel.componentInstance!.subOptionSelections)
                                      const product = panel.componentInstance!.product
                                      const optionLabels: string[] = []
                                      
                                      console.log('Selections:', selections)
                                      console.log('Product sub options:', product.productSubOptions)
                                      
                                      Object.entries(selections).forEach(([categoryId, optionId]) => {
                                        console.log(`Processing category ${categoryId}, option ${optionId}`)
                                        if (optionId) {
                                          // Find the category and option
                                          const productOption = product.productSubOptions?.find(pso => 
                                            pso.category.id === parseInt(categoryId)
                                          )
                                          console.log('Found product option:', productOption)
                                          if (productOption) {
                                            const individualOption = productOption.category.individualOptions?.find((opt: any) => 
                                              opt.id === optionId
                                            )
                                            console.log('Found individual option:', individualOption)
                                            if (individualOption) {
                                              optionLabels.push(`${productOption.category.name}: ${individualOption.name}`)
                                            }
                                          }
                                        }
                                      })
                                      
                                      console.log('Final option labels:', optionLabels)
                                      return optionLabels.length > 0 ? optionLabels.join(', ') : 'Options configured'
                                    } catch (e) {
                                      console.error('Error parsing options:', e)
                                      return 'Options configured'
                                    }
                                  })()}
                                </div>
                              )}
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
                      ))}
                    </div>
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
                  value={newOpening.openingNumber}
                  onChange={(e) => setNewOpening({...newOpening, openingNumber: e.target.value})}
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
                      openingNumber: '',
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
                disabled={addingOpening || !newOpening.openingNumber.trim() || !newOpening.finishColor}
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
                  onChange={(e) => setSelectedProductId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.withTrim})
                    </option>
                  ))}
                </select>
              </div>
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
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                      componentHeight && parseFloat(componentHeight) <= 0 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-300'
                    }`}
                  />
                  {componentHeight && parseFloat(componentHeight) <= 0 && (
                    <p className="text-red-500 text-xs mt-1">Height must be greater than 0</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-6">
              <button
                onClick={() => {
                  setShowAddComponent(false)
                  setSelectedOpeningId(null)
                  setSelectedProductId(null)
                  setComponentWidth('')
                  setComponentHeight('')
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComponent}
                disabled={!selectedProductId || !componentWidth || !componentHeight || parseFloat(componentWidth) <= 0 || parseFloat(componentHeight) <= 0}
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Component Options</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
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
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedComponentId) return
                  
                  try {
                    const response = await fetch(`/api/components/${selectedComponentId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        subOptionSelections: selectedOptions
                      })
                    })

                    if (response.ok) {
                      showSuccess('Component options saved successfully!')
                      await fetchProject()
                      if (project) {
                        await calculateAllOpeningPrices(project)
                      }
                    } else {
                      showError('Error saving component options')
                    }
                  } catch (error) {
                    console.error('Error saving component options:', error)
                    showError('Error saving component options')
                  }

                  setShowComponentEdit(false)
                  setSelectedComponentId(null)
                  setSelectedOptions({})
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Options
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
                          <span className="text-sm font-medium text-gray-900">Opening {opening.name}</span>
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
            <div className="flex justify-between items-center pt-6">
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
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Cut Length / Glass Size</th>
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
    </div>
  )
}