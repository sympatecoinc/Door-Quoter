// All available tab IDs in the application
export const ALL_TABS = [
  'dashboard',
  'crm',
  'projects',
  'production',
  'logistics',
  'products',
  'masterParts',
  'inventory',
  'vendors',
  'purchaseOrders',
  'salesOrders',
  'invoices',
  'quoteDocuments',
  'accounting',
  'settings'
] as const

export type TabId = typeof ALL_TABS[number]

export interface TabOverrides {
  add: string[]
  remove: string[]
}

export interface ProfileData {
  id: number
  name: string
  tabs: string[]
}

/**
 * Parse tab overrides from JSON string
 */
export function parseTabOverrides(json: string | null | undefined): TabOverrides {
  if (!json) {
    return { add: [], remove: [] }
  }
  try {
    const parsed = JSON.parse(json)
    return {
      add: Array.isArray(parsed.add) ? parsed.add : [],
      remove: Array.isArray(parsed.remove) ? parsed.remove : []
    }
  } catch {
    return { add: [], remove: [] }
  }
}

/**
 * Serialize tab overrides to JSON string
 */
export function serializeTabOverrides(overrides: TabOverrides): string {
  return JSON.stringify(overrides)
}

/**
 * Calculate the effective permissions for a user
 *
 * Priority:
 * 1. If user has a profile, start with profile tabs
 * 2. If no profile, use legacy permissions array
 * 3. Apply tab overrides (add/remove)
 *
 * @param profile - The user's assigned profile (or null)
 * @param tabOverridesJson - JSON string of tab overrides
 * @param legacyPermissions - Legacy permissions array (fallback when no profile)
 * @returns Array of effective tab IDs
 */
export function calculateEffectivePermissions(
  profile: { tabs: string[] } | null | undefined,
  tabOverridesJson: string | null | undefined,
  legacyPermissions?: string[]
): string[] {
  const overrides = parseTabOverrides(tabOverridesJson)

  // Step 1: Start with base permissions
  let effectiveTabs: Set<string>

  if (profile && profile.tabs.length > 0) {
    // Use profile tabs as base
    effectiveTabs = new Set(profile.tabs)
  } else if (legacyPermissions && legacyPermissions.length > 0) {
    // Fallback to legacy permissions for users without profiles
    effectiveTabs = new Set(legacyPermissions)
  } else {
    // No permissions
    effectiveTabs = new Set()
  }

  // Step 2: Apply additions from overrides
  for (const tab of overrides.add) {
    if (ALL_TABS.includes(tab as TabId)) {
      effectiveTabs.add(tab)
    }
  }

  // Step 3: Apply removals from overrides
  for (const tab of overrides.remove) {
    effectiveTabs.delete(tab)
  }

  // Return sorted for consistency (matching ALL_TABS order)
  return ALL_TABS.filter(tab => effectiveTabs.has(tab))
}

/**
 * Check if a user has access to a specific tab
 */
export function hasTabAccess(
  tabId: string,
  profile: { tabs: string[] } | null | undefined,
  tabOverridesJson: string | null | undefined,
  legacyPermissions?: string[]
): boolean {
  const effectivePermissions = calculateEffectivePermissions(
    profile,
    tabOverridesJson,
    legacyPermissions
  )
  return effectivePermissions.includes(tabId)
}

/**
 * Get the source of each tab permission for display purposes
 * Returns an object mapping tab IDs to their source
 */
export function getPermissionSources(
  profile: { tabs: string[] } | null | undefined,
  tabOverridesJson: string | null | undefined,
  legacyPermissions?: string[]
): Record<string, 'profile' | 'override-add' | 'legacy' | 'override-remove' | 'none'> {
  const overrides = parseTabOverrides(tabOverridesJson)
  const sources: Record<string, 'profile' | 'override-add' | 'legacy' | 'override-remove' | 'none'> = {}

  for (const tab of ALL_TABS) {
    // Check if removed by override
    if (overrides.remove.includes(tab)) {
      sources[tab] = 'override-remove'
      continue
    }

    // Check if added by override
    if (overrides.add.includes(tab)) {
      sources[tab] = 'override-add'
      continue
    }

    // Check if from profile
    if (profile && profile.tabs.includes(tab)) {
      sources[tab] = 'profile'
      continue
    }

    // Check if from legacy permissions
    if (legacyPermissions && legacyPermissions.includes(tab)) {
      sources[tab] = 'legacy'
      continue
    }

    sources[tab] = 'none'
  }

  return sources
}
