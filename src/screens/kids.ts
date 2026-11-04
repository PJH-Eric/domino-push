import type { App, Screen } from '../app'
import { audio, buzz } from '../audio/engine'
import { dims } from '../core/geom'
import type { DominoSpec, Level, Piece, ThemeId } from '../core/types'
import { Runner } from '../game/runner'
import { alongPolyline } from '../game/shapes'
import { getSettings } from '../game/settings'
import { Path } from '../levels/builder'
import { KID_COLORS, kidLevel, kidLevelCount } from '../levels/kids'
import { loadStats, recordKid, recordRun } from '../storage/records'
import { t, type Key } from '../i18n'
import { h } from '../ui/dom'
import { icon, type IconName } from '../ui/icons'
import { Button, openModal, ScrollArea, type ModalHandle } from '../ui/kit'
import { backButton, screenEl } from './common'
import { PointerTaps } from './pointer'

/* ───── 共用小元件 ───── */

/** 手機工具區改變可用畫布大小時，重新取景；離開模式即停止監聽。 */
function fitKidsViewport(app: App): () => void {
  const observer = new ResizeObserver(() => {
    app.stage.resize()
    app.stage.fitView(false, false)
  })
  observer.observe(app.stage.renderer.domElement)
  return () => observer.disconnect()
}

/** 會點來點去的大手指：指著下一個要點的地方 */
class Finger {
  el = h('div', { class: 'finger', attrs: { 'aria-hidden': 'true' } }, icon('hand', 'icon'))
  show(x: number, y: number): void {
    this.el.style.display = 'block'
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  }
  hide(): void {
    this.el.style.display = 'none'
  }
}

function kidBtn(o: { label: string; icon: IconName; tone: string; onClick: () => void; cls?: string }): HTMLButtonElement {
  return Button({ label: o.label, icon: o.icon, class: `kid-btn kid-${o.tone}${o.cls ? ' ' + o.cls : ''}`, onClick: () => { audio.click(); o.onClick() } })
}

function pushBtn(onClick: () => void): HTMLButtonElement {
  const b = Button({ label: t('btn.push'), icon: 'push', variant: 'primary', class: 'kid-push', onClick })
  return b
}

/* ───── 幼兒園首頁 ───── */

export function kidsHomeScreen(app: App): Screen {
  const el = screenEl('kids-home')
  app.stage.setTheme('candy')
  audio.setTheme('candy')
  const show = rainbowScene(70)
  app.stage.setLevel(show, [])
  app.stage.fitView(false, false)
  app.stage.controls.enabled = false
  const render = () => {
    el.replaceChildren(
      h('div', { class: 'topleft' }, backButton(t('common.home'), () => app.go({ to: 'home' }))),
      ScrollArea({ class: 'home-scroll', label: t('kid.title') }, h('div', { class: 'kid-menu' },
        h('div', { class: 'sign kid-sign' }, h('h1', { text: t('kid.title') }), h('p', { text: t('kid.tagline') })),
        h('div', { class: 'kid-tiles' },
          kidBtn({ label: t('kid.levels'), icon: 'flag', tone: 'red', onClick: () => app.go({ to: 'kidsLevels' }) }),
          kidBtn({ label: t('kid.draw'), icon: 'line', tone: 'yellow', onClick: () => app.go({ to: 'kidsDraw' }) }),
          kidBtn({ label: t('kid.show'), icon: 'play', tone: 'blue', onClick: () => app.go({ to: 'kidsShow' }) }),
        ),
      )).el,
    )
  }
  render()
  return { name: 'kids', el, relabel: render, onBack() { app.go({ to: 'home' }); return true }, onKey(e) { if (e.key === 'Escape') { app.go({ to: 'home' }); return true } return false }, dispose() { app.stage.controls.enabled = true } }
}

/* ───── 幼兒園選關：全部開放 ───── */

const TONES: Record<ThemeId, string> = { village: 'green', camp: 'yellow', town: 'blue', space: 'purple', candy: 'pink' }

