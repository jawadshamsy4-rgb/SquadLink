'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resendMessage, setResendMessage] = useState('')

  const supabase = createClient()

  // Resend countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1)
      }, 1000)
    }
    return () => clearTimeout(timer)
  }, [resendCountdown])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResendMessage('')
    setLoading(true)

    const cleanEmail = email.trim()
    const cleanUsername = username.trim()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: cleanUsername,
        },
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/app` : undefined,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      // With mailer autoconfirm enabled, session is available immediately
      if (data?.session) {
        router.push('/app')
      } else {
        // Attempt immediate login with password
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
        if (!signInErr) {
          router.push('/app')
        } else {
          setSuccess(true)
          setResendCountdown(60)
          setLoading(false)
        }
      }
    }
  }

  const handleResendEmail = async () => {
    if (resendCountdown > 0 || resendLoading) return
    setResendLoading(true)
    setResendMessage('')
    setError('')

    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/app` : undefined,
        },
      })

      if (resendErr) {
        setError(resendErr.message)
      } else {
        setResendMessage('A fresh confirmation email has been sent! Please check your inbox.')
        setResendCountdown(60)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to resend confirmation email.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleGoogleSignup = () => {
    // Google sign-up is not configured yet - intentionally does nothing
  }

  // 1. DEDICATED VERIFICATION NOTIFICATION SCREEN
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4">
        {/* Ambient Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative w-full max-w-lg bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600/30 via-cyan-500/20 to-purple-500/10 border border-cyan-400/30 mb-4 shadow-xl shadow-cyan-500/10 relative">
              <svg className="w-10 h-10 text-cyan-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white text-xs font-black">
                ✓
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-purple-300 via-cyan-300 to-pink-300 bg-clip-text text-transparent">
              Verify Your Email
            </h2>
            <p className="text-slate-400 text-sm mt-1">One last step before entering SquadLink</p>
          </div>

          {/* Recipient Badge */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-sm">
                @
              </div>
              <div>
                <p className="text-xs text-slate-400">Confirmation sent to:</p>
                <p className="text-sm font-semibold text-white break-all">{email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setSuccess(false)
                setError('')
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline decoration-cyan-500/40 transition-colors whitespace-nowrap cursor-pointer"
            >
              Change email
            </button>
          </div>

          {/* Detailed Instructions Notification */}
          <div className="space-y-4 mb-6 text-sm text-slate-300 leading-relaxed">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-2">
              <div className="flex items-center gap-2 font-bold text-cyan-300">
                <span>🛡️</span>
                <span>Supabase Email Confirmation Required</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                An official verification message has been dispatched to your email. Click the <strong className="text-white">&quot;Confirm your email&quot;</strong> button in that message to verify ownership and unlock your squad dashboard.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 text-xs text-slate-400">
              <span className="text-base leading-none">💡</span>
              <p>
                Don&apos;t see the email? Please check your <strong className="text-white">Spam or Junk folder</strong>. Verification emails usually arrive within 30 seconds.
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs text-center font-medium animate-in fade-in duration-200">
              {error}
            </div>
          )}

          {resendMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs text-center font-medium animate-in fade-in duration-200">
              {resendMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-600 to-purple-600 hover:from-purple-500 hover:via-cyan-500 hover:to-purple-500 text-white font-bold text-base shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Go to Login</span>
              <span>→</span>
            </Link>

            <button
              onClick={handleResendEmail}
              disabled={resendCountdown > 0 || resendLoading}
              className="w-full py-3 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {resendLoading ? (
                <span>Sending email...</span>
              ) : resendCountdown > 0 ? (
                <span>Resend available in {resendCountdown}s</span>
              ) : (
                <span>Resend Confirmation Email</span>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 2. SIGNUP FORM SCREEN
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl overflow-hidden mb-4 shadow-2xl shadow-purple-500/30 border border-white/20 select-none">
            <img src="/logo.png" alt="SquadLink" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
            SquadLink
          </h1>
          <p className="text-gray-400 mt-2">Join the squad</p>
        </div>

        {/* Card Form */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Create Account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center font-medium animate-in fade-in duration-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                placeholder="YourGamerTag"
                required
                minLength={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer text-sm"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 hover:from-cyan-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold text-base shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-900/60 text-gray-500 rounded-full">or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignup}
            className="w-full py-3 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-medium flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </button>

          <p className="mt-6 text-center text-gray-400 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
