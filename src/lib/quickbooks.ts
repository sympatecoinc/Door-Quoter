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

// QuickBooks Customer interface
export interface QBCustomer {
  Id?: string
  SyncToken?: string
  DisplayName: string
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  FullyQualifiedName?: string
  Active?: boolean
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  AlternatePhone?: { FreeFormNumber: string }
  Mobile?: { FreeFormNumber: string }
  Fax?: { FreeFormNumber: string }
  WebAddr?: { URI: string }
  BillAddr?: {
    Id?: string
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  ShipAddr?: {
    Id?: string
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  Notes?: string
  Balance?: number
  BalanceWithJobs?: number
  Job?: boolean
  Taxable?: boolean
  sparse?: boolean
}

// QuickBooks Invoice Line interface
export interface QBInvoiceLine {
  Id?: string
  LineNum?: number
  Description?: string
  Amount: number
  DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail'
  SalesItemLineDetail?: {
    ItemRef?: { value: string; name?: string }
    UnitPrice?: number
    Qty?: number
    TaxCodeRef?: { value: string }
  }
}

// QuickBooks Invoice interface
export interface QBInvoice {
  Id?: string
  SyncToken?: string
  DocNumber?: string
  TxnDate?: string  // YYYY-MM-DD
  DueDate?: string
  ShipDate?: string
  CustomerRef: { value: string; name?: string }
  Line?: QBInvoiceLine[]
  BillAddr?: {
    Id?: string
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  ShipAddr?: {
    Id?: string
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  CustomerMemo?: { value: string }
  PrivateNote?: string
  TotalAmt?: number
  Balance?: number
  EmailStatus?: string
  sparse?: boolean
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

// QuickBooks Purchase Order Line interface - supports both item-based and account-based
export interface QBPOLine {
  Id?: string
  LineNum?: number
  Description?: string
  Amount: number
  DetailType: 'ItemBasedExpenseLineDetail' | 'AccountBasedExpenseLineDetail'
  ItemBasedExpenseLineDetail?: {
    ItemRef?: { value: string; name?: string }
    UnitPrice?: number
    Qty?: number
    TaxCodeRef?: { value: string }
    BillableStatus?: string
    CustomerRef?: { value: string; name?: string }
  }
  AccountBasedExpenseLineDetail?: {
    AccountRef: { value: string; name?: string }
    BillableStatus?: string
    CustomerRef?: { value: string; name?: string }
    TaxCodeRef?: { value: string }
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
let cachedDefaultExpenseAccount: { id: string; name: string } | null = null

// Fetch expense accounts from QuickBooks
export async function fetchExpenseAccounts(realmId: string): Promise<Array<{ Id: string; Name: string; AccountType: string }>> {
  const query = `SELECT Id, Name, AccountType FROM Account WHERE AccountType IN ('Expense', 'Cost of Goods Sold') ORDER BY Name MAXRESULTS 100`
  const response = await qbApiRequest(realmId, `query?query=${encodeURIComponent(query)}`)
  return response.QueryResponse?.Account || []
}

// Preferred account names in order of preference (case-insensitive matching)
const PREFERRED_EXPENSE_ACCOUNTS = [
  'cost of goods sold',
  'cogs',
  'purchases',
  'inventory',
  'materials',
  'supplies',
  'job materials',
  'job supplies',
  'cost of sales'
]

// Get or fetch default expense account for on-the-fly items
// Uses smart selection: prefers COGS-type accounts and specific named accounts
export async function getDefaultExpenseAccount(realmId: string): Promise<string | null> {
  if (cachedDefaultExpenseAccount) {
    return cachedDefaultExpenseAccount.id
  }

  try {
    const accounts = await fetchExpenseAccounts(realmId)

    if (accounts.length === 0) {
      console.warn('[QB Item] No expense accounts found in QuickBooks')
      return null
    }

    // First priority: Look for preferred account names
    for (const preferredName of PREFERRED_EXPENSE_ACCOUNTS) {
      const match = accounts.find(a =>
        a.Name.toLowerCase().includes(preferredName) ||
        a.Name.toLowerCase() === preferredName
      )
      if (match) {
        cachedDefaultExpenseAccount = { id: match.Id, name: match.Name }
        console.log(`[QB Item] Using preferred expense account: ${match.Name} (${match.Id})`)
        return match.Id
      }
    }

    // Second priority: Any "Cost of Goods Sold" type account
    const cogsAccount = accounts.find(a => a.AccountType === 'Cost of Goods Sold')
    if (cogsAccount) {
      cachedDefaultExpenseAccount = { id: cogsAccount.Id, name: cogsAccount.Name }
      console.log(`[QB Item] Using COGS-type account: ${cogsAccount.Name} (${cogsAccount.Id})`)
      return cogsAccount.Id
    }

    // Third priority: Any Expense account (but avoid common non-material accounts)
    const avoidAccounts = ['advertising', 'bank charges', 'insurance', 'interest', 'legal', 'office', 'payroll', 'rent', 'utilities', 'travel']
    const safeExpenseAccount = accounts.find(a =>
      a.AccountType === 'Expense' &&
      !avoidAccounts.some(avoid => a.Name.toLowerCase().includes(avoid))
    )
    if (safeExpenseAccount) {
      cachedDefaultExpenseAccount = { id: safeExpenseAccount.Id, name: safeExpenseAccount.Name }
      console.log(`[QB Item] Using expense account: ${safeExpenseAccount.Name} (${safeExpenseAccount.Id})`)
      return safeExpenseAccount.Id
    }

    // Last resort: First available expense account
    const firstAccount = accounts[0]
    cachedDefaultExpenseAccount = { id: firstAccount.Id, name: firstAccount.Name }
    console.log(`[QB Item] Using fallback expense account: ${firstAccount.Name} (${firstAccount.Id})`)
    return firstAccount.Id
  } catch (error) {
    console.error('[QB Item] Failed to fetch expense accounts:', error)
    return null
  }
}

// Get expense account for a vendor (falls back to default if not set)
export async function getVendorExpenseAccount(realmId: string, vendorId: number): Promise<string | null> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { defaultExpenseAccountId: true, defaultExpenseAccountName: true, displayName: true }
    })

    if (vendor?.defaultExpenseAccountId) {
      console.log(`[QB Item] Using vendor "${vendor.displayName}" expense account: ${vendor.defaultExpenseAccountName} (${vendor.defaultExpenseAccountId})`)
      return vendor.defaultExpenseAccountId
    }

    // Fall back to system default
    return getDefaultExpenseAccount(realmId)
  } catch (error) {
    console.error('[QB Item] Failed to get vendor expense account:', error)
    return getDefaultExpenseAccount(realmId)
  }
}

// Clear cached expense account (useful when settings change)
export function clearExpenseAccountCache(): void {
  cachedDefaultExpenseAccount = null
}

// Create a QB item on-the-fly for a PO line with free-text description
// Accepts optional expenseAccountId to use vendor-specific or custom expense account
export async function createQBItemForPOLine(
  realmId: string,
  description: string,
  unitPrice?: number,
  expenseAccountId?: string | null
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

  // Use provided expense account or fall back to default
  const finalExpenseAccountId = expenseAccountId || await getDefaultExpenseAccount(realmId)
  if (!finalExpenseAccountId) {
    throw new Error('No expense account available in QuickBooks. Please set up an expense account.')
  }

  // Create NonInventory item in QB with expense account
  const qbItem: QBItem = {
    Name: itemName,
    Type: 'NonInventory',
    Description: description,
    PurchaseDesc: description,
    Active: true,
    ExpenseAccountRef: { value: finalExpenseAccountId }
  }

  if (unitPrice !== undefined && unitPrice > 0) {
    qbItem.PurchaseCost = unitPrice
  }

  console.log(`[QB Item] Creating on-the-fly item: "${itemName}" with expense account ${finalExpenseAccountId}`)
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
      expenseAccountRefId: finalExpenseAccountId,
      lastSyncedAt: new Date()
    }
  })