export function kidsLevelsScreen(app: App): Screen {
  const el = screenEl('levels kids-levels')
  app.stage.controls.enabled = false
  const render = () => {
    const done = new Set(loadStats().kids)
    const grid = h('div', { class: 'kid-grid' })
    for (let n = 1; n <= kidLevelCount(); n++) {
      const lv = kidLevel(n)!
      const b = h('button', { class: `kid-lv kid-${TONES[lv.theme]}`, attrs: { type: 'button', 'aria-label': `${n}. ${t(lv.nameKey as Key)}${done.has(n) ? ' ' + t('kid.done') : ''}` } },
        h('span', { class: 'kid-lv-no', text: String(n) }),
        h('span', { class: 'kid-lv-name', text: t(lv.nameKey as Key) }),
        done.has(n) ? h('span', { class: 'kid-lv-done' }, icon('check')) : null,
      )
      b.addEventListener('click', () => { audio.click(); app.go({ to: 'kidsGame', level: n }) })
      grid.append(b)
    }
    el.replaceChildren(
      h('div', { class: 'topleft' }, backButton(t('kid.back'), () => app.go({ to: 'kids' }))),
      h('div', { class: 'panel levels-panel' }, h('div', { class: 'levels-head' }, h('h2', { text: t('kid.levels') })), ScrollArea({ class: 'levels-scroll', label: t('kid.levels') }, grid).el),
    )
  }
  render()
  return { name: 'kidsLevels', el, relabel: render, onBack() { app.go({ to: 'kids' }); return true }, onKey(e) { if (e.key === 'Escape') { app.go({ to: 'kids' }); return true } return false }, dispose() { app.stage.controls.enabled = true } }
}

/* ───── 幼兒園關卡：點發光空位 ───── */

