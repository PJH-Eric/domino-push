import type { BlockPiece, Level } from '../core/types'
import { LB, Path, type PathPoint } from './builder'

function line(x0: number, x1: number, z: number, gap: number): PathPoint[] {
  return new Path(x0, z, x1 >= x0 ? 0 : 180).fwd(Math.abs(x1 - x0)).sample(gap)
}

function bigAndTower(b: LB, e: PathPoint, n: number, base = 0): void {
  const dx = Math.cos(e.a), dz = -Math.sin(e.a)
  b.d('fixed', { x: e.x + dx * 0.85, z: e.z + dz * 0.85, a: e.a }, base, 'l')
  const tones: BlockPiece['tone'][] = ['purple', 'red', 'green', 'blue']
  for (let i = 0; i < n; i++) {
    b.piece({ type: 'block', x: e.x + dx * 1.83, y: base + 0.25 + i * 0.5, z: e.z + dz * 1.83, sx: 0.36, sy: 0.5, sz: 0.5, a: e.a, tone: tones[i % 4], target: i === n - 1 })
  }
}

/** 嚴格的星等門檻：最後一章少給一點餘裕 */
function tight(b: LB, n: number): LB {
  return b.limits({ star3: n, star2: n + Math.max(2, Math.ceil(n * 0.15)), limit: n + Math.max(5, Math.ceil(n * 0.4)) })
}