  console.log(`[QB Item] Created item "${itemName}" with QB ID: ${createdItem.Id}, local ID: ${localItem.id}`)

  return {
    qbItemId: createdItem.Id!,
    localItemId: localItem.id
  }
}

// Ensure a QuickBooks item has an expense account (required for PO lines)
// If the item doesn't have one, update it in QuickBooks to add the default expense account
export async function ensureItemHasExpenseAccount(
  realmId: string,
  localItemId: number
): Promise<boolean> {
  const localItem = await prisma.quickBooksItem.findUnique({
    where: { id: localItemId }
  })

  if (!localItem || !localItem.quickbooksId) {
    console.log(`[QB Item] Item ${localItemId} not found or has no QB ID`)
    return false
  }

  // Already has expense account
  if (localItem.expenseAccountRefId) {
    return true
  }

  console.log(`[QB Item] Item "${localItem.name}" (${localItem.quickbooksId}) missing expense account, updating...`)

  // Get the default expense account
  const expenseAccountId = await getDefaultExpenseAccount(realmId)
  if (!expenseAccountId) {
    console.error('[QB Item] No default expense account available')
    return false
  }

  try {
    // Fetch current item from QB to get the SyncToken
    const qbItem = await fetchQBItem(realmId, localItem.quickbooksId)

    // Update the item with expense account using sparse update
    const updatePayload: QBItem = {
      Id: qbItem.Id,
      SyncToken: qbItem.SyncToken,
      Name: qbItem.Name,
      ExpenseAccountRef: { value: expenseAccountId },
      sparse: true
    }

    const updatedItem = await updateQBItem(realmId, updatePayload)

    // Update local record
    await prisma.quickBooksItem.update({
      where: { id: localItemId },
      data: {
        expenseAccountRefId: expenseAccountId,
        syncToken: updatedItem.SyncToken,
        lastSyncedAt: new Date()
      }
    })

    console.log(`[QB Item] Updated item "${localItem.name}" with expense account ${expenseAccountId}`)
    return true
  } catch (error) {
    console.error(`[QB Item] Failed to update item "${localItem.name}":`, error)
    return false
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
// Uses ItemBasedExpenseLineDetail if item has ID, otherwise falls back to AccountBasedExpenseLineDetail
export function localPOLineToQB(line: any, fallbackExpenseAccountId?: string): QBPOLine {
  const amount = line.amount || (line.quantity * line.unitPrice)

  // If we have an item reference, use item-based expense line
  if (line.itemRefId) {
    return {
      Amount: amount,
      DetailType: 'ItemBasedExpenseLineDetail',
      ItemBasedExpenseLineDetail: {
        ItemRef: { value: line.itemRefId, name: line.itemRefName },
        UnitPrice: line.unitPrice,
        Qty: line.quantity
      },
      Description: line.description || undefined
    }
  }

  // No item reference - use account-based expense line if we have a fallback account
  if (fallbackExpenseAccountId) {
    return {
      Amount: amount,
      DetailType: 'AccountBasedExpenseLineDetail',
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: fallbackExpenseAccountId }
      },
      Description: line.description || undefined
    }
  }

  // Fallback: item-based without item ref (may cause QB error if no default configured)
  return {
    Amount: amount,
    DetailType: 'ItemBasedExpenseLineDetail',
    ItemBasedExpenseLineDetail: {
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

// ============ CUSTOMER OPERATIONS ============

// Query all customers from QuickBooks
export async function fetchAllQBCustomers(realmId: string): Promise<QBCustomer[]> {
  const allCustomers: QBCustomer[] = []
  let startPosition = 1
  const maxResults = 1000

  while (true) {
    const query = `SELECT * FROM Customer WHERE Active IN (true, false) STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const response = await qbApiRequest(realmId, `query?query=${encodeURIComponent(query)}`)

    const customers = response.QueryResponse?.Customer || []
    allCustomers.push(...customers)

    if (customers.length < maxResults) {
      break
    }
    startPosition += maxResults
  }

  console.log(`[QB Sync] Fetched ${allCustomers.length} customers from QuickBooks`)
  return allCustomers
}

// Get single customer from QuickBooks
export async function fetchQBCustomer(realmId: string, customerId: string): Promise<QBCustomer> {
  const response = await qbApiRequest(realmId, `customer/${customerId}`)
  return response.Customer
}

// Create customer in QuickBooks
export async function createQBCustomer(realmId: string, customer: QBCustomer): Promise<QBCustomer> {
  const response = await qbApiRequest(realmId, 'customer', 'POST', customer)
  return response.Customer
}

// Update customer in QuickBooks
export async function updateQBCustomer(realmId: string, customer: QBCustomer): Promise<QBCustomer> {
  if (!customer.Id || !customer.SyncToken) {
    throw new Error('Customer Id and SyncToken are required for updates')
  }
  const response = await qbApiRequest(realmId, 'customer', 'POST', customer)
  return response.Customer
}

// Convert QuickBooks customer to local format
export function qbCustomerToLocal(qbCustomer: QBCustomer): any {
  return {
    quickbooksId: qbCustomer.Id,
    syncToken: qbCustomer.SyncToken,
    companyName: qbCustomer.CompanyName || qbCustomer.DisplayName,
    contactName: qbCustomer.GivenName && qbCustomer.FamilyName
      ? `${qbCustomer.GivenName} ${qbCustomer.FamilyName}`
      : null,
    email: qbCustomer.PrimaryEmailAddr?.Address || null,
    phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
    address: qbCustomer.BillAddr?.Line1 || null,
    city: qbCustomer.BillAddr?.City || null,
    state: qbCustomer.BillAddr?.CountrySubDivisionCode || null,
    zipCode: qbCustomer.BillAddr?.PostalCode || null,
    country: qbCustomer.BillAddr?.Country || 'USA',
    notes: qbCustomer.Notes || null,
    status: qbCustomer.Active === false ? 'Archived' : 'Active',
    lastSyncedAt: new Date()
  }
}

// Convert local customer to QuickBooks format
export function localCustomerToQB(customer: any): QBCustomer {
  const qbCustomer: QBCustomer = {
    DisplayName: customer.companyName
  }

  if (customer.quickbooksId) qbCustomer.Id = customer.quickbooksId
  if (customer.syncToken) qbCustomer.SyncToken = customer.syncToken

  if (customer.companyName) qbCustomer.CompanyName = customer.companyName

  // Parse contact name into first/last
  if (customer.contactName) {
    const parts = customer.contactName.trim().split(' ')
    if (parts.length >= 2) {
      qbCustomer.GivenName = parts[0]
      qbCustomer.FamilyName = parts.slice(1).join(' ')
    } else {
      qbCustomer.GivenName = customer.contactName
    }
  }

  if (customer.email) {
    qbCustomer.PrimaryEmailAddr = { Address: customer.email }
  }
  if (customer.phone) {
    qbCustomer.PrimaryPhone = { FreeFormNumber: customer.phone }
  }

  // Billing Address
  if (customer.address || customer.city || customer.state) {
    qbCustomer.BillAddr = {}
    if (customer.address) qbCustomer.BillAddr.Line1 = customer.address
    if (customer.city) qbCustomer.BillAddr.City = customer.city
    if (customer.state) qbCustomer.BillAddr.CountrySubDivisionCode = customer.state
    if (customer.zipCode) qbCustomer.BillAddr.PostalCode = customer.zipCode
    if (customer.country) qbCustomer.BillAddr.Country = customer.country
  }

  if (customer.notes) qbCustomer.Notes = customer.notes
  qbCustomer.Active = customer.status !== 'Archived'

  return qbCustomer
}

// Sync all customers from QuickBooks to local database
export async function syncCustomersFromQB(realmId: string): Promise<{
  created: number
  updated: number
  errors: string[]
}> {
  const results = { created: 0, updated: 0, errors: [] as string[] }

  try {
    const qbCustomers = await fetchAllQBCustomers(realmId)
    console.log(`[QB Sync] Syncing ${qbCustomers.length} customers from QuickBooks`)

    for (const qbCustomer of qbCustomers) {
      try {
        const localData = qbCustomerToLocal(qbCustomer)

        // Check if customer exists locally by quickbooksId
        const existingByQBId = await prisma.customer.findUnique({
          where: { quickbooksId: qbCustomer.Id }
        })

        if (existingByQBId) {
          // Update existing customer
          await prisma.customer.update({
            where: { id: existingByQBId.id },
            data: {
              ...localData,
              // Preserve local-only fields
              source: existingByQBId.source
            }
          })
          results.updated++
        } else {
          // Check if customer exists by email (for matching)
          const existingByEmail = localData.email
            ? await prisma.customer.findUnique({ where: { email: localData.email } })
            : null

          if (existingByEmail) {
            // Link existing customer to QB
            await prisma.customer.update({
              where: { id: existingByEmail.id },
              data: {
                quickbooksId: qbCustomer.Id,
                syncToken: qbCustomer.SyncToken,
                lastSyncedAt: new Date()
              }
            })
            results.updated++
          } else {
            // Create new customer
            await prisma.customer.create({
              data: localData
            })
            results.created++
          }
        }
      } catch (error) {
        const errorMsg = `Failed to sync customer ${qbCustomer.DisplayName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }
  } catch (error) {
    throw new Error(`Failed to sync customers from QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return results
}

// Push local customer to QuickBooks
export async function pushCustomerToQB(customerId: number): Promise<any> {
  const realmId = await getStoredRealmId()
  if (!realmId) {
    throw new Error('QuickBooks not connected')
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  console.log(`[QB Sync] Pushing customer ${customerId} to QuickBooks`)

  let result: QBCustomer
  if (customer.quickbooksId) {
    // Update existing QB customer
    const currentQBCustomer = await fetchQBCustomer(realmId, customer.quickbooksId)

    const sparseUpdate = localCustomerToQB(customer)
    sparseUpdate.Id = currentQBCustomer.Id
    sparseUpdate.SyncToken = currentQBCustomer.SyncToken
    sparseUpdate.sparse = true

    result = await updateQBCustomer(realmId, sparseUpdate)
  } else {
    // Create new QB customer
    const qbCustomer = localCustomerToQB(customer)
    result = await createQBCustomer(realmId, qbCustomer)
  }

  // Update local customer with QB response
  const updatedCustomer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      quickbooksId: result.Id,
      syncToken: result.SyncToken,
      lastSyncedAt: new Date()
    }
  })

  return updatedCustomer
}

// ============ INVOICE (SALES ORDER) OPERATIONS ============

// Query all invoices from QuickBooks
export async function fetchAllQBInvoices(realmId: string): Promise<QBInvoice[]> {
  const allInvoices: QBInvoice[] = []
  let startPosition = 1
  const maxResults = 1000

  while (true) {
    const query = `SELECT * FROM Invoice STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const response = await qbApiRequest(realmId, `query?query=${encodeURIComponent(query)}`)

    const invoices = response.QueryResponse?.Invoice || []
    allInvoices.push(...invoices)

    if (invoices.length < maxResults) {
      break
    }
    startPosition += maxResults
  }

  console.log(`[QB Sync] Fetched ${allInvoices.length} invoices from QuickBooks`)
  return allInvoices
}

// Get single invoice from QuickBooks
export async function fetchQBInvoice(realmId: string, invoiceId: string): Promise<QBInvoice> {
  const response = await qbApiRequest(realmId, `invoice/${invoiceId}`)
  return response.Invoice
}

// Create invoice in QuickBooks
export async function createQBInvoice(realmId: string, invoice: QBInvoice): Promise<QBInvoice> {
  const response = await qbApiRequest(realmId, 'invoice', 'POST', invoice)
  return response.Invoice
}

// Update invoice in QuickBooks
export async function updateQBInvoice(realmId: string, invoice: QBInvoice): Promise<QBInvoice> {
  if (!invoice.Id || !invoice.SyncToken) {
    throw new Error('Invoice Id and SyncToken are required for updates')
  }
  const response = await qbApiRequest(realmId, 'invoice', 'POST', invoice)
  return response.Invoice
}

// Void invoice in QuickBooks
export async function voidQBInvoice(realmId: string, invoiceId: string, syncToken: string): Promise<void> {
  await qbApiRequest(realmId, `invoice?operation=void`, 'POST', {
    Id: invoiceId,
    SyncToken: syncToken
  })
}

// Convert QuickBooks invoice to local SalesOrder format
export function qbInvoiceToLocal(qbInvoice: QBInvoice, customerId: number): any {
  return {
    quickbooksId: qbInvoice.Id,
    syncToken: qbInvoice.SyncToken,
    docNumber: qbInvoice.DocNumber || null,
    txnDate: qbInvoice.TxnDate ? new Date(qbInvoice.TxnDate) : new Date(),
    dueDate: qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : null,
    shipDate: qbInvoice.ShipDate ? new Date(qbInvoice.ShipDate) : null,
    customerId,
    customerMemo: qbInvoice.CustomerMemo?.value || null,
    privateNote: qbInvoice.PrivateNote || null,
    totalAmount: qbInvoice.TotalAmt ?? 0,
    balance: qbInvoice.Balance ?? 0,
    billAddrLine1: qbInvoice.BillAddr?.Line1 || null,
    billAddrLine2: qbInvoice.BillAddr?.Line2 || null,
    billAddrCity: qbInvoice.BillAddr?.City || null,
    billAddrState: qbInvoice.BillAddr?.CountrySubDivisionCode || null,
    billAddrPostalCode: qbInvoice.BillAddr?.PostalCode || null,
    billAddrCountry: qbInvoice.BillAddr?.Country || null,
    shipAddrLine1: qbInvoice.ShipAddr?.Line1 || null,
    shipAddrLine2: qbInvoice.ShipAddr?.Line2 || null,
    shipAddrCity: qbInvoice.ShipAddr?.City || null,
    shipAddrState: qbInvoice.ShipAddr?.CountrySubDivisionCode || null,
    shipAddrPostalCode: qbInvoice.ShipAddr?.PostalCode || null,
    shipAddrCountry: qbInvoice.ShipAddr?.Country || null,
    lastSyncedAt: new Date()
  }
}

// Generate next SO number (format: SO-YYYY-NNNN)
export async function generateSONumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `SO-${year}-`

  // Find the highest SO number for this year
  const lastSO = await prisma.salesOrder.findFirst({
    where: {
      orderNumber: { startsWith: prefix }
    },
    orderBy: { orderNumber: 'desc' }
  })

  let nextNum = 1
  if (lastSO) {
    const lastNumStr = lastSO.orderNumber.replace(prefix, '')
    const lastNum = parseInt(lastNumStr, 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}

// Push local Purchase Order to QuickBooks
export async function pushPOToQB(poId: number): Promise<any> {
  const realmId = await getStoredRealmId()
  if (!realmId) {
    throw new Error('QuickBooks not connected')
  }

  let po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      vendor: true,
      lines: {
        include: { quickbooksItem: true }
      }
    }
  })

  if (!po) {
    throw new Error('Purchase Order not found')
  }

  if (!po.vendor?.quickbooksId) {
    throw new Error(`Vendor "${po.vendor?.displayName}" is not synced to QuickBooks. Sync vendors first.`)
  }

  console.log(`[QB Sync] Pushing PO ${po.poNumber} to QuickBooks`)

  // Get expense account - prefer vendor's account, then system default
  const expenseAccountId = await getVendorExpenseAccount(realmId, po.vendor.id)

  // Create QB items on-the-fly for lines without item references
  // This ensures all lines use ItemBasedExpenseLineDetail which supports Qty
  for (const line of po.lines) {
    const hasQBItem = line.quickbooksItem?.quickbooksId || line.itemRefId
    if (!hasQBItem && line.description) {
      try {
        console.log(`[QB Sync] Creating QB item for line: "${line.description}"`)
        const { qbItemId, localItemId } = await createQBItemForPOLine(
          realmId,
          line.description,
          line.unitPrice,
          expenseAccountId
        )

        // Update the local line with the new item reference
        await prisma.purchaseOrderLine.update({
          where: { id: line.id },
          data: {
            quickbooksItemId: localItemId,
            itemRefId: qbItemId,
            itemRefName: line.description
          }
        })
        console.log(`[QB Sync] Created QB item ${qbItemId} for line "${line.description}"`)
      } catch (itemError) {
        console.error(`[QB Sync] Failed to create QB item for "${line.description}":`, itemError)
        // Continue - line will fall back to AccountBasedExpenseLineDetail
      }
    }
  }

  // Refresh PO to get updated line data after item creation
  po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      vendor: true,
      lines: {
        include: { quickbooksItem: true }
      }
    }
  }) as typeof po

  // Build QB PO lines - use quickbooksItem.quickbooksId if available, then itemRefId
  const qbLines: QBPOLine[] = []
  for (const line of po.lines) {
    const qbLine = localPOLineToQB({
      itemRefId: line.quickbooksItem?.quickbooksId || line.itemRefId,
      itemRefName: line.quickbooksItem?.name || line.itemRefName,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount
    }, expenseAccountId || undefined)
    qbLines.push(qbLine)
  }

  let result: QBPurchaseOrder
  // vendor.quickbooksId is guaranteed to be non-null (checked at start of function)
  const vendorQBId = po.vendor.quickbooksId!

  if (po.quickbooksId) {
    // Update existing QB PO
    const currentQBPO = await fetchQBPurchaseOrder(realmId, po.quickbooksId)

    const updatePayload = localPOToQB(po, vendorQBId, qbLines)
    updatePayload.Id = currentQBPO.Id
    updatePayload.SyncToken = currentQBPO.SyncToken
    updatePayload.sparse = true

    result = await updateQBPurchaseOrder(realmId, updatePayload)
  } else {
    // Create new QB PO
    const createPayload = localPOToQB(po, vendorQBId, qbLines)
    result = await createQBPurchaseOrder(realmId, createPayload)
  }

  // Update local PO with QB response
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      quickbooksId: result.Id,
      syncToken: result.SyncToken,
      docNumber: result.DocNumber || po.docNumber,
      lastSyncedAt: new Date()
    },
    include: {
      vendor: true,
      lines: true
    }
  })

  console.log(`[QB Sync] PO ${po.poNumber} synced to QB with ID: ${result.Id}`)
  return updatedPO
}

