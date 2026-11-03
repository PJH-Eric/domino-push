import type { App, Route, Screen } from '../app'
import { t } from '../i18n'
import { h } from '../ui/dom'
import { icon, type IconName } from '../ui/icons'
import { KeyCap, ScrollArea } from '../ui/kit'
import { backButton, screenEl } from './common'

/** 怎麼玩：純文字圖示說明頁 */
export function howtoScreen(app: App, from: Route = { to: 'home' }): Screen {
  const el = screenEl('howto')
  const step = (ic: IconName, title: string, text: string, extra?: HTMLElement) =>
    h('section', { class: 'step' }, h('div', { class: 'step-ico' }, icon(ic)), h('div', {}, h('h3', { text: title }), h('p', { text }), extra ?? null))
  const swatch = (c: string) => h('span', { class: 'swatch', style: `background:${c}` })
  const render = () => {
    const legend = h('div', { class: 'legend' },
      h('span', { class: 'tag' }, swatch('#e0453a'), t('howto.legendStart')),
      h('span', { class: 'tag' }, swatch('#f2b630'), t('howto.legendTarget')),
      h('span', { class: 'tag' }, swatch('#6b4426'), t('howto.legendFixed')),
      h('span', { class: 'tag' }, swatch('#f0d3a0'), t('howto.legendYours')),
      h('span', { class: 'tag' }, swatch('#5fb86b'), t('howto.legendZone')),
    )
    const keys = h('div', { class: 'keys' },
      h('span', {}, KeyCap('Q'), ' ', KeyCap('E')), h('span', { text: t('howto.kRotate') }),
      h('span', {}, KeyCap('Enter')), h('span', { text: t('howto.kPlace') }),
      h('span', {}, KeyCap('Del')), h('span', { text: t('howto.kDelete') }),
      h('span', {}, KeyCap('Z'), ' ', KeyCap('Y')), h('span', { text: t('howto.kUndo') }),
      h('span', {}, KeyCap('Space')), h('span', { text: t('howto.kPush') }),
      h('span', {}, KeyCap('T')), h('span', { text: t('howto.kTop') }),
      h('span', {}, KeyCap('Esc')), h('span', { text: t('howto.kPause') }),
    )
    const body = h('div', { class: 'howto-body' },
      h('h2', { text: t('howto.title') }),
      step('target', t('howto.s1t'), t('howto.s1'), legend),
      step('domino', t('howto.s2t'), t('howto.s2')),
      step('cw', t('howto.s3t'), t('howto.s3')),
      step('push', t('howto.s4t'), t('howto.s4')),
      step('star', t('howto.s5t'), t('howto.s5')),
      step('orbit', t('howto.s6t'), t('howto.s6')),
      step('sandbox', t('howto.s7t'), t('howto.s7')),
      step('gear', t('howto.s8t'), t('howto.s8'), keys),
    )
    el.replaceChildren(
      h('div', { class: 'topleft' }, backButton(t('common.back'), () => app.go(from))),
      h('div', { class: 'panel howto-panel' }, ScrollArea({ class: 'howto-scroll', label: t('howto.title') }, body).el),
    )
  }
  render()
  return { name: 'howto', el, relabel: render, onBack() { app.go(from); return true }, onKey(e) { if (e.key === 'Escape') { app.go(from); return true } return false }, dispose() {} }
}
