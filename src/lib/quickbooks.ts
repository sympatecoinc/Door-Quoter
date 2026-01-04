import { prisma } from '@/lib/prisma'

// QuickBooks API Configuration
const QB_SANDBOX_BASE_URL = 'https://sandbox-quickbooks.api.intuit.com'
const QB_PRODUCTION_BASE_URL = 'https://quickbooks.api.intuit.com'
const QB_OAUTH_BASE_URL = 'https://oauth.platform.intuit.com'
const QB_API_VERSION = '65'

interface QBConfig {
  clientId: string
  clientSecret: string
  environment: 'sandbox' | 'production'
  redirectUri: string
}

interface QBTokens {
  accessToken: string
  refreshToken: string
  realmId: string
  expiresAt: Date
}

interface QBVendor {
  Id?: string
  SyncToken?: string
  DisplayName: string
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  PrintOnCheckName?: string
  Active?: boolean
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  AlternatePhone?: { FreeFormNumber: string }
  Mobile?: { FreeFormNumber: string }
  Fax?: { FreeFormNumber: string }
  WebAddr?: { URI: string }
  BillAddr?: {
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  TaxIdentifier?: string
  AcctNum?: string
  Vendor1099?: boolean
  Balance?: number
  TermRef?: { value: string; name: string }
  Notes?: string
  sparse?: boolean  // For partial updates
}

// QuickBooks Item interface
export interface QBItem {
  Id?: string
  SyncToken?: string
  Name: string
  Sku?: string
  Description?: string
  Active?: boolean
  SubItem?: boolean
  ParentRef?: { value: string; name?: string }
  Level?: number
  FullyQualifiedName?: string
  Taxable?: boolean
  UnitPrice?: number
  Type?: string  // Service, Inventory, NonInventory, etc.
  IncomeAccountRef?: { value: string; name?: string }
  PurchaseDesc?: string
  PurchaseCost?: number
  ExpenseAccountRef?: { value: string; name?: string }
  AssetAccountRef?: { value: string; name?: string }
  COGSAccountRef?: { value: string; name?: string }
  TrackQtyOnHand?: boolean
  QtyOnHand?: number
  ReorderPoint?: number
  InvStartDate?: string
  PrefVendorRef?: { value: string; name?: string }
  sparse?: boolean
}

// QuickBooks Purchase Order Line interface
export interface QBPOLine {
  Id?: string
  LineNum?: number
  Description?: string
  Amount: number
  DetailType: 'ItemBasedExpenseLineDetail'
  ItemBasedExpenseLineDetail: {
    ItemRef?: { value: string; name?: string }
    UnitPrice?: number
    Qty?: number
    TaxCodeRef?: { value: string }
    BillableStatus?: string
    CustomerRef?: { value: string; name?: string }
  }
}

// QuickBooks Purchase Order interface
export interface QBPurchaseOrder {
  Id?: string
  SyncToken?: string
  DocNumber?: string
  TxnDate?: string  // YYYY-MM-DD
  VendorRef: { value: string; name?: string }
  APAccountRef?: { value: string; name?: string }
  TotalAmt?: number
  DueDate?: string
  ExpectedDate?: string
  Memo?: string
  PrivateNote?: string
  Line?: QBPOLine[]
  VendorAddr?: {
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  ShipAddr?: {
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  POStatus?: string  // Open, Closed
  ManuallyClosed?: boolean
  POEmail?: { Address: string }
  sparse?: boolean
}

// Get QuickBooks configuration from environment
export function getQBConfig(): QBConfig {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  const environment = (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3000/api/quickbooks/callback'

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks credentials not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in .env')
  }

  return { clientId, clientSecret, environment, redirectUri }
}

// Get base URL based on environment
export function getQBBaseUrl(): string {
  const config = getQBConfig()
  return config.environment === 'production' ? QB_PRODUCTION_BASE_URL : QB_SANDBOX_BASE_URL
}

// Generate OAuth authorization URL
export function getAuthorizationUrl(state?: string): string {
  const config = getQBConfig()
  const scopes = 'com.intuit.quickbooks.accounting'

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: scopes,
    state: state || 'default'
  })

  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string, realmId: string): Promise<QBTokens> {
  const config = getQBConfig()

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  const response = await fetch(`${QB_OAUTH_BASE_URL}/oauth2/v1/tokens/bearer`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Token exchange error:', error)
    throw new Error(`Failed to exchange code for tokens: ${response.status}`)
  }

  const data = await response.json()

  // Calculate expiration (usually 1 hour for access token)
  const expiresAt = new Date(Date.now() + (data.expires_in * 1000))

  // Store tokens in database
  await prisma.quickBooksToken.upsert({
    where: { realmId },
    create: {
      realmId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      expiresAt
    },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      expiresAt
    }
  })

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId,
    expiresAt
  }
}

