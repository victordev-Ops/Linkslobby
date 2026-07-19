import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 1. Skip Supabase for static assets and prefetches
  const isPrefetch = request.headers.get('x-middleware-prefetch') === '1'

  if (
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|webmanifest)$/) ||
    pathname.startsWith('/_next') ||
    isPrefetch
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request,
  })

  // Helper to ensure cookies are carried over during redirects
  // It uses the LATEST version of the 'response' object
  const redirectWithCookies = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // Logging on every single request (including every /tod/* hit) is real
  // overhead in production and clutters logs. Keep it dev-only.
  if (process.env.NODE_ENV === 'development') {
    if (authError) {
      console.log(`[Middleware] Auth error for ${pathname}:`, authError.message)
    }
    console.log(
      user
        ? `[Middleware] Authenticated: ${user.email} for ${pathname}`
        : `[Middleware] Guest access for ${pathname}`
    )
  }

  // 2. Define Public Routes
  //
  // Includes the App Router's generated metadata-image routes
  // (opengraph-image / icon / apple-icon). These are fetched by social
  // crawlers (Facebook, Twitter, iMessage, etc.) and by browsers for
  // favicons — neither carries a Supabase session cookie, so without this
  // they were being redirected to /login and link previews broke.
  const publicPaths = [
    '/login',
    '/signup',
    '/manifest.webmanifest',
    '/sw.js',
    '/opengraph-image',
    '/icon',
    '/apple-icon',
    '/policy',
    '/terms',
    '/safety'
  ]
  const isExactPublic = publicPaths.includes(pathname) || pathname === '/'

  // NOTE: '/auth/setup' is intentionally NOT public. It requires a real
  // session, same as any other protected route — that's what lets middleware
  // (not a racy client-side getSession()/onAuthStateChange poll) decide
  // whether to show it or bounce to /login. Only the endpoints that are
  // *meant* to be hit while logged out (the magic-link exchange, and any
  // future error/callback routes) go here explicitly.
  const isPublicAuthPath =
    pathname === '/auth/confirm' ||
    pathname === '/auth/error'

  const isPublicPrefix =
    isPublicAuthPath ||
    pathname.startsWith('/confess/') ||
    pathname.startsWith('/ama/') ||
    pathname.startsWith('/anonymous/') ||
    pathname.startsWith('/dykm/') ||
    pathname.startsWith('/tod/') ||
    pathname.startsWith('/hot-seat/') ||
    pathname.startsWith('/rps')

  const isPublicRoute = isExactPublic || isPublicPrefix

  // 3. Protect authenticated routes — redirect to login if not authenticated
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return redirectWithCookies(loginUrl)
  }

  // 4. For authenticated users — fetch profile ONCE and reuse
  if (user) {
    const profileExemptPaths = ['/auth/setup']
    const isProfileExempt = profileExemptPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
    const isOnLoginPage = pathname === '/login' || pathname === '/signup'

    // Only fetch profile if we actually need it (login redirect OR completion check)
    const needsProfileCheck = isOnLoginPage || (!isPublicRoute && !isProfileExempt)

    if (needsProfileCheck) {
      // SINGLE profile query — eliminates the double-query bottleneck
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, slug')
        .eq('id', user.id)
        .maybeSingle()

      const isProfileComplete = profile && profile.username && profile.slug

      if (isOnLoginPage) {
        // Logged-in user on /login or /signup
        if (!isProfileComplete) {
          const setupUrl = new URL('/auth/setup', request.url)
          const nextParam = request.nextUrl.searchParams.get('next') || request.nextUrl.searchParams.get('returnTo')
          if (nextParam) setupUrl.searchParams.set('next', nextParam)
          return redirectWithCookies(setupUrl)
        }

        const nextParam = request.nextUrl.searchParams.get('next') || request.nextUrl.searchParams.get('returnTo')
        if (nextParam) {
          return redirectWithCookies(new URL(nextParam, request.url))
        }
        return redirectWithCookies(new URL('/dashboard', request.url))
      }

      // Authenticated user on protected route — check profile completion
      if (!isProfileComplete) {
        const setupUrl = new URL('/auth/setup', request.url)
        const nextParam = request.nextUrl.searchParams.get('next') || request.nextUrl.searchParams.get('returnTo')
        if (nextParam) setupUrl.searchParams.set('next', nextParam)
        else setupUrl.searchParams.set('next', pathname)
        return redirectWithCookies(setupUrl)
      }
    }
  }

  // 5. Forward the identity we just verified so Server Components (page.tsx,
  // layout.tsx, etc.) can skip calling supabase.auth.getUser() a second time
  // — that call is a real network hit to the Supabase Auth server, and doing
  // it twice per request was costing every /tod/* page load an extra round
  // trip for zero benefit.
  //
  // Safe by construction: this header is set here, unconditionally, on every
  // request that reaches this point (middleware always runs before the page
  // does — there's no way for a client request to skip middleware and reach
  // the page directly), so any client-supplied value for it is always
  // overwritten below before the request continues.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-user-id')
  requestHeaders.delete('x-user-email')
  if (user) {
    requestHeaders.set('x-user-id', user.id)
    if (user.email) requestHeaders.set('x-user-email', user.email)
  }

  const finalResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })
  // Carry over any cookies Supabase refreshed during this request (e.g. a
  // rotated access token) onto the response we're actually returning.
  response.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie.name, cookie.value, cookie)
  })

  return finalResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
      }
