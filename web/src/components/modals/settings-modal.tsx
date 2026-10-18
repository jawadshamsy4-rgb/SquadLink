'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import { useTheme } from '@/components/providers/theme-provider'
import { useVoice } from '@/components/providers/voice-provider'
import {
  soundEffects,
  formatKeyCombo,
  type KeybindConfig,
} from '@/lib/audio/sound-effects'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AudioDevice {
  deviceId: string
  label: string
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const {
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    setEchoCancellation,
    setNoiseSuppression,
    setAutoGainControl,
    keybinds,
    setKeybind,
    resetKeybinds,
    soundEffectsEnabled,
    setSoundEffectsEnabled,
  } = useVoice()
  const [activeTab, setActiveTab] = useState<'voice' | 'keybinds' | 'profile' | 'radar' | 'appearance'>('voice')
  const [recordingAction, setRecordingAction] = useState<keyof KeybindConfig | null>(null)
  const [username, setUsername] = useState(profile?.username || '')
  const [isSharingLocation, setIsSharingLocation] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Audio Device Selection
  const [audioInputDevices, setAudioInputDevices] = useState<AudioDevice[]>([])
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioDevice[]>([])
  const [selectedInputId, setSelectedInputId] = useState<string>('default')
  const [selectedOutputId, setSelectedOutputId] = useState<string>('default')
  const [testingMic, setTestingMic] = useState(false)
  const [micVolume, setMicVolume] = useState(0)

  // Mic test loopback and stream references
  const micTestStreamRef = useRef<MediaStream | null>(null)
  const micTestAudioRef = useRef<HTMLAudioElement | null>(null)
  const micTestCtxRef = useRef<AudioContext | null>(null)
  const micTestAnalyserRef = useRef<AnalyserNode | null>(null)
  const micTestSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const micTestIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const micTestTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username)
    }
  }, [profile])

  // Load available audio input and output hardware devices
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return

        const devices = await navigator.mediaDevices.enumerateDevices()
        const inputs = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d, index) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${index + 1}`,
          }))

        const outputs = devices
          .filter((d) => d.kind === 'audiooutput')
          .map((d, index) => ({
            deviceId: d.deviceId,
            label: d.label || `Speaker / Headset ${index + 1}`,
          }))

        setAudioInputDevices(inputs)
        setAudioOutputDevices(outputs)

        const savedInput = localStorage.getItem('squadlink-audio-input')
        const savedOutput = localStorage.getItem('squadlink-audio-output')
        if (savedInput) setSelectedInputId(savedInput)
        if (savedOutput) setSelectedOutputId(savedOutput)
      } catch (err) {
        console.warn('Could not enumerate audio devices:', err)
      }
    }

    if (isOpen) {
      loadAudioDevices()
    }
  }, [isOpen])

  // Capture key combination when user records a keybind
  useEffect(() => {
    if (!recordingAction) return

    const handleRecord = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Ignore bare modifier key until final key is pressed
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return
      }

      if (e.key === 'Escape') {
        setRecordingAction(null)
        return
      }

      const combo = formatKeyCombo(e)
      if (combo) {
        setKeybind(recordingAction, combo)
        setRecordingAction(null)
      }
    }

    window.addEventListener('keydown', handleRecord, { capture: true })
    return () => window.removeEventListener('keydown', handleRecord, { capture: true })
  }, [recordingAction])

  useEffect(() => {
    if (!user) return
    const fetchLocationSetting = async () => {
      const { data } = await supabase
        .from('locations')
        .select('is_sharing_location')
        .eq('user_id', user.id)
        .limit(1)

      if (data && data.length > 0) {
        setIsSharingLocation(data[0].is_sharing_location ?? true)
      }
    }
    fetchLocationSetting()
  }, [user])

  if (!isOpen) return null

  const applyLiveAudioConstraints = async (
    newEcho: boolean,
    newNoise: boolean,
    newAgc: boolean,
    newDeviceId?: string
  ) => {
    if (!micTestStreamRef.current) return

    const devId = newDeviceId ?? selectedInputId
    const audioConstraints: any = {
      echoCancellation: newEcho,
      noiseSuppression: newNoise,
      autoGainControl: newAgc,
    }
    if (devId !== 'default') {
      audioConstraints.deviceId = { exact: devId }
    }

    // 1. Try track.applyConstraints for instant in-place DSP reconfiguration
    const currentTrack = micTestStreamRef.current.getAudioTracks()[0]
    if (currentTrack) {
      try {
        await currentTrack.applyConstraints(audioConstraints)
      } catch (err) {
        console.debug('applyConstraints fallback to stream swap:', err)
      }
    }

    // 2. Seamlessly hot-swap the stream so the audio hardware pipeline updates immediately
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      })

      const oldStream = micTestStreamRef.current
      micTestStreamRef.current = newStream

      // Update Audio element playback immediately
      if (micTestAudioRef.current) {
        micTestAudioRef.current.srcObject = newStream
        micTestAudioRef.current.play().catch(() => {})
      }

      // Reconnect Web Audio analyser to new stream
      if (micTestCtxRef.current && micTestAnalyserRef.current) {
        if (micTestSourceRef.current) {
          try {
            micTestSourceRef.current.disconnect()
          } catch (e) {}
        }
        const newSrc = micTestCtxRef.current.createMediaStreamSource(newStream)
        newSrc.connect(micTestAnalyserRef.current)
        micTestSourceRef.current = newSrc
      }

      // Cleanly stop old tracks
      if (oldStream) {
        oldStream.getTracks().forEach((track) => track.stop())
      }
    } catch (err) {
      console.warn('Could not live update mic test stream:', err)
    }
  }

  const handleInputChange = (deviceId: string) => {
    setSelectedInputId(deviceId)
    localStorage.setItem('squadlink-audio-input', deviceId)
    window.dispatchEvent(
      new CustomEvent('squadlink-audio-device-changed', {
        detail: { inputId: deviceId, outputId: selectedOutputId },
      })
    )
    if (testingMic) {
      applyLiveAudioConstraints(echoCancellation, noiseSuppression, autoGainControl, deviceId)
    }
  }

  const handleOutputChange = (deviceId: string) => {
    setSelectedOutputId(deviceId)
    localStorage.setItem('squadlink-audio-output', deviceId)
    window.dispatchEvent(
      new CustomEvent('squadlink-audio-device-changed', {
        detail: { inputId: selectedInputId, outputId: deviceId },
      })
    )
    if (micTestAudioRef.current && deviceId !== 'default' && typeof (micTestAudioRef.current as any).setSinkId === 'function') {
      try {
        (micTestAudioRef.current as any).setSinkId(deviceId)
      } catch (e) {
        console.warn('Could not setSinkId live:', e)
      }
    }
  }

  const stopMicrophoneTest = () => {
    if (micTestIntervalRef.current) {
      clearInterval(micTestIntervalRef.current)
      micTestIntervalRef.current = null
    }
    if (micTestTimeoutRef.current) {
      clearTimeout(micTestTimeoutRef.current)
      micTestTimeoutRef.current = null
    }
    if (micTestSourceRef.current) {
      try {
        micTestSourceRef.current.disconnect()
      } catch (e) {}
      micTestSourceRef.current = null
    }
    micTestAnalyserRef.current = null
    if (micTestStreamRef.current) {
      micTestStreamRef.current.getTracks().forEach((track) => track.stop())
      micTestStreamRef.current = null
    }
    if (micTestAudioRef.current) {
      micTestAudioRef.current.pause()
      micTestAudioRef.current.srcObject = null
      micTestAudioRef.current = null
    }
    if (micTestCtxRef.current) {
      micTestCtxRef.current.close().catch(() => {})
      micTestCtxRef.current = null
    }
    setTestingMic(false)
    setMicVolume(0)
  }

  // Cleanup mic test when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      stopMicrophoneTest()
    }
    return () => {
      stopMicrophoneTest()
    }
  }, [isOpen])

  const testMicrophone = async () => {
    if (testingMic) {
      stopMicrophoneTest()
      return
    }

    try {
      setTestingMic(true)
      const audioConstraints: any = {
        echoCancellation: echoCancellation ?? true,
        noiseSuppression: noiseSuppression ?? true,
        autoGainControl: autoGainControl ?? true,
      }
      if (selectedInputId !== 'default') {
        audioConstraints.deviceId = { exact: selectedInputId }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      })
      micTestStreamRef.current = stream

      // 1. Play back microphone audio through selected output device
      const audioEl = new Audio()
      audioEl.srcObject = stream
      audioEl.volume = 1.0
      if (selectedOutputId !== 'default' && typeof (audioEl as any).setSinkId === 'function') {
        try {
          await (audioEl as any).setSinkId(selectedOutputId)
        } catch (e) {
          console.warn('Could not setSinkId on audio element:', e)
        }
      }
      await audioEl.play().catch((e) => console.warn('Audio play error:', e))
      micTestAudioRef.current = audioEl

      // 2. Set up Web Audio Analyser for volume visualization & loopback monitor
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {})
      }
      if (selectedOutputId !== 'default' && typeof (ctx as any).setSinkId === 'function') {
        try {
          await (ctx as any).setSinkId(selectedOutputId)
        } catch (e) {}
      }
      micTestCtxRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      micTestAnalyserRef.current = analyser

      const src = ctx.createMediaStreamSource(stream)
      src.connect(analyser)
      micTestSourceRef.current = src

      const data = new Uint8Array(analyser.frequencyBinCount)
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const avg = Math.min(Math.round((sum / data.length) * 1.6), 100)
        setMicVolume(avg)
      }, 40)
      micTestIntervalRef.current = interval

      // Auto stop after 20 seconds
      micTestTimeoutRef.current = setTimeout(() => {
        stopMicrophoneTest()
      }, 20000)
    } catch (err: any) {
      console.error('Could not test microphone:', err)
      alert(`Could not test microphone: ${err.message}`)
      stopMicrophoneTest()
    }
  }

  const testSpeaker = async () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      if (selectedOutputId !== 'default' && typeof (ctx as any).setSinkId === 'function') {
        try {
          await (ctx as any).setSinkId(selectedOutputId)
        } catch (e) {}
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch (e) {
      console.warn('Speaker test error:', e)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setMessage('')

    try {
      const { error: profileErr } = await supabase
        .from('users')
        .update({ username: username.trim() })
        .eq('id', user.id)

      if (profileErr) throw profileErr

      await supabase
        .from('locations')
        .update({ is_sharing_location: isSharingLocation })
        .eq('user_id', user.id)

      setMessage('Settings updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleLocation = async () => {
    const nextState = !isSharingLocation
    setIsSharingLocation(nextState)
    if (!user) return

    await supabase
      .from('locations')
      .update({ is_sharing_location: nextState })
      .eq('user_id', user.id)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-200 select-none">
      {/* Expanded Modal Window */}
      <div className="relative flex flex-col md:flex-row w-full max-w-5xl h-[85vh] rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121620] shadow-2xl overflow-hidden transition-colors duration-200">
        {/* Left Settings Sidebar */}
        <div className="w-full md:w-64 bg-slate-100 dark:bg-[#0d1017] p-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 flex flex-col justify-between shrink-0 transition-colors duration-200">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl overflow-hidden shadow-md shadow-purple-500/20 border border-purple-500/20 shrink-0">
                <img src="/logo.png" alt="SquadLink" className="h-full w-full object-cover" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  SquadLink
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Settings</h2>
              </div>
            </div>

            {/* Tab navigation */}
            <nav className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('voice')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'voice'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🎙️</span>
                <span>Voice & Audio</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('keybinds')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'keybinds'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>⌨️</span>
                <span>Keybinds & Sound FX</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>👤</span>
                <span>My Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('radar')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'radar'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🌐</span>
                <span>Squad Radar (GPS)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('appearance')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'appearance'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🎨</span>
                <span>Appearance</span>
              </button>
            </nav>
          </div>

          {/* Logout at bottom of sidebar */}
          <div className="pt-6 border-t border-slate-200 dark:border-white/5">
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-50 dark:bg-red-600/10 border border-red-200 dark:border-red-500/20 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer"
            >
              <span>🚪</span>
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Right Content Viewport */}
        <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto scrollbar-hide bg-white dark:bg-[#121620] transition-colors duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-white/5">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {activeTab === 'voice' && 'Voice & Audio Hardware'}
                {activeTab === 'keybinds' && 'Keybinds & Sound Effects'}
                {activeTab === 'profile' && 'Profile & Account'}
                {activeTab === 'radar' && 'Squad Radar Privacy'}
                {activeTab === 'appearance' && 'Theme & Visuals'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                {activeTab === 'keybinds'
                  ? 'Configure custom keyboard shortcuts and audio cues for voice comms.'
                  : 'Customize your audio hardware, controls, and squad preferences.'}
              </p>
            </div>

            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Close Settings"
            >
              ✕
            </button>
          </div>

          {message && (
            <div
              className={`my-4 rounded-2xl p-3 text-center text-sm font-bold ${
                message.startsWith('Error')
                  ? 'border border-red-500/20 bg-red-500/10 text-red-400'
                  : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {message}
            </div>
          )}

          {/* TAB 1: VOICE & AUDIO HARDWARE */}
          {activeTab === 'voice' && (
            <div className="py-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Input Device */}
                <div className="rounded-3xl bg-slate-50 dark:bg-white/[0.03] p-6 border border-slate-200 dark:border-white/5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>🎙️</span> Input Device (Microphone)
                    </div>
                  </div>

                  <select
                    value={selectedInputId}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1a1f2c] px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="default">Default System Microphone</option>
                    {audioInputDevices.map((dev) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.label}
                      </option>
                    ))}
                  </select>

                  {/* Mic Test Section */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500 dark:text-gray-400 font-semibold">Microphone Input Level</span>
                      <button
                        type="button"
                        onClick={testMicrophone}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm ${
                          testingMic
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white animate-pulse shadow-purple-500/30'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-white/20'
                        }`}
                      >
                        {testingMic ? 'Stop Testing ⏹️' : 'Test Mic 🎙️'}
                      </button>
                    </div>
                    <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 transition-all duration-75"
                        style={{ width: `${micVolume}%` }}
                      />
                    </div>
                    {testingMic && (
                      <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mt-2 flex items-center gap-1.5 animate-pulse">
                        <span>🎧</span>
                        <span>Microphone loopback is live! Speak to hear your voice through your headset.</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Output Device */}
                <div className="rounded-3xl bg-slate-50 dark:bg-white/[0.03] p-6 border border-slate-200 dark:border-white/5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>🎧</span> Output Device (Headset / Speakers)
                    </div>
                    <button
                      type="button"
                      onClick={testSpeaker}
                      className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      🔊 Test Chime
                    </button>
                  </div>

                  <select
                    value={selectedOutputId}
                    onChange={(e) => handleOutputChange(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1a1f2c] px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="default">Default System Output</option>
                    {audioOutputDevices.map((dev) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.label}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed pt-2">
                    SquadLink routes all incoming squad voice comms and game audio through your chosen headset.
                  </p>
                </div>
              </div>

              {/* Extra Voice Processing toggles */}
              <div className="rounded-3xl bg-slate-50 dark:bg-white/[0.02] p-6 border border-slate-200 dark:border-white/5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                    Advanced Voice Processing
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    WebRTC DSP Active
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Echo Cancellation */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !echoCancellation
                      setEchoCancellation(nextVal)
                      if (testingMic) {
                        applyLiveAudioConstraints(nextVal, noiseSuppression, autoGainControl)
                      }
                    }}
                    className={`rounded-2xl p-4 border text-left transition-all cursor-pointer relative overflow-hidden group ${
                      echoCancellation
                        ? 'bg-purple-500/10 border-purple-500/30 dark:bg-purple-500/15 dark:border-purple-500/40 shadow-xs'
                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Echo Cancellation
                      </div>
                      <div
                        className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 ${
                          echoCancellation
                            ? 'bg-purple-600 justify-end'
                            : 'bg-slate-300 dark:bg-white/20 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
                      {echoCancellation ? 'Enabled (Automatic)' : 'Disabled'}
                    </div>
                  </button>

                  {/* Noise Suppression */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !noiseSuppression
                      setNoiseSuppression(nextVal)
                      if (testingMic) {
                        applyLiveAudioConstraints(echoCancellation, nextVal, autoGainControl)
                      }
                    }}
                    className={`rounded-2xl p-4 border text-left transition-all cursor-pointer relative overflow-hidden group ${
                      noiseSuppression
                        ? 'bg-cyan-500/10 border-cyan-500/30 dark:bg-cyan-500/15 dark:border-cyan-500/40 shadow-xs'
                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        Noise Suppression
                      </div>
                      <div
                        className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 ${
                          noiseSuppression
                            ? 'bg-cyan-600 justify-end'
                            : 'bg-slate-300 dark:bg-white/20 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
                      {noiseSuppression ? 'High Performance' : 'Disabled'}
                    </div>
                  </button>

                  {/* Auto Gain Control */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !autoGainControl
                      setAutoGainControl(nextVal)
                      if (testingMic) {
                        applyLiveAudioConstraints(echoCancellation, noiseSuppression, nextVal)
                      }
                    }}
                    className={`rounded-2xl p-4 border text-left transition-all cursor-pointer relative overflow-hidden group ${
                      autoGainControl
                        ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/15 dark:border-emerald-500/40 shadow-xs'
                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        Auto Gain Control
                      </div>
                      <div
                        className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 ${
                          autoGainControl
                            ? 'bg-emerald-600 justify-end'
                            : 'bg-slate-300 dark:bg-white/20 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
                      {autoGainControl ? 'Level Balanced' : 'Disabled'}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: KEYBINDS & SOUND EFFECTS */}
          {activeTab === 'keybinds' && (
            <div className="py-6 space-y-6">
              {/* Sound Effects Controls */}
              <div className="rounded-3xl bg-slate-50 dark:bg-white/[0.02] p-6 border border-slate-200 dark:border-white/5 space-y-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                      Voice Comms Audio Cues (Sound Effects)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                      Audible chimes when you or squad mates join, leave, mute, or deafen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoundEffectsEnabled(!soundEffectsEnabled)}
                    className={`w-10 h-6 rounded-full transition-colors flex items-center p-0.5 cursor-pointer ${
                      soundEffectsEnabled
                        ? 'bg-purple-600 justify-end'
                        : 'bg-slate-300 dark:bg-white/20 justify-start'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => soundEffects.playJoin()}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-600/20 hover:border-purple-300 dark:hover:border-purple-500/30 transition-all cursor-pointer shadow-xs"
                  >
                    <span>🔊</span>
                    <span>Test Join Chime</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEffects.playDisconnect()}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-600/20 hover:border-purple-300 dark:hover:border-purple-500/30 transition-all cursor-pointer shadow-xs"
                  >
                    <span>📞</span>
                    <span>Test Leave Chime</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEffects.playMute()}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-600/20 hover:border-purple-300 dark:hover:border-purple-500/30 transition-all cursor-pointer shadow-xs"
                  >
                    <span>🔇</span>
                    <span>Test Mute Tone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEffects.playUnmute()}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-600/20 hover:border-purple-300 dark:hover:border-purple-500/30 transition-all cursor-pointer shadow-xs"
                  >
                    <span>🎙️</span>
                    <span>Test Unmute Tone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEffects.playDeafen()}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-600/20 hover:border-purple-300 dark:hover:border-purple-500/30 transition-all cursor-pointer shadow-xs"
                  >
                    <span>🔕</span>
                    <span>Test Deafen Tone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEffects.playUndeafen()}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-600/20 hover:border-purple-300 dark:hover:border-purple-500/30 transition-all cursor-pointer shadow-xs"
                  >
                    <span>🎧</span>
                    <span>Test Undeafen Tone</span>
                  </button>
                </div>
              </div>

              {/* Discord Shortcut Keybinds Section */}
              <div className="rounded-3xl bg-slate-50 dark:bg-white/[0.02] p-6 border border-slate-200 dark:border-white/5 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                      Keyboard Shortcuts (Keybinds)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                      Control voice comms without leaving your match. Works globally across the entire app.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetKeybinds}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Action 1: Toggle Mute */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold text-sm">
                        🎙️
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">Toggle Mute</div>
                        <div className="text-[11px] text-slate-500 dark:text-gray-400">
                          Instantly mutes or unmutes your microphone
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <kbd className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-800 dark:text-white shadow-xs">
                        {keybinds.mute}
                      </kbd>
                      <button
                        type="button"
                        onClick={() => setRecordingAction(recordingAction === 'mute' ? null : 'mute')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          recordingAction === 'mute'
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-purple-600 text-white hover:bg-purple-500'
                        }`}
                      >
                        {recordingAction === 'mute' ? 'Press keys (Esc)...' : 'Record Keybind'}
                      </button>
                    </div>
                  </div>

                  {/* Action 2: Toggle Deafen */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold text-sm">
                        🎧
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">Toggle Deafen</div>
                        <div className="text-[11px] text-slate-500 dark:text-gray-400">
                          Silences all incoming voice comms and mutes your mic
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <kbd className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-800 dark:text-white shadow-xs">
                        {keybinds.deafen}
                      </kbd>
                      <button
                        type="button"
                        onClick={() => setRecordingAction(recordingAction === 'deafen' ? null : 'deafen')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          recordingAction === 'deafen'
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-purple-600 text-white hover:bg-purple-500'
                        }`}
                      >
                        {recordingAction === 'deafen' ? 'Press keys (Esc)...' : 'Record Keybind'}
                      </button>
                    </div>
                  </div>

                  {/* Action 3: Disconnect Call */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 font-bold text-sm">
                        📞
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">Disconnect Call</div>
                        <div className="text-[11px] text-slate-500 dark:text-gray-400">
                          Leaves the active voice channel immediately
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <kbd className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-800 dark:text-white shadow-xs">
                        {keybinds.disconnect}
                      </kbd>
                      <button
                        type="button"
                        onClick={() => setRecordingAction(recordingAction === 'disconnect' ? null : 'disconnect')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          recordingAction === 'disconnect'
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-purple-600 text-white hover:bg-purple-500'
                        }`}
                      >
                        {recordingAction === 'disconnect' ? 'Press keys (Esc)...' : 'Record Keybind'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE & ACCOUNT */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="py-6 space-y-6">
              <div className="rounded-3xl bg-slate-50 dark:bg-white/[0.03] p-6 border border-slate-200 dark:border-white/5 space-y-4 shadow-sm">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">
                    GamerTag / Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1a1f2c] px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="text"
                    value={user?.email || 'guest@squadlink.gg'}
                    disabled
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-500 dark:text-gray-400 cursor-not-allowed opacity-60"
                  />
                </div>

                <div className="pt-2">
                  <a
                    href="/profile"
                    className="inline-flex items-center gap-2 rounded-2xl bg-purple-50 dark:bg-purple-600/20 border border-purple-200 dark:border-purple-500/30 px-4 py-2.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white transition-all cursor-pointer"
                  >
                    <span>Open Full Dedicated Profile Page →</span>
                  </a>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SQUAD RADAR */}
          {activeTab === 'radar' && (
            <div className="py-6 space-y-6">
              <div className="rounded-3xl bg-slate-50 dark:bg-white/[0.03] p-6 border border-slate-200 dark:border-white/5 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">10-Minute Radar Broadcasting</h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400 max-w-md mt-1">
                      Broadcasting your location allows members of your squad servers to see your live avatar pin on the map.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleLocation}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer ${
                      isSharingLocation ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-slate-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${
                        isSharingLocation ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="rounded-2xl bg-white dark:bg-white/5 p-4 border border-slate-200 dark:border-white/5 text-xs text-slate-600 dark:text-gray-400 space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                    <span>🛡️</span> Privacy Guarantee:
                  </div>
                  <p>• Only members belonging to your active servers can view your pin.</p>
                  <p>• Updates are throttled to every 10 minutes to protect battery life.</p>
                  <p>• You can toggle this completely off at any time.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="py-6 space-y-6">
              <div className="rounded-3xl bg-slate-50 dark:bg-white/[0.03] p-6 border border-slate-200 dark:border-white/5 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">App Color Mode</h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                      Toggle between OLED Dark gaming mode and Clean Light mode.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/10 px-5 py-2.5 text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 transition-all cursor-pointer shadow-sm"
                  >
                    {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