// =====================================
// INVOICE-SPECIFIC FUNCTIONS
// =====================================

// Generate next Invoice number (format: INV-YYYY-NNNN)
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  // Find the highest invoice number for this year
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: { startsWith: prefix }
    },
    orderBy: { invoiceNumber: 'desc' }
  })

  let nextNum = 1
  if (lastInvoice) {
    const lastNumStr = lastInvoice.invoiceNumber.replace(prefix, '')
    const lastNum = parseInt(lastNumStr, 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}

// Convert local Invoice to QuickBooks Invoice format
export function localInvoiceToQB(invoice: any, customerQBId: string, lines: QBInvoiceLine[]): QBInvoice {
  const qbInvoice: QBInvoice = {
    CustomerRef: { value: customerQBId },
    Line: lines,
    TxnDate: invoice.txnDate ? new Date(invoice.txnDate).toISOString().split('T')[0] : undefined,
    DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
    ShipDate: invoice.shipDate ? new Date(invoice.shipDate).toISOString().split('T')[0] : undefined,
    DocNumber: invoice.invoiceNumber // Use invoice number as QB DocNumber
  }

  // Billing address
  if (invoice.billAddrLine1 || invoice.billAddrCity) {
    qbInvoice.BillAddr = {
      Line1: invoice.billAddrLine1 || undefined,
      Line2: invoice.billAddrLine2 || undefined,
      City: invoice.billAddrCity || undefined,
      CountrySubDivisionCode: invoice.billAddrState || undefined,
      PostalCode: invoice.billAddrPostalCode || undefined,
      Country: invoice.billAddrCountry || undefined
    }
  }

  // Shipping address
  if (invoice.shipAddrLine1 || invoice.shipAddrCity) {
    qbInvoice.ShipAddr = {
      Line1: invoice.shipAddrLine1 || undefined,
      Line2: invoice.shipAddrLine2 || undefined,
      City: invoice.shipAddrCity || undefined,
      CountrySubDivisionCode: invoice.shipAddrState || undefined,
      PostalCode: invoice.shipAddrPostalCode || undefined,
      Country: invoice.shipAddrCountry || undefined
    }
  }

  // Customer memo
  if (invoice.customerMemo) {
    qbInvoice.CustomerMemo = { value: invoice.customerMemo }
  }

  // Private note
  if (invoice.privateNote) {
    qbInvoice.PrivateNote = invoice.privateNote
  }

  return qbInvoice
}

// Convert local InvoiceLine to QuickBooks invoice line format
export function localInvoiceLineToQB(line: any): QBInvoiceLine {
  const qbLine: QBInvoiceLine = {
    Amount: line.amount,
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      UnitPrice: line.unitPrice,
      Qty: line.quantity
    },
    Description: line.description || undefined
  }

  // Only include ItemRef if an item is specified - omit entirely to avoid QB defaulting to "Services"
  if (line.itemRefId) {
    qbLine.SalesItemLineDetail!.ItemRef = { value: line.itemRefId, name: line.itemRefName || undefined }
  }

  return qbLine
}

