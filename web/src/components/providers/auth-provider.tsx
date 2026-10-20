'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  username: string
  avatar_url: string
  email: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const syncProfile = async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (data) {
        setProfile(data)
      } else {
        // If profile doesn't exist yet, insert it
        const fallbackUsername =
          (currentUser.user_metadata?.username as string) ||
          currentUser.email?.split('@')[0] ||
          'Gamer'
        const fallbackAvatar =
          (currentUser.user_metadata?.avatar_url as string) ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fallbackUsername)}`

        const newProfile: UserProfile = {
          id: currentUser.id,
          username: fallbackUsername,
          avatar_url: fallbackAvatar,
          email: currentUser.email || '',
        }

        await supabase.from('users').upsert(newProfile, { onConflict: 'id' })
        setProfile(newProfile)
      }
    } catch (err) {
      console.warn('Could not sync user profile:', err)
    }
  }

  const refreshProfile = async () => {
    if (!user) return
    await syncProfile(user)
  }

  const SESSION_BACKUP_KEY = 'squadlink_session_v2'

  useEffect(() => {
    let isMounted = true

    // 1. Initial session load with fallback to persistent session storage
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!isMounted) return

        if (session?.user) {
          setUser(session.user)
          try {
            localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(session))
          } catch {}
          await syncProfile(session.user)
        } else {
          // Check local session backup (critical for mobile APK cold-starts)
          let restored = false
          if (typeof window !== 'undefined') {
            try {
              const raw = localStorage.getItem(SESSION_BACKUP_KEY)
              if (raw) {
                const parsed = JSON.parse(raw)
                if (parsed?.refresh_token) {
                  const { data, error } = await supabase.auth.setSession({
                    access_token: parsed.access_token,
                    refresh_token: parsed.refresh_token,
                  })
                  if (data?.session?.user) {
                    setUser(data.session.user)
                    try {
                      localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(data.session))
                    } catch {}
                    await syncProfile(data.session.user)
                    restored = true
                  } else if (parsed?.user) {
                    // Retain user if offline or network temporarily unreachable
                    setUser(parsed.user)
                    restored = true
                  }
                }
              }
            } catch (storageErr) {
              console.warn('Could not restore from session backup:', storageErr)
            }
          }

          if (!restored) {
            setUser(null)
            setProfile(null)
          }
        }
      } catch (err) {
        console.error('Error fetching auth session:', err)
        if (isMounted) {
          // Attempt offline fallback if session backup exists
          if (typeof window !== 'undefined') {
            try {
              const raw = localStorage.getItem(SESSION_BACKUP_KEY)
              if (raw) {
                const parsed = JSON.parse(raw)
                if (parsed?.user) {
                  setUser(parsed.user)
                  return
                }
              }
            } catch {}
          }
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    // 2. Real-time auth state change subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (!isMounted) return

      if (session?.user) {
        setUser(session.user)
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(session))
          } catch {}
        }
        await syncProfile(session.user)
      } else if (event === 'SIGNED_OUT') {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(SESSION_BACKUP_KEY)
            localStorage.removeItem('squadlink_auth_backup_v1')
          } catch {}
        }
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_BACKUP_KEY)
        localStorage.removeItem('squadlink_auth_backup_v1')
        sessionStorage.clear()
      }
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Sign out error:', err)
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_BACKUP_KEY)
        localStorage.removeItem('squadlink_auth_backup_v1')
        sessionStorage.clear()
      }
      setUser(null)
      setProfile(null)
      window.location.replace('/login')
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
