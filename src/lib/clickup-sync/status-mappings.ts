/**
 * Status mappings between ClickUp CRM and ERP
 *
 * ClickUp uses task statuses for workflow stages.
 * ERP uses string fields for status tracking.
 */

// ============ Account Status Mappings ============

export const CLICKUP_ACCOUNT_STATUS_TO_ERP: Record<string, string> = {
  'new account': 'Lead',
  'engaged': 'Active',
  'lost account': 'Archived',
}

export const ERP_CUSTOMER_STATUS_TO_CLICKUP: Record<string, string> = {
  'Lead': 'new account',
  'Active': 'engaged',
  'Archived': 'lost account',
}

// ============ Contact Status Mappings ============

export const CLICKUP_CONTACT_STATUS_TO_ERP_ACTIVE: Record<string, boolean> = {
  'new contact': true,
  'contacted': true,
  'not interested': true,
  'lost contact': false,
}

export const ERP_CONTACT_ACTIVE_TO_CLICKUP: Record<string, string> = {
  'true': 'contacted', // Default active status
  'false': 'lost contact',
}

// ============ Lead/Opportunity Status Mappings ============

export const CLICKUP_LEAD_STATUS_TO_ERP: Record<string, string> = {
  'new lead': 'New',
  'contacted': 'Qualified',
  'quote in progress': 'Proposal',
  'quote sent': 'Negotiation',
  'bid - won': 'Won',
  'bid-won': 'Won',
  'bid - lost': 'Lost',
  'bid-lost': 'Lost',
  'project cancelled': 'Lost',
}

export const ERP_LEAD_STAGE_TO_CLICKUP: Record<string, string> = {
  'New': 'new lead',
  'Qualified': 'contacted',
  'Proposal': 'quote in progress',
  'Negotiation': 'quote sent',
  'Won': 'bid - won',
  'Lost': 'bid - lost',
}

// ============ Engagement Level Mappings ============

export const CLICKUP_ENGAGEMENT_LEVELS = [
  'Lost/Inactive',
  'Prospect',
  'Early Engagement',
  'Active Relationship',
  'Strategic Partner',
] as const

export type EngagementLevel = typeof CLICKUP_ENGAGEMENT_LEVELS[number]

// ============ Account Type Mappings ============

export const CLICKUP_ACCOUNT_TYPES = [
  'Commercial Building Owner',
  'Remodeling Contractor',
  'General Contractor',
  'Architect/Designer',
  'Homeowner',
  'Dealer/Distributor',
  'Other',
] as const

export type AccountType = typeof CLICKUP_ACCOUNT_TYPES[number]

// ============ Relationship Status Mappings ============

export const CLICKUP_RELATIONSHIP_STATUSES = [
  'Strong/Trusted',
  'Warm/Active',
  'New/Recently Introduced',
  'Inactive',
] as const

export type RelationshipStatus = typeof CLICKUP_RELATIONSHIP_STATUSES[number]

// ============ Helper Functions ============

/**
 * Normalize a ClickUp status string for consistent mapping
 */
export function normalizeClickUpStatus(status: string): string {
  return status.toLowerCase().trim()
}

/**
 * Get ERP customer status from ClickUp account status
 */
export function getERPCustomerStatus(clickupStatus: string): string {
  const normalized = normalizeClickUpStatus(clickupStatus)
  return CLICKUP_ACCOUNT_STATUS_TO_ERP[normalized] || 'Active'
}

/**
 * Get ClickUp account status from ERP customer status
 */
export function getClickUpAccountStatus(erpStatus: string): string {
  return ERP_CUSTOMER_STATUS_TO_CLICKUP[erpStatus] || 'engaged'
}

/**
 * Get ERP contact isActive from ClickUp contact status
 */
export function getERPContactIsActive(clickupStatus: string): boolean {
  const normalized = normalizeClickUpStatus(clickupStatus)
  return CLICKUP_CONTACT_STATUS_TO_ERP_ACTIVE[normalized] ?? true
}

/**
 * Get ClickUp contact status from ERP contact isActive
 */
export function getClickUpContactStatus(isActive: boolean): string {
  return ERP_CONTACT_ACTIVE_TO_CLICKUP[String(isActive)] || 'contacted'
}

/**
 * Get ERP lead stage from ClickUp lead status
 */
export function getERPLeadStage(clickupStatus: string): string {
  const normalized = normalizeClickUpStatus(clickupStatus)
  return CLICKUP_LEAD_STATUS_TO_ERP[normalized] || 'New'
}

/**
 * Get ClickUp lead status from ERP lead stage
 */
export function getClickUpLeadStatus(erpStage: string): string {
  return ERP_LEAD_STAGE_TO_CLICKUP[erpStage] || 'new lead'
}
