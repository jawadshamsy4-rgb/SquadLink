import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { supabase } from './supabase'

const LOCATION_TASK_NAME = 'SQUADLINK_BACKGROUND_LOCATION'
const UPDATE_INTERVAL = 10 * 60 * 1000 // 10 minutes in milliseconds

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location error:', error)
    return
  }

  if (data) {
    const { locations } = data
    const location = locations[0]

    if (location) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get all servers the user is a member of
        const { data: memberships } = await supabase
          .from('server_members')
          .select('server_id')
          .eq('user_id', user.id)

        if (memberships) {
          // Update location for each server
          for (const membership of memberships) {
            await supabase
              .from('locations')
              .upsert({
                user_id: user.id,
                server_id: membership.server_id,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,server_id'
              })
          }
        }
      } catch (err) {
        console.error('Failed to update location:', err)
      }
    }
  }
})

export async function startLocationTracking() {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync()
  if (foregroundStatus !== 'granted') {
    console.log('Foreground location permission denied')
    return false
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync()
  if (backgroundStatus !== 'granted') {
    console.log('Background location permission denied')
    return false
  }

  // Check if already tracking
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
  if (isTracking) {
    return true
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: UPDATE_INTERVAL,
    distanceInterval: 100, // meters
    deferredUpdatesInterval: UPDATE_INTERVAL,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'SquadLink',
      notificationBody: 'Sharing your location with your squad',
      notificationColor: '#a855f7',
    },
  })

  return true
}

export async function stopLocationTracking() {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
  }
}

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return null

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  })

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  }
}