export function kidsGameScreen(app: App, no: number): Screen {
  const level: Level = kidLevel(no) ?? kidLevel(1)!
  const stage = app.stage
  const el = screenEl('kids-game')
  const stopViewport = fitKidsViewport(app)
  stage.setTheme(level.theme)
  audio.setTheme(level.theme)
  stage.setLevel(level, [])
  stage.fitView(false, false)
  stage.controls.enabled = false
  const filled = new Set<number>()
  let order: number[] = []
  let phase: 'place' | 'run' | 'fail' | 'win' = 'place'
  let runner: Runner | null = null
  let fallen = 0
  let winTimer = -1
  let winArmed = false
  let slow = 0
  let pulse = 0
  let result: ModalHandle | null = null
  const finger = new Finger()
  const bar = h('div', { class: 'kid-bar' })
  const banner = h('div', { class: 'pass' })
  const counter = h('div', { class: 'pass' })
  let pushEl: HTMLButtonElement | null = null

  const placed = (): DominoSpec[] => order.map((i) => level.solution[i])
  const remaining = (): number[] => level.solution.map((_, i) => i).filter((i) => !filled.has(i))

  const refresh = () => {
    stage.setDominoes([...level.dominoes, ...placed()])
    stage.showGhosts(phase === 'place' || phase === 'fail' ? remaining().map((i) => level.solution[i]) : [])
    render()
  }

  const render = () => {
    const left = remaining().length
    bar.replaceChildren()
    banner.replaceChildren()
    if (phase === 'place') {
      bar.append(h('div', { class: 'panel kid-tip', attrs: { role: 'status', 'aria-live': 'polite' } }, icon(left ? 'hand' : 'push'), h('span', { text: left ? t('kid.tapGlow', { n: left }) : t('kid.pressPush') })))
      pushEl = pushBtn(() => doPush())
      if (left) pushEl.classList.add('kid-push-wait')
      bar.append(pushEl)
    } else if (phase === 'fail') {
      banner.append(h('div', { class: 'panel status-banner kid-banner', attrs: { role: 'alert' } }, h('p', { text: t('kid.almost') }),
        Button({ label: t('game.tryAgain'), icon: 'refresh', variant: 'primary', class: 'kid-btn-sm', onClick: () => backToPlace() })))
      pushEl = null
    } else pushEl = null
    counter.replaceChildren()
    if (phase !== 'place') counter.append(h('div', { class: 'panel fall-counter kid-counter' }, h('span', { class: 'fc-n', text: String(fallen) })))
  }

  const place = (i: number) => {
    if (filled.has(i)) return
    filled.add(i)
    order.push(i)
    const d = level.solution[i]
    audio.place()
    buzz(8)
    stage.puff(d.x, (d.y ?? 0) + 0.05, d.z, 5)
    refresh()
  }

  const taps = new PointerTaps(stage.renderer.domElement, {
    tap: (x, y) => {
      if (phase !== 'place' && phase !== 'fail') return
      const rem = remaining()
      if (!rem.length) { audio.click(); return }
      if (phase === 'fail') backToPlace()
      // 點到附近的發光空位就放那裡；點得太遠也沒關係，放到下一個
      let best = rem[0], bd = Infinity
      for (const i of rem) {
        const d = level.solution[i]
        const p = stage.project(d.x, (d.y ?? 0) + dims(d.size).h * 0.5, d.z)
        const dist = Math.hypot(p.x - x + stage.renderer.domElement.getBoundingClientRect().left, p.y - y + stage.renderer.domElement.getBoundingClientRect().top)
        if (dist < bd) { bd = dist; best = i }
      }
      place(bd < 90 ? best : rem[0])
    },
  })

  const doPush = () => {
    if (phase !== 'place') return
    audio.unlock()
    audio.push()
    buzz(20)
    phase = 'run'
    fallen = 0
    winTimer = -1
    winArmed = false
    stage.showGhosts([])
    finger.hide()
    runner = new Runner(app.R, level, placed(), {
      onImpact: (i) => { audio.impact(i.force, i.kind); if (i.force > 25) stage.puff(i.x, 0.05, i.z, 2) },
      onFall: (_i, x, y, z, target) => {
        fallen++
        const fc = counter.querySelector('.fc-n')
        if (fc) fc.textContent = String(fallen)
        if (target) { audio.star(1); popup(x, y + 0.8, z, '★') }
      },
    })
    stage.attachSim(runner.sim)
    runner.push()
    render()
  }

  const popLayer = h('div', { class: 'pass', style: 'position:absolute;inset:0' })
  const popup = (x: number, y: number, z: number, text: string) => {
    if (getSettings().reduceMotion) return
    const p = stage.project(x, y, z)
    if (!p.visible) return
    const n = h('div', { class: 'popup', text, style: `left:${p.x}px;top:${p.y}px` })
    popLayer.appendChild(n)
    setTimeout(() => n.remove(), 1000)
  }

  const backToPlace = () => {
    runner?.dispose()
    runner = null
    stage.detachSim()
    phase = 'place'
    stage.setLevel(level, placed())
    refresh()
  }

  const win = () => {
    phase = 'win'
    audio.win()
    recordKid(level.no, fallen, runner?.bestCombo ?? 0)
    render()
    const next = kidLevel(level.no + 1)
    const st = h('div', { class: 'result-stars kid-stars', attrs: { 'aria-hidden': 'true' } })
    for (let i = 0; i < 3; i++) { const s = icon('star'); s.style.color = 'var(--gold)'; s.classList.add('lit'); st.append(s) }
    const actions = h('div', { class: 'result-actions' })
    if (next) actions.append(Button({ label: t('result.next'), icon: 'play', variant: 'primary', class: 'wide kid-btn-sm', onClick: () => { result?.close(); app.go({ to: 'kidsGame', level: next.no }) } }))
    actions.append(
      Button({ label: t('kid.again'), icon: 'refresh', class: 'kid-btn-sm', onClick: () => { result?.close(); app.go({ to: 'kidsGame', level: level.no }) } }),
      Button({ label: t('kid.back'), icon: 'grid', class: 'kid-btn-sm', onClick: () => { result?.close(); app.go({ to: 'kidsLevels' }) } }),
      Button({ label: t('common.home'), icon: 'home', class: 'wide kid-btn-sm', onClick: () => { result?.close(); app.go({ to: 'home' }) } }),
    )
    const body = h('div', { class: 'result-body result-split' },
      h('div', { class: 'result-body', attrs: { 'data-result-share': '' } }, st, h('p', { class: 'kid-great', text: t('kid.great') }), h('p', { class: 'result-msg', text: t('kid.fallenN', { n: fallen }) })),
      actions)
    result = openModal({ title: `${level.no}. ${t(level.nameKey as Key)}`, body, width: 'sm', closeLabel: t('common.close'), dismissible: false })
    result.el.classList.add('result')
  }

  el.append(
    h('div', { class: 'topleft' }, backButton(t('kid.back'), () => app.go({ to: 'kidsLevels' })), h('div', { class: 'panel kid-title', text: `${level.no}. ${t(level.nameKey as Key)}` })),
    counter, banner, popLayer, bar, finger.el,
  )
  refresh()

  return {
    name: 'kidsGame',
    el,
    relabel: () => { el.querySelector('.kid-title')!.textContent = `${level.no}. ${t(level.nameKey as Key)}`; el.querySelector('.back-btn .btn-label')!.textContent = t('kid.back'); render() },
    onBack() { app.go({ to: 'kidsLevels' }); return true },
    onKey(e) {
      if (e.key === 'Escape') { app.go({ to: 'kidsLevels' }); return true }
      if (e.key === ' ' && phase === 'place') { doPush(); return true }
      if (e.key === 'Enter' && phase === 'place') { const r = remaining(); if (r.length) place(r[0]); return true }
      return false
    },
    update(dt) {
      pulse += dt
      stage.ghostOpacity(0.35 + 0.3 * (0.5 + 0.5 * Math.sin(pulse * 4)))
      // 手指：指向下一個空位，全部放好就指向「推！」
      if (phase === 'place' || phase === 'fail') {
        const rem = remaining()
        if (rem.length) {
          const d = level.solution[rem[0]]
          const p = stage.project(d.x, (d.y ?? 0) + dims(d.size).h * 0.5, d.z)
          if (p.visible) finger.show(p.x, p.y)
          else finger.hide()
        } else if (pushEl) {
          const r = pushEl.getBoundingClientRect()
          finger.show(r.left + r.width * 0.55, r.top + r.height * 0.55)
        }
      } else finger.hide()
      if (!runner || phase === 'place') return
      runner.timeScale = slow > 0 ? 0.35 : 1
      if (slow > 0) slow -= dt
      runner.update(dt)
      stage.syncFrom()
      const sim = runner.sim
      if (getSettings().cameraFollow && sim.fallenCount > 0) stage.follow(sim.lastFall.x, sim.lastFall.z, Math.min(1, dt * 0.8))
      if (phase === 'run') {
        if (sim.targetsFallen === sim.targetsTotal && !winArmed) { winTimer = 1.4; winArmed = true; if (!getSettings().reduceMotion) slow = 0.9 }
        if (winArmed) { winTimer -= dt; if (winTimer <= 0 && (runner.settled || winTimer < -6)) win() }
        else if (runner.settled) { phase = 'fail'; audio.fail(); refresh() }
      }
    },
    dispose() {
      stopViewport()
      taps.dispose()
      runner?.dispose()
      stage.detachSim()
      stage.showGhosts([])
      stage.ghostOpacity(0.5)
      stage.controls.enabled = true
      result?.close()
    },
  }
}

