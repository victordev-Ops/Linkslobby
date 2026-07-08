//app/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const POST_AUTH_REDIRECT_COOKIE = 'post_auth_redirect'

// GET renders a "confirm it's you" page instead of consuming the token
// immediately. Email security scanners (Microsoft Defender Safe Links,
// Proofpoint, Google Workspace link protection, etc.) automatically GET
// every URL in an inbound email to scan it, before the human ever opens the
// message. Magic-link OTPs are single-use — if GET alone consumed the
// token, the scanner burns it, and the real person lands on an "expired
// link" error a few seconds later with no obvious way to recover.
// Scanners fetch pages; they don't submit forms. So the actual
// verifyOtp/exchangeCodeForSession call is deferred to POST, which only a
// real click on the button below can trigger.
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderConfirmPage(params: { token_hash: string | null; type: string | null; code: string | null; next: string }) {
  const { token_hash, type, code, next } = params
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Confirm sign-in — Linkslobby</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; background:#F8F9FD; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#fff; border-radius:24px; padding:32px; max-width:360px; width:90%; box-shadow:0 20px 40px rgba(0,0,0,0.08); text-align:center; }
  h1 { font-size:20px; margin:0 0 8px; color:#0f0a1e; }
  p { color:#6b7280; font-size:14px; margin:0 0 24px; }
  button { width:100%; background:#9333ea; color:#fff; border:none; border-radius:16px; padding:14px; font-size:14px; font-weight:700; cursor:pointer; }
  button:hover { background:#7e22ce; }
</style>
</head>
<body>
  <div class="card">
    <h1>Confirm it's you</h1>
    <p>Tap below to finish signing in.</p>
    <form method="POST" action="/auth/confirm">
      ${token_hash ? `<input type="hidden" name="token_hash" value="${escapeHtml(token_hash)}" />` : ''}
      ${type ? `<input type="hidden" name="type" value="${escapeHtml(type)}" />` : ''}
      ${code ? `<input type="hidden" name="code" value="${escapeHtml(code)}" />` : ''}
      ${next ? `<input type="hidden" name="next" value="${escapeHtml(next)}" />` : ''}
      <button type="submit">Continue</button>
    </form>
  </div>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')
  const next = searchParams.get('next') || searchParams.get('returnTo') || ''

  // OAuth `code` is bound to a code_verifier cookie set in this same browser
  // when signInWithOAuth() kicked off the flow — a scanner hitting this URL
  // has no matching cookie and can't complete exchangeCodeForSession, so
  // there's no token to burn. Safe to exchange immediately; gating it behind
  // a click would only add friction for real OAuth users.
  if (code) {
    return handleExchange({ request, token_hash: null, type: null, code, next })
  }

  // Magic-link OTP has no such binding — it's a bare token that works for
  // whoever presents it first. This IS what email security scanners
  // (Microsoft Defender Safe Links, Proofpoint, Google Workspace link
  // protection) can and do burn by auto-visiting every link in the email
  // before the human opens it. So this path renders a click-to-confirm page
  // instead; scanners fetch pages, they don't submit forms, so the token
  // survives for the actual click.
  if (token_hash && type) {
    const html = renderConfirmPage({ token_hash, type, code: null, next })
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Nothing to confirm
  return NextResponse.redirect(new URL('/login?error=link-expired', request.url))
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const token_hash = formData.get('token_hash') as string | null
  const type = formData.get('type') as EmailOtpType | null
  const code = formData.get('code') as string | null
  const next = (formData.get('next') as string | null) || ''

  return handleExchange({ request, token_hash, type, code, next })
}

async function handleExchange(params: {
  request: NextRequest
  token_hash: string | null
  type: EmailOtpType | null
  code: string | null
  next: string
}) {
  const { request, token_hash, type, code } = params
  let { next } = params

  const cookieStore = await cookies()
  const cookieRedirect = cookieStore.get(POST_AUTH_REDIRECT_COOKIE)?.value

  // Same fallback chain as before: caller-supplied next first, then the
  // signUp()-set cookie if that's missing.
  next = next || cookieRedirect || ''
  if (cookieRedirect) {
    cookieStore.delete(POST_AUTH_REDIRECT_COOKIE)
  }

  const supabase = await createSupabaseServerClient()
  let userId: string | null = null
  let userEmail: string | null = null

  if (code) {
    // OAuth Flow via standard `code` query param
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code)
    if (!authError && authData.user) {
      userId = authData.user.id
      userEmail = authData.user.email ?? null
    }
  } else if (token_hash && type) {
    // Magic Link / OTP Flow
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error && data.user) {
      userId = data.user.id
      userEmail = data.user.email ?? null
    }
  }

  if (userId) {
    // 2. Check if profile exists and is complete
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, slug')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Profile check error:', profileError)
    }

    // 3. Safety net: create skeleton profile if it doesn't exist
    //    (redundant with DB trigger, but covers edge cases where trigger
    //     didn't fire or was not yet installed)
    if (!profile) {
      const { error: insertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: userEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (insertError) {
        console.error('Safety net profile creation error:', insertError)
      }
    }

    // 4. Redirect based on profile completion.
    //    Status 303 forces the browser to GET the redirect target instead of
    //    replaying this POST against it — the default 307 would try to POST
    //    to /dashboard or /auth/setup, which isn't what we want.
    if (profile?.username && profile?.slug) {
      const redirectUrl = next ? new URL(next, request.url) : new URL('/dashboard', request.url)
      return NextResponse.redirect(redirectUrl, { status: 303 })
    } else {
      const setupUrl = new URL('/auth/setup', request.url)
      if (next) setupUrl.searchParams.set('next', next)
      return NextResponse.redirect(setupUrl, { status: 303 })
    }
  }

  // Fallback for expired or invalid tokens
  return NextResponse.redirect(new URL('/login?error=link-expired', request.url), { status: 303 })
}
