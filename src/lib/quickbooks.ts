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

  const url = `${baseUrl}/v3/company/${realmId}/${endpoint}?minorversion=${QB_API_VERSION}`

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
  const response = await qbApiRequest(realmId, 'vendor', 'POST', vendor)
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
  if (vendor.notes) qbVendor.Notes = vendor.notes
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
    console.log(`Fetched ${qbVendors.length} vendors from QuickBooks`)

    for (const qbVendor of qbVendors) {
      try {
        const localData = qbVendorToLocal(qbVendor)

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

  const qbVendor = localVendorToQB(vendor)

  let result: QBVendor
  if (vendor.quickbooksId) {
    // Update existing QB vendor
    result = await updateQBVendor(realmId, qbVendor)
  } else {
    // Create new QB vendor
    result = await createQBVendor(realmId, qbVendor)
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
