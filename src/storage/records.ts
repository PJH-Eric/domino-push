import { allLevels } from '../levels'
import { safeGet, safeSet } from '../game/settings'
import { loadProgress, totalStars } from './progress'

/** 個人紀錄（只存在本機） */
export interface Stats {
  pushes: number
  totalFallen: number
  bestRun: number
  bestCombo: number
  placed: number
  randomWins: number
  sandboxRuns: number
  sandboxBest: number
  sandboxBestFallen: number
  saves: number
  shapes: string[]
  /** 幼兒園模式過的關卡序號 */
  kids: number[]
  unlocked: Record<string, number>
}

const KEY = 'domino-push.records.v1'

function empty(): Stats {
  return { pushes: 0, totalFallen: 0, bestRun: 0, bestCombo: 0, placed: 0, randomWins: 0, sandboxRuns: 0, sandboxBest: 0, sandboxBestFallen: 0, saves: 0, shapes: [], kids: [], unlocked: {} }
}

export function loadStats(): Stats {
  const s = empty()
  try {
    const raw = safeGet(KEY)
    if (!raw) return s
    const r = JSON.parse(raw) as Record<string, unknown>
    for (const k of ['pushes', 'totalFallen', 'bestRun', 'bestCombo', 'placed', 'randomWins', 'sandboxRuns', 'sandboxBest', 'sandboxBestFallen', 'saves'] as const) {
      const v = Number(r[k])
      if (Number.isFinite(v) && v >= 0) s[k] = Math.min(1e9, Math.round(v))
    }
    if (Array.isArray(r.kids)) s.kids = r.kids.filter((x): x is number => Number.isInteger(x) && x > 0 && x < 100).slice(0, 100)
    if (Array.isArray(r.shapes)) s.shapes = r.shapes.filter((x): x is string => typeof x === 'string').slice(0, 10)
    if (r.unlocked && typeof r.unlocked === 'object') {
      for (const [k, v] of Object.entries(r.unlocked)) if (/^[a-z0-9_]+$/.test(k) && Number.isFinite(Number(v))) s.unlocked[k] = Number(v)
    }
  } catch {
    /* 壞檔重來 */
  }
  return s
}

function save(s: Stats): void {
  safeSet(KEY, JSON.stringify(s))
}

/* ───── 成就 ───── */

export interface AchCtx {
  s: Stats
  stars: number
  cleared: number
  chapter3: Record<string, boolean>
  /** 本次事件附帶的資訊 */
  run?: { fallen: number; combo: number; colors?: number; allFell?: boolean; total?: number; score?: number; mode: 'challenge' | 'random' | 'sandbox' }
}

export interface Achievement {
  id: string
  icon: 'push' | 'flag' | 'domino' | 'star' | 'dice' | 'sandbox' | 'palette' | 'save' | 'target' | 'spiral'
  /** 進度：目前值與目標值 */
  progress: (c: AchCtx) => [number, number]
}

const CH = ['village', 'camp', 'town', 'space', 'candy']

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_push', icon: 'push', progress: (c) => [c.s.pushes, 1] },
  { id: 'first_clear', icon: 'flag', progress: (c) => [c.cleared, 1] },
  { id: 'run_50', icon: 'domino', progress: (c) => [c.s.bestRun, 50] },
  { id: 'run_100', icon: 'domino', progress: (c) => [c.s.bestRun, 100] },
  { id: 'run_300', icon: 'domino', progress: (c) => [c.s.bestRun, 300] },
  { id: 'combo_30', icon: 'domino', progress: (c) => [c.s.bestCombo, 30] },
  { id: 'total_1000', icon: 'domino', progress: (c) => [c.s.totalFallen, 1000] },
  { id: 'total_10000', icon: 'domino', progress: (c) => [c.s.totalFallen, 10000] },
  { id: 'clear_10', icon: 'flag', progress: (c) => [c.cleared, 10] },
  { id: 'clear_all', icon: 'flag', progress: (c) => [c.cleared, 30] },
  { id: 'stars_30', icon: 'star', progress: (c) => [c.stars, 30] },
  { id: 'stars_90', icon: 'star', progress: (c) => [c.stars, 90] },
  ...CH.map((ch): Achievement => ({ id: `master_${ch}`, icon: 'star', progress: (c) => [c.chapter3[ch] ? 1 : 0, 1] })),
  { id: 'random_1', icon: 'dice', progress: (c) => [c.s.randomWins, 1] },
  { id: 'random_10', icon: 'dice', progress: (c) => [c.s.randomWins, 10] },
  { id: 'sb_first', icon: 'sandbox', progress: (c) => [c.s.sandboxRuns, 1] },
  { id: 'sb_colors', icon: 'palette', progress: (c) => [c.run?.mode === 'sandbox' ? c.run.colors ?? 0 : 0, 6] },
  { id: 'sb_shapes', icon: 'spiral', progress: (c) => [c.s.shapes.length, 5] },
  { id: 'sb_1000', icon: 'target', progress: (c) => [c.s.sandboxBest, 1000] },
  { id: 'sb_5000', icon: 'target', progress: (c) => [c.s.sandboxBest, 5000] },
  { id: 'sb_allfall', icon: 'target', progress: (c) => [c.run?.mode === 'sandbox' && c.run.allFell && (c.run.total ?? 0) >= 100 ? 1 : 0, 1] },
  { id: 'sb_save', icon: 'save', progress: (c) => [c.s.saves, 1] },
  { id: 'kids_first', icon: 'star', progress: (c) => [c.s.kids.length, 1] },
  { id: 'kids_all', icon: 'star', progress: (c) => [c.s.kids.length, 12] },
]

