import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // Validate and sanitize next parameter to prevent open redirect vulnerabilities
  let safeNext = '/app'
  const rawNext = searchParams.get('next')
  if (rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\')) {
    safeNext = rawNext
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
}