// Convert QuickBooks Invoice to local Invoice format
export function qbInvoiceToLocalInvoice(qbInvoice: QBInvoice, customerId: number): any {
  return {
    quickbooksId: qbInvoice.Id,
    syncToken: qbInvoice.SyncToken,
    docNumber: qbInvoice.DocNumber,
    customerId,
    txnDate: qbInvoice.TxnDate ? new Date(qbInvoice.TxnDate) : new Date(),
    dueDate: qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : null,
    shipDate: qbInvoice.ShipDate ? new Date(qbInvoice.ShipDate) : null,
    billAddrLine1: qbInvoice.BillAddr?.Line1 || null,
    billAddrLine2: qbInvoice.BillAddr?.Line2 || null,
    billAddrCity: qbInvoice.BillAddr?.City || null,
    billAddrState: qbInvoice.BillAddr?.CountrySubDivisionCode || null,
    billAddrPostalCode: qbInvoice.BillAddr?.PostalCode || null,
    billAddrCountry: qbInvoice.BillAddr?.Country || null,
    shipAddrLine1: qbInvoice.ShipAddr?.Line1 || null,
    shipAddrLine2: qbInvoice.ShipAddr?.Line2 || null,
    shipAddrCity: qbInvoice.ShipAddr?.City || null,
    shipAddrState: qbInvoice.ShipAddr?.CountrySubDivisionCode || null,
    shipAddrPostalCode: qbInvoice.ShipAddr?.PostalCode || null,
    shipAddrCountry: qbInvoice.ShipAddr?.Country || null,
    subtotal: qbInvoice.TotalAmt || 0,
    taxAmount: 0, // QB doesn't break out tax in a simple way
    totalAmount: qbInvoice.TotalAmt || 0,
    balance: qbInvoice.Balance ?? qbInvoice.TotalAmt ?? 0,
    customerMemo: qbInvoice.CustomerMemo?.value || null,
    privateNote: qbInvoice.PrivateNote || null,
    lastSyncedAt: new Date()
  }
}

