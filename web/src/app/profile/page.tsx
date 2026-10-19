'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { useTheme } from '@/components/providers/theme-provider'
import { createClient } from '@/lib/supabase/client'

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=SquadLeader',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cosmic',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nexus',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Shadow',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Vortex',
]

const GAMING_BADGES = [
  { icon: '🏆', title: 'Founding Squad Member', desc: 'Joined SquadLink Early' },
  { icon: '🎯', title: 'Sharpshooter', desc: 'Precision & Focus' },
  { icon: '⚡', title: 'Comms Ace', desc: 'Active Voice Contributor' },
  { icon: '🌐', title: 'Radar Pioneer', desc: 'Squad GPS Explorer' },
]

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [username, setUsername] = useState(profile?.username || 'SquadLeader')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || AVATAR_PRESETS[0])
  const [bio, setBio] = useState('Gamer, creator & squad member. Hanging out with friends!')
  const [statusText, setStatusText] = useState('Online & Chilling')
  const [isSharingLocation, setIsSharingLocation] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (profile?.username) setUsername(profile.username)
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveSuccess(false)

    try {
      if (!user) {
        alert('You must be logged in to update your profile.')
        setSaving(false)
        return
      }
      const userId = user.id

      const { error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          username: username.trim(),
          avatar_url: avatarUrl,
        })

      if (error) throw error

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      alert(`Could not save profile: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 dark:bg-[#090c13] dark:text-white flex flex-col select-none transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#0e111a] px-6 flex items-center justify-between shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2.5 rounded-xl bg-slate-100 dark:bg-white/5 px-3 py-1.5 text-sm font-bold text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <img src="/logo.png" alt="SquadLink" className="h-5 w-5 rounded-md object-cover" />
            <span>← Back to SquadLink</span>
          </button>
          <div className="h-5 w-[1px] bg-slate-200 dark:bg-white/10" />
          <h1 className="text-lg font-black bg-gradient-to-r from-purple-600 via-cyan-600 to-pink-600 dark:from-purple-400 dark:via-cyan-400 dark:to-pink-400 bg-clip-text text-transparent">
            User Profile
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="rounded-xl bg-red-50 dark:bg-red-600/20 border border-red-200 dark:border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer"
          >
            Log Out 🚪
          </button>
        </div>
      </header>

      {/* Main Profile Canvas */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Profile Card Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-gradient-to-br from-purple-100 via-white to-cyan-50 dark:from-purple-900/40 dark:via-slate-900 dark:to-cyan-950/30 p-6 md:p-8 shadow-xl backdrop-blur-xl transition-colors duration-200">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar with Status Orb */}
            <div className="relative group">
              <img
                src={avatarUrl}
                alt="Profile Avatar"
                className="h-28 w-28 rounded-3xl object-cover border-2 border-purple-500 shadow-xl bg-slate-200 dark:bg-slate-800"
              />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-4 border-white dark:border-[#090c13] bg-emerald-500 shadow-md" title="Online" />
            </div>

            {/* Profile Info Summary */}
            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{username}</h2>
                <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-3 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                  ⚡ Squad Veteran
                </span>
              </div>
              <p className="text-sm text-cyan-600 dark:text-cyan-400 font-bold">{statusText}</p>
              <p className="text-sm text-slate-600 dark:text-gray-400 max-w-xl">{bio}</p>
              <div className="flex flex-wrap gap-2 pt-2 justify-center md:justify-start">
                <span className="rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-1 text-xs text-slate-700 dark:text-gray-300 shadow-sm">
                  📧 {user?.email || 'guest@squadlink.gg'}
                </span>
                <span className="rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold shadow-sm">
                  ● Radar Sharing: Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Form Controls */}
          <div className="md:col-span-2 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121620] p-6 space-y-6 shadow-xl transition-colors duration-200">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>✏️</span> Edit Profile Details
            </h3>

            {saveSuccess && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
                🎉 Profile updated successfully! Changes are synced with your squad.
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* GamerTag */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 mb-1.5">
                  GamerTag / Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              {/* Status Quote */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 mb-1.5">
                  Custom Status
                </label>
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="e.g. In a match / Working on music"
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 mb-1.5">
                  About Me / Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              {/* Choose Preset Avatar */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 mb-2">
                  Choose Gamer Avatar
                </label>
                <div className="flex flex-wrap gap-3">
                  {AVATAR_PRESETS.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      className={`h-12 w-12 rounded-2xl overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                        avatarUrl === url
                          ? 'border-purple-500 scale-110 shadow-lg shadow-purple-500/40 bg-purple-500/20'
                          : 'border-slate-300 dark:border-white/10 hover:border-purple-400 dark:hover:border-white/30'
                      }`}
                    >
                      <img src={url} alt={`Preset ${i}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 py-3 font-bold text-white shadow-lg shadow-purple-500/25 hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving Profile...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Badges & Stats */}
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121620] p-6 space-y-6 shadow-xl flex flex-col justify-between transition-colors duration-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <span>🎖️</span> Squad Badges
              </h3>
              <div className="space-y-3">
                {GAMING_BADGES.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3 border border-slate-200 dark:border-white/5 shadow-sm">
                    <span className="text-2xl">{b.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{b.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-gray-400">{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/5">
              <button
                onClick={() => router.push('/')}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 dark:hover:text-white transition-colors cursor-pointer"
              >
                Return to Squad Chats
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-red-500/20 bg-white dark:bg-[#121622] p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl text-red-500">
              🚪
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Log Out of SquadLink?</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
              Are you sure you want to log out? You will need to enter your email and password to sign back in.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-gray-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutConfirm(false)
                  await signOut()
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/25 hover:from-red-500 hover:to-rose-500 transition-all cursor-pointer"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
