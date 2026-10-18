'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type AuthMode = 'login' | 'forgot' | 'verify' | 'success'

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const supabase = createClient()

  // Handle URL query parameters without SSR bailout
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const modeParam = params.get('mode')
      const emailParam = params.get('email')
      if (modeParam === 'reset' || modeParam === 'forgot') {
        setMode('forgot')
      }
      if (emailParam) {
        setEmail(emailParam)
      }
    }
  }, [])

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/app'
    }
  }

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError(error.message)
  }

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')
    setMessage('')

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/app`,
      })

      if (resetError) {
        setError(resetError.message)
        setLoading(false)
      } else {
        setMessage(`We have sent a 6-digit OTP code to ${email.trim()}. Please check your email inbox and spam folder.`)
        setMode('verify')
        setResendCountdown(60)
        setLoading(false)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP email.')
      setLoading(false)
    }
  }

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    const cleanOtp = otpCode.trim()

    if (!cleanOtp) {
      setError('Please enter the 6-digit OTP code.')
      return
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.')
      return
    }

    setLoading(true)

    try {
      // 1. Verify the recovery OTP code for this email
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanOtp,
        type: 'recovery',
      })

      if (otpError) {
        setError(otpError.message || 'Invalid or expired OTP code. Please try again.')
        setLoading(false)
        return
      }

      // 2. Once verified, session is established. Update password.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError(updateError.message || 'Failed to update password.')
        setLoading(false)
        return
      }

      // 3. Password successfully reset!
      setMode('success')
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || 'An error occurred during password reset.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-20 h-20 rounded-3xl overflow-hidden mb-4 shadow-2xl shadow-purple-500/30 border border-white/20 hover:scale-105 transition-transform">
            <img src="/logo.png" alt="SquadLink" className="w-full h-full object-cover" />
          </Link>
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
            SquadLink
          </h1>
          <p className="text-gray-400 mt-2">Connect with your gaming squad</p>
        </div>

        {/* Card Container */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl transition-all duration-300">
          
          {/* Notifications */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm text-center font-medium animate-in fade-in duration-200">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-5 p-3.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm text-center font-medium leading-relaxed animate-in fade-in duration-200">
              {message}
            </div>
          )}

          {/* 1. LOGIN MODE */}
          {mode === 'login' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Welcome back</h2>

              <form onSubmit={handleLogin} className="space-y-4">
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setError('')
                        setMessage('')
                        setMode('forgot')
                      }}
                      className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                      placeholder="••••••••"
                      required
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
                  className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-600 to-purple-600 hover:from-purple-500 hover:via-cyan-500 hover:to-purple-500 text-white font-semibold text-lg shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
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
                onClick={handleGoogleLogin}
                className="w-full py-3 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-medium flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>

              <div className="mt-6 flex flex-col gap-2 text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setMessage('')
                    setMode('forgot')
                  }}
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-xs font-semibold cursor-pointer"
                >
                  Need to reset your password? <span className="underline decoration-cyan-500/40">Reset Password</span>
                </button>

                <p className="text-gray-400">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                    Create one
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* 2. FORGOT / SEND OTP MODE */}
          {mode === 'forgot' && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 text-xl mb-3 shadow-sm">
                  🔑
                </div>
                <h2 className="text-2xl font-bold text-white">Reset Password</h2>
                <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                  Enter your email address and we will send you a one-time verification code (OTP) to reset your password.
                </p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Account Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-600 to-purple-600 hover:from-purple-500 hover:via-cyan-500 hover:to-purple-500 text-white font-semibold text-base shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending OTP...
                    </span>
                  ) : (
                    'Send Reset OTP Email'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setMessage('')
                    setMode('login')
                  }}
                  className="text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                >
                  <span>←</span>
                  <span>Back to Sign In</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. VERIFY OTP & ENTER NEW PASSWORD MODE */}
          {mode === 'verify' && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 text-xl mb-3 shadow-sm">
                  ✉️
                </div>
                <h2 className="text-2xl font-bold text-white">Enter OTP & New Password</h2>
                <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                  Enter the 6-digit verification code sent to <span className="font-semibold text-cyan-300">{email}</span> and pick a new password.
                </p>
              </div>

              <form onSubmit={handleVerifyAndReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">6-Digit OTP Code</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\s+/g, ''))}
                    maxLength={10}
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 font-mono tracking-widest text-center text-lg uppercase transition-all duration-200"
                    placeholder="123456"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                      placeholder="At least 6 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer text-sm"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                    placeholder="Repeat new password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-600 to-purple-600 hover:from-purple-500 hover:via-cyan-500 hover:to-purple-500 text-white font-semibold text-base shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Updating Password...
                    </span>
                  ) : (
                    'Save New Password & Log In'
                  )}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setMessage('')
                    setMode('login')
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  ← Back to Login
                </button>

                {resendCountdown > 0 ? (
                  <span className="text-gray-500 font-mono">
                    Resend code in {resendCountdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors cursor-pointer"
                  >
                    Resend OTP Code
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. SUCCESS MODE */}
          {mode === 'success' && (
            <div className="text-center py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 text-3xl mb-4 shadow-lg shadow-emerald-500/20">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Password Reset Successful!</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Your password has been securely updated. Your session is now verified and ready.
              </p>

              <Link
                href="/app"
                className="w-full inline-flex items-center justify-center py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-purple-600 hover:from-emerald-500 hover:via-cyan-500 hover:to-purple-500 text-white font-bold text-base shadow-lg shadow-emerald-500/25 transition-all duration-300 cursor-pointer"
              >
                Enter SquadLink →
              </Link>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setMessage('')
                    setPassword('')
                    setOtpCode('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setMode('login')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                  Sign in with another account
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
