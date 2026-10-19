import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Detect native apps (Electron, Android WebView, or query param / cookie)
  const userAgent = request.headers.get('user-agent') || ''
  const hasAppParam = request.nextUrl.searchParams.get('platform') === 'app'
  const hasAppCookie = request.cookies.get('squadlink_platform')?.value === 'app'
  const isNativeApp =
    userAgent.includes('Electron') ||
    userAgent.includes('SquadLink') ||
    userAgent.includes('wv') ||
    hasAppParam ||
    hasAppCookie

  // If in native app and on landing page '/', send directly to login or app
  if (pathname === '/' && isNativeApp) {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/app' : '/login'
    const redirectResponse = NextResponse.redirect(url)
    if (hasAppParam && !hasAppCookie) {
      redirectResponse.cookies.set('squadlink_platform', 'app', { maxAge: 31536000, path: '/' })
    }
    return redirectResponse
  }

  // Protect /app and /profile routes
  const isProtectedPath = pathname.startsWith('/app') || pathname.startsWith('/profile')
  if (isProtectedPath && !user) {
    // For native mobile APK and desktop, allow client-side hydration to recover session from localStorage backup
    // Client-side AppPage automatically redirects to /login if genuinely unauthenticated
    if (!isNativeApp) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  // If already authenticated and accessing login or signup, redirect to /app
  const isAuthPage = pathname === '/login' || pathname === '/signup'
  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    return NextResponse.redirect(url)
  }

  if (hasAppParam && !hasAppCookie) {
    response.cookies.set('squadlink_platform', 'app', { maxAge: 31536000, path: '/' })
  }

  return response
}
