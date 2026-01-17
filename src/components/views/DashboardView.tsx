'use client'

import { useState, useEffect } from 'react'
import { Folder, DollarSign, LayoutGrid, Plus } from 'lucide-react'
import { ProjectStatus } from '@/types'
import StatusBadge from '@/components/projects/StatusBadge'
import { useAppStore } from '@/stores/appStore'
import SalesLeadView from '@/components/sales/SalesLeadView'
import AddLeadModal from '@/components/sales/AddLeadModal'

interface DashboardStats {
  totalProjects: number
  totalLeads: number
  totalValue: number
  leadPipelineValue: number
  totalOpenings: number
}

interface LatestQuote {
  version: number
  totalPrice: number
}

interface RecentProject {
  id: number
  name: string
  status: ProjectStatus
  openingsCount: number
  value: number
  updatedAt: string
  hasThinWall?: boolean
  hasTrimmed?: boolean
  latestQuote?: LatestQuote | null
}

interface RecentLead extends RecentProject {
  customer: {
    id: number
    companyName: string
    isProspect: boolean
  } | null
  prospectCompanyName?: string | null
}

interface DashboardData {
  stats: DashboardStats
  recentProjects: RecentProject[]
  recentLeads: RecentLead[]
}

export default function DashboardView() {
  const { openSalesLead } = useAppStore()
  const [data, setData] = useState<DashboardData>({
    stats: {
      totalProjects: 0,
      totalLeads: 0,
      totalValue: 0,
      leadPipelineValue: 0,
      totalOpenings: 0
    },
    recentProjects: [],
    recentLeads: []
  })
  const [loading, setLoading] = useState(true)
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard')
      if (response.ok) {
        const dashboardData = await response.json()
        setData(dashboardData)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  return (
    <div className="p-8">
      {/* Leads Section */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600 mt-2">Projects in quoting phase (Staging through Quote Sent)</p>
        </div>
        <button
          onClick={() => setShowAddLeadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Lead
        </button>
      </div>

      {/* Leads Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Folder className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Leads</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalLeads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-amber-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pipeline Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.stats.leadPipelineValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Leads List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-12">
        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
                  <div className="space-y-2">
                    <div className="h-5 w-40 bg-gray-200 rounded"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                    <div className="flex items-center space-x-2">
                      <div className="h-5 w-24 bg-gray-200 rounded-full"></div>
                      <div className="h-4 w-20 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-5 w-20 bg-gray-200 rounded ml-auto"></div>
                    <div className="h-4 w-28 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : data.recentLeads.length > 0 ? (
            <div className="space-y-4">
              {data.recentLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => openSalesLead(lead.id, 'leads')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-medium text-gray-900">{lead.name}</h3>
                      {lead.hasThinWall && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                          ThinWall
                        </span>
                      )}
                      {lead.hasTrimmed && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                          Trimmed
                        </span>
                      )}
                    </div>
                    {lead.customer ? (
                      <p className="text-sm text-gray-500">
                        {lead.customer.companyName}
                      </p>
                    ) : lead.prospectCompanyName ? (
                      <p className="text-sm text-gray-500">
                        {lead.prospectCompanyName}
                      </p>
                    ) : null}
                    <div className="flex items-center space-x-2 mt-1">
                      <StatusBadge status={lead.status} />
                      <span className="text-sm text-gray-600">
                        • {lead.openingsCount} opening{lead.openingsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {lead.latestQuote ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                            v{lead.latestQuote.version}
                          </span>
                          ${lead.latestQuote.totalPrice.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      Updated {new Date(lead.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No active leads. Create a new project to start a lead.
            </div>
          )}
        </div>
      </div>

      {/* Projects Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <p className="text-gray-600 mt-2">Won projects (Quote Accepted and beyond)</p>
      </div>

      {/* Projects Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Folder className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Won Projects</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.stats.totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <LayoutGrid className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Openings</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalOpenings}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
                  <div className="space-y-2">
                    <div className="h-5 w-40 bg-gray-200 rounded"></div>
                    <div className="flex items-center space-x-2">
                      <div className="h-5 w-24 bg-gray-200 rounded-full"></div>
                      <div className="h-4 w-20 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-5 w-20 bg-gray-200 rounded ml-auto"></div>
                    <div className="h-4 w-28 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : data.recentProjects.length > 0 ? (
            <div className="space-y-4">
              {data.recentProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => openSalesLead(project.id, 'projects')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-medium text-gray-900">{project.name}</h3>
                      {project.hasThinWall && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                          ThinWall
                        </span>
                      )}
                      {project.hasTrimmed && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                          Trimmed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <StatusBadge status={project.status} />
                      <span className="text-sm text-gray-600">
                        • {project.openingsCount} opening{project.openingsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {project.latestQuote ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                            v{project.latestQuote.version}
                          </span>
                          ${project.latestQuote.totalPrice.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No won projects yet. Projects appear here when marked as Quote Accepted or beyond.
            </div>
          )}
        </div>
      </div>

      {/* Sales Lead View Modal */}
      <SalesLeadView />

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={showAddLeadModal}
        onClose={() => setShowAddLeadModal(false)}
        onLeadCreated={fetchDashboardData}
      />
    </div>
  )
}
