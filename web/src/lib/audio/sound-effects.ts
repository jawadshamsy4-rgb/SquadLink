// Web Audio API Sound Effects Synthesizer for SquadLink
// Provides zero-latency, reliable audio cues for Join, Disconnect, Mute, and Deafen.

class SoundEffectsEngine {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) this.ctx = new AudioCtx()
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return this.ctx
    } catch {
      return null
    }
  }

  // Play Discord-like ascending join chime (Lush 3-note arpeggio ~850ms)
  playJoin() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Note 1: C5 (523.25Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523.25, now)
    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.03)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.25)

    // Note 2: G5 (783.99Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(783.99, now + 0.16)
    gain2.gain.setValueAtTime(0.001, now + 0.16)
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.19)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.16)
    osc2.stop(now + 0.43)

    // Note 3: C6 (1046.5Hz) + E6 (1318.5Hz) with long ringing tail
    const osc3 = ctx.createOscillator()
    const osc4 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.type = 'sine'
    osc4.type = 'triangle'
    osc3.frequency.setValueAtTime(1046.5, now + 0.32)
    osc4.frequency.setValueAtTime(1318.5, now + 0.32)
    gain3.gain.setValueAtTime(0.001, now + 0.32)
    gain3.gain.exponentialRampToValueAtTime(0.25, now + 0.35)
    gain3.gain.exponentialRampToValueAtTime(0.0005, now + 0.85)
    osc3.connect(gain3)
    osc4.connect(gain3)
    gain3.connect(ctx.destination)
    osc3.start(now + 0.32)
    osc4.start(now + 0.32)
    osc3.stop(now + 0.86)
    osc4.stop(now + 0.86)
  }

  // Play Discord-like descending disconnect chime (Warm 3-note descent ~800ms)
  playDisconnect() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Note 1: C6 (1046.5Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(1046.5, now)
    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.23)

    // Note 2: G5 (783.99Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(783.99, now + 0.15)
    gain2.gain.setValueAtTime(0.001, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.2, now + 0.18)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.39)

    // Note 3: C5 (523.25Hz) + G4 (392Hz) long settling decay
    const osc3 = ctx.createOscillator()
    const osc4 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.type = 'sine'
    osc4.type = 'sine'
    osc3.frequency.setValueAtTime(523.25, now + 0.3)
    osc4.frequency.setValueAtTime(392.0, now + 0.3)
    gain3.gain.setValueAtTime(0.001, now + 0.3)
    gain3.gain.exponentialRampToValueAtTime(0.22, now + 0.33)
    gain3.gain.exponentialRampToValueAtTime(0.0005, now + 0.8)
    osc3.connect(gain3)
    osc4.connect(gain3)
    gain3.connect(ctx.destination)
    osc3.start(now + 0.3)
    osc4.start(now + 0.3)
    osc3.stop(now + 0.82)
    osc4.stop(now + 0.82)
  }

  // Play Mute audio cue (Two-step melodic descent ~460ms)
  playMute() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Step 1: B4 (493.88Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(493.88, now)
    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.14)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.15)

    // Step 2: E4 (329.63Hz) sustaining tone
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(329.63, now + 0.12)
    gain2.gain.setValueAtTime(0.001, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.0008, now + 0.45)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.46)
  }

  // Play Unmute audio cue (Two-step melodic ascent ~460ms)
  playUnmute() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Step 1: E4 (329.63Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(329.63, now)
    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.14)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.15)

    // Step 2: B4 (493.88Hz) + bright harmonic ring
    const osc2 = ctx.createOscillator()
    const osc3 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc3.type = 'triangle'
    osc2.frequency.setValueAtTime(493.88, now + 0.12)
    osc3.frequency.setValueAtTime(987.77, now + 0.12)
    gain2.gain.setValueAtTime(0.001, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.0008, now + 0.46)
    osc2.connect(gain2)
    osc3.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc3.start(now + 0.12)
    osc2.stop(now + 0.47)
    osc3.stop(now + 0.47)
  }

  // Play Deafen audio cue (Deep isolation downward filter sweep ~650ms)
  playDeafen() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const oscHarmonic = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    oscHarmonic.type = 'triangle'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(164.81, now + 0.28)
    oscHarmonic.frequency.setValueAtTime(220, now)
    oscHarmonic.frequency.exponentialRampToValueAtTime(82.4, now + 0.28)

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.65)

    osc.connect(gain)
    oscHarmonic.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    oscHarmonic.start(now)
    osc.stop(now + 0.66)
    oscHarmonic.stop(now + 0.66)
  }

  // Play Undeafen audio cue (Awakening two-tone harmonic bell ~650ms)
  playUndeafen() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Initial note: A3 (220Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(220, now)
    osc1.frequency.exponentialRampToValueAtTime(329.63, now + 0.15)
    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.03)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.2)

    // Bell chord: E5 (659.25Hz) + B5 (987.77Hz) ringing out
    const osc2 = ctx.createOscillator()
    const osc3 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc3.type = 'sine'
    osc2.frequency.setValueAtTime(659.25, now + 0.15)
    osc3.frequency.setValueAtTime(987.77, now + 0.15)
    gain2.gain.setValueAtTime(0.001, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.24, now + 0.18)
    gain2.gain.exponentialRampToValueAtTime(0.0008, now + 0.65)
    osc2.connect(gain2)
    osc3.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc3.start(now + 0.15)
    osc2.stop(now + 0.66)
    osc3.stop(now + 0.66)
  }

  // Play Tactical Ping audio cue (High-tech radar chirp ~400ms)
  playPing() {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(1480, now)
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.35)

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.4)
  }
}

export const soundEffects = new SoundEffectsEngine()

export interface KeybindConfig {
  mute: string
  deafen: string
  disconnect: string
}

export const DEFAULT_KEYBINDS: KeybindConfig = {
  mute: 'Ctrl + Shift + M',
  deafen: 'Ctrl + Shift + D',
  disconnect: 'Ctrl + Shift + H',
}

export function matchKeybind(e: KeyboardEvent, keybindStr: string): boolean {
  if (!keybindStr) return false
  const parts = keybindStr.toLowerCase().split('+').map((s) => s.trim())

  const needsCtrl = parts.includes('ctrl') || parts.includes('control')
  const needsShift = parts.includes('shift')
  const needsAlt = parts.includes('alt')
  const needsMeta = parts.includes('cmd') || parts.includes('meta')

  if (e.ctrlKey !== needsCtrl) return false
  if (e.shiftKey !== needsShift) return false
  if (e.altKey !== needsAlt) return false
  if (e.metaKey !== needsMeta) return false

  const keyPart = parts.find((p) => !['ctrl', 'control', 'shift', 'alt', 'cmd', 'meta'].includes(p))
  if (!keyPart) return false

  return e.key.toLowerCase() === keyPart.toLowerCase()
}

export function formatKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.metaKey) parts.push('Cmd')

  const key = e.key
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key)
  }

  return parts.join(' + ')
}

