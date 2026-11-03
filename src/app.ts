import type RAPIER_NS from '@dimforge/rapier3d-compat'
import { trackPage } from './analytics'
import { audio } from './audio/engine'
import { getSettings, onSettings, updateSettings } from './game/settings'
import { onLangChange, t } from './i18n'
import { Stage, type Quality } from './render/stage'
import { openSettings } from './screens/settings'
import { h } from './ui/dom'
import { IconButton, isModalOpen, LangMenu } from './ui/kit'

type R = typeof RAPIER_NS

export interface Screen {
  readonly name: string
  readonly el: HTMLElement
  update?(dt: number): void
  /** 語言切換後重畫文字（不可重置遊戲狀態） */
  relabel?(): void
  /** 回傳 true 表示已處理 */
  onKey?(e: KeyboardEvent): boolean
  /** 瀏覽器返回鍵；回傳 true 表示已處理 */
  onBack?(): boolean
  dispose(): void
}

export type Route =
  | { to: 'home' }
  | { to: 'levels'; chapter?: number }
  | { to: 'game'; level: number }
  | { to: 'random'; seed: number }
  | { to: 'sandbox' }
  | { to: 'howto'; from?: Route }
  | { to: 'records'; tab?: number }
  | { to: 'kids' }
  | { to: 'kidsLevels' }
  | { to: 'kidsGame'; level: number }
  | { to: 'kidsDraw' }
  | { to: 'kidsShow' }

type Factory = (app: App, r: Route) => Screen

/** 全域外殼：共用 3D 舞台、右上角設定＋語言、畫面切換、主迴圈與自動畫質 */
export class App {
  readonly root: HTMLElement
  readonly stage: Stage
  readonly layer: HTMLElement
  private topbar: HTMLElement
  private screen: Screen | null = null
  route: Route = { to: 'home' }
  private factories = new Map<Route['to'], Factory>()
  private last = performance.now()
  private frameAvg = 16
  private autoLevel: Quality = 'high'
  private autoTimer = 0

  constructor(readonly R: R) {
    this.root = document.getElementById('app')!
    const host = h('div', { class: 'stage-host' })
    this.root.appendChild(host)
    this.stage = new Stage(host)
    this.layer = h('div', { class: 'screen-layer' })
    this.root.appendChild(this.layer)
    this.topbar = h('div', { class: 'topright' })
    this.root.appendChild(this.topbar)
    this.renderTopbar()
    this.applyQuality()
    onSettings(() => this.applyQuality())
    onLangChange(() => {
      document.title = t('app.docTitle')
      this.renderTopbar()
      this.screen?.relabel?.()
    })
    document.title = t('app.docTitle')
    document.addEventListener('keydown', (e) => this.key(e))
    // 第一次使用者手勢後解鎖音訊
    const unlock = () => {
      audio.unlock()
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('popstate', () => {
      if (isModalOpen()) return
      if (this.screen?.onBack?.()) {
        history.pushState({ dp: 1 }, '')
        return
      }
    })
    history.replaceState({ dp: 0 }, '')
    history.pushState({ dp: 1 }, '')
    requestAnimationFrame((n) => this.loop(n))
  }

  register(to: Route['to'], f: Factory): void {
    this.factories.set(to, f)
  }

  go(r: Route): void {
    this.screen?.dispose()
    this.layer.replaceChildren()
    this.route = r
    const f = this.factories.get(r.to)!
    this.screen = f(this, r)
    this.layer.appendChild(this.screen.el)
    this.frameAvg = 16
    this.autoTimer = 0
    trackPage(r.to)
  }

  private renderTopbar(): void {
    const lang = LangMenu((l) => updateSettings({ lang: l }))
    const gear = IconButton('gear', t('settings.title'), () => openSettings(this))
    gear.classList.add('settings-btn')
    this.topbar.replaceChildren(lang, gear)
  }

  private key(e: KeyboardEvent): void {
    if (isModalOpen()) return
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT') return
    if (this.screen?.onKey?.(e)) e.preventDefault()
  }

  /* ───── 畫質：自動依幀率降級 ───── */

  applyQuality(): void {
    this.stage.setAssist(getSettings().colorAssist)
    const q = getSettings().quality
    const level: Quality = q === 'auto' ? this.autoLevel : q
    if (this.stage.quality !== level) this.stage.setQuality(level)
  }

  private autoTune(dt: number): void {
    if (getSettings().quality !== 'auto' || document.hidden) return
    this.frameAvg = this.frameAvg * 0.95 + dt * 1000 * 0.05
    this.autoTimer += dt
    if (this.autoTimer < 3) return
    this.autoTimer = 0
    if (this.frameAvg > 26 && this.autoLevel !== 'low') {
      this.autoLevel = this.autoLevel === 'high' ? 'medium' : 'low'
      this.applyQuality()
    }
  }

  private loop(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000))
    this.last = now
    this.screen?.update?.(dt)
    this.autoTune(dt)
    this.stage.render(dt)
    requestAnimationFrame((n) => this.loop(n))
  }
}
