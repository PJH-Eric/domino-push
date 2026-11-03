import { angleOf, dims } from '../core/geom'
import type { DominoSpec, SizeId } from '../core/types'

export type ShapeTool = 'single' | 'line' | 'curve' | 'circle' | 'spiral' | 'fork' | 'eraser'
type P = { x: number; z: number }

/** 每個圖形工具需要點幾個點 */
export const POINTS_NEEDED: Record<ShapeTool, number> = { single: 1, line: 2, curve: 3, circle: 2, spiral: 2, fork: 2, eraser: 1 }

export interface ShapeOpts {
  size: SizeId
  color?: number
  /** 間距（相對骨牌高度） */
  spacing: number
}

function mk(x: number, z: number, a: number, o: ShapeOpts): DominoSpec {
  const d: DominoSpec = { x, z, a, kind: 'free', size: o.size }
  if (o.color !== undefined) d.color = o.color
  return d
}

/** 沿一串密集點等弧長取樣，面向切線方向 */
export function alongPolyline(pts: P[], gap: number, o: ShapeOpts, skipFirst = false): DominoSpec[] {
  const out: DominoSpec[] = []
  if (pts.length < 2) return out
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z))
  const L = cum[cum.length - 1]
  if (L < gap * 0.5) return out
  const n = Math.max(1, Math.round(L / gap))
  let j = 1
  for (let k = skipFirst ? 1 : 0; k <= n; k++) {
    const d = (L * k) / n
    while (j < cum.length - 1 && cum[j] < d) j++
    const t = (d - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1])
    const a = pts[j - 1], b = pts[j]
    out.push(mk(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, angleOf(b.x - a.x, b.z - a.z), o))
  }
  return out
}

function bezier(a: P, c: P, b: P, n = 64): P[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, z: u * u * a.z + 2 * u * t * c.z + t * t * b.z }
  })
}

/** 依工具與已點的點產生骨牌（預覽與放下共用） */
export function buildShape(tool: ShapeTool, pts: P[], o: ShapeOpts): DominoSpec[] {
  const gap = dims(o.size).h * o.spacing
  if (pts.length === 0) return []
  const [a, b, c] = pts
  switch (tool) {
    case 'line':
      return b ? alongPolyline([a, b], gap, o) : []
    case 'curve':
      if (!b) return []
      if (!c) return alongPolyline([a, b], gap, o)
      // 第三點是彎曲的控制點：曲線經過它附近
      return alongPolyline(bezier(a, { x: 2 * c.x - (a.x + b.x) / 2, z: 2 * c.z - (a.z + b.z) / 2 }, b), gap, o)
    case 'circle': {
      if (!b) return []
      const r = Math.hypot(b.x - a.x, b.z - a.z)
      if (r < 0.6) return []
      const a0 = Math.atan2(-(b.z - a.z), b.x - a.x)
      const n = Math.max(8, Math.floor((Math.PI * 2 * r) / gap))
      // 逆時針，留一格缺口避免第一張和最後一張相撞
      const ring: P[] = Array.from({ length: n * 4 }, (_, i) => {
        const an = a0 + ((Math.PI * 2 * i) / (n * 4)) * ((n - 0.6) / n)
        return { x: a.x + Math.cos(an) * r, z: a.z - Math.sin(an) * r }
      })
      return alongPolyline(ring, gap, o)
    }
    case 'spiral': {
      if (!b) return []
      const r0 = Math.hypot(b.x - a.x, b.z - a.z)
      const rMin = dims(o.size).h * 1.1
      if (r0 < rMin + 0.5) return []
      const a0 = Math.atan2(-(b.z - a.z), b.x - a.x)
      const turns = Math.min(3, Math.max(1, (r0 - rMin) / (dims(o.size).h * 1.25)))
      const steps = 400
      const pl: P[] = Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps
        const an = a0 + t * turns * Math.PI * 2
        const r = r0 - (r0 - rMin) * t
        return { x: a.x + Math.cos(an) * r, z: a.z - Math.sin(an) * r }
      })
      return alongPolyline(pl, gap, o)
    }
    case 'fork': {
      if (!b) return []
      const stem = alongPolyline([a, b], gap, o)
      if (!stem.length) return []
      const e = stem[stem.length - 1]
      const h = Math.atan2(-(b.z - a.z), b.x - a.x)
      const len = Math.max(gap * 3, Math.hypot(b.x - a.x, b.z - a.z) * 0.8)
      const w = dims(o.size).w
      const out = [...stem]
      for (const s of [1, -1]) {
        const lat = { x: -Math.sin(h) * s, z: -Math.cos(h) * s }
        const fwd = { x: Math.cos(h), z: -Math.sin(h) }
        const p0 = { x: e.x + fwd.x * gap * 1.05 + lat.x * w * 0.56, z: e.z + fwd.z * gap * 1.05 + lat.z * w * 0.56 }
        const ang = h + s * 0.55
        const p1 = { x: p0.x + Math.cos(h + s * 0.25) * len * 0.4, z: p0.z - Math.sin(h + s * 0.25) * len * 0.4 }
        const p2 = { x: p1.x + Math.cos(ang) * len * 0.6, z: p1.z - Math.sin(ang) * len * 0.6 }
        const branch = alongPolyline(bezier(p0, p1, p2), gap, o)
        if (branch.length) branch[0].a = h
        out.push(...branch)
      }
      return out
    }
    default:
      return []
  }
}

/** 6 色彩漆＋原木 */
export const PAINTS: (number | undefined)[] = [undefined, 0xe0453a, 0xf08a2c, 0xf2c230, 0x5fb86b, 0x3f74b5, 0x8a5bd0, 0xf27fb0]
