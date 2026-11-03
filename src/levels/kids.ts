import type { DominoKind, DominoSpec, Level } from '../core/types'
import { LB, Path, type PathPoint } from './builder'

/** 幼兒園模式用的彩虹色 */
export const KID_COLORS = [0xe0453a, 0xf08a2c, 0xf2c230, 0x5fb86b, 0x3f74b5, 0x8a5bd0, 0xf27fb0]

function line(x0: number, x1: number, z: number, gap: number): PathPoint[] {
  return new Path(x0, z, x1 >= x0 ? 0 : 180).fwd(Math.abs(x1 - x0)).sample(gap)
}

/**
 * 幼兒園關卡：玩家要擺的位置（solution）就是畫面上的發光空位，點一下就放好。
 * 沒有用量限制、沒有星等；所有裝飾骨牌塗上彩虹色（kind 'free' 不畫固定色帶）。
 */
class KB {
  b: LB
  i = 0
  constructor(no: number, theme: Level['theme']) {
    this.b = new LB(no, theme)
  }
  put(kind: DominoKind, p: PathPoint, y = 0, size?: DominoSpec['size']): this {
    this.b.d(kind, p, y, size)
    return this
  }
  run(kind: 'free' | 'player', pts: PathPoint[], y = 0): this {
    for (const p of pts) this.b.d(kind, p, y)
    return this
  }
  build(): Level {
    const lv = this.b.build()
    let k = 0
    const paint = (d: DominoSpec) => {
      if (d.kind === 'free' || d.kind === 'player') d.color = KID_COLORS[k++ % KID_COLORS.length]
    }
    // 依位置順序上色，彩虹看起來連續
    const all = [...lv.dominoes, ...lv.solution].sort((a, b) => a.x - b.x || a.z - b.z)
    all.forEach(paint)
    return { ...lv, id: `K${String(lv.no).padStart(2, '0')}`, nameKey: `kid.level.${lv.no}`, hintKey: undefined, limit: 999, star3: 999, star2: 1000, zones: [] }
  }
}

