import { angleOf, dims } from '../core/geom'
import type { DominoKind, DominoSpec, Level, Piece, SizeId, ThemeId, Zone } from '../core/types'

export interface PathPoint { x: number; z: number; a: number }

type Seg = { kind: 'line'; x: number; z: number; h: number; len: number } | { kind: 'arc'; cx: number; cz: number; r: number; a0: number; da: number; len: number }

/**
 * 海龜式路徑：fwd 直走、turn 以半徑轉彎（正角度＝向左／逆時針，俯視）。
 * sample(gap) 依弧長等距取樣，回傳骨牌位置與面向。
 */
export class Path {
  private segs: Seg[] = []
  x: number
  z: number
  h: number
  constructor(x: number, z: number, headingDeg = 0) {
    this.x = x
    this.z = z
    this.h = (headingDeg * Math.PI) / 180
  }
  fwd(len: number): this {
    this.segs.push({ kind: 'line', x: this.x, z: this.z, h: this.h, len })
    this.x += Math.cos(this.h) * len
    this.z -= Math.sin(this.h) * len
    return this
  }
  turn(deg: number, r: number): this {
    const da = (deg * Math.PI) / 180
    const s = Math.sign(da)
    // 圓心在左側（逆時針）或右側
    const nx = -Math.sin(this.h) * s, nz = -Math.cos(this.h) * s
    const cx = this.x + nx * r, cz = this.z + nz * r
    const a0 = Math.atan2(-(this.z - cz), this.x - cx)
    this.segs.push({ kind: 'arc', cx, cz, r, a0, da, len: Math.abs(da) * r })
    const a1 = a0 + da
    this.x = cx + Math.cos(a1) * r
    this.z = cz - Math.sin(a1) * r
    this.h += da
    return this
  }
  get length(): number {
    return this.segs.reduce((n, s) => n + s.len, 0)
  }
  at(d: number): PathPoint {
    for (const s of this.segs) {
      if (d <= s.len + 1e-9) {
        if (s.kind === 'line') return { x: s.x + Math.cos(s.h) * d, z: s.z - Math.sin(s.h) * d, a: s.h }
        const an = s.a0 + Math.sign(s.da) * (d / s.r)
        return { x: s.cx + Math.cos(an) * s.r, z: s.cz - Math.sin(an) * s.r, a: an + Math.sign(s.da) * Math.PI / 2 }
      }
      d -= s.len
    }
    const last = this.segs[this.segs.length - 1]
    return this.at(this.length - (last ? 0 : 0) - 1e-9)
  }
  /** 等距取樣：從 0 到總長（含兩端），點數依 gap 決定 */
  sample(gap: number): PathPoint[] {
    const L = this.length
    const n = Math.max(1, Math.round(L / gap))
    return Array.from({ length: n + 1 }, (_, i) => this.at((L * i) / n))
  }
}

function r2(v: number): number {
  return Math.round(v * 1000) / 1000
}

/** 關卡建構器：用路徑取樣擺固定骨牌、標準解與擺放區，自動算星等門檻 */
export class LB {
  private dominoes: DominoSpec[] = []
  private pieces: Piece[] = []
  private zones: Zone[] = []
  private sol: DominoSpec[] = []
  private extra: { x: number; z: number }[] = []
  private over: Partial<Pick<Level, 'limit' | 'star3' | 'star2'>> = {}
  constructor(private no: number, private theme: ThemeId, private hintKey?: string) {}

