import { NextResponse, type NextRequest } from 'next/server'

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
 * Минимальный guard роутов. При AUTH_DISABLED пропускает всё.
 * Полная проверка сессии Supabase выполняется в серверных компонентах/роутах.
 */
export function middleware(request: NextRequest) {
  if (authDisabled()) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (!isProtectedPath(pathname)) return NextResponse.next()

  const hasSupabaseCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'))
  if (!hasSupabaseCookie) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|lesson-runtime.js|.*\\.(?:png|jpg|svg|ico)$).*)'],
}
