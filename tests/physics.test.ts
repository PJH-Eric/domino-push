import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, expect, test } from 'vitest'
import { simulate } from '../src/physics/sim'
import type { DominoSpec } from '../src/core/types'

beforeAll(async () => { await RAPIER.init() })

function row(n: number, gap: number): DominoSpec[] {
  const ds: DominoSpec[] = Array.from({ length: n }, (_, i) => ({ x: i * gap, z: 0, a: 0, kind: 'fixed' }))
  ds[0].kind = 'start'
  ds[n - 1].kind = 'target'
  return ds
}

test.each([0.55, 0.62, 0.75, 0.9])('一排骨牌間距 %s 會全部連鎖倒下', (gap) => {
  const r = simulate(RAPIER, { dominoes: row(15, gap), pieces: [] }, [])
  expect(r.win).toBe(true)
  expect(r.fallen).toBe(15)
})

test('間距超過骨牌高度就碰不到下一張', () => {
  const r = simulate(RAPIER, { dominoes: row(6, 1.4), pieces: [] }, [])
  expect(r.win).toBe(false)
  expect(r.fallen).toBe(1)
})

test('同樣的擺放模擬兩次結果相同（可重現）', () => {
  const a = simulate(RAPIER, { dominoes: row(12, 0.7), pieces: [] }, [])
  const b = simulate(RAPIER, { dominoes: row(12, 0.7), pieces: [] }, [])
  expect(a).toEqual(b)
})
