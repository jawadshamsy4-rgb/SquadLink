'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './auth-provider'

export type UserPresenceStatus = 'online' | 'idle' | 'dnd' | 'offline'

export interface UserPresenceData {
  userId: string
  username: string
  avatar_url?: string
  status: UserPresenceStatus
  customStatus?: string
  client?: 'web' | 'mobile' | 'desktop'
  lastActive: number
}

interface PresenceContextType {
  onlineUsers: Record<string, UserPresenceData>
  isUserOnline: (userId: string) => boolean
  getUserPresence: (userId: string) => UserPresenceData | null
  myStatus: UserPresenceStatus
  setMyStatus: (status: UserPresenceStatus) => Promise<void>
  myCustomStatus: string
  setMyCustomStatus: (status: string) => Promise<void>
  activeServerId: string | null
  setActiveServerId: (id: string | null) => void
}

const GLOBAL_PRESENCE_CHANNEL = 'squadlink-global-presence'
const IDLE_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes of inactivity -> 'idle'

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: {},
  isUserOnline: () => false,
  getUserPresence: () => null,
  myStatus: 'online',
  setMyStatus: async () => {},
  myCustomStatus: '',
  setMyCustomStatus: async () => {},
  activeServerId: null,
  setActiveServerId: () => {},
})