// Push local Invoice to QuickBooks
export async function pushInvoiceToQB(invoiceId: number): Promise<any> {
  const realmId = await getStoredRealmId()
  if (!realmId) {
    throw new Error('QuickBooks not connected')
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      lines: true
    }
  })

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  if (!invoice.customer?.quickbooksId) {
    throw new Error(`Customer "${invoice.customer?.companyName}" is not synced to QuickBooks. Sync customers first.`)
  }

  console.log(`[QB Sync] Pushing Invoice ${invoice.invoiceNumber} to QuickBooks`)

  // Build QB Invoice lines
  const qbLines: QBInvoiceLine[] = invoice.lines.map(line => localInvoiceLineToQB({
    itemRefId: line.itemRefId,
    itemRefName: line.itemRefName,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    amount: line.amount
  }))

  let result: QBInvoice
  if (invoice.quickbooksId) {
    // Update existing QB Invoice
    const currentQBInvoice = await fetchQBInvoice(realmId, invoice.quickbooksId)

    const updatePayload = localInvoiceToQB(invoice, invoice.customer.quickbooksId, qbLines)
    updatePayload.Id = currentQBInvoice.Id
    updatePayload.SyncToken = currentQBInvoice.SyncToken
    updatePayload.sparse = true

    result = await updateQBInvoice(realmId, updatePayload)
  } else {
    // Create new QB Invoice
    const createPayload = localInvoiceToQB(invoice, invoice.customer.quickbooksId, qbLines)
    result = await createQBInvoice(realmId, createPayload)
  }

  // Update local Invoice with QB response
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      quickbooksId: result.Id,
      syncToken: result.SyncToken,
      docNumber: result.DocNumber || invoice.docNumber,
      // Keep as DRAFT - pushing to QB doesn't mean it's been sent to customer
      // Status will update to SENT when syncing from QB if EmailStatus === 'EmailSent'
      lastSyncedAt: new Date()
    },
    include: {
      customer: true,
      lines: true
    }
  })

  console.log(`[QB Sync] Invoice ${invoice.invoiceNumber} synced to QB with ID: ${result.Id}`)
  return updatedInvoice
}

