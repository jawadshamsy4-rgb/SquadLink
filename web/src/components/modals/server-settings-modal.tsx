'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { generateInviteCode } from '@/lib/invite'

interface ServerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  serverId: string | null
  onServerUpdated?: (updatedServer: any) => void
  onServerDeleted?: () => void
}

type SettingsTab = 'overview' | 'channels' | 'roles' | 'members' | 'radar' | 'voice' | 'danger'

const ICON_PRESETS = [
  'https://api.dicebear.com/7.x/identicon/svg?seed=Squad1',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Shelby',
  'https://api.dicebear.com/7.x/identicon/svg?seed=ApexLegends',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Valorant',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Cyberpunk',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Vanguard',
]

export default function ServerSettingsModal({
  isOpen,
  onClose,
  serverId,
  onServerUpdated,
  onServerDeleted,
}: ServerSettingsModalProps) {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [mobileView, setMobileView] = useState<'menu' | 'detail'>('menu')
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview')
  const [serverName, setServerName] = useState('')
  const [serverIcon, setServerIcon] = useState('')
  const [serverDescription, setServerDescription] = useState('Official gaming squad server.')
  const [inviteCode, setInviteCode] = useState('')
  const [voiceRegion, setVoiceRegion] = useState('singapore')
  const [bitrate, setBitrate] = useState('128kbps')
  const [radarStyle, setRadarStyle] = useState('auto')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice' | 'map'>('text')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [channelToDelete, setChannelToDelete] = useState<any | null>(null)

  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen to Escape key to close modal or go back to mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (channelToDelete) {
          setChannelToDelete(null)
        } else if (mobileView === 'detail' && window.innerWidth < 768) {
          setMobileView('menu')
        } else {
          onClose()
        }
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, channelToDelete, mobileView, onClose])

  // Fetch server details
  useEffect(() => {
    if (!serverId || !isOpen) return

    const fetchServerData = async () => {
      // 1. Fetch server info
      const { data: server } = await supabase
        .from('servers')
        .select('*')
        .eq('id', serverId)
        .maybeSingle()

      if (server) {
        setServerName(server.name || '')
        setServerIcon(server.icon_url || '')
        setInviteCode(server.invite_code || '')
      }

      // 2. Fetch server channels
      const { data: channelData } = await supabase
        .from('channels')
        .select('*')
        .eq('server_id', serverId)
        .order('position', { ascending: true })

      if (channelData) {
        setChannels(channelData)
      }

      // 3. Fetch server members
      const { data: memberData } = await supabase
        .from('server_members')
        .select('*, users(*)')
        .eq('server_id', serverId)

      if (memberData) {
        setMembers(memberData)
      }
    }

    fetchServerData()
  }, [serverId, isOpen, supabase])

  if (!mounted || !isOpen || !serverId) return null

  // Save General Overview
  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveMessage('')

    try {
      const { error } = await supabase
        .from('servers')
        .update({
          name: serverName,
          icon_url: serverIcon || null,
        })
        .eq('id', serverId)

      if (error) throw error

      setSaveMessage('✓ Server settings saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
      onServerUpdated?.({ id: serverId, name: serverName, icon_url: serverIcon })
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Regenerate Invite Code
  const handleRegenerateInviteCode = async () => {
    const newCode = generateInviteCode()

    const { error } = await supabase
      .from('servers')
      .update({ invite_code: newCode })
      .eq('id', serverId)

    if (!error) {
      setInviteCode(newCode)
      setSaveMessage('✓ New invite code generated!')
      setTimeout(() => setSaveMessage(''), 3000)
      onServerUpdated?.({ id: serverId, invite_code: newCode })
    }
  }

  // Add Channel
  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    const sanitized = newChannelName.toLowerCase().replace(/\s+/g, '-')
    const { data: created, error } = await supabase
      .from('channels')
      .insert({
        server_id: serverId,
        name: sanitized,
        type: newChannelType,
        position: channels.length,
      })
      .select('*')
      .single()

    if (!error && created) {
      setChannels((prev) => [...prev, created])
      setNewChannelName('')
      setSaveMessage(`✓ Channel #${sanitized} created!`)
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  // Delete Channel with Confirmation Check
  const promptDeleteChannel = (channel: any) => {
    if (channels.length <= 1) {
      alert('Cannot delete the last remaining channel in the server.')
      return
    }
    setChannelToDelete(channel)
  }

  const confirmDeleteChannel = async () => {
    if (!channelToDelete) return
    const id = channelToDelete.id
    const name = channelToDelete.name

    try {
      const { error } = await supabase.from('channels').delete().eq('id', id)
      if (error) throw error

      setChannels((prev) => prev.filter((c) => c.id !== id))
      setSaveMessage(`✓ Channel #${name} was deleted.`)
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (err: any) {
      alert(`Could not delete channel: ${err.message}`)
    } finally {
      setChannelToDelete(null)
    }
  }

  // Delete Server (Danger Zone)
  const handleDeleteServer = async () => {
    if (deleteConfirmation.trim().toLowerCase() !== serverName.trim().toLowerCase()) {
      alert(`Please type "${serverName}" exactly to confirm server deletion.`)
      return
    }

    setIsDeleting(true)
    try {
      // 1. Delete associated channels
      await supabase.from('channels').delete().eq('server_id', serverId)
      // 2. Delete server members
      await supabase.from('server_members').delete().eq('server_id', serverId)
      // 3. Delete server locations
      await supabase.from('locations').delete().eq('server_id', serverId)
      // 4. Delete server
      const { error } = await supabase.from('servers').delete().eq('id', serverId)
      if (error) throw error

      onServerDeleted?.()
      onClose()
    } catch (err: any) {
      alert(`Failed to delete server: ${err.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const tabs: {
    id: SettingsTab
    label: string
    icon: string
    count?: number
    description: string
    danger?: boolean
  }[] = [
    { id: 'overview', label: 'Overview', icon: '🌐', description: 'Server identity, name & invite code' },
    { id: 'channels', label: 'Channels', icon: '💬', count: channels.length, description: 'Manage text, voice & radar channels' },
    { id: 'members', label: 'Members', icon: '👥', count: members.length, description: 'View squad members & roles' },
    { id: 'roles', label: 'Roles & Permissions', icon: '🛡️', description: 'Server ownership & squad hierarchy' },
    { id: 'radar', label: 'Squad Radar & GPS', icon: '📍', description: 'CARTO basemaps & tactical waypoints' },
    { id: 'voice', label: 'Voice Comms Quality', icon: '🔊', description: 'WebRTC bitrates & server regions' },
    { id: 'danger', label: 'Danger Zone', icon: '⚠️', danger: true, description: 'Permanently delete this server' },
  ]

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-0 md:p-6 lg:p-8 animate-in fade-in duration-200 select-none">
      <div className="relative flex flex-col md:flex-row w-full max-w-6xl h-full md:h-[90vh] md:rounded-3xl border-0 md:border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f131c] shadow-2xl overflow-hidden transition-colors duration-200">
        {/* Left Navigation Sidebar (Desktop) / Mobile Category Selector (Mobile) */}
        <div
          className={`${
            mobileView === 'detail' ? 'hidden md:flex' : 'flex'
          } w-full md:w-64 lg:w-72 bg-slate-100 dark:bg-[#090c12] p-5 md:p-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 flex-col justify-between shrink-0 h-full overflow-y-auto`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 text-white font-bold text-lg md:text-xl shadow-md shadow-purple-500/25 shrink-0">
                  ⚙️
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Server Settings
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {serverName || 'My Squad'}
                  </h3>
                </div>
              </div>

              {/* Close Button on Mobile Category List */}
              <button
                onClick={onClose}
                className="flex md:hidden h-8 w-8 items-center justify-center rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white cursor-pointer text-sm font-bold"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1.5">
              <span className="hidden md:block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-gray-500 px-3 pb-1">
                Categories
              </span>
              {tabs.map((tab) => {
                const isSelected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setMobileView('detail')
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer text-left ${
                      tab.danger
                        ? isSelected
                          ? 'bg-red-600 text-white shadow-md shadow-red-500/25'
                          : 'text-red-500 hover:bg-red-500/10'
                        : isSelected
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                        : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base shrink-0">{tab.icon}</span>
                      <div className="min-w-0">
                        <span className="block truncate">{tab.label}</span>
                        <span className="block md:hidden text-[10px] font-normal opacity-70 truncate">
                          {tab.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {tab.count !== undefined && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-400'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                      <span className="md:hidden text-xs opacity-60">›</span>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Desktop Esc / Close Button */}
          <div className="pt-6 hidden md:block">
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-200/80 dark:bg-white/5 py-2.5 text-xs font-bold text-slate-700 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              Esc or Close
            </button>
          </div>
        </div>

        {/* Right Tab Content Canvas (Desktop) / Dedicated Detail Page (Mobile) */}
        <div
          className={`${
            mobileView === 'menu' ? 'hidden md:flex' : 'flex'
          } flex-1 flex-col min-h-0 bg-white dark:bg-[#0f131c] overflow-y-auto relative h-full`}
        >
          {/* Mobile Back Header */}
          <div className="flex md:hidden items-center justify-between p-4 border-b border-slate-200 dark:border-white/5 bg-slate-100/90 dark:bg-[#090c12]/90 backdrop-blur-md sticky top-0 z-20">
            <button
              onClick={() => setMobileView('menu')}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              <span className="text-sm font-black">‹</span>
              <span>Back to Settings</span>
            </button>
            <span className="text-xs font-extrabold text-slate-900 dark:text-white capitalize truncate px-2">
              {tabs.find((t) => t.id === activeTab)?.label}
            </span>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white cursor-pointer text-xs font-bold"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Desktop Discord-style Close Button */}
          <div className="hidden md:flex absolute top-6 right-8 flex-col items-center z-20">
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 dark:border-white/20 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer text-sm font-bold shadow-sm"
              title="Close (Esc)"
            >
              ✕
            </button>
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-gray-500 mt-1">ESC</span>
          </div>

          {/* Content Body Container */}
          <div className="p-6 md:p-10 lg:p-12 max-w-4xl">
            {saveMessage && (
              <div className="mb-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                {saveMessage}
              </div>
            )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <form onSubmit={handleSaveOverview} className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Server Overview</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Configure your squad server profile, icon, description, and invite code.
                </p>
              </div>

              {/* Server Name & Icon */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase">
                    Server Icon URL
                  </label>
                  <input
                    type="url"
                    value={serverIcon}
                    onChange={(e) => setServerIcon(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Preset Avatars */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-400 dark:text-gray-500 mb-2">
                    Or select an icon preset:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ICON_PRESETS.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt="Preset Icon"
                        onClick={() => setServerIcon(url)}
                        className={`h-10 w-10 rounded-2xl p-1 bg-slate-200 dark:bg-slate-800 object-cover cursor-pointer hover:scale-110 transition-transform border-2 ${
                          serverIcon === url ? 'border-purple-500' : 'border-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Invite Code Control */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Server Invite Code
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400">
                        Share this code with teammates so they can join your server.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-xl border border-cyan-500/20">
                        {inviteCode || 'N/A'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteCode)
                          alert(`Invite code ${inviteCode} copied to clipboard!`)
                        }}
                        className="rounded-xl bg-slate-200 dark:bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-gray-300 hover:bg-slate-300 transition-colors cursor-pointer"
                      >
                        Copy 📋
                      </button>
                      <button
                        type="button"
                        onClick={handleRegenerateInviteCode}
                        className="rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        Regenerate 🔄
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase">
                    Server Topic / Mission
                  </label>
                  <textarea
                    rows={3}
                    value={serverDescription}
                    onChange={(e) => setServerDescription(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-purple-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {/* TAB 2: CHANNELS */}
          {activeTab === 'channels' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Channel Management</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Create, reorder, or remove text, voice, and squad map channels.
                </p>
              </div>

              {/* Create Channel Form */}
              <form onSubmit={handleAddChannel} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 space-y-3">
                <span className="text-xs font-bold text-slate-800 dark:text-white block uppercase">
                  Add New Channel
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="channel-name"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                  <select
                    value={newChannelType}
                    onChange={(e: any) => setNewChannelType(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="text">💬 Text Channel</option>
                    <option value="voice">🔊 Voice Channel</option>
                    <option value="map">🌐 Squad Map Channel</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 transition-colors cursor-pointer"
                  >
                    Create +
                  </button>
                </div>
              </form>

              {/* Channel List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase block">
                  Existing Channels ({channels.length})
                </span>
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/60 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">
                        {ch.type === 'text' ? '💬' : ch.type === 'voice' ? '🔊' : '🌐'}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white">
                          {ch.name}
                        </span>
                        <span className="ml-2 text-[10px] text-slate-400 uppercase font-bold">
                          {ch.type}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => promptDeleteChannel(ch)}
                      className="text-xs text-red-500 hover:text-red-600 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      Delete ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Server Members</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Manage members who have joined this squad server.
                </p>
              </div>

              <div className="space-y-2">
                {members.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 dark:text-gray-500 rounded-2xl border border-slate-200 dark:border-white/5">
                    No other members have joined yet. Share your invite code ({inviteCode}) to add teammates!
                  </div>
                ) : (
                  members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            m.users?.avatar_url ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(m.users?.username || 'Member')}`
                          }
                          alt={m.users?.username}
                          className="h-9 w-9 rounded-full object-cover bg-slate-800"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {m.users?.username || 'Squad Member'}
                            </span>
                            {m.role === 'owner' && (
                              <span className="rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-black px-1.5 py-0.2">
                                👑 OWNER
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Joined {new Date(m.joined_at || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-bold capitalize text-purple-600 dark:text-purple-400">
                        {m.role || 'Member'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Roles & Permissions</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Manage member squad hierarchy and operational permissions.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-amber-500" />
                      <strong className="text-xs font-black text-slate-900 dark:text-white">
                        Server Owner 👑
                      </strong>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">All Permissions</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Full administrative control over channels, settings, and integrations.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-purple-500" />
                      <strong className="text-xs font-black text-slate-900 dark:text-white">
                        Squad Officer / Admin 🛡️
                      </strong>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">Manage Channels & Kick</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Can manage channels, moderate messages, and invite new members.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-cyan-500" />
                      <strong className="text-xs font-black text-slate-900 dark:text-white">
                        Squad Member 🎮
                      </strong>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">Comms & Radar</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Standard member access: participate in chat, join voice calls, and share live GPS radar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RADAR & GPS */}
          {activeTab === 'radar' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Squad Radar Settings</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Configure CARTO basemap tiles and GPS location refresh preferences for this server.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase">
                    Map Basemap Style
                  </label>
                  <select
                    value={radarStyle}
                    onChange={(e) => setRadarStyle(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="auto">Auto (Dark Matter at night / Voyager by day)</option>
                    <option value="dark">CARTO Dark Matter (High Contrast Gaming)</option>
                    <option value="voyager">CARTO Voyager (Light Street Map)</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                      Tactical Waypoint Sound Cues
                    </span>
                    <span className="text-xs font-bold text-emerald-500">Enabled</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Plays zero-latency sonar chimes when team drops Rally, Danger, Target, or Loot markers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: VOICE QUALITY */}
          {activeTab === 'voice' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Voice Audio & Bitrate</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Tune LiveKit WebRTC audio codecs for maximum clarity in high-intensity gaming.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase">
                    Channel Audio Bitrate
                  </label>
                  <select
                    value={bitrate}
                    onChange={(e) => setBitrate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="64kbps">64 kbps (Bandwidth Saver)</option>
                    <option value="96kbps">96 kbps (Discord Standard)</option>
                    <option value="128kbps">128 kbps (Ultra High-Def Gaming Voice)</option>
                    <option value="256kbps">256 kbps (Studio Quality Music & Comms)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase">
                    Voice Server Region
                  </label>
                  <select
                    value={voiceRegion}
                    onChange={(e) => setVoiceRegion(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="singapore">Singapore (South & Southeast Asia - Lowest Ping)</option>
                    <option value="us-east">US East (North America)</option>
                    <option value="europe">Frankfurt (Europe Central)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-xl font-black text-red-600 dark:text-red-400">Danger Zone</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Actions here are irreversible. Please proceed with caution.
                </p>
              </div>

              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
                <span className="text-sm font-black text-red-600 dark:text-red-400 block">
                  Delete Server
                </span>
                <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                  Deleting this server will permanently remove all channels, chat history, and tactical radar data.
                  This action cannot be undone.
                </p>

                <div className="space-y-2 pt-2">
                  <span className="block text-xs font-bold text-slate-700 dark:text-gray-300">
                    Type <strong>{serverName}</strong> below to confirm:
                  </span>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={serverName}
                    className="w-full rounded-xl border border-red-500/30 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleDeleteServer}
                  disabled={isDeleting || deleteConfirmation.trim().toLowerCase() !== serverName.trim().toLowerCase()}
                  className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-2.5 transition-colors cursor-pointer shadow-md shadow-red-500/20"
                >
                  {isDeleting ? 'Deleting Server...' : 'Permanently Delete This Server 🗑️'}
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Channel Delete Confirmation Modal */}
      {channelToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-white dark:bg-[#151924] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-red-500">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Delete Channel</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-6">
              Are you sure you want to delete <strong className="text-red-500 dark:text-red-400">#{channelToDelete.name}</strong>? All chat messages, media, and history in this channel will be permanently removed. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                className="rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteChannel}
                className="rounded-2xl bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-xs font-extrabold shadow-md shadow-red-500/25 transition-all cursor-pointer active:scale-95"
              >
                Yes, Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
