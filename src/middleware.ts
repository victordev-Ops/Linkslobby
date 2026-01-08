// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: This refreshes the session if it's expired
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // 1. Static Asset Pass-through
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/) || pathname.startsWith('/_next')) {
    return response
  }

  // 2. Define Public Routes carefully
  // We check for exact matches or specific prefixes, but NOT just "/" startsWith
  const publicPaths = ['/login', '/signup', '/auth/confirm', '/auth/setup']
  const isExactPublic = publicPaths.includes(pathname) || pathname === '/'
  const isAuthCallback = pathname.startsWith('/auth/')

  // 3. Logic: Redirect logged-in users away from Login/Signup
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 4. Logic: Protect Dashboard
  // If no user and trying to access dashboard or other internal pages
  if (!user && !isExactPublic && !isAuthCallback) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
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
