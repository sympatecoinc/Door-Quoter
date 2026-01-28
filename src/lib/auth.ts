import bcrypt from 'bcryptjs'
import { cookies, headers } from 'next/headers'
import { getBaseDomain } from './portals'

const SALT_ROUNDS = 10
const SESSION_COOKIE_NAME = 'session_token'
const SESSION_DURATION_DAYS = 7

/**
 * Get the cookie domain for cross-subdomain authentication.
 * In production, this returns '.lineamotion.com' so cookies work across all subdomains.
 * In development (localhost), returns undefined so cookies work normally.
 */
async function getCookieDomain(): Promise<string | undefined> {
  if (process.env.NODE_ENV !== 'production') {
    return undefined
  }

  const headerStore = await headers()
  const host = headerStore.get('host') || ''
  return getBaseDomain(host)
}

/**
 * Hash a plain text password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a plain text password against a hashed password
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * Validate password strength
 * Returns an error message if invalid, or null if valid
 */
export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long'
  }
  return null
}

/**
 * Validate email format
 * Returns an error message if invalid, or null if valid
 */
export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    return 'Invalid email format'
  }
  return null
}

/**
 * Set session cookie in response
 * In production, the cookie is set with domain='.lineamotion.com' to allow
 * cross-subdomain authentication (e.g., login once, access all portals)
 */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  const domain = await getCookieDomain()

  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
    ...(domain && { domain }), // Only set domain in production
  })
}

/**
 * Get session token from cookies
 */
export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}

/**
 * Delete session cookie
 * Also clears the cookie with the production domain to ensure full logout
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  const domain = await getCookieDomain()

  // Delete with domain to clear cross-subdomain cookie
  if (domain) {
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
      domain,
    })
  }

  // Also delete without domain (for localhost/direct deletion)
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Calculate session expiration date
 */
export function getSessionExpirationDate(): Date {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)
  return expiresAt
}
