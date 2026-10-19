import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View, AppState } from 'react-native'
import { updateLocationNow } from '../lib/location'

export default function RootLayout() {
  useEffect(() => {
    // 1. Immediately update location when anyone opens the app (without asking)
    updateLocationNow()

    // 2. Automatically update location whenever app resumes from background
    const subscription = AppState.addEventListener('change', (nextAppState) => {
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
