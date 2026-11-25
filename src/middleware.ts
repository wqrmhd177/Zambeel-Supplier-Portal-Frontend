import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'supplier_session'

function isHoldEnabled(): boolean {
  const v = process.env.PORTAL_HOLD?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function middleware(request: NextRequest) {
  if (!isHoldEnabled()) return NextResponse.next()

  const { pathname } = request.nextUrl

  if (pathname === '/join') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('reason', 'hold')
    return NextResponse.redirect(url)
  }

  if (
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value
  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('reason', 'hold')
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}