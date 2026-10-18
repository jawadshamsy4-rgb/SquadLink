'use client'

import { useState, useEffect } from 'react'
import MessageList from '@/components/chat/message-list'
import MessageInput from '@/components/chat/message-input'
import VoiceChannel from '@/components/voice/voice-channel'
import SquadMap from '@/components/map/squad-map'
import MemberSidebar, { ServerMember } from '@/components/layout/member-sidebar'

type ChannelType = 'text' | 'voice' | 'map'

interface ActiveChannel {
  id: string
  name: string
  type: ChannelType
  server_id: string
}

interface MainViewportProps {
  channel: ActiveChannel | null
  serverId?: string | null
  onToggleMobileNav?: () => void
}

export default function MainViewport({ channel, serverId, onToggleMobileNav }: MainViewportProps) {
  const [isMemberListOpen, setIsMemberListOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{
    id: string
    username: string
    content: string
  } | null>(null)

  // Open member list by default on larger desktop screens (>= 1024px)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsMemberListOpen(true)
    }
  }, [])

  if (!channel) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center bg-white dark:bg-[#0d111a] transition-colors duration-200 p-4">
        {/* Mobile Hamburger to access server & channels */}
        <button
          onClick={onToggleMobileNav}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 font-bold text-xs md:hidden cursor-pointer transition-colors shadow-sm"
          title="Open Channels & Servers"
        >
          <span className="text-base leading-none">☰</span>
          <span>Channels</span>
        </button>

        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/25 border border-purple-500/20">
            <img src="/logo.png" alt="SquadLink Logo" className="h-full w-full object-cover" />
          </div>

          <h3 className="text-2xl font-black bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 bg-clip-text text-transparent">
            Welcome to SquadLink
          </h3>
          <p className="max-w-sm text-sm text-slate-500 dark:text-gray-400">
            Select a channel from the sidebar to chat, join a voice call, or view your squad on the tactical map.
          </p>

          <button
            onClick={onToggleMobileNav}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-sm md:hidden cursor-pointer shadow-lg shadow-purple-500/25 hover:opacity-95"
          >
            <span>☰ Browse Channels</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 flex-col bg-white dark:bg-[#0d111a] transition-colors duration-200 min-w-0">
      {/* Channel Header (Discord Style) */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-[#0d111a]/80 px-4 sm:px-6 backdrop-blur-md transition-colors duration-200 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 truncate">
          {/* Mobile Hamburger Menu Button */}
          <button
            onClick={onToggleMobileNav}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 md:hidden cursor-pointer transition-colors"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <span className="text-lg leading-none">☰</span>
          </button>

          {channel.type === 'text' && (
            <span className="text-purple-600 dark:text-purple-400 font-bold text-lg">#</span>
          )}
          {channel.type === 'voice' && (
            <span className="text-emerald-500 dark:text-emerald-400 text-lg">🔊</span>
          )}
          {channel.type === 'map' && (
            <span className="text-cyan-600 dark:text-cyan-400 text-lg">🌐</span>
          )}
          <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
            {channel.name}
          </h2>
        </div>

        {/* Header Right Action Icons */}
        <div className="flex items-center gap-2">
          {/* Member List Toggle Button */}
          <button
            onClick={() => setIsMemberListOpen(!isMemberListOpen)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all cursor-pointer ${
              isMemberListOpen
                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={isMemberListOpen ? 'Hide Member List' : 'Show Member List'}
          >
            👥
          </button>
        </div>
      </div>

      {/* Content Area + Member Sidebar Layout */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Main Channel Content View */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden w-full">
          {channel.type === 'text' && (
            <>
              <MessageList
                channelId={channel.id}
                onReply={(targetMsg) => setReplyingTo(targetMsg)}
              />
              <MessageInput
                channelId={channel.id}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />
            </>
          )}

          {channel.type === 'voice' && (
            <VoiceChannel channelId={channel.id} channelName={channel.name} />
          )}

          {channel.type === 'map' && (
            <SquadMap serverId={channel.server_id} />
          )}
        </div>

        {/* Discord-style Member Sidebar - Responsive Overlay on Mobile, Inline on Desktop */}
        {isMemberListOpen && (
          <>
            {/* Mobile Backdrop for Member List */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
              onClick={() => setIsMemberListOpen(false)}
            />

            {/* Member Drawer */}
            <div className="fixed inset-y-0 right-0 z-50 flex h-full max-w-[85vw] shadow-2xl animate-in slide-in-from-right duration-200 md:relative md:inset-auto md:z-auto md:max-w-none md:shadow-none">
              <MemberSidebar
                serverId={channel.server_id || serverId}
                onClose={() => setIsMemberListOpen(false)}
                onSelectMember={(member: ServerMember) => {
                  if (channel.type === 'text') {
                    // Member selected
                  }
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
