'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { generateInviteCode } from '@/lib/invite'

interface CreateServerModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (serverId: string) => void
}

export default function CreateServerModal({
  isOpen,
  onClose,
  onCreated,
}: CreateServerModalProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [serverName, setServerName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const supabase = createClient()

  if (!isOpen) return null

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = serverName.trim()
    if (!name) return
    setLoading(true)
    setError('')

    const userId = user?.id || '00000000-0000-0000-0000-000000000001'
    const code = generateInviteCode()

    try {
      // 1. Create server with current user as owner
      const { data: server, error: serverErr } = await supabase
        .from('servers')
        .insert({
          name: name,
          owner_id: userId,
          invite_code: code,
        })
        .select()
        .single()

      if (serverErr) throw serverErr

      // 2. Add owner to server_members
      await supabase.from('server_members').insert({
        server_id: server.id,
        user_id: userId,
        role: 'owner',
      })

      // 3. Create default channels for this new server
      await supabase.from('channels').insert([
        { server_id: server.id, name: 'general', type: 'text', position: 0 },
        { server_id: server.id, name: 'announcements', type: 'text', position: 1 },
        { server_id: server.id, name: 'voice-comms', type: 'voice', position: 2 },
        { server_id: server.id, name: 'squad-radar', type: 'map', position: 3 },
      ])

      // 4. Initialize location entry
      await supabase.from('locations').insert({
        user_id: userId,
        server_id: server.id,
        latitude: 23.8103,
        longitude: 90.4125,
        is_sharing_location: true,
      })

      setCreatedInviteCode(code)
      setTimeout(() => {
        onCreated(server.id)
      }, 1500)
    } catch (err: any) {
      console.error('Error creating server:', err)
      setError(err.message || 'Failed to create server')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = inviteCode.trim().toUpperCase()
    if (!code) return
    setLoading(true)
    setError('')

    const userId = user?.id || '00000000-0000-0000-0000-000000000001'

    try {
      // Find server by invite code
      const { data: server, error: findErr } = await supabase
        .from('servers')
        .select('*')
        .ilike('invite_code', code)
        .maybeSingle()

      if (findErr || !server) {
        throw new Error('Squad invite code not found. Check the code and try again!')
      }

      // Join server
      const { error: joinErr } = await supabase
        .from('server_members')
        .upsert(
          {
            server_id: server.id,
            user_id: userId,
            role: 'member',
          },
          { onConflict: 'server_id,user_id' }
        )

      if (joinErr) throw joinErr

      onCreated(server.id)
    } catch (err: any) {
      console.error('Error joining server:', err)
      setError(err.message || 'Failed to join server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/95 p-6 shadow-2xl transition-colors duration-200">
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-xl font-black bg-gradient-to-r from-purple-600 via-cyan-600 to-pink-600 dark:from-purple-400 dark:via-cyan-400 dark:to-pink-400 bg-clip-text text-transparent">
            {mode === 'create' ? 'Create a Server' : 'Join a Server'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="mb-6 flex rounded-2xl bg-slate-100 dark:bg-white/5 p-1 border border-slate-200 dark:border-white/5">
          <button
            onClick={() => {
              setMode('create')
              setError('')
              setCreatedInviteCode(null)
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all cursor-pointer ${
              mode === 'create'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            Create Server
          </button>
          <button
            onClick={() => {
              setMode('join')
              setError('')
              setCreatedInviteCode(null)
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all cursor-pointer ${
              mode === 'join'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            Join via Invite
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-500/10 p-3 text-center text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {createdInviteCode && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            🎉 Server created! Invite code: <strong className="font-mono text-base">{createdInviteCode}</strong>. Switching now...
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">
                Server Name
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="e.g. Friends & Chill"
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                required
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-gray-400">
                You will be set as the server owner with full admin permissions and unique invite code.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !!createdInviteCode}
              className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 py-3 font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Creating Server...' : 'Create Server & Become Owner'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400">
                Server Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. SQUAD1"
                className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 font-mono tracking-widest uppercase focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                required
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-gray-400">
                Enter the code given to you by the server owner.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-purple-600 py-3 font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Joining Squad...' : 'Join Squad'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
