import type { Level } from '../core/types'
import { LB, Path } from './builder'

/** 隨機關（暫定版：直線缺口），M3 會換成完整生成器 */
export function generateRandom(seed: number): Level {
  const s = new Path(-4, 0, 0).fwd(8).sample(0.72)
  const b = new LB(0, 'village')
  b.d('start', s[0]).run('player', s.slice(1, -1)).d('target', s[s.length - 1])
  b.zoneAround(s.slice(1, -1), 0.8)
  const lv = b.build()
  return { ...lv, id: `R${seed}`, seed, nameKey: undefined }
}
