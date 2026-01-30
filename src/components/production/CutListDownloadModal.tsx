'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Download, Scissors, ChevronRight } from 'lucide-react'
import { useDownloadStore } from '@/stores/downloadStore'

interface CutListItem {
  productName: string
  sizeKey: string
  unitCount: number
  qtyPerUnit: number
  totalQty: number
  partNumber: string
  partName: string
  cutLength: number | null
  stockLength: number | null
  color: string
  isMilled: boolean
  binLocation: string | null
}

interface ProductGroup {
  productName: string
  sizeKey: string
  unitCount: number
  uniqueCuts: number
  partsPerUnit: number
  totalParts: number
  batchSize: number
}

interface ProjectData {
  projectId: number
  projectName: string
  productGroups: ProductGroup[]
  loading: boolean
  error: string | null
}

// Config type for passing configuration back to parent
export interface CutListConfigData {
  projectId: number
  projectName: string
  format?: 'csv' | 'pdf'
  groups: Array<{
    productName: string
    sizeKey: string
    batchSize: number
  }>
}

interface CutListDownloadModalProps {
  projects: Array<{ id: number; name: string; batchSize?: number | null }>
  defaultBatchSize?: number | null  // Global default from production settings
  format?: 'csv' | 'pdf'  // Output format, defaults to 'csv'
  onClose: () => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
  // Configure mode - don't download, just pass configuration back
  onConfigure?: (configs: CutListConfigData[]) => void
  hasMoreModals?: boolean  // If true, shows "Next" instead of "Finish"
}

