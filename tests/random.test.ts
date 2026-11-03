import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, expect, test } from 'vitest'
import { canPlace } from '../src/core/rules'
import { generateRandom } from '../src/levels/random'
import { simulate } from '../src/physics/sim'

beforeAll(async () => { await RAPIER.init() })

const SEEDS = [1, 2, 3, 42, 777, 2024, 123456, 654321, 999999, 31337, 8080, 5150]

test('同一個種子產生完全相同的關卡', () => {
  expect(JSON.stringify(generateRandom(123456))).toBe(JSON.stringify(generateRandom(123456)))
})

test.each(SEEDS)('種子 %i：標準解合法且能過關、空擺不能過', (seed) => {
  const lv = generateRandom(seed)
  lv.solution.forEach((d, i) => expect(canPlace(d, [...lv.dominoes, ...lv.solution.slice(0, i)], lv.zones, lv.pieces), JSON.stringify(d)).toBeNull())
  expect(simulate(RAPIER, lv, lv.solution).win).toBe(true)
  expect(simulate(RAPIER, lv, []).win).toBe(false)
  expect(lv.star3).toBeLessThan(lv.star2)
  expect(lv.star2).toBeLessThan(lv.limit)
})

test('不同種子會產生不同關卡', () => {
  const a = new Set(SEEDS.map((s) => JSON.stringify(generateRandom(s).dominoes)))
  expect(a.size).toBeGreaterThan(SEEDS.length - 2)
})
