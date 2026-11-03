import type { App, Screen } from '../app'
import { audio } from '../audio/engine'
import type { DominoSpec, Piece } from '../core/types'
import { Runner } from '../game/runner'
import { getSettings } from '../game/settings'
import { Path } from '../levels/builder'
import { t } from '../i18n'
import { h } from '../ui/dom'
import { Button } from '../ui/kit'
import { LOBBY_URL, screenEl } from './common'

const RAINBOW = [0xe0453a, 0xf08a2c, 0xf2c230, 0x5fb86b, 0x3f74b5, 0x8a5bd0]

/** 首頁背景展示：一條彩虹 S 形骨牌，定時自己倒下再重來 */
function demoScene(): { dominoes: DominoSpec[]; pieces: Piece[]; zones: []; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } } {
  const pts = new Path(-7, 2.4, 0).fwd(2).turn(-150, 1.8).fwd(2.4).turn(150, 1.8).fwd(3).sample(0.68)
  const dominoes: DominoSpec[] = pts.map((p, i) => ({ x: p.x, z: p.z, a: p.a, kind: i === 0 ? 'start' : 'free', color: i === 0 ? undefined : RAINBOW[Math.floor(i / 3) % RAINBOW.length] }))
  const e = pts[pts.length - 1]
  const pieces: Piece[] = [0, 1, 2].map((i) => ({ type: 'block', x: e.x + 1.2, y: 0.25 + i * 0.5, z: e.z, sx: 0.36, sy: 0.5, sz: 0.5, tone: (['blue', 'red', 'green'] as const)[i], target: i === 2 }))
  dominoes.push({ x: e.x + 0.62, z: e.z, a: 0, kind: 'free', size: 'l' })
  return { dominoes, pieces, zones: [], bounds: { minX: -8, maxX: 5, minZ: -4, maxZ: 4 } }
}

export function homeScreen(app: App): Screen {
  const el = screenEl('home')
  const scene = demoScene()
  app.stage.setTheme('village')
  audio.setTheme('village')
  app.stage.setLevel(scene, [])
  app.stage.showGhost(null)
  app.stage.showGhosts([])
  app.stage.showGuide(null)
  app.stage.fitView(false, false)
  app.stage.controls.enabled = false
  let runner: Runner | null = null
  let timer = 2.5
  let orbit = 0

  const render = () => {
    el.replaceChildren(
      h('div', { class: 'topleft' },
        h('a', { class: 'btn btn-sm lobby-link', attrs: { href: LOBBY_URL, 'aria-label': t('home.lobby') } }, h('span', { class: 'btn-label', text: t('home.lobby') }))),
      h('div', { class: 'home-card' },
        h('div', { class: 'sign' }, h('h1', { text: t('app.title') }), h('p', { text: t('home.tagline') })),
        h('div', { class: 'home-btns' },
          Button({ label: t('home.challenge'), icon: 'flag', variant: 'primary', size: 'lg', onClick: () => { audio.click(); app.go({ to: 'levels' }) } }),
          Button({ label: t('home.sandbox'), icon: 'sandbox', variant: 'gold', size: 'lg', onClick: () => { audio.click(); app.go({ to: 'sandbox' }) } }),
          Button({ label: t('home.howto'), icon: 'book', size: 'lg', onClick: () => { audio.click(); app.go({ to: 'howto', from: { to: 'home' } }) } }),
        ),
        h('p', { class: 'home-sub', text: t('home.sub') }),
      ),
    )
  }
  render()

  return {
    name: 'home',
    el,
    relabel: render,
    onBack() {
      location.href = LOBBY_URL
      return true
    },
    update(dt) {
      if (!getSettings().reduceMotion) {
        orbit += dt * 0.05
        const c = app.stage.center()
        const r = 13
        app.stage.camera.position.set(c.x + Math.sin(orbit) * r * 0.5, 8.5, c.z + Math.cos(orbit * 0.6) * 2 + r * 0.75)
        app.stage.controls.target.copy(c)
      }
      if (runner) {
        runner.update(dt)
        app.stage.syncFrom()
        if (runner.settled || runner.sim.time > 12) {
          timer -= dt
          if (timer <= 0) {
            runner.dispose()
            runner = null
            app.stage.setLevel(scene, [])
            timer = 3
          }
        }
      } else {
        timer -= dt
        if (timer <= 0) {
          runner = new Runner(app.R, scene, [], {}, false)
          app.stage.attachSim(runner.sim)
          runner.push()
          timer = 2
        }
      }
    },
    dispose() {
      runner?.dispose()
      app.stage.detachSim()
      app.stage.controls.enabled = true
    },
  }
}