export default function CutListDownloadModal({
  projects,
  defaultBatchSize,
  format = 'csv',
  onClose,
  showError,
  showSuccess,
  onConfigure,
  hasMoreModals
}: CutListDownloadModalProps) {
  console.log('[CutListDownloadModal] Opened with format:', format)
  const [projectsData, setProjectsData] = useState<ProjectData[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const { startDownload, updateProgress, completeDownload, failDownload } = useDownloadStore()

  // Configure mode: don't download, just collect configurations
  const isConfigureMode = !!onConfigure

  useEffect(() => {
    fetchAllCutListData()
  }, [projects])

  async function fetchAllCutListData() {
    setLoading(true)

    const initialData: ProjectData[] = projects.map(p => ({
      projectId: p.id,
      projectName: p.name,
      productGroups: [],
      loading: true,
      error: null
    }))
    setProjectsData(initialData)

    const results = await Promise.all(
      projects.map(async (project) => {
        try {
          const response = await fetch(`/api/projects/${project.id}/bom?cutlist=true&format=json`)
          if (!response.ok) {
            throw new Error('Failed to fetch cut list data')
          }
          const data = await response.json()

          // Group cut list items by product + size
          const cutListItems: CutListItem[] = data.cutListItems || []
          const groupMap = new Map<string, ProductGroup>()

          // Priority: project batch size > global default > all units
          const projectBatchSize = project.batchSize

          for (const item of cutListItems) {
            const key = `${item.productName}|${item.sizeKey}`
            if (!groupMap.has(key)) {
              // Determine batch size: project > global default > all units
              let effectiveBatchSize = item.unitCount
              if (projectBatchSize && projectBatchSize <= item.unitCount) {
                effectiveBatchSize = projectBatchSize
              } else if (defaultBatchSize && defaultBatchSize <= item.unitCount) {
                effectiveBatchSize = defaultBatchSize
              }
              groupMap.set(key, {
                productName: item.productName,
                sizeKey: item.sizeKey,
                unitCount: item.unitCount,
                uniqueCuts: 0,
                partsPerUnit: 0,
                totalParts: 0,
                batchSize: effectiveBatchSize
              })
            }
            const group = groupMap.get(key)!
            group.uniqueCuts += 1
            group.partsPerUnit += item.qtyPerUnit
            group.totalParts += item.totalQty
          }

          return {
            projectId: project.id,
            projectName: project.name,
            productGroups: Array.from(groupMap.values()),
            loading: false,
            error: null
          }
        } catch (error) {
          console.error(`Error fetching cut list for project ${project.id}:`, error)
          return {
            projectId: project.id,
            projectName: project.name,
            productGroups: [],
            loading: false,
            error: 'Failed to load cut list data'
          }
        }
      })
    )

    setProjectsData(results)
    setLoading(false)
  }

  function updateBatchSize(projectId: number, productName: string, sizeKey: string, newBatchSize: number) {
    setProjectsData(prev => prev.map(pd => {
      if (pd.projectId !== projectId) return pd
      return {
        ...pd,
        productGroups: pd.productGroups.map(pg => {
          if (pg.productName !== productName || pg.sizeKey !== sizeKey) return pg
          return { ...pg, batchSize: Math.max(1, Math.min(newBatchSize, pg.unitCount)) }
        })
      }
    }))
  }

  async function handleAction() {
    // In configure mode, just pass the configuration back
    if (isConfigureMode) {
      const configs: CutListConfigData[] = projectsData
        .filter(pd => !pd.error && pd.productGroups.length > 0)
        .map(pd => ({
          projectId: pd.projectId,
          projectName: pd.projectName,
          format,
          groups: pd.productGroups.map(pg => ({
            productName: pg.productName,
            sizeKey: pg.sizeKey,
            batchSize: pg.batchSize
          }))
        }))

      onConfigure(configs)
      return
    }

    // Direct download mode (when not in bulk/configure flow)
    // Calculate total files to download
    const totalFiles = projectsData.reduce((sum, pd) => {
      if (pd.error || pd.productGroups.length === 0) return sum
      return sum + pd.productGroups.length
    }, 0)

    if (totalFiles === 0) {
      showError('No cut list files to download')
      return
    }

    // Start download tracking and close modal immediately
    const projectNames = projectsData
      .filter(pd => !pd.error && pd.productGroups.length > 0)
      .map(pd => pd.projectName)
      .slice(0, 2)
      .join(', ')
    const downloadName = projectNames + (projectsData.length > 2 ? ` +${projectsData.length - 2} more` : '')

    const downloadId = startDownload({
      name: `Cut Lists - ${downloadName}`,
      type: 'cutlist'
    })
    onClose()

    let successCount = 0
    let errorCount = 0

    try {
      for (const projectData of projectsData) {
        if (projectData.error || projectData.productGroups.length === 0) continue

        for (const group of projectData.productGroups) {
          try {
            const safeProjectName = projectData.projectName.replace(/[^a-zA-Z0-9]/g, '-')
            const safeProductName = group.productName.replace(/\s+/g, '-')

            // Build the URL with product filter and batch size
            const url = `/api/projects/${projectData.projectId}/bom?cutlist=true&format=${format}&product=${encodeURIComponent(group.productName)}&size=${encodeURIComponent(group.sizeKey)}&batch=${group.batchSize}`

            const response = await fetch(url)
            if (!response.ok) {
              throw new Error('Failed to download cut list')
            }

            const blob = await response.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = downloadUrl
            a.download = `${safeProjectName}-${safeProductName}-${group.sizeKey}-${group.batchSize}units-cutlist.${format}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(downloadUrl)
            document.body.removeChild(a)

            successCount++
            // Update progress after each file completes
            updateProgress(downloadId, (successCount / totalFiles) * 100)

            // Small delay between downloads to prevent browser issues
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error) {
            console.error('Error downloading cut list:', error)
            errorCount++
          }
        }
      }

      if (errorCount === 0) {
        completeDownload(downloadId)
      } else {
        failDownload(downloadId, `${successCount} succeeded, ${errorCount} failed`)
      }
    } catch (error) {
      console.error('Error during download:', error)
      failDownload(downloadId, 'Failed to download cut lists')
    }
  }

  const totalGroups = projectsData.reduce((sum, pd) => sum + pd.productGroups.length, 0)
  const hasData = totalGroups > 0

  function getButtonText() {
    if (downloading) return null // Will show spinner
    if (isConfigureMode) {
      return hasMoreModals ? (
        <>
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Download All
        </>
      )
    }
    return (
      <>
        <Download className="w-4 h-4 mr-2" />
        Download All
      </>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Scissors className="h-5 w-5 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">
              Cut List Configuration {format === 'pdf' ? '(PDF)' : '(CSV)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Configure batch sizes for each product group{isConfigureMode ? '.' : ', then download all cut lists.'}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : !hasData ? (
          <div className="text-center py-8 text-gray-500">
            No cut list items found in the selected project{projects.length > 1 ? 's' : ''}.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6">
            {projectsData.map((projectData) => (
              <div key={projectData.projectId}>
                {/* Project Header */}
                {projects.length > 1 && (
                  <div className="bg-gray-100 px-4 py-2 rounded-t-lg border border-b-0 border-gray-200">
                    <h4 className="font-medium text-gray-900">{projectData.projectName}</h4>
                  </div>
                )}

                {projectData.error ? (
                  <div className="text-red-500 text-sm px-4 py-3 bg-red-50 rounded-lg border border-red-200">
                    {projectData.error}
                  </div>
                ) : projectData.productGroups.length === 0 ? (
                  <div className="text-gray-500 text-sm px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    No cut list items found.
                  </div>
                ) : (
                  <div className={`border border-gray-200 ${projects.length > 1 ? 'rounded-b-lg' : 'rounded-lg'} divide-y divide-gray-100`}>
                    {projectData.productGroups.map((group, idx) => (
                      <div key={`${group.productName}-${group.sizeKey}`} className="px-4 py-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {group.productName}
                            </div>
                            <div className="text-sm text-gray-600">
                              {group.sizeKey.replace('x', '" × ')}"
                            </div>
                            <div className="text-xs text-gray-500 mt-1 space-x-3">
                              <span>Total Units: <span className="font-medium">{group.unitCount}</span></span>
                              <span>Unique Cuts: <span className="font-medium">{group.uniqueCuts}</span></span>
                              <span>Parts/Unit: <span className="font-medium">{group.partsPerUnit}</span></span>
                              <span>Total Parts: <span className="font-medium">{group.totalParts}</span></span>
                            </div>
                          </div>
                          <div className="ml-4 flex items-center space-x-2">
                            <label className="text-sm text-gray-600 whitespace-nowrap">
                              Units per Batch:
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={group.unitCount}
                              value={group.batchSize}
                              onChange={(e) => updateBatchSize(
                                projectData.projectId,
                                group.productName,
                                group.sizeKey,
                                parseInt(e.target.value) || 1
                              )}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                        {group.batchSize < group.unitCount && (
                          <div className="mt-2 text-xs text-blue-600">
                            Will generate batches of {group.batchSize} units
                            {group.unitCount % group.batchSize !== 0 && (
                              <span> (remainder batch of {group.unitCount % group.batchSize} units)</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {hasData && `${totalGroups} product group${totalGroups !== 1 ? 's' : ''} to download`}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAction}
              disabled={!hasData || loading || downloading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : getButtonText()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