/** 第五章：糖果屋（綜合機關、精準間距、嚴格用量） */
export function chapter5(): Level[] {
  const L: Level[] = []

  // 25 糖果螺旋
  {
    const s = new Path(-5, 3.2, 0).fwd(3).turn(90, 3).turn(90, 2.4).turn(90, 1.9).turn(70, 1.5).sample(0.7)
    const n = s.length
    const a = Math.floor(n * 0.3), c = Math.floor(n * 0.55), d = Math.floor(n * 0.78)
    const b = new LB(25, 'candy', 'hint.25')
    b.d('start', s[0]).run('fixed', s.slice(1, a)).run('player', s.slice(a, c)).run('fixed', s.slice(c, d)).run('player', s.slice(d, -1)).d('target', s[n - 1])
    b.zoneAround(s.slice(a, c), 0.6).zoneAround(s.slice(d, -1), 0.6)
    L.push(tight(b, c - a + (n - 1 - d)).build())
  }
  // 26 三岔路：三個目標
  {
    const b = new LB(26, 'candy', 'hint.26')
    const stem = new Path(-7, 0, 0).fwd(2.8).sample(0.7)
    const f = stem[stem.length - 1]
    const up = new Path(f.x + 0.68, -0.3, 0).turn(55, 2.2).fwd(2.2).sample(0.7)
    const dn = new Path(f.x + 0.68, 0.3, 0).turn(-35, 2.4).turn(35, 2.4).fwd(0.8).sample(0.7)
    const g = dn[dn.length - 1]
    const u2 = new Path(g.x + 0.68, g.z - 0.3, 0).turn(40, 2.2).fwd(1.4).sample(0.7)
    const d2 = new Path(g.x + 0.68, g.z + 0.3, 0).turn(-40, 2.2).fwd(1.4).sample(0.7)
    b.d('start', stem[0]).run('fixed', stem.slice(1, 2)).run('player', stem.slice(2))
    b.run('player', up.slice(0, 2)).run('fixed', up.slice(2, -1)).d('target', up[up.length - 1])
    b.run('player', dn.slice(0, 2)).run('fixed', dn.slice(2, -2)).run('player', dn.slice(-2))
    b.run('player', u2.slice(0, 2)).run('fixed', u2.slice(2, -1)).d('target', u2[u2.length - 1])
    b.run('player', d2.slice(0, 2)).run('fixed', d2.slice(2, -1)).d('target', d2[d2.length - 1])
    b.zoneAround([...stem.slice(2), ...up.slice(0, 2), ...dn.slice(0, 2)], 0.6).zoneAround([...dn.slice(-2), ...u2.slice(0, 2), ...d2.slice(0, 2)], 0.6)
    L.push(tight(b, stem.length - 2 + 2 + 2 + 2 + 2 + 2).build())
  }
  // 27 糖果滑梯塔：彈珠→蹺蹺板→大骨牌→塔
  {
    const b = new LB(27, 'candy', 'hint.27')
    b.platform(-7.5, -1, -3.2, 1, 1.0, 'red')
    const top = line(-7, -4.05, 0, 0.7)
    b.d('start', top[0], 1).run('player', top.slice(1), 1)
    b.piece({ type: 'ball', x: -3.2, y: 1.24, z: 0, r: 0.24 })
    b.ramp(-3.2, 0.9, -0.5, 0.17, 0)
    b.piece({ type: 'seesaw', x: 1.1, z: 0, len: 3, a: 0, h: 0.35, tilt: -0.235 })
    const row = new Path(3.4, 0, 0).fwd(1.4).turn(70, 1.8).fwd(1.4).sample(0.7)
    b.run('fixed', row.slice(0, 2)).run('player', row.slice(2))
    bigAndTower(b, row[row.length - 1], 3)
    b.zoneAround(top.slice(1), 0.6, 1).zoneAround(row.slice(2), 0.7)
    L.push(tight(b, top.length - 1 + row.length - 2).build())
  }
  // 28 跳台＋槓桿＋上台階
  {
    const b = new LB(28, 'candy', 'hint.28')
    b.platform(-7.5, -2.4, -2.5, -0.4, 0.8, 'red')
    const top = line(-7, -2.64, -1.4, 0.73)
    b.d('start', top[0], 0.8).run('fixed', top.slice(1, -2), 0.8).run('player', top.slice(-2), 0.8)
    const g = line(-1.95, 1.45, -1.4, 0.71)
    b.run('player', g.slice(0, 3)).run('fixed', g.slice(3))
    b.piece({ type: 'lever', x: 2, z: -0.5, len: 2.4, a: Math.PI / 2, h: 0.7 })
    const C = new Path(1.68, 0.4, 180).fwd(1.2).turn(90, 1.4).fwd(0.6).sample(0.7)
    b.run('player', C.slice(0, 3)).run('fixed', C.slice(3))
    const e = C[C.length - 1]
    b.platform(e.x - 1, e.z + 0.4, e.x + 1, e.z + 4.4, 0.3, 'yellow')
    const hi = new Path(e.x, e.z + 0.8, -90).fwd(2.6).sample(0.7)
    b.run('fixed', hi.slice(0, -1), 0.3).d('target', hi[hi.length - 1], 0.3)
    b.zoneAround(top.slice(-2), 0.5, 0.8).zoneAround(g.slice(0, 3), 0.6).zoneAround(C.slice(0, 3), 0.6)
    L.push(tight(b, 2 + 3 + 3).build())
  }
  // 29 精準間距：一座座小島之間只差一張
  {
    const s = new Path(-6.5, 1.5, 0).fwd(3.5).turn(-120, 2.4).fwd(3).sample(0.8)
    const b = new LB(29, 'candy', 'hint.29')
    b.d('start', s[0])
    let sol = 0
    for (let i = 1; i < s.length - 1; i++) {
      if (i % 3 === 0) {
        b.d('player', s[i]).zoneAround([s[i]], 0.42)
        sol++
      } else b.d('fixed', s[i])
    }
    b.d('target', s[s.length - 1])
    L.push(b.limits({ star3: sol, star2: sol + 1, limit: sol + 3 }).build())
  }
  // 30 大結局
  {
    const b = new LB(30, 'candy', 'hint.30')
    b.platform(-8.4, -3.5, -4, -1.5, 1.0, 'red')
    const top = line(-8, -4.85, -2.5, 0.7)
    b.d('start', top[0], 1).run('fixed', top.slice(1, 2), 1).run('player', top.slice(2), 1)
    b.piece({ type: 'ball', x: -4, y: 1.24, z: -2.5, r: 0.24 })
    b.ramp(-4, 0.9, -1.2, 0, -2.5)
    const g = line(-0.4, 1.8, -2.5, 0.72)
    b.run('fixed', g.slice(0, 2)).run('player', g.slice(2))
    const f = g[g.length - 1]
    const up = new Path(f.x + 0.68, f.z - 0.3, 0).turn(40, 2.2).turn(-40, 2.2).fwd(0.9).sample(0.7)
    const dn = new Path(f.x + 0.68, f.z + 0.3, 0).turn(-70, 2).fwd(1.4).sample(0.7)
    const eu = up[up.length - 1]
    b.run('player', up.slice(0, 2)).run('fixed', up.slice(2))
    b.piece({ type: 'lever', x: eu.x + 0.55, z: eu.z + 0.75, len: 2.0, a: Math.PI / 2, h: 0.7 })
    const C = line(eu.x + 0.23, eu.x - 2.3, eu.z + 1.5, 0.75)
    b.run('fixed', C.slice(0, -1)).d('target', C[C.length - 1])
    b.run('player', dn.slice(0, 2)).run('fixed', dn.slice(2))
    bigAndTower(b, dn[dn.length - 1], 3)
    b.zoneAround(top.slice(2), 0.6, 1).zoneAround([...g.slice(2), ...up.slice(0, 2), ...dn.slice(0, 2)], 0.6)
    L.push(tight(b, top.length - 2 + g.length - 2 + 4).build())
  }
  return L
}
