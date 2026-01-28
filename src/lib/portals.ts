/**
 * Portal Helper Functions
 *
 * Utilities for subdomain-based portal routing and permission management.
 */

import { prisma } from './prisma'

// Subdomains that should show the full app (not restricted to a portal)
export const MAIN_APP_SUBDOMAINS = ['app', 'www', '']

// Base domain for production (used for cookie sharing across subdomains)
export const BASE_DOMAIN = 'lineamotion.com'

/**
 * Portal configuration as stored in database
 */
export interface PortalConfig {
  id: number
  subdomain: string
  name: string
  description: string | null
  tabs: string[]
  defaultTab: string | null
  headerTitle: string | null
  isActive: boolean
}

/**
 * Portal context returned in session response
 */
export interface PortalContext {
  id: number
  name: string
  subdomain: string
  defaultTab: string | null
  headerTitle: string | null
}

/**
 * Extract subdomain from a hostname
 *
 * Examples:
 * - "purchasing.lineamotion.com" -> "purchasing"
 * - "app.lineamotion.com" -> "app"
 * - "lineamotion.com" -> ""
 * - "localhost:3000" -> ""
 * - "purchasing.localhost:3000" -> "purchasing"
 */
export function getSubdomainFromHostname(hostname: string): string {
  // Remove port if present
  const hostWithoutPort = hostname.split(':')[0]

  // Handle localhost development
  if (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1') {
    return ''
  }

  // Handle *.localhost for local development
  if (hostWithoutPort.endsWith('.localhost')) {
    return hostWithoutPort.replace('.localhost', '')
  }

  // Handle production domains (*.lineamotion.com)
  const parts = hostWithoutPort.split('.')

  // If there are 3+ parts (e.g., purchasing.lineamotion.com), first part is subdomain
  if (parts.length >= 3) {
    return parts[0]
  }

  // If 2 parts (e.g., lineamotion.com), no subdomain
  return ''
}

/**
 * Get the base domain for setting cookies that work across all subdomains
 *
 * Examples:
 * - "purchasing.lineamotion.com" -> ".lineamotion.com"
 * - "localhost:3000" -> undefined (no domain needed for localhost)
 */
export function getBaseDomain(hostname: string): string | undefined {
  const hostWithoutPort = hostname.split(':')[0]

  // For localhost, don't set a domain (cookies work automatically)
  if (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1') {
    return undefined
  }

  // For *.localhost, also don't set a domain
  if (hostWithoutPort.endsWith('.localhost')) {
    return undefined
  }

  // For production, return the base domain with leading dot
  return `.${BASE_DOMAIN}`
}

/**
 * Check if a subdomain is a main app subdomain (full access)
 */
export function isMainAppSubdomain(subdomain: string): boolean {
  return MAIN_APP_SUBDOMAINS.includes(subdomain.toLowerCase())
}

/**
 * Calculate the intersection of user permissions and portal tabs
 *
 * @param userPermissions - User's effective permissions (tabs they can access)
 * @param portalTabs - Tabs allowed by the portal
 * @returns Array of tabs the user can access within this portal
 */
export function getPortalPermissions(
  userPermissions: string[],
  portalTabs: string[]
): string[] {
  // Return only tabs that appear in BOTH arrays
  return userPermissions.filter((tab) => portalTabs.includes(tab))
}

/**
 * Determine the default tab for a user in a portal context
 *
 * Priority:
 * 1. Portal's defaultTab (if user has access to it)
 * 2. First tab from portal that user has access to
 * 3. User's profile defaultTab (for main app)
 * 4. First tab user has access to
 *
 * @param userDefaultTab - User's profile default tab
 * @param userPermissions - User's effective permissions
 * @param portal - Portal configuration (null for main app)
 * @returns The tab ID to navigate to by default
 */
export function getPortalDefaultTab(
  userDefaultTab: string | null,
  userPermissions: string[],
  portal: PortalConfig | null
): string {
  if (portal) {
    // In portal mode: use portal's default if user has access
    const portalPermissions = getPortalPermissions(userPermissions, portal.tabs)

    if (portal.defaultTab && portalPermissions.includes(portal.defaultTab)) {
      return portal.defaultTab
    }

    // Otherwise, first portal tab user has access to
    if (portalPermissions.length > 0) {
      return portalPermissions[0]
    }
  }

  // Main app mode or fallback
  if (userDefaultTab && userPermissions.includes(userDefaultTab)) {
    return userDefaultTab
  }

  // Final fallback: first permission
  return userPermissions[0] || 'dashboard'
}

/**
 * Lookup portal by subdomain from database
 *
 * @param subdomain - The subdomain to look up
 * @returns Portal configuration or null if not found/inactive
 */
export async function getPortalBySubdomain(
  subdomain: string
): Promise<PortalConfig | null> {
  // Main app subdomains don't have a portal restriction
  if (isMainAppSubdomain(subdomain)) {
    return null
  }

  const portal = await prisma.portal.findUnique({
    where: { subdomain: subdomain.toLowerCase() }
  })

  if (!portal || !portal.isActive) {
    return null
  }

  return {
    id: portal.id,
    subdomain: portal.subdomain,
    name: portal.name,
    description: portal.description,
    tabs: portal.tabs,
    defaultTab: portal.defaultTab,
    headerTitle: portal.headerTitle,
    isActive: portal.isActive
  }
}

/**
 * Convert a portal config to a portal context (for session response)
 */
export function toPortalContext(portal: PortalConfig): PortalContext {
  return {
    id: portal.id,
    name: portal.name,
    subdomain: portal.subdomain,
    defaultTab: portal.defaultTab,
    headerTitle: portal.headerTitle
  }
}
