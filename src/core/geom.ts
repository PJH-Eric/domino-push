import type { DominoSpec, SizeId } from './types'

/** 中型骨牌尺寸（厚 × 高 × 寬）：厚度方向即倒下方向（本地 X 軸） */
export const BASE = { t: 0.25, h: 1.0, w: 0.55 }
export const SIZE_SCALE: Record<SizeId, number> = { s: 0.72, m: 1, l: 1.35 }
/** 建議間距（相對於骨牌高度）：太近推不動、太遠碰不到 */
export const SPACING = 0.62

export function dims(size: SizeId = 'm'): { t: number; h: number; w: number } {
  const k = SIZE_SCALE[size]
  return { t: BASE.t * k, h: BASE.h * k, w: BASE.w * k }
}

/** 骨牌面向（倒下方向）的單位向量，於 XZ 平面 */
export function facing(a: number): { x: number; z: number } {
  return { x: Math.cos(a), z: -Math.sin(a) }
}

/** 由方向向量求角度（與 facing 互逆） */
export function angleOf(dx: number, dz: number): number {
  return Math.atan2(-dz, dx)
}

/** 骨牌在桌面上的投影（旋轉矩形）四角 */
export function footprint(d: Pick<DominoSpec, 'x' | 'z' | 'a' | 'size'>, pad = 0): { x: number; z: number }[] {
  const { t, w } = dims(d.size)
  const f = facing(d.a)
  const s = { x: -f.z, z: f.x }
  const ht = t / 2 + pad
  const hw = w / 2 + pad
  return [
    { x: d.x + f.x * ht + s.x * hw, z: d.z + f.z * ht + s.z * hw },
    { x: d.x + f.x * ht - s.x * hw, z: d.z + f.z * ht - s.z * hw },
    { x: d.x - f.x * ht - s.x * hw, z: d.z - f.z * ht - s.z * hw },
    { x: d.x - f.x * ht + s.x * hw, z: d.z - f.z * ht + s.z * hw },
  ]
}

/** 2D 凸多邊形分離軸測試：有重疊回傳 true */
export function polysOverlap(a: { x: number; z: number }[], b: { x: number; z: number }[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i]
      const p2 = poly[(i + 1) % poly.length]
      const nx = p2.z - p1.z
      const nz = p1.x - p2.x
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity
      for (const p of a) { const v = p.x * nx + p.z * nz; if (v < minA) minA = v; if (v > maxA) maxA = v }
      for (const p of b) { const v = p.x * nx + p.z * nz; if (v < minB) minB = v; if (v > maxB) maxB = v }
      if (maxA <= minB || maxB <= minA) return false
    }
  }
  return true
}

/** 旋轉矩形（中心、半寬、半深、角度）四角 */
export function rectCorners(x: number, z: number, hw: number, hd: number, a = 0): { x: number; z: number }[] {
  const c = Math.cos(a), s = Math.sin(a)
  const pts = [[hw, hd], [-hw, hd], [-hw, -hd], [hw, -hd]]
  return pts.map(([u, v]) => ({ x: x + u * c + v * s, z: z - u * s + v * c }))
}

/** 點是否在旋轉矩形內 */
export function pointInRect(px: number, pz: number, x: number, z: number, hw: number, hd: number, a = 0): boolean {
  const dx = px - x, dz = pz - z
  const c = Math.cos(a), s = Math.sin(a)
  const u = dx * c - dz * s
  const v = dx * s + dz * c
  return Math.abs(u) <= hw && Math.abs(v) <= hd
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 角度正規化到 (−π, π] */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2)
  if (r <= -Math.PI) r += Math.PI * 2
  if (r > Math.PI) r -= Math.PI * 2
  return r
}
