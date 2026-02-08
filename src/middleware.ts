import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/init',
  '/api/quickbooks/webhooks', // QuickBooks webhook endpoint (authenticated via HMAC signature)
  '/api/webhooks/clickup',    // ClickUp webhook endpoints (authenticated via HMAC signature)
  '/api/clickup-sync',        // ClickUp sync management (for manual sync triggers)
  '/scan',     // Public bin location scan pages
  '/api/scan', // Public bin location scan API
  '/packing',    // Public packing scanner pages (token-authenticated)
  '/api/packing', // Public packing scanner API (token-authenticated)
  '/field-verification',    // Public field verification upload pages (token-authenticated)
  '/api/field-verification' // Public field verification upload API (token-authenticated)
]

// Subdomains that are treated as main app (full access)
const MAIN_APP_SUBDOMAINS = ['app', 'www', '']

/**
 * Extract subdomain from hostname
 * Duplicated here because we can't import from lib in edge runtime middleware
 */
function getSubdomainFromHostname(hostname: string): string {
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

// Check if a route is public or if it's a Next.js internal route
function isPublicRoute(pathname: string): boolean {
  // Allow Next.js internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Allow static files
  ) {
    return true
  }

  // Check if it's an explicitly public route
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''

  // Extract subdomain for downstream use
  const subdomain = getSubdomainFromHostname(host)

  // Allow public routes
  if (isPublicRoute(pathname)) {
    // Still add subdomain header for public routes (login page may want it)
    const response = NextResponse.next()
    response.headers.set('x-portal-subdomain', subdomain)
    return response
  }

  // Get session token from cookies
  const sessionToken = request.cookies.get('session_token')?.value

  if (!sessionToken) {
    // No session token, redirect to login
    // Preserve the subdomain in the redirect
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Session token exists, allow request to proceed
  // Add subdomain header for downstream API routes and components
  const response = NextResponse.next()
  response.headers.set('x-portal-subdomain', subdomain)

  return response
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
