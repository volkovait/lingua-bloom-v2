import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

import { safeInternalPath } from '@/lib/auth/safe-next-path'
import { env } from '@/src/config/env'

/**
 * Public origin for post-auth redirects.
 * Prefer NEXT_PUBLIC_APP_URL so production always lands on lingua-bloom.ru
 * (not an internal docker/host address). Fall back to proxy headers / request.
 */
function getPublicOrigin(request: NextRequest): string {
  const configured = env.app.url().trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // Invalid env URL — fall back below.
    }
  }
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedHost) {
    const proto = forwardedProto ?? 'https'
    return `${proto}://${forwardedHost.split(',')[0]?.trim() ?? forwardedHost}`
  }
  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request)

  try {
    const code = request.nextUrl.searchParams.get('code')
    const oauthError =
      request.nextUrl.searchParams.get('error_description') ??
      request.nextUrl.searchParams.get('error')
    const next = safeInternalPath(request.nextUrl.searchParams.get('next'), '/')

    if (oauthError && !code) {
      const errUrl = new URL('/auth/error', origin)
      errUrl.searchParams.set('error', oauthError)
      return NextResponse.redirect(errUrl)
    }

    if (!code) {
      return NextResponse.redirect(new URL('/auth/error', origin))
    }

    const successTarget = new URL(next, origin)
    const redirectResponse = NextResponse.redirect(successTarget)

    const supabase = createServerClient(env.supabase.url(), env.supabase.anonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            redirectResponse.cookies.set(name, value, options)
          }
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const errUrl = new URL('/auth/error', origin)
      errUrl.searchParams.set('error', error.message)
      return NextResponse.redirect(errUrl)
    }

    return redirectResponse
  } catch (caught) {
    const errUrl = new URL('/auth/error', origin)
    errUrl.searchParams.set(
      'error',
      caught instanceof Error ? caught.message : 'OAuth callback failed',
    )
    return NextResponse.redirect(errUrl)
  }
}
