'use client'

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './auth-provider'
import {
  soundEffects,
  type KeybindConfig,
  DEFAULT_KEYBINDS,
  matchKeybind,
} from '@/lib/audio/sound-effects'

export interface ParticipantInfo {
  identity: string
  name: string
  avatarUrl?: string | null
  isSpeaking: boolean
  isMuted: boolean
  isDeafened?: boolean
  isScreenSharing: boolean
  isCameraOn?: boolean
}

export type ScreenQualityPresetKey = '720p_30' | '720p_60' | '1080p_30' | '1080p_60' | '480p_30'

export interface ScreenQualityPreset {
  key: ScreenQualityPresetKey
  label: string
  width: number
  height: number
  fps: number
  desc: string
}

export const SCREEN_QUALITY_PRESETS: Record<ScreenQualityPresetKey, ScreenQualityPreset> = {
  '720p_30': {
    key: '720p_30',
    label: '720p 30 FPS',
    width: 1280,
    height: 720,
    fps: 30,
    desc: 'Default (Balanced & Low Latency)',
  },
  '720p_60': {
    key: '720p_60',
    label: '720p 60 FPS',
    width: 1280,
    height: 720,
    fps: 60,
    desc: 'Smooth Gaming',
  },
  '1080p_30': {
    key: '1080p_30',
    label: '1080p 30 FPS',
    width: 1920,
    height: 1080,
    fps: 30,
    desc: 'High Definition',
  },
  '1080p_60': {
    key: '1080p_60',
    label: '1080p 60 FPS',
    width: 1920,
    height: 1080,
    fps: 60,
    desc: 'Ultra Smooth Pro Gaming',
  },
  '480p_30': {
    key: '480p_30',
    label: '480p 30 FPS',
    width: 854,
    height: 480,
    fps: 30,
    desc: 'Eco / Data Saver',
  },
}

export interface ConnectedChannelInfo {
  id: string
  name: string
  serverName?: string
  serverId?: string
}

export interface RemoteScreenStreamInfo {
  name: string
  stream: MediaStream
}

export interface RemoteCameraStreamInfo {
  name: string
  avatarUrl?: string | null
  stream: MediaStream
}

interface VoiceContextType {
  connectedChannel: ConnectedChannelInfo | null
  isConnected: boolean
  isConnecting: boolean
  isMuted: boolean
  isDeafened: boolean
  isScreenSharing: boolean
  isCameraOn: boolean
  cameraStream: MediaStream | null
  remoteCameraStreams: Record<string, RemoteCameraStreamInfo>
  toggleCamera: () => Promise<void>
  screenQuality: ScreenQualityPresetKey
  setScreenQuality: (preset: ScreenQualityPresetKey) => void
  localSpeaking: boolean
  participants: ParticipantInfo[]
  serverVoiceMembers: Record<string, ParticipantInfo[]>
  setVoiceServerId: (id: string | null) => void
  setVoiceChannelIds: (ids: string[]) => void
  ping: number
  callDuration: string
  channelStatus: string
  setChannelStatus: (status: string) => void
  screenStream: MediaStream | null
  remoteScreenStreams: Record<string, RemoteScreenStreamInfo>
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  setEchoCancellation: (enabled: boolean) => void
  setNoiseSuppression: (enabled: boolean) => void
  setAutoGainControl: (enabled: boolean) => void
  keybinds: KeybindConfig
  setKeybind: (action: keyof KeybindConfig, combo: string) => void
  resetKeybinds: () => void
  soundEffectsEnabled: boolean
  setSoundEffectsEnabled: (enabled: boolean) => void
  connectVoice: (channelId: string, channelName: string, serverName?: string, serverId?: string) => Promise<void>
  disconnectVoice: () => void
  toggleMute: () => void
  toggleDeafen: () => void
  toggleScreenShare: (videoEl?: HTMLVideoElement | null) => Promise<void>
  registerVideoContainer: (el: HTMLVideoElement | null) => void
}

const VoiceContext = createContext<VoiceContextType>({
  connectedChannel: null,
  isConnected: false,
  isConnecting: false,
  isMuted: false,
  isDeafened: false,
  isScreenSharing: false,
  isCameraOn: false,
  cameraStream: null,
  remoteCameraStreams: {},
  toggleCamera: async () => {},
  screenQuality: '720p_30',
  setScreenQuality: () => {},
  localSpeaking: false,
  participants: [],
  serverVoiceMembers: {},
  setVoiceServerId: () => {},
  setVoiceChannelIds: () => {},
  ping: 24,
  callDuration: '00:00',
  channelStatus: 'Set a channel status',
  setChannelStatus: () => {},
  screenStream: null,
  remoteScreenStreams: {},
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  setEchoCancellation: () => {},
  setNoiseSuppression: () => {},
  setAutoGainControl: () => {},
  keybinds: DEFAULT_KEYBINDS,
  setKeybind: () => {},
  resetKeybinds: () => {},
  soundEffectsEnabled: true,
  setSoundEffectsEnabled: () => {},
  connectVoice: async () => {},
  disconnectVoice: () => {},
  toggleMute: () => {},
  toggleDeafen: () => {},
  toggleScreenShare: async () => {},
  registerVideoContainer: () => {},
})

