'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useTheme } from '@/components/providers/theme-provider'
import { soundEffects } from '@/lib/audio/sound-effects'

interface MemberLocation {
  id: string
  username: string
  avatar_url: string | null
  latitude: number
  longitude: number
  updated_at: string
  is_sharing_location: boolean
}

interface TacticalPing {
  id: string
  lat: number
  lng: number
  type: 'rally' | 'danger' | 'objective' | 'loot'
  label: string
  senderName: string
  created_at: string
}

interface SquadMapProps {
  serverId: string
}

const CARTO_API_KEY =
  process.env.NEXT_PUBLIC_CARTO_API_KEY || 'cb1_4oc9_1_c946b5858182c70b60267803'

function getCartoTileUrl(theme: string) {
  if (theme === 'dark') {
    return `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`
  }
  return `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`
}

function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = Math.max(0, now.getTime() - date.getTime())
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

const PING_CONFIG = {
  rally: { emoji: '🚩', label: 'Rally Point', color: '#3b82f6' },
  danger: { emoji: '⚠️', label: 'Hostile / Danger', color: '#ef4444' },
  objective: { emoji: '🎯', label: 'Target / Objective', color: '#10b981' },
  loot: { emoji: '📦', label: 'Loot / Supply Drop', color: '#f59e0b' },
}