export function kidLevels(): Level[] {
  const L: Level[] = []
  // 1 直直走
  {
    const s = line(-3, 3, 0, 0.75)
    const k = new KB(1, 'village').put('start', s[0]).run('player', s.slice(1, -1)).put('target', s[s.length - 1])
    L.push(k.build())
  }
  // 2 補三張
  {
    const s = line(-4, 4, 0, 0.72)
    const m = Math.floor(s.length / 2)
    const k = new KB(2, 'candy').put('start', s[0]).run('free', s.slice(1, m - 1)).run('player', s.slice(m - 1, m + 2)).run('free', s.slice(m + 2, -1)).put('target', s[s.length - 1])
    L.push(k.build())
  }
  // 3 轉彎彎
  {
    const s = new Path(-3.5, -2, 0).fwd(1.5).turn(-90, 2).fwd(1.5).sample(0.7)
    const k = new KB(3, 'camp').put('start', s[0]).run('free', s.slice(1, 3)).run('player', s.slice(3, -3)).run('free', s.slice(-3, -1)).put('target', s[s.length - 1])
    L.push(k.build())
  }
  // 4 大大的 U
  {
    const s = new Path(-3, -1.8, 0).fwd(2.5).turn(-180, 1.8).fwd(2.5).sample(0.72)
    const n = s.length
    const k = new KB(4, 'town').put('start', s[0]).run('player', s.slice(1, 4)).run('free', s.slice(4, n - 4)).run('player', s.slice(n - 4, -1)).put('target', s[n - 1])
    L.push(k.build())
  }
  // 5 彎彎的蛇
  {
    const s = new Path(-5, 0.8, 0).fwd(0.6).turn(60, 1.8).turn(-120, 1.8).turn(60, 1.8).fwd(0.6).sample(0.7)
    const n = s.length
    const k = new KB(5, 'village').put('start', s[0])
    s.slice(1, -1).forEach((p, i) => k.put(i % 3 === 1 ? 'player' : 'free', p))
    k.put('target', s[n - 1])
    L.push(k.build())
  }
  // 6 兩個目標（分岔）
  {
    const stem = new Path(-4.5, 0, 0).fwd(3).sample(0.72)
    const f = stem[stem.length - 1]
    const up = new Path(f.x + 0.68, -0.3, 0).turn(45, 2.2).fwd(1.4).sample(0.7)
    const dn = new Path(f.x + 0.68, 0.3, 0).turn(-45, 2.2).fwd(1.4).sample(0.7)
    const k = new KB(6, 'candy').put('start', stem[0]).run('free', stem.slice(1, 3)).run('player', stem.slice(3))
    k.run('player', up.slice(0, 2)).run('free', up.slice(2, -1)).put('target', up[up.length - 1])
    k.run('player', dn.slice(0, 2)).run('free', dn.slice(2, -1)).put('target', dn[dn.length - 1])
    L.push(k.build())
  }
  // 7 爬上台階
  {
    const k = new KB(7, 'camp')
    k.b.platform(0, -1.2, 4.5, 1.2, 0.3, 'light')
    const low = line(-4, -0.45, 0, 0.72)
    const high = line(0.35, 4, 0, 0.72)
    k.put('start', low[0]).run('free', low.slice(1, -2)).run('player', low.slice(-2))
    k.run('player', high.slice(0, 2), 0.3).run('free', high.slice(2, -1), 0.3).put('target', high[high.length - 1], 0.3)
    L.push(k.build())
  }
  // 8 彈珠溜滑梯
  {
    const k = new KB(8, 'town')
    k.b.platform(-6.5, -1, -1, 1, 1.0, 'green')
    const top = line(-6, -1.85, 0, 0.7)
    k.put('start', top[0], 1).run('free', top.slice(1, 3), 1).run('player', top.slice(3), 1)
    k.b.piece({ type: 'ball', x: -1.22, y: 1.24, z: 0, r: 0.24 })
    k.b.ramp(-1, 0.94, 2.6, 0, 0)
    const row = line(3.4, 6.2, 0, 0.7)
    k.run('free', row.slice(0, -1)).put('target', row[row.length - 1])
    L.push(k.build())
  }
  // 9 推倒積木塔
  {
    const k = new KB(9, 'space')
    const s = line(-4, 0.3, 0, 0.72)
    k.put('start', s[0]).run('free', s.slice(1, 2)).run('player', s.slice(2))
    k.b.d('free', { x: 1.15, z: 0, a: 0 }, 0, 'l')
    const tones = ['blue', 'red', 'green'] as const
    for (let i = 0; i < 3; i++) k.b.piece({ type: 'block', x: 2.13, y: 0.25 + i * 0.5, z: 0, sx: 0.36, sy: 0.5, sz: 0.5, tone: tones[i], target: i === 2 })
    L.push(k.build())
  }
  // 10 繞圈圈
  {
    const s = new Path(-1, 2.6, 0).turn(90, 2.4).turn(90, 2.4).turn(90, 2.4).fwd(1.2).sample(0.72)
    const n = s.length
    const k = new KB(10, 'candy').put('start', s[0])
    s.slice(1, -1).forEach((p, i) => k.put(i % 2 ? 'player' : 'free', p))
    k.put('target', s[n - 1])
    L.push(k.build())
  }
  // 11 旋轉槓桿
  {
    const k = new KB(11, 'town')
    k.b.piece({ type: 'lever', x: 0, z: 0, len: 2.4, a: Math.PI / 2, h: 0.7 })
    const A = line(-4.5, -0.55, -0.9, 0.72)
    const B = line(-0.32, -4.5, 0.9, 0.72)
    k.put('start', A[0]).run('free', A.slice(1, 2)).run('player', A.slice(2))
    k.run('player', B.slice(0, 2)).run('free', B.slice(2, -1)).put('target', B[B.length - 1])
    L.push(k.build())
  }
  // 12 彩虹大結局：S 形加積木塔
  {
    const k = new KB(12, 'village')
    const s = new Path(-6, 1.2, 0).fwd(1).turn(-70, 2).turn(70, 2).fwd(2).sample(0.72)
    const e = s[s.length - 1]
    k.put('start', s[0])
    s.slice(1).forEach((p, i) => k.put(i % 2 ? 'player' : 'free', p))
    k.b.d('free', { x: e.x + 0.85, z: e.z, a: 0 }, 0, 'l')
    const tones = ['purple', 'red', 'green'] as const
    for (let i = 0; i < 3; i++) k.b.piece({ type: 'block', x: e.x + 1.83, y: 0.25 + i * 0.5, z: e.z, sx: 0.36, sy: 0.5, sz: 0.5, tone: tones[i], target: i === 2 })
    L.push(k.build())
  }
  return L
}

let cache: Level[] | null = null
export function kidLevel(no: number): Level | undefined {
  cache ??= kidLevels()
  return cache.find((l) => l.no === no)
}
export function kidLevelCount(): number {
  cache ??= kidLevels()
  return cache.length
}