function ctx(s: Stats, run?: AchCtx['run']): AchCtx {
  const p = loadProgress()
  const chapter3: Record<string, boolean> = {}
  for (const ch of CH) {
    const lv = allLevels().filter((l) => l.theme === ch)
    chapter3[ch] = lv.length > 0 && lv.every((l) => (p.levels[l.id]?.stars ?? 0) >= 3)
  }
  return { s, stars: totalStars(p), cleared: Object.keys(p.levels).length, chapter3, run }
}

/** 已解鎖的成就以時間記錄；回傳本次新解鎖的成就 id */
function check(s: Stats, run?: AchCtx['run']): string[] {
  const c = ctx(s, run)
  const fresh: string[] = []
  for (const a of ACHIEVEMENTS) {
    if (s.unlocked[a.id]) continue
    const [v, goal] = a.progress(c)
    if (v >= goal) {
      s.unlocked[a.id] = Date.now()
      fresh.push(a.id)
    }
  }
  return fresh
}

export function achievementStatus(): { a: Achievement; at: number; v: number; goal: number }[] {
  const s = loadStats()
  const c = ctx(s)
  return ACHIEVEMENTS.map((a) => {
    const [v, goal] = a.progress(c)
    const at = s.unlocked[a.id] ?? 0
    return { a, at, v: at ? goal : Math.min(v, goal), goal }
  })
}

/* ───── 事件 ───── */

let notify: (ids: string[]) => void = () => {}
export function onUnlock(fn: (ids: string[]) => void): void {
  notify = fn
}

function commit(s: Stats, run?: AchCtx['run']): string[] {
  const fresh = check(s, run)
  save(s)
  if (fresh.length) notify(fresh)
  return fresh
}

export function recordPlaced(n: number): void {
  const s = loadStats()
  s.placed += n
  save(s)
}

/** 一次推倒結束（挑戰、隨機、沙盒都算） */
export function recordRun(run: NonNullable<AchCtx['run']> & { win?: boolean }): string[] {
  const s = loadStats()
  s.pushes++
  s.totalFallen += run.fallen
  s.bestRun = Math.max(s.bestRun, run.fallen)
  s.bestCombo = Math.max(s.bestCombo, run.combo)
  if (run.mode === 'random' && run.win) s.randomWins++
  if (run.mode === 'sandbox') {
    s.sandboxRuns++
    s.sandboxBest = Math.max(s.sandboxBest, run.score ?? 0)
    s.sandboxBestFallen = Math.max(s.sandboxBestFallen, run.fallen)
  }
  return commit(s, run)
}

/** 幼兒園關卡過關 */
export function recordKid(no: number, fallen: number, combo: number): string[] {
  const s = loadStats()
  s.pushes++
  s.totalFallen += fallen
  s.bestRun = Math.max(s.bestRun, fallen)
  s.bestCombo = Math.max(s.bestCombo, combo)
  if (!s.kids.includes(no)) s.kids.push(no)
  return commit(s)
}

export function recordShape(tool: string): void {
  const s = loadStats()
  if (!s.shapes.includes(tool)) {
    s.shapes.push(tool)
    commit(s)
  }
}

export function recordSave(): void {
  const s = loadStats()
  s.saves++
  commit(s)
}

/** 過關後（進度已寫入）重新檢查星數類成就 */
export function recheck(): string[] {
  return commit(loadStats())
}

/* ───── 沙盒分數 ───── */

export interface ScoreParts {
  fallen: number
  combo: number
  colors: number
  time: number
  allFell: boolean
  total: number
}

/** 分數＝倒下 ×10＋最長連倒 ×5＋顏色種類 ×20＋連鎖時間每 0.1 秒 1 分＋全倒獎勵（≥20 張） */
export function sandboxScore(p: ScoreParts): { total: number; lines: [string, number][] } {
  const lines: [string, number][] = [
    ['fallen', p.fallen * 10],
    ['combo', p.combo * 5],
    ['colors', p.colors * 20],
    ['time', Math.floor(p.time * 10)],
  ]
  if (p.allFell && p.total >= 20) lines.push(['allFell', 100 + p.total])
  return { total: lines.reduce((n, [, v]) => n + v, 0), lines }
}
