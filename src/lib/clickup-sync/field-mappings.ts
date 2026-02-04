/**
 * Field mappings between ClickUp CRM custom fields and ERP fields
 *
 * ClickUp custom fields are identified by their field IDs.
 * These IDs are specific to each ClickUp workspace and list.
 */

import type { ClickUpCustomFieldValue, ClickUpTask } from '../clickup-client'

// ============ Custom Field IDs (from ClickUp CRM Space) ============
// These should be configured via environment or fetched dynamically

export const ACCOUNT_CUSTOM_FIELDS = {
  address: '[LM] Address',
  city: '[LM] City',
  state: '[LM] State',
  zipCode: '[LM] Zip Code',
  phone: '[LM] Phone Number',
  accountOwner: '[LM] Account Owner',
  engagementLevel: '[LM] Account Engagement Level',
  accountType: '[LM] Account Type',
} as const

export const CONTACT_CUSTOM_FIELDS = {
  phone: '[LM] Phone Number',
  email: '[LM] Email Address',
  associatedAccount: '[LM] Associated Account',
  contactRole: '[LM] Contact Role',
  relationshipStatus: '[LM] Relationship Status',
  lastContactDate: '[LM] Last Contact Date',
  address: '[LM] Address',
  city: '[LM] City',
  state: '[LM] State',
  zipCode: '[LM] Zip Code',
} as const

export const LEAD_CUSTOM_FIELDS = {
  opportunityValue: 'Opportunity Value',
  contactPhone: 'Contact Phone Number',
  contactEmail: 'Contact Email Address',
  associatedAccount: '[LM] Associated Account',
  associatedContacts: '[LM] Associated Contacts',
  accountOwner: '[LM] Account Owner',
  lastContactDate: '[LM] Last Contact Date',
  aluminumColors: 'Aluminum Colors',
} as const

// ============ Field Value Extractors ============

/**
 * Get a custom field value from a ClickUp task by field name
 */
export function getCustomFieldValue(
  task: ClickUpTask,
  fieldName: string
): any {
  const field = task.custom_fields?.find(
    (f) => f.name === fieldName
  )
  return field?.value
}

/**
 * Get a custom field by name from a task
 */
export function getCustomField(
  task: ClickUpTask,
  fieldName: string
): ClickUpCustomFieldValue | undefined {
  return task.custom_fields?.find((f) => f.name === fieldName)
}

/**
 * Extract text value from a custom field (handles short_text, text, email types)
 */
export function extractTextValue(field: ClickUpCustomFieldValue | undefined): string | null {
  if (!field || field.value === undefined || field.value === null) return null

  // For text/short_text/email fields, value is the string directly
  if (typeof field.value === 'string') {
    return field.value || null
  }

  return null
}

/**
 * Extract phone value from a phone custom field
 */
export function extractPhoneValue(field: ClickUpCustomFieldValue | undefined): string | null {
  if (!field || field.value === undefined || field.value === null) return null

  // Phone fields have value as string with country code or object
  if (typeof field.value === 'string') {
    return field.value || null
  }

  // Some phone fields return object with phone_number
  if (typeof field.value === 'object' && field.value.phone_number) {
    return field.value.phone_number
  }

  return null
}

/**
 * Extract date value from a date custom field (returns Date or null)
 */
export function extractDateValue(field: ClickUpCustomFieldValue | undefined): Date | null {
  if (!field || field.value === undefined || field.value === null) return null

  // Date fields have value as timestamp in milliseconds
  if (typeof field.value === 'number') {
    return new Date(field.value)
  }

  // Sometimes it's a string timestamp
  if (typeof field.value === 'string') {
    const timestamp = parseInt(field.value, 10)
    if (!isNaN(timestamp)) {
      return new Date(timestamp)
    }
  }

  return null
}

/**
 * Extract currency value from a currency custom field
 */
