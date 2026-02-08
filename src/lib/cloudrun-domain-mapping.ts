/**
 * Cloud Run Domain Mapping Management
 *
 * Automatically creates/deletes Cloud Run domain mappings when portals
 * are created/deleted. Uses the Cloud Run v1 (Knative) REST API.
 *
 * Auto-disabled in local dev when env vars are absent (same as GCS).
 * Domain mapping failures never block portal CRUD (fire-and-forget).
 */

import { GoogleAuth } from 'google-auth-library'

interface DomainMappingConfig {
  projectId: string
  region: string
  serviceName: string
  baseDomain: string
}

function getConfig(): DomainMappingConfig | null {
  const projectId = process.env.GCP_PROJECT_ID
  const region = process.env.GCP_REGION
  const serviceName = process.env.CLOUDRUN_SERVICE_NAME
  const baseDomain = process.env.CLOUDRUN_BASE_DOMAIN

  if (!projectId || !serviceName) {
    return null
  }

  return {
    projectId,
    region: region || 'us-central1',
    serviceName,
    baseDomain: baseDomain || 'lineamotion.com',
  }
}

export function isDomainMappingEnabled(): boolean {
  return getConfig() !== null
}

// Lazy-initialized GoogleAuth instance
let _auth: GoogleAuth | null = null
function getAuth(): GoogleAuth {
  if (!_auth) {
    _auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
  }
  return _auth
}

async function getAccessToken(): Promise<string> {
  const auth = getAuth()
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  return tokenResponse.token || ''
}

/**
 * Create a Cloud Run domain mapping for a subdomain.
 * Treats 409 (already exists) as success (idempotent).
 */
export async function createDomainMapping(subdomain: string): Promise<void> {
  const config = getConfig()
  if (!config) {
    console.log('[Domain Mapping] Skipping create — domain mapping not enabled (missing env vars)')
    return
  }

  const domain = `${subdomain}.${config.baseDomain}`
  const url = `https://${config.region}-run.googleapis.com/apis/domains.cloudrun.com/v1/namespaces/${config.projectId}/domainmappings`

  const body = {
    apiVersion: 'domains.cloudrun.com/v1',
    kind: 'DomainMapping',
    metadata: {
      name: domain,
      namespace: config.projectId,
    },
    spec: {
      routeName: config.serviceName,
    },
  }

  const token = await getAccessToken()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (response.ok) {
    console.log(`[Domain Mapping] Created domain mapping for ${domain}`)
    return
  }

  // 409 = already exists, treat as success
  if (response.status === 409) {
    console.log(`[Domain Mapping] Domain mapping for ${domain} already exists (409) — no action needed`)
    return
  }

  const errorText = await response.text()
  throw new Error(`Failed to create domain mapping for ${domain}: ${response.status} ${errorText}`)
}

/**
 * Delete a Cloud Run domain mapping for a subdomain.
 * Treats 404 (not found) as success (idempotent).
 */
export async function deleteDomainMapping(subdomain: string): Promise<void> {
  const config = getConfig()
  if (!config) {
    console.log('[Domain Mapping] Skipping delete — domain mapping not enabled (missing env vars)')
    return
  }

  const domain = `${subdomain}.${config.baseDomain}`
  const url = `https://${config.region}-run.googleapis.com/apis/domains.cloudrun.com/v1/namespaces/${config.projectId}/domainmappings/${domain}`

  const token = await getAccessToken()

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (response.ok) {
    console.log(`[Domain Mapping] Deleted domain mapping for ${domain}`)
    return
  }

  // 404 = doesn't exist, treat as success
  if (response.status === 404) {
    console.log(`[Domain Mapping] Domain mapping for ${domain} not found (404) — no action needed`)
    return
  }

  const errorText = await response.text()
  throw new Error(`Failed to delete domain mapping for ${domain}: ${response.status} ${errorText}`)
}

/**
 * Fire-and-forget: create a domain mapping for a subdomain.
 * Non-blocking — errors are logged but never propagated.
 */
export function triggerDomainMappingCreate(subdomain: string): void {
  if (!isDomainMappingEnabled()) {
    console.log(`[Domain Mapping] Skipping create for "${subdomain}" — domain mapping not enabled`)
    return
  }

  Promise.resolve().then(async () => {
    try {
      await createDomainMapping(subdomain)
    } catch (error) {
      console.error(`[Domain Mapping] Failed to create domain mapping for "${subdomain}":`, error)
    }
  })
}

/**
 * Fire-and-forget: delete a domain mapping for a subdomain.
 * Non-blocking — errors are logged but never propagated.
 */
export function triggerDomainMappingDelete(subdomain: string): void {
  if (!isDomainMappingEnabled()) {
    console.log(`[Domain Mapping] Skipping delete for "${subdomain}" — domain mapping not enabled`)
    return
  }

  Promise.resolve().then(async () => {
    try {
      await deleteDomainMapping(subdomain)
    } catch (error) {
      console.error(`[Domain Mapping] Failed to delete domain mapping for "${subdomain}":`, error)
    }
  })
}