// Refresh expired access token
export async function refreshAccessToken(realmId: string): Promise<QBTokens> {
  const config = getQBConfig()

  const storedToken = await prisma.quickBooksToken.findUnique({
    where: { realmId }
  })

  if (!storedToken) {
    throw new Error('No stored tokens found. Please reconnect to QuickBooks.')
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  const response = await fetch(`${QB_OAUTH_BASE_URL}/oauth2/v1/tokens/bearer`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: storedToken.refreshToken
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Token refresh error:', error)
    throw new Error(`Failed to refresh token: ${response.status}. Please reconnect to QuickBooks.`)
  }

  const data = await response.json()
  const expiresAt = new Date(Date.now() + (data.expires_in * 1000))

  // Update stored tokens
  await prisma.quickBooksToken.update({
    where: { realmId },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt
    }
  })

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId,
    expiresAt
  }
}

// Get valid access token (refresh if needed)
export async function getValidAccessToken(realmId: string): Promise<string> {
  const storedToken = await prisma.quickBooksToken.findUnique({
    where: { realmId }
  })

  if (!storedToken) {
    throw new Error('No stored tokens found. Please reconnect to QuickBooks.')
  }

  // Check if token is expired (with 5 minute buffer)
  const expiresAt = new Date(storedToken.expiresAt)
  const now = new Date()
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

  if (expiresAt < fiveMinutesFromNow) {
    console.log('Access token expired or expiring soon, refreshing...')
    const newTokens = await refreshAccessToken(realmId)
    return newTokens.accessToken
  }

  return storedToken.accessToken
}

// Get stored realm ID (company ID)
export async function getStoredRealmId(): Promise<string | null> {
  const token = await prisma.quickBooksToken.findFirst({
    orderBy: { updatedAt: 'desc' }
  })
  return token?.realmId || null
}

// Check if QuickBooks is connected
export async function isQuickBooksConnected(): Promise<{ connected: boolean; realmId?: string }> {
  const token = await prisma.quickBooksToken.findFirst({
    orderBy: { updatedAt: 'desc' }
  })

  if (!token) {
    return { connected: false }
  }

  // Check if refresh token is still valid (usually 100 days)
  // We'll consider it connected if we have tokens
  return { connected: true, realmId: token.realmId }
}

// Make authenticated API request to QuickBooks
async function qbApiRequest(
  realmId: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: any
): Promise<any> {
  const accessToken = await getValidAccessToken(realmId)
  const baseUrl = getQBBaseUrl()

  // Check if endpoint already has query params
  const separator = endpoint.includes('?') ? '&' : '?'
  const url = `${baseUrl}/v3/company/${realmId}/${endpoint}${separator}minorversion=${QB_API_VERSION}`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json'
  }

  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`QuickBooks API error (${endpoint}):`, error)
    throw new Error(`QuickBooks API error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============ VENDOR OPERATIONS ============

// Query all vendors from QuickBooks
export async function fetchAllQBVendors(realmId: string): Promise<QBVendor[]> {
  const allVendors: QBVendor[] = []
  let startPosition = 1
  const maxResults = 1000

  while (true) {
    const query = `SELECT * FROM Vendor STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const response = await qbApiRequest(realmId, `query?query=${encodeURIComponent(query)}`)

    const vendors = response.QueryResponse?.Vendor || []

    // Debug: Log first vendor's notes to see what QB is returning
    if (vendors.length > 0 && startPosition === 1) {
      console.log(`[QB Sync] Sample QB vendor response:`, JSON.stringify(vendors[0], null, 2))
    }

    allVendors.push(...vendors)

    if (vendors.length < maxResults) {
      break
    }
    startPosition += maxResults
  }

  return allVendors
}

