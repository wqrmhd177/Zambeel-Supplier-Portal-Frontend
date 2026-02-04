import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'supplier_session'

const protectedPaths = [
  '/dashboard',
  '/onboarding',
  '/products',
  '/profile',
  '/listings',
  '/orders',
  '/approvals',
  '/suppliers',
  '/settings',
]

function isProtectedPath(pathname: string): boolean {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE)

  if (!session?.value) {
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
    '/orders',
    '/orders/:path*',
    '/approvals',
    '/approvals/:path*',
    '/suppliers',
    '/suppliers/:path*',
    '/settings',
    '/settings/:path*',
  ],
}
