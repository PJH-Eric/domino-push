import { describe, expect, test } from 'vitest'
import { sandboxScore } from '../src/storage/records'
import { starsFor } from '../src/core/rules'

describe('沙盒分數', () => {
  test('依倒下數、連倒、顏色與時間加總', () => {
    const r = sandboxScore({ fallen: 10, combo: 8, colors: 2, time: 3.25, allFell: false, total: 12 })
    expect(r.total).toBe(100 + 40 + 40 + 32)
  })
  test('20 張以上全部倒下有獎勵', () => {
    const a = sandboxScore({ fallen: 20, combo: 20, colors: 1, time: 4, allFell: true, total: 20 })
    const b = sandboxScore({ fallen: 20, combo: 20, colors: 1, time: 4, allFell: false, total: 21 })
    expect(a.total - b.total).toBe(120)
  })
  test('不到 20 張全倒沒有獎勵', () => {
    const r = sandboxScore({ fallen: 5, combo: 5, colors: 1, time: 1, allFell: true, total: 5 })
    expect(r.lines.find(([k]) => k === 'allFell')).toBeUndefined()
  })
})

describe('星等', () => {
  test('門檻含等於', () => {
    const lv = { star3: 9, star2: 13 }
    expect(starsFor(lv, 9)).toBe(3)
    expect(starsFor(lv, 10)).toBe(2)
    expect(starsFor(lv, 13)).toBe(2)
    expect(starsFor(lv, 14)).toBe(1)
  })
})