// Get single vendor from QuickBooks
export async function fetchQBVendor(realmId: string, vendorId: string): Promise<QBVendor> {
  const response = await qbApiRequest(realmId, `vendor/${vendorId}`)
  return response.Vendor
}

// Create vendor in QuickBooks
export async function createQBVendor(realmId: string, vendor: QBVendor): Promise<QBVendor> {
  const response = await qbApiRequest(realmId, 'vendor', 'POST', vendor)
  return response.Vendor
}

// Update vendor in QuickBooks
export async function updateQBVendor(realmId: string, vendor: QBVendor): Promise<QBVendor> {
  if (!vendor.Id || !vendor.SyncToken) {
    throw new Error('Vendor Id and SyncToken are required for updates')
  }
  console.log(`[QB Sync] Sending update request to QB:`, JSON.stringify(vendor, null, 2))
  const response = await qbApiRequest(realmId, 'vendor', 'POST', vendor)
  console.log(`[QB Sync] QB update response:`, JSON.stringify(response.Vendor, null, 2))
  return response.Vendor
}

// ============ MAPPING FUNCTIONS ============

// Convert QuickBooks vendor to local format
export function qbVendorToLocal(qbVendor: QBVendor): any {
  return {
    quickbooksId: qbVendor.Id,
    syncToken: qbVendor.SyncToken,
    displayName: qbVendor.DisplayName,
    companyName: qbVendor.CompanyName || null,
    givenName: qbVendor.GivenName || null,
    familyName: qbVendor.FamilyName || null,
    printOnCheckName: qbVendor.PrintOnCheckName || null,
    primaryEmail: qbVendor.PrimaryEmailAddr?.Address || null,
    primaryPhone: qbVendor.PrimaryPhone?.FreeFormNumber || null,
    alternatePhone: qbVendor.AlternatePhone?.FreeFormNumber || null,
    mobile: qbVendor.Mobile?.FreeFormNumber || null,
    fax: qbVendor.Fax?.FreeFormNumber || null,
    website: qbVendor.WebAddr?.URI || null,
    billAddressLine1: qbVendor.BillAddr?.Line1 || null,
    billAddressLine2: qbVendor.BillAddr?.Line2 || null,
    billAddressCity: qbVendor.BillAddr?.City || null,
    billAddressState: qbVendor.BillAddr?.CountrySubDivisionCode || null,
    billAddressZip: qbVendor.BillAddr?.PostalCode || null,
    billAddressCountry: qbVendor.BillAddr?.Country || null,
    taxIdentifier: qbVendor.TaxIdentifier || null,
    acctNum: qbVendor.AcctNum || null,
    vendor1099: qbVendor.Vendor1099 ?? false,
    balance: qbVendor.Balance ?? null,
    termRefId: qbVendor.TermRef?.value || null,
    termRefName: qbVendor.TermRef?.name || null,
    notes: qbVendor.Notes || null,
    isActive: qbVendor.Active ?? true,
    lastSyncedAt: new Date()
  }
}

