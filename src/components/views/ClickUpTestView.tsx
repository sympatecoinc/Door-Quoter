'use client'

import { useState, useEffect } from 'react'
import {
  RefreshCw,
  ChevronRight,
  Search,
  List,
  Folder,
  Layout,
  Code,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  ExternalLink,
  ChevronLeft,
  ChevronDown
} from 'lucide-react'

// Types for ClickUp data
interface ClickUpSpace {
  id: string
  name: string
  private: boolean
  archived: boolean
}

interface ClickUpFolder {
  id: string
  name: string
  task_count: string
  archived: boolean
  lists: ClickUpList[]
}

interface ClickUpList {
  id: string
  name: string
  task_count: number | null
  archived: boolean
  folder?: { id: string; name: string }
  space?: { id: string; name: string }
}

interface ClickUpTask {
  id: string
  name: string
  status: { status: string; color: string }
  assignees: Array<{ id: number; username: string; email: string; profilePicture: string | null }>
  priority: { priority: string; color: string } | null
  due_date: string | null
  date_created: string
  date_updated: string
  tags: Array<{ name: string; tag_bg: string; tag_fg: string }>
  custom_fields: Array<{
    id: string
    name: string
    type: string
    value?: any
    type_config?: any
  }>
  url: string
}

interface ClickUpCustomField {
  id: string
  name: string
  type: string
  type_config: Record<string, any>
  required: boolean
}

interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

type TabType = 'data' | 'fields' | 'json'