// ============================================================
// QuickBooks Estimate (for Sales Orders)
// ============================================================

// QuickBooks Estimate interface
export interface QBEstimate {
  Id?: string
  SyncToken?: string
  DocNumber?: string
  TxnDate?: string  // YYYY-MM-DD
  ExpirationDate?: string  // Estimate expiry date
  CustomerRef: { value: string; name?: string }
  Line?: QBInvoiceLine[]  // Same format as invoice lines
  BillAddr?: {
    Id?: string
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  ShipAddr?: {
    Id?: string
    Line1?: string
    Line2?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  CustomerMemo?: { value: string }
  PrivateNote?: string
  TotalAmt?: number
  TxnStatus?: string  // Accepted, Closed, Pending, Rejected
  AcceptedDate?: string
  sparse?: boolean
}

// Get estimate from QuickBooks
export async function getQBEstimate(realmId: string, estimateId: string): Promise<QBEstimate> {
  const response = await qbApiRequest(realmId, `estimate/${estimateId}`, 'GET')
  return response.Estimate
}

// Create estimate in QuickBooks
export async function createQBEstimateAPI(realmId: string, estimate: QBEstimate): Promise<QBEstimate> {
  const response = await qbApiRequest(realmId, 'estimate', 'POST', estimate)
  return response.Estimate
}

// Update estimate in QuickBooks
export async function updateQBEstimateAPI(realmId: string, estimate: QBEstimate): Promise<QBEstimate> {
  if (!estimate.Id || !estimate.SyncToken) {
    throw new Error('Estimate Id and SyncToken are required for updates')
  }
  const response = await qbApiRequest(realmId, 'estimate', 'POST', estimate)
  return response.Estimate
}

// Delete/void estimate in QuickBooks
export async function voidQBEstimate(realmId: string, estimateId: string, syncToken: string): Promise<void> {
  await qbApiRequest(realmId, `estimate?operation=delete`, 'POST', {
    Id: estimateId,
    SyncToken: syncToken
  })
}

// ============ DEACTIVATION FUNCTIONS ============
// QuickBooks doesn't allow deleting Vendors, Customers, or Items that have transactions
// Instead, we deactivate them by setting Active: false

// Deactivate a vendor in QuickBooks (set Active: false)
export async function deactivateQBVendor(realmId: string, vendorId: string, syncToken: string): Promise<QBVendor> {
  const response = await qbApiRequest(realmId, 'vendor', 'POST', {
    Id: vendorId,
    SyncToken: syncToken,
    Active: false,
    sparse: true
  })
  return response.Vendor
}

// Deactivate a customer in QuickBooks (set Active: false)
export async function deactivateQBCustomer(realmId: string, customerId: string, syncToken: string): Promise<QBCustomer> {
  const response = await qbApiRequest(realmId, 'customer', 'POST', {
    Id: customerId,
    SyncToken: syncToken,
    Active: false,
    sparse: true
  })
  return response.Customer
}

// Deactivate an item in QuickBooks (set Active: false)
export async function deactivateQBItem(realmId: string, itemId: string, syncToken: string): Promise<QBItem> {
  const response = await qbApiRequest(realmId, 'item', 'POST', {
    Id: itemId,
    SyncToken: syncToken,
    Active: false,
    sparse: true
  })
  return response.Item
}

// Convert local SalesOrder to QuickBooks Estimate format
export function localSOToQBEstimate(salesOrder: any, customerQBId: string): QBEstimate {
  const qbEstimate: QBEstimate = {
    CustomerRef: { value: customerQBId },
    TxnDate: salesOrder.txnDate ? new Date(salesOrder.txnDate).toISOString().split('T')[0] : undefined,
    ExpirationDate: salesOrder.dueDate ? new Date(salesOrder.dueDate).toISOString().split('T')[0] : undefined,
    DocNumber: salesOrder.orderNumber
  }

  // Billing address
  if (salesOrder.billAddrLine1 || salesOrder.billAddrCity) {
    qbEstimate.BillAddr = {
      Line1: salesOrder.billAddrLine1 || undefined,
      Line2: salesOrder.billAddrLine2 || undefined,
      City: salesOrder.billAddrCity || undefined,
      CountrySubDivisionCode: salesOrder.billAddrState || undefined,
      PostalCode: salesOrder.billAddrPostalCode || undefined,
      Country: salesOrder.billAddrCountry || undefined
    }
  }

  // Shipping address
  if (salesOrder.shipAddrLine1 || salesOrder.shipAddrCity) {
    qbEstimate.ShipAddr = {
      Line1: salesOrder.shipAddrLine1 || undefined,
      Line2: salesOrder.shipAddrLine2 || undefined,
      City: salesOrder.shipAddrCity || undefined,
      CountrySubDivisionCode: salesOrder.shipAddrState || undefined,
      PostalCode: salesOrder.shipAddrPostalCode || undefined,
      Country: salesOrder.shipAddrCountry || undefined
    }
  }

  // Customer memo
  if (salesOrder.customerMemo) {
    qbEstimate.CustomerMemo = { value: salesOrder.customerMemo }
  }

  // Private note
  if (salesOrder.privateNote) {
    qbEstimate.PrivateNote = salesOrder.privateNote
  }

  // Line items
  if (salesOrder.lines && salesOrder.lines.length > 0) {
    qbEstimate.Line = salesOrder.lines.map((line: any): QBInvoiceLine => {
      const qbLine: QBInvoiceLine = {
        Amount: line.amount,
        DetailType: 'SalesItemLineDetail',
        Description: line.description,
        SalesItemLineDetail: {
          UnitPrice: line.unitPrice,
          Qty: line.quantity
        }
      }

      // Only include ItemRef if an item is specified - omit entirely to avoid QB defaulting to "Services"
      if (line.itemRefId) {
        qbLine.SalesItemLineDetail!.ItemRef = { value: line.itemRefId, name: line.itemRefName || undefined }
      }

      return qbLine
    })
  }

  return qbEstimate
}

// Create QuickBooks Estimate from Sales Order
export async function createQBEstimate(salesOrder: any): Promise<QBEstimate | null> {
  const realmId = await getStoredRealmId()
  if (!realmId) {
    console.warn('[QB] QuickBooks not connected - skipping Estimate creation')
    return null
  }

  // Check if customer has QB ID
  const customerQBId = salesOrder.customer?.quickbooksId
  if (!customerQBId) {
    console.warn('[QB] Customer does not have QuickBooks ID - skipping Estimate creation')
    return null
  }

  // Convert SO to QB Estimate format
  const qbEstimate = localSOToQBEstimate(salesOrder, customerQBId)

  try {
    const result = await createQBEstimateAPI(realmId, qbEstimate)
    console.log(`[QB Sync] Estimate ${salesOrder.orderNumber} created in QB with ID: ${result.Id}`)
    return result
  } catch (error) {
    console.error('[QB] Failed to create Estimate:', error)
    throw error
  }
}

// Update QuickBooks Estimate from Sales Order
export async function updateQBEstimate(salesOrder: any): Promise<QBEstimate | null> {
  const realmId = await getStoredRealmId()
  if (!realmId) {
    console.warn('[QB] QuickBooks not connected - skipping Estimate update')
    return null
  }

  if (!salesOrder.quickbooksId || !salesOrder.syncToken) {
    console.warn('[QB] Sales Order does not have QuickBooks ID - cannot update')
    return null
  }

  const customerQBId = salesOrder.customer?.quickbooksId
  if (!customerQBId) {
    console.warn('[QB] Customer does not have QuickBooks ID - cannot update Estimate')
    return null
  }

  // Convert SO to QB Estimate format
  const qbEstimate = localSOToQBEstimate(salesOrder, customerQBId)
  qbEstimate.Id = salesOrder.quickbooksId
  qbEstimate.SyncToken = salesOrder.syncToken

  try {
    const result = await updateQBEstimateAPI(realmId, qbEstimate)
    console.log(`[QB Sync] Estimate ${salesOrder.orderNumber} updated in QB`)
    return result
  } catch (error) {
    console.error('[QB] Failed to update Estimate:', error)
    throw error
  }
}
