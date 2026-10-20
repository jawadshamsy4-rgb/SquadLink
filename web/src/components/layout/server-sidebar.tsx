'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'

interface Server {
  id: string
  name: string
  icon_url: string | null
  invite_code?: string
  owner_id?: string
}

const GRADIENT_PRESETS = [
  { from: 'from-purple-500', to: 'to-cyan-400' },
  { from: 'from-pink-500', to: 'to-orange-400' },
  { from: 'from-emerald-500', to: 'to-teal-400' },
  { from: 'from-blue-500', to: 'to-indigo-400' },
  { from: 'from-rose-500', to: 'to-pink-400' },
  { from: 'from-amber-500', to: 'to-yellow-400' },
]

interface ServerSidebarProps {
  selectedServerId: string | null
  onSelectServer: (serverId: string) => void
  onHomeClick: () => void
  onCreateServerClick: () => void
  onServersLoaded?: (servers: Server[]) => void
}

export default function ServerSidebar({
  selectedServerId,
  onSelectServer,
  onHomeClick,
  onCreateServerClick,
  onServersLoaded,
}: ServerSidebarProps) {
  const [servers, setServers] = useState<Server[]>([])
  const { user } = useAuth()
  const supabase = createClient()

  const fetchServers = async () => {
    if (!user) {
      setServers([])
      onServersLoaded?.([])
      return
    }

    try {
      // 1. Fetch server IDs where current user is a member
      const { data: memberRows } = await supabase
        .from('server_members')
        .select('server_id')
        .eq('user_id', user.id)

      const memberServerIds = (memberRows || []).map((m: any) => m.server_id)

      // 2. Fetch servers where user is the owner OR a member
      let query = supabase.from('servers').select('*')
      if (memberServerIds.length > 0) {
        query = query.or(`owner_id.eq.${user.id},id.in.(${memberServerIds.join(',')})`)
      } else {
        query = query.eq('owner_id', user.id)
      }

      const { data: userServers } = await query.order('created_at', { ascending: true })
      const list = userServers || []
      setServers(list)
      onServersLoaded?.(list)
    } catch (err) {
      console.warn('Error fetching servers:', err)
      setServers([])
      onServersLoaded?.([])
    }
  }

  useEffect(() => {
    fetchServers()

    const serversChannel = supabase
      .channel('servers-sidebar-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'servers' },
        () => fetchServers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'server_members' },
        () => fetchServers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(serversChannel)
    }
  }, [user])

  const getGradient = (index: number) => {
    return GRADIENT_PRESETS[index % GRADIENT_PRESETS.length]
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 bg-slate-200 dark:bg-[#0b0e14] py-3 border-r border-slate-300 dark:border-white/5 select-none z-30 transition-colors duration-200">
      {/* 1. SquadLink Home Button */}
      <button
        onClick={onHomeClick}
        className={`group relative flex h-12 w-12 items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden p-0.5 ${
          selectedServerId === null
            ? 'rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 shadow-lg shadow-purple-500/30 ring-2 ring-purple-500/80'
            : 'rounded-[24px] bg-white dark:bg-[#1a1f2c] hover:rounded-2xl hover:bg-gradient-to-tr hover:from-purple-600 hover:to-cyan-500 shadow-sm'
        }`}
        title="SquadLink Home"
      >
        {selectedServerId === null && (
          <div className="absolute -left-3 h-10 w-1.5 rounded-r-full bg-slate-900 dark:bg-white transition-all" />
        )}
        <img
          src="/logo.png"
          alt="SquadLink"
          className="h-full w-full rounded-[22px] group-hover:rounded-2xl object-cover transition-all duration-200 group-hover:scale-105"
        />
      </button>

      {/* Divider */}
      <div className="h-[2px] w-8 rounded-full bg-slate-300 dark:bg-white/10 my-1" />

      {/* 2. Server List (Discord-Style rounded squares with hover morph) */}
      <div className="flex flex-col items-center gap-2 w-full">
        {servers.map((server, index) => {
          const gradient = getGradient(index)
          const isSelected = selectedServerId === server.id

          return (
            <button
              key={server.id}
              onClick={() => onSelectServer(server.id)}
              className={`group relative flex h-12 w-12 shrink-0 items-center justify-center transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'rounded-2xl shadow-lg shadow-purple-500/30'
                  : 'rounded-[24px] hover:rounded-2xl'
              }`}
              title={server.name}
            >
              {/* Discord Active Bar Indicator */}
              <div
                className={`absolute -left-3 w-1.5 rounded-r-full bg-slate-900 dark:bg-white transition-all duration-200 ${
                  isSelected ? 'h-10 opacity-100' : 'h-2 opacity-0 group-hover:h-5 group-hover:opacity-100'
                }`}
              />

              {server.icon_url ? (
                <img
                  src={server.icon_url}
                  alt={server.name}
                  className={`h-12 w-12 object-cover transition-all duration-200 ${
                    isSelected ? 'rounded-2xl' : 'rounded-[24px] group-hover:rounded-2xl'
                  }`}
                />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient.from} ${gradient.to} text-sm font-black text-white transition-all duration-200 ${
                    isSelected ? 'rounded-2xl' : 'rounded-[24px] group-hover:rounded-2xl'
                  }`}
                >
                  {getInitials(server.name)}
                </div>
              )}
            </button>
          )
        })}

        {/* 3. Discord-Style (+) Add Server Button directly below server icons */}
        <button
          onClick={onCreateServerClick}
          className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] bg-white dark:bg-[#1a1f2c] text-emerald-600 dark:text-emerald-400 transition-all duration-200 hover:rounded-2xl hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-500/30 mt-1 cursor-pointer shadow-sm"
          title="Add a Server"
        >
          <svg
            className="h-6 w-6 transition-transform duration-200 group-hover:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </div>
  )
}