/* ───── 畫畫骨牌：手指畫線就排好 ───── */

export function kidsDrawScreen(app: App): Screen {
  const stage = app.stage
  const el = screenEl('kids-draw')
  const stopViewport = fitKidsViewport(app)
  const base = { dominoes: [] as DominoSpec[], pieces: [] as Piece[], zones: [], bounds: { minX: -7, maxX: 7, minZ: -4.5, maxZ: 4.5 } }
  stage.setTheme('candy')
  audio.setTheme('candy')
  stage.setLevel(base, [])
  stage.fitView(false, false)
  stage.controls.enabled = false
  const AREA = { minX: -10, maxX: 10, minZ: -7, maxZ: 7 }
  let dominoes: DominoSpec[] = []
  const lines: number[] = []
  let color = -1 // -1 ＝彩虹
  let drawing: { x: number; z: number }[] | null = null
  let phase: 'build' | 'run' | 'done' = 'build'
  let runner: Runner | null = null
  let fallen = 0
  const finger = new Finger()
  const bar = h('div', { class: 'kid-bar kid-draw-bar' })
  const counter = h('div', { class: 'pass' })
  const canvas = stage.renderer.domElement

  const paint = (list: DominoSpec[], start: number) => list.map((d, i) => ({ ...d, kind: 'free' as const, color: color < 0 ? KID_COLORS[(start + i) % KID_COLORS.length] : KID_COLORS[color] }))

  const preview = (): DominoSpec[] => {
    if (!drawing || drawing.length < 2) return []
    const raw = alongPolyline(drawing, dims('m').h * 0.68, { size: 'm', spacing: 0.68 })
    // 過濾：超出桌面或跟已有骨牌太近的不放
    return paint(raw, dominoes.length).filter((d) => d.x > AREA.minX && d.x < AREA.maxX && d.z > AREA.minZ && d.z < AREA.maxZ && !dominoes.some((o) => Math.hypot(o.x - d.x, o.z - d.z) < 0.5))
  }

  const render = () => {
    bar.replaceChildren()
    if (phase === 'build') {
      const colors = h('div', { class: 'kid-colors', attrs: { role: 'radiogroup', 'aria-label': t('sb.color') } })
      const opts = [-1, ...KID_COLORS.map((_, i) => i)]
      for (const c of opts) {
        const dot = h('button', { class: `kid-dot${c === color ? ' on' : ''}${c < 0 ? ' rainbow' : ''}`, style: c < 0 ? '' : `background:#${KID_COLORS[c].toString(16).padStart(6, '0')}`, attrs: { type: 'button', role: 'radio', 'aria-checked': String(c === color), 'aria-label': c < 0 ? t('kid.rainbow') : t((`sb.c${c + 1}`) as Key) } })
        dot.addEventListener('click', () => { color = c; audio.click(); render() })
        colors.append(dot)
      }
      bar.append(
        colors,
        h('div', { class: 'kid-actions' },
          Button({ icon: 'undo', ariaLabel: t('kid.undoLine'), title: t('kid.undoLine'), class: 'kid-round', disabled: !lines.length, onClick: () => { const s = lines.pop(); if (s !== undefined) { dominoes = dominoes.slice(0, s); audio.remove(); stage.setDominoes(dominoes); render() } } }),
          Button({ icon: 'trash', ariaLabel: t('sb.clear'), title: t('sb.clear'), class: 'kid-round', disabled: !dominoes.length, onClick: () => { dominoes = []; lines.length = 0; audio.remove(); stage.setDominoes(dominoes); render() } }),
          pushBtn(() => doPush()),
        ),
      )
    } else {
      bar.append(h('div', { class: 'kid-actions' }, Button({ label: t('kid.again'), icon: 'refresh', variant: 'primary', class: 'kid-btn-sm', onClick: () => back() })))
    }
    counter.replaceChildren()
    if (phase !== 'build') counter.append(h('div', { class: 'panel fall-counter kid-counter' }, h('span', { class: 'fc-n', text: String(fallen) })))
  }

  const down = (e: PointerEvent) => {
    if (phase !== 'build' || !e.isPrimary) return
    const p = stage.pick(e.clientX, e.clientY)
    if (!p) return
    try { canvas.setPointerCapture(e.pointerId) } catch { /* 合成事件沒有實體指標 */ }
    drawing = [{ x: p.x, z: p.z }]
    finger.hide()
  }
  const move = (e: PointerEvent) => {
    if (!drawing) return
    const p = stage.pick(e.clientX, e.clientY)
    if (!p) return
    const last = drawing[drawing.length - 1]
    if (Math.hypot(p.x - last.x, p.z - last.z) < 0.15) return
    drawing.push({ x: p.x, z: p.z })
    stage.showGhosts(preview())
  }
  const up = () => {
    if (!drawing) return
    const add = preview().slice(0, 300 - dominoes.length)
    drawing = null
    stage.showGhosts([])
    if (add.length) {
      lines.push(dominoes.length)
      dominoes = [...dominoes, ...add]
      audio.place()
      buzz(12)
      stage.setDominoes(dominoes)
    }
    render()
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)

  const doPush = () => {
    if (phase !== 'build' || !dominoes.length) { audio.invalid(); return }
    audio.unlock()
    audio.push()
    buzz(20)
    phase = 'run'
    fallen = 0
    runner = new Runner(app.R, base, dominoes, {
      onImpact: (i) => { audio.impact(i.force, i.kind); if (i.force > 25) stage.puff(i.x, 0.05, i.z, 2) },
      onFall: () => { fallen++; const fc = counter.querySelector('.fc-n'); if (fc) fc.textContent = String(fallen) },
    }, false)
    stage.attachSim(runner.sim)
    // 推每一條線的第一張，讓所有線一起倒
    const starts = lines.length ? lines : [0]
    for (const s of starts) runner.push(s)
    render()
  }

  const back = () => {
    runner?.dispose()
    runner = null
    stage.detachSim()
    stage.setLevel(base, dominoes)
    phase = 'build'
    render()
  }

  el.append(h('div', { class: 'topleft' }, backButton(t('kid.back'), () => app.go({ to: 'kids' })), h('div', { class: 'panel kid-title', text: t('kid.drawTip') })), counter, bar, finger.el)
  render()
  let demo = 0

  return {
    name: 'kidsDraw',
    el,
    relabel: () => { el.querySelector('.kid-title')!.textContent = t('kid.drawTip'); el.querySelector('.back-btn .btn-label')!.textContent = t('kid.back'); render() },
    onBack() { app.go({ to: 'kids' }); return true },
    onKey(e) { if (e.key === 'Escape') { app.go({ to: 'kids' }); return true } if (e.key === ' ') { doPush(); return true } return false },
    update(dt) {
      // 還沒畫線時，手指示範從左滑到右
      if (phase === 'build' && !dominoes.length && !drawing) {
        demo = (demo + dt * 0.5) % 1
        const a = stage.project(-3, 0.2, 0), b = stage.project(3, 0.2, 0)
        finger.show(a.x + (b.x - a.x) * demo, a.y + (b.y - a.y) * demo)
      } else finger.hide()
      if (!runner) return
      runner.update(dt)
      stage.syncFrom()
      if (phase === 'run' && runner.settled) {
        phase = 'done'
        recordRun({ mode: 'sandbox', fallen: runner.sim.fallenCount, combo: runner.bestCombo, score: 0 })
        audio.win()
        render()
      }
    },
    dispose() {
      stopViewport()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      runner?.dispose()
      stage.detachSim()
      stage.showGhosts([])
      stage.controls.enabled = true
    },
  }
}