// Convert local vendor to QuickBooks format
export function localVendorToQB(vendor: any): QBVendor {
  const qbVendor: QBVendor = {
    DisplayName: vendor.displayName
  }

  // Include Id and SyncToken for updates
  if (vendor.quickbooksId) {
    qbVendor.Id = vendor.quickbooksId
  }
  if (vendor.syncToken) {
    qbVendor.SyncToken = vendor.syncToken
  }

  // Optional fields
  if (vendor.companyName) qbVendor.CompanyName = vendor.companyName
  if (vendor.givenName) qbVendor.GivenName = vendor.givenName
  if (vendor.familyName) qbVendor.FamilyName = vendor.familyName
  if (vendor.printOnCheckName) qbVendor.PrintOnCheckName = vendor.printOnCheckName

  if (vendor.primaryEmail) {
    qbVendor.PrimaryEmailAddr = { Address: vendor.primaryEmail }
  }
  if (vendor.primaryPhone) {
    qbVendor.PrimaryPhone = { FreeFormNumber: vendor.primaryPhone }
  }
  if (vendor.alternatePhone) {
    qbVendor.AlternatePhone = { FreeFormNumber: vendor.alternatePhone }
  }
  if (vendor.mobile) {
    qbVendor.Mobile = { FreeFormNumber: vendor.mobile }
  }
  if (vendor.fax) {
    qbVendor.Fax = { FreeFormNumber: vendor.fax }
  }
  if (vendor.website) {
    qbVendor.WebAddr = { URI: vendor.website }
  }

  // Address
  if (vendor.billAddressLine1 || vendor.billAddressCity || vendor.billAddressState) {
    qbVendor.BillAddr = {}
    if (vendor.billAddressLine1) qbVendor.BillAddr.Line1 = vendor.billAddressLine1
    if (vendor.billAddressLine2) qbVendor.BillAddr.Line2 = vendor.billAddressLine2
    if (vendor.billAddressCity) qbVendor.BillAddr.City = vendor.billAddressCity
    if (vendor.billAddressState) qbVendor.BillAddr.CountrySubDivisionCode = vendor.billAddressState
    if (vendor.billAddressZip) qbVendor.BillAddr.PostalCode = vendor.billAddressZip
    if (vendor.billAddressCountry) qbVendor.BillAddr.Country = vendor.billAddressCountry
  }

  if (vendor.taxIdentifier) qbVendor.TaxIdentifier = vendor.taxIdentifier
  if (vendor.acctNum) qbVendor.AcctNum = vendor.acctNum
  if (vendor.vendor1099 !== undefined) qbVendor.Vendor1099 = vendor.vendor1099
  // Always include notes (even if empty) to allow clearing them
  if (vendor.notes !== undefined) qbVendor.Notes = vendor.notes || ''
  if (vendor.isActive !== undefined) qbVendor.Active = vendor.isActive

  // Terms (read-only on QB side for vendors, but include for completeness)
  if (vendor.termRefId && vendor.termRefName) {
    qbVendor.TermRef = { value: vendor.termRefId, name: vendor.termRefName }
  }

  return qbVendor
}

// Sync all vendors from QuickBooks to local database
export async function syncVendorsFromQB(realmId: string): Promise<{
  created: number
  updated: number
  errors: string[]
}> {
  const results = { created: 0, updated: 0, errors: [] as string[] }

  try {
    const qbVendors = await fetchAllQBVendors(realmId)
    console.log(`[QB Sync] Fetched ${qbVendors.length} vendors from QuickBooks`)

    for (const qbVendor of qbVendors) {
      try {
        // Debug: Log notes for each vendor
        if (qbVendor.Notes) {
          console.log(`[QB Sync] Vendor "${qbVendor.DisplayName}" has Notes: "${qbVendor.Notes}"`)
        }

        const localData = qbVendorToLocal(qbVendor)
        console.log(`[QB Sync] Mapped notes for "${qbVendor.DisplayName}": "${localData.notes}"`)

        // Check if vendor exists locally
        const existingVendor = await prisma.vendor.findUnique({
          where: { quickbooksId: qbVendor.Id }
        })

        if (existingVendor) {
          // Update existing vendor (preserve local-only fields)
          await prisma.vendor.update({
            where: { id: existingVendor.id },
            data: {
              ...localData,
              // Preserve local-only fields
              category: existingVendor.category,
              code: existingVendor.code
            }
          })
          results.updated++
        } else {
          // Create new vendor
          await prisma.vendor.create({
            data: localData
          })
          results.created++
        }
      } catch (error) {
        const errorMsg = `Failed to sync vendor ${qbVendor.DisplayName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }
  } catch (error) {
    throw new Error(`Failed to sync from QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return results
}

// Push local vendor changes to QuickBooks
export async function pushVendorToQB(vendorId: number): Promise<any> {
  const realmId = await getStoredRealmId()
  if (!realmId) {
    throw new Error('QuickBooks not connected')
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId }
  })

  if (!vendor) {
    throw new Error('Vendor not found')
  }

  console.log(`[QB Sync] Pushing vendor ${vendorId} to QuickBooks`)
  console.log(`[QB Sync] Local notes value: "${vendor.notes}"`)

  let result: QBVendor
  if (vendor.quickbooksId) {
    // For updates, fetch the current SyncToken from QuickBooks
    const currentQBVendor = await fetchQBVendor(realmId, vendor.quickbooksId)
    console.log(`[QB Sync] Current QB vendor SyncToken: ${currentQBVendor.SyncToken}`)

    // Build sparse update - only include fields we want to change
    // This avoids issues with read-only fields being rejected
    const sparseUpdate = localVendorToQB(vendor)
    sparseUpdate.Id = currentQBVendor.Id
    sparseUpdate.SyncToken = currentQBVendor.SyncToken
    sparseUpdate.sparse = true  // Tell QB this is a partial update

    console.log(`[QB Sync] Sparse update Notes: "${sparseUpdate.Notes}"`)
    console.log(`[QB Sync] Sending sparse update:`, JSON.stringify(sparseUpdate, null, 2))

    result = await updateQBVendor(realmId, sparseUpdate)
    console.log(`[QB Sync] QB response Notes: "${result.Notes}"`)
  } else {
    // Create new QB vendor
    const qbVendor = localVendorToQB(vendor)
    console.log(`[QB Sync] Creating new vendor, Notes: "${qbVendor.Notes}"`)
    result = await createQBVendor(realmId, qbVendor)
    console.log(`[QB Sync] QB response Notes: "${result.Notes}"`)
  }

  // Update local vendor with QB response
  const updatedVendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      quickbooksId: result.Id,
      syncToken: result.SyncToken,
      balance: result.Balance ?? null,
      lastSyncedAt: new Date()
    },
    include: { contacts: true }
  })

  return updatedVendor
}

