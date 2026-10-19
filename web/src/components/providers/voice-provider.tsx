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
}

export interface ConnectedChannelInfo {
  id: string
  name: string
  serverName?: string
}

export interface RemoteScreenStreamInfo {
  name: string
  stream: MediaStream
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
  const [localSpeaking, setLocalSpeaking] = useState(false)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [ping, setPing] = useState(24)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, RemoteScreenStreamInfo>>({})
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

  // WebRTC Mesh Refs
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const queuedCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const isDeafenedRef = useRef(false)
  const isMutedRef = useRef(false)
  const myIdentityRef = useRef<string>('')
  const participantsRef = useRef<ParticipantInfo[]>([])

  const supabase = createClient()

  useEffect(() => {
    isDeafenedRef.current = isDeafened
  }, [isDeafened])

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

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

      const monitorSpeaking = () => {
        if (!peerConnectionsRef.current.has(peerId)) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const avg = sum / bufferLength
        const isSpeaking = avg > 12

        setParticipants((prev) =>
          prev.map((p) => (p.identity === peerId ? { ...p, isSpeaking } : p))
        )

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

    // ICE Candidate Exchange
    pc.onicecandidate = (event) => {
      if (event.candidate && presenceChannelRef.current) {
        presenceChannelRef.current.send({
          type: 'broadcast',
          event: 'voice-signal',
          payload: {
            type: 'candidate',
            from: myIdentityRef.current,
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

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        if (typeof (pc as any).restartIce === 'function') {
          ;(pc as any).restartIce()
        }
      }
    }

    return pc
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

      const myId = user?.id || `user-${Date.now()}`
      myIdentityRef.current = myId
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
        if (!payload || payload.to !== myId) return

        const fromPeerId = payload.from
        const fromPeerName = payload.fromName

        if (payload.type === 'offer') {
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
        } else if (payload.type === 'screen-ended') {
          setRemoteScreenStreams((prev) => {
            const next = { ...prev }
            delete next[fromPeerId]
            return next
          })
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
                  name: p.name,
                  avatarUrl: p.avatarUrl || null,
                  isSpeaking: p.identity === localParticipant.identity ? localSpeaking : !!p.isSpeaking,
                  isMuted: p.identity === localParticipant.identity ? isMutedRef.current : !!p.isMuted,
                  isDeafened: p.identity === localParticipant.identity ? isDeafenedRef.current : !!p.isDeafened,
                  isScreenSharing: p.identity === localParticipant.identity ? isScreenSharing : !!p.isScreenSharing,
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

          setParticipants(Array.from(memberMap.values()))
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
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

    if (presenceChannelRef.current) {
      const myName = profile?.username || user?.user_metadata?.username || 'Shamsy'
      presenceChannelRef.current.track({
        identity: myIdentityRef.current,
        name: myName,
        avatarUrl: profile?.avatar_url || null,
        isSpeaking: false,
        isMuted: nextMute,
        isDeafened: isDeafenedRef.current,
        isScreenSharing,
      })
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
      const myName = profile?.username || user?.user_metadata?.username || 'Shamsy'
      presenceChannelRef.current.track({
        identity: myIdentityRef.current,
        name: myName,
        avatarUrl: profile?.avatar_url || null,
        isSpeaking: false,
        isMuted: nextDeaf ? true : isMutedRef.current,
        isDeafened: nextDeaf,
        isScreenSharing,
      })
    }

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
        // Stop screen share
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop())
          screenStreamRef.current = null
          setScreenStream(null)
        }
        if (videoContainerRef.current) {
          videoContainerRef.current.srcObject = null
        }
        setIsScreenSharing(false)

        // Remove video tracks from active peer connections & renegotiate
        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
          if (sender) {
            try {
              pc.removeTrack(sender)
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              presenceChannelRef.current?.send({
                type: 'broadcast',
                event: 'voice-signal',
                payload: {
                  type: 'offer',
                  from: myIdentityRef.current,
                  to: peerId,
                  sdp: offer,
                },
              })
            } catch (e) {}
          }
        })

        presenceChannelRef.current?.send({
          type: 'broadcast',
          event: 'voice-signal',
          payload: {
            type: 'screen-ended',
            from: myIdentityRef.current,
          },
        })

        if (presenceChannelRef.current) {
          const myName = profile?.username || user?.user_metadata?.username || 'Shamsy'
          presenceChannelRef.current.track({
            identity: myIdentityRef.current,
            name: myName,
            avatarUrl: profile?.avatar_url || null,
            isSpeaking: localSpeaking,
            isMuted: isMutedRef.current,
            isDeafened: isDeafenedRef.current,
            isScreenSharing: false,
          })
        }

        setParticipants((prev) =>
          prev.map((p, idx) => (idx === 0 ? { ...p, isScreenSharing: false } : p))
        )
      } else {
        let stream: MediaStream | null = null

        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                cursor: 'always',
                frameRate: { ideal: 60, max: 60 },
              } as any,
              audio: true,
            })
          } catch (audioErr: any) {
            console.warn('Screen share with audio unavailable, falling back to video only:', audioErr.message)
            try {
              stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                  cursor: 'always',
                  frameRate: { ideal: 60, max: 60 },
                } as any,
                audio: false,
              })
            } catch (videoErr: any) {
              console.warn('Screen capture cancelled or denied:', videoErr.message)
              return
            }
          }
        } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          // Mobile / WebView fallback: Stream camera feed as live tactical video in the squad channel
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            })
          } catch (camErr: any) {
            alert('Camera or screen stream unavailable: ' + camErr.message)
            return
          }
        } else {
          alert('Screen sharing is not supported on this platform.')
          return
        }

        if (!stream) return

        screenStreamRef.current = stream
        setScreenStream(stream)

        const targetVideo = videoEl || videoContainerRef.current
        if (targetVideo) {
          targetVideo.srcObject = stream
        }

        const videoTrack = stream.getVideoTracks()[0]

        // Add track to all existing peer connections and renegotiate
        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
          if (sender) {
            await sender.replaceTrack(videoTrack)
          } else {
            pc.addTrack(videoTrack, stream)
          }

          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            presenceChannelRef.current?.send({
              type: 'broadcast',
              event: 'voice-signal',
              payload: {
                type: 'offer',
                from: myIdentityRef.current,
                to: peerId,
                sdp: offer,
              },
            })
          } catch (e) {
            console.warn('Screen share renegotiation warning:', e)
          }
        })

        videoTrack.onended = () => {
          toggleScreenShare(videoContainerRef.current)
        }

        setIsScreenSharing(true)

        if (presenceChannelRef.current) {
          const myName = profile?.username || user?.user_metadata?.username || 'Shamsy'
          presenceChannelRef.current.track({
            identity: myIdentityRef.current,
            name: myName,
            avatarUrl: profile?.avatar_url || null,
            isSpeaking: localSpeaking,
            isMuted: isMutedRef.current,
            isDeafened: isDeafenedRef.current,
            isScreenSharing: true,
          })
        }

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
        localSpeaking,
        participants,
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
