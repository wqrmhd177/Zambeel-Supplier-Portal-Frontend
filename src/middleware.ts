import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'supplier_session'

const protectedPaths = [
  '/dashboard',
  '/onboarding',
  '/products',
  '/profile',
  '/listings',
  '/product-availability',
  '/orders',
  '/returns',
  '/approvals',
  '/suppliers',
  '/settings',
]

function isProtectedPath(pathname: string): boolean {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))
}

function isValidSession(value: string | undefined): boolean {
  if (!value || value.trim() === '') return false
  // Accept UUID format, numeric IDs (e.g. "41"), or any non-empty truthy value
  return value !== '0' && value !== 'undefined' && value !== 'null'
}

export function middleware(request: NextRequest) {
  const host = request.nextUrl.hostname.toLowerCase()
  if (host === 'supplier-portal.zm.vercel.app') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.hostname = 'supplier-portal-zm.vercel.app'
    return NextResponse.redirect(redirectUrl)
  }

  const { pathname } = request.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE)

  if (!isValidSession(session?.value)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/onboarding',
    '/onboarding/:path*',
    '/products',
    '/products/:path*',
    '/profile',
    '/profile/:path*',
    '/listings',
    '/listings/:path*',
    '/product-availability',
    '/product-availability/:path*',
    '/orders',
    '/orders/:path*',
    '/returns',
    '/returns/:path*',
    '/approvals',
    '/approvals/:path*',
    '/suppliers',
    '/suppliers/:path*',
    '/settings',
    '/settings/:path*',
  ],
}