/* ───── 彩虹秀：按一下就看 ───── */

export function rainbowScene(n: number): { dominoes: DominoSpec[]; pieces: Piece[]; zones: []; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } } {
  // 外圈往內繞的螺旋＋兩座塔
  const pts = new Path(-6, 3.4, 0).fwd(8).turn(-90, 1.6).fwd(3.2).turn(-90, 1.6).fwd(8).turn(-90, 1.6).fwd(1.4).turn(-90, 1.4).fwd(5.5).sample(0.66).slice(0, n)
  const dominoes: DominoSpec[] = pts.map((p, i) => ({ x: p.x, z: p.z, a: p.a, kind: i === 0 ? 'start' : 'free', color: i === 0 ? undefined : KID_COLORS[Math.floor(i / 2) % KID_COLORS.length] }))
  const e = pts[pts.length - 1]
  const dx = Math.cos(e.a), dz = -Math.sin(e.a)
  dominoes.push({ x: e.x + dx * 0.85, z: e.z + dz * 0.85, a: e.a, kind: 'free', size: 'l', color: 0xf27fb0 })
  const tones = ['blue', 'red', 'green', 'purple'] as const
  const pieces: Piece[] = [0, 1, 2, 3].map((i) => ({ type: 'block', x: e.x + dx * 1.83, y: 0.25 + i * 0.5, z: e.z + dz * 1.83, sx: 0.36, sy: 0.5, sz: 0.5, a: e.a, tone: tones[i], target: i === 3 }))
  const xs = [...dominoes.map((d) => d.x), e.x + dx * 1.83], zs = [...dominoes.map((d) => d.z), e.z + dz * 1.83]
  return { dominoes, pieces, zones: [], bounds: { minX: Math.min(...xs) - 1, maxX: Math.max(...xs) + 1, minZ: Math.min(...zs) - 1, maxZ: Math.max(...zs) + 1 } }
}