export function extractCurrencyValue(field: ClickUpCustomFieldValue | undefined): number | null {
  if (!field || field.value === undefined || field.value === null) return null

  if (typeof field.value === 'number') {
    return field.value
  }

  if (typeof field.value === 'string') {
    const parsed = parseFloat(field.value)
    return isNaN(parsed) ? null : parsed
  }

  return null
}

/**
 * Extract dropdown value from a dropdown custom field
 */
export function extractDropdownValue(field: ClickUpCustomFieldValue | undefined): string | null {
  if (!field || field.value === undefined || field.value === null) return null

  // Dropdown fields have value as the option index or object
  if (typeof field.value === 'number' && field.type_config?.options) {
    const option = field.type_config.options[field.value]
    return option?.name || null
  }

  // Sometimes value is the option object directly
  if (typeof field.value === 'object' && field.value.name) {
    return field.value.name
  }

  // Or just a string
  if (typeof field.value === 'string') {
    return field.value
  }

  return null
}

/**
 * Extract labels/tags value from a labels custom field
 */
export function extractLabelsValue(field: ClickUpCustomFieldValue | undefined): string[] {
  if (!field || field.value === undefined || field.value === null) return []

  // Labels fields have value as array of label objects or strings
  if (Array.isArray(field.value)) {
    return field.value.map((item) => {
      if (typeof item === 'string') return item
      if (typeof item === 'object' && item.label) return item.label
      if (typeof item === 'object' && item.name) return item.name
      return String(item)
    })
  }

  return []
}

/**
 * Extract user IDs from a users custom field
 */
export function extractUserIds(field: ClickUpCustomFieldValue | undefined): number[] {
  if (!field || field.value === undefined || field.value === null) return []

  if (Array.isArray(field.value)) {
    return field.value
      .map((item) => {
        if (typeof item === 'number') return item
        if (typeof item === 'object' && item.id) return item.id
        return null
      })
      .filter((id): id is number => id !== null)
  }

  return []
}

/**
 * Extract relationship task IDs from a relationship custom field
 */
export function extractRelationshipIds(field: ClickUpCustomFieldValue | undefined): string[] {
  if (!field || field.value === undefined || field.value === null) return []

  // Relationship fields have value as array of task IDs or objects
  if (Array.isArray(field.value)) {
    return field.value.map((item) => {
      if (typeof item === 'string') return item
      if (typeof item === 'object' && item.id) return item.id
      return String(item)
    })
  }

  return []
}

// ============ Name Parsing Utilities ============

/**
 * Parse a full name into first and last name
 */
export function parseFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)

  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  // First word is first name, rest is last name
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  return { firstName, lastName }
}

/**
 * Combine first and last name into full name
 */
export function combineNames(firstName: string | null, lastName: string | null): string {
  const parts = [firstName, lastName].filter(Boolean)
  return parts.join(' ')
}

// ============ Custom Field Value Builders ============

/**
 * Build custom field value for a text field
 */
export function buildTextFieldValue(value: string | null | undefined): string | null {
  return value || null
}

/**
 * Build custom field value for a phone field
 */
export function buildPhoneFieldValue(value: string | null | undefined): string | null {
  return value || null
}

/**
 * Build custom field value for a date field (returns timestamp in ms)
 */
export function buildDateFieldValue(value: Date | null | undefined): number | null {
  return value ? value.getTime() : null
}

/**
 * Build custom field value for a currency field
 */
export function buildCurrencyFieldValue(value: number | null | undefined): number | null {
  return value ?? null
}

/**
 * Find dropdown option index by name
 */
export function findDropdownOptionIndex(
  field: ClickUpCustomFieldValue | undefined,
  optionName: string
): number | null {
  if (!field?.type_config?.options) return null

  const index = field.type_config.options.findIndex(
    (opt: { name: string }) => opt.name.toLowerCase() === optionName.toLowerCase()
  )

  return index >= 0 ? index : null
}
