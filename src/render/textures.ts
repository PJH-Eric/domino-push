import * as THREE from 'three'
import type { ThemeId } from '../core/types'

/** 以種子產生的簡單亂數（貼圖程序生成用，畫面每次一致） */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function tex(c: HTMLCanvasElement, repeat = 1, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 4
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * 木紋：以淺色底＋沿長軸的波浪年輪線與細纖維。
 * base／line 為底色與紋路色；grain 越大紋路越密。
 */
export function woodCanvas(base: string, line: string, seed = 7, grain = 14, size = 256): HTMLCanvasElement {
  const [c, g] = canvas(size, size)
  const r = rng(seed)
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  // 年輪：垂直方向的波浪線
  for (let i = 0; i < grain; i++) {
    const x0 = (i / grain) * size + r() * 10
    const amp = 2 + r() * 6
    const freq = 0.01 + r() * 0.02
    const ph = r() * 6
    g.strokeStyle = line
    g.globalAlpha = 0.12 + r() * 0.2
    g.lineWidth = 0.8 + r() * 2.2
    g.beginPath()
    for (let y = 0; y <= size; y += 4) {
      const x = x0 + Math.sin(y * freq + ph) * amp + Math.sin(y * 0.05 + i) * 1.2
      if (y === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  // 細纖維
  g.globalAlpha = 0.06
  for (let i = 0; i < 400; i++) {
    g.fillStyle = r() > 0.5 ? '#fff' : line
    g.fillRect(r() * size, r() * size, 1, 3 + r() * 10)
  }
  // 小節疤
  for (let i = 0; i < 2; i++) {
    const x = r() * size, y = r() * size
    const gr = g.createRadialGradient(x, y, 0, x, y, 6 + r() * 6)
    gr.addColorStop(0, line)
    gr.addColorStop(1, 'transparent')
    g.globalAlpha = 0.25
    g.fillStyle = gr
    g.beginPath()
    g.ellipse(x, y, 5 + r() * 4, 9 + r() * 6, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  return c
}

export function woodTexture(base: string, line: string, seed = 7, repeat = 1): THREE.CanvasTexture {
  return tex(woodCanvas(base, line, seed), repeat)
}

/** 骨牌用木紋（偏亮的楓木） */
export function dominoWood(): THREE.CanvasTexture {
  return woodTexture('#f0d3a0', '#a8743d', 11, 1)
}

/** 色帶上的刻痕符號：箭頭（起點）、星形（目標）、鎖（固定） */
export function symbolTexture(kind: 'arrow' | 'star' | 'lock'): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128)
  g.clearRect(0, 0, 128, 128)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.strokeStyle = 'rgba(60,30,10,0.55)'
  g.lineWidth = 6
  g.lineJoin = 'round'
  g.beginPath()
  if (kind === 'arrow') {
    g.moveTo(22, 52); g.lineTo(72, 52); g.lineTo(72, 30); g.lineTo(108, 64); g.lineTo(72, 98); g.lineTo(72, 76); g.lineTo(22, 76)
  } else if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? 20 : 46
      const an = -Math.PI / 2 + (i * Math.PI) / 5
      const x = 64 + Math.cos(an) * rr, y = 66 + Math.sin(an) * rr
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
  } else {
    g.rect(36, 58, 56, 44)
    g.moveTo(48, 58); g.arc(64, 54, 16, Math.PI, 0); g.lineTo(80, 58)
  }
  g.closePath()
  g.stroke()
  g.fill()
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/** 桌布主題：底色、紋樣、桌墊 */
export interface ThemeStyle {
  cloth: string
  cloth2: string
  pattern: 'gingham' | 'plaid' | 'map' | 'stars' | 'stripes'
  sky: string
  sky2: string
  light: number
  accent: string
}

export const THEMES: Record<ThemeId, ThemeStyle> = {
  village: { cloth: '#cfe7c4', cloth2: '#f6c8cf', pattern: 'gingham', sky: '#fbe9cf', sky2: '#d9eec8', light: 0xfff2dd, accent: '#e2647a' },
  camp: { cloth: '#d8c49a', cloth2: '#7d9a5a', pattern: 'plaid', sky: '#f3d8a8', sky2: '#9ab88a', light: 0xffe2b8, accent: '#c8622a' },
  town: { cloth: '#d9dde3', cloth2: '#8fa4bd', pattern: 'map', sky: '#e8eef6', sky2: '#c5d4e6', light: 0xf4f7ff, accent: '#3d6fb6' },
  space: { cloth: '#2c2f5c', cloth2: '#f4e3a1', pattern: 'stars', sky: '#2a2c52', sky2: '#13142c', light: 0xdfe4ff, accent: '#8a7cf0' },
  candy: { cloth: '#ffd9e8', cloth2: '#ffffff', pattern: 'stripes', sky: '#ffe8f2', sky2: '#ffd2a8', light: 0xfff0f6, accent: '#ff5fa2' },
}

export function clothTexture(theme: ThemeId): THREE.CanvasTexture {
  const s = THEMES[theme]
  const size = 256
  const [c, g] = canvas(size, size)
  const r = rng(theme.length * 31 + 5)
  g.fillStyle = s.cloth
  g.fillRect(0, 0, size, size)
  if (s.pattern === 'gingham') {
    g.fillStyle = s.cloth2
    g.globalAlpha = 0.55
    for (let i = 0; i < 8; i += 2) {
      g.fillRect(i * 32, 0, 32, size)
      g.fillRect(0, i * 32, size, 32)
    }
  } else if (s.pattern === 'plaid') {
    g.globalAlpha = 0.5
    g.fillStyle = s.cloth2
    for (let i = 0; i < 4; i++) { g.fillRect(i * 64 + 10, 0, 22, size); g.fillRect(0, i * 64 + 10, size, 22) }
    g.fillStyle = '#b5482c'
    g.globalAlpha = 0.45
    for (let i = 0; i < 4; i++) { g.fillRect(i * 64 + 44, 0, 4, size); g.fillRect(0, i * 64 + 44, size, 4) }
  } else if (s.pattern === 'map') {
    g.strokeStyle = s.cloth2
    g.globalAlpha = 0.55
    g.lineWidth = 10
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(0, 40 + i * 85); g.lineTo(size, 40 + i * 85); g.stroke()
      g.beginPath(); g.moveTo(30 + i * 90, 0); g.lineTo(30 + i * 90, size); g.stroke()
    }
    g.fillStyle = '#b8d6a6'
    g.globalAlpha = 0.6
    g.fillRect(120, 140, 60, 40)
    g.fillStyle = '#f1f3f6'
    g.globalAlpha = 0.8
    g.setLineDash([10, 10])
    g.lineWidth = 2
    g.strokeStyle = '#ffffff'
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(0, 40 + i * 85); g.lineTo(size, 40 + i * 85); g.stroke()
    }
  } else if (s.pattern === 'stars') {
    for (let i = 0; i < 70; i++) {
      g.fillStyle = r() > 0.7 ? s.cloth2 : '#ffffff'
      g.globalAlpha = 0.35 + r() * 0.6
      const x = r() * size, y = r() * size, rr = 0.6 + r() * 1.8
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill()
    }
    g.globalAlpha = 0.25
    g.fillStyle = '#8a7cf0'
    g.beginPath(); g.arc(190, 70, 26, 0, Math.PI * 2); g.fill()
  } else {
    g.fillStyle = s.cloth2
    g.globalAlpha = 0.75
    for (let i = -size; i < size * 2; i += 40) {
      g.beginPath()
      g.moveTo(i, 0); g.lineTo(i + 20, 0); g.lineTo(i + 20 - size, size); g.lineTo(i - size, size)
      g.fill()
    }
    g.fillStyle = '#ff9ec7'
    g.globalAlpha = 0.4
    for (let i = 0; i < 20; i++) { g.beginPath(); g.arc(r() * size, r() * size, 3, 0, Math.PI * 2); g.fill() }
  }
  g.globalAlpha = 1
  // 布料纖維
  g.globalAlpha = 0.05
  for (let y = 0; y < size; y += 2) { g.fillStyle = y % 4 ? '#000' : '#fff'; g.fillRect(0, y, size, 1) }
  g.globalAlpha = 1
  return tex(c, 1)
}

/** 綠色可擺放桌墊：毛氈底＋虛線邊框（依尺寸產生） */
export function zoneTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128)
  g.fillStyle = '#5fb86b'
  g.fillRect(0, 0, 128, 128)
  const r = rng(99)
  g.globalAlpha = 0.12
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? '#fff' : '#1d5e2a'; g.fillRect(r() * 128, r() * 128, 1.5, 1.5) }
  g.globalAlpha = 1
  return tex(c, 1)
}

/** 背景天空：上下漸層 */
export function skyTexture(theme: ThemeId): THREE.CanvasTexture {
  const s = THEMES[theme]
  const [c, g] = canvas(4, 256)
  const gr = g.createLinearGradient(0, 0, 0, 256)
  gr.addColorStop(0, s.sky2)
  gr.addColorStop(1, s.sky)
  g.fillStyle = gr
  g.fillRect(0, 0, 4, 256)
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}