export function kidsShowScreen(app: App): Screen {
  const stage = app.stage
  const el = screenEl('kids-show')
  const stopViewport = fitKidsViewport(app)
  const scene = rainbowScene(200)
  stage.setTheme('candy')
  audio.setTheme('candy')
  stage.setLevel(scene, [])
  stage.fitView(false, false)
  stage.controls.enabled = false
  let runner: Runner | null = null
  let phase: 'ready' | 'run' | 'done' = 'ready'
  let fallen = 0
  const finger = new Finger()
  const bar = h('div', { class: 'kid-bar' })
  const counter = h('div', { class: 'pass' })
  let pushEl: HTMLButtonElement | null = null

  const render = () => {
    bar.replaceChildren()
    pushEl = null
    if (phase === 'ready') { pushEl = pushBtn(() => go()); bar.append(pushEl) }
    else if (phase === 'done') bar.append(Button({ label: t('kid.watchAgain'), icon: 'refresh', variant: 'primary', class: 'kid-btn-sm', onClick: () => reset() }))
    counter.replaceChildren()
    if (phase !== 'ready') counter.append(h('div', { class: 'panel fall-counter kid-counter' }, h('span', { class: 'fc-n', text: String(fallen) })))
  }
  const go = () => {
    if (phase !== 'ready') return
    audio.unlock()
    audio.push()
    buzz(20)
    phase = 'run'
    fallen = 0
    runner = new Runner(app.R, scene, [], {
      onImpact: (i) => { audio.impact(i.force, i.kind); if (i.force > 25) stage.puff(i.x, 0.05, i.z, 2) },
      onFall: () => { fallen++; const fc = counter.querySelector('.fc-n'); if (fc) fc.textContent = String(fallen); if (fallen % 25 === 0) audio.combo(fallen) },
    }, false)
    stage.attachSim(runner.sim)
    runner.push()
    render()
  }
  const reset = () => {
    runner?.dispose()
    runner = null
    stage.detachSim()
    stage.setLevel(scene, [])
    stage.fitView(false)
    phase = 'ready'
    render()
  }
  el.append(h('div', { class: 'topleft' }, backButton(t('kid.back'), () => app.go({ to: 'kids' })), h('div', { class: 'panel kid-title', text: t('kid.showTip') })), counter, bar, finger.el)
  render()
  return {
    name: 'kidsShow',
    el,
    relabel: () => { el.querySelector('.kid-title')!.textContent = t('kid.showTip'); el.querySelector('.back-btn .btn-label')!.textContent = t('kid.back'); render() },
    onBack() { app.go({ to: 'kids' }); return true },
    onKey(e) { if (e.key === 'Escape') { app.go({ to: 'kids' }); return true } if (e.key === ' ') { if (phase === 'ready') go(); else if (phase === 'done') reset(); return true } return false },
    update(dt) {
      if (phase === 'ready' && pushEl) {
        const r = pushEl.getBoundingClientRect()
        finger.show(r.left + r.width * 0.55, r.top + r.height * 0.55)
      } else finger.hide()
      if (!runner) return
      runner.update(dt)
      stage.syncFrom()
      if (getSettings().cameraFollow && runner.sim.fallenCount > 0) stage.follow(runner.sim.lastFall.x, runner.sim.lastFall.z, Math.min(1, dt * 0.6))
      if (phase === 'run' && runner.settled) {
        phase = 'done'
        recordRun({ mode: 'sandbox', fallen: runner.sim.fallenCount, combo: runner.bestCombo, score: 0 })
        audio.win()
        render()
      }
    },
    dispose() {
      stopViewport()
      runner?.dispose()
      stage.detachSim()
      stage.controls.enabled = true
    },
  }
}
