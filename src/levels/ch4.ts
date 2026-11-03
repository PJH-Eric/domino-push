import type { BlockPiece, Level } from '../core/types'
import { LB, Path, type PathPoint } from './builder'

function line(x0: number, x1: number, z: number, gap: number): PathPoint[] {
  return new Path(x0, z, x1 >= x0 ? 0 : 180).fwd(Math.abs(x1 - x0)).sample(gap)
}

/** 積木塔：n 層細長方塊（沿 a 方向薄），最上面是金色目標 */
function tower(b: LB, x: number, z: number, n: number, base = 0, a = 0, h = 0.5): void {
  const tones: BlockPiece['tone'][] = ['blue', 'red', 'green', 'purple']
  for (let i = 0; i < n; i++) {
    b.piece({ type: 'block', x, y: base + h / 2 + i * h, z, sx: 0.36, sy: h, sz: 0.5, a, tone: tones[i % 4], target: i === n - 1 })
  }
}

/** 從鏈尾 e 往前放一張大骨牌，再往前放塔；回傳塔的位置 */
function bigAndTower(b: LB, e: PathPoint, n: number, base = 0): { x: number; z: number } {
  const dx = Math.cos(e.a), dz = -Math.sin(e.a)
  b.d('fixed', { x: e.x + dx * 0.85, z: e.z + dz * 0.85, a: e.a }, base, 'l')
  const t = { x: e.x + dx * 1.83, z: e.z + dz * 1.83 }
  tower(b, t.x, t.z, n, base, e.a)
  return t
}

/** 第四章：太空站（積木塔、積木牆） */
export function chapter4(): Level[] {
  const L: Level[] = []

  // 19 推倒積木塔
  {
    const b = new LB(19, 'space', 'hint.19')
    const s = line(-6, 0.3, 0, 0.72)
    b.d('start', s[0]).run('fixed', s.slice(1, 3)).run('player', s.slice(3))
    bigAndTower(b, s[s.length - 1], 3)
    b.zoneAround(s.slice(3), 0.7)
    L.push(b.build())
  }
  // 20 積木牆：撞掉上排的金色積木
  {
    const b = new LB(20, 'space', 'hint.20')
    const s = new Path(-6, 2, 0).fwd(2).turn(45, 2).turn(-45, 2).fwd(1.6).sample(0.72)
    const e = s[s.length - 1]
    b.d('start', s[0]).run('fixed', s.slice(1, 3)).run('player', s.slice(3)).d('fixed', { x: e.x + 0.85, z: e.z, a: 0 }, 0, 'l')
    const wx = e.x + 1.85
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 4; k++) {
        const z = e.z - 0.78 + k * 0.52
        b.piece({ type: 'block', x: wx, y: 0.25 + row * 0.5, z, sx: 0.3, sy: 0.5, sz: 0.5, tone: row ? 'yellow' : 'blue', target: row === 1 && (k === 1 || k === 2) })
      }
    }
    b.zoneAround(s.slice(3), 0.7)
    L.push(b.build())
  }
  // 21 兩座塔：分岔各推一座
  {
    const b = new LB(21, 'space', 'hint.21')
    const stem = new Path(-6, 0, 0).fwd(3).sample(0.72)
    const f = stem[stem.length - 1]
    const up = new Path(f.x + 0.68, -0.3, 0).turn(40, 2.4).turn(-40, 2.4).fwd(1).sample(0.7)
    const dn = new Path(f.x + 0.68, 0.3, 0).turn(-40, 2.4).turn(40, 2.4).fwd(1).sample(0.7)
    const eu = up[up.length - 1], ed = dn[dn.length - 1]
    b.d('start', stem[0]).run('fixed', stem.slice(1, 2)).run('player', stem.slice(2))
    b.run('player', up.slice(0, 3)).run('fixed', up.slice(3))
    b.run('player', dn.slice(0, 3)).run('fixed', dn.slice(3))
    bigAndTower(b, eu, 3)
    bigAndTower(b, ed, 3)
    b.zoneAround([...stem.slice(2), ...up.slice(0, 3), ...dn.slice(0, 3)], 0.6)
    L.push(b.build())
  }
  // 22 高台上的塔：爬上平台去推
  {
    const b = new LB(22, 'space', 'hint.22')
    b.platform(0, -1.5, 5, 1.5, 0.3, 'blue')
    const low = new Path(-6.5, -2.5, 0).fwd(1).turn(-60, 2).turn(60, 2).fwd(1.586).sample(0.72)
    const e = low[low.length - 1]
    const high = line(0.35, 2.4, e.z, 0.68)
    b.d('start', low[0]).run('fixed', low.slice(1, 3)).run('player', low.slice(3))
    b.run('player', high.slice(0, 2), 0.3).run('fixed', high.slice(2), 0.3)
    bigAndTower(b, high[high.length - 1], 3, 0.3)
    b.zoneAround(low.slice(3), 0.65).zoneAround(high.slice(0, 2), 0.6, 0.3)
    L.push(b.build())
  }
  // 23 槓桿掃塔：橫桿另一端掃到矮塔的金積木
  {
    const b = new LB(23, 'space', 'hint.23')
    b.piece({ type: 'lever', x: 0.5, z: 0, len: 2.4, a: Math.PI / 2, h: 0.7 })
    const A = new Path(-6, -1.93, 0).fwd(1).turn(-40, 2.2).turn(40, 2.2).fwd(2.122).sample(0.72)
    const e = A[A.length - 1]
    void e
    b.d('start', A[0]).run('fixed', A.slice(1, 3)).run('player', A.slice(3))
    tower(b, 0.16, 0.9, 2, 0, 0, 0.45)
    b.zoneAround(A.slice(3), 0.65)
    L.push(b.build())
  }
  // 24 太空大連鎖：彈珠＋塔＋目標骨牌
  {
    const b = new LB(24, 'space', 'hint.24')
    b.platform(-8, -3, -4, -1, 1.0, 'blue')
    const top = line(-7.6, -4.85, -2, 0.7)
    b.d('start', top[0], 1).run('player', top.slice(1), 1)
    b.piece({ type: 'ball', x: -4, y: 1.24, z: -2, r: 0.24 })
    b.ramp(-4, 0.9, -1.2, 0, -2)
    const g = new Path(-0.4, -2, 0).fwd(1.4).turn(-90, 1.6).fwd(0.6).sample(0.7)
    b.run('fixed', g.slice(0, 2)).run('player', g.slice(2))
    const e = g[g.length - 1]
    const stem = new Path(e.x, e.z + 0.72, -90).fwd(0.8).sample(0.72)
    const f = stem[stem.length - 1]
    const l = new Path(f.x - 0.3, f.z + 0.68, -90).turn(-45, 2).fwd(1.2).sample(0.7)
    const r = new Path(f.x + 0.3, f.z + 0.68, -90).turn(45, 2).fwd(1.6).sample(0.7)
    const el = l[l.length - 1]
    b.run('player', stem).run('player', l.slice(0, 2)).run('fixed', l.slice(2))
    bigAndTower(b, el, 3)
    b.run('player', r.slice(0, 2)).run('fixed', r.slice(2, -1)).d('target', r[r.length - 1])
    b.zoneAround(top.slice(1), 0.6, 1).zoneAround([...g.slice(2), ...stem, ...l.slice(0, 2), ...r.slice(0, 2)], 0.6)
    L.push(b.build())
  }
  return L
}
