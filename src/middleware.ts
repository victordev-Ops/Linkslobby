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
  
  if (authError) {
    console.log(`[Middleware] Auth error for ${pathname}:`, authError.message)
  }
  if (user) {
    console.log(`[Middleware] Authenticated: ${user.email} for ${pathname}`)
  } else {
    console.log(`[Middleware] Guest access for ${pathname}`)
  }

  // 2. Define Public Routes
  const publicPaths = ['/login', '/signup', '/manifest.webmanifest', '/sw.js']
  const isExactPublic = publicPaths.includes(pathname) || pathname === '/'

  const isPublicPrefix =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/confess/') ||
    pathname.startsWith('/ama/') ||
    pathname.startsWith('/anonymous/') ||
    pathname.startsWith('/dykm/')

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

  return response
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