export function usePresence() {
  return useContext(PresenceContext)
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const supabase = createClient()

  const [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresenceData>>({})
  const [myStatus, setMyStatusState] = useState<UserPresenceStatus>('online')
  const [myCustomStatus, setMyCustomStatusState] = useState<string>('')
  const [activeServerId, setActiveServerId] = useState<string | null>(null)

  const globalChannelRef = useRef<any>(null)
  const serverChannelRef = useRef<any>(null)
  const isAutoIdleRef = useRef<boolean>(false)
  const manualStatusOverrideRef = useRef<boolean>(false)
  const lastActivityTimeRef = useRef<number>(0)
  const lastTrackedPayloadRef = useRef<any>(null)
  const myStatusRef = useRef<UserPresenceStatus>('online')
  const myCustomStatusRef = useRef<string>('')

  useEffect(() => {
    lastActivityTimeRef.current = Date.now()
  }, [])

  myStatusRef.current = myStatus
  myCustomStatusRef.current = myCustomStatus

  const currentUserId = user?.id || ''
  const currentUsername =
    profile?.username ||
    (user?.user_metadata?.username as string) ||
    user?.email?.split('@')[0] ||
    'Squad Member'
  const currentUserAvatar =
    profile?.avatar_url ||
    (user?.user_metadata?.avatar_url as string) ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUsername)}`

  // Helper to re-aggregate presence state from Supabase Realtime channel
  const syncPresenceState = useCallback((channel: any) => {
    if (!channel) return
    try {
      const state = channel.presenceState()
      const updated: Record<string, UserPresenceData> = {}
      const now = Date.now()

      Object.entries(state).forEach(([key, presences]: [string, any]) => {
        if (Array.isArray(presences) && presences.length > 0) {
          // Take the most recent active presence record for this user key
          const p = presences[presences.length - 1]
          if (p && p.user_id) {
            updated[p.user_id] = {
              userId: p.user_id,
              username: p.username || 'Squad Mate',
              avatar_url: p.avatar_url,
              status: (p.status as UserPresenceStatus) || 'online',
              customStatus: p.custom_status,
              client: p.client || 'web',
              lastActive: p.last_active || now,
            }
          }
        }
      })

      setOnlineUsers((prev) => {
        return {
          ...prev,
          ...updated,
        }
      })
    } catch (e) {
      console.warn('Error reading presence state:', e)
    }
  }, [])

  // Build the presence track payload for current user
  const buildPresencePayload = useCallback(
    (statusOverride?: UserPresenceStatus, customStatusOverride?: string) => {
      return {
        user_id: currentUserId,
        username: currentUsername,
        avatar_url: currentUserAvatar,
        status: statusOverride ?? myStatusRef.current,
        custom_status: customStatusOverride ?? myCustomStatusRef.current,
        client: 'web',
        last_active: Date.now(),
        server_id: activeServerId,
      }
    },
    [currentUserId, currentUsername, currentUserAvatar, activeServerId]
  )

  // Track presence on active channels
  const trackPresence = useCallback(
    async (payload?: any) => {
      const data = payload || buildPresencePayload()
      lastTrackedPayloadRef.current = data

      // 1. Global channel
      if (globalChannelRef.current) {
        try {
          await globalChannelRef.current.track(data)
        } catch (e) {
          console.warn('Could not track global presence:', e)
        }
      }

      // 2. Active server channel
      if (serverChannelRef.current) {
        try {
          await serverChannelRef.current.track(data)
        } catch (e) {
          console.warn('Could not track server presence:', e)
        }
      }

      // Ensure local state mirrors current user
      if (data.user_id) {
        setOnlineUsers((prev) => ({
          ...prev,
          [data.user_id]: {
            userId: data.user_id,
            username: data.username,
            avatar_url: data.avatar_url,
            status: data.status,
            customStatus: data.custom_status,
            client: data.client,
            lastActive: data.last_active,
          },
        }))
      }
    },
    [buildPresencePayload]
  )

  // Set user status explicitly (e.g. from UI selector)
  const setMyStatus = useCallback(
    async (newStatus: UserPresenceStatus) => {
      setMyStatusState(newStatus)
      myStatusRef.current = newStatus
      manualStatusOverrideRef.current = newStatus !== 'online'
      isAutoIdleRef.current = false

      const payload = buildPresencePayload(newStatus)

      // Broadcast instant zero-latency status change event
      if (globalChannelRef.current) {
        globalChannelRef.current
          .send({
            type: 'broadcast',
            event: 'status_update',
            payload,
          })
          .catch(() => {})
      }

      if (serverChannelRef.current) {
        serverChannelRef.current
          .send({
            type: 'broadcast',
            event: 'status_update',
            payload,
          })
          .catch(() => {})
      }

      await trackPresence(payload)
    },
    [buildPresencePayload, trackPresence]
  )

  // Set custom status message
  const setMyCustomStatus = useCallback(
    async (customText: string) => {
      setMyCustomStatusState(customText)
      myCustomStatusRef.current = customText

      const payload = buildPresencePayload(undefined, customText)

      if (globalChannelRef.current) {
        globalChannelRef.current
          .send({
            type: 'broadcast',
            event: 'status_update',
            payload,
          })
          .catch(() => {})
      }

      await trackPresence(payload)
    },
    [buildPresencePayload, trackPresence]
  )

  // 1. Subscribe to Global Presence Channel
  useEffect(() => {
    if (!currentUserId) {
      setOnlineUsers({})
      return
    }

    const channel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: currentUserId,
        },
        broadcast: {
          self: false,
        },
      },
    })

    globalChannelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        syncPresenceState(channel)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        if (Array.isArray(newPresences) && newPresences.length > 0) {
          const p = newPresences[newPresences.length - 1]
          if (p && p.user_id) {
            setOnlineUsers((prev) => ({
              ...prev,
              [p.user_id]: {
                userId: p.user_id,
                username: p.username || 'Squad Mate',
                avatar_url: p.avatar_url,
                status: (p.status as UserPresenceStatus) || 'online',
                customStatus: p.custom_status,
                client: p.client || 'web',
                lastActive: p.last_active || Date.now(),
              },
            }))
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key }: any) => {
        // Only mark offline if no other presences for this key remain
        const state = channel.presenceState()
        if (!state[key] || state[key].length === 0) {
          setOnlineUsers((prev) => {
            const next = { ...prev }
            delete next[key]
            return next
          })
        } else {
          syncPresenceState(channel)
        }
      })
      .on('broadcast', { event: 'user_online' }, ({ payload }: any) => {
        if (payload?.userId) {
          setOnlineUsers((prev) => ({
            ...prev,
            [payload.userId]: {
              userId: payload.userId,
              username: payload.username || 'Squad Mate',
              avatar_url: payload.avatar_url,
              status: (payload.status as UserPresenceStatus) || 'online',
              customStatus: payload.customStatus,
              client: payload.client || 'web',
              lastActive: payload.lastActive || Date.now(),
            },
          }))
        }
      })
      .on('broadcast', { event: 'user_offline' }, ({ payload }: any) => {
        if (payload?.userId) {
          setOnlineUsers((prev) => {
            const next = { ...prev }
            delete next[payload.userId]
            return next
          })
        }
      })
      .on('broadcast', { event: 'status_update' }, ({ payload }: any) => {
        if (payload?.user_id) {
          setOnlineUsers((prev) => ({
            ...prev,
            [payload.user_id]: {
              userId: payload.user_id,
              username: payload.username || prev[payload.user_id]?.username || 'Squad Mate',
              avatar_url: payload.avatar_url || prev[payload.user_id]?.avatar_url,
              status: (payload.status as UserPresenceStatus) || 'online',
              customStatus: payload.custom_status,
              client: payload.client || 'web',
              lastActive: payload.last_active || Date.now(),
            },
          }))
        }
      })
      .subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          const payload = buildPresencePayload()
          await channel.track(payload)

          // Broadcast user_online for 0ms instant discovery across connected peers
          channel
            .send({
              type: 'broadcast',
              event: 'user_online',
              payload: {
                userId: currentUserId,
                username: currentUsername,
                avatar_url: currentUserAvatar,
                status: myStatusRef.current,
                customStatus: myCustomStatusRef.current,
                client: 'web',
                lastActive: Date.now(),
              },
            })
            .catch(() => {})
        }
      })

    // Zero-latency departure on page unload or tab close
    const handleUnload = () => {
      try {
        if (globalChannelRef.current) {
          globalChannelRef.current.send({
            type: 'broadcast',
            event: 'user_offline',
            payload: { userId: currentUserId },
          })
          globalChannelRef.current.untrack()
        }
        if (serverChannelRef.current) {
          serverChannelRef.current.send({
            type: 'broadcast',
            event: 'user_offline',
            payload: { userId: currentUserId },
          })
          serverChannelRef.current.untrack()
        }
      } catch (e) {}
    }

    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)

      supabase.removeChannel(channel)
      globalChannelRef.current = null
    }
  }, [currentUserId, currentUsername, currentUserAvatar, supabase, syncPresenceState, buildPresencePayload])

  // 2. Subscribe to Active Server Presence Channel whenever activeServerId changes
  useEffect(() => {
    if (!currentUserId || !activeServerId) {
      if (serverChannelRef.current) {
        supabase.removeChannel(serverChannelRef.current)
        serverChannelRef.current = null
      }
      return
    }

    const channelName = `server-presence-${activeServerId}`
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId,
        },
        broadcast: {
          self: false,
        },
      },
    })

    serverChannelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        syncPresenceState(channel)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        if (Array.isArray(newPresences) && newPresences.length > 0) {
          const p = newPresences[newPresences.length - 1]
          if (p && p.user_id) {
            setOnlineUsers((prev) => ({
              ...prev,
              [p.user_id]: {
                userId: p.user_id,
                username: p.username || 'Squad Mate',
                avatar_url: p.avatar_url,
                status: (p.status as UserPresenceStatus) || 'online',
                customStatus: p.custom_status,
                client: p.client || 'web',
                lastActive: p.last_active || Date.now(),
              },
            }))
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key }: any) => {
        const state = channel.presenceState()
        if (!state[key] || state[key].length === 0) {
          setOnlineUsers((prev) => {
            const next = { ...prev }
            delete next[key]
            return next
          })
        }
      })
      .on('broadcast', { event: 'user_online' }, ({ payload }: any) => {
        if (payload?.userId) {
          setOnlineUsers((prev) => ({
            ...prev,
            [payload.userId]: {
              userId: payload.userId,
              username: payload.username || 'Squad Mate',
              avatar_url: payload.avatar_url,
              status: (payload.status as UserPresenceStatus) || 'online',
              customStatus: payload.customStatus,
              client: payload.client || 'web',
              lastActive: payload.lastActive || Date.now(),
            },
          }))
        }
      })
      .on('broadcast', { event: 'user_offline' }, ({ payload }: any) => {
        if (payload?.userId) {
          setOnlineUsers((prev) => {
            const next = { ...prev }
            delete next[payload.userId]
            return next
          })
        }
      })
      .on('broadcast', { event: 'status_update' }, ({ payload }: any) => {
        if (payload?.user_id) {
          setOnlineUsers((prev) => ({
            ...prev,
            [payload.user_id]: {
              userId: payload.user_id,
              username: payload.username || prev[payload.user_id]?.username || 'Squad Mate',
              avatar_url: payload.avatar_url || prev[payload.user_id]?.avatar_url,
              status: (payload.status as UserPresenceStatus) || 'online',
              customStatus: payload.custom_status,
              client: payload.client || 'web',
              lastActive: payload.last_active || Date.now(),
            },
          }))
        }
      })
      .subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(buildPresencePayload())
        }
      })

    return () => {
      supabase.removeChannel(channel)
      serverChannelRef.current = null
    }
  }, [currentUserId, activeServerId, supabase, syncPresenceState, buildPresencePayload])

  // 3. User Activity & Smart Idle Detection
  useEffect(() => {
    if (!currentUserId) return

    let activityThrottleTimer: NodeJS.Timeout | null = null

    const handleUserInteraction = () => {
      lastActivityTimeRef.current = Date.now()

      // If user was automatically put into idle mode, restore online immediately
      if (isAutoIdleRef.current && !manualStatusOverrideRef.current) {
        isAutoIdleRef.current = false
        setMyStatusState('online')
        myStatusRef.current = 'online'
        trackPresence(buildPresencePayload('online'))
      }

      // Throttle updates so rapid typing/moving doesn't flood sockets
      if (!activityThrottleTimer) {
        activityThrottleTimer = setTimeout(() => {
          activityThrottleTimer = null
        }, 10000)
      }
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach((ev) => window.addEventListener(ev, handleUserInteraction, { passive: true }))

    // Periodic check for idle status
    const idleCheckInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current

      if (
        timeSinceLastActivity >= IDLE_TIMEOUT_MS &&
        !isAutoIdleRef.current &&
        !manualStatusOverrideRef.current &&
        myStatusRef.current === 'online'
      ) {
        isAutoIdleRef.current = true
        setMyStatusState('idle')
        myStatusRef.current = 'idle'
        trackPresence(buildPresencePayload('idle'))
      }
    }, 15000)

    // Visibility change handler (switching tabs/minimizing)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleUserInteraction()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserInteraction))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(idleCheckInterval)
      if (activityThrottleTimer) clearTimeout(activityThrottleTimer)
    }
  }, [currentUserId, buildPresencePayload, trackPresence])

  // Helper check functions
  const isUserOnline = useCallback(
    (userId: string) => {
      if (userId === currentUserId) return myStatus !== 'offline'
      const pres = onlineUsers[userId]
      return !!pres && pres.status !== 'offline'
    },
    [currentUserId, myStatus, onlineUsers]
  )

  const getUserPresence = useCallback(
    (userId: string): UserPresenceData | null => {
      if (userId === currentUserId) {
        return {
          userId: currentUserId,
          username: currentUsername,
          avatar_url: currentUserAvatar,
          status: myStatus,
          customStatus: myCustomStatus,
          client: 'web',
          lastActive: lastActivityTimeRef.current || 0,
        }
      }
      return onlineUsers[userId] || null
    },
    [currentUserId, currentUsername, currentUserAvatar, myStatus, myCustomStatus, onlineUsers]
  )

  return (
    <PresenceContext.Provider
      value={{
        onlineUsers,
        isUserOnline,
        getUserPresence,
        myStatus,
        setMyStatus,
        myCustomStatus,
        setMyCustomStatus,
        activeServerId,
        setActiveServerId,
      }}
    >
      {children}
    </PresenceContext.Provider>
  )
}
