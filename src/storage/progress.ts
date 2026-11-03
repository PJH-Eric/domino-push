import type { DominoSpec, SizeId } from '../core/types'
import { safeGet, safeSet } from '../game/settings'

/** 挑戰進度：每關最佳星等與最少用量；沙盒存檔欄位 */
const PKEY = 'domino-push.progress.v1'
const SKEY = 'domino-push.sandbox.v1'
export const SLOT_COUNT = 10
export const SAVE_VERSION = 1

export interface LevelRecord {
  stars: number
  best: number
}

export interface Progress {
  levels: Record<string, LevelRecord>
  randomWins: number
  seenHints: string[]
}

function emptyProgress(): Progress {
  return { levels: {}, randomWins: 0, seenHints: [] }
}

export function loadProgress(): Progress {
  try {
    const raw = safeGet(PKEY)
    if (!raw) return emptyProgress()
    const p = JSON.parse(raw) as Partial<Progress>
    const out = emptyProgress()
    if (p.levels && typeof p.levels === 'object') {
      for (const [k, v] of Object.entries(p.levels)) {
        if (!/^L\d{2}$/.test(k) || !v || typeof v !== 'object') continue
        const stars = Number((v as LevelRecord).stars), best = Number((v as LevelRecord).best)
        if (stars >= 1 && stars <= 3 && best >= 1 && best < 1000) out.levels[k] = { stars: Math.round(stars), best: Math.round(best) }
      }
    }
    if (Number.isFinite(p.randomWins)) out.randomWins = Math.max(0, Math.round(Number(p.randomWins)))
    if (Array.isArray(p.seenHints)) out.seenHints = p.seenHints.filter((x) => typeof x === 'string').slice(0, 100)
    return out
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(p: Progress): void {
  safeSet(PKEY, JSON.stringify(p))
}

/** 記錄過關：星等與用量只升不降 */
export function recordWin(p: Progress, id: string, stars: number, used: number): { newBest: boolean } {
  const old = p.levels[id]
  const rec = { stars: Math.max(old?.stars ?? 0, stars), best: Math.min(old?.best ?? Infinity, used) }
  const newBest = !old || stars > old.stars || used < old.best
  p.levels[id] = rec
  saveProgress(p)
  return { newBest }
}

/** 第 n 關是否解鎖：第 1 關永遠開放，其餘要前一關過關 */
export function isUnlocked(p: Progress, no: number): boolean {
  if (no <= 1) return true
  return !!p.levels[`L${String(no - 1).padStart(2, '0')}`]
}

export function totalStars(p: Progress): number {
  return Object.values(p.levels).reduce((n, r) => n + r.stars, 0)
}

/* ───── 沙盒存檔 ───── */

export interface SandboxSave {
  v: number
  name: string
  at: number
  theme: string
  dominoes: DominoSpec[]
}

const SIZES: SizeId[] = ['s', 'm', 'l']

function validDomino(d: unknown): DominoSpec | null {
  if (!d || typeof d !== 'object') return null
  const r = d as Record<string, unknown>
  const x = Number(r.x), z = Number(r.z), a = Number(r.a)
  if (![x, z, a].every(Number.isFinite) || Math.abs(x) > 40 || Math.abs(z) > 40) return null
  const out: DominoSpec = { x, z, a, kind: 'free' }
  if (typeof r.size === 'string' && SIZES.includes(r.size as SizeId)) out.size = r.size as SizeId
  const c = Number(r.color)
  if (Number.isInteger(c) && c >= 0 && c <= 0xffffff) out.color = c
  return out
}

export function loadSlots(): (SandboxSave | null)[] {
  const out: (SandboxSave | null)[] = Array.from({ length: SLOT_COUNT }, () => null)
  try {
    const raw = safeGet(SKEY)
    if (!raw) return out
    const arr = JSON.parse(raw) as unknown[]
    if (!Array.isArray(arr)) return out
    arr.slice(0, SLOT_COUNT).forEach((s, i) => {
      if (!s || typeof s !== 'object') return
      const r = s as Record<string, unknown>
      if (r.v !== SAVE_VERSION || !Array.isArray(r.dominoes)) return
      const dominoes = (r.dominoes as unknown[]).map(validDomino).filter((d): d is DominoSpec => !!d).slice(0, 600)
      out[i] = { v: SAVE_VERSION, name: String(r.name ?? '').slice(0, 24), at: Number(r.at) || 0, theme: String(r.theme ?? 'village'), dominoes }
    })
  } catch {
    /* 壞檔就當作空的 */
  }
  return out
}

export function writeSlot(i: number, save: SandboxSave | null): boolean {
  const slots = loadSlots()
  slots[i] = save
  return safeSet(SKEY, JSON.stringify(slots))
}
