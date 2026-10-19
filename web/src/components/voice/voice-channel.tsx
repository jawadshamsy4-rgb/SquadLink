'use client'

import { useRef, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useVoice, ParticipantInfo } from '@/components/providers/voice-provider'

interface VoiceChannelProps {
  channelId: string
  channelName: string
  serverId?: string
}

export default function VoiceChannel({ channelId, channelName, serverId }: VoiceChannelProps) {
  const { user, profile } = useAuth()
  const {
    connectedChannel,
    isConnected,
    isConnecting,
    isMuted,
    isDeafened,
    isScreenSharing,
    localSpeaking,
    participants,
    serverVoiceMembers,
    setVoiceServerId,
    setVoiceChannelIds,
    screenStream,
    remoteScreenStreams,
    connectVoice,
    disconnectVoice,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    registerVideoContainer,
  } = useVoice()

  const videoContainerRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (serverId) {
      setVoiceServerId(serverId)
    }
    if (channelId) {
      setVoiceChannelIds([channelId])
    }
  }, [serverId, channelId, setVoiceServerId, setVoiceChannelIds])

  const isConnectedToThisChannel = isConnected && connectedChannel?.id === channelId
  const roomMembers = isConnectedToThisChannel
    ? participants
    : serverVoiceMembers[channelId] || []

  useEffect(() => {
    if (videoContainerRef.current) {
      registerVideoContainer(videoContainerRef.current)
    }
  }, [isScreenSharing])

  const handleConnect = () => {
    connectVoice(channelId, channelName, undefined, serverId)
  }

  // Active Screen Shares (Both Local and Remote)
  const activeStreams: Array<{
    id: string
    title: string
    stream: MediaStream
    isLocal: boolean
  }> = []

  if (isScreenSharing && screenStream) {
    activeStreams.push({
      id: 'local',
      title: 'Your Screen (Live Stream)',
      stream: screenStream,
      isLocal: true,
    })
  }

  if (remoteScreenStreams && typeof remoteScreenStreams === 'object') {
    Object.entries(remoteScreenStreams).forEach(([peerId, info]) => {
      if (info && info.stream) {
        activeStreams.push({
          id: peerId,
          title: `${info.name || 'User'}'s Stream (Live 60 FPS)`,
          stream: info.stream,
          isLocal: false,
        })
      }
    })
  }

  return (
    <div className="flex h-full w-full flex-col bg-slate-50 dark:bg-[#090c13] p-6 select-none overflow-y-auto transition-colors duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-lg">
            🔊
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{channelName}</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {isConnectedToThisChannel
                ? `Connected: ${participants.length} Squad Member(s) in Comms`
                : roomMembers.length > 0
                ? `${roomMembers.length} Squad Member(s) currently in voice chat`
                : 'Click below to connect to voice comms'}
            </p>
          </div>
        </div>

        {isConnectedToThisChannel ? (
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Voice Connected</span>
          </div>
        ) : roomMembers.length > 0 ? (
          <div className="flex items-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Active Room</span>
          </div>
        ) : null}
      </div>

      {/* Screen Share Video Stream Containers */}
      {isConnectedToThisChannel && activeStreams.length > 0 && (
        <div className="mt-4 flex flex-col gap-4 w-full">
          {activeStreams.map((share) => (
            <div
              key={share.id}
              className="relative aspect-video w-full max-h-[500px] overflow-hidden rounded-3xl border border-purple-500/40 bg-black shadow-2xl"
            >
              <video
                ref={(el) => {
                  if (el && el.srcObject !== share.stream) {
                    el.srcObject = share.stream
                    el.play().catch(() => {})
                  }
                  if (share.isLocal) {
                    registerVideoContainer(el)
                  }
                }}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-contain"
              />
              <div className="absolute top-4 left-4 flex items-center gap-2 rounded-xl bg-purple-600/90 px-3 py-1.5 text-xs font-black text-white backdrop-blur-md shadow-lg">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
                <span>{share.title}</span>
              </div>
              {share.isLocal && (
                <button
                  onClick={() => toggleScreenShare(null)}
                  className="absolute top-4 right-4 rounded-xl bg-black/60 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Stop Stream ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Center Participants Grid */}
      <div className="my-auto flex flex-1 flex-wrap items-center justify-center gap-6 p-6">
        {isConnectedToThisChannel ? (
          participants.map((p, idx) => {
            const isLocal = idx === 0
            const isSpeakingNow = isLocal ? localSpeaking : p.isSpeaking

            return (
              <div
                key={p.identity}
                className={`relative flex flex-col items-center justify-center rounded-3xl border transition-all duration-200 shadow-sm ${
                  isSpeakingNow
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-xl shadow-emerald-500/25 scale-105'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#121620] hover:border-slate-300 dark:hover:border-white/20'
                } w-44 h-48`}
              >
                {/* Live screen share indicator pill */}
                {p.isScreenSharing && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-purple-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                    <span>🖥️</span>
                    <span>LIVE</span>
                  </div>
                )}

                {/* Avatar with dynamic neon green ring when speaking */}
                <div
                  className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 text-2xl font-black text-white shadow-lg transition-all ${
                    isSpeakingNow ? 'ring-4 ring-emerald-400 animate-pulse' : ''
                  }`}
                >
                  {p?.avatarUrl ? (
                    <img src={p.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    (p?.name || 'User').slice(0, 2).toUpperCase()
                  )}
                  {(isLocal ? isMuted : p.isMuted) && (
                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow-md">
                      ✕
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-center max-w-[150px] truncate">
                  <span className="font-bold text-slate-900 dark:text-white truncate text-sm">
                    {p?.name || 'Squad Mate'} {isLocal && '(You)'}
                  </span>
                </div>

                <span className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                  {(isLocal ? isMuted : p.isMuted)
                    ? '🔇 Muted'
                    : isSpeakingNow
                    ? '🎙️ Speaking'
                    : '🎧 Listening'}
                </span>
              </div>
            )
          })
        ) : roomMembers.length > 0 ? (
          <div className="flex flex-col items-center gap-8 w-full max-w-4xl py-6 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-center gap-6 w-full">
              {roomMembers.map((p) => {
                const isSpeakingNow = !!p.isSpeaking

                return (
                  <div
                    key={p.identity}
                    className={`relative flex flex-col items-center justify-center rounded-3xl border transition-all duration-200 shadow-sm ${
                      isSpeakingNow
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-xl shadow-emerald-500/25 scale-105'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#121620] hover:border-slate-300 dark:hover:border-white/20'
                    } w-44 h-48`}
                  >
                    {/* Live screen share indicator pill */}
                    {p.isScreenSharing && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-purple-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                        <span>🖥️</span>
                        <span>LIVE</span>
                      </div>
                    )}

                    {/* Avatar with dynamic neon green ring when speaking */}
                    <div
                      className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 text-2xl font-black text-white shadow-lg transition-all ${
                        isSpeakingNow ? 'ring-4 ring-emerald-400 animate-pulse' : ''
                      }`}
                    >
                      {p?.avatarUrl ? (
                        <img src={p.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        (p?.name || 'User').slice(0, 2).toUpperCase()
                      )}
                      {p.isMuted && (
                        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow-md">
                          ✕
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-center max-w-[150px] truncate">
                      <span className="font-bold text-slate-900 dark:text-white truncate text-sm">
                        {p?.name || 'Squad Mate'}
                      </span>
                    </div>

                    <span className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                      {p.isMuted
                        ? '🔇 Muted'
                        : isSpeakingNow
                        ? '🎙️ Speaking'
                        : '🎧 In Voice'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Connect button docked underneath */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer text-base"
              >
                {isConnecting ? 'Connecting Comms...' : '🔊 Join Voice Channel'}
              </button>
              <span className="text-xs text-slate-500 dark:text-gray-400">
                You will connect with your microphone to the ongoing call
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 text-4xl shadow-inner">
              🎧
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Join Voice Channel</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
              No one is currently in this channel. Connect your microphone to chat with your squad and share gameplay in real time.
            </p>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="mt-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer text-base"
            >
              {isConnecting ? 'Connecting Comms...' : '🔊 Connect to Voice'}
            </button>
          </div>
        )}
      </div>

      {/* Control Dock (Mute, Deafen, Screen Share, Disconnect) */}
      {isConnectedToThisChannel && (
        <div className="mt-auto flex flex-wrap items-center justify-center gap-2 sm:gap-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#121622]/90 p-2.5 sm:p-3.5 backdrop-blur-xl shadow-2xl transition-colors duration-200">
          {/* Mute Mic Button */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 sm:gap-2 rounded-2xl px-3.5 sm:px-5 py-2.5 sm:py-3 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40 hover:bg-red-100 dark:hover:bg-red-500/30'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
            }`}
            title="Toggle Microphone"
          >
            <span>{isMuted ? '🔇' : '🎙️'}</span>
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Deafen Sound Button */}
          <button
            onClick={toggleDeafen}
            className={`flex items-center gap-1.5 sm:gap-2 rounded-2xl px-3.5 sm:px-5 py-2.5 sm:py-3 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              isDeafened
                ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40 hover:bg-red-100 dark:hover:bg-red-500/30'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
            }`}
            title="Toggle Output Audio"
          >
            <span>{isDeafened ? '🔕' : '🎧'}</span>
            <span>{isDeafened ? 'Undeafen' : 'Deafen'}</span>
          </button>

          {/* Screen Share / Stream Button */}
          <button
            onClick={() => toggleScreenShare(videoContainerRef.current)}
            className={`flex items-center gap-1.5 sm:gap-2 rounded-2xl px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-xs sm:text-sm text-white shadow-lg transition-all cursor-pointer ${
              isScreenSharing
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 ring-2 ring-purple-400 hover:opacity-90'
                : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:opacity-90 active:scale-95'
            }`}
            title="Share Screen or Application"
          >
            <span>🖥️</span>
            <span>{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
          </button>

          {/* Disconnect Button */}
          <button
            onClick={disconnectVoice}
            className="flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-red-600 px-4 sm:px-6 py-2.5 sm:py-3 font-black text-xs sm:text-sm text-white shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all cursor-pointer"
            title="Leave Voice Channel"
          >
            <span>📞</span>
            <span>Disconnect</span>
          </button>
        </div>
      )}
    </div>
  )
}
