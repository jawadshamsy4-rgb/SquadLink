'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useVoice } from '@/components/providers/voice-provider'
import ServerSettingsModal from '@/components/modals/server-settings-modal'

type ChannelType = 'text' | 'voice' | 'map'

interface Channel {
  id: string
  name: string
  type: ChannelType
  server_id: string
  category: string | null
  position: number
}

interface ServerInfo {
  id: string
  name: string
  icon_url: string | null
  invite_code?: string
  owner_id?: string
}

interface ChannelSidebarProps {
  serverId: string | null
  selectedChannelId: string | null
  onSelectChannel: (channel: Channel) => void
  onSettingsClick: () => void
  onClose?: () => void
}

export default function ChannelSidebar({
  serverId,
  selectedChannelId,
  onSelectChannel,
  onSettingsClick,
  onClose,
}: ChannelSidebarProps) {
  const [server, setServer] = useState<ServerInfo | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState<ChannelType>('text')
  const [openMenuChannelId, setOpenMenuChannelId] = useState<string | null>(null)
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [statusInput, setStatusInput] = useState('')
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false)
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
    callDuration,
    channelStatus,
    setChannelStatus,
    ping,
    connectVoice,
    disconnectVoice,
    toggleMute,
    toggleDeafen,
  } = useVoice()
  const supabase = createClient()

  // Close channel menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.channel-action-menu') && !target.closest('.channel-dots-btn')) {
        setOpenMenuChannelId(null)
      }
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!serverId) return

    const fetchData = async () => {
      if (!user) {
        setServer(null)
        setChannels([])
        return
      }

      // 1. Fetch server info
      const { data: serverData } = await supabase
        .from('servers')
        .select('id, name, icon_url, invite_code, owner_id')
        .eq('id', serverId)
        .maybeSingle()

      if (!serverData) {
        setServer(null)
        setChannels([])
        return
      }

      // 2. Check if user is owner or member
      const isOwner = serverData.owner_id === user.id
      let isMember = false
      if (!isOwner) {
        const { data: memberCheck } = await supabase
          .from('server_members')
          .select('id')
          .eq('server_id', serverId)
          .eq('user_id', user.id)
          .maybeSingle()
        isMember = !!memberCheck
      }

      if (isOwner || isMember) {
        setServer(serverData)
        // 3. Fetch channels from Supabase
        const { data: channelData } = await supabase
          .from('channels')
          .select('*')
          .eq('server_id', serverId)
          .order('position', { ascending: true })

        setChannels(channelData || [])
      } else {
        setServer(null)
        setChannels([])
      }
    }

    fetchData()

    // Real-time channel updates
    const channel = supabase
      .channel(`channels-${serverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [serverId])

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name || !serverId) return

    const { data, error } = await supabase
      .from('channels')
      .insert({
        server_id: serverId,
        name,
        type: newChannelType,
        position: channels.length,
      })
      .select()
      .single()

    if (error) {
      alert(`Could not create channel: ${error.message}`)
    } else if (data) {
      setChannels((prev) => [...prev, data as Channel])
      onSelectChannel(data as Channel)
      setNewChannelName('')
      setIsCreatingChannel(false)
    }
  }

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    setOpenMenuChannelId(null)
    const confirmDel = confirm(`Are you sure you want to delete #${channelName}? This will permanently remove all messages inside it.`)
    if (!confirmDel) return

    setChannels((prev) => prev.filter((c) => c.id !== channelId))
    await supabase.from('channels').delete().eq('id', channelId)
  }

  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')
  const mapChannels = channels.filter((c) => c.type === 'map')

  const renderChannelRow = (ch: Channel, icon: React.ReactNode, activeBg: string) => {
    const isSelected = selectedChannelId === ch.id
    const isMenuOpen = openMenuChannelId === ch.id

    return (
      <div
        key={ch.id}
        onClick={() => onSelectChannel(ch)}
        className={`group relative flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm transition-all cursor-pointer ${
          isSelected
            ? `${activeBg} text-white font-bold shadow-sm`
            : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-gray-200'
        }`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {icon}
          <span className="truncate">{ch.name}</span>
        </div>

        {/* 3-Dot Options Button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpenMenuChannelId(isMenuOpen ? null : ch.id)
            }}
            className={`channel-dots-btn flex h-6 w-6 items-center justify-center rounded-lg transition-all ${
              isMenuOpen
                ? 'bg-slate-300 dark:bg-white/20 text-slate-900 dark:text-white opacity-100'
                : 'text-slate-400 dark:text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-slate-300 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Channel options"
          >
            <span className="text-xs font-bold tracking-widest leading-none">•••</span>
          </button>

          {/* 3-Dot Dropdown Menu for Channel */}
          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="channel-action-menu absolute right-0 top-7 z-40 w-36 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
            >
              <button
                onClick={() => handleDeleteChannel(ch.id, ch.name)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer"
              >
                <span>🗑️</span>
                <span>Delete Channel</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!serverId) {
    return (
      <div className="relative flex h-full w-60 flex-col bg-slate-100 dark:bg-[#121620] border-r border-slate-200 dark:border-white/5 transition-colors duration-200 p-4">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-300 md:hidden cursor-pointer text-xs hover:text-slate-900 dark:hover:text-white"
            title="Close menu"
          >
            ✕
          </button>
        )}
        <div className="flex flex-col items-center justify-center h-full text-center gap-3">
          <div className="h-14 w-14 rounded-2xl overflow-hidden shadow-lg shadow-purple-500/20 border border-purple-500/20">
            <img src="/logo.png" alt="SquadLink" className="h-full w-full object-cover" />
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-gray-300">SquadLink</span>
          <p className="text-[11px] text-slate-400 dark:text-gray-500 leading-snug">
            Select a server from the left sidebar to join your squad!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-60 flex-col bg-slate-100 dark:bg-[#121620] border-r border-slate-200 dark:border-white/5 select-none transition-colors duration-200">
      {/* Server Header with Invite Code */}
      <div className="flex h-16 flex-col justify-center border-b border-slate-200 dark:border-white/5 px-4 shadow-sm bg-slate-100 dark:bg-[#121620] transition-colors duration-200">
        <div className="flex items-center justify-between">
          <h2 className="truncate text-base font-extrabold text-slate-900 dark:text-white">
            {server?.name ?? 'Loading...'}
          </h2>
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                server?.owner_id === user?.id
                  ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400'
                  : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
              }`}
            >
              {server?.owner_id === user?.id ? '👑 OWNER' : '🎮 MEMBER'}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 md:hidden cursor-pointer text-xs"
                title="Close Navigation"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          {server?.invite_code ? (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-gray-400">
              <span>Invite:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(server.invite_code || '')
                  alert(`Invite code copied: ${server.invite_code}`)
                }}
                className="font-mono text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 font-bold bg-slate-200 dark:bg-white/5 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                title="Click to copy invite code"
              >
                {server.invite_code} 📋
              </button>
            </div>
          ) : (
            <div />
          )}

          {/* Settings icon below the owner badge (visible to owner) */}
          {server?.owner_id === user?.id ? (
            <button
              onClick={() => {
                setIsServerSettingsOpen(true)
                onClose?.()
              }}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer text-xs"
              title="Server Settings"
            >
              ⚙️
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>

      {/* Channel Creation Inline Form */}
      {isCreatingChannel && (
        <form onSubmit={handleCreateChannel} className="p-3 border-b border-slate-200 dark:border-white/5 bg-slate-200/50 dark:bg-slate-900/60">
          <div className="text-xs font-bold text-slate-700 dark:text-gray-300 mb-2">Create New Channel</div>
          <input
            type="text"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="channel-name"
            className="w-full rounded-xl bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-900 dark:text-white border border-slate-300 dark:border-white/10 mb-2 focus:outline-none focus:border-purple-500"
            autoFocus
          />
          <div className="flex gap-2 mb-2">
            <select
              value={newChannelType}
              onChange={(e) => setNewChannelType(e.target.value as ChannelType)}
              className="flex-1 rounded-xl bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white border border-slate-300 dark:border-white/10 focus:outline-none"
            >
              <option value="text"># Text</option>
              <option value="voice">🔊 Voice</option>
              <option value="map">🌐 Map</option>
            </select>
            <button
              type="submit"
              className="rounded-xl bg-purple-600 px-3 py-1 text-xs font-bold text-white hover:bg-purple-500 cursor-pointer"
            >
              Add
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingChannel(false)}
            className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-hide space-y-4">
        {/* TEXT CHANNELS CATEGORY */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
              Text Channels
            </span>
            <button
              onClick={() => {
                setNewChannelType('text')
                setIsCreatingChannel(true)
              }}
              className="text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white text-base leading-none p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
              title="Create Text Channel"
            >
              +
            </button>
          </div>

          <div className="space-y-0.5">
            {textChannels.map((ch) =>
              renderChannelRow(
                ch,
                <span className="text-slate-400 dark:text-gray-500 font-bold">#</span>,
                'bg-purple-600 text-white'
              )
            )}
          </div>
        </div>

        {/* VOICE CHANNELS CATEGORY */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
              Voice Channels
            </span>
            <button
              onClick={() => {
                setNewChannelType('voice')
                setIsCreatingChannel(true)
              }}
              className="text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white text-base leading-none p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
              title="Create Voice Channel"
            >
              +
            </button>
          </div>

          <div className="space-y-1">
            {voiceChannels.map((ch) => {
              const isSelected = selectedChannelId === ch.id
              const isConnectedToThis = isConnected && connectedChannel?.id === ch.id
              const isMenuOpen = openMenuChannelId === ch.id

              return (
                <div key={ch.id} className="space-y-0.5">
                  {/* Voice Channel Row */}
                  <div
                    onClick={() => {
                      onSelectChannel(ch)
                      if (!isConnectedToThis) {
                        connectVoice(ch.id, ch.name, server?.name)
                      }
                    }}
                    className={`group relative flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-bold shadow-sm'
                        : isConnectedToThis
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/20'
                        : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span
                        className={`text-base leading-none ${
                          isConnectedToThis
                            ? 'text-emerald-500 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-gray-500'
                        }`}
                      >
                        🔊
                      </span>
                      <span className="truncate">{ch.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Connection Call Timer (e.g. 2:00:41 in green) */}
                      {isConnectedToThis && (
                        <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                          {callDuration}
                        </span>
                      )}

                      {/* 3-Dot Options Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuChannelId(isMenuOpen ? null : ch.id)
                          }}
                          className={`channel-dots-btn flex h-6 w-6 items-center justify-center rounded-lg transition-all ${
                            isMenuOpen
                              ? 'bg-slate-300 dark:bg-white/20 text-slate-900 dark:text-white opacity-100'
                              : 'text-slate-400 dark:text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-slate-300 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                          }`}
                          title="Channel options"
                        >
                          <span className="text-xs font-bold tracking-widest leading-none">•••</span>
                        </button>

                        {/* 3-Dot Dropdown Menu for Channel */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="channel-action-menu absolute right-0 top-7 z-40 w-36 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                          >
                            <button
                              onClick={() => handleDeleteChannel(ch.id, ch.name)}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer"
                            >
                              <span>🗑️</span>
                              <span>Delete Channel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Connected Voice Channel Sub-header & Joined Users (Exact Discord Layout) */}
                  {isConnectedToThis && (
                    <div className="pl-3 pr-1 py-0.5 space-y-1">
                      {/* Channel Status line with pencil icon */}
                      <div className="pl-4 text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5 group/status">
                        {isEditingStatus ? (
                          <input
                            type="text"
                            value={statusInput}
                            onChange={(e) => setStatusInput(e.target.value)}
                            onBlur={() => {
                              if (statusInput.trim()) setChannelStatus(statusInput.trim())
                              setIsEditingStatus(false)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (statusInput.trim()) setChannelStatus(statusInput.trim())
                                setIsEditingStatus(false)
                              } else if (e.key === 'Escape') {
                                setIsEditingStatus(false)
                              }
                            }}
                            autoFocus
                            placeholder="Set a channel status"
                            className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] rounded px-1.5 py-0.5 border border-slate-300 dark:border-white/10 outline-none"
                          />
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setStatusInput(channelStatus === 'Set a channel status' ? '' : channelStatus)
                              setIsEditingStatus(true)
                            }}
                            className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-gray-200 cursor-pointer transition-colors truncate"
                          >
                            <span className="truncate">{channelStatus}</span>
                            <span className="opacity-0 group-hover/status:opacity-100 transition-opacity text-[10px]">
                              ✏️
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Joined Users List (Indented like Discord) */}
                      <div className="space-y-0.5">
                        {participants.map((p, idx) => {
                          const isLocal = idx === 0 || p.identity === user?.id
                          const isSpeakingNow = isLocal ? localSpeaking : p.isSpeaking
                          const isMutedNow = isLocal ? isMuted : p.isMuted
                          const isDeafenedNow = isLocal ? isDeafened : p.isDeafened
                          const isSharingNow = isLocal ? isScreenSharing : p.isScreenSharing

                          return (
                            <div
                              key={p.identity}
                              onClick={() => onSelectChannel(ch)}
                              className="group flex items-center justify-between rounded-xl px-2 py-1 text-xs transition-colors hover:bg-slate-200/60 dark:hover:bg-white/5 cursor-pointer"
                            >
                              {/* Left: Avatar with glowing green ring + Username + Tag */}
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="relative flex-shrink-0">
                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-white bg-gradient-to-tr from-purple-600 to-cyan-500 transition-all ${
                                      isSpeakingNow
                                        ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-100 dark:ring-offset-[#121620] shadow-sm shadow-emerald-500/50'
                                        : ''
                                    }`}
                                  >
                                    {p.avatarUrl ? (
                                      <img
                                        src={p.avatarUrl}
                                        alt=""
                                        className="h-full w-full rounded-full object-cover"
                                      />
                                    ) : (
                                      p.name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                </div>

                                <span className="truncate font-semibold text-slate-800 dark:text-gray-200 text-xs">
                                  {p.name}
                                </span>
                              </div>

                              {/* Right: Status Badges (LIVE / Muted / Deafened) */}
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-gray-400 flex-shrink-0">
                                {isSharingNow && (
                                  <span className="rounded bg-gradient-to-r from-purple-600 to-pink-500 px-1.5 py-0.5 text-[9px] font-black text-white tracking-wider shadow-xs">
                                    LIVE
                                  </span>
                                )}
                                {isDeafenedNow ? (
                                  <span title="Deafened" className="text-red-500 text-xs">
                                    🔕
                                  </span>
                                ) : isMutedNow ? (
                                  <span title="Muted" className="text-red-500 text-xs">
                                    🔇
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RADAR MAP CATEGORY */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
              Squad Radar Maps
            </span>
            <button
              onClick={() => {
                setNewChannelType('map')
                setIsCreatingChannel(true)
              }}
              className="text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white text-base leading-none p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
              title="Create Map Channel"
            >
              +
            </button>
          </div>

          <div className="space-y-0.5">
            {mapChannels.map((ch) =>
              renderChannelRow(ch, <span>🌐</span>, 'bg-cyan-600 text-white')
            )}
          </div>
        </div>
      </div>

      {/* Discord-Style Voice Connection Box (shown when connected or connecting to voice) */}
      {(isConnected || isConnecting) && (
        <div className="border-t border-slate-200 dark:border-white/5 bg-slate-200/90 dark:bg-[#0c1018] px-3 py-2 transition-all duration-200">
          <div className="flex items-center justify-between">
            {/* Left: Green Network/Signal Bars & Channel Name */}
            <button
              onClick={() => {
                if (connectedChannel) {
                  onSelectChannel({
                    id: connectedChannel.id,
                    name: connectedChannel.name,
                    type: 'voice',
                    server_id: serverId || '',
                    category: null,
                    position: 0,
                  })
                }
              }}
              className="flex items-center gap-2.5 text-left min-w-0 flex-1 hover:opacity-85 transition-opacity cursor-pointer group"
              title="Return to Voice Channel Stage"
            >
              {/* Green Cellular Signal Bars Icon */}
              <div className="flex items-end gap-[2px] h-3.5 shrink-0 text-emerald-500 pb-0.5">
                <span className="w-[3px] h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="w-[3px] h-2.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-[3px] h-3.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {isConnecting ? 'RTC Connecting...' : 'Voice Connected'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500">
                    {ping}ms
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-600 dark:text-gray-400 group-hover:underline">
                  {connectedChannel?.name || 'Voice Channel'} / {server?.name || 'Main Squad'}
                </p>
              </div>
            </button>

            {/* Disconnect Button (Phone Hangup) */}
            <button
              onClick={disconnectVoice}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-gray-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
              title="Disconnect from Voice"
            >
              <span className="text-sm">📞</span>
            </button>
          </div>
        </div>
      )}

      {/* User Footer Panel with Discord Control Trio: Mic, Deafen, Settings */}
      <div className="flex items-center gap-1.5 border-t border-slate-200 dark:border-white/5 bg-slate-200/50 dark:bg-[#0e111a] px-2.5 py-2 transition-colors duration-200">
        <a
          href="/profile"
          className="flex items-center gap-2 min-w-0 p-1 -m-1 rounded-xl hover:bg-slate-300/50 dark:hover:bg-white/5 transition-colors cursor-pointer group flex-1"
          title="View & Edit Profile"
        >
          <div className="relative shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="h-8 w-8 rounded-full object-cover border border-purple-500/40 shadow-sm group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500 to-cyan-500 text-xs font-black text-white shadow-sm group-hover:scale-105 transition-transform">
                {profile?.username?.charAt(0)?.toUpperCase() ?? 'S'}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-950 bg-emerald-500" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
              {profile?.username ?? 'SquadLeader'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-gray-500 truncate">
              {isDeafened ? 'Deafened' : isMuted ? 'Muted' : 'Online'}
            </p>
          </div>
        </a>

        {/* Discord Control Buttons Trio */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isMuted
                ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25'
                : 'text-slate-600 dark:text-gray-400 hover:bg-slate-300/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            <span className="text-sm leading-none">{isMuted ? '🔇' : '🎙️'}</span>
          </button>

          {/* Deafen Button */}
          <button
            onClick={toggleDeafen}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isDeafened
                ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25'
                : 'text-slate-600 dark:text-gray-400 hover:bg-slate-300/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
          >
            <span className="text-sm leading-none">{isDeafened ? '🔕' : '🎧'}</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={onSettingsClick}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 dark:text-gray-400 hover:bg-slate-300/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="User Settings"
          >
            <span className="text-sm leading-none">⚙️</span>
          </button>
        </div>
      </div>

      {/* Server Settings Modal */}
      {isServerSettingsOpen && serverId && (
        <ServerSettingsModal
          isOpen={isServerSettingsOpen}
          onClose={() => setIsServerSettingsOpen(false)}
          serverId={serverId}
          onServerUpdated={(updated) => {
            setServer((prev) => (prev ? { ...prev, ...updated } : prev))
          }}
          onServerDeleted={() => {
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
