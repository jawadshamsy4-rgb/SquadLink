'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'

export default function LandingPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [downloadModal, setDownloadModal] = useState<'windows' | 'android' | null>(null)
  const [isAppEnvironment, setIsAppEnvironment] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || ''
      const isApp =
        ua.includes('Electron') ||
        ua.includes('SquadLink') ||
        ua.includes('wv') ||
        window.location.search.includes('platform=app') ||
        localStorage.getItem('squadlink_is_app') === 'true'

      if (isApp) {
        setIsAppEnvironment(true)
        localStorage.setItem('squadlink_is_app', 'true')
        if (!loading) {
          if (user) {
            router.replace('/app')
          } else {
            router.replace('/login')
          }
        }
      }
    }
  }, [user, loading, router])

  const handleDownloadWindows = () => {
    setDownloadModal('windows')
  }

  const handleDownloadAndroid = () => {
    setDownloadModal('android')
  }

  // If inside desktop or android native app, don't show the marketing homepage
  if (isAppEnvironment) {
    return (
      <div className="min-h-screen bg-[#0c1024] flex items-center justify-center">
        <div className="w-9 h-9 rounded-full border-3 border-purple-500/30 border-t-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0c1024] text-white selection:bg-purple-500 selection:text-white font-sans overflow-x-hidden relative">
      {/* Background Starry Nebula & Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[650px] h-[650px] bg-gradient-to-tr from-purple-700/25 via-indigo-600/20 to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-1/4 -right-40 w-[700px] h-[700px] bg-gradient-to-bl from-cyan-600/20 via-blue-700/15 to-transparent rounded-full blur-[150px]" />
        <div className="absolute bottom-10 left-1/3 w-[600px] h-[600px] bg-gradient-to-t from-pink-600/15 via-purple-700/15 to-transparent rounded-full blur-[140px]" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: '36px 36px',
          }}
        />

        {/* Glowing space stars */}
        <div className="absolute top-20 left-[15%] w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-60" />
        <div className="absolute top-48 left-[80%] w-2 h-2 bg-cyan-300 rounded-full animate-pulse opacity-70" />
        <div className="absolute top-[600px] left-[10%] w-2 h-2 bg-purple-300 rounded-full animate-pulse opacity-60" />
        <div className="absolute top-[350px] left-[55%] w-1 h-1 bg-white rounded-full opacity-40" />
        <div className="absolute top-[750px] right-[15%] w-1.5 h-1.5 bg-pink-300 rounded-full animate-ping opacity-50" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-30 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-11 w-11 rounded-2xl overflow-hidden shadow-lg shadow-purple-500/30 border border-white/20 group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="SquadLink" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
              SquadLink
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            </span>
            <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Developed by <span className="text-cyan-400 font-bold">Shamsy</span>
            </span>
          </div>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-200">
          <a href="#download" className="hover:text-cyan-400 transition-colors">Download</a>
          <a href="#features" className="hover:text-cyan-400 transition-colors">Features</a>
          <a href="#radar" className="hover:text-cyan-400 transition-colors">Squad Radar</a>
          <a href="#voice" className="hover:text-cyan-400 transition-colors">Voice Comms</a>
          <a href="#community" className="hover:text-cyan-400 transition-colors">Community</a>
        </nav>

        {/* Top Right Login / Open App Button */}
        <div className="flex items-center gap-4">
          {user ? (
            <Link
              href="/app"
              className="flex items-center gap-2.5 bg-white text-slate-950 hover:bg-slate-100 font-extrabold text-sm px-5 py-2.5 rounded-full shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <img
                src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
                alt=""
                className="w-5 h-5 rounded-full object-cover"
              />
              <span>Open SquadLink</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="bg-white text-slate-950 hover:bg-slate-100 font-extrabold text-sm px-6 py-2.5 rounded-full shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              Log In
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-20 max-w-7xl mx-auto px-6 pt-10 pb-20 md:pt-16 md:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headline & Action Buttons */}
          <div className="lg:col-span-5 text-center lg:text-left space-y-7">
            {/* Tagline Pill & Developer Credit */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-black uppercase tracking-wider shadow-inner">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Next-Gen Tactical Gaming Chat</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 font-medium">
                <span className="text-purple-400">⚡</span>
                <span>Developed by <strong className="text-cyan-400 font-bold">Shamsy</strong></span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black uppercase tracking-tight text-white leading-[1.08]">
              GROUP CHAT <br />
              <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                THAT'S ALL
              </span> <br />
              <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
                FUN & TACTICS
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
              SquadLink is great for coordinating gaming matches, tracking teammates on live tactical radar, and chilling with friends. Customize your squad space to talk, stream, and hang out.
            </p>

            {/* Action Buttons Group (Windows, Android, Open in Browser) */}
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
              {/* 1. Download for Windows */}
              <button
                onClick={handleDownloadWindows}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-white text-slate-950 hover:bg-slate-100 font-black text-base px-7 py-4 rounded-full shadow-xl shadow-white/10 hover:shadow-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              >
                <svg className="w-5 h-5 text-slate-900 group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download for Windows</span>
              </button>

              {/* 2. Download for Android */}
              <button
                onClick={handleDownloadAndroid}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-[#171e36] hover:bg-[#202947] text-white font-black text-base px-6 py-4 rounded-full border border-white/15 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              >
                <svg className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-1 0-.5514.4482-1 .9993-1s.9993.4486.9993 1c0 .5514-.4482 1-.9993 1m-11.046 0c-.5511 0-.9993-.4486-.9993-1 0-.5514.4482-1 .9993-1s.9993.4486.9993 1c0 .5514-.4482 1-.9993 1m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8.1 12 8.1s-3.5902.3116-5.1368.8497L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.7h24c-.3432-4.0411-2.6889-7.5133-6.1185-9.3786" />
                </svg>
                <span>Download for Android</span>
              </button>

              {/* 3. Open SquadLink in your browser */}
              <Link
                href="/app"
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-black text-base px-7 py-4 rounded-full shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              >
                <span>Open SquadLink in your browser</span>
                <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>

            {/* Quick stats / trust row */}
            <div className="flex items-center justify-center lg:justify-start gap-6 pt-2 text-xs font-bold text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> No install required
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-cyan-400">✓</span> Free squad voice & radar
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-purple-400">✓</span> Zero data selling
              </div>
            </div>
          </div>

          {/* Right Column: Eye-Catching Gaming Composition Graphic */}
          <div className="lg:col-span-7 relative flex items-center justify-center">
            {/* Glowing Backdrop Aura */}
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 via-cyan-500/20 to-pink-500/20 rounded-full blur-[100px] scale-90" />

            {/* Main Composition Wrapper */}
            <div className="relative w-full max-w-[660px]">
              {/* 1. Large High-Tech Gaming Monitor Device */}
              <div className="relative rounded-3xl border-2 border-slate-700/80 bg-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden z-10 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                {/* Monitor Top Frame Bar */}
                <div className="h-8 bg-[#151926] border-b border-white/10 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400">SquadLink Desktop v1.2.0 • #tactical-comms</span>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400">ONLINE</span>
                  </div>
                </div>

                {/* Inside Monitor Screen Content */}
                <div className="grid grid-cols-12 h-[340px] bg-[#0b0e17] text-white">
                  {/* Left Mini Sidebar */}
                  <div className="col-span-2 bg-[#080a12] border-r border-white/5 p-2 flex flex-col items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-xs font-black shadow-md shadow-purple-500/30">
                      👑
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-400">
                      VAL
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-xs font-bold text-pink-400">
                      WAR
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-xs font-bold text-emerald-400">
                      APX
                    </div>
                  </div>

                  {/* Channel List */}
                  <div className="col-span-3 bg-[#0d101b] border-r border-white/5 p-3 space-y-2 text-[11px]">
                    <div className="font-extrabold text-xs text-white pb-1 border-b border-white/5 truncate">Main Squad</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Channels</div>
                    <div className="px-2 py-1 rounded-lg bg-purple-600/20 text-purple-300 font-bold flex items-center gap-1.5">
                      <span>#</span> tactical-comms
                    </div>
                    <div className="px-2 py-1 rounded-lg text-slate-400 flex items-center gap-1.5">
                      <span>#</span> gameplay-clips
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span>🔊</span> Squad Voice</span>
                      <span className="text-[9px] bg-emerald-500/20 px-1 rounded">3/8</span>
                    </div>
                    <div className="px-2 py-1 rounded-lg text-cyan-400 font-bold flex items-center gap-1.5">
                      <span>🌐</span> squad-radar
                    </div>
                  </div>

                  {/* Chat Stream & Tactical Radar Preview */}
                  <div className="col-span-7 bg-[#0f1424] p-3 flex flex-col justify-between">
                    {/* Chat Messages */}
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Ghost" alt="" className="w-6 h-6 rounded-lg bg-purple-600" />
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-black text-cyan-400">GhostLead</span>
                            <span className="text-[9px] text-slate-500">10:42 PM</span>
                          </div>
                          <p className="text-[11px] text-slate-200">Radar pin placed on Extraction Zone! 🚁</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Shelby" alt="" className="w-6 h-6 rounded-lg bg-emerald-600" />
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-black text-emerald-400">Shelby</span>
                            <span className="text-[9px] text-slate-500">10:43 PM</span>
                          </div>
                          <p className="text-[11px] text-slate-200">I see your ping on the map. Flanking left now 🎯</p>
                        </div>
                      </div>
                    </div>

                    {/* Mini Tactical Radar Pin Strip */}
                    <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/60 to-purple-950/60 p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-xs animate-pulse">
                          🌐
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-cyan-300">CARTO SQUAD RADAR</div>
                          <div className="text-[9px] text-slate-400">2 mates nearby • 14ms latency</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[9px] font-black">
                        LIVE
                      </span>
                    </div>
                  </div>
                </div>

                {/* Monitor Stand */}
                <div className="h-3 bg-[#1d2232] border-t border-white/10" />
              </div>

              {/* 2. Floating Mobile Smartphone Device */}
              <div className="absolute -bottom-10 -right-6 sm:-right-8 w-44 sm:w-52 rounded-[32px] border-4 border-slate-700 bg-slate-950 p-2 shadow-2xl z-20 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                {/* Phone Notch */}
                <div className="h-3.5 w-16 mx-auto bg-slate-800 rounded-b-xl mb-1.5" />

                {/* Phone Screen Content */}
                <div className="rounded-[22px] bg-[#111628] p-3 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Voice Live
                    </span>
                    <span>1:24:00</span>
                  </div>

                  {/* Connected Avatars on Call */}
                  <div className="grid grid-cols-2 gap-2 py-1">
                    <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-500/10 p-2 flex flex-col items-center shadow-lg shadow-emerald-500/20 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-black">
                        SL
                      </div>
                      <span className="text-[9px] font-bold mt-1 text-white">You</span>
                      <span className="text-[8px] text-emerald-400 font-extrabold">🎙️ Speaking</span>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900 p-2 flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-black">
                        VP
                      </div>
                      <span className="text-[9px] font-bold mt-1 text-white">Viper</span>
                      <span className="text-[8px] text-slate-400">🎧 Listening</span>
                    </div>
                  </div>

                  {/* Mobile Call Actions Trio */}
                  <div className="flex items-center justify-center gap-2 pt-1 border-t border-white/5">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px]">🎙️</div>
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px]">🎧</div>
                    <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-[10px] text-white">📞</div>
                  </div>
                </div>
              </div>

              {/* 3. Stylized Floating 3D Mascot / Companion & Gamer Elements */}
              {/* Cute Floating Bot Mascot */}
              <div className="absolute -top-7 -left-6 sm:-left-8 z-30 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-3 shadow-2xl border border-purple-400/40 animate-bounce duration-1000">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center text-base">
                    🤖
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-purple-200">SquadBot AI</div>
                    <div className="text-xs font-black text-white">Tactics Ready!</div>
                  </div>
                </div>
              </div>

              {/* Gamepad Controller Floating Badge */}
              <div className="absolute -bottom-6 left-12 z-20 rounded-2xl bg-[#141a2e]/95 backdrop-blur-md px-3.5 py-2 shadow-2xl border border-cyan-500/30 flex items-center gap-2">
                <span className="text-xl">🎮</span>
                <div>
                  <div className="text-[9px] font-black text-cyan-400 uppercase">Cross-Platform</div>
                  <div className="text-[11px] font-extrabold text-white">PC • Web • Android</div>
                </div>
              </div>

              {/* Tactical Chopper Ping Floating Pill */}
              <div className="absolute top-1/2 -right-6 z-20 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 px-3 py-1 shadow-lg text-[10px] font-black text-white border border-pink-400/30 hidden sm:flex items-center gap-1.5 animate-pulse">
                <span>🚁</span>
                <span>Evac Ping Placed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid Section */}
      <section id="features" className="relative z-20 max-w-7xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-black uppercase tracking-widest text-cyan-400">
            Engineered For Modern Squads
          </h2>
          <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Everything your team needs to dominate & connect.
          </h3>
          <p className="text-slate-400 text-sm sm:text-base">
            From seamless zero-lag WebRTC voice to live interactive GPS radar, SquadLink brings a fresh take to gaming communications.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Tactical Radar */}
          <div id="radar" className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-8 shadow-2xl hover:border-cyan-500/40 transition-all group">
            <div className="h-14 w-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              🌐
            </div>
            <h4 className="text-xl font-black text-white mb-2">Live Tactical Squad Radar</h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Powered by CARTO vector tiles. Track squadmates in real-time, drop tactical pins for air-drops, enemy sightings, or rally points, with built-in 10-minute battery saver sync.
            </p>
          </div>

          {/* Card 2: Voice & Audio */}
          <div id="voice" className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-8 shadow-2xl hover:border-purple-500/40 transition-all group">
            <div className="h-14 w-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              🎙️
            </div>
            <h4 className="text-xl font-black text-white mb-2">Low-Latency Voice & Video</h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Studio-quality WebRTC audio powered by LiveKit. Enjoy echo cancellation, crisp noise suppression, 60 FPS screen shares, and live microphone loopback testing.
            </p>
          </div>

          {/* Card 3: Custom Servers */}
          <div id="community" className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-8 shadow-2xl hover:border-pink-500/40 transition-all group">
            <div className="h-14 w-14 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              👑
            </div>
            <h4 className="text-xl font-black text-white mb-2">Custom Squad Spaces & Roles</h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              Generate 6-character randomized invite codes to bring friends in seconds. Organize text, voice, and map channels with complete server settings and custom roles.
            </p>
          </div>
        </div>
      </section>

      {/* Ready to Assemble Call-to-Action Strip */}
      <section id="download" className="relative z-20 max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-slate-900/90 p-8 sm:p-12 text-center backdrop-blur-xl shadow-2xl space-y-6">
          <h3 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            READY TO ASSEMBLE YOUR SQUAD?
          </h3>
          <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base">
            No endless configurations or paywalls. Jump right into your browser or download the native app for your gaming rig or phone.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={handleDownloadWindows}
              className="flex items-center gap-2 bg-white text-slate-950 hover:bg-slate-100 font-black text-sm sm:text-base px-7 py-3.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <span>Download for Windows</span>
            </button>

            <button
              onClick={handleDownloadAndroid}
              className="flex items-center gap-2 bg-[#171e36] hover:bg-[#202947] text-white font-black text-sm sm:text-base px-6 py-3.5 rounded-full border border-white/15 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <span>Download for Android</span>
            </button>

            <Link
              href="/app"
              className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-black text-sm sm:text-base px-7 py-3.5 rounded-full shadow-lg shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <span>Open SquadLink in your browser</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 border-t border-white/5 py-12 text-center text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="w-6 h-6 rounded-lg object-cover" />
            <span className="font-extrabold text-sm text-white">SquadLink</span>
            <span>• Developed by <strong className="text-cyan-400 font-bold">Shamsy</strong></span>
          </div>

          <div className="flex items-center gap-6 font-bold">
            <a href="#download" className="hover:text-white transition-colors">Download</a>
            <Link href="/login" className="hover:text-white transition-colors">Log In</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
            <Link href="/app" className="hover:text-white transition-colors">Launch Web App</Link>
          </div>

          <div>
            © 2026 SquadLink. Developed by <strong className="text-slate-300 font-semibold">Shamsy</strong>.
          </div>
        </div>
      </footer>

      {/* Download Windows Modal */}
      {downloadModal === 'windows' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121624] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl">
                  💻
                </div>
                <div>
                  <h4 className="text-base font-black text-white">SquadLink for Windows</h4>
                  <p className="text-xs text-slate-400">Version 1.2.0 • 64-bit Installer</p>
                </div>
              </div>
              <button
                onClick={() => setDownloadModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-4 text-xs text-slate-300">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center gap-3">
                <span className="text-lg">⚡</span>
                <span>Optimized with hardware acceleration and global push-to-talk keybinds.</span>
              </div>
              <p>
                Compatibility: <strong>Windows 10 / 11 (64-bit)</strong>. File size: <strong>78.2 MB</strong>.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <p className="font-bold text-white text-[11px] uppercase tracking-wider">Installation Quick Guide:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>Click <strong className="text-white">Download .exe (78 MB)</strong> below.</li>
                  <li>Run <span className="text-white font-mono">SquadLink-Setup-1.0.0.exe</span>.</li>
                  <li>If prompted by Windows SmartScreen, click <strong className="text-white">More info</strong> → <strong className="text-white">Run anyway</strong>.</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <a
                href="/app"
                className="flex-1 text-center py-2.5 rounded-2xl bg-white text-slate-950 font-black text-xs hover:bg-slate-200 transition-colors flex items-center justify-center"
                onClick={() => setDownloadModal(null)}
              >
                Launch in Browser
              </a>
              <a
                href="/api/download/windows"
                download="SquadLink-Setup-1.0.0.exe"
                className="flex-1 text-center py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-black text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <span>Download .exe (78 MB)</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Download Android Modal */}
      {downloadModal === 'android' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121624] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-xl">
                  📱
                </div>
                <div>
                  <h4 className="text-base font-black text-white">SquadLink for Android</h4>
                  <p className="text-xs text-slate-400">Version 1.0.0 • Signed APK</p>
                </div>
              </div>
              <button
                onClick={() => setDownloadModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-4 text-xs text-slate-300">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-3 flex items-center gap-3">
                <span className="text-lg">🔋</span>
                <span>Includes background audio and low-latency tactical squad voice.</span>
              </div>
              <p>
                Compatibility: <strong>Android 8.0+</strong>. File size: <strong>1.5 MB</strong>.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <p className="font-bold text-white text-[11px] uppercase tracking-wider">Installation Quick Guide:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>Click <strong className="text-white">Download APK (1.5 MB)</strong> below.</li>
                  <li>Tap the downloaded <span className="text-white font-mono">SquadLink.apk</span> file.</li>
                  <li>If prompted, enable <strong className="text-white">&quot;Install unknown apps&quot;</strong> in Settings.</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <a
                href="/app"
                className="flex-1 text-center py-2.5 rounded-2xl bg-white text-slate-950 font-black text-xs hover:bg-slate-200 transition-colors flex items-center justify-center"
                onClick={() => setDownloadModal(null)}
              >
                Launch in Browser
              </a>
              <a
                href="/api/download/android"
                download="SquadLink.apk"
                className="flex-1 text-center py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <span>Download APK (1.5 MB)</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
