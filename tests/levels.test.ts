import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, test } from 'vitest'
import { canPlace } from '../src/core/rules'
import { allLevels } from '../src/levels'
import { simulate } from '../src/physics/sim'

beforeAll(async () => { await RAPIER.init() })

describe.each(allLevels().map((l) => [l.no, l] as const))('第 %i 關', (_no, level) => {
  test('標準解在擺放區內、互不重疊、未超過上限且達三星', () => {
    const placed = level.solution
    placed.forEach((d, i) => {
      const err = canPlace(d, [...level.dominoes, ...placed.slice(0, i)], level.zones, level.pieces)
      expect(err, `第 ${i} 張 ${JSON.stringify(d)}`).toBeNull()
    })
    expect(placed.length).toBeLessThanOrEqual(level.star3)
    expect(level.star3).toBeLessThan(level.star2)
    expect(level.star2).toBeLessThan(level.limit)
  })
  test('標準解推下去能推倒全部目標', () => {
    const r = simulate(RAPIER, level, level.solution)
    expect(r, JSON.stringify(r)).toMatchObject({ win: true })
  })
  test('什麼都不擺不能過關', () => {
    expect(simulate(RAPIER, level, []).win).toBe(false)
  })
})
