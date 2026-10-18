'use client'

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './auth-provider'

export interface ParticipantInfo {
  identity: string
  name: string
  avatarUrl?: string | null
  isSpeaking: boolean
  isMuted: boolean
  isDeafened?: boolean
  isScreenSharing: boolean
}

import {
  soundEffects,
  type KeybindConfig,
  DEFAULT_KEYBINDS,
  matchKeybind,
} from '@/lib/audio/sound-effects'

export interface ConnectedChannelInfo {
  id: string
  name: string
  serverName?: string
}

interface VoiceContextType {
  connectedChannel: ConnectedChannelInfo | null
  isConnected: boolean
  isConnecting: boolean
  isMuted: boolean
  isDeafened: boolean
  isScreenSharing: boolean
  localSpeaking: boolean
  participants: ParticipantInfo[]
  ping: number
  callDuration: string
  channelStatus: string
  setChannelStatus: (status: string) => void
  screenStream: MediaStream | null
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
  connectVoice: (channelId: string, channelName: string, serverName?: string) => Promise<void>
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
  localSpeaking: false,
  participants: [],
  ping: 24,
  callDuration: '00:00',
  channelStatus: 'Set a channel status',
  setChannelStatus: () => {},
  screenStream: null,
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

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [connectedChannel, setConnectedChannel] = useState<ConnectedChannelInfo | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [localSpeaking, setLocalSpeaking] = useState(false)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [ping, setPing] = useState(24)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [callDuration, setCallDuration] = useState('00:00')
  const [channelStatus, setChannelStatus] = useState('Set a channel status')

  // Advanced Voice Processing States (default true)
  const [echoCancellation, setEchoCancellationState] = useState(true)
  const [noiseSuppression, setNoiseSuppressionState] = useState(true)
  const [autoGainControl, setAutoGainControlState] = useState(true)

  // Keybinds & Sound Effects States
  const [keybinds, setKeybinds] = useState<KeybindConfig>(DEFAULT_KEYBINDS)
  const [soundEffectsEnabled, setSoundEffectsEnabledState] = useState(true)

  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const videoContainerRef = useRef<HTMLVideoElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const presenceChannelRef = useRef<any>(null)
  const supabase = createClient()

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
          console.log('Applied WebRTC audio constraints:', constraints)
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

  const connectVoice = async (channelId: string, channelName: string, serverName?: string) => {
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
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          const source = audioCtx.createMediaStreamSource(micStream)
          source.connect(analyser)

          audioContextRef.current = audioCtx
          analyserRef.current = analyser

          const bufferLength = analyser.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)

          const checkVolume = () => {
            if (!analyserRef.current) return
            analyserRef.current.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i]
            }
            const average = sum / bufferLength

            // Speaking volume threshold
            const isSpeakingNow = average > 12 && !isMuted
            setLocalSpeaking(isSpeakingNow)
            setParticipants((prev) =>
              prev.map((p, idx) => (idx === 0 ? { ...p, isSpeaking: isSpeakingNow } : p))
            )

            animFrameRef.current = requestAnimationFrame(checkVolume)
          }

          checkVolume()
        } catch (e) {
          console.error('AudioContext setup error:', e)
        }
      }

      const myName = profile?.username || user?.user_metadata?.username || 'Shamsy'
      const myAvatar = profile?.avatar_url || null

      setConnectedChannel({ id: channelId, name: channelName, serverName })
      setIsConnected(true)
      setIsConnecting(false)
      setIsMuted(false)
      setIsDeafened(false)
      setConnectedAt(Date.now())

      if (soundEffectsEnabled) {
        soundEffects.playJoin()
      }

      const localParticipant: ParticipantInfo = {
        identity: user?.id || 'local-user',
        name: myName,
        avatarUrl: myAvatar,
        isSpeaking: false,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: false,
      }
      setParticipants([localParticipant])

      // Realtime Presence via Supabase
      try {
        if (presenceChannelRef.current) {
          presenceChannelRef.current.untrack()
          supabase.removeChannel(presenceChannelRef.current)
          presenceChannelRef.current = null
        }

        const presChannel = supabase.channel(`voice-presence-${channelId}`, {
          config: {
            presence: {
              key: user?.id || `user-${Date.now()}`,
            },
          },
        })

        presChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presChannel.presenceState()
            const memberMap = new Map<string, ParticipantInfo>()
            memberMap.set(localParticipant.identity, localParticipant)

            Object.values(state).forEach((presList: any) => {
              presList.forEach((p: any) => {
                if (p && p.identity) {
                  memberMap.set(p.identity, {
                    identity: p.identity,
                    name: p.name,
                    avatarUrl: p.avatarUrl || null,
                    isSpeaking: p.identity === localParticipant.identity ? localSpeaking : !!p.isSpeaking,
                    isMuted: p.identity === localParticipant.identity ? isMuted : !!p.isMuted,
                    isDeafened: p.identity === localParticipant.identity ? isDeafened : !!p.isDeafened,
                    isScreenSharing: p.identity === localParticipant.identity ? isScreenSharing : !!p.isScreenSharing,
                  })
                }
              })
            })

            setParticipants(Array.from(memberMap.values()))
          })
          .subscribe(async (status) => {
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
      } catch (presErr) {
        console.warn('Realtime presence error:', presErr)
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

    if (presenceChannelRef.current) {
      try {
        presenceChannelRef.current.untrack()
        supabase.removeChannel(presenceChannelRef.current)
      } catch (e) {}
      presenceChannelRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
      setScreenStream(null)
    }

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

    const audioTags = document.querySelectorAll('audio[data-squadlink-audio]')
    audioTags.forEach((audio) => {
      ;(audio as HTMLAudioElement).muted = nextDeaf
    })

    setParticipants((prev) =>
      prev.map((p, idx) =>
        idx === 0
          ? { ...p, isDeafened: nextDeaf, isMuted: nextDeaf ? true : p.isMuted, isSpeaking: nextDeaf ? false : p.isSpeaking }
          : p
      )
    )
  }

  const toggleScreenShare = async (videoEl?: HTMLVideoElement | null) => {
    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop())
          screenStreamRef.current = null
          setScreenStream(null)
        }
        if (videoContainerRef.current) {
          videoContainerRef.current.srcObject = null
        }
        setIsScreenSharing(false)
        setParticipants((prev) =>
          prev.map((p, idx) => (idx === 0 ? { ...p, isScreenSharing: false } : p))
        )
      } else {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
              frameRate: { ideal: 60, max: 60 },
            } as any,
            audio: true,
          })
          screenStreamRef.current = stream
          setScreenStream(stream)

          const targetVideo = videoEl || videoContainerRef.current
          if (targetVideo) {
            targetVideo.srcObject = stream
          }

          stream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false)
            setScreenStream(null)
            if (videoContainerRef.current) videoContainerRef.current.srcObject = null
            setParticipants((prev) =>
              prev.map((p, idx) => (idx === 0 ? { ...p, isScreenSharing: false } : p))
            )
          }

          setIsScreenSharing(true)
          setParticipants((prev) =>
            prev.map((p, idx) => (idx === 0 ? { ...p, isScreenSharing: true } : p))
          )
        } else {
          alert('Screen sharing is not supported on this device/browser.')
        }
      }
    } catch (err: any) {
      console.warn('Screen share cancelled or failed:', err.message)
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
        localSpeaking,
        participants,
        ping,
        callDuration,
        channelStatus,
        setChannelStatus,
        screenStream,
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
