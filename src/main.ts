import RAPIER from '@dimforge/rapier3d-compat'
import './ui/style.css'
import { initAnalytics } from './analytics'
import { App } from './app'
import { setMaxSteps } from './game/runner'
import { loadSettings } from './game/settings'
import { t } from './i18n'
import { gameScreen } from './screens/game'
import { homeScreen } from './screens/home'
import { howtoScreen } from './screens/howto'
import { levelsScreen } from './screens/levels'
import { kidsDrawScreen, kidsGameScreen, kidsHomeScreen, kidsLevelsScreen, kidsShowScreen } from './screens/kids'
import { recordsScreen } from './screens/records'
import { sandboxScreen } from './screens/sandbox'
import { onUnlock } from './storage/records'
import { h } from './ui/dom'
import { toast } from './ui/kit'
import { audio } from './audio/engine'
import type { Key } from './i18n'

function loadingEl(): HTMLElement {
  return h('div', { class: 'loading', attrs: { role: 'status', 'aria-live': 'polite' } },
    h('div', { class: 'loading-card' },
      h('div', { class: 'loading-dominoes', attrs: { 'aria-hidden': 'true' } }, h('i'), h('i'), h('i'), h('i'), h('i')),
      h('p', { text: t('app.loading') })))
}

function errorEl(msg: string): HTMLElement {
  const retry = h('button', { class: 'btn btn-primary', text: t('common.retry'), attrs: { type: 'button' } })
  retry.addEventListener('click', () => location.reload())
  return h('div', { class: 'loading', attrs: { role: 'alert' } },
    h('div', { class: 'panel error-card' }, h('h2', { class: 'panel-title', text: t('app.errorTitle') }), h('p', { text: msg, style: 'margin-bottom:14px;font-weight:700' }), retry))
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

async function boot(): Promise<void> {
  loadSettings()
  initAnalytics()
  const loading = loadingEl()
  document.body.appendChild(loading)
  if (!hasWebGL()) {
    loading.replaceWith(errorEl(t('app.noWebgl')))
    return
  }
  try {
    await RAPIER.init()
  } catch {
    loading.replaceWith(errorEl(t('app.physicsFail')))
    return
  }
  const app = new App(RAPIER)
  onUnlock((ids) => ids.forEach((id, i) => setTimeout(() => { toast(t('ach.unlocked', { name: t(`ach.${id}` as Key) }), 'ok', 3200); audio.star(2) }, 400 + i * 900)))
  app.register('home', (a) => homeScreen(a))
  app.register('levels', (a, r) => levelsScreen(a, r.to === 'levels' ? r.chapter : 0))
  app.register('game', (a, r) => gameScreen(a, { level: r.to === 'game' ? r.level : 1 }))
  app.register('random', (a, r) => gameScreen(a, { seed: r.to === 'random' ? r.seed : 1 }))
  app.register('sandbox', (a) => sandboxScreen(a))
  app.register('records', (a, r) => recordsScreen(a, r.to === 'records' ? r.tab : 0))
  app.register('kids', (a) => kidsHomeScreen(a))
  app.register('kidsLevels', (a) => kidsLevelsScreen(a))
  app.register('kidsGame', (a, r) => kidsGameScreen(a, r.to === 'kidsGame' ? r.level : 1))
  app.register('kidsDraw', (a) => kidsDrawScreen(a))
  app.register('kidsShow', (a) => kidsShowScreen(a))
  app.register('howto', (a, r) => howtoScreen(a, r.to === 'howto' ? r.from : undefined))
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('turbo')) setMaxSteps(60)
  if (import.meta.env.DEV) (window as unknown as { __dpGo?: (r: unknown) => void }).__dpGo = (r) => app.go(r as Parameters<App['go']>[0])
  if (import.meta.env.DEV) (window as unknown as { __dpStage?: unknown }).__dpStage = app.stage
  app.go({ to: 'home' })
  loading.remove()
}

boot()
