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

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // 1. Static Asset Pass-through
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/) || pathname.startsWith('/_next')) {
    return response
  }

  // 2. Define Public Routes
  const publicPaths = ['/login', '/signup']
  const isExactPublic = publicPaths.includes(pathname) || pathname === '/'
  
  // Routes that start with a specific prefix
  const isPublicPrefix = 
    pathname.startsWith('/auth/') || 
    pathname.startsWith('/confess/') || 
    pathname.startsWith('/ama/') || 
    pathname.startsWith('/anonymous/') // <--- Added this

  const isPublicRoute = isExactPublic || isPublicPrefix

  // 3. Logic: Redirect logged-in users away from Login/Signup to Dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 4. Logic: Protect authenticated routes
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 5. Profile Completion Check
  if (user && pathname === '/dashboard') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, slug')
      .eq('id', user.id)
      .maybeSingle()

    // If profile incomplete, redirect to setup
    if (!profile || !profile.username || !profile.slug) {
      return NextResponse.redirect(new URL('/auth/setup', request.url))
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
