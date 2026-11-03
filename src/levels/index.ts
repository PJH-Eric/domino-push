import type { Level } from '../core/types'
import { chapter1 } from './ch1'
import { chapter2 } from './ch2'
import { chapter3 } from './ch3'
import { chapter4 } from './ch4'
import { chapter5 } from './ch5'

let cache: Level[] | null = null

/** 全部手設關卡（30 關，依序解鎖） */
export function allLevels(): Level[] {
  if (!cache) cache = [...chapter1(), ...chapter2(), ...chapter3(), ...chapter4(), ...chapter5()]
  return cache
}

export function levelByNo(no: number): Level | undefined {
  return allLevels().find((l) => l.no === no)
}
