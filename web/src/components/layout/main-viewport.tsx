'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import MessageList from '@/components/chat/message-list'
import MessageInput from '@/components/chat/message-input'
import VoiceChannel from '@/components/voice/voice-channel'
import SquadMap from '@/components/map/squad-map'
import MemberSidebar, { ServerMember } from '@/components/layout/member-sidebar'
import { ErrorBoundary } from '@/components/ui/error-boundary'

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
  onCreateServerClick?: () => void
  onJoinServerClick?: () => void
  onSettingsClick?: () => void
}

export default function MainViewport({
  channel,
  serverId,
  onToggleMobileNav,
  onCreateServerClick,
  onJoinServerClick,
  onSettingsClick,
}: MainViewportProps) {
  const { user, profile } = useAuth()
  const [isMemberListOpen, setIsMemberListOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{
    id: string
    username: string
    content: string
  } | null>(null)

  const displayName =
    profile?.username ||
    (user?.user_metadata?.username as string) ||
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split('@')[0] ||
    'Squad Leader'

  // Open member list by default on larger desktop screens (>= 1024px)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsMemberListOpen(true)
    }
  }, [])

  if (!channel) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center bg-white dark:bg-[#0d111a] transition-colors duration-200 p-4 sm:p-8 overflow-y-auto">
        {/* Mobile Hamburger to access server & channels */}
        <button
          onClick={onToggleMobileNav}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 font-bold text-xs md:hidden cursor-pointer transition-colors shadow-sm"
          title="Open Channels & Servers"
        >
          <span className="text-base leading-none">☰</span>
          <span>Channels</span>
        </button>

        {!serverId ? (
          <div className="flex flex-col items-center gap-6 text-center max-w-2xl px-4 py-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/25 border border-purple-500/20">
              <img src="/logo.png" alt="SquadLink Logo" className="h-full w-full object-cover" />
            </div>

            <div>
              <h3 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 bg-clip-text text-transparent">
                Welcome to SquadLink, {displayName}!
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                Your tactical low-latency comms and squad coordination hub. Create a squad, enter an invite code, or tune your audio settings to jump in.
              </p>
            </div>

            {/* 3 Quick Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full text-left">
              {/* 1. Create Server */}
              <div
                onClick={onCreateServerClick}
                className="group flex flex-col justify-between p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.03] hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer shadow-sm hover:shadow-purple-500/10 hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 mb-3 group-hover:scale-105 transition-transform">
                    <span className="text-lg">🎮</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    Create a Squad
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                    Start your own server with text, low-latency voice, and tactical maps.
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-4 w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all cursor-pointer text-center"
                >
                  + Create Squad
                </button>
              </div>

              {/* 2. Join Server */}
              <div
                onClick={onJoinServerClick}
                className="group flex flex-col justify-between p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.03] hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer shadow-sm hover:shadow-cyan-500/10 hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 text-white shadow-md shadow-cyan-500/20 mb-3 group-hover:scale-105 transition-transform">
                    <span className="text-lg">🔗</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    Join a Squad
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                    Have an invite code from a teammate? Enter it to jump right in.
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-4 w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition-all cursor-pointer text-center"
                >
                  Join with Code
                </button>
              </div>

              {/* 3. Settings & Voice */}
              <div
                onClick={onSettingsClick}
                className="group flex flex-col justify-between p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.03] hover:border-pink-500/50 hover:bg-pink-500/5 transition-all cursor-pointer shadow-sm hover:shadow-pink-500/10 hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/20 mb-3 group-hover:scale-105 transition-transform">
                    <span className="text-lg">⚙️</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                    Audio & Profile
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                    Test your mic live, set noise suppression, and customize your avatar.
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-800 dark:bg-white/10 hover:bg-slate-700 dark:hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer text-center"
                >
                  Open Settings
                </button>
              </div>
            </div>

            <button
              onClick={onToggleMobileNav}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-sm md:hidden cursor-pointer shadow-lg shadow-purple-500/25 hover:opacity-95"
            >
              <span>☰ Browse Channels & Squads</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center px-4 max-w-md animate-in fade-in duration-200">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/25 border border-purple-500/20">
              <img src="/logo.png" alt="SquadLink Logo" className="h-full w-full object-cover" />
            </div>

            <h3 className="text-2xl font-black bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 bg-clip-text text-transparent">
              No Channel Selected
            </h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">
              Select a channel from the left sidebar to start chatting, hop into a voice call, or view your tactical map.
            </p>

            <button
              onClick={onToggleMobileNav}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-sm md:hidden cursor-pointer shadow-lg shadow-purple-500/25 hover:opacity-95"
            >
              <span>☰ Browse Channels</span>
            </button>
          </div>
        )}
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
            <ErrorBoundary fallbackTitle="Voice channel encountered an error">
              <VoiceChannel
                channelId={channel.id}
                channelName={channel.name}
                serverId={channel.server_id || serverId || undefined}
              />
            </ErrorBoundary>
          )}

          {channel.type === 'map' && (
            <ErrorBoundary fallbackTitle="Squad radar map encountered an error">
              <SquadMap serverId={channel.server_id} />
            </ErrorBoundary>
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
