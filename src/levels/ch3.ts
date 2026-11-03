import type { Level } from '../core/types'
import { LB, Path, type PathPoint } from './builder'

function line(x0: number, x1: number, z: number, gap: number): PathPoint[] {
  const p = new Path(x0, z, x1 >= x0 ? 0 : 180).fwd(Math.abs(x1 - x0)).sample(gap)
  return p
}

/** 第三章：小城（旋轉槓桿、蹺蹺板、彈珠） */
export function chapter3(): Level[] {
  const L: Level[] = []

  // 13 旋轉槓桿：撞橫桿一端，另一端掃倒反方向那排
  {
    const b = new LB(13, 'town', 'hint.13')
    b.piece({ type: 'lever', x: 0, z: 0, len: 2.4, a: Math.PI / 2, h: 0.7 })
    const A = line(-6, -0.55, -0.9, 0.72)
    const B = line(-0.32, -6, 0.9, 0.72)
    b.d('start', A[0]).run('fixed', A.slice(1, 3)).run('player', A.slice(3))
    b.run('player', B.slice(0, 3)).run('fixed', B.slice(3, -1)).d('target', B[B.length - 1])
    b.zoneAround(A.slice(3), 0.6).zoneAround(B.slice(0, 3), 0.6)
    L.push(b.build())
  }
  // 14 蹺蹺板橋：彈珠滾上蹺蹺板，過了支點就翻過去
  {
    const b = new LB(14, 'town', 'hint.14')
    b.platform(-7.5, -1, -3.2, 1, 1.0, 'blue')
    const top = line(-7, -4.05, 0, 0.7)
    b.d('start', top[0], 1).run('player', top.slice(1), 1)
    b.piece({ type: 'ball', x: -3.2, y: 1.24, z: 0, r: 0.24 })
    b.ramp(-3.2, 0.9, -0.5, 0.17, 0)
    b.piece({ type: 'seesaw', x: 1.1, z: 0, len: 3, a: 0, h: 0.35, tilt: -0.235 })
    const row = line(3.4, 6.4, 0, 0.7)
    b.run('fixed', row.slice(0, -1)).d('target', row[row.length - 1])
    b.zoneAround(top.slice(1), 0.6, 1)
    L.push(b.build())
  }
  // 15 兩支槓桿：U 形迴轉後再撞第二支
  {
    const b = new LB(15, 'town', 'hint.15')
    b.piece({ type: 'lever', x: -2, z: -1.5, len: 2.4, a: Math.PI / 2, h: 0.7 })
    b.piece({ type: 'lever', x: 2, z: 2.4, len: 2.4, a: Math.PI / 2, h: 0.7 })
    const A = line(-7, -2.55, -2.4, 0.72)
    const B = new Path(-2.32, -0.6, 180).fwd(0.8).turn(180, 1.05).fwd(4.55).sample(0.7)
    const C = line(1.68, -3, 3.3, 0.72)
    b.d('start', A[0]).run('fixed', A.slice(1, 4)).run('player', A.slice(4))
    b.run('player', B.slice(0, 3)).run('fixed', B.slice(3, -3)).run('player', B.slice(-3))
    b.run('player', C.slice(0, 3)).run('fixed', C.slice(3, -1)).d('target', C[C.length - 1])
    b.zoneAround(A.slice(4), 0.6).zoneAround(B.slice(0, 3), 0.6).zoneAround(B.slice(-3), 0.6).zoneAround(C.slice(0, 3), 0.6)
    L.push(b.build())
  }
  // 16 斜坡接槓桿
  {
    const b = new LB(16, 'town', 'hint.16')
    b.platform(-8.4, -2.5, -4, -0.5, 1.0, 'blue')
    const top = line(-8, -4.85, -1.5, 0.7)
    b.d('start', top[0], 1).run('fixed', top.slice(1, 2), 1).run('player', top.slice(2), 1)
    b.piece({ type: 'ball', x: -4, y: 1.24, z: -1.5, r: 0.24 })
    b.ramp(-4, 0.9, -1.2, 0, -1.5)
    const g = line(-0.4, 2.45, -1.5, 0.71)
    b.run('fixed', g)
    b.piece({ type: 'lever', x: 3, z: -0.6, len: 2.4, a: Math.PI / 2, h: 0.7 })
    const C = line(2.68, -3.6, 0.3, 0.72)
    b.run('player', C.slice(0, 4)).run('fixed', C.slice(4, -1)).d('target', C[C.length - 1])
    b.zoneAround(top.slice(2), 0.6, 1).zoneAround(C.slice(0, 4), 0.6)
    L.push(b.build())
  }
  // 17 蹺蹺板之後轉個彎
  {
    const b = new LB(17, 'town', 'hint.17')
    b.platform(-7.5, -1, -3.2, 1, 1.0, 'blue')
    const top = line(-7, -4.05, 0, 0.7)
    b.d('start', top[0], 1).run('player', top.slice(1), 1)
    b.piece({ type: 'ball', x: -3.2, y: 1.24, z: 0, r: 0.24 })
    b.ramp(-3.2, 0.9, -0.5, 0.17, 0)
    b.piece({ type: 'seesaw', x: 1.1, z: 0, len: 3, a: 0, h: 0.35, tilt: -0.235 })
    const p = new Path(3.4, 0, 0).fwd(1.5).turn(-100, 1.8).fwd(2.2).sample(0.7)
    b.run('fixed', p.slice(0, 3)).run('player', p.slice(3, -2)).run('fixed', p.slice(-2, -1)).d('target', p[p.length - 1])
    b.zoneAround(top.slice(1), 0.6, 1).zoneAround(p.slice(3, -2), 0.8)
    L.push(b.build())
  }
  // 18 三個目標：中途、分岔下面、槓桿回頭
  {
    const b = new LB(18, 'town', 'hint.18')
    const stem = new Path(-6.5, 0, 0).fwd(4.4).sample(0.73)
    const f = stem[stem.length - 1]
    const up = new Path(f.x + 0.68, f.z - 0.3, 0).turn(60, 2).turn(-60, 2).fwd(1.0).sample(0.7)
    const e = up[up.length - 1]
    const dn = new Path(f.x + 0.68, f.z + 0.3, 0).turn(-50, 2.2).fwd(2).sample(0.7)
    b.d('start', stem[0]).run('fixed', stem.slice(1, 3)).d('target', stem[3]).run('player', stem.slice(4))
    b.run('player', up.slice(0, 3)).run('fixed', up.slice(3))
    b.piece({ type: 'lever', x: e.x + 0.55, z: e.z + 0.75, len: 2.0, a: Math.PI / 2, h: 0.7 })
    const C = line(e.x + 0.55 - 0.32, e.x - 2.6, e.z + 1.5, 0.75)
    b.run('fixed', C.slice(0, -1)).d('target', C[C.length - 1])
    b.run('player', dn.slice(0, 3)).run('fixed', dn.slice(3, -1)).d('target', dn[dn.length - 1])
    b.zoneAround([...stem.slice(4), ...up.slice(0, 3), ...dn.slice(0, 3)], 0.6)
    L.push(b.build())
  }
  return L
}
