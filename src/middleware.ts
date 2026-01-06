import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/init',
  '/api/quickbooks/webhooks', // QuickBooks webhook endpoint (authenticated via HMAC signature)
  '/scan',     // Public bin location scan pages
  '/api/scan'  // Public bin location scan API
]

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

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Get session token from cookies
  const sessionToken = request.cookies.get('session_token')?.value

  if (!sessionToken) {
    // No session token, redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Session token exists, allow request to proceed
  // Actual session validation will happen in API routes and page components
  return NextResponse.next()
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
