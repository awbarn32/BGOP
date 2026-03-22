import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import type { UserRole } from '@/types/domain'

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/request', '/quote', '/api/intake', '/api/webhooks/line']

// Role-based default landing pages
const ROLE_LANDING: Record<UserRole, string> = {
  owner: '/board',
  pa: '/board',
  mechanic: '/mechanic',
  driver: '/driver',
}

// Protected route prefixes and their allowed roles
const ROUTE_ROLES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/board', roles: ['owner', 'pa'] },
  { prefix: '/jobs', roles: ['owner', 'pa'] },
  { prefix: '/customers', roles: ['owner', 'pa'] },
  { prefix: '/vehicles', roles: ['owner', 'pa'] },
  { prefix: '/products', roles: ['owner', 'pa'] },
  { prefix: '/templates', roles: ['owner', 'pa'] },
  { prefix: '/invoices', roles: ['owner', 'pa'] },
  { prefix: '/expenses', roles: ['owner', 'pa'] },
  { prefix: '/reports', roles: ['owner', 'pa'] },
  { prefix: '/mechanic', roles: ['owner', 'pa', 'mechanic'] },
  { prefix: '/driver', roles: ['owner', 'pa', 'driver'] },
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes and static files
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    try {
      const { supabaseResponse } = await updateSession(request)
      return supabaseResponse
    } catch {
      return NextResponse.next()
    }
  }

  let supabaseResponse: NextResponse
  let user: { app_metadata?: Record<string, unknown> } | null = null

  try {
    const result = await updateSession(request)
    supabaseResponse = result.supabaseResponse
    user = result.user
  } catch {
    // Supabase unreachable — fail safe to login redirect
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Not authenticated — redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Root redirect — send to role's landing page
  if (pathname === '/') {
    const role = (user.app_metadata?.role ?? 'mechanic') as UserRole
    const landing = ROLE_LANDING[role] ?? '/board'
    return NextResponse.redirect(new URL(landing, request.url))
  }

  // Role-based access check
  const role = (user.app_metadata?.role ?? 'mechanic') as UserRole
  const routeConfig = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix))

  if (routeConfig && !routeConfig.roles.includes(role)) {
    const landing = ROLE_LANDING[role] ?? '/board'
    return NextResponse.redirect(new URL(landing, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
