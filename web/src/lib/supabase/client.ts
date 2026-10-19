import { createBrowserClient } from '@supabase/ssr'

const BACKUP_KEY = 'squadlink_auth_backup_v1'

function parseDocumentCookies(): { name: string; value: string }[] {
  if (typeof document === 'undefined' || !document.cookie) return []
  return document.cookie
    .split(';')
    .map((c) => {
      const parts = c.trim().split('=')
      const name = parts[0]
      const value = parts.slice(1).join('=')
      try {
        return { name: decodeURIComponent(name), value: decodeURIComponent(value) }
      } catch {
        return { name, value }
      }
    })
    .filter((c) => c.name && c.value)
}

function getBackupCookies(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveBackupCookies(cookies: { name: string; value: string; options?: any }[]) {
  if (typeof window === 'undefined') return
  try {
    const current = getBackupCookies()
    for (const c of cookies) {
      if (!c.value || c.options?.maxAge === 0) {
        delete current[c.name]
      } else {
        current[c.name] = c.value
      }
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(current))
  } catch {}
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const docCookies = parseDocumentCookies()
          const backup = getBackupCookies()

          // Check if any Supabase auth cookies are in document.cookie
          const hasAuthCookie = docCookies.some(
            (c) => c.name.includes('-auth-token') || c.name.startsWith('sb-')
          )

          if (!hasAuthCookie && Object.keys(backup).length > 0) {
            // Restore from localStorage backup into document.cookie
            for (const [name, value] of Object.entries(backup)) {
              if (value && typeof document !== 'undefined') {
                try {
                  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`
                } catch {}
              }
            }
            return parseDocumentCookies()
          }

          // If document.cookie has auth cookies, ensure localStorage backup is up to date
          if (hasAuthCookie) {
            const toBackup: Record<string, string> = { ...backup }
            for (const c of docCookies) {
              if (c.name.includes('-auth-token') || c.name.startsWith('sb-')) {
                toBackup[c.name] = c.value
              }
            }
            try {
              localStorage.setItem(BACKUP_KEY, JSON.stringify(toBackup))
            } catch {}
          }

          return docCookies
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          saveBackupCookies(cookiesToSet)
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
              cookieStr += `; max-age=${options?.maxAge ?? 31536000}`
              cookieStr += `; path=${options?.path ?? '/'}`
              cookieStr += `; SameSite=${options?.sameSite ?? 'Lax'}`
              if (options?.secure) cookieStr += '; Secure'
              document.cookie = cookieStr
            } catch {}
          })
        },
      },
      cookieOptions: {
        maxAge: 31536000, // 1 year persistent session
        sameSite: 'lax',
        path: '/',
      },
    }
  )
}
