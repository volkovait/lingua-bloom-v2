import { NextResponse, type NextRequest } from 'next/server'

import { copyCookiesTo, updateSession } from '@/src/auth/update-session'

const PROTECTED_PREFIXES = ['/', '/upload', '/learn', '/history']
const PUBLIC_EXACT = new Set(['/auth/login', '/auth/sign-up', '/auth/sign-up-success', '/auth/error'])
const PUBLIC_PREFIXES = ['/auth/callback', '/auth/signout', '/api/health']

function authDisabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_AUTH_DISABLED || process.env.AUTH_DISABLED || '').toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isProtectedPath(pathname: string): boolean {
  if (isPublicPath(pathname)) return false
  if (pathname.startsWith('/api/')) return false
  if (pathname.startsWith('/_next')) return false
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`)),
  )
}

/**
 * Обязательно обновляет сессию Supabase на каждом запросе (включая /api/*).
 * При AUTH_DISABLED — без guard'а, но refresh всё равно безопасен (просто no-op без cookies).
 */
export async function middleware(request: NextRequest) {
  if (authDisabled()) {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)

  const { pathname } = request.nextUrl
  if (!isProtectedPath(pathname)) {
    return response
  }

  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    copyCookiesTo(response, redirectResponse)
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|lesson-runtime.js|.*\\.(?:png|jpg|svg|ico)$).*)'],
}
