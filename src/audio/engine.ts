import type { ThemeId } from '../core/types'
import { getSettings, onSettings } from '../game/settings'

/**
 * 以 WebAudio 合成全部音效與背景音樂（木琴風），沒有外部素材。
 * 木頭碰撞：短促帶通雜訊＋木塊共鳴音，音量依碰撞力道。
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private music!: GainNode
  private noiseBuf: AudioBuffer | null = null
  private musicTimer: number | null = null
  private step = 0
  private theme: ThemeId = 'village'
  private recent: number[] = []
  unlocked = false

  constructor() {
    onSettings(() => this.applyVolumes())
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return
        if (document.hidden) this.ctx.suspend()
        else this.ctx.resume()
      })
    }
  }

  unlock(): void {
    if (this.unlocked) {
      this.ctx?.resume()
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.sfx = this.ctx.createGain()
    this.music = this.ctx.createGain()
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    this.sfx.connect(this.master)
    this.music.connect(this.master)
    this.master.connect(comp).connect(this.ctx.destination)
    const len = this.ctx.sampleRate
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.unlocked = true
    this.ctx.resume()
    this.applyVolumes()
  }

  applyVolumes(): void {
    if (!this.ctx) return
    const s = getSettings()
    this.sfx.gain.value = s.sfxOn ? (s.sfxVol / 100) * 0.9 : 0
    this.music.gain.value = s.musicOn ? (s.musicVol / 100) * 0.28 : 0
    if (s.musicOn && this.musicTimer === null) this.startMusic()
    if (!s.musicOn) this.stopMusic()
  }

  setTheme(t: ThemeId): void {
    this.theme = t
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, out?: GainNode): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime + when
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(out ?? this.sfx)
    o.start(t)
    o.stop(t + dur + 0.03)
  }

  private noise(dur: number, vol: number, freq: number, q = 2, when = 0): void {
    if (!this.ctx || !this.noiseBuf) return
    const t = this.ctx.currentTime + when
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(Math.max(0.0002, vol), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.sfx)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  /** 木塊互撞（force 由物理碰撞力道換算） */
  impact(force: number, kind: 'domino' | 'block' | 'ball' | 'plank'): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.recent = this.recent.filter((t) => now - t < 0.06)
    if (this.recent.length >= 3) return
    this.recent.push(now)
    const k = Math.min(1, Math.log10(1 + force) / 2.4)
    if (k < 0.08) return
    const pitch = kind === 'ball' ? 520 : kind === 'block' ? 900 : kind === 'plank' ? 700 : 1400 + Math.random() * 500
    this.noise(0.05 + k * 0.03, 0.08 + k * 0.5, pitch, 3)
    this.tone(pitch * 0.55 * (0.95 + Math.random() * 0.1), 0.07 + k * 0.05, 'triangle', 0.03 + k * 0.18)
  }

  click(): void {
    this.noise(0.03, 0.2, 2400, 4)
  }

  place(): void {
    this.noise(0.05, 0.35, 1600, 3)
    this.tone(660, 0.08, 'triangle', 0.15)
  }

  remove(): void {
    this.tone(520, 0.08, 'triangle', 0.12)
    this.tone(390, 0.1, 'triangle', 0.1, 0.05)
  }

  invalid(): void {
    this.tone(220, 0.12, 'square', 0.06)
    this.tone(180, 0.14, 'square', 0.05, 0.08)
  }

  push(): void {
    this.noise(0.08, 0.4, 900, 1.5)
    this.tone(330, 0.1, 'triangle', 0.18)
  }

  /** 連擊每十張的小鈴聲，越長音越高 */
  combo(n: number): void {
    const base = 523 * Math.pow(2, Math.min(12, n / 10) / 12)
    this.tone(base, 0.18, 'sine', 0.16)
    this.tone(base * 1.5, 0.2, 'sine', 0.1, 0.06)
  }

  star(i: number): void {
    const notes = [784, 988, 1175]
    this.tone(notes[i] ?? 1175, 0.35, 'sine', 0.22)
    this.tone((notes[i] ?? 1175) * 2, 0.25, 'sine', 0.06)
  }

  win(): void {
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, i * 0.1))
  }

  fail(): void {
    ;[392, 330, 262].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.15, i * 0.13))
  }

  /* ───── 背景音樂：五聲音階木琴，主題換樂器與八度 ───── */

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return
    const beat = 0.3
    // 主旋律（音階索引，-1 為休止）
    const melody = [0, 2, 4, 2, 5, 4, 2, -1, 0, 2, 4, 7, 5, 4, 2, -1, 4, 5, 7, 5, 4, 2, 0, -1, 2, 4, 2, 0, 1, 0, -1, -1]
    const bass = [0, -1, 4, -1, 3, -1, 4, -1]
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19]
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return
      const style = THEME_MUSIC[this.theme]
      const i = this.step % melody.length
      const m = melody[i]
      if (m >= 0) {
        const f = style.root * Math.pow(2, scale[m] / 12)
        this.tone(f, 0.45, style.wave, 0.22, 0, this.music)
        this.tone(f * 4, 0.12, 'sine', 0.03, 0, this.music)
      }
      if (this.step % 4 === 0) {
        const b = bass[(this.step / 4) % bass.length]
        if (b >= 0) this.tone((style.root / 2) * Math.pow(2, scale[b] / 12), 0.6, 'triangle', 0.14, 0, this.music)
      }
      this.step++
    }, beat * 1000)
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) clearInterval(this.musicTimer)
    this.musicTimer = null
  }
}

const THEME_MUSIC: Record<ThemeId, { root: number; wave: OscillatorType }> = {
  village: { root: 523.25, wave: 'triangle' },
  camp: { root: 392, wave: 'triangle' },
  town: { root: 587.33, wave: 'sine' },
  space: { root: 440, wave: 'sine' },
  candy: { root: 659.25, wave: 'triangle' },
}

export const audio = new AudioEngine()

/** 行動裝置震動（設定可關） */
export function buzz(ms: number): void {
  if (!getSettings().haptics) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* 不支援就略過 */
  }
}
