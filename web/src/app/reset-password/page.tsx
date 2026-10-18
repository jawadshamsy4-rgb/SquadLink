'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login?mode=reset')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading password reset...</p>
      </div>
    </div>
  )
}
