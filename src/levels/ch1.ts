import type { Level } from '../core/types'
import { LB, Path } from './builder'

/** 第一章：粉綠積木村（直線、補缺口、轉彎、分岔、繞牆、雙目標） */
export function chapter1(): Level[] {
  const L: Level[] = []

  // 1 第一排：直線補滿
  {
    const s = new Path(-3.5, 0, 0).fwd(7).sample(0.72)
    const b = new LB(1, 'village', 'hint.1')
    b.d('start', s[0]).run('player', s.slice(1, -1)).d('target', s[s.length - 1])
    b.zoneAround(s.slice(1, -1), 0.9)
    L.push(b.build())
  }
  // 2 接起來：兩個缺口
  {
    const s = new Path(-6, 0, 0).fwd(12).sample(0.75)
    const b = new LB(2, 'village', 'hint.2')
    b.d('start', s[0]).run('player', s.slice(1, 5)).run('fixed', s.slice(5, 11)).run('player', s.slice(11, 16)).d('target', s[16])
    b.zoneAround(s.slice(1, 5), 0.7).zoneAround(s.slice(11, 16), 0.7)
    L.push(b.build())
  }
  // 3 轉個彎
  {
    const s = new Path(-4, -2.5, 0).fwd(2.8).turn(-90, 2).fwd(2.8).sample(0.7)
    const b = new LB(3, 'village', 'hint.3')
    b.d('start', s[0]).run('fixed', s.slice(1, 4)).run('player', s.slice(4, -4)).run('fixed', s.slice(-4, -1)).d('target', s[s.length - 1])
    b.zoneAround(s.slice(4, -4), 0.9)
    L.push(b.build())
  }
  // 4 分岔路：一張推倒兩張
  {
    const stem = new Path(-5, 0, 0).fwd(3.6).sample(0.72)
    const f = stem[stem.length - 1]
    const up = new Path(f.x + 0.68, f.z - 0.3, 0).turn(50, 2.2).fwd(2.4).sample(0.7)
    const dn = new Path(f.x + 0.68, f.z + 0.3, 0).turn(-50, 2.2).fwd(2.4).sample(0.7)
    const b = new LB(4, 'village', 'hint.4')
    b.d('start', stem[0]).run('fixed', stem.slice(1, 3)).run('player', stem.slice(3))
    b.run('player', up.slice(0, 3)).run('fixed', up.slice(3, -1)).d('target', up[up.length - 1])
    b.run('player', dn.slice(0, 3)).run('fixed', dn.slice(3, -1)).d('target', dn[dn.length - 1])
    b.zoneAround([...stem.slice(3), ...up.slice(0, 3), ...dn.slice(0, 3)], 0.7)
    L.push(b.build())
  }
  // 5 繞過木牆
  {
    const p = new Path(-5, 0.6, 0).fwd(0.8).turn(80, 1.6).fwd(0.7).turn(-80, 1.6).fwd(1.4).turn(-80, 1.6).fwd(0.7).turn(80, 1.6).fwd(0.8)
    const s = p.sample(0.72)
    const b = new LB(5, 'village', 'hint.5')
    const mid = (s[0].x + s[s.length - 1].x) / 2
    b.wall(mid, 1.2, 0.5, 3.2, 1.3)
    b.d('start', s[0]).run('fixed', s.slice(1, 2)).run('player', s.slice(2, -2)).run('fixed', s.slice(-2, -1)).d('target', s[s.length - 1])
    b.zoneAround(s.slice(2, -2), 0.8)
    L.push(b.build())
  }
  // 6 雙目標：U 形路線，中途也有目標
  {
    const s = new Path(-4.5, -1.6, 0).fwd(4).turn(-180, 1.6).fwd(4).sample(0.72)
    const mid = Math.floor(s.length / 2)
    const b = new LB(6, 'village', 'hint.6')
    b.d('start', s[0]).run('player', s.slice(1, 5)).run('fixed', s.slice(5, mid)).d('target', s[mid]).run('fixed', s.slice(mid + 1, mid + 3))
    b.run('player', s.slice(mid + 3, -1)).d('target', s[s.length - 1])
    b.zoneAround(s.slice(1, 5), 0.7).zoneAround(s.slice(mid + 3, -1), 0.7)
    L.push(b.build())
  }
  return L
}