  d(kind: DominoKind, p: PathPoint | { x: number; z: number; a: number }, y = 0, size?: SizeId): this {
    const spec: DominoSpec = { x: r2(p.x), z: r2(p.z), a: r2(p.a), kind }
    if (y) spec.y = y
    if (size) spec.size = size
    if (kind === 'player') this.sol.push(spec)
    else this.dominoes.push(spec)
    return this
  }
  run(kind: DominoKind, pts: PathPoint[], y = 0, size?: SizeId): this {
    for (const p of pts) this.d(kind, p, y, size)
    return this
  }
  /** 以一串點的範圍建立擺放區（軸對齊矩形＋留白） */
  zoneAround(pts: { x: number; z: number }[], pad = 0.8, y = 0): this {
    const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z)
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad
    const minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad
    this.zones.push({ x: r2((minX + maxX) / 2), z: r2((minZ + maxZ) / 2), w: r2(maxX - minX), d: r2(maxZ - minZ), y: y || undefined })
    return this
  }
  zone(z: Zone): this {
    this.zones.push(z)
    return this
  }
  piece(p: Piece): this {
    this.pieces.push(p)
    return this
  }
  /** 平台（上表面高度 top） */
  platform(x0: number, z0: number, x1: number, z1: number, top: number, tone: 'light' | 'dark' | 'red' | 'blue' | 'green' | 'yellow' = 'light'): this {
    return this.piece({ type: 'box', x: (x0 + x1) / 2, y: top / 2, z: (z0 + z1) / 2, sx: Math.abs(x1 - x0), sy: top, sz: Math.abs(z1 - z0), tone })
  }
  /** 斜坡：從 (x0,y0) 到 (x1,y1) 沿 X 軸方向的木板（z 為中心、寬 w） */
  ramp(x0: number, y0: number, x1: number, y1: number, z: number, w = 0.7): this {
    const len = Math.hypot(x1 - x0, y1 - y0)
    const p = Math.atan2(y1 - y0, x1 - x0)
    const t = 0.12
    // 木板中心往下半個厚度，讓上表面通過兩端點
    const cx = (x0 + x1) / 2 + Math.sin(p) * t / 2
    const cy = (y0 + y1) / 2 - Math.cos(p) * t / 2
    this.piece({ type: 'box', x: cx, y: cy, z, sx: len, sy: t, sz: w, p, tone: 'red' })
    // 兩側護欄
    for (const s of [-1, 1]) this.piece({ type: 'box', x: cx, y: cy + 0.1, z: z + s * (w / 2 + 0.04), sx: len, sy: 0.2, sz: 0.08, p, tone: 'yellow' })
    return this
  }
  wall(x: number, z: number, sx: number, sz: number, h = 1.4): this {
    return this.piece({ type: 'box', x, y: h / 2, z, sx, sy: h, sz, tone: 'dark' })
  }
  limits(o: Partial<Pick<Level, 'limit' | 'star3' | 'star2'>>): this {
    this.over = o
    return this
  }
  /** 只影響相機範圍的額外點 */
  see(x: number, z: number): this {
    this.extra.push({ x, z })
    return this
  }

  build(): Level {
    const n = this.sol.length
    const star3 = this.over.star3 ?? n
    const star2 = this.over.star2 ?? Math.ceil(n * 1.3) + 1
    const limit = this.over.limit ?? Math.max(star2 + 3, Math.ceil(n * 1.8) + 2)
    const pts: { x: number; z: number }[] = [...this.dominoes, ...this.sol, ...this.extra]
    for (const z of this.zones) pts.push({ x: z.x - z.w / 2, z: z.z - z.d / 2 }, { x: z.x + z.w / 2, z: z.z + z.d / 2 })
    for (const p of this.pieces) {
      if ('x' in p && 'z' in p) pts.push({ x: p.x, z: p.z })
    }
    const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z)
    const m = dims('m').h
    return {
      id: `L${String(this.no).padStart(2, '0')}`,
      no: this.no,
      theme: this.theme,
      nameKey: `level.${this.no}`,
      hintKey: this.hintKey,
      dominoes: this.dominoes,
      pieces: this.pieces,
      zones: this.zones,
      limit,
      star3,
      star2,
      solution: this.sol,
      bounds: { minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minZ: Math.min(...zs) - m, maxZ: Math.max(...zs) + m },
    }
  }
}

export { angleOf }
