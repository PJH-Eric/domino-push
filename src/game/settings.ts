import { detectLang, explicitLang, setLang, type Lang } from '../i18n'

export type QualitySetting = 'auto' | 'high' | 'medium' | 'low'

export interface Settings {
  musicOn: boolean
  musicVol: number
  sfxOn: boolean
  sfxVol: number
  haptics: boolean
  reduceMotion: boolean
  quality: QualitySetting
  cameraFollow: boolean
  /** 擺放時自動朝向最近的骨牌 */
  autoAim: boolean
  /** 顯示前方可碰到的範圍提示 */
  reachGuide: boolean
  /** 色彩輔助：色帶符號放大、加粗 */
  colorAssist: boolean
  lang: Lang
}

export const DEFAULTS: Settings = {
  musicOn: true,
  musicVol: 55,
  sfxOn: true,
  sfxVol: 80,
  haptics: true,
  reduceMotion: false,
  quality: 'auto',
  cameraFollow: true,
  autoAim: true,
  reachGuide: true,
  colorAssist: false,
  lang: 'zh-TW',
}

const KEY = 'domino-push.settings.v1'
let cur: Settings = { ...DEFAULTS }
const listeners = new Set<(s: Settings) => void>()

export function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

export function safeSet(k: string, v: string): boolean {
  try {
    localStorage.setItem(k, v)
    return true
  } catch {
    return false
  }
}

export function safeRemove(k: string): void {
  try {
    localStorage.removeItem(k)
  } catch {
    /* 無法存取就略過 */
  }
}

function sanitize(raw: unknown): Settings {
  const s = { ...DEFAULTS }
  if (!raw || typeof raw !== 'object') return s
  const r = raw as Record<string, unknown>
  for (const k of ['musicOn', 'sfxOn', 'haptics', 'reduceMotion', 'cameraFollow', 'autoAim', 'reachGuide', 'colorAssist'] as const) {
    if (typeof r[k] === 'boolean') s[k] = r[k] as boolean
  }
  for (const k of ['musicVol', 'sfxVol'] as const) {
    const v = Number(r[k])
    if (Number.isFinite(v)) s[k] = Math.max(0, Math.min(100, Math.round(v)))
  }
  if (r.quality === 'auto' || r.quality === 'high' || r.quality === 'medium' || r.quality === 'low') s.quality = r.quality
  if (r.lang === 'zh-TW' || r.lang === 'zh-CN' || r.lang === 'en') s.lang = r.lang
  return s
}

export function loadSettings(): Settings {
  const raw = safeGet(KEY)
  let parsed: unknown = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }
  cur = sanitize(parsed)
  // 語言：網址或跨遊戲共用設定優先，其次這款遊戲的設定，最後瀏覽器語言
  cur.lang = explicitLang() ?? (parsed && typeof parsed === 'object' && 'lang' in parsed ? cur.lang : detectLang())
  setLang(cur.lang)
  if (typeof matchMedia === 'function' && !(parsed && typeof parsed === 'object' && 'reduceMotion' in parsed)) {
    cur.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  applyDom()
  return cur
}

function applyDom(): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('reduce-motion', cur.reduceMotion)
  document.documentElement.classList.toggle('color-assist', cur.colorAssist)
}

export function getSettings(): Settings {
  return cur
}

export function updateSettings(patch: Partial<Settings>): void {
  cur = { ...cur, ...patch }
  if (patch.lang) setLang(patch.lang)
  safeSet(KEY, JSON.stringify(cur))
  applyDom()
  listeners.forEach((f) => f(cur))
}

export function resetSettings(): void {
  const lang = cur.lang
  updateSettings({ ...DEFAULTS, lang })
}

export function onSettings(fn: (s: Settings) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
