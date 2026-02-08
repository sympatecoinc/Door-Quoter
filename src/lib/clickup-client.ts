/**
 * ClickUp API Client
 *
 * Provides a reusable interface for interacting with the ClickUp API v2.
 * Includes rate limit handling and error management.
 */

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2'

interface ClickUpError {
  err: string
  ECODE?: string
}

interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

export interface ClickUpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  params?: Record<string, string | number | boolean | undefined>
}

export class ClickUpClient {
  private apiToken: string
  private rateLimitInfo: RateLimitInfo | null = null

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.CLICKUP_API_TOKEN || ''
    if (!this.apiToken) {
      throw new Error('ClickUp API token is required')
    }
  }

  /**
   * Get the current rate limit status
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo
  }

  /**
   * Make a request to the ClickUp API
   */
  async request<T>(endpoint: string, options: ClickUpRequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params } = options

    // Build URL with query params
    let url = `${CLICKUP_API_BASE}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const headers: Record<string, string> = {
      'Authorization': this.apiToken,
      'Content-Type': 'application/json',
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)

    // Update rate limit info from headers
    const rateLimitLimit = response.headers.get('x-ratelimit-limit')
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining')
    const rateLimitReset = response.headers.get('x-ratelimit-reset')

    if (rateLimitLimit && rateLimitRemaining && rateLimitReset) {
      this.rateLimitInfo = {
        limit: parseInt(rateLimitLimit, 10),
        remaining: parseInt(rateLimitRemaining, 10),
        reset: parseInt(rateLimitReset, 10),
      }
    }

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after')
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000
      throw new Error(`Rate limit exceeded. Retry after ${waitTime / 1000} seconds.`)
    }

    // Handle other errors
    if (!response.ok) {
      let errorMessage = `ClickUp API error: ${response.status} ${response.statusText}`
      try {
        const errorData: ClickUpError = await response.json()
        if (errorData.err) {
          errorMessage = `ClickUp API error: ${errorData.err}`
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  // ============ Workspace/Team Endpoints ============

  /**
   * Get all workspaces (teams) the user has access to
   */
  async getTeams(): Promise<ClickUpTeamsResponse> {
    return this.request<ClickUpTeamsResponse>('/team')
  }

  // ============ Space Endpoints ============

  /**
   * Get all spaces in a workspace
   */
  async getSpaces(teamId: string): Promise<ClickUpSpacesResponse> {
    return this.request<ClickUpSpacesResponse>(`/team/${teamId}/space`)
  }

  /**
   * Get a specific space
   */
  async getSpace(spaceId: string): Promise<ClickUpSpace> {
    return this.request<ClickUpSpace>(`/space/${spaceId}`)
  }

  // ============ Folder Endpoints ============

  /**
   * Get all folders in a space
   */
  async getFolders(spaceId: string): Promise<ClickUpFoldersResponse> {
    return this.request<ClickUpFoldersResponse>(`/space/${spaceId}/folder`)
  }

  /**
   * Get a specific folder
   */
  async getFolder(folderId: string): Promise<ClickUpFolder> {
    return this.request<ClickUpFolder>(`/folder/${folderId}`)
  }

  // ============ List Endpoints ============

  /**
   * Get all lists in a folder
   */
  async getListsInFolder(folderId: string): Promise<ClickUpListsResponse> {
    return this.request<ClickUpListsResponse>(`/folder/${folderId}/list`)
  }

  /**
   * Get folderless lists in a space
   */
  async getFolderlessLists(spaceId: string): Promise<ClickUpListsResponse> {
    return this.request<ClickUpListsResponse>(`/space/${spaceId}/list`)
  }

  /**
   * Get a specific list with details
   */
  async getList(listId: string): Promise<ClickUpList> {
    return this.request<ClickUpList>(`/list/${listId}`)
  }

  // ============ Task Endpoints ============

  /**
   * Get tasks in a list (paginated)
   */
  async getTasks(listId: string, options: GetTasksOptions = {}): Promise<ClickUpTasksResponse> {
    const params: Record<string, string | number | boolean | undefined> = {
      page: options.page ?? 0,
      include_closed: options.includeClosed ?? true,
      subtasks: options.subtasks ?? true,
    }

    if (options.orderBy) params.order_by = options.orderBy
    if (options.reverse !== undefined) params.reverse = options.reverse
    if (options.statuses) params.statuses = options.statuses.join(',')

    return this.request<ClickUpTasksResponse>(`/list/${listId}/task`, { params })
  }

  /**
   * Get a specific task
   */
  async getTask(taskId: string, includeSubtasks = true): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`, {
      params: { include_subtasks: includeSubtasks }
    })
  }

  // ============ Custom Field Endpoints ============

  /**
   * Get custom fields for a list
   */
  async getCustomFields(listId: string): Promise<ClickUpFieldsResponse> {
    return this.request<ClickUpFieldsResponse>(`/list/${listId}/field`)
  }

  // ============ Task CRUD Operations (for CRM Sync) ============

  /**
   * Create a new task in a list
   */
  async createTask(listId: string, data: CreateTaskData): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/list/${listId}/task`, {
      method: 'POST',
      body: data,
    })
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, data: UpdateTaskData): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`, {
      method: 'PUT',
      body: data,
    })
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.request(`/task/${taskId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Set a custom field value on a task
   */
  async setCustomFieldValue(taskId: string, fieldId: string, value: any): Promise<void> {
    await this.request(`/task/${taskId}/field/${fieldId}`, {
      method: 'POST',
      body: { value },
    })
  }

  /**
   * Remove a custom field value from a task
   */
  async removeCustomFieldValue(taskId: string, fieldId: string): Promise<void> {
    await this.request(`/task/${taskId}/field/${fieldId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Add a comment to a task
   */
  async addComment(taskId: string, commentText: string): Promise<ClickUpComment> {
    return this.request<ClickUpComment>(`/task/${taskId}/comment`, {
      method: 'POST',
      body: { comment_text: commentText },
    })
  }

  /**
   * Add a link between two tasks (works across lists)
   * This creates a visible link in the task's sidebar
   */
  async addTaskLink(taskId: string, linksTo: string): Promise<void> {
    await this.request(`/task/${taskId}/link/${linksTo}`, {
      method: 'POST',
    })
  }

  // ============ Webhook Endpoints ============

  /**
   * Get webhooks for a team
   */
  async getWebhooks(teamId: string): Promise<ClickUpWebhooksResponse> {
    return this.request<ClickUpWebhooksResponse>(`/team/${teamId}/webhook`)
  }

  /**
   * Create a webhook
   */
  async createWebhook(teamId: string, data: CreateWebhookData): Promise<ClickUpWebhook> {
    return this.request<ClickUpWebhook>(`/team/${teamId}/webhook`, {
      method: 'POST',
      body: data,
    })
  }

  /**
   * Update a webhook
   */
  async updateWebhook(webhookId: string, data: UpdateWebhookData): Promise<ClickUpWebhook> {
    return this.request<ClickUpWebhook>(`/webhook/${webhookId}`, {
      method: 'PUT',
      body: data,
    })
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request(`/webhook/${webhookId}`, {
      method: 'DELETE',
    })
  }
}

// ============ Type Definitions ============

export interface ClickUpTeam {
  id: string
  name: string
  color: string
  avatar: string | null
  members: ClickUpMember[]
}

export interface ClickUpTeamsResponse {
  teams: ClickUpTeam[]
}

export interface ClickUpMember {
  user: {
    id: number
    username: string
    email: string
    color: string
    profilePicture: string | null
    initials: string
  }
  invited_by?: {
    id: number
    username: string
    email: string
    color: string
    initials: string
  }
}

export interface ClickUpSpace {
  id: string
  name: string
  private: boolean
  statuses: ClickUpStatus[]
  multiple_assignees: boolean
  features: Record<string, { enabled: boolean }>
  archived: boolean
}

export interface ClickUpSpacesResponse {
  spaces: ClickUpSpace[]
}

export interface ClickUpStatus {
  id?: string
  status: string
  type: string
  orderindex: number
  color: string
}

export interface ClickUpFolder {
  id: string
  name: string
  orderindex: number
  override_statuses: boolean
  hidden: boolean
  space: {
    id: string
    name: string
  }
  task_count: string
  archived: boolean
  lists: ClickUpList[]
}

export interface ClickUpFoldersResponse {
  folders: ClickUpFolder[]
}

export interface ClickUpList {
  id: string
  name: string
  orderindex: number
  content: string
  status: {
    status: string
    color: string
    hide_label: boolean
  } | null
  priority: {
    priority: string
    color: string
  } | null
  assignee: ClickUpAssignee | null
  task_count: number | null
  due_date: string | null
  start_date: string | null
  folder: {
    id: string
    name: string
    hidden: boolean
    access: boolean
  }
  space: {
    id: string
    name: string
    access: boolean
  }
  archived: boolean
  override_statuses: boolean
  statuses: ClickUpStatus[]
  permission_level: string
}

export interface ClickUpListsResponse {
  lists: ClickUpList[]
}

export interface ClickUpAssignee {
  id: number
  username: string
  color: string
  initials: string
  email: string
  profilePicture: string | null
}

export interface ClickUpTask {
  id: string
  custom_id: string | null
  name: string
  text_content: string | null
  description: string | null
  status: ClickUpStatus
  orderindex: string
  date_created: string
  date_updated: string
  date_closed: string | null
  date_done: string | null
  archived: boolean
  creator: {
    id: number
    username: string
    color: string
    email: string
    profilePicture: string | null
  }
  assignees: ClickUpAssignee[]
  watchers: ClickUpAssignee[]
  checklists: any[]
  tags: ClickUpTag[]
  parent: string | null
  priority: {
    id: string
    priority: string
    color: string
    orderindex: string
  } | null
  due_date: string | null
  start_date: string | null
  points: number | null
  time_estimate: number | null
  time_spent: number | null
  custom_fields: ClickUpCustomFieldValue[]
  dependencies: any[]
  linked_tasks: any[]
  team_id: string
  url: string
  sharing: {
    public: boolean
    public_share_expires_on: string | null
    public_fields: string[]
    token: string | null
    seo_optimized: boolean
  }
  permission_level: string
  list: {
    id: string
    name: string
    access: boolean
  }
  project: {
    id: string
    name: string
    hidden: boolean
    access: boolean
  }
  folder: {
    id: string
    name: string
    hidden: boolean
    access: boolean
  }
  space: {
    id: string
  }
  subtasks?: ClickUpTask[]
}

export interface ClickUpTasksResponse {
  tasks: ClickUpTask[]
}

export interface ClickUpTag {
  name: string
  tag_fg: string
  tag_bg: string
  creator: number
}

export interface ClickUpCustomField {
  id: string
  name: string
  type: ClickUpFieldType
  type_config: Record<string, any>
  date_created: string
  hide_from_guests: boolean
  required: boolean
}

export type ClickUpFieldType =
  | 'text'
  | 'drop_down'
  | 'email'
  | 'phone'
  | 'date'
  | 'url'
  | 'checkbox'
  | 'number'
  | 'currency'
  | 'tasks'
  | 'users'
  | 'emoji'
  | 'labels'
  | 'automatic_progress'
  | 'manual_progress'
  | 'short_text'
  | 'location'
  | 'formula'
  | 'relationship'

export interface ClickUpCustomFieldValue {
  id: string
  name: string
  type: ClickUpFieldType
  type_config: Record<string, any>
  date_created: string
  hide_from_guests: boolean
  required: boolean
  value?: any
}

export interface ClickUpFieldsResponse {
  fields: ClickUpCustomField[]
}

export interface GetTasksOptions {
  page?: number
  includeClosed?: boolean
  subtasks?: boolean
  orderBy?: 'id' | 'created' | 'updated' | 'due_date'
  reverse?: boolean
  statuses?: string[]
}

// ============ Task CRUD Types ============

export interface CreateTaskData {
  name: string
  description?: string
  assignees?: number[]
  tags?: string[]
  status?: string
  priority?: number | null
  due_date?: number | null
  due_date_time?: boolean
  time_estimate?: number
  start_date?: number | null
  start_date_time?: boolean
  notify_all?: boolean
  parent?: string | null
  links_to?: string | null
  custom_fields?: Array<{
    id: string
    value: any
  }>
}

export interface UpdateTaskData {
  name?: string
  description?: string
  assignees?: {
    add?: number[]
    rem?: number[]
  }
  status?: string
  priority?: number | null
  due_date?: number | null
  due_date_time?: boolean
  time_estimate?: number
  start_date?: number | null
  start_date_time?: boolean
  parent?: string | null
  archived?: boolean
}

// ============ Comment Types ============

export interface ClickUpComment {
  id: string
  comment: Array<{
    text: string
    attributes?: Record<string, any>
  }>
  comment_text: string
  user: {
    id: number
    username: string
    email: string
    color: string
    initials: string
    profilePicture: string | null
  }
  resolved: boolean
  assignee: ClickUpAssignee | null
  assigned_by: ClickUpAssignee | null
  reactions: any[]
  date: string
}

// ============ Webhook Types ============

export interface ClickUpWebhook {
  id: string
  userid: number
  team_id: string
  endpoint: string
  client_id: string | null
  events: string[]
  task_id: string | null
  list_id: string | null
  folder_id: string | null
  space_id: string | null
  health: {
    status: string
    fail_count: number
  }
  secret: string
}

export interface ClickUpWebhooksResponse {
  webhooks: ClickUpWebhook[]
}

export interface CreateWebhookData {
  endpoint: string
  events: ClickUpWebhookEvent[]
  space_id?: string
  folder_id?: string
  list_id?: string
  task_id?: string
}

export interface UpdateWebhookData {
  endpoint?: string
  events?: ClickUpWebhookEvent[]
  status?: 'active' | 'inactive'
}

export type ClickUpWebhookEvent =
  | 'taskCreated'
  | 'taskUpdated'
  | 'taskDeleted'
  | 'taskPriorityUpdated'
  | 'taskStatusUpdated'
  | 'taskAssigneeUpdated'
  | 'taskDueDateUpdated'
  | 'taskTagUpdated'
  | 'taskMoved'
  | 'taskCommentPosted'
  | 'taskCommentUpdated'
  | 'taskTimeEstimateUpdated'
  | 'taskTimeTrackedUpdated'
  | 'listCreated'
  | 'listUpdated'
  | 'listDeleted'
  | 'folderCreated'
  | 'folderUpdated'
  | 'folderDeleted'
  | 'spaceCreated'
  | 'spaceUpdated'
  | 'spaceDeleted'
  | 'goalCreated'
  | 'goalUpdated'
  | 'goalDeleted'
  | 'keyResultCreated'
  | 'keyResultUpdated'
  | 'keyResultDeleted'

// ============ Webhook Payload Types ============

export interface ClickUpWebhookPayload {
  event: ClickUpWebhookEvent
  history_items?: ClickUpHistoryItem[]
  task_id: string
  webhook_id: string
}

export interface ClickUpHistoryItem {
  id: string
  type: number
  date: string
  field: string
  parent_id: string
  data: Record<string, any>
  source: string | null
  user: {
    id: number
    username: string
    email: string
    color: string
    initials: string
    profilePicture: string | null
  }
  before: any
  after: any
}

// Export a singleton instance for server-side use
let clientInstance: ClickUpClient | null = null

export function getClickUpClient(): ClickUpClient {
  if (!clientInstance) {
    clientInstance = new ClickUpClient()
  }
  return clientInstance
}
