import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { supabase } from './supabase'

export const LOCATION_TASK_NAME = 'SQUADLINK_BACKGROUND_LOCATION'
export const UPDATE_INTERVAL = 10 * 60 * 1000 // 10 minutes (low battery consumption)

let lastPushTime = 0
let lastPushedCoords: { latitude: number; longitude: number } | null = null

/**
 * Pushes location coordinates to Supabase for all servers the user belongs to or owns.
 * Explicitly sets is_sharing_location = true so map queries display the pin immediately.
 */
export async function pushLocationToSupabase(
  userId: string,
  latitude: number,
  longitude: number
): Promise<boolean> {
  try {
    const serverIds = new Set<string>()

    // 1. Servers where user is a member
    const { data: memberships } = await supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', userId)

    if (memberships) {
      memberships.forEach((m: any) => {
        if (m.server_id) serverIds.add(m.server_id)
      })
    }

    // 2. Servers where user is owner
    const { data: ownedServers } = await supabase
      .from('servers')
      .select('id')
      .eq('owner_id', userId)

    if (ownedServers) {
      ownedServers.forEach((s: any) => {
        if (s.id) serverIds.add(s.id)
      })
    }

    if (serverIds.size === 0) {
      return false
    }

    const now = new Date().toISOString()
    const records = Array.from(serverIds).map((server_id) => ({
      user_id: userId,
      server_id,
      latitude,
      longitude,
      is_sharing_location: true,
      updated_at: now,
    }))

    const { error } = await supabase
      .from('locations')
      .upsert(records, {
        onConflict: 'user_id,server_id',
      })

    if (!error) {
      lastPushTime = Date.now()
      lastPushedCoords = { latitude, longitude }
      return true
    } else {
      console.warn('Supabase location upsert warning:', error.message)
      return false
    }
  } catch (err: any) {
    console.error('pushLocationToSupabase error:', err.message)
    return false
  }
}

// Background Task Definition for headless task execution
if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.error('Background location task error:', error)
      return
    }

    if (data?.locations && data.locations.length > 0) {
      const location = data.locations[0]
      if (location?.coords) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user?.id) {
            await pushLocationToSupabase(
              session.user.id,
              location.coords.latitude,
              location.coords.longitude
            )
          }
        } catch (err) {
          console.error('Failed to process background location:', err)
        }
      }
    }
  })
}

/**
 * Starts background location tracking with low power/balanced accuracy.
 * Runs on Android as a foreground service with notification to prevent OS kill.
 */
export async function startLocationTracking(): Promise<boolean> {
  try {
    // 1. Foreground permission
    const { status: existingFg } = await Location.getForegroundPermissionsAsync()
    let fgGranted = existingFg === 'granted'
    if (!fgGranted) {
      const { status } = await Location.requestForegroundPermissionsAsync()
      fgGranted = status === 'granted'
    }
    if (!fgGranted) {
      console.log('Foreground location permission denied')
      return false
    }

    // 2. Background permission
    const { status: existingBg } = await Location.getBackgroundPermissionsAsync()
    let bgGranted = existingBg === 'granted'
    if (!bgGranted) {
      const { status } = await Location.requestBackgroundPermissionsAsync()
      bgGranted = status === 'granted'
    }
    if (!bgGranted) {
      console.log('Background location permission denied')
      return false
    }

    // 3. Check if already tracking
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
    if (isTracking) {
      return true
    }

    // 4. Start background updates with Balanced accuracy (low battery/network usage)
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: UPDATE_INTERVAL,
      distanceInterval: 100, // 100 meters
      deferredUpdatesInterval: UPDATE_INTERVAL,
      pausesLocationUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: 'SquadLink Radar Active',
        notificationBody: 'Sharing location with your squad every 10 mins',
        notificationColor: '#9333ea',
      },
    })

    return true
  } catch (err: any) {
    console.warn('startLocationTracking error:', err.message)
    return false
  }
}

/**
 * Stops background location tracking.
 */
export async function stopLocationTracking(): Promise<void> {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
    }
  } catch (err) {
    console.warn('stopLocationTracking error:', err)
  }
}

/**
 * Single fetch for current coordinates.
 */
export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status: existingFg } = await Location.getForegroundPermissionsAsync()
    let fgGranted = existingFg === 'granted'
    if (!fgGranted) {
      const { status } = await Location.requestForegroundPermissionsAsync()
      fgGranted = status === 'granted'
    }
    if (!fgGranted) return null

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    }
  } catch (err) {
    console.warn('getCurrentLocation error:', err)
    return null
  }
}

/**
 * Automatically updates location immediately on app open or resume WITHOUT asking the user.
 * Then ensures background tracking is started for periodic 10-minute updates.
 */
export async function updateLocationNow(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // 1. Verify user session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return null
    }

    // 2. Fetch current coordinates silently
    const coords = await getCurrentLocation()
    if (coords) {
      // 3. Immediately push to Supabase with is_sharing_location: true
      await pushLocationToSupabase(session.user.id, coords.latitude, coords.longitude)
    }

    // 4. Ensure background tracking is active
    startLocationTracking().catch(() => {})

    return coords
  } catch (err) {
    console.warn('updateLocationNow silent update error:', err)
    return null
  }
}

export function getLastLocationInfo() {
  return {
    lastPushTime,
    lastPushedCoords,
  }
}