export default function SquadMap({ serverId }: SquadMapProps) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [members, setMembers] = useState<MemberLocation[]>([])
  const [pings, setPings] = useState<TacticalPing[]>([])
  const [loading, setLoading] = useState(true)
  const [isSharingLocation, setIsSharingLocation] = useState(true)
  const [gpsStatus, setGpsStatus] = useState<string>('')
  const [isWatchingGps, setIsWatchingGps] = useState(false)
  const [pingMode, setPingMode] = useState<keyof typeof PING_CONFIG | null>(null)
  const [showRoster, setShowRoster] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersGroupRef = useRef<any>(null)
  const pingsGroupRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const watchIdRef = useRef<number | null>(null)
  const realtimeChannelRef = useRef<any>(null)

  const supabase = createClient()
  const currentUserId = user?.id || '00000000-0000-0000-0000-000000000001'
  const currentUserName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'SquadLeader'

  // Inject Leaflet CDN CSS if not already present
  useEffect(() => {
    const linkId = 'leaflet-css-cdn-loader'
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }
  }, [])

  // 1. Fetch locations from Supabase
  const fetchLocations = useCallback(async () => {
    try {
      // Check current user location sharing preference
      const { data: myLoc } = await supabase
        .from('locations')
        .select('is_sharing_location')
        .eq('user_id', currentUserId)
        .eq('server_id', serverId)
        .maybeSingle()

      if (myLoc !== null && myLoc !== undefined) {
        setIsSharingLocation(myLoc.is_sharing_location ?? true)
      }

      // Fetch all members with sharing enabled
      const { data: locData } = await supabase
        .from('locations')
        .select('*, users(id, username, avatar_url)')
        .eq('server_id', serverId)
        .eq('is_sharing_location', true)

      if (locData && locData.length > 0) {
        const mapped: MemberLocation[] = locData
          .filter((loc) => loc.latitude !== 0 || loc.longitude !== 0)
          .map((loc) => ({
            id: loc.users?.id || loc.user_id,
            username: loc.users?.username || 'Squad Mate',
            avatar_url: loc.users?.avatar_url || null,
            latitude: loc.latitude,
            longitude: loc.longitude,
            updated_at: loc.updated_at,
            is_sharing_location: loc.is_sharing_location,
          }))

        setMembers(mapped)
        setLoading(false)
        return
      }

      // Zero fake members - only real locations
      setMembers([])
    } catch (e) {
      console.error('Error fetching squad locations:', e)
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [serverId, supabase])

  // 2. Initialize Leaflet Map with CARTO tiles
  useEffect(() => {
    let isMounted = true

    const initMap = async () => {
      if (!mapContainerRef.current) return

      // Dynamically import Leaflet
      const L = await import('leaflet')
      LRef.current = L

      if (!isMounted || !mapContainerRef.current) return

      // Cleanup existing instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const initialCenter: [number, number] = [22.35359, 91.846268]

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        zoomControl: false, // We render custom modern glassmorphic zoom buttons
      })
      mapInstanceRef.current = map

      // Leaflet CARTO Tile Layer
      const tileUrl = getCartoTileUrl(theme)
      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 20,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)
      tileLayerRef.current = tileLayer

      // Layer groups for markers & tactical pings
      markersGroupRef.current = L.layerGroup().addTo(map)
      pingsGroupRef.current = L.layerGroup().addTo(map)

      // Map click listener for dropping tactical pings
      map.on('click', (e: any) => {
        if (!pingModeRef.current) return
        const activeType = pingModeRef.current
        const newPing: TacticalPing = {
          id: 'ping-' + Date.now(),
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          type: activeType,
          label: PING_CONFIG[activeType].label,
          senderName: currentUserName,
          created_at: new Date().toISOString(),
        }

        // Add locally
        setPings((prev) => [...prev, newPing])
        soundEffects.playPing()

        // Broadcast to squad
        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.send({
            type: 'broadcast',
            event: 'tactical_ping',
            payload: newPing,
          })
        }

        // Reset ping mode after drop
        setPingMode(null)
      })

      // Invalidate size after DOM settles
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize()
        }
      }, 300)
    }

    initMap()

    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Keep a ref to pingMode for map click callback
  const pingModeRef = useRef<keyof typeof PING_CONFIG | null>(null)
  useEffect(() => {
    pingModeRef.current = pingMode
    if (mapContainerRef.current) {
      if (pingMode) {
        mapContainerRef.current.style.cursor = 'crosshair'
      } else {
        mapContainerRef.current.style.cursor = ''
      }
    }
  }, [pingMode])

  // 3. Update TileLayer when theme changes
  useEffect(() => {
    if (tileLayerRef.current) {
      const tileUrl = getCartoTileUrl(theme)
      tileLayerRef.current.setUrl(tileUrl)
    }
  }, [theme])

  // 4. Update member markers on map
  useEffect(() => {
    const L = LRef.current
    const map = mapInstanceRef.current
    const markersGroup = markersGroupRef.current

    if (!L || !map || !markersGroup) return

    markersGroup.clearLayers()
    if (members.length === 0) return

    const bounds: [number, number][] = []

    members.forEach((member) => {
      const isLocal = member.id === currentUserId
      const avatarSrc =
        member.avatar_url ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(member.username)}`

      const pulseRingHtml = isLocal
        ? `<div style="
            position: absolute;
            top: -10px;
            left: -10px;
            width: 66px;
            height: 66px;
            border-radius: 50%;
            border: 2px solid #06b6d4;
            animation: squad-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
            pointer-events: none;
          "></div>`
        : ''

      const markerHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          ${pulseRingHtml}
          <div style="
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${isLocal ? '#06b6d4, #10b981' : '#8b5cf6, #ec4899'});
            padding: 3px;
            box-shadow: 0 4px 18px ${isLocal ? 'rgba(6, 182, 212, 0.6)' : 'rgba(139, 92, 246, 0.5)'};
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease;
          ">
            <img src="${avatarSrc}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: #0f172a;" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=Squad'" />
          </div>
          <div style="
            margin-top: 4px;
            background: rgba(15, 23, 42, 0.95);
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            letter-spacing: 0.02em;
          ">
            ${isLocal ? '🟢 ' : ''}${member.username}
          </div>
        </div>
      `

      const customIcon = L.divIcon({
        className: 'squad-member-pin',
        html: markerHtml,
        iconSize: [46, 70],
        iconAnchor: [23, 23],
        popupAnchor: [0, -25],
      })

      const marker = L.marker([member.latitude, member.longitude], {
        icon: customIcon,
      })

      marker.bindPopup(`
        <div style="font-family: inherit; padding: 6px 4px; min-width: 180px; color: #0f172a;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <img src="${avatarSrc}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: #0f172a;" />
            <div>
              <strong style="font-size: 14px; color: #0f172a;">${member.username}</strong>
              <div style="font-size: 10px; color: ${isLocal ? '#059669' : '#7c3aed'}; font-weight: 700;">
                ${isLocal ? 'Squad Leader (You)' : 'Squad Member'}
              </div>
            </div>
          </div>
          <div style="font-size: 11px; color: #6b21a8; background: #f3e8ff; padding: 3px 8px; border-radius: 9999px; font-weight: 700; display: inline-block;">
            🕒 ${getTimeAgo(member.updated_at)}
          </div>
          <div style="margin-top: 6px; font-size: 10px; color: #64748b; font-family: monospace;">
            GPS: ${member.latitude.toFixed(5)}, ${member.longitude.toFixed(5)}
          </div>
        </div>
      `)

      markersGroup.addLayer(marker)
      bounds.push([member.latitude, member.longitude])
    })

    // If initial load and bounds exist, set initial view nicely
    if (bounds.length > 0 && mapInstanceRef.current && !mapInstanceRef.current._hasInitialFit) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 14)
      } else {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 })
      }
      mapInstanceRef.current._hasInitialFit = true
    }

    map.invalidateSize()
  }, [members, currentUserId])

  // 5. Update tactical pings on map
  useEffect(() => {
    const L = LRef.current
    const pingsGroup = pingsGroupRef.current
    if (!L || !pingsGroup) return

    pingsGroup.clearLayers()

    pings.forEach((ping) => {
      const cfg = PING_CONFIG[ping.type] || PING_CONFIG.rally

      const pingHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="
            position: absolute;
            top: -6px;
            left: -6px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: ${cfg.color};
            opacity: 0.4;
            animation: squad-pulse 1.4s ease-out infinite;
            pointer-events: none;
          "></div>
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: ${cfg.color};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 4px 14px ${cfg.color}99;
            border: 2px solid #ffffff;
          ">
            ${cfg.emoji}
          </div>
          <div style="
            margin-top: 2px;
            background: rgba(15, 23, 42, 0.95);
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            white-space: nowrap;
          ">
            ${cfg.label}
          </div>
        </div>
      `

      const pingIcon = L.divIcon({
        className: 'squad-ping-pin',
        html: pingHtml,
        iconSize: [36, 56],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      })

      const marker = L.marker([ping.lat, ping.lng], { icon: pingIcon })
      marker.bindPopup(`
        <div style="font-family: inherit; padding: 4px; min-width: 150px; color: #0f172a;">
          <div style="font-weight: 800; font-size: 13px; color: ${cfg.color}; margin-bottom: 2px;">
            ${cfg.emoji} ${cfg.label}
          </div>
          <div style="font-size: 11px; color: #475569;">
            Pinged by <strong>${ping.senderName}</strong>
          </div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
            ${getTimeAgo(ping.created_at)}
          </div>
        </div>
      `)

      pingsGroup.addLayer(marker)
    })
  }, [pings])

  // 6. Handle container resize
  useEffect(() => {
    if (!mapContainerRef.current) return
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    })
    resizeObserver.observe(mapContainerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // 7. Supabase Realtime for Locations & Tactical Pings
  useEffect(() => {
    fetchLocations()

    const channel = supabase
      .channel(`squad-map-${serverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'locations',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          fetchLocations()
        }
      )
      .on('broadcast', { event: 'tactical_ping' }, ({ payload }) => {
        if (payload) {
          setPings((prev) => [...prev, payload])
          soundEffects.playPing()
        }
      })
      .on('broadcast', { event: 'clear_pings' }, () => {
        setPings([])
      })
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [serverId, fetchLocations, supabase])

  // 8. Update Location to Supabase
  const pushLocationToSupabase = async (lat: number, lng: number) => {
    await supabase.from('locations').upsert(
      {
        user_id: currentUserId,
        server_id: serverId,
        latitude: lat,
        longitude: lng,
        is_sharing_location: isSharingLocation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,server_id' }
    )
  }

  // 9. Single GPS fetch
  const sendCurrentWebLocation = () => {
    setGpsStatus('Acquiring GPS...')
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          await pushLocationToSupabase(lat, lng)

          setGpsStatus('📍 GPS Synced!')
          setTimeout(() => setGpsStatus(''), 3000)

          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 1.5 })
          }

          fetchLocations()
        },
        (err) => {
          console.warn('GPS error:', err.message)
          setGpsStatus(`GPS error: ${err.message}`)
          setTimeout(() => setGpsStatus(''), 4000)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else {
      setGpsStatus('Geolocation not supported on this device')
      setTimeout(() => setGpsStatus(''), 4000)
    }
  }

  // 10. Continuous Live Watch GPS Toggle
  const toggleLiveWatchGps = () => {
    if (isWatchingGps) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setIsWatchingGps(false)
      setGpsStatus('Live tracking paused')
      setTimeout(() => setGpsStatus(''), 2500)
    } else {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        setIsWatchingGps(true)
        setGpsStatus('📡 Live GPS Tracking Active')

        const id = navigator.geolocation.watchPosition(
          async (pos) => {
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            await pushLocationToSupabase(lat, lng)
            fetchLocations()
          },
          (err) => {
            console.warn('Watch GPS error:', err.message)
            setGpsStatus(`GPS: ${err.message}`)
          },
          { enableHighAccuracy: true, maximumAge: 5000 }
        )
        watchIdRef.current = id
      } else {
        setGpsStatus('Geolocation not supported')
        setTimeout(() => setGpsStatus(''), 3000)
      }
    }
  }

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // 11. Default Eco Battery-Saver Sync (Updates every 10 minutes to save battery & prevent heating)
  useEffect(() => {
    // Only runs when Sharing is enabled and user is NOT in high-frequency Live Watch mode
    if (!isSharingLocation || isWatchingGps) return

    const syncLowPowerGps = () => {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            await pushLocationToSupabase(lat, lng)
            fetchLocations()
          },
          (err) => {
            console.debug('Background low-power GPS check:', err.message)
          },
          { enableHighAccuracy: false, maximumAge: 600000, timeout: 15000 }
        )
      }
    }

    // Every 10 minutes (600,000 ms)
    const TEN_MINUTES_MS = 10 * 60 * 1000
    const timerId = setInterval(syncLowPowerGps, TEN_MINUTES_MS)

    return () => clearInterval(timerId)
  }, [isSharingLocation, isWatchingGps, serverId, currentUserId, fetchLocations])

  // 11. Recenter on Current User
  const recenterOnUser = () => {
    const me = members.find((m) => m.id === currentUserId)
    if (me && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([me.latitude, me.longitude], 15, { duration: 1.2 })
    } else {
      sendCurrentWebLocation()
    }
  }

  // 12. Fit all squad members
  const fitSquadBounds = () => {
    if (!mapInstanceRef.current || members.length === 0) return
    const bounds = members.map((m) => [m.latitude, m.longitude] as [number, number])
    if (bounds.length === 1) {
      mapInstanceRef.current.flyTo(bounds[0], 14, { duration: 1.2 })
    } else {
      mapInstanceRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 16, duration: 1.2 })
    }
  }

  // 13. Fly to specific member
  const flyToMember = (member: MemberLocation) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([member.latitude, member.longitude], 16, { duration: 1.2 })
    }
  }

  // 14. Toggle location sharing
  const toggleLocationSharing = async () => {
    const nextState = !isSharingLocation
    setIsSharingLocation(nextState)

    await supabase.from('locations').upsert(
      {
        user_id: currentUserId,
        server_id: serverId,
        is_sharing_location: nextState,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,server_id' }
    )

    fetchLocations()
  }

  // 15. Clear all pings
  const clearAllPings = () => {
    setPings([])
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'clear_pings',
        payload: {},
      })
    }
  }

  return (
    <div className="relative flex h-full w-full min-h-0 flex-1 flex-col bg-slate-100 dark:bg-slate-950 p-3 sm:p-4 select-none transition-colors duration-200 isolate z-0">
      {/* Pulse keyframe animation inject */}
      <style jsx global>{`
        @keyframes squad-pulse {
          0% {
            transform: scale(0.95);
            opacity: 0.8;
          }
          70% {
            transform: scale(1.4);
            opacity: 0;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
        .leaflet-container {
          z-index: 0 !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25) !important;
          padding: 4px !important;
        }
        .leaflet-popup-tip {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25) !important;
        }
      `}</style>

      {/* Top Banner / Privacy Radar Controls */}
      <div className="z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/80 p-3 sm:p-4 backdrop-blur-md shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400 text-lg shadow-sm border border-cyan-500/20">
            🌐
            {isWatchingGps && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Squad Radar (Live Tactical Comms)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                CARTO Powered
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 dark:text-gray-400">
                {members.length} member(s) online
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border">
                {isWatchingGps ? (
                  <span className="text-cyan-500 border-cyan-500/30 bg-cyan-500/10">⚡ High-Precision Live</span>
                ) : isSharingLocation ? (
                  <span className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10">🔋 Eco Sync (10m Battery Saver)</span>
                ) : (
                  <span className="text-gray-400 border-gray-500/30 bg-gray-500/10">👻 Radar Ghost Mode</span>
                )}
              </span>
              {gpsStatus && (
                <span className="text-xs font-bold text-cyan-500 animate-pulse">{gpsStatus}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tactical Ping Mode Selector */}
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-white/5 p-1 border border-slate-200 dark:border-white/5">
            {(Object.keys(PING_CONFIG) as Array<keyof typeof PING_CONFIG>).map((type) => {
              const cfg = PING_CONFIG[type]
              const isActive = pingMode === type
              return (
                <button
                  key={type}
                  onClick={() => setPingMode(isActive ? null : type)}
                  title={`Drop ${cfg.label} (Click map)`}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md scale-105'
                      : 'text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span>{cfg.emoji}</span>
                  <span className="hidden md:inline">{cfg.label.split(' ')[0]}</span>
                </button>
              )
            })}
            {pings.length > 0 && (
              <button
                onClick={clearAllPings}
                title="Clear all tactical waypoints"
                className="px-2 py-1.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                🗑️
              </button>
            )}
          </div>

          {/* Live GPS Watch */}
          <button
            onClick={toggleLiveWatchGps}
            title={isWatchingGps ? 'Pause continuous tracking' : 'Start continuous GPS tracking'}
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 border ${
              isWatchingGps
                ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 animate-pulse'
                : 'border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            <span>📡</span>
            <span className="hidden sm:inline">{isWatchingGps ? 'Live Active' : 'Live Watch'}</span>
          </button>

          {/* Privacy Toggle Switch */}
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 dark:bg-white/5 px-3 py-1.5 border border-slate-200 dark:border-white/5">
            <span className="text-xs font-semibold text-slate-700 dark:text-gray-300 hidden sm:inline">
              Share:
            </span>
            <button
              onClick={toggleLocationSharing}
              title="Toggle broadcasting your location to the squad"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                isSharingLocation
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                  : 'bg-slate-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                  isSharingLocation ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Roster Drawer Toggle */}
          <button
            onClick={() => setShowRoster((prev) => !prev)}
            title="Toggle squad roster"
            className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
              showRoster
                ? 'bg-purple-600 text-white border-purple-500'
                : 'border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            <span>👥</span>
            <span className="hidden sm:inline">Roster</span>
          </button>
        </div>
      </div>

      {/* Ping Mode Active Banner */}
      {pingMode && (
        <div className="z-10 mb-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-purple-600/90 to-pink-600/90 text-white px-4 py-2 backdrop-blur-md shadow-lg animate-bounce">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <span>{PING_CONFIG[pingMode].emoji}</span>
            <span>
              Click anywhere on the map to drop a <strong>{PING_CONFIG[pingMode].label}</strong>!
            </span>
          </div>
          <button
            onClick={() => setPingMode(null)}
            className="text-xs font-bold underline hover:opacity-80 cursor-pointer ml-3"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Map View Port */}
      <div className="relative flex-1 min-h-[350px] w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl bg-slate-200 dark:bg-slate-900 isolate z-0">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
            <p className="mt-4 text-sm font-bold text-slate-600 dark:text-gray-300">
              Initializing Squad Radar with CARTO...
            </p>
          </div>
        )}

        {/* Map Container */}
        <div ref={mapContainerRef} className="h-full w-full" style={{ minHeight: '100%' }} />

        {/* Floating Quick Action Overlay Buttons (Recenter / Fit Squad / Zoom) */}
        <div className="absolute bottom-5 right-5 z-10 flex flex-col gap-2">
          <button
            onClick={recenterOnUser}
            title="Center on my location"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-white backdrop-blur-md shadow-xl border border-slate-200 dark:border-white/10 hover:scale-110 active:scale-95 transition-all cursor-pointer font-bold text-lg"
          >
            🎯
          </button>
          <button
            onClick={fitSquadBounds}
            title="Fit all squad members in view"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-white backdrop-blur-md shadow-xl border border-slate-200 dark:border-white/10 hover:scale-110 active:scale-95 transition-all cursor-pointer font-bold text-base"
          >
            👥
          </button>
          <div className="flex flex-col rounded-2xl overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xl border border-slate-200 dark:border-white/10">
            <button
              onClick={() => mapInstanceRef.current && mapInstanceRef.current.zoomIn()}
              title="Zoom In"
              className="flex h-10 w-11 items-center justify-center text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors font-bold text-lg cursor-pointer"
            >
              +
            </button>
            <div className="h-[1px] bg-slate-200 dark:bg-white/10" />
            <button
              onClick={() => mapInstanceRef.current && mapInstanceRef.current.zoomOut()}
              title="Zoom Out"
              className="flex h-10 w-11 items-center justify-center text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors font-bold text-lg cursor-pointer"
            >
              −
            </button>
          </div>
        </div>

        {/* Floating Squad Roster Drawer */}
        {showRoster && (
          <div className="absolute top-4 left-4 z-10 w-64 max-h-[calc(100%-32px)] overflow-y-auto rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border border-slate-200 dark:border-white/10 p-4 transition-all">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-gray-400">
                Squad Members ({members.length})
              </h4>
              <button
                onClick={() => setShowRoster(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            {members.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 dark:text-gray-500">
                No squad members sharing GPS yet. Click &quot;Update My GPS&quot; to broadcast.
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const isLocal = member.id === currentUserId
                  return (
                    <div
                      key={member.id}
                      onClick={() => flyToMember(member)}
                      className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={
                            member.avatar_url ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(member.username)}`
                          }
                          alt={member.username}
                          className="h-8 w-8 rounded-full object-cover bg-slate-800 flex-shrink-0"
                          onError={(e: any) => {
                            e.target.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=Squad'
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-white truncate">
                            {member.username}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {getTimeAgo(member.updated_at)}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-cyan-500 font-bold">
                        Locate 🎯
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
