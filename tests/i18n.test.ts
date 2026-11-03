import { expect, test } from 'vitest'
import { en } from '../src/i18n/en'
import { zhCN } from '../src/i18n/zh-CN'
import { zh } from '../src/i18n/zh-TW'
import { ACHIEVEMENTS } from '../src/storage/records'
import { allLevels } from '../src/levels'

const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

test('三個語系的 key 完全相同、沒有空字串、插值變數一致', () => {
  const keys = Object.keys(zh)
  for (const d of [zhCN, en] as Record<string, string>[]) {
    expect(Object.keys(d).sort()).toEqual([...keys].sort())
    for (const k of keys) {
      expect(d[k], k).toBeTruthy()
      expect(vars(d[k]), k).toBe(vars((zh as Record<string, string>)[k]))
    }
  }
})

test('每一關與每個成就都有名稱與說明', () => {
  const z = zh as Record<string, string>
  for (const l of allLevels()) {
    expect(z[l.nameKey!], l.id).toBeTruthy()
    expect(z[l.hintKey!], l.id).toBeTruthy()
  }
  for (const a of ACHIEVEMENTS) {
    expect(z[`ach.${a.id}`], a.id).toBeTruthy()
    expect(z[`ach.${a.id}.d`], a.id).toBeTruthy()
  }
})
