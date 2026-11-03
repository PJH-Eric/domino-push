import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, test } from 'vitest'
import { canPlace } from '../src/core/rules'
import { kidLevels } from '../src/levels/kids'
import { simulate } from '../src/physics/sim'

beforeAll(async () => { await RAPIER.init() })

describe.each(kidLevels().map((l) => [l.no, l] as const))('幼兒園第 %i 關', (_no, lv) => {
  test('發光空位互不重疊、不碰機關', () => {
    expect(lv.solution.length).toBeGreaterThan(0)
    lv.solution.forEach((d, i) => expect(canPlace(d, [...lv.dominoes, ...lv.solution.slice(0, i)], null, lv.pieces), JSON.stringify(d)).toBeNull())
  })
  test('空位全部放好推下去一定成功', () => {
    expect(simulate(RAPIER, lv, lv.solution).win).toBe(true)
  })
  test('一張都不放不會成功', () => {
    expect(simulate(RAPIER, lv, []).win).toBe(false)
  })
})

test('彩虹秀整串都會倒並推倒積木塔', async () => {
  const { rainbowScene } = await import('../src/screens/kids')
  const sc = rainbowScene(200)
  const r = simulate(RAPIER, sc, [])
  expect(r.win).toBe(true)
  expect(r.fallen).toBeGreaterThan(sc.dominoes.length - 3)
})
