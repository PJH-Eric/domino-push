import { dims, footprint, pointInRect, polysOverlap } from './geom'
import type { DominoSpec, Level, Piece, Zone } from './types'

export type PlaceError = 'outside' | 'overlap' | 'limit'

/** 星等：用量 ≤ star3 三星、≤ star2 兩星，其餘一星（必須先過關） */
export function starsFor(level: Pick<Level, 'star3' | 'star2'>, used: number): 1 | 2 | 3 {
  if (used <= level.star3) return 3
  if (used <= level.star2) return 2
  return 1
}

/** 骨牌四個角是否都在任一擺放區內（且底面高度相符） */
export function insideZones(d: DominoSpec, zones: Zone[]): boolean {
  const pts = footprint(d)
  return zones.some((z) => (z.y ?? 0) === (d.y ?? 0) && pts.every((p) => pointInRect(p.x, p.z, z.x, z.z, z.w / 2, z.d / 2, z.a ?? 0)))
}

/** 靜態木塊在桌面上的投影（只算底面附近的，用來擋住擺放） */
function pieceFootprints(pieces: Piece[], y: number): { x: number; z: number }[][] {
  const out: { x: number; z: number }[][] = []
  for (const p of pieces) {
    if (p.type === 'box' || p.type === 'block') {
      const bottom = p.y - p.sy / 2
      const top = p.y + p.sy / 2
      if (top <= y + 0.01 || bottom > y + dims('l').h) continue
      const c = Math.cos(p.a ?? 0), s = Math.sin(p.a ?? 0)
      const hw = (p.type === 'box' && p.p ? Math.cos(p.p) * p.sx : p.sx) / 2, hd = p.sz / 2
      out.push([[hw, hd], [-hw, hd], [-hw, -hd], [hw, -hd]].map(([u, v]) => ({ x: p.x + u * c + v * s, z: p.z - u * s + v * c })))
    } else if (p.type === 'ball') {
      out.push(footprint({ x: p.x, z: p.z, a: 0, size: 'm' }, p.r - 0.12))
    } else if (p.type === 'lever' || p.type === 'seesaw') {
      out.push(footprint({ x: p.x, z: p.z, a: 0, size: 's' }, 0.1))
    }
  }
  return out
}

/** 檢查一張骨牌能不能放：要在擺放區內、不與其他骨牌或機關重疊 */
export function canPlace(d: DominoSpec, others: DominoSpec[], zones: Zone[] | null, pieces: Piece[], skip = -1): PlaceError | null {
  if (zones && !insideZones(d, zones)) return 'outside'
  const fp = footprint(d, -0.005)
  const y = d.y ?? 0
  for (let i = 0; i < others.length; i++) {
    if (i === skip) continue
    const o = others[i]
    if (Math.abs((o.y ?? 0) - y) > 0.05) continue
    if (Math.abs(o.x - d.x) > 1.2 || Math.abs(o.z - d.z) > 1.2) continue
    if (polysOverlap(fp, footprint(o))) return 'overlap'
  }
  for (const poly of pieceFootprints(pieces, y)) if (polysOverlap(fp, poly)) return 'overlap'
  return null
}
