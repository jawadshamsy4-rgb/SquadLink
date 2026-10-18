'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { createClient } from '@/lib/supabase/client'
import ServerSidebar from '@/components/layout/server-sidebar'
import ChannelSidebar from '@/components/layout/channel-sidebar'
import MainViewport from '@/components/layout/main-viewport'
import SettingsModal from '@/components/modals/settings-modal'
import CreateServerModal from '@/components/modals/create-server-modal'

interface Channel {
  id: string
  name: string
  type: 'text' | 'voice' | 'map'
  server_id: string
  category: string | null
  position: number
}

export default function AppPage() {
  const { user, loading } = useAuth()
  const [selectedServerId, setSelectedServerId] = useState<string | null>('11111111-1111-1111-1111-111111111111')
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const supabase = createClient()

  // Auto-select first channel of default server so viewport is immediately populated
  useEffect(() => {
    if (!selectedServerId) return
    const fetchFirstChannel = async () => {
      const { data } = await supabase
        .from('channels')
        .select('*')
        .eq('server_id', selectedServerId)
        .order('position', { ascending: true })

      if (data && data.length > 0) {
        setSelectedChannel(data[0] as Channel)
      }
    }
    fetchFirstChannel()
  }, [selectedServerId])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 dark:bg-slate-950 transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/30 border border-purple-500/20 animate-pulse">
            <img src="/logo.png" alt="SquadLink" className="h-full w-full object-cover" />
          </div>
          <p className="font-semibold text-sm text-slate-500 dark:text-gray-400">Loading SquadLink...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-white transition-colors duration-200">
      {/* Mobile Backdrop for Server + Channel Drawer */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Navigation Drawer: Static inline on md+, Sliding drawer on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex h-full max-w-[88vw] transition-transform duration-300 ease-in-out md:static md:z-auto md:max-w-none md:translate-x-0 ${
          isMobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* 1. Server Sidebar */}
        <ServerSidebar
          selectedServerId={selectedServerId}
          onSelectServer={(serverId) => {
            setSelectedServerId(serverId)
            setSelectedChannel(null)
          }}
          onHomeClick={() => {
            setSelectedServerId(null)
            setSelectedChannel(null)
          }}
          onCreateServerClick={() => {
            setIsCreateServerOpen(true)
            setIsMobileNavOpen(false)
          }}
        />

        {/* 2. Channel Sidebar */}
        <ChannelSidebar
          serverId={selectedServerId}
          selectedChannelId={selectedChannel?.id ?? null}
          onSelectChannel={(channel) => {
            setSelectedChannel(channel)
            setIsMobileNavOpen(false)
          }}
          onSettingsClick={() => {
            setIsSettingsOpen(true)
            setIsMobileNavOpen(false)
          }}
          onClose={() => setIsMobileNavOpen(false)}
        />
      </div>

      {/* 3. Main Viewport */}
      <MainViewport
        channel={selectedChannel}
        serverId={selectedServerId}
        onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
      />

      {/* Modals */}
      {isSettingsOpen && (
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}

      {isCreateServerOpen && (
        <CreateServerModal
          isOpen={isCreateServerOpen}
          onClose={() => setIsCreateServerOpen(false)}
          onCreated={(newServerId) => {
            setSelectedServerId(newServerId)
            setIsCreateServerOpen(false)
          }}
        />
      )}
    </div>
  )
}
