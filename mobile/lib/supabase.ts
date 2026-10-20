import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = 'https://pcikzpktdiwdgzchftmv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjaWt6cGt0ZGl3ZGd6Y2hmdG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMzczNDAsImV4cCI6MjEwNzkxMzM0MH0.s60zlleT-xlfoNJEGUm9BieA-dfvdgzSFkDZV04u_Ps'

// Chunk size under the 2048 byte iOS/Android Keychain limit to prevent overflow crashes
const CHUNK_SIZE = 1800

const RobustSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const countStr = await SecureStore.getItemAsync(`${key}_chunks`)
      if (countStr) {
        const count = parseInt(countStr, 10)
        let full = ''
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`)
          if (chunk === null) return null
          full += chunk
        }
        return full
      }
      return await SecureStore.getItemAsync(key)
    } catch (err) {
      console.warn('SecureStore getItem error:', err)
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value)
        // Clean up any legacy chunks
        const countStr = await SecureStore.getItemAsync(`${key}_chunks`)
        if (countStr) {
          const count = parseInt(countStr, 10)
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {})
          }
          await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {})
        }
      } else {
        const count = Math.ceil(value.length / CHUNK_SIZE)
        for (let i = 0; i < count; i++) {
          const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk)
        }
        await SecureStore.setItemAsync(`${key}_chunks`, count.toString())
        await SecureStore.deleteItemAsync(key).catch(() => {})
      }
    } catch (err) {
      console.error('SecureStore setItem error:', err)
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const countStr = await SecureStore.getItemAsync(`${key}_chunks`)
      if (countStr) {
        const count = parseInt(countStr, 10)
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {})
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {})
      }
      await SecureStore.deleteItemAsync(key).catch(() => {})
    } catch (err) {
      console.warn('SecureStore removeItem error:', err)
    }
  },
}

export async function clearAllStoredAuth(): Promise<void> {
  const keys = [
    'sb-pcikzpktdiwdgzchftmv-auth-token',
    'supabase.auth.token',
    'squadlink_auth_token',
  ]
  for (const k of keys) {
    await RobustSecureStoreAdapter.removeItem(k).catch(() => {})
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: RobustSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