export default function ClickUpTestView() {
  // State for navigation
  const [spaces, setSpaces] = useState<ClickUpSpace[]>([])
  const [folders, setFolders] = useState<ClickUpFolder[]>([])
  const [folderlessLists, setFolderlessLists] = useState<ClickUpList[]>([])
  const [lists, setLists] = useState<ClickUpList[]>([])
  const [tasks, setTasks] = useState<ClickUpTask[]>([])
  const [customFields, setCustomFields] = useState<ClickUpCustomField[]>([])
  const [selectedList, setSelectedList] = useState<ClickUpList | null>(null)

  // Selection state
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [directListId, setDirectListId] = useState<string>('')

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('data')
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [rawJson, setRawJson] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreTasks, setHasMoreTasks] = useState(false)

  // Expanded state for collapsible sections
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Load spaces on mount
  useEffect(() => {
    loadSpaces()
  }, [])

  async function loadSpaces() {
    setLoading(prev => ({ ...prev, spaces: true }))
    setError(null)
    try {
      const response = await fetch('/api/clickup/spaces')
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to fetch spaces')

      setSpaces(data.spaces)
      setRateLimit(data.rateLimit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spaces')
    } finally {
      setLoading(prev => ({ ...prev, spaces: false }))
    }
  }

  async function loadFolders(spaceId: string) {
    setLoading(prev => ({ ...prev, folders: true }))
    setError(null)
    try {
      const response = await fetch(`/api/clickup/spaces/${spaceId}/folders`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to fetch folders')

      setFolders(data.folders)
      setFolderlessLists(data.folderlessLists)
      setRateLimit(data.rateLimit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders')
    } finally {
      setLoading(prev => ({ ...prev, folders: false }))
    }
  }

  async function loadListsInFolder(folderId: string) {
    setLoading(prev => ({ ...prev, lists: true }))
    setError(null)
    try {
      const response = await fetch(`/api/clickup/folders/${folderId}/lists`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to fetch lists')

      setLists(data.lists)
      setRateLimit(data.rateLimit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lists')
    } finally {
      setLoading(prev => ({ ...prev, lists: false }))
    }
  }

  async function loadListData(listId: string, page = 0) {
    setLoading(prev => ({ ...prev, tasks: true, fields: true }))
    setError(null)
    try {
      // Fetch list details, tasks, and custom fields in parallel
      const [listRes, tasksRes, fieldsRes] = await Promise.all([
        fetch(`/api/clickup/lists/${listId}`),
        fetch(`/api/clickup/lists/${listId}/tasks?page=${page}`),
        fetch(`/api/clickup/lists/${listId}/fields`)
      ])

      const [listData, tasksData, fieldsData] = await Promise.all([
        listRes.json(),
        tasksRes.json(),
        fieldsRes.json()
      ])

      if (!listRes.ok) throw new Error(listData.error || 'Failed to fetch list')
      if (!tasksRes.ok) throw new Error(tasksData.error || 'Failed to fetch tasks')
      if (!fieldsRes.ok) throw new Error(fieldsData.error || 'Failed to fetch fields')

      setSelectedList(listData.list)
      setTasks(tasksData.tasks)
      setHasMoreTasks(tasksData.hasMore)
      setCurrentPage(page)
      setCustomFields(fieldsData.fields)
      setRateLimit(fieldsData.rateLimit)

      // Store raw JSON for debugging
      setRawJson({
        list: listData.list,
        tasks: tasksData.tasks,
        fields: fieldsData.fields,
        pagination: {
          page: tasksData.page,
          hasMore: tasksData.hasMore
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list data')
    } finally {
      setLoading(prev => ({ ...prev, tasks: false, fields: false }))
    }
  }

  function handleSpaceChange(spaceId: string) {
    setSelectedSpaceId(spaceId)
    setSelectedFolderId('')
    setFolders([])
    setFolderlessLists([])
    setLists([])
    setTasks([])
    setCustomFields([])
    setSelectedList(null)
    setExpandedFolders(new Set())

    if (spaceId) {
      loadFolders(spaceId)
    }
  }

  function handleFolderChange(folderId: string) {
    setSelectedFolderId(folderId)
    setLists([])
    setTasks([])
    setCustomFields([])
    setSelectedList(null)

    if (folderId) {
      loadListsInFolder(folderId)
    }
  }

  function handleListSelect(list: ClickUpList) {
    setSelectedList(list)
    loadListData(list.id)
  }

  function handleDirectListLoad() {
    if (!directListId.trim()) return
    loadListData(directListId.trim())
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  // Format custom field value for display
  function formatFieldValue(field: ClickUpTask['custom_fields'][0]): string {
    if (field.value === undefined || field.value === null) return '-'

    switch (field.type) {
      case 'checkbox':
        return field.value ? 'Yes' : 'No'
      case 'date':
        return field.value ? new Date(parseInt(field.value)).toLocaleDateString() : '-'
      case 'currency':
        return field.value !== undefined ? `$${Number(field.value).toFixed(2)}` : '-'
      case 'number':
        return field.value !== undefined ? String(field.value) : '-'
      case 'drop_down':
        const option = field.type_config?.options?.find((o: any) => o.orderindex === field.value)
        return option?.name || String(field.value)
      case 'labels':
        if (Array.isArray(field.value)) {
          const labelNames = field.value.map((v: number) => {
            const label = field.type_config?.options?.find((o: any) => o.id === v)
            return label?.label || v
          })
          return labelNames.join(', ')
        }
        return String(field.value)
      case 'users':
        if (Array.isArray(field.value)) {
          return field.value.map((u: any) => u.username || u.email).join(', ')
        }
        return String(field.value)
      case 'email':
      case 'phone':
      case 'url':
      case 'text':
      case 'short_text':
        return String(field.value)
      default:
        return typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value)
    }
  }

  // Get visible custom field columns (non-empty)
  function getVisibleFields(): string[] {
    const fieldSet = new Set<string>()
    tasks.forEach(task => {
      task.custom_fields.forEach(field => {
        if (field.value !== undefined && field.value !== null) {
          fieldSet.add(field.name)
        }
      })
    })
    return Array.from(fieldSet)
  }

  const visibleFields = getVisibleFields()

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ClickUp CRM Test Interface</h1>
            <p className="text-gray-600 mt-1">
              Explore ClickUp data structure for CRM integration
            </p>
          </div>
          {rateLimit && (
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
              API Calls: {rateLimit.remaining}/{rateLimit.limit}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Space Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Layout className="w-4 h-4 inline mr-1" />
              Space
            </label>
            <select
              value={selectedSpaceId}
              onChange={(e) => handleSpaceChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading.spaces}
            >
              <option value="">Select a space...</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name} {space.private && '(Private)'}
                </option>
              ))}
            </select>
          </div>

          {/* Folder Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Folder className="w-4 h-4 inline mr-1" />
              Folder
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => handleFolderChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!selectedSpaceId || loading.folders}
            >
              <option value="">Select a folder...</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name} ({folder.task_count} tasks)
                </option>
              ))}
              {folderlessLists.length > 0 && (
                <option value="__folderless__" disabled>
                  ── Folderless Lists ──
                </option>
              )}
            </select>
          </div>

          {/* List Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <List className="w-4 h-4 inline mr-1" />
              List
            </label>
            <select
              value={selectedList?.id || ''}
              onChange={(e) => {
                const list = [...lists, ...folderlessLists].find(l => l.id === e.target.value)
                if (list) handleListSelect(list)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={(!selectedFolderId && folderlessLists.length === 0) || loading.lists}
            >
              <option value="">Select a list...</option>
              {selectedFolderId && lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} {list.task_count !== null && `(${list.task_count})`}
                </option>
              ))}
              {!selectedFolderId && folderlessLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} {list.task_count !== null && `(${list.task_count})`}
                </option>
              ))}
            </select>
          </div>

          {/* Direct List ID Entry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search className="w-4 h-4 inline mr-1" />
              Direct List ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={directListId}
                onChange={(e) => setDirectListId(e.target.value)}
                placeholder="Enter List ID"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleDirectListLoad()}
              />
              <button
                onClick={handleDirectListLoad}
                disabled={!directListId.trim() || loading.tasks}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Load
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Browsable Folder/List Tree */}
      {selectedSpaceId && (folders.length > 0 || folderlessLists.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Browse Structure</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {/* Folders */}
            {folders.map((folder) => (
              <div key={folder.id}>
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50 rounded"
                >
                  {expandedFolders.has(folder.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <Folder className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">{folder.name}</span>
                  <span className="text-xs text-gray-400">({folder.task_count} tasks)</span>
                </button>
                {expandedFolders.has(folder.id) && folder.lists && (
                  <div className="ml-6 space-y-0.5">
                    {folder.lists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => handleListSelect(list)}
                        className={`w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-blue-50 rounded ${
                          selectedList?.id === list.id ? 'bg-blue-100 text-blue-700' : ''
                        }`}
                      >
                        <List className="w-4 h-4 text-blue-500" />
                        <span className="text-sm">{list.name}</span>
                        {list.task_count !== null && (
                          <span className="text-xs text-gray-400">({list.task_count})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Folderless Lists */}
            {folderlessLists.length > 0 && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <div className="text-xs text-gray-500 px-2 py-1">Folderless Lists</div>
                {folderlessLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => handleListSelect(list)}
                    className={`w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-blue-50 rounded ${
                      selectedList?.id === list.id ? 'bg-blue-100 text-blue-700' : ''
                    }`}
                  >
                    <List className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{list.name}</span>
                    {list.task_count !== null && (
                      <span className="text-xs text-gray-400">({list.task_count})</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* List Data Section */}
      {selectedList && (
        <div className="bg-white rounded-lg border border-gray-200">
          {/* List Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedList.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                  <span>Tasks: {tasks.length}{hasMoreTasks && '+'}</span>
                  <span>Custom Fields: {customFields.length}</span>
                  <span>ID: {selectedList.id}</span>
                </div>
              </div>
              <button
                onClick={() => loadListData(selectedList.id, currentPage)}
                disabled={loading.tasks}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading.tasks ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex px-4">
              {(['data', 'fields', 'json'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'data' && 'Task Data'}
                  {tab === 'fields' && 'Custom Fields'}
                  {tab === 'json' && 'Raw JSON'}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Data Table Tab */}
            {activeTab === 'data' && (
              <div>
                {loading.tasks ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No tasks found in this list
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Name</th>
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Status</th>
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Assignee</th>
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Due Date</th>
                            {visibleFields.map((field) => (
                              <th key={field} className="text-left py-3 px-2 font-medium text-gray-700">
                                {field}
                              </th>
                            ))}
                            <th className="text-left py-3 px-2 font-medium text-gray-700">Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.map((task) => (
                            <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-2 max-w-xs truncate" title={task.name}>
                                {task.name}
                              </td>
                              <td className="py-2 px-2">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: `${task.status.color}20`,
                                    color: task.status.color
                                  }}
                                >
                                  {task.status.status}
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                {task.assignees.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    {task.assignees[0].profilePicture ? (
                                      <img
                                        src={task.assignees[0].profilePicture}
                                        alt=""
                                        className="w-5 h-5 rounded-full"
                                      />
                                    ) : (
                                      <User className="w-4 h-4 text-gray-400" />
                                    )}
                                    <span className="text-gray-700">
                                      {task.assignees[0].username}
                                      {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                {task.due_date ? (
                                  <div className="flex items-center gap-1 text-gray-700">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {new Date(parseInt(task.due_date)).toLocaleDateString()}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              {visibleFields.map((fieldName) => {
                                const field = task.custom_fields.find(f => f.name === fieldName)
                                return (
                                  <td key={fieldName} className="py-2 px-2 max-w-xs truncate">
                                    {field ? formatFieldValue(field) : '-'}
                                  </td>
                                )
                              })}
                              <td className="py-2 px-2">
                                <a
                                  href={task.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => loadListData(selectedList.id, currentPage - 1)}
                        disabled={currentPage === 0 || loading.tasks}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                      <span className="text-sm text-gray-500">
                        Page {currentPage + 1}
                      </span>
                      <button
                        onClick={() => loadListData(selectedList.id, currentPage + 1)}
                        disabled={!hasMoreTasks || loading.tasks}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Custom Fields Tab */}
            {activeTab === 'fields' && (
              <div>
                {loading.fields ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                  </div>
                ) : customFields.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No custom fields defined for this list
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customFields.map((field) => (
                      <div
                        key={field.id}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{field.name}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {field.type}
                            </span>
                            {field.required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">
                                Required
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          <span className="font-mono text-xs">{field.id}</span>
                        </div>
                        {field.type_config && Object.keys(field.type_config).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-sm text-blue-600 cursor-pointer">
                              View Type Config
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                              {JSON.stringify(field.type_config, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Raw JSON Tab */}
            {activeTab === 'json' && (
              <div>
                {rawJson ? (
                  <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs max-h-[600px] overflow-y-auto">
                    {JSON.stringify(rawJson, null, 2)}
                  </pre>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    Load a list to see raw JSON data
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedList && !loading.spaces && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Select a List to Get Started
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Use the navigation dropdowns above to browse your ClickUp workspace,
            or enter a list ID directly to load its data.
          </p>
        </div>
      )}
    </div>
  )
}