// ============ ITEM OPERATIONS ============

// Query all items from QuickBooks
export async function fetchAllQBItems(realmId: string): Promise<QBItem[]> {
  const allItems: QBItem[] = []
  let startPosition = 1
  const maxResults = 1000

  while (true) {
    const query = `SELECT * FROM Item STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const response = await qbApiRequest(realmId, `query?query=${encodeURIComponent(query)}`)

    const items = response.QueryResponse?.Item || []
    allItems.push(...items)

    if (items.length < maxResults) {
      break
    }
    startPosition += maxResults
  }

  console.log(`[QB Sync] Fetched ${allItems.length} items from QuickBooks`)
  return allItems
}

// Get single item from QuickBooks
export async function fetchQBItem(realmId: string, itemId: string): Promise<QBItem> {
  const response = await qbApiRequest(realmId, `item/${itemId}`)
  return response.Item
}

// Create item in QuickBooks
export async function createQBItem(realmId: string, item: QBItem): Promise<QBItem> {
  const response = await qbApiRequest(realmId, 'item', 'POST', item)
  return response.Item
}

// Update item in QuickBooks
export async function updateQBItem(realmId: string, item: QBItem): Promise<QBItem> {
  if (!item.Id || !item.SyncToken) {
    throw new Error('Item Id and SyncToken are required for updates')
  }
  const response = await qbApiRequest(realmId, 'item', 'POST', item)
  return response.Item
}

// Convert QuickBooks item to local format
export function qbItemToLocal(qbItem: QBItem): any {
  return {
    quickbooksId: qbItem.Id,
    syncToken: qbItem.SyncToken,
    name: qbItem.Name,
    sku: qbItem.Sku || null,
    description: qbItem.Description || null,
    type: qbItem.Type || 'Service',
    active: qbItem.Active ?? true,
    unitPrice: qbItem.UnitPrice ?? null,
    purchaseCost: qbItem.PurchaseCost ?? null,
    purchaseDesc: qbItem.PurchaseDesc || null,
    trackQtyOnHand: qbItem.TrackQtyOnHand ?? false,
    qtyOnHand: qbItem.QtyOnHand ?? null,
    reorderPoint: qbItem.ReorderPoint ?? null,
    incomeAccountRefId: qbItem.IncomeAccountRef?.value || null,
    expenseAccountRefId: qbItem.ExpenseAccountRef?.value || null,
    assetAccountRefId: qbItem.AssetAccountRef?.value || null,
    prefVendorRefId: qbItem.PrefVendorRef?.value || null,
    prefVendorRefName: qbItem.PrefVendorRef?.name || null,
    lastSyncedAt: new Date()
  }
}

// Convert local item to QuickBooks format (for creating from MasterPart)
export function localItemToQB(item: any): QBItem {
  const qbItem: QBItem = {
    Name: item.name,
    Type: item.type || 'NonInventory'  // NonInventory is safest default for PO items
  }

  if (item.quickbooksId) qbItem.Id = item.quickbooksId
  if (item.syncToken) qbItem.SyncToken = item.syncToken
  if (item.sku) qbItem.Sku = item.sku
  if (item.description) qbItem.Description = item.description
  if (item.purchaseDesc) qbItem.PurchaseDesc = item.purchaseDesc
  if (item.purchaseCost !== undefined) qbItem.PurchaseCost = item.purchaseCost
  if (item.unitPrice !== undefined) qbItem.UnitPrice = item.unitPrice
  if (item.active !== undefined) qbItem.Active = item.active

  // Account references (required for certain item types)
  if (item.incomeAccountRefId) {
    qbItem.IncomeAccountRef = { value: item.incomeAccountRefId }
  }
  if (item.expenseAccountRefId) {
    qbItem.ExpenseAccountRef = { value: item.expenseAccountRefId }
  }

  return qbItem
}

// Sync all items from QuickBooks to local database
export async function syncItemsFromQB(realmId: string): Promise<{
  created: number
  updated: number
  errors: string[]
}> {
  const results = { created: 0, updated: 0, errors: [] as string[] }

  try {
    const qbItems = await fetchAllQBItems(realmId)

    for (const qbItem of qbItems) {
      try {
        const localData = qbItemToLocal(qbItem)

        // Check if item exists locally
        const existingItem = await prisma.quickBooksItem.findUnique({
          where: { quickbooksId: qbItem.Id }
        })

        if (existingItem) {
          // Update existing item (preserve masterPartId link)
          await prisma.quickBooksItem.update({
            where: { id: existingItem.id },
            data: {
              ...localData,
              masterPartId: existingItem.masterPartId  // Preserve link
            }
          })
          results.updated++
        } else {
          // Create new item
          await prisma.quickBooksItem.create({
            data: localData
          })
          results.created++
        }
      } catch (error) {
        const errorMsg = `Failed to sync item ${qbItem.Name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }
  } catch (error) {
    throw new Error(`Failed to sync items from QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return results
}

// Cached default expense account for on-the-fly items
let cachedExpenseAccountId: string | null = null

// Fetch expense accounts from QuickBooks
export async function fetchExpenseAccounts(realmId: string): Promise<Array<{ Id: string; Name: string; AccountType: string }>> {
  const query = `SELECT Id, Name, AccountType FROM Account WHERE AccountType IN ('Expense', 'Cost of Goods Sold') MAXRESULTS 100`
  const response = await qbApiRequest(realmId, `query?query=${encodeURIComponent(query)}`)
  return response.QueryResponse?.Account || []
}

// Get or fetch default expense account for on-the-fly items
async function getDefaultExpenseAccount(realmId: string): Promise<string | null> {
  if (cachedExpenseAccountId) {
    return cachedExpenseAccountId
  }

  try {
    const accounts = await fetchExpenseAccounts(realmId)

    // Prefer "Cost of Goods Sold" type, then any expense account
    const cogsAccount = accounts.find(a => a.AccountType === 'Cost of Goods Sold')
    const expenseAccount = accounts.find(a => a.AccountType === 'Expense')

    const defaultAccount = cogsAccount || expenseAccount
    if (defaultAccount) {
      cachedExpenseAccountId = defaultAccount.Id
      console.log(`[QB Item] Using default expense account: ${defaultAccount.Name} (${defaultAccount.Id})`)
      return defaultAccount.Id
    }

    console.warn('[QB Item] No expense account found in QuickBooks')
    return null
  } catch (error) {
    console.error('[QB Item] Failed to fetch expense accounts:', error)
    return null
  }
}

// Create a QB item on-the-fly for a PO line with free-text description
export async function createQBItemForPOLine(
  realmId: string,
  description: string,
  unitPrice?: number
): Promise<{ qbItemId: string; localItemId: number }> {
  // Sanitize and truncate the name (QB max is 100 chars)
  let itemName = description.trim().substring(0, 100)

  // Check if an item with this name already exists in QB
  const existingItems = await prisma.quickBooksItem.findMany({
    where: { name: { equals: itemName, mode: 'insensitive' } }
  })

  // If duplicate, add timestamp suffix
  if (existingItems.length > 0) {
    const suffix = `-${Date.now()}`
    itemName = itemName.substring(0, 100 - suffix.length) + suffix
  }

  // Get default expense account for the item
  const expenseAccountId = await getDefaultExpenseAccount(realmId)
  if (!expenseAccountId) {
    throw new Error('No expense account available in QuickBooks. Please set up an expense account.')
  }

  // Create NonInventory item in QB with expense account
  const qbItem: QBItem = {
    Name: itemName,
    Type: 'NonInventory',
    Description: description,
    PurchaseDesc: description,
    Active: true,
    ExpenseAccountRef: { value: expenseAccountId }
  }

  if (unitPrice !== undefined && unitPrice > 0) {
    qbItem.PurchaseCost = unitPrice
  }

  console.log(`[QB Item] Creating on-the-fly item: "${itemName}" with expense account ${expenseAccountId}`)
  const createdItem = await createQBItem(realmId, qbItem)

  // Store in local database
  const localItem = await prisma.quickBooksItem.create({
    data: {
      quickbooksId: createdItem.Id!,
      syncToken: createdItem.SyncToken,
      name: createdItem.Name,
      description: createdItem.Description || null,
      type: createdItem.Type || 'NonInventory',
      active: createdItem.Active ?? true,
      purchaseCost: createdItem.PurchaseCost ?? null,
      purchaseDesc: createdItem.PurchaseDesc || null,
      expenseAccountRefId: expenseAccountId,
      lastSyncedAt: new Date()
    }
  })

  console.log(`[QB Item] Created item "${itemName}" with QB ID: ${createdItem.Id}, local ID: ${localItem.id}`)

  return {
    qbItemId: createdItem.Id!,
    localItemId: localItem.id
  }
}

// ============ PURCHASE ORDER OPERATIONS ============

// Query all purchase orders from QuickBooks
export async function fetchAllQBPurchaseOrders(realmId: string): Promise<QBPurchaseOrder[]> {
  const allPOs: QBPurchaseOrder[] = []
  let startPosition = 1
  const maxResults = 1000

  while (true) {
    const query = `SELECT * FROM PurchaseOrder STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const response = await qbApiRequest(realmId, `query?query=${encodeURIComponent(query)}`)

    const pos = response.QueryResponse?.PurchaseOrder || []
    allPOs.push(...pos)

    if (pos.length < maxResults) {
      break
    }
    startPosition += maxResults
  }

  console.log(`[QB Sync] Fetched ${allPOs.length} purchase orders from QuickBooks`)
  return allPOs
}

// Get single purchase order from QuickBooks
export async function fetchQBPurchaseOrder(realmId: string, poId: string): Promise<QBPurchaseOrder> {
  const response = await qbApiRequest(realmId, `purchaseorder/${poId}`)
  return response.PurchaseOrder
}

// Create purchase order in QuickBooks
export async function createQBPurchaseOrder(realmId: string, po: QBPurchaseOrder): Promise<QBPurchaseOrder> {
  const response = await qbApiRequest(realmId, 'purchaseorder', 'POST', po)
  return response.PurchaseOrder
}

// Update purchase order in QuickBooks
export async function updateQBPurchaseOrder(realmId: string, po: QBPurchaseOrder): Promise<QBPurchaseOrder> {
  if (!po.Id || !po.SyncToken) {
    throw new Error('PurchaseOrder Id and SyncToken are required for updates')
  }
  const response = await qbApiRequest(realmId, 'purchaseorder', 'POST', po)
  return response.PurchaseOrder
}

// Delete (void) purchase order in QuickBooks
export async function deleteQBPurchaseOrder(realmId: string, poId: string, syncToken: string): Promise<void> {
  await qbApiRequest(realmId, `purchaseorder?operation=delete`, 'POST', {
    Id: poId,
    SyncToken: syncToken
  })
}

// Convert QuickBooks PO to local format
export function qbPOToLocal(qbPO: QBPurchaseOrder, vendorId: number): any {
  return {
    quickbooksId: qbPO.Id,
    syncToken: qbPO.SyncToken,
    docNumber: qbPO.DocNumber || null,
    txnDate: qbPO.TxnDate ? new Date(qbPO.TxnDate) : new Date(),
    expectedDate: qbPO.ExpectedDate ? new Date(qbPO.ExpectedDate) : null,
    dueDate: qbPO.DueDate ? new Date(qbPO.DueDate) : null,
    vendorId,
    memo: qbPO.Memo || null,
    privateNote: qbPO.PrivateNote || null,
    totalAmount: qbPO.TotalAmt ?? 0,
    manuallyClosed: qbPO.ManuallyClosed ?? false,
    shipAddrLine1: qbPO.ShipAddr?.Line1 || null,
    shipAddrLine2: qbPO.ShipAddr?.Line2 || null,
    shipAddrCity: qbPO.ShipAddr?.City || null,
    shipAddrState: qbPO.ShipAddr?.CountrySubDivisionCode || null,
    shipAddrPostalCode: qbPO.ShipAddr?.PostalCode || null,
    shipAddrCountry: qbPO.ShipAddr?.Country || null,
    lastSyncedAt: new Date()
  }
}

// Convert local PO to QuickBooks format
export function localPOToQB(po: any, vendorQBId: string, lines: QBPOLine[]): QBPurchaseOrder {
  const qbPO: QBPurchaseOrder = {
    VendorRef: { value: vendorQBId },
    Line: lines
  }

  if (po.quickbooksId) qbPO.Id = po.quickbooksId
  if (po.syncToken) qbPO.SyncToken = po.syncToken
  if (po.docNumber) qbPO.DocNumber = po.docNumber
  if (po.txnDate) qbPO.TxnDate = formatDateForQB(po.txnDate)
  if (po.expectedDate) qbPO.ExpectedDate = formatDateForQB(po.expectedDate)
  if (po.dueDate) qbPO.DueDate = formatDateForQB(po.dueDate)
  if (po.memo) qbPO.Memo = po.memo
  if (po.privateNote) qbPO.PrivateNote = po.privateNote

  // Shipping address
  if (po.shipAddrLine1 || po.shipAddrCity) {
    qbPO.ShipAddr = {}
    if (po.shipAddrLine1) qbPO.ShipAddr.Line1 = po.shipAddrLine1
    if (po.shipAddrLine2) qbPO.ShipAddr.Line2 = po.shipAddrLine2
    if (po.shipAddrCity) qbPO.ShipAddr.City = po.shipAddrCity
    if (po.shipAddrState) qbPO.ShipAddr.CountrySubDivisionCode = po.shipAddrState
    if (po.shipAddrPostalCode) qbPO.ShipAddr.PostalCode = po.shipAddrPostalCode
    if (po.shipAddrCountry) qbPO.ShipAddr.Country = po.shipAddrCountry
  }

  return qbPO
}

// Convert local PO line to QuickBooks format
export function localPOLineToQB(line: any): QBPOLine {
  return {
    Amount: line.amount || (line.quantity * line.unitPrice),
    DetailType: 'ItemBasedExpenseLineDetail',
    ItemBasedExpenseLineDetail: {
      ItemRef: line.itemRefId ? { value: line.itemRefId, name: line.itemRefName } : undefined,
      UnitPrice: line.unitPrice,
      Qty: line.quantity
    },
    Description: line.description || undefined
  }
}

// Helper function to format date for QuickBooks (YYYY-MM-DD)
function formatDateForQB(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

// Generate next PO number (format: PO-YYYY-NNNN)
export async function generatePONumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PO-${year}-`

  // Find the highest PO number for this year
  const lastPO = await prisma.purchaseOrder.findFirst({
    where: {
      poNumber: { startsWith: prefix }
    },
    orderBy: { poNumber: 'desc' }
  })

  let nextNum = 1
  if (lastPO) {
    const lastNumStr = lastPO.poNumber.replace(prefix, '')
    const lastNum = parseInt(lastNumStr, 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}
