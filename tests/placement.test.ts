import { describe, expect, test } from 'vitest'
import { Placement } from '../src/game/placement'
import { levelByNo } from '../src/levels'

function fresh(limit = 5) {
  const lv = levelByNo(1)!
  return { lv, pl: new Placement({ base: lv.dominoes, zones: lv.zones, pieces: lv.pieces, kind: 'player', limit }) }
}

describe('擺放', () => {
  test('擺放區外不能放，區內可以放', () => {
    const { lv, pl } = fresh()
    pl.moveGhost(lv.zones[0].x, lv.zones[0].z + 10)
    expect(pl.commit()).toEqual({ ok: false, reason: 'outside' })
    pl.moveGhost(lv.solution[0].x, lv.solution[0].z)
    expect(pl.commit().ok).toBe(true)
    expect(pl.used).toBe(1)
  })
  test('不能和別的骨牌重疊', () => {
    const { lv, pl } = fresh()
    pl.moveGhost(lv.solution[0].x, lv.solution[0].z)
    pl.commit()
    pl.moveGhost(lv.solution[0].x + 0.05, lv.solution[0].z)
    expect(pl.commit()).toEqual({ ok: false, reason: 'overlap' })
  })
  test('達到上限就不能再放', () => {
    const { lv, pl } = fresh(2)
    for (const d of lv.solution.slice(0, 2)) { pl.moveGhost(d.x, d.z); expect(pl.commit().ok).toBe(true) }
    pl.moveGhost(lv.solution[4].x, lv.solution[4].z)
    expect(pl.commit()).toEqual({ ok: false, reason: 'limit' })
  })
  test('復原與重做會還原狀態，新動作會清掉重做', () => {
    const { lv, pl } = fresh()
    for (const d of lv.solution.slice(0, 3)) { pl.moveGhost(d.x, d.z); pl.commit() }
    pl.selected = 1
    pl.removeSelected()
    expect(pl.used).toBe(2)
    pl.undo()
    expect(pl.placed.map((d) => d.x)).toEqual(lv.solution.slice(0, 3).map((d) => d.x))
    pl.undo()
    expect(pl.used).toBe(2)
    expect(pl.canRedo).toBe(true)
    pl.redo()
    expect(pl.used).toBe(3)
    pl.clear()
    expect(pl.used).toBe(0)
    pl.undo()
    expect(pl.used).toBe(3)
    pl.moveGhost(lv.solution[5].x, lv.solution[5].z)
    pl.commit()
    expect(pl.canRedo).toBe(false)
  })
  test('自動對準：預覽會朝向前一張骨牌的延長線', () => {
    const { lv, pl } = fresh()
    const s = lv.dominoes[0]
    pl.moveGhost(s.x + 0.7, s.z)
    expect(Math.abs(pl.ghost!.a)).toBeLessThan(0.01)
  })
  test('旋轉被擋住時不改變', () => {
    const { lv, pl } = fresh()
    pl.moveGhost(lv.solution[0].x, lv.solution[0].z)
    pl.commit()
    pl.moveGhost(lv.solution[1].x, lv.solution[1].z)
    pl.commit()
    pl.selected = 0
    const before = pl.placed[0].a
    const r = pl.rotate(90)
    if (!r.ok) expect(pl.placed[0].a).toBe(before)
  })
})
