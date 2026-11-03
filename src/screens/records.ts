import type { App, Screen } from '../app'
import { audio } from '../audio/engine'
import { allLevels } from '../levels'
import { loadProgress, totalStars } from '../storage/progress'
import { achievementStatus, loadStats, recheck } from '../storage/records'
import { t, type Key } from '../i18n'
import { h } from '../ui/dom'
import { icon } from '../ui/icons'
import { ScrollArea, Segmented } from '../ui/kit'
import { backButton, screenEl } from './common'

/** 紀錄與成就（只存在本機） */
export function recordsScreen(app: App, tab0 = 0): Screen {
  const el = screenEl('levels records')
  let tab = tab0
  recheck()
  const render = () => {
    const s = loadStats()
    const p = loadProgress()
    const lv = allLevels()
    const three = lv.filter((l) => (p.levels[l.id]?.stars ?? 0) >= 3).length
    const ach = achievementStatus()
    const got = ach.filter((x) => x.at).length
    let content: HTMLElement
    if (tab === 0) {
      const stat = (k: Key, v: string | number) => h('div', { class: 'stat' }, h('b', { text: String(v) }), h('span', { text: t(k) }))
      content = h('div', { class: 'records-card', attrs: { 'data-result-share': '' } },
        h('h3', { class: 'panel-title', text: t('rec.challenge') }),
        h('div', { class: 'stat-grid' },
          stat('rec.cleared', `${Object.keys(p.levels).length} / ${lv.length}`),
          stat('rec.stars', `${totalStars(p)} / ${lv.length * 3}`),
          stat('rec.threeStar', three),
          stat('rec.randomWins', s.randomWins),
        ),
        h('h3', { class: 'panel-title', text: t('rec.dominoes') }),
        h('div', { class: 'stat-grid' },
          stat('rec.pushes', s.pushes),
          stat('rec.totalFallen', s.totalFallen),
          stat('rec.bestRun', s.bestRun),
          stat('rec.bestCombo', s.bestCombo),
          stat('rec.placed', s.placed),
        ),
        h('h3', { class: 'panel-title', text: t('home.sandbox') }),
        h('div', { class: 'stat-grid' },
          stat('rec.sbBest', s.sandboxBest),
          stat('rec.sbRuns', s.sandboxRuns),
          stat('rec.sbBestFallen', s.sandboxBestFallen),
          stat('rec.achievements', `${got} / ${ach.length}`),
        ),
        h('p', { class: 'field-hint', text: t('rec.local') }),
      )
    } else {
      content = h('div', { class: 'ach-list' },
        h('p', { class: 'field-hint', text: t('rec.achCount', { n: got, m: ach.length }) }),
        ...ach.map(({ a, at, v, goal }) => h('div', { class: `ach${at ? ' got' : ''}` },
          h('div', { class: 'ach-ico' }, icon(at ? a.icon : 'lock')),
          h('div', { class: 'ach-text' },
            h('b', { text: t((`ach.${a.id}`) as Key) }),
            h('span', { text: t((`ach.${a.id}.d`) as Key) }),
            at ? h('span', { class: 'ach-date', text: t('rec.unlockedAt', { d: new Date(at).toLocaleDateString(document.documentElement.lang || undefined) }) })
              : goal > 1 ? h('div', { class: 'ach-bar', attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': v, 'aria-label': t((`ach.${a.id}`) as Key) } }, h('i', { style: `width:${(v / goal) * 100}%` }), h('em', { text: `${v} / ${goal}` })) : null,
          ),
        )),
      )
    }
    el.replaceChildren(
      h('div', { class: 'topleft' }, backButton(t('common.home'), () => app.go({ to: 'home' }))),
      h('div', { class: 'panel levels-panel' },
        h('div', { class: 'levels-head' }, h('h2', { text: t('rec.title') })),
        Segmented({ value: tab, options: [{ value: 0, label: t('rec.tabStats'), icon: 'target' }, { value: 1, label: t('rec.tabAch'), icon: 'star' }], onChange: (v) => { tab = v; audio.click(); render() } }),
        ScrollArea({ class: 'levels-scroll', label: t('rec.title') }, content).el,
      ),
    )
  }
  render()
  return { name: 'records', el, relabel: render, onBack() { app.go({ to: 'home' }); return true }, onKey(e) { if (e.key === 'Escape') { app.go({ to: 'home' }); return true } return false }, dispose() {} }
}
