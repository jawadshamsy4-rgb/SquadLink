import { AppState, type AppStateStatus } from 'react-native'
import { supabase } from './supabase'

const GLOBAL_PRESENCE_CHANNEL = 'squadlink-global-presence'

let presenceChannel: any = null
let currentUserId: string | null = null
let currentUsername: string = 'Mobile User'
let isTracking = false

/**
 * Starts real-time presence tracking on mobile.
 * Connects to the same global presence channel used across SquadLink.
 */
export async function startMobilePresence(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return

    currentUserId = session.user.id

    // Fetch username if available
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('username')
        .eq('id', currentUserId)
        .maybeSingle()
      if (profile?.username) {
        currentUsername = profile.username
      } else if (session.user.user_metadata?.username) {
        currentUsername = session.user.user_metadata.username
      } else if (session.user.email) {
        currentUsername = session.user.email.split('@')[0]
      }
    } catch {}

    if (presenceChannel) {
      try {
        await presenceChannel.untrack()
        supabase.removeChannel(presenceChannel)
      } catch {}
      presenceChannel = null
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

    presenceChannel = channel

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && currentUserId) {
        isTracking = true
        const payload = {
          user_id: currentUserId,
          username: currentUsername,
          status: 'online',
          client: 'mobile',
          custom_status: 'On Mobile 📱',
          last_active: Date.now(),
        }

        await channel.track(payload)

        channel
          .send({
            type: 'broadcast',
            event: 'user_online',
            payload: {
              userId: currentUserId,
              username: currentUsername,
              status: 'online',
              client: 'mobile',
              customStatus: 'On Mobile 📱',
            },
          })
          .catch(() => {})
      }
    })
  } catch (err) {
    console.warn('startMobilePresence error:', err)
  }
}

/**
 * Handles app state transitions (foreground vs background) to ensure
 * instantaneous online/offline accuracy.
 */
export async function handleMobileAppState(nextState: AppStateStatus): Promise<void> {
  if (!presenceChannel || !currentUserId) {
    if (nextState === 'active') {
      await startMobilePresence()
    }
    return
  }

  try {
    if (nextState === 'active') {
      // User opened or resumed the mobile app -> broadcast online
      await presenceChannel.track({
        user_id: currentUserId,
        username: currentUsername,
        status: 'online',
        client: 'mobile',
        custom_status: 'On Mobile 📱',
        last_active: Date.now(),
      })

      presenceChannel
        .send({
          type: 'broadcast',
          event: 'user_online',
          payload: {
            userId: currentUserId,
            username: currentUsername,
            status: 'online',
            client: 'mobile',
            customStatus: 'On Mobile 📱',
          },
        })
        .catch(() => {})
    } else {
      // User switched out or backgrounded the app -> broadcast offline
      presenceChannel
        .send({
          type: 'broadcast',
          event: 'user_offline',
          payload: { userId: currentUserId },
        })
        .catch(() => {})

      await presenceChannel.untrack()
    }
  } catch (err) {
    console.warn('handleMobileAppState error:', err)
  }
}

/**
 * Cleanly stops presence on logout.
 */
export async function stopMobilePresence(): Promise<void> {
  if (presenceChannel && currentUserId) {
    try {
      presenceChannel
        .send({
          type: 'broadcast',
          event: 'user_offline',
          payload: { userId: currentUserId },
        })
        .catch(() => {})

      await presenceChannel.untrack()
      supabase.removeChannel(presenceChannel)
    } catch {}
    presenceChannel = null
    currentUserId = null
    isTracking = false
  }
}
