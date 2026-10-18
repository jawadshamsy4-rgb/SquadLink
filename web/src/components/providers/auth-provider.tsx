'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
}

interface UserProfile {
  id: string
  username: string
  avatar_url: string
  email: string
}

// Fallback mock profile so UI components have complete preview data without login
const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  app_metadata: {},
  user_metadata: { username: 'SquadLeader' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'guest@squadlink.gg',
  phone: '',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
}

const MOCK_PROFILE: UserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  username: 'SquadLeader',
  avatar_url: '',
  email: 'guest@squadlink.gg',
}

const AuthContext = createContext<AuthContextType>({
  user: MOCK_USER,
  profile: MOCK_PROFILE,
  loading: false,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(MOCK_USER)
  const [profile, setProfile] = useState<UserProfile | null>(MOCK_PROFILE)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: realUser } } = await supabase.auth.getUser()
      if (realUser) {
        setUser(realUser)
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', realUser.id)
          .single()
        if (data) setProfile(data)
      } else {
        // Fallback to mock session for bypass/preview mode
        setUser(MOCK_USER)
        setProfile(MOCK_PROFILE)
      }
      setLoading(false)
    }

    getUser()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    alert('Logged out (Auth currently bypassed in Preview mode).')
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
