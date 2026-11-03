import type { Level } from '../core/types'
import { LB, Path, type PathPoint } from './builder'

function line(x0: number, x1: number, z: number, gap: number): PathPoint[] {
  return new Path(x0, z, 0).fwd(x1 - x0).sample(gap)
}

/** 第二章：營地（台階、樓梯、平台、斜坡與彈珠） */
export function chapter2(): Level[] {
  const L: Level[] = []

  // 7 上台階：地面接到 0.3 高的平台
  {
    const b = new LB(7, 'camp', 'hint.7')
    b.platform(0, -1.2, 5.5, 1.2, 0.3, 'light')
    const low = line(-5, -0.45, 0, 0.72)
    const high = line(0.35, 5, 0, 0.72)
    b.d('start', low[0]).run('player', low.slice(1))
    b.run('player', high.slice(0, 3), 0.3).run('fixed', high.slice(3, -1), 0.3).d('target', high[high.length - 1], 0.3)
    b.zoneAround(low.slice(1), 0.75).zoneAround(high.slice(0, 3), 0.75, 0.3)
    L.push(b.build())
  }
  // 8 下樓梯：三階往下
  {
    const b = new LB(8, 'camp', 'hint.8')
    const steps = [0.9, 0.6, 0.3]
    steps.forEach((h, i) => b.platform(-3 + i * 1.6, -1, -1.4 + i * 1.6, 1, h, i % 2 ? 'light' : 'green'))
    const top = line(-6, -3.25, 0, 0.7)
    b.platform(-6.6, -1, -3, 1, 0.9, 'green')
    b.d('start', top[0], 0.9).run('fixed', top.slice(1), 0.9)
    const s1 = line(-2.75, -1.6, 0, 0.55), s2 = line(-1.15, 0, 0, 0.55), s3 = line(0.45, 1.6, 0, 0.55)
    b.run('player', s1, 0.9)
    b.run('player', s2, 0.6).run('player', s3, 0.3)
    const ground = line(2.05, 5.5, 0, 0.7)
    b.run('player', ground.slice(0, 2)).run('fixed', ground.slice(2, -1)).d('target', ground[ground.length - 1])
    b.zoneAround(s1, 0.6, 0.9).zoneAround(s2, 0.6, 0.6).zoneAround(s3, 0.6, 0.3).zoneAround(ground.slice(0, 2), 0.6)
    L.push(b.build())
  }
  // 9 彈珠滑梯：推骨牌撞彈珠，彈珠滾下斜坡撞倒目標
  {
    const b = new LB(9, 'camp', 'hint.9')
    b.platform(-6.5, -1, -1, 1, 1.0, 'green')
    const top = line(-6, -1.85, 0, 0.7)
    b.d('start', top[0], 1).run('fixed', top.slice(1, 2), 1).run('player', top.slice(2), 1)
    b.piece({ type: 'ball', x: -1.22, y: 1.0 + 0.24, z: 0, r: 0.24 })
    b.ramp(-1, 0.94, 2.6, 0, 0)
    const row = line(3.4, 6.2, 0, 0.7)
    b.run('fixed', row.slice(0, -1)).d('target', row[row.length - 1])
    b.zoneAround(top.slice(2), 0.6, 1)
    L.push(b.build())
  }
  // 10 高台跳下：平台邊緣的骨牌倒下去撞地面那排
  {
    const b = new LB(10, 'camp', 'hint.10')
    b.platform(-6.5, -1, -0.5, 1, 0.8, 'green')
    const top = line(-6, -0.64, 0, 0.75)
    b.d('start', top[0], 0.8).run('fixed', top.slice(1, -3), 0.8).run('player', top.slice(-3), 0.8)
    const g = line(0.05, 5.5, 0, 0.72)
    b.run('player', g.slice(0, 3)).run('fixed', g.slice(3, -1)).d('target', g[g.length - 1])
    b.zoneAround(top.slice(-3), 0.55, 0.8).zoneAround(g.slice(0, 3), 0.7)
    L.push(b.build())
  }
  // 11 小木橋：爬上去再下來
  {
    const b = new LB(11, 'camp', 'hint.11')
    b.platform(-1.2, -1, 2.2, 1, 0.3, 'light')
    const p = new Path(-7, -0.6, 0).fwd(1).turn(-30, 2).turn(30, 2).fwd(0.4)
    const a = p.sample(0.72)
    const end = a[a.length - 1]
    const up = line(end.x + 0.72, -1.6, end.z, 0.72)
    const on = line(-0.85, 1.85, end.z, 0.68)
    const dn = line(2.65, 6, end.z, 0.72)
    b.d('start', a[0]).run('fixed', a.slice(1, 4)).run('player', a.slice(4)).run('player', up)
    b.run('player', on, 0.3).run('player', dn.slice(0, 2)).run('fixed', dn.slice(2, -1)).d('target', dn[dn.length - 1])
    b.zoneAround([...a.slice(4), ...up], 0.7).zoneAround(on, 0.55, 0.3).zoneAround(dn.slice(0, 2), 0.6)
    L.push(b.build())
  }
  // 12 營火接力：高台→彈珠→斜坡→地面→上台階
  {
    const b = new LB(12, 'camp', 'hint.12')
    b.platform(-7, -3.2, -2.5, -1.2, 1.0, 'green')
    const top = line(-6.6, -3.35, -2.2, 0.7)
    b.d('start', top[0], 1).run('player', top.slice(1), 1)
    b.piece({ type: 'ball', x: -2.72, y: 1.24, z: -2.2, r: 0.24 })
    b.ramp(-2.5, 0.94, 0.6, 0, -2.2)
    const g = new Path(1.4, -2.2, 0).fwd(1.4).turn(-90, 1.5).fwd(1.2).turn(90, 1.5).fwd(0.6).sample(0.7)
    b.run('fixed', g.slice(0, 2)).run('player', g.slice(2))
    const last = g[g.length - 1]
    b.platform(last.x + 0.4, last.z - 1, last.x + 4.6, last.z + 1, 0.3, 'light')
    const hi = line(last.x + 0.8, last.x + 4, last.z, 0.72)
    b.run('fixed', hi.slice(0, -1), 0.3).d('target', hi[hi.length - 1], 0.3)
    b.zoneAround(top.slice(1), 0.6, 1).zoneAround(g.slice(2), 0.7)
    L.push(b.build())
  }
  return L
}
