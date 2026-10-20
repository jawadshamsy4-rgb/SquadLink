'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useVoice } from '@/components/providers/voice-provider'
import { usePresence } from '@/components/providers/presence-provider'
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
  const { setVoiceServerId } = useVoice()
  const { setActiveServerId } = usePresence()
  const router = useRouter()
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)

  useEffect(() => {
    setVoiceServerId(selectedServerId)
    setActiveServerId(selectedServerId)
  }, [selectedServerId, setVoiceServerId, setActiveServerId])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false)
  const [createServerMode, setCreateServerMode] = useState<'create' | 'join'>('create')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const supabase = createClient()

  // Redirect to login ONLY if user is truly not authenticated and no local backup exists
  useEffect(() => {
    if (!loading && !user) {
      const hasBackup =
        typeof window !== 'undefined' &&
        (!!localStorage.getItem('squadlink_session_v2') ||
          !!localStorage.getItem('squadlink_auth_backup_v1'))

      if (!hasBackup) {
        router.replace('/login')
      }
    }
  }, [loading, user, router])

  // Handle mobile hardware & browser back navigation (dismiss modals/drawer, prevent kicking to /login)
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Ensure a history state exists on /app so back button is captured
    window.history.pushState({ appPage: true }, '', window.location.href)

    const handlePopState = () => {
      if (isSettingsOpen) {
        setIsSettingsOpen(false)
        window.history.pushState({ appPage: true }, '', window.location.href)
        return
      }

      if (isCreateServerOpen) {
        setIsCreateServerOpen(false)
        window.history.pushState({ appPage: true }, '', window.location.href)
        return
      }

      if (isMobileNavOpen) {
        setIsMobileNavOpen(false)
        window.history.pushState({ appPage: true }, '', window.location.href)
        return
      }

      if (selectedChannel && window.innerWidth < 768) {
        setSelectedChannel(null)
        setIsMobileNavOpen(true)
        window.history.pushState({ appPage: true }, '', window.location.href)
        return
      }

      // Retain user safely inside /app rather than popping out to /login
      window.history.pushState({ appPage: true }, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isSettingsOpen, isCreateServerOpen, isMobileNavOpen, selectedChannel])

  // Auto-select first channel of selected server so viewport is populated
  useEffect(() => {
    if (!selectedServerId) {
      setSelectedChannel(null)
      return
    }
    const fetchFirstChannel = async () => {
      const { data } = await supabase
        .from('channels')
        .select('*')
        .eq('server_id', selectedServerId)
        .order('position', { ascending: true })

      if (data && data.length > 0) {
        setSelectedChannel(data[0] as Channel)
      } else {
        setSelectedChannel(null)
      }
    }
    fetchFirstChannel()
  }, [selectedServerId])

  const handleServersLoaded = (loadedServers: any[]) => {
    if (loadedServers.length === 0) {
      setSelectedServerId(null)
      setSelectedChannel(null)
      return
    }

    // Pick first server if none selected or if selected server is no longer in list
    if (!selectedServerId || !loadedServers.some((s) => s.id === selectedServerId)) {
      setSelectedServerId(loadedServers[0].id)
    }
  }

  const handleOpenCreateServer = () => {
    setCreateServerMode('create')
    setIsCreateServerOpen(true)
    setIsMobileNavOpen(false)
  }

  const handleOpenJoinServer = () => {
    setCreateServerMode('join')
    setIsCreateServerOpen(true)
    setIsMobileNavOpen(false)
  }

  const handleOpenSettings = () => {
    setIsSettingsOpen(true)
    setIsMobileNavOpen(false)
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 dark:bg-slate-950 transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/30 border border-purple-500/20 animate-pulse">
            <img src="/logo.png" alt="SquadLink" className="h-full w-full object-cover" />
          </div>
          <p className="font-semibold text-sm text-slate-500 dark:text-gray-400">
            {loading ? 'Loading SquadLink...' : 'Redirecting to login...'}
          </p>
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
          onCreateServerClick={handleOpenCreateServer}
          onServersLoaded={handleServersLoaded}
        />

        {/* 2. Channel Sidebar */}
        <ChannelSidebar
          serverId={selectedServerId}
          selectedChannelId={selectedChannel?.id ?? null}
          onSelectChannel={(channel) => {
            setSelectedChannel(channel)
            setIsMobileNavOpen(false)
          }}
          onSettingsClick={handleOpenSettings}
          onCreateServerClick={handleOpenCreateServer}
          onJoinServerClick={handleOpenJoinServer}
          onClose={() => setIsMobileNavOpen(false)}
        />
      </div>

      {/* 3. Main Viewport */}
      <MainViewport
        channel={selectedChannel}
        serverId={selectedServerId}
        onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
        onCreateServerClick={handleOpenCreateServer}
        onJoinServerClick={handleOpenJoinServer}
        onSettingsClick={handleOpenSettings}
      />

      {/* Modals */}
      {isSettingsOpen && (
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}

      {isCreateServerOpen && (
        <CreateServerModal
          isOpen={isCreateServerOpen}
          initialMode={createServerMode}
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
