'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useVoice } from '@/components/providers/voice-provider'

export type UserPresenceStatus = 'online' | 'idle' | 'dnd' | 'offline'

export interface ServerMember {
  id: string
  username: string
  avatar_url: string
  status: UserPresenceStatus
  customStatus?: string
  role?: string
  isOwner?: boolean
  joined_at?: string
}

interface MemberSidebarProps {
  serverId?: string | null
  serverName?: string
  onClose?: () => void
  onSelectMember?: (member: ServerMember) => void
}

export default function MemberSidebar({
  serverId,
  serverName = 'SquadLink',
  onClose,
  onSelectMember,
}: MemberSidebarProps) {
  const { user, profile } = useAuth()
  const { participants, isConnected, serverVoiceMembers } = useVoice()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<ServerMember | null>(null)
  const [serverDisplayName, setServerDisplayName] = useState<string>(serverName)
  const [dbMembers, setDbMembers] = useState<ServerMember[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const currentUserId = user?.id || ''
  const currentUsername =
    profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'User'
  const currentUserAvatar =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUsername)}`

  // Fetch real server info & real members from Supabase
  const fetchRealMembers = useCallback(async () => {
    try {
      setLoading(true)

      // 1. Fetch server name & owner
      let serverOwnerId = ''
      if (serverId) {
        const { data: serverData } = await supabase
          .from('servers')
          .select('name, owner_id')
          .eq('id', serverId)
          .maybeSingle()
        if (serverData?.name) {
          setServerDisplayName(serverData.name)
        }
        if (serverData?.owner_id) {
          serverOwnerId = serverData.owner_id
        }
      }

      // 2. Fetch real server members from database
      let fetchedList: ServerMember[] = []

      if (serverId) {
        const { data: memberRows, error } = await supabase
          .from('server_members')
          .select('id, user_id, role, joined_at, users(id, username, avatar_url, email)')
          .eq('server_id', serverId)

        if (!error && memberRows && memberRows.length > 0) {
          fetchedList = memberRows.map((row: any) => {
            const u = row.users
            const uid = u?.id || row.user_id
            const uname = u?.username || (uid === currentUserId ? currentUsername : 'Member')
            const uavatar =
              u?.avatar_url ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uname)}`
            const isOwner = row.role === 'owner'

            return {
              id: uid,
              username: uname,
              avatar_url: uavatar,
              status: uid === currentUserId ? 'online' : 'offline',
              role: isOwner ? 'Server Owner' : (row.role || 'Member'),
              isOwner,
              joined_at: row.joined_at,
            }
          })
        }
      }

      // If owner is logged in and not in the list yet, include current user as owner
      const hasMe = fetchedList.some((m) => m.id === currentUserId)
      if (!hasMe && currentUserId && serverOwnerId === currentUserId) {
        fetchedList.unshift({
          id: currentUserId,
          username: currentUsername,
          avatar_url: currentUserAvatar,
          status: 'online',
          role: 'Server Owner',
          isOwner: true,
          joined_at: new Date().toISOString(),
        })
      }

      setDbMembers(fetchedList)
    } catch (e) {
      console.error('Error fetching real members:', e)
    } finally {
      setLoading(false)
    }
  }, [serverId, currentUserId, currentUsername, currentUserAvatar, supabase])

  // Initial fetch and Realtime subscription on server_members table
  useEffect(() => {
    fetchRealMembers()

    if (!serverId) return

    const channel = supabase
      .channel(`real-members-${serverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'server_members',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          fetchRealMembers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [serverId, fetchRealMembers, supabase])

  // Combine active call participants with server-wide voice channel members
  const allVoiceParticipants = useMemo(() => {
    const list = [...participants]
    Object.values(serverVoiceMembers).forEach((members) => {
      if (Array.isArray(members)) {
        members.forEach((m) => {
          if (!list.some((existing) => existing.identity === m.identity)) {
            list.push(m)
          }
        })
      }
    })
    return list
  }, [participants, serverVoiceMembers])

  // Compute live presence based on active user and voice participants
  const membersWithPresence = useMemo(() => {
    return dbMembers.map((member) => {
      const isLocal = member.id === currentUserId

      // If this member is connected in voice comms
      const inVoice =
        allVoiceParticipants.some(
          (p) =>
            p.identity === member.id ||
            p.name?.toLowerCase() === member.username.toLowerCase()
        ) || (isLocal && isConnected)

      let status: UserPresenceStatus = member.status
      let customStatus = member.customStatus

      if (isLocal) {
        status = 'online'
        customStatus = inVoice ? 'In Voice Comms 🔊' : 'Active in Squad'
      } else if (inVoice) {
        status = 'online'
        customStatus = 'In Voice Comms 🔊'
      }

      return {
        ...member,
        status,
        customStatus,
      }
    })
  }, [dbMembers, currentUserId, allVoiceParticipants, isConnected])

  // Filter by search query
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return membersWithPresence

    return membersWithPresence.filter((m) => {
      return (
        m.username.toLowerCase().includes(q) ||
        (m.role && m.role.toLowerCase().includes(q)) ||
        (m.customStatus && m.customStatus.toLowerCase().includes(q))
      )
    })
  }, [membersWithPresence, searchQuery])

  // Partition into Online vs Offline
  const onlineMembers = useMemo(() => {
    return filteredMembers.filter((m) => m.status !== 'offline')
  }, [filteredMembers])

  const offlineMembers = useMemo(() => {
    return filteredMembers.filter((m) => m.status === 'offline')
  }, [filteredMembers])

  const renderStatusBadge = (status: UserPresenceStatus) => {
    switch (status) {
      case 'online':
        return (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-[#0e121a] bg-emerald-500"
            title="Online"
          />
        )
      case 'idle':
        return (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white dark:border-[#0e121a] bg-amber-400"
            title="Idle"
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-white dark:bg-[#0e121a]" />
          </span>
        )
      case 'dnd':
        return (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white dark:border-[#0e121a] bg-red-500"
            title="Do Not Disturb"
          >
            <span className="block h-0.5 w-1.5 rounded-sm bg-white" />
          </span>
        )
      case 'offline':
      default:
        return (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white dark:border-[#0e121a] bg-slate-500/80"
            title="Offline"
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-slate-900" />
          </span>
        )
    }
  }

  return (
    <aside className="relative flex h-full w-72 md:w-60 shrink-0 flex-col bg-slate-100/95 dark:bg-[#0e121a] border-l border-slate-200 dark:border-white/5 select-none transition-colors duration-200 shadow-2xl md:shadow-none">
      {/* Top Search Bar & Header */}
      <div className="p-3 border-b border-slate-200/80 dark:border-white/5 flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${serverDisplayName}`}
            className="w-full rounded-xl bg-slate-200/70 dark:bg-[#191e29] px-3 py-1.5 pr-8 text-xs font-medium text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 outline-none border border-transparent focus:border-purple-500/50 transition-all shadow-inner"
          />
          <div className="absolute right-2.5 pointer-events-none text-slate-400 dark:text-gray-500 text-xs">
            {searchQuery ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSearchQuery('')
                }}
                className="pointer-events-auto hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            ) : (
              '🔍'
            )}
          </div>
        </div>

        {/* Mobile Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200/70 dark:bg-[#191e29] text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white md:hidden cursor-pointer transition-colors"
            title="Close Member List"
          >
            ✕
          </button>
        )}
      </div>

      {/* Member Lists Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {loading && dbMembers.length === 0 ? (
          <div className="flex items-center justify-center p-6 text-xs text-slate-400 dark:text-gray-500">
            Loading members...
          </div>
        ) : (
          <>
            {/* ONLINE MEMBERS SECTION */}
            {onlineMembers.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-black tracking-wider text-slate-500 dark:text-gray-400 uppercase">
                  <span>Online — {onlineMembers.length}</span>
                </div>

                <div className="space-y-0.5">
                  {onlineMembers.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => {
                        setSelectedMember(member)
                        onSelectMember?.(member)
                      }}
                      className="group relative flex items-center gap-3 rounded-2xl px-2.5 py-1.5 cursor-pointer transition-all duration-150 hover:bg-slate-200/70 dark:hover:bg-white/5"
                    >
                      {/* Avatar + Status Indicator */}
                      <div className="relative shrink-0">
                        <img
                          src={member.avatar_url}
                          alt={member.username}
                          className="h-8 w-8 rounded-full object-cover bg-slate-300 dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10"
                          onError={(e: any) => {
                            e.target.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=Squad'
                          }}
                        />
                        {renderStatusBadge(member.status)}
                      </div>

                      {/* Username & Subtext */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-slate-800 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white">
                            {member.username}
                          </span>
                          {member.isOwner && (
                            <span className="text-[10px]" title="Server Owner">
                              👑
                            </span>
                          )}
                        </div>

                        {member.customStatus && (
                          <p className="truncate text-[10px] text-slate-500 dark:text-gray-400 group-hover:text-slate-600 dark:group-hover:text-gray-300 leading-tight">
                            {member.customStatus}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OFFLINE MEMBERS SECTION */}
            {offlineMembers.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-black tracking-wider text-slate-400 dark:text-gray-500 uppercase">
                  <span>Offline — {offlineMembers.length}</span>
                </div>

                <div className="space-y-0.5">
                  {offlineMembers.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => {
                        setSelectedMember(member)
                        onSelectMember?.(member)
                      }}
                      className="group relative flex items-center gap-3 rounded-2xl px-2.5 py-1.5 cursor-pointer opacity-60 hover:opacity-100 transition-all duration-150 hover:bg-slate-200/50 dark:hover:bg-white/5"
                    >
                      {/* Avatar + Status Indicator */}
                      <div className="relative shrink-0">
                        <img
                          src={member.avatar_url}
                          alt={member.username}
                          className="h-8 w-8 rounded-full object-cover bg-slate-300 dark:bg-slate-800 grayscale ring-1 ring-black/5 dark:ring-white/10"
                          onError={(e: any) => {
                            e.target.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=Squad'
                          }}
                        />
                        {renderStatusBadge('offline')}
                      </div>

                      {/* Username */}
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-xs font-bold text-slate-600 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-gray-200">
                          {member.username}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state when search yields no matches */}
            {filteredMembers.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-gray-500">
                <span className="text-2xl mb-1">🔍</span>
                <p className="text-xs font-bold">No members found</p>
                <p className="text-[10px] mt-0.5">Try searching for another name</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mini Profile Popover Modal */}
      {selectedMember && (
        <div
          onClick={() => setSelectedMember(null)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-72 overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131722] shadow-2xl animate-in zoom-in-95 duration-150"
          >
            {/* Banner */}
            <div className="h-20 w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 relative">
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            {/* Profile Avatar & Info */}
            <div className="relative px-4 pb-4">
              <div className="relative -mt-9 mb-2 inline-block">
                <img
                  src={selectedMember.avatar_url}
                  alt={selectedMember.username}
                  className="h-16 w-16 rounded-full border-4 border-white dark:border-[#131722] object-cover bg-slate-800 shadow-md"
                />
                <span className="absolute bottom-0.5 right-0.5">
                  {renderStatusBadge(selectedMember.status)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  {selectedMember.username}
                </h4>
                {selectedMember.isOwner && <span title="Server Owner">👑</span>}
              </div>

              <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 capitalize mt-0.5">
                ● {selectedMember.status}
              </p>

              {selectedMember.customStatus && (
                <div className="mt-2 rounded-2xl bg-slate-100 dark:bg-white/5 p-2.5 border border-slate-200 dark:border-white/5 text-xs text-slate-700 dark:text-gray-300">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 block mb-0.5">
                    Custom Status
                  </span>
                  {selectedMember.customStatus}
                </div>
              )}

              {selectedMember.role && (
                <div className="mt-2">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 block mb-1">
                    Role
                  </span>
                  <span className="inline-block rounded-xl bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 text-xs font-bold text-purple-600 dark:text-purple-400">
                    {selectedMember.role}
                  </span>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/5 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedMember(null)
                  }}
                  className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 transition-colors cursor-pointer"
                >
                  Send Message
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedMember.username)
                    setSelectedMember(null)
                  }}
                  className="rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
                  title="Copy Username"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
