import type { App, Screen } from '../app'
import { audio } from '../audio/engine'
import type { ThemeId } from '../core/types'
import { allLevels } from '../levels'
import { isUnlocked, loadProgress, totalStars } from '../storage/progress'
import { t, type Key } from '../i18n'
import { h } from '../ui/dom'
import { icon } from '../ui/icons'
import { Button, ScrollArea, Segmented, TextField, toast } from '../ui/kit'
import { backButton, screenEl, starsEl } from './common'

export const CHAPTERS: ThemeId[] = ['village', 'camp', 'town', 'space', 'candy']

export function randomSeed(): number {
  return Math.floor(Math.random() * 900000) + 100000
}

export function levelsScreen(app: App, chapter = 0): Screen {
  const el = screenEl('levels')
  let ch = chapter
  let seedText = String(randomSeed())
  const showBackdrop = () => {
    const first = allLevels().find((l) => l.theme === CHAPTERS[ch])
    if (!first) return
    app.stage.setTheme(first.theme)
    audio.setTheme(first.theme)
    app.stage.setLevel(first, [])
    app.stage.fitView(false, false)
  }
  showBackdrop()

  const render = () => {
    const prog = loadProgress()
    const lv = allLevels().filter((l) => l.theme === CHAPTERS[ch])
    const grid = h('div', { class: 'levels-grid' },
      lv.map((l) => {
        const rec = prog.levels[l.id]
        const open = isUnlocked(prog, l.no)
        const b = h('button', { class: 'lv', attrs: { type: 'button', 'aria-label': `${t('levels.levelN', { n: l.no })} ${t(l.nameKey as Key)}${open ? '' : ' ' + t('levels.locked')}` } },
          h('span', { class: 'lv-no', text: String(l.no) }),
          h('span', { class: 'lv-name', text: t(l.nameKey as Key) }),
          open ? starsEl(rec?.stars ?? 0) : h('span', { class: 'lv-lock' }, icon('lock'), t('levels.locked')),
        )
        b.disabled = !open
        b.addEventListener('click', () => { audio.click(); app.go({ to: 'game', level: l.no }) })
        return b
      }),
    )
    const seed = TextField({ label: t('levels.seed'), value: seedText, maxLength: 9, onInput: (v) => { seedText = v.replace(/\D/g, '') } })
    seed.input.setAttribute('inputmode', 'numeric')
    const rnd = h('div', { class: 'random-card' },
      h('h3', {}, icon('dice'), t('levels.random')),
      h('p', { text: t('levels.randomDesc') }),
      seed.el,
      Button({ icon: 'dice', ariaLabel: t('levels.newSeed'), title: t('levels.newSeed'), class: 'icon-btn', onClick: () => { seedText = String(randomSeed()); seed.input.value = seedText } }),
      Button({ label: t('levels.playRandom'), icon: 'play', variant: 'gold', onClick: () => {
        const n = Number(seedText)
        if (!Number.isInteger(n) || n <= 0) { toast(t('levels.badSeed'), 'warn'); return }
        audio.click()
        app.go({ to: 'random', seed: n })
      } }),
    )
    const scroll = ScrollArea({ class: 'levels-scroll', label: t('levels.title') }, grid, rnd)
    const tabs = Segmented({
      value: ch,
      options: CHAPTERS.map((c, i) => ({ value: i, label: `${i + 1}. ${t(('chapter.' + c) as Key)}` })),
      onChange: (v) => { ch = v; audio.click(); showBackdrop(); render() },
    })
    tabs.classList.add('chapter-tabs-field')
    el.replaceChildren(
      h('div', { class: 'topleft' }, backButton(t('common.home'), () => app.go({ to: 'home' }))),
      h('div', { class: 'panel levels-panel' },
        h('div', { class: 'levels-head' }, h('h2', { text: t('levels.title') }), h('span', { class: 'tag tag-warn' }, icon('star'), t('levels.totalStars', { n: totalStars(prog), max: allLevels().length * 3 }))),
        tabs,
        scroll.el,
      ),
    )
  }
  render()
  return {
    name: 'levels',
    el,
    relabel: render,
    onBack() { app.go({ to: 'home' }); return true },
    onKey(e) {
      if (e.key === 'Escape') { app.go({ to: 'home' }); return true }
      return false
    },
    dispose() {},
  }
}
