import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View, AppState } from 'react-native'
import { updateLocationNow } from '../lib/location'
import { startMobilePresence, handleMobileAppState } from '../lib/presence'

export default function RootLayout() {
  useEffect(() => {
    // 1. Immediately update location & real-time presence when anyone opens the app
    updateLocationNow()
    startMobilePresence()

    // 2. Automatically update location & toggle online/offline presence on app state change
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      handleMobileAppState(nextAppState)
      if (nextAppState === 'active') {
        updateLocationNow()
      }
    })

    // 3. Periodic 10-minute interval while app is in foreground
    const intervalId = setInterval(() => {
      updateLocationNow()
    }, 10 * 60 * 1000)

    return () => {
      subscription.remove()
      clearInterval(intervalId)
    }
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <StatusBar style="light" />
      <Slot />
    </View>
  )
}