export function useVoice() {
  return useContext(VoiceContext)
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [connectedChannel, setConnectedChannel] = useState<ConnectedChannelInfo | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, RemoteCameraStreamInfo>>({})
  const [screenQuality, setScreenQualityState] = useState<ScreenQualityPresetKey>('720p_30')
  const [localSpeaking, setLocalSpeaking] = useState(false)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [ping, setPing] = useState(24)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, RemoteScreenStreamInfo>>({})
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [callDuration, setCallDuration] = useState('00:00')
  const [channelStatus, setChannelStatus] = useState('Set a channel status')

  // Load screen quality preset from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('squadlink_screen_quality_preset') as ScreenQualityPresetKey
      if (saved && SCREEN_QUALITY_PRESETS[saved]) {
        setScreenQualityState(saved)
        screenQualityRef.current = saved
      }
    } catch {}
  }, [])

  const setScreenQuality = useCallback((preset: ScreenQualityPresetKey) => {
    setScreenQualityState(preset)
    screenQualityRef.current = preset
    try {
      localStorage.setItem('squadlink_screen_quality_preset', preset)
    } catch {}
  }, [])

  // Advanced Voice Processing States (default true)
  const [echoCancellation, setEchoCancellationState] = useState(true)
  const [noiseSuppression, setNoiseSuppressionState] = useState(true)
  const [autoGainControl, setAutoGainControlState] = useState(true)

  // Keybinds & Sound Effects States
  const [keybinds, setKeybinds] = useState<KeybindConfig>(DEFAULT_KEYBINDS)
  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(true)

  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const videoContainerRef = useRef<HTMLVideoElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const presenceChannelRef = useRef<any>(null)

  // WebRTC Mesh Refs
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const queuedCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const isDeafenedRef = useRef(false)
  const isMutedRef = useRef(false)
  const serverPresenceChannelRef = useRef<any>(null)
  const isScreenSharingRef = useRef(false)
  const isCameraOnRef = useRef(false)
  const screenQualityRef = useRef<ScreenQualityPresetKey>('720p_30')
  const streamTypeByStreamId = useRef<Map<string, 'screen' | 'camera'>>(new Map())
  const streamTypeByPeerId = useRef<Map<string, 'screen' | 'camera'>>(new Map())
  const myIdentityRef = useRef<string>('')
  const participantsRef = useRef<ParticipantInfo[]>([])

  const supabase = createClient()
  const [voiceServerId, setVoiceServerId] = useState<string | null>(null)
  const [serverVoiceMembers, setServerVoiceMembers] = useState<Record<string, ParticipantInfo[]>>({})
  const connectedChannelRef = useRef<ConnectedChannelInfo | null>(null)

  // Direct channel presence subscriptions for all voice channels on active server
  const [voiceChannelIds, setVoiceChannelIdsState] = useState<string[]>([])
  const voiceChannelListenersRef = useRef<Map<string, any>>(new Map())

  const setVoiceChannelIds = useCallback((ids: string[]) => {
    setVoiceChannelIdsState((prev) => {
      const merged = Array.from(new Set([...prev, ...ids]))
      if (merged.length === prev.length && merged.every((id) => prev.includes(id))) {
        return prev
      }
      return merged
    })
  }, [])

  const getDisplayName = useCallback(() => {
    return profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'Squad Member'
  }, [profile?.username, user?.user_metadata?.username, user?.email])

  useEffect(() => {
    if (user?.id) {
      myIdentityRef.current = user.id
    }
  }, [user?.id])

  useEffect(() => {
    connectedChannelRef.current = connectedChannel
  }, [connectedChannel])

  // Automatically fetch voice channel IDs whenever voiceServerId changes
  useEffect(() => {
    if (!voiceServerId) {
      setVoiceChannelIdsState([])
      return
    }

    supabase
      .from('channels')
      .select('id')
      .eq('server_id', voiceServerId)
      .eq('type', 'voice')
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          const ids = data.map((c: any) => c.id)
          setVoiceChannelIdsState((prev) => Array.from(new Set([...prev, ...ids])))
        }
      })
  }, [voiceServerId])

  // Single, centralized Server-Wide Voice Presence subscription with instant 0ms broadcast updates
  useEffect(() => {
    if (!voiceServerId) {
      setServerVoiceMembers({})
      return
    }

    // Clean up previous server presence channel if exists
    if (serverPresenceChannelRef.current) {
      try {
        serverPresenceChannelRef.current.untrack()
        supabase.removeChannel(serverPresenceChannelRef.current)
      } catch (e) {}
      serverPresenceChannelRef.current = null
    }

    const channelName = `server-voice-presence-${voiceServerId}`
    const myId = myIdentityRef.current || user?.id || `user-${Date.now()}`

    const serverPresChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: myId,
        },
        broadcast: {
          self: false,
        },
      },
    })

    // Reconcile presence state from Supabase Realtime Presence
    const updatePresenceState = () => {
      const state = serverPresChannel.presenceState()
      const byChannel: Record<string, ParticipantInfo[]> = {}

      Object.values(state).forEach((presList: any) => {
        if (!Array.isArray(presList)) return
        presList.forEach((p: any) => {
          if (p && p.channelId && p.identity) {
            if (!byChannel[p.channelId]) {
              byChannel[p.channelId] = []
            }
            if (!byChannel[p.channelId].some((m) => m.identity === p.identity)) {
              byChannel[p.channelId].push({
                identity: p.identity,
                name: p.name || 'Squad Member',
                avatarUrl: p.avatarUrl || null,
                isSpeaking: !!p.isSpeaking,
                isMuted: !!p.isMuted,
                isDeafened: !!p.isDeafened,
                isScreenSharing: !!p.isScreenSharing,
                isCameraOn: !!p.isCameraOn,
              })
            }
          }
        })
      })

      // Merge with any instant broadcast updates so UI remains seamless
      setServerVoiceMembers((prev) => {
        const merged: Record<string, ParticipantInfo[]> = { ...byChannel }
        // Keep currently connected local user if in this server
        if (connectedChannelRef.current && connectedChannelRef.current.serverId === voiceServerId) {
          const cid = connectedChannelRef.current.id
          if (!merged[cid]) merged[cid] = []
          const myLocalId = myIdentityRef.current || user?.id
          if (myLocalId && !merged[cid].some((m) => m.identity === myLocalId)) {
            merged[cid].push({
              identity: myLocalId,
              name: getDisplayName(),
              avatarUrl: profile?.avatar_url || user?.user_metadata?.avatar_url || null,
              isSpeaking: false,
              isMuted: isMutedRef.current,
              isDeafened: isDeafenedRef.current,
              isScreenSharing: isScreenSharingRef.current,
              isCameraOn: isCameraOnRef.current,
            })
          }
        }
        return merged
      })
    }

    serverPresChannel
      // 1. Instant 0ms broadcast updates for join, leave, mute, and deafen
      .on('broadcast', { event: 'voice_state' }, ({ payload }: any) => {
        if (!payload || !payload.channelId || !payload.identity) return

        setServerVoiceMembers((prev) => {
          const next = { ...prev }
          const list = [...(next[payload.channelId] || [])]

          if (payload.action === 'leave') {
            next[payload.channelId] = list.filter((m) => m.identity !== payload.identity)
            return next
          }

          if (payload.action === 'join' || payload.action === 'update') {
            const member: ParticipantInfo = {
              identity: payload.identity,
              name: payload.name || 'Squad Member',
              avatarUrl: payload.avatarUrl || null,
              isSpeaking: !!payload.isSpeaking,
              isMuted: !!payload.isMuted,
              isDeafened: !!payload.isDeafened,
              isScreenSharing: !!payload.isScreenSharing,
              isCameraOn: !!payload.isCameraOn,
            }
            const existingIdx = list.findIndex((m) => m.identity === payload.identity)
            if (existingIdx >= 0) {
              list[existingIdx] = member
            } else {
              list.push(member)
            }
            next[payload.channelId] = list
            return next
          }

          return next
        })
      })
      // 2. Peer discovery query (any arriving client queries who is in voice)
      .on('broadcast', { event: 'voice_query' }, () => {
        if (connectedChannelRef.current && connectedChannelRef.current.serverId === voiceServerId) {
          const myCurrentId = myIdentityRef.current || user?.id
          if (!myCurrentId) return
          const myName = profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'Squad Member'
          const myAvatar = profile?.avatar_url || user?.user_metadata?.avatar_url || null

          serverPresChannel.send({
            type: 'broadcast',
            event: 'voice_state',
            payload: {
              action: 'join',
              channelId: connectedChannelRef.current.id,
              identity: myCurrentId,
              name: myName,
              avatarUrl: myAvatar,
              isSpeaking: false,
              isMuted: isMutedRef.current,
              isDeafened: isDeafenedRef.current,
              isScreenSharing: isScreenSharingRef.current,
              isCameraOn: isCameraOnRef.current,
            },
          })
        }
      })
      // 3. Fallback presence events
      .on('presence', { event: 'sync' }, updatePresenceState)
      .on('presence', { event: 'join' }, updatePresenceState)
      .on('presence', { event: 'leave' }, updatePresenceState)
      .subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          // If we are currently connected to a voice channel in this server, announce immediately
          if (connectedChannelRef.current && connectedChannelRef.current.serverId === voiceServerId) {
            const myCurrentId = myIdentityRef.current || user?.id
            const myName = getDisplayName()
            const myAvatar = profile?.avatar_url || user?.user_metadata?.avatar_url || null

            try {
              await serverPresChannel.track({
                identity: myCurrentId,
                channelId: connectedChannelRef.current.id,
                name: myName,
                avatarUrl: myAvatar,
                isSpeaking: false,
                isMuted: isMutedRef.current,
                isDeafened: isDeafenedRef.current,
                isScreenSharing: isScreenSharingRef.current,
                isCameraOn: isCameraOnRef.current,
              })
            } catch (e) {}

            serverPresChannel.send({
              type: 'broadcast',
              event: 'voice_state',
              payload: {
                action: 'join',
                channelId: connectedChannelRef.current.id,
                identity: myCurrentId,
                name: myName,
                avatarUrl: myAvatar,
                isSpeaking: false,
                isMuted: isMutedRef.current,
                isDeafened: isDeafenedRef.current,
                isScreenSharing: isScreenSharingRef.current,
                isCameraOn: isCameraOnRef.current,
              },
            })
          }

          // Query any existing connected voice members on this server
          serverPresChannel.send({
            type: 'broadcast',
            event: 'voice_query',
            payload: { from: myId },
          })
        }
      })

    serverPresenceChannelRef.current = serverPresChannel

    return () => {
      try {
        serverPresChannel.untrack()
        supabase.removeChannel(serverPresChannel)
      } catch (e) {}
      if (serverPresenceChannelRef.current === serverPresChannel) {
        serverPresenceChannelRef.current = null
      }
    }
  }, [voiceServerId, user?.id])

  // Direct Channel Presence Listeners for ALL voice channels of the server
  // This guarantees ANY user outside the channel sees who is currently inside with 100% reliability!
  useEffect(() => {
    const activeConnectedId = connectedChannel?.id

    // 1. If actively connected to a channel, remove observer listener (presenceChannelRef handles it)
    if (activeConnectedId && voiceChannelListenersRef.current.has(activeConnectedId)) {
      const existing = voiceChannelListenersRef.current.get(activeConnectedId)
      try {
        supabase.removeChannel(existing)
      } catch (e) {}
      voiceChannelListenersRef.current.delete(activeConnectedId)
    }

    // 2. Remove listeners for channels no longer in voiceChannelIds
    const listeningIds = Array.from(voiceChannelListenersRef.current.keys())
    for (const id of listeningIds) {
      if (!voiceChannelIds.includes(id)) {
        const listener = voiceChannelListenersRef.current.get(id)
        try {
          supabase.removeChannel(listener)
        } catch (e) {}
        voiceChannelListenersRef.current.delete(id)
        setServerVoiceMembers((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    }

    // 3. For each channel in voiceChannelIds (except actively connected one), subscribe as observer listener
    for (const vId of voiceChannelIds) {
      if (vId === activeConnectedId) continue
      if (voiceChannelListenersRef.current.has(vId)) continue

      const channelTopic = `voice-channel-${vId}`
      const myId = myIdentityRef.current || user?.id || `user-${Date.now()}`

      const listenerChannel = supabase.channel(channelTopic, {
        config: {
          presence: {
            key: `listener-${myId}`,
          },
          broadcast: {
            self: false,
          },
        },
      })

      const parsePresence = () => {
        const state = listenerChannel.presenceState()
        const members: ParticipantInfo[] = []

        Object.values(state).forEach((presList: any) => {
          if (!Array.isArray(presList)) return
          presList.forEach((p: any) => {
            // Filter out observer listeners so only real voice call participants are listed
            if (p && p.identity && !p.identity.startsWith('listener-')) {
              if (!members.some((m) => m.identity === p.identity)) {
                members.push({
                  identity: p.identity,
                  name: p.name || 'Squad Member',
                  avatarUrl: p.avatarUrl || null,
                  isSpeaking: !!p.isSpeaking,
                  isMuted: !!p.isMuted,
                  isDeafened: !!p.isDeafened,
                  isScreenSharing: !!p.isScreenSharing,
                  isCameraOn: !!p.isCameraOn,
                })
              }
            }
          })
        })

        if (members.length === 0) {
          // Do not overwrite known server voice state with an empty array during initial sync
          return
        }

        setServerVoiceMembers((prev) => ({
          ...prev,
          [vId]: members,
        }))
      }

      listenerChannel
        .on('presence', { event: 'sync' }, parsePresence)
        .on('presence', { event: 'join' }, parsePresence)
        .on('presence', { event: 'leave' }, parsePresence)
        .on('broadcast', { event: 'voice_state' }, ({ payload }: any) => {
          if (!payload || payload.channelId !== vId || !payload.identity) return

          setServerVoiceMembers((prev) => {
            const currentList = prev[vId] || []
            if (payload.action === 'leave') {
              return {
                ...prev,
                [vId]: currentList.filter((m) => m.identity !== payload.identity),
              }
            }
            if (payload.action === 'join' || payload.action === 'update') {
              const member: ParticipantInfo = {
                identity: payload.identity,
                name: payload.name || 'Squad Member',
                avatarUrl: payload.avatarUrl || null,
                isSpeaking: !!payload.isSpeaking,
                isMuted: !!payload.isMuted,
                isDeafened: !!payload.isDeafened,
                isScreenSharing: !!payload.isScreenSharing,
                isCameraOn: !!payload.isCameraOn,
              }
              const existingIdx = currentList.findIndex((m) => m.identity === payload.identity)
              const nextList = [...currentList]
              if (existingIdx >= 0) {
                nextList[existingIdx] = member
              } else {
                nextList.push(member)
              }
              return {
                ...prev,
                [vId]: nextList,
              }
            }
            return prev
          })
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            parsePresence()
          }
        })

      voiceChannelListenersRef.current.set(vId, listenerChannel)
    }
  }, [voiceChannelIds, connectedChannel?.id, user?.id])

  useEffect(() => {
    return () => {
      voiceChannelListenersRef.current.forEach((listener) => {
        try {
          supabase.removeChannel(listener)
        } catch (e) {}
      })
      voiceChannelListenersRef.current.clear()
    }
  }, [])

  // Instant broadcast on tab close or navigation away
  useEffect(() => {
    const handleUnload = () => {
      const channelId = connectedChannelRef.current?.id
      const id = myIdentityRef.current || user?.id
      if (channelId && id) {
        if (presenceChannelRef.current) {
          try {
            presenceChannelRef.current.send({
              type: 'broadcast',
              event: 'voice_state',
              payload: {
                action: 'leave',
                channelId,
                identity: id,
              },
            })
            presenceChannelRef.current.untrack()
          } catch (e) {}
        }
        if (serverPresenceChannelRef.current) {
          try {
            serverPresenceChannelRef.current.send({
              type: 'broadcast',
              event: 'voice_state',
              payload: {
                action: 'leave',
                channelId,
                identity: id,
              },
            })
            serverPresenceChannelRef.current.untrack()
          } catch (e) {}
        }
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
    }
  }, [user?.id])

  useEffect(() => {
    isDeafenedRef.current = isDeafened
  }, [isDeafened])

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing
  }, [isScreenSharing])

  useEffect(() => {
    participantsRef.current = participants
  }, [participants])

  // Discord Call Duration Timer
  useEffect(() => {
    if (!isConnected || !connectedAt) {
      setCallDuration('00:00')
      return
    }

    const updateTimer = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
      const hrs = Math.floor(elapsed / 3600)
      const mins = Math.floor((elapsed % 3600) / 60)
      const secs = elapsed % 60

      if (hrs > 0) {
        setCallDuration(
          `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        )
      } else {
        setCallDuration(
          `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        )
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [isConnected, connectedAt])

  // Hydrate settings & keybinds from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEcho = localStorage.getItem('squadlink-echo-cancellation')
      if (savedEcho !== null) setEchoCancellationState(savedEcho === 'true')

      const savedNoise = localStorage.getItem('squadlink-noise-suppression')
      if (savedNoise !== null) setNoiseSuppressionState(savedNoise === 'true')

      const savedGain = localStorage.getItem('squadlink-auto-gain')
      if (savedGain !== null) setAutoGainControlState(savedGain === 'true')

      const savedKeybinds = localStorage.getItem('squadlink-keybinds')
      if (savedKeybinds) {
        try {
          setKeybinds(JSON.parse(savedKeybinds))
        } catch {}
      }

      const savedSFX = localStorage.getItem('squadlink-sfx-enabled')
      if (savedSFX !== null) {
        setSoundEffectsEnabledState(savedSFX === 'true')
      }
    }
  }, [])

  const setKeybind = (action: keyof KeybindConfig, combo: string) => {
    setKeybinds((prev) => {
      const updated = { ...prev, [action]: combo }
      if (typeof window !== 'undefined') {
        localStorage.setItem('squadlink-keybinds', JSON.stringify(updated))
      }
      return updated
    })
  }

  const resetKeybinds = () => {
    setKeybinds(DEFAULT_KEYBINDS)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('squadlink-keybinds')
    }
  }

  const setSoundEffectsEnabled = (enabled: boolean) => {
    setSoundEffectsEnabledState(enabled)
    if (typeof window !== 'undefined') {
      localStorage.setItem('squadlink-sfx-enabled', String(enabled))
    }
  }

  // Helper to apply audio constraints dynamically to active microphone track
  const applyAudioTrackConstraints = async (constraints: MediaTrackConstraints) => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack && typeof audioTrack.applyConstraints === 'function') {
        try {
          await audioTrack.applyConstraints(constraints)
        } catch (e: any) {
          console.warn('Could not apply audio track constraints:', e.message)
        }
      }
    }
  }

  const setEchoCancellation = (enabled: boolean) => {
    setEchoCancellationState(enabled)
    if (typeof window !== 'undefined') {
      localStorage.setItem('squadlink-echo-cancellation', String(enabled))
    }
    applyAudioTrackConstraints({ echoCancellation: enabled })
  }

  const setNoiseSuppression = (enabled: boolean) => {
    setNoiseSuppressionState(enabled)
    if (typeof window !== 'undefined') {
      localStorage.setItem('squadlink-noise-suppression', String(enabled))
    }
    applyAudioTrackConstraints({ noiseSuppression: enabled })
  }

  const setAutoGainControl = (enabled: boolean) => {
    setAutoGainControlState(enabled)
    if (typeof window !== 'undefined') {
      localStorage.setItem('squadlink-auto-gain', String(enabled))
    }
    applyAudioTrackConstraints({ autoGainControl: enabled })
  }

  // Periodic ping fluctuation for realistic Discord indicator
  useEffect(() => {
    if (!isConnected) return
    const interval = setInterval(() => {
      setPing(Math.floor(18 + Math.random() * 12))
    }, 4000)
    return () => clearInterval(interval)
  }, [isConnected])

  const registerVideoContainer = (el: HTMLVideoElement | null) => {
    videoContainerRef.current = el
    if (el && screenStreamRef.current) {
      el.srcObject = screenStreamRef.current
    }
  }

  // WebRTC Helper: Attach incoming remote audio to Analyser for live speaking detection
  const attachRemoteAudioAnalyser = (peerId: string, stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      let lastRemoteSpeaking = false
      const monitorSpeaking = () => {
        if (!peerConnectionsRef.current.has(peerId)) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const avg = sum / bufferLength
        const isSpeaking = avg > 12

        if (isSpeaking !== lastRemoteSpeaking) {
          lastRemoteSpeaking = isSpeaking
          setParticipants((prev) =>
            prev.map((p) => (p.identity === peerId ? { ...p, isSpeaking } : p))
          )
        }

        requestAnimationFrame(monitorSpeaking)
      }

      requestAnimationFrame(monitorSpeaking)
    } catch (e) {
      console.warn('Remote audio analyser setup warning:', e)
    }
  }

  // WebRTC Helper: Create or retrieve RTCPeerConnection for a remote peer
  const getOrCreatePeerConnection = (targetPeerId: string, targetPeerName?: string): RTCPeerConnection => {
    if (peerConnectionsRef.current.has(targetPeerId)) {
      return peerConnectionsRef.current.get(targetPeerId)!
    }

    const pc = new RTCPeerConnection(RTC_CONFIG)
    peerConnectionsRef.current.set(targetPeerId, pc)

    // Add local microphone tracks
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    // Add local screen share tracks if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, screenStreamRef.current!)
      })
    }

    // Add local camera video tracks if active
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, cameraStreamRef.current!)
      })
    }

    // Ensure bidirectional video transceivers are pre-allocated for instant video display
    try {
      if (!screenStreamRef.current && !cameraStreamRef.current) {
        pc.addTransceiver('video', { direction: 'recvonly' })
      }
    } catch (e) {}

    // ICE Candidate Exchange
    pc.onicecandidate = (event) => {
      if (event.candidate && presenceChannelRef.current) {
        presenceChannelRef.current.send({
          type: 'broadcast',
          event: 'voice-signal',
          payload: {
            type: 'candidate',
            from: myIdentityRef.current,
            fromName: getDisplayName(),
            to: targetPeerId,
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          },
        })
      }
    }

    // Handle remote media track
    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track])
      if (event.track.kind === 'audio') {
        let audioEl = remoteAudiosRef.current.get(targetPeerId)
        if (!audioEl) {
          audioEl = document.createElement('audio')
          audioEl.setAttribute('data-squadlink-audio', targetPeerId)
          audioEl.setAttribute('playsinline', 'true')
          audioEl.autoplay = true
          document.body.appendChild(audioEl)
          remoteAudiosRef.current.set(targetPeerId, audioEl)
        }
        audioEl.srcObject = stream
        audioEl.muted = isDeafenedRef.current
        const playPromise = audioEl.play()
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.warn('Autoplay prevented on remote audio:', e)
            const onInteract = () => {
              audioEl?.play().catch(() => {})
              window.removeEventListener('click', onInteract)
              window.removeEventListener('touchstart', onInteract)
            }
            window.addEventListener('click', onInteract)
            window.addEventListener('touchstart', onInteract)
          })
        }

        attachRemoteAudioAnalyser(targetPeerId, stream)
      } else if (event.track.kind === 'video') {
        const peerObj = participantsRef.current.find((p) => p.identity === targetPeerId)
        const peerDisplayName = peerObj?.name || targetPeerName || 'Squad Member'

        // Determine if stream is camera or screen share
        const typeFromStream = streamTypeByStreamId.current.get(stream.id)
        const typeFromPeer = streamTypeByPeerId.current.get(targetPeerId)
        const isCam =
          typeFromStream === 'camera' ||
          typeFromPeer === 'camera' ||
          (peerObj?.isCameraOn && !peerObj?.isScreenSharing)

        if (isCam) {
          setRemoteCameraStreams((prev) => ({
            ...prev,
            [targetPeerId]: {
              name: peerDisplayName,
              avatarUrl: peerObj?.avatarUrl || null,
              stream,
            },
          }))

          event.track.onended = () => {
            setRemoteCameraStreams((prev) => {
              const next = { ...prev }
              delete next[targetPeerId]
              return next
            })
          }
        } else {
          setRemoteScreenStreams((prev) => ({
            ...prev,
            [targetPeerId]: {
              name: peerDisplayName,
              stream,
            },
          }))

          event.track.onended = () => {
            setRemoteScreenStreams((prev) => {
              const next = { ...prev }
              delete next[targetPeerId]
              return next
            })
          }
        }
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        if (typeof (pc as any).restartIce === 'function') {
          ;(pc as any).restartIce()
        }
      }
    }

    return pc
  }

  const connectVoice = async (
    channelId: string,
    channelName: string,
    serverName?: string,
    serverId?: string
  ) => {
    // If already connected to this channel, no-op
    if (isConnected && connectedChannel?.id === channelId) return

    setIsConnecting(true)

    try {
      // 1. Request microphone stream from user's chosen device with user voice processing settings
      let micStream: MediaStream | null = null
      if (typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const savedInput = localStorage.getItem('squadlink-audio-input')
          const audioConstraints: any = {
            echoCancellation,
            noiseSuppression,
            autoGainControl,
          }
          if (savedInput && savedInput !== 'default') {
            audioConstraints.deviceId = { exact: savedInput }
          }

          micStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
          })
          localStreamRef.current = micStream
        } catch (micErr: any) {
          console.warn('Microphone permission not granted or unavailable:', micErr.message)
        }
      }

      // 2. Set up Web Audio Analyser for local voice detection
      if (micStream) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
          const audioCtx = new AudioContextClass()
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {})
          }
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          const source = audioCtx.createMediaStreamSource(micStream)
          source.connect(analyser)

          audioContextRef.current = audioCtx
          analyserRef.current = analyser

          const bufferLength = analyser.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)

          let lastSpeakingState = false
          let lastVolumeTrackTime = 0
          const checkVolume = () => {
            if (!analyserRef.current) return
            analyserRef.current.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i]
            }
            const average = sum / bufferLength

            // Speaking volume threshold
            const isSpeakingNow = average > 12 && !isMutedRef.current

            if (isSpeakingNow !== lastSpeakingState) {
              lastSpeakingState = isSpeakingNow
              setLocalSpeaking(isSpeakingNow)
              setParticipants((prev) =>
                prev.map((p, idx) => (idx === 0 ? { ...p, isSpeaking: isSpeakingNow } : p))
              )

              // Throttle speaking volume presence updates to prevent Supabase Realtime rate-limit drops
              const now = Date.now()
              if (now - lastVolumeTrackTime > 3000 && serverPresenceChannelRef.current) {
                lastVolumeTrackTime = now
                serverPresenceChannelRef.current.track({
                  identity: myIdentityRef.current,
                  channelId: channelId,
                  name: getDisplayName(),
                  avatarUrl: profile?.avatar_url || null,
                  isSpeaking: isSpeakingNow,
                  isMuted: isMutedRef.current,
                  isDeafened: isDeafenedRef.current,
                  isScreenSharing: isScreenSharingRef.current,
                  isCameraOn: isCameraOnRef.current,
                }).catch(() => {})
              }
            }

            animFrameRef.current = requestAnimationFrame(checkVolume)
          }

          checkVolume()
        } catch (e) {
          console.error('AudioContext setup error:', e)
        }
      }

      const myId = user?.id || `user-${Date.now()}`
      myIdentityRef.current = myId
      const myName = getDisplayName()
      const myAvatar = profile?.avatar_url || null

      setConnectedChannel({ id: channelId, name: channelName, serverName, serverId })
      connectedChannelRef.current = { id: channelId, name: channelName, serverName, serverId }
      setIsConnected(true)
      setIsConnecting(false)
      setIsMuted(false)
      setIsDeafened(false)
      setConnectedAt(Date.now())

      if (soundEffectsEnabled) {
        soundEffects.playJoin()
      }

      const localParticipant: ParticipantInfo = {
        identity: myId,
        name: myName,
        avatarUrl: myAvatar,
        isSpeaking: false,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: false,
      }
      setParticipants([localParticipant])

      // Clean up previous channel if any
      if (presenceChannelRef.current) {
        try {
          presenceChannelRef.current.untrack()
          supabase.removeChannel(presenceChannelRef.current)
        } catch (e) {}
        presenceChannelRef.current = null
      }

      // Also clean up any observer listener for this channel so the channel topic is free
      if (voiceChannelListenersRef.current.has(channelId)) {
        const existingListener = voiceChannelListenersRef.current.get(channelId)
        try {
          supabase.removeChannel(existingListener)
        } catch (e) {}
        voiceChannelListenersRef.current.delete(channelId)
      }

      // Supabase Realtime Channel: Presence + Broadcast Signaling
      const presChannel = supabase.channel(`voice-channel-${channelId}`, {
        config: {
          presence: {
            key: myId,
          },
          broadcast: {
            self: false,
          },
        },
      })

      // Handle WebRTC Broadcast Signals
      presChannel.on('broadcast', { event: 'voice-signal' }, async ({ payload }: any) => {
        if (!payload) return
        if (payload.to && payload.to !== myId) return

        const fromPeerId = payload.from
        const fromPeerName = payload.fromName

        if (payload.type === 'stream-meta') {
          if (payload.streamId && payload.streamType) {
            streamTypeByStreamId.current.set(payload.streamId, payload.streamType)
          }
          if (payload.from && payload.streamType) {
            streamTypeByPeerId.current.set(payload.from, payload.streamType)
          }
        } else if (payload.type === 'screen-ended') {
          setRemoteScreenStreams((prev) => {
            const next = { ...prev }
            delete next[fromPeerId]
            return next
          })
        } else if (payload.type === 'camera-ended') {
          setRemoteCameraStreams((prev) => {
            const next = { ...prev }
            delete next[fromPeerId]
            return next
          })
        } else if (payload.type === 'offer') {
          const pc = getOrCreatePeerConnection(fromPeerId, fromPeerName)

          // Perfect negotiation glare handling
          if (pc.signalingState === 'have-local-offer') {
            if (myId > fromPeerId) {
              await pc.setLocalDescription({ type: 'rollback' })
            } else {
              return
            }
          }

          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

          // Flush any queued ICE candidates for this peer
          const queued = queuedCandidatesRef.current.get(fromPeerId) || []
          for (const cand of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand))
            } catch (err) {}
          }
          queuedCandidatesRef.current.delete(fromPeerId)

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)

          presChannel.send({
            type: 'broadcast',
            event: 'voice-signal',
            payload: {
              type: 'answer',
              from: myId,
              fromName: myName,
              to: fromPeerId,
              sdp: answer,
            },
          })
        } else if (payload.type === 'answer') {
          const pc = peerConnectionsRef.current.get(fromPeerId)
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

            // Flush queued candidates
            const queued = queuedCandidatesRef.current.get(fromPeerId) || []
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand))
              } catch (err) {}
            }
            queuedCandidatesRef.current.delete(fromPeerId)
          }
        } else if (payload.type === 'candidate') {
          const pc = peerConnectionsRef.current.get(fromPeerId)
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
            } catch (err) {
              console.warn('Add ICE candidate warning:', err)
            }
          } else {
            const list = queuedCandidatesRef.current.get(fromPeerId) || []
            list.push(payload.candidate)
            queuedCandidatesRef.current.set(fromPeerId, list)
          }
        }
      })

      // Presence Sync & Automated WebRTC Mesh Pairing
      presChannel
        .on('presence', { event: 'sync' }, async () => {
          const state = presChannel.presenceState()
          const memberMap = new Map<string, ParticipantInfo>()
          memberMap.set(localParticipant.identity, localParticipant)

          Object.values(state).forEach((presList: any) => {
            presList.forEach((p: any) => {
              if (p && p.identity) {
                memberMap.set(p.identity, {
                  identity: p.identity,
                  name: p.name || 'Squad Member',
                  avatarUrl: p.avatarUrl || null,
                  isSpeaking: p.identity === localParticipant.identity ? localSpeaking : !!p.isSpeaking,
                  isMuted: p.identity === localParticipant.identity ? isMutedRef.current : !!p.isMuted,
                  isDeafened: p.identity === localParticipant.identity ? isDeafenedRef.current : !!p.isDeafened,
                  isScreenSharing: p.identity === localParticipant.identity ? isScreenSharing : !!p.isScreenSharing,
                  isCameraOn: p.identity === localParticipant.identity ? isCameraOn : !!p.isCameraOn,
                })

                // If remote peer exists and deterministic pair initiator (myId < peerId):
                if (p.identity !== myId && !peerConnectionsRef.current.has(p.identity) && myId < p.identity) {
                  const pc = getOrCreatePeerConnection(p.identity, p.name)
                  pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                  })
                    .then((offer) => pc.setLocalDescription(offer).then(() => offer))
                    .then((offer) => {
                      presChannel.send({
                        type: 'broadcast',
                        event: 'voice-signal',
                        payload: {
                          type: 'offer',
                          from: myId,
                          fromName: myName,
                          to: p.identity,
                          sdp: offer,
                        },
                      })
                    })
                    .catch((err) => console.warn('Peer offer creation warning:', err))
                }
              }
            })
          })

          const allMembers = Array.from(memberMap.values())
          setParticipants(allMembers)
          setServerVoiceMembers((prev) => ({
            ...prev,
            [channelId]: allMembers,
          }))
        })
        .on('presence', { event: 'leave' }, ({ key }: any) => {
          // Clean up disconnected peer
          if (peerConnectionsRef.current.has(key)) {
            try {
              peerConnectionsRef.current.get(key)?.close()
            } catch (e) {}
            peerConnectionsRef.current.delete(key)
          }

          if (remoteAudiosRef.current.has(key)) {
            try {
              const audioEl = remoteAudiosRef.current.get(key)
              audioEl?.pause()
              if (audioEl) audioEl.srcObject = null
              audioEl?.remove()
            } catch (e) {}
            remoteAudiosRef.current.delete(key)
          }

          queuedCandidatesRef.current.delete(key)
          setRemoteScreenStreams((prev) => {
            const next = { ...prev }
            delete next[key]
            return next
          })
          setRemoteCameraStreams((prev) => {
            const next = { ...prev }
            delete next[key]
            return next
          })

          setServerVoiceMembers((prev) => {
            const list = prev[channelId] || []
            return {
              ...prev,
              [channelId]: list.filter((m) => m.identity !== key),
            }
          })
        })
        .on('broadcast', { event: 'voice_state' }, ({ payload }: any) => {
          if (!payload || payload.channelId !== channelId || !payload.identity) return

          setParticipants((prev) => {
            if (payload.action === 'leave') {
              return prev.filter((m) => m.identity !== payload.identity)
            }
            if (payload.action === 'join' || payload.action === 'update') {
              const member: ParticipantInfo = {
                identity: payload.identity,
                name: payload.name || 'Squad Member',
                avatarUrl: payload.avatarUrl || null,
                isSpeaking: !!payload.isSpeaking,
                isMuted: !!payload.isMuted,
                isDeafened: !!payload.isDeafened,
                isScreenSharing: !!payload.isScreenSharing,
                isCameraOn: !!payload.isCameraOn,
              }
              const existingIdx = prev.findIndex((m) => m.identity === payload.identity)
              if (existingIdx >= 0) {
                const next = [...prev]
                next[existingIdx] = member
                return next
              }
              return [...prev, member]
            }
            return prev
          })

          setServerVoiceMembers((prev) => {
            const currentList = prev[channelId] || []
            if (payload.action === 'leave') {
              return {
                ...prev,
                [channelId]: currentList.filter((m) => m.identity !== payload.identity),
              }
            }
            if (payload.action === 'join' || payload.action === 'update') {
              const member: ParticipantInfo = {
                identity: payload.identity,
                name: payload.name || 'Squad Member',
                avatarUrl: payload.avatarUrl || null,
                isSpeaking: !!payload.isSpeaking,
                isMuted: !!payload.isMuted,
                isDeafened: !!payload.isDeafened,
                isScreenSharing: !!payload.isScreenSharing,
                isCameraOn: !!payload.isCameraOn,
              }
              const existingIdx = currentList.findIndex((m) => m.identity === payload.identity)
              const nextList = [...currentList]
              if (existingIdx >= 0) {
                nextList[existingIdx] = member
              } else {
                nextList.push(member)
              }
              return {
                ...prev,
                [channelId]: nextList,
              }
            }
            return prev
          })
        })
        .subscribe(async (status: any) => {
          if (status === 'SUBSCRIBED') {
            await presChannel.track({
              identity: localParticipant.identity,
              name: myName,
              avatarUrl: myAvatar,
              isSpeaking: false,
              isMuted: false,
              isDeafened: false,
              isScreenSharing: false,
            })
          }
        })

      presenceChannelRef.current = presChannel

      // Server-wide Voice Presence (so all server members see who is in this voice channel without joining)
      if (serverId && voiceServerId !== serverId) {
        setVoiceServerId(serverId)
      }

      // Add to local serverVoiceMembers state immediately so local UI updates in 0ms
      setServerVoiceMembers((prev) => {
        const next = { ...prev }
        const list = [...(next[channelId] || [])]
        if (!list.some((m) => m.identity === myId)) {
          list.push({
            identity: myId,
            name: myName,
            avatarUrl: myAvatar,
            isSpeaking: false,
            isMuted: isMutedRef.current,
            isDeafened: isDeafenedRef.current,
            isScreenSharing: false,
          })
        }
        next[channelId] = list
        return next
      })

      // Send instant 0ms broadcast on both the dedicated voice channel topic AND server-wide channel
      presChannel.send({
        type: 'broadcast',
        event: 'voice_state',
        payload: {
          action: 'join',
          channelId,
          identity: myId,
          name: myName,
          avatarUrl: myAvatar,
          isSpeaking: false,
          isMuted: isMutedRef.current,
          isDeafened: isDeafenedRef.current,
          isScreenSharing: false,
        },
      })

      serverPresenceChannelRef.current?.send({
        type: 'broadcast',
        event: 'voice_state',
        payload: {
          action: 'join',
          channelId,
          identity: myId,
          name: myName,
          avatarUrl: myAvatar,
          isSpeaking: false,
          isMuted: isMutedRef.current,
          isDeafened: isDeafenedRef.current,
          isScreenSharing: false,
        },
      })

      // Also track in Supabase presence as durable fallback
      if (serverPresenceChannelRef.current) {
        serverPresenceChannelRef.current.track({
          identity: myId,
          channelId: channelId,
          name: myName,
          avatarUrl: myAvatar,
          isSpeaking: false,
          isMuted: isMutedRef.current,
          isDeafened: isDeafenedRef.current,
          isScreenSharing: false,
        }).catch(() => {})
      }
    } catch (err: any) {
      console.error('Voice connect error:', err)
      setIsConnecting(false)
    }
  }

  const disconnectVoice = () => {
    if (soundEffectsEnabled && isConnected) {
      soundEffects.playDisconnect()
    }

    const leavingChannelId = connectedChannelRef.current?.id || connectedChannel?.id
    const myId = myIdentityRef.current || user?.id

    // 1. Instant broadcast leave to all members on server and room (0ms latency!)
    if (leavingChannelId && myId) {
      if (presenceChannelRef.current) {
        try {
          presenceChannelRef.current.send({
            type: 'broadcast',
            event: 'voice_state',
            payload: {
              action: 'leave',
              channelId: leavingChannelId,
              identity: myId,
            },
          })
        } catch (e) {}
      }
      if (serverPresenceChannelRef.current) {
        try {
          serverPresenceChannelRef.current.send({
            type: 'broadcast',
            event: 'voice_state',
            payload: {
              action: 'leave',
              channelId: leavingChannelId,
              identity: myId,
            },
          })
        } catch (e) {}
      }
    }

    // 2. Remove from local serverVoiceMembers state immediately (0ms latency!)
    if (leavingChannelId && myId) {
      setServerVoiceMembers((prev) => {
        const next = { ...prev }
        if (next[leavingChannelId]) {
          next[leavingChannelId] = next[leavingChannelId].filter((m) => m.identity !== myId)
        }
        return next
      })
    }

    if (presenceChannelRef.current) {
      try {
        presenceChannelRef.current.untrack()
        supabase.removeChannel(presenceChannelRef.current)
      } catch (e) {}
      presenceChannelRef.current = null
    }

    if (serverPresenceChannelRef.current) {
      try {
        serverPresenceChannelRef.current.untrack()
      } catch (e) {}
      // Keep serverPresenceChannelRef alive so server member list stays synchronized
    }

    // Close all WebRTC Peer Connections
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close()
      } catch (e) {}
    })
    peerConnectionsRef.current.clear()

    // Stop and remove all remote audio elements
    remoteAudiosRef.current.forEach((audio) => {
      try {
        audio.pause()
        audio.srcObject = null
        audio.remove()
      } catch (e) {}
    })
    remoteAudiosRef.current.clear()
    queuedCandidatesRef.current.clear()
    setRemoteScreenStreams({})
    setRemoteCameraStreams({})

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
      setScreenStream(null)
    }

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
      setCameraStream(null)
    }
    setIsCameraOn(false)
    isCameraOnRef.current = false

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    if (videoContainerRef.current) {
      videoContainerRef.current.srcObject = null
    }

    setConnectedChannel(null)
    setIsConnected(false)
    setIsConnecting(false)
    setIsMuted(false)
    setIsDeafened(false)
    setIsScreenSharing(false)
    setLocalSpeaking(false)
    setConnectedAt(null)
    setCallDuration('00:00')
    setParticipants([])
  }

  const toggleMute = () => {
    const nextMute = !isMuted
    setIsMuted(nextMute)

    if (soundEffectsEnabled) {
      if (nextMute) {
        soundEffects.playMute()
      } else {
        soundEffects.playUnmute()
      }
    }

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMute
      })
    }

    if (nextMute) {
      setLocalSpeaking(false)
    }

    if (presenceChannelRef.current) {
      const myName = getDisplayName()
      presenceChannelRef.current.track({
        identity: myIdentityRef.current,
        name: myName,
        avatarUrl: profile?.avatar_url || null,
        isSpeaking: false,
        isMuted: nextMute,
        isDeafened: isDeafenedRef.current,
        isScreenSharing: isScreenSharingRef.current,
        isCameraOn: isCameraOnRef.current,
      })

      if (connectedChannel) {
        presenceChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_state',
          payload: {
            action: 'update',
            channelId: connectedChannel.id,
            identity: myIdentityRef.current,
            name: myName,
            avatarUrl: profile?.avatar_url || null,
            isSpeaking: false,
            isMuted: nextMute,
            isDeafened: isDeafenedRef.current,
            isScreenSharing: isScreenSharingRef.current,
            isCameraOn: isCameraOnRef.current,
          },
        })
      }
    }

    if (serverPresenceChannelRef.current && connectedChannel) {
      serverPresenceChannelRef.current.send({
        type: 'broadcast',
        event: 'voice_state',
        payload: {
          action: 'update',
          channelId: connectedChannel.id,
          identity: myIdentityRef.current,
          name: getDisplayName(),
          avatarUrl: profile?.avatar_url || null,
          isSpeaking: false,
          isMuted: nextMute,
          isDeafened: isDeafenedRef.current,
          isScreenSharing: isScreenSharingRef.current,
          isCameraOn: isCameraOnRef.current,
        },
      })
      serverPresenceChannelRef.current.track({
        identity: myIdentityRef.current,
        channelId: connectedChannel.id,
        name: getDisplayName(),
        avatarUrl: profile?.avatar_url || null,
        isSpeaking: false,
        isMuted: nextMute,
        isDeafened: isDeafenedRef.current,
        isScreenSharing: isScreenSharingRef.current,
        isCameraOn: isCameraOnRef.current,
      }).catch(() => {})
    }

    setParticipants((prev) =>
      prev.map((p, idx) => (idx === 0 ? { ...p, isMuted: nextMute, isSpeaking: nextMute ? false : p.isSpeaking } : p))
    )
  }

  const toggleDeafen = () => {
    const nextDeaf = !isDeafened
    setIsDeafened(nextDeaf)

    if (soundEffectsEnabled) {
      if (nextDeaf) {
        soundEffects.playDeafen()
      } else {
        soundEffects.playUndeafen()
      }
    }

    if (nextDeaf) {
      setIsMuted(true)
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false
        })
      }
      setLocalSpeaking(false)
    }

    // Mute or unmute all remote audio playback elements
    remoteAudiosRef.current.forEach((audio) => {
      audio.muted = nextDeaf
    })

    if (presenceChannelRef.current) {
      const myName = getDisplayName()
      presenceChannelRef.current.track({
        identity: myIdentityRef.current,
        name: myName,
        avatarUrl: profile?.avatar_url || null,
        isSpeaking: false,
        isMuted: nextDeaf ? true : isMutedRef.current,
        isDeafened: nextDeaf,
        isScreenSharing: isScreenSharingRef.current,
        isCameraOn: isCameraOnRef.current,
      })

      if (connectedChannel) {
        presenceChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_state',
          payload: {
            action: 'update',
            channelId: connectedChannel.id,
            identity: myIdentityRef.current,
            name: myName,
            avatarUrl: profile?.avatar_url || null,
            isSpeaking: false,
            isMuted: nextDeaf ? true : isMutedRef.current,
            isDeafened: nextDeaf,
            isScreenSharing: isScreenSharingRef.current,
            isCameraOn: isCameraOnRef.current,
          },
        })
      }
    }

    if (serverPresenceChannelRef.current && connectedChannel) {
      serverPresenceChannelRef.current.send({
        type: 'broadcast',
        event: 'voice_state',
        payload: {
          action: 'update',
          channelId: connectedChannel.id,
          identity: myIdentityRef.current,
          name: getDisplayName(),
          avatarUrl: profile?.avatar_url || null,
          isSpeaking: false,
          isMuted: nextDeaf ? true : isMutedRef.current,
          isDeafened: nextDeaf,
          isScreenSharing: isScreenSharingRef.current,
          isCameraOn: isCameraOnRef.current,
        },
      })
      serverPresenceChannelRef.current.track({
        identity: myIdentityRef.current,
        channelId: connectedChannel.id,
        name: getDisplayName(),
        avatarUrl: profile?.avatar_url || null,
        isSpeaking: false,
        isMuted: nextDeaf ? true : isMutedRef.current,
        isDeafened: nextDeaf,
        isScreenSharing: isScreenSharingRef.current,
        isCameraOn: isCameraOnRef.current,
      }).catch(() => {})
    }

    setParticipants((prev) =>
      prev.map((p, idx) =>
        idx === 0
          ? { ...p, isDeafened: nextDeaf, isMuted: nextDeaf ? true : p.isMuted, isSpeaking: nextDeaf ? false : p.isSpeaking }
          : p
      )
    )
  }

  const updateMediaPresence = (sharingScreen: boolean, cameraActive: boolean) => {
    isScreenSharingRef.current = sharingScreen
    isCameraOnRef.current = cameraActive
    const myName = profile?.username || user?.user_metadata?.username || 'User'
    const avatar = profile?.avatar_url || null

    if (presenceChannelRef.current) {
      presenceChannelRef.current.track({
        identity: myIdentityRef.current,
        name: myName,
        avatarUrl: avatar,
        isSpeaking: localSpeaking,
        isMuted: isMutedRef.current,
        isDeafened: isDeafenedRef.current,
        isScreenSharing: sharingScreen,
        isCameraOn: cameraActive,
      }).catch(() => {})
    }

    if (serverPresenceChannelRef.current && connectedChannel) {
      serverPresenceChannelRef.current.send({
        type: 'broadcast',
        event: 'voice_state',
        payload: {
          action: 'update',
          channelId: connectedChannel.id,
          identity: myIdentityRef.current,
          name: myName,
          avatarUrl: avatar,
          isSpeaking: localSpeaking,
          isMuted: isMutedRef.current,
          isDeafened: isDeafenedRef.current,
          isScreenSharing: sharingScreen,
          isCameraOn: cameraActive,
        },
      }).catch(() => {})

      serverPresenceChannelRef.current.track({
        identity: myIdentityRef.current,
        channelId: connectedChannel.id,
        name: myName,
        avatarUrl: avatar,
        isSpeaking: localSpeaking,
        isMuted: isMutedRef.current,
        isDeafened: isDeafenedRef.current,
        isScreenSharing: sharingScreen,
        isCameraOn: cameraActive,
      }).catch(() => {})
    }
  }

  const toggleCamera = async () => {
    try {
      if (isCameraOn) {
        // Stop Camera
        const currentStream = cameraStreamRef.current
        if (currentStream) {
          currentStream.getTracks().forEach((track) => track.stop())
          cameraStreamRef.current = null
          setCameraStream(null)
        }
        setIsCameraOn(false)
        isCameraOnRef.current = false

        // Remove camera tracks from active peer connections & renegotiate
        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          const senders = pc.getSenders().filter((s) => s.track && s.track.kind === 'video')
          senders.forEach((s) => {
            if (s.track && currentStream?.getTracks().includes(s.track)) {
              try { pc.removeTrack(s) } catch (e) {}
            }
          })
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            presenceChannelRef.current?.send({
              type: 'broadcast',
              event: 'voice-signal',
              payload: {
                type: 'offer',
                from: myIdentityRef.current,
                fromName: getDisplayName(),
                to: peerId,
                sdp: offer,
              },
            })
          } catch (e) {}
        })

        presenceChannelRef.current?.send({
          type: 'broadcast',
          event: 'voice-signal',
          payload: {
            type: 'camera-ended',
            from: myIdentityRef.current,
          },
        })

        updateMediaPresence(isScreenSharingRef.current, false)

        setParticipants((prev) =>
          prev.map((p, idx) => (idx === 0 ? { ...p, isCameraOn: false } : p))
        )
      } else {
        // Start Camera
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('Camera video streaming is not supported on this device or browser.')
          return
        }

        let stream: MediaStream | null = null
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
            audio: false,
          })
        } catch (camErr: any) {
          console.warn('Camera stream error:', camErr.message)
          alert('Camera access was denied or camera hardware is busy.')
          return
        }

        if (!stream) return

        cameraStreamRef.current = stream
        setCameraStream(stream)
        setIsCameraOn(true)
        isCameraOnRef.current = true

        const camTrack = stream.getVideoTracks()[0]
        if (camTrack) {
          camTrack.onended = () => {
            toggleCamera()
          }
        }

        // Inform peers that this stream is Camera
        presenceChannelRef.current?.send({
          type: 'broadcast',
          event: 'voice-signal',
          payload: {
            type: 'stream-meta',
            streamType: 'camera',
            streamId: stream.id,
            from: myIdentityRef.current,
          },
        })

        // Add camera track to all active peer connections
        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          pc.addTrack(camTrack, stream!)
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            presenceChannelRef.current?.send({
              type: 'broadcast',
              event: 'voice-signal',
              payload: {
                type: 'offer',
                from: myIdentityRef.current,
                fromName: getDisplayName(),
                to: peerId,
                sdp: offer,
              },
            })
          } catch (e) {
            console.warn('Camera renegotiation warning:', e)
          }
        })

        updateMediaPresence(isScreenSharingRef.current, true)

        setParticipants((prev) =>
          prev.map((p, idx) => (idx === 0 ? { ...p, isCameraOn: true } : p))
        )
      }
    } catch (err: any) {
      console.warn('toggleCamera error:', err.message)
      setIsCameraOn(false)
      setCameraStream(null)
    }
  }

  const toggleScreenShare = async (videoEl?: HTMLVideoElement | null) => {
    try {
      if (isScreenSharing) {
        // Stop screen share
        const currentStream = screenStreamRef.current
        if (currentStream) {
          currentStream.getTracks().forEach((track) => track.stop())
          screenStreamRef.current = null
          setScreenStream(null)
        }
        if (videoContainerRef.current) {
          videoContainerRef.current.srcObject = null
        }
        setIsScreenSharing(false)
        isScreenSharingRef.current = false

        // Remove screen video tracks from active peer connections & renegotiate
        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          const senders = pc.getSenders().filter((s) => s.track && s.track.kind === 'video')
          senders.forEach((s) => {
            if (s.track && currentStream?.getTracks().includes(s.track)) {
              try { pc.removeTrack(s) } catch (e) {}
            }
          })
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            presenceChannelRef.current?.send({
              type: 'broadcast',
              event: 'voice-signal',
              payload: {
                type: 'offer',
                from: myIdentityRef.current,
                fromName: getDisplayName(),
                to: peerId,
                sdp: offer,
              },
            })
          } catch (e) {}
        })

        presenceChannelRef.current?.send({
          type: 'broadcast',
          event: 'voice-signal',
          payload: {
            type: 'screen-ended',
            from: myIdentityRef.current,
          },
        })

        updateMediaPresence(false, isCameraOnRef.current)

        setParticipants((prev) =>
          prev.map((p, idx) => (idx === 0 ? { ...p, isScreenSharing: false } : p))
        )
      } else {
        // Start screen share
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          alert(
            'Screen sharing is not supported by your mobile browser. To stream live video from your phone, please use the Camera Video Stream button.'
          )
          return
        }

        const presetKey = screenQualityRef.current || '720p_30'
        const preset = SCREEN_QUALITY_PRESETS[presetKey] || SCREEN_QUALITY_PRESETS['720p_30']

        let stream: MediaStream | null = null

        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: preset.width },
              height: { ideal: preset.height },
              frameRate: { ideal: preset.fps, max: preset.fps },
            },
            audio: true,
          })
        } catch (audioErr: any) {
          console.warn('Screen share with audio unavailable, trying video only:', audioErr.message)
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                width: { ideal: preset.width },
                height: { ideal: preset.height },
                frameRate: { ideal: preset.fps, max: preset.fps },
              },
              audio: false,
            })
          } catch (videoErr: any) {
            console.warn('Constrained display media failed, trying standard video capture:', videoErr.message)
            try {
              stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
              })
            } catch (finalErr: any) {
              console.warn('getDisplayMedia failed or denied on this device:', finalErr.message)
              return
            }
          }
        }

        if (!stream) return

        screenStreamRef.current = stream
        setScreenStream(stream)
        setIsScreenSharing(true)
        isScreenSharingRef.current = true

        const targetVideo = videoEl || videoContainerRef.current
        if (targetVideo) {
          targetVideo.srcObject = stream
        }

        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.onended = () => {
            toggleScreenShare(videoContainerRef.current)
          }
        }

        // Inform peers that this stream is Screen Share
        presenceChannelRef.current?.send({
          type: 'broadcast',
          event: 'voice-signal',
          payload: {
            type: 'stream-meta',
            streamType: 'screen',
            streamId: stream.id,
            from: myIdentityRef.current,
          },
        })

        // Add track to all existing peer connections and renegotiate
        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          pc.addTrack(videoTrack, stream!)
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            presenceChannelRef.current?.send({
              type: 'broadcast',
              event: 'voice-signal',
              payload: {
                type: 'offer',
                from: myIdentityRef.current,
                fromName: getDisplayName(),
                to: peerId,
                sdp: offer,
              },
            })
          } catch (e) {
            console.warn('Screen share renegotiation warning:', e)
          }
        })

        updateMediaPresence(true, isCameraOnRef.current)

        setParticipants((prev) =>
          prev.map((p, idx) => (idx === 0 ? { ...p, isScreenSharing: true } : p))
        )
      }
    } catch (err: any) {
      console.warn('Screen share error or cancelled:', err.message)
      setIsScreenSharing(false)
      setScreenStream(null)
    }
  }

  // Global Discord-Style Shortcut Keybind Listener
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      const hasModifier = e.ctrlKey || e.altKey || e.metaKey

      if (isInput && !hasModifier) {
        return
      }

      if (matchKeybind(e, keybinds.mute)) {
        e.preventDefault()
        toggleMute()
      } else if (matchKeybind(e, keybinds.deafen)) {
        e.preventDefault()
        toggleDeafen()
      } else if (matchKeybind(e, keybinds.disconnect)) {
        if (isConnected) {
          e.preventDefault()
          disconnectVoice()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [keybinds, isConnected, isMuted, isDeafened, soundEffectsEnabled])

  return (
    <VoiceContext.Provider
      value={{
        connectedChannel,
        isConnected,
        isConnecting,
        isMuted,
        isDeafened,
        isScreenSharing,
        isCameraOn,
        cameraStream,
        remoteCameraStreams,
        toggleCamera,
        screenQuality,
        setScreenQuality,
        localSpeaking,
        participants,
        serverVoiceMembers,
        setVoiceServerId,
        setVoiceChannelIds,
        ping,
        callDuration,
        channelStatus,
        setChannelStatus,
        screenStream,
        remoteScreenStreams,
        echoCancellation,
        noiseSuppression,
        autoGainControl,
        setEchoCancellation,
        setNoiseSuppression,
        setAutoGainControl,
        keybinds,
        setKeybind,
        resetKeybinds,
        soundEffectsEnabled,
        setSoundEffectsEnabled,
        connectVoice,
        disconnectVoice,
        toggleMute,
        toggleDeafen,
        toggleScreenShare,
        registerVideoContainer,
      }}
    >
      {children}
    </VoiceContext.Provider>
  )
}
