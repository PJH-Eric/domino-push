import RAPIER from '@dimforge/rapier3d-compat'
import type { Level, ThemeId } from '../core/types'
import { simulate } from '../physics/sim'
import { LB, Path, type PathPoint } from './builder'

const THEMES: ThemeId[] = ['village', 'camp', 'town', 'space', 'candy']

/** 可重現的亂數（mulberry32） */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function between(r: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * r()
}

/** 路徑是否自己交叉或太靠近（非相鄰取樣點距離過近） */
function selfClash(pts: PathPoint[], extra: { x: number; z: number }[] = []): boolean {
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 3; j < pts.length; j++) {
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) < 1.0) return true
    }
    for (const e of extra) if (Math.hypot(pts[i].x - e.x, pts[i].z - e.z) < 1.0) return true
  }
  return false
}

/** 把一段路徑切成「固定／玩家」：挑兩段連續區間讓玩家補 */
function splitRuns(n: number, r: () => number): boolean[] {
  const player = Array.from({ length: n }, () => false)
  const want = Math.max(3, Math.round(n * between(r, 0.35, 0.5)))
  const a = Math.max(1, Math.round(want * between(r, 0.35, 0.65)))
  const b = want - a
  const s1 = 1 + Math.floor(r() * Math.max(1, Math.floor(n / 2) - a))
  for (let i = s1; i < Math.min(n, s1 + a); i++) player[i] = true
  const lo = Math.min(n - 1, s1 + a + 2)
  const s2 = lo + Math.floor(r() * Math.max(1, n - lo - b))
  for (let i = s2; i < Math.min(n, s2 + b); i++) player[i] = true
  return player
}

/** 依路徑建立：起點→（固定／玩家）→結尾；回傳最後的點 */
function layRoute(b: LB, pts: PathPoint[], r: () => number, y = 0, first: 'start' | 'fixed' = 'start'): void {
  const mask = splitRuns(pts.length, r)
  let run: PathPoint[] = []
  const flush = () => {
    if (run.length) b.zoneAround(run, 0.65, y)
    run = []
  }
  pts.forEach((p, i) => {
    if (i === 0) { b.d(first, p, y); return }
    if (mask[i]) { b.d('player', p, y); run.push(p) } else { flush(); b.d('fixed', p, y) }
  })
  flush()
}

function tryBuild(seed: number, r: () => number): Level | null {
  const theme = THEMES[Math.floor(r() * THEMES.length)]
  const b = new LB(0, theme)
  const useBall = r() < 0.35
  let x0 = -7, z0 = between(r, -1.5, 1.5)
  const avoid: { x: number; z: number }[] = []
  if (useBall) {
    // 高台＋彈珠＋斜坡開場（與第 9 關同樣的已驗證配置）
    b.platform(-8.5, z0 - 1, -4.2, z0 + 1, 1.0, 'green')
    const top = new Path(-8, z0, 0).fwd(2.95).sample(0.7)
    layRoute(b, top, r, 1)
    b.piece({ type: 'ball', x: -4.2, y: 1.24, z: z0, r: 0.24 })
    b.ramp(-4.2, 0.9, -1.6, 0, z0)
    for (let x = -8.5; x <= -1.6; x += 0.8) avoid.push({ x, z: z0 })
    x0 = -0.8
  }
  // 地面路線：直走、轉彎交錯
  const p = new Path(x0, z0, 0)
  const segs = 2 + Math.floor(r() * 3)
  let heading = 0
  p.fwd(between(r, 1.2, 2.4))
  for (let i = 0; i < segs; i++) {
    let deg = Math.round(between(r, 35, 90)) * (r() < 0.5 ? -1 : 1)
    if (Math.abs(heading + deg) > 100) deg = -deg
    heading += deg
    p.turn(deg, between(r, 1.8, 2.6)).fwd(between(r, 1.0, 2.2))
  }
  const pts = p.sample(between(r, 0.66, 0.76))
  if (selfClash(pts, avoid)) return null
  const ending = r()
  const e = pts[pts.length - 1]
  if (useBall) {
    // 彈珠撞的第一段是固定骨牌，其餘交給玩家
    b.d('fixed', pts[0])
    layRoute(b, pts.slice(1), r, 0, 'fixed')
  } else layRoute(b, pts, r)
  const dx = Math.cos(e.a), dz = -Math.sin(e.a)
  if (ending < 0.4) {
    // 大骨牌推塔
    b.d('fixed', { x: e.x + dx * 0.85, z: e.z + dz * 0.85, a: e.a }, 0, 'l')
    for (let i = 0; i < 3; i++) b.piece({ type: 'block', x: e.x + dx * 1.83, y: 0.25 + i * 0.5, z: e.z + dz * 1.83, sx: 0.36, sy: 0.5, sz: 0.5, a: e.a, tone: (['blue', 'red', 'green'] as const)[i], target: i === 2 })
  } else if (ending < 0.7) {
    // 分岔成兩個目標
    const up = new Path(e.x + dx * 0.68 + dz * 0.3, e.z + dz * 0.68 - dx * 0.3, (e.a * 180) / Math.PI).turn(40, 2.2).fwd(1.2).sample(0.7)
    const dn = new Path(e.x + dx * 0.68 - dz * 0.3, e.z + dz * 0.68 + dx * 0.3, (e.a * 180) / Math.PI).turn(-40, 2.2).fwd(1.2).sample(0.7)
    if (selfClash([...pts, ...up]) || selfClash([...pts, ...dn])) return null
    b.run('fixed', up.slice(0, -1)).d('target', up[up.length - 1])
    b.run('fixed', dn.slice(0, -1)).d('target', dn[dn.length - 1])
  } else {
    b.d('target', { x: e.x + dx * 0.7, z: e.z + dz * 0.7, a: e.a })
  }
  const lv = b.build()
  const span = Math.max(lv.bounds.maxX - lv.bounds.minX, lv.bounds.maxZ - lv.bounds.minZ)
  if (span > 22) return null
  return { ...lv, id: `R${seed}`, no: 0, seed, nameKey: undefined, hintKey: undefined }
}

/**
 * 依種子產生隨機關：同一個種子永遠得到同一關。
 * 每個候選都以物理模擬驗證「標準解能過、什麼都不擺不能過」，不合格就換下一個子種子。
 */
export function generateRandom(seed: number): Level {
  for (let k = 0; k < 40; k++) {
    const r = mulberry(seed * 7919 + k * 104729)
    const lv = tryBuild(seed, r)
    if (!lv || lv.solution.length < 3) continue
    if (!simulate(RAPIER, lv, lv.solution).win) continue
    if (simulate(RAPIER, lv, []).win) continue
    return lv
  }
  // 保底：簡單直線
  const s = new Path(-4, 0, 0).fwd(8).sample(0.72)
  const b = new LB(0, 'village')
  b.d('start', s[0]).run('fixed', s.slice(1, 3)).run('player', s.slice(3, -3)).run('fixed', s.slice(-3, -1)).d('target', s[s.length - 1])
  b.zoneAround(s.slice(3, -3), 0.7)
  return { ...b.build(), id: `R${seed}`, no: 0, seed, nameKey: undefined, hintKey: undefined }
}
