import type { App, Screen } from '../app'
import { trackGameEnd, trackGameStart } from '../analytics'
import { audio, buzz } from '../audio/engine'
import { starsFor } from '../core/rules'
import type { Level } from '../core/types'
import { Placement } from '../game/placement'
import { Runner } from '../game/runner'
import { getSettings, onSettings } from '../game/settings'
import { levelByNo, allLevels } from '../levels'
import { generateRandom } from '../levels/random'
import { loadProgress, recordWin, saveProgress } from '../storage/progress'
import { recordRun } from '../storage/records'
import { t, type Key } from '../i18n'
import { h } from '../ui/dom'
import { icon } from '../ui/icons'
import { Button, IconButton, openModal, toast, type ModalHandle } from '../ui/kit'
import { CHAPTERS } from './levels'
import { backButton, screenEl } from './common'
import { PointerTaps } from './pointer'

type Phase = 'place' | 'run' | 'fail' | 'win'

/** 挑戰／隨機關的遊戲畫面 */
export function gameScreen(app: App, mode: { level: number } | { seed: number }): Screen {
  const isRandom = 'seed' in mode
  const level: Level = isRandom ? generateRandom(mode.seed) : levelByNo(mode.level)!
  const stage = app.stage
  const el = screenEl('game')
  const pl = new Placement({ base: level.dominoes, zones: level.zones, pieces: level.pieces, kind: 'player', limit: level.limit })
  pl.autoAim = getSettings().autoAim
  let phase: Phase = 'place'
  let runner: Runner | null = null
  let fallen = 0
  let winTimer = -1
  let winArmed = false
  let slowTimer = 0
  let result: ModalHandle | null = null
  let pauseM: ModalHandle | null = null
  let paused = false
  let topView = false
  let hintOpen = false
  const prog = loadProgress()
  const hintKey = level.hintKey as Key | undefined
  if (hintKey && !prog.seenHints.includes(level.id) && !isRandom) {
    hintOpen = true
    prog.seenHints.push(level.id)
    saveProgress(prog)
  }

  stage.setTheme(level.theme)
  audio.setTheme(level.theme)
  stage.setLevel(level, [])
  stage.fitView(false, false)
  trackGameStart({ mode: isRandom ? 'random' : 'challenge', level: level.no })

  /* ───── 畫面 ───── */
  const info = h('div', { class: 'panel hud-info', attrs: { role: 'status', 'aria-live': 'polite' } })
  const toolbar = h('div', { class: 'toolbar' })
  const camTools = h('div', { class: 'cam-tools' })
  const banner = h('div', { class: 'pass' })
  const counter = h('div', { class: 'pass' })
  const hintBar = h('div', { class: 'pass' })
  const popLayer = h('div', { class: 'pass', style: 'position:absolute;inset:0' })

  const title = () => (isRandom ? t('game.randomTitle', { seed: level.seed ?? 0 }) : `${level.no}. ${t(level.nameKey as Key)}`)

  const renderInfo = () => {
    const used = pl.used
    const s3 = level.star3, s2 = level.star2
    info.replaceChildren(
      h('div', { class: 'hud-title', text: title() }),
      h('div', { class: 'hud-row' },
        icon('domino'),
        h('span', { class: `hud-count${used >= level.limit ? ' warn' : ''}`, text: `${used} / ${level.limit}` }),
        h('span', { text: t('game.usedLabel') }),
      ),
      h('div', { class: 'hud-stars' },
        h('span', { class: used <= s3 ? 'hit' : '' }, starsMini(3), `≤ ${s3}`),
        h('span', { class: used <= s2 ? 'hit' : '' }, starsMini(2), `≤ ${s2}`),
        h('span', {}, starsMini(1), t('game.anyCount')),
      ),
    )
  }

  const renderToolbar = () => {
    toolbar.replaceChildren()
    if (phase === 'place') {
      const sel = pl.selected >= 0
      const edit = h('div', { class: 'tool-group', attrs: { role: 'toolbar', 'aria-label': t('game.tools') } },
        IconButton('ccw', t('game.rotL'), () => rotate(15)),
        IconButton('cw', t('game.rotR'), () => rotate(-15)),
        IconButton('undo', t('game.undo'), () => { if (pl.undo()) { audio.remove(); refresh() } }),
        IconButton('redo', t('game.redo'), () => { if (pl.redo()) { audio.place(); refresh() } }),
        IconButton('trash', t('game.delete'), () => { if (pl.removeSelected()) { audio.remove(); refresh() } }),
        IconButton('check', t('game.placeHere'), () => commit()),
      )
      const btns = edit.querySelectorAll('button')
      btns[2].disabled = !pl.canUndo
      btns[3].disabled = !pl.canRedo
      btns[4].disabled = !sel
      btns[5].disabled = !pl.ghost || sel
      const push = Button({ label: t('btn.push'), icon: 'push', variant: 'primary', class: 'push-btn', onClick: () => doPush() })
      toolbar.append(edit, push)
    } else if (phase === 'run') {
      toolbar.append(h('div', { class: 'tool-group' },
        Button({ label: t('game.stop'), icon: 'rewind', onClick: () => backToPlace() }),
      ))
    }
  }

  const renderCam = () => {
    const top = IconButton('top', t(topView ? 'game.view3d' : 'game.viewTop'), () => { topView = !topView; stage.fitView(topView); renderCam() })
    if (topView) top.classList.add('on')
    camTools.replaceChildren(
      IconButton('zoomIn', t('game.zoomIn'), () => stage.zoom(0.8)),
      IconButton('zoomOut', t('game.zoomOut'), () => stage.zoom(1.25)),
      top,
      IconButton('orbit', t('game.resetView'), () => { topView = false; stage.fitView(false); renderCam() }),
      IconButton('info', t('game.hint'), () => { hintOpen = !hintOpen; renderHint() }),
      IconButton('pause', t('game.pause'), () => openPause()),
    )
  }

  const renderHint = () => {
    hintBar.replaceChildren()
    if (!hintOpen || !hintKey || phase !== 'place') return
    hintBar.append(h('div', { class: 'panel hint-bar', attrs: { role: 'note' } },
      icon('info'), h('p', { text: t(hintKey) }),
      IconButton('close', t('common.close'), () => { hintOpen = false; renderHint() }),
    ))
  }

  const renderBanner = (msg?: string) => {
    banner.replaceChildren()
    if (phase !== 'fail') return
    banner.append(h('div', { class: 'panel status-banner', attrs: { role: 'alert' } },
      h('p', { text: msg ?? t('game.failMsg', { n: level.dominoes.filter((d) => d.kind === 'target').length + level.pieces.filter((p) => p.type === 'block' && p.target).length - (runner?.sim.targetsFallen ?? 0) }) }),
      Button({ label: t('game.tryAgain'), icon: 'refresh', variant: 'primary', size: 'sm', onClick: () => backToPlace() }),
    ))
  }

  const renderCounter = () => {
    counter.replaceChildren()
    if (phase !== 'run' && phase !== 'fail') return
    const box = h('div', { class: 'panel fall-counter', attrs: { 'aria-live': 'off' } }, h('small', { text: t('game.fallen') }), h('span', { class: 'fc-n', text: String(fallen) }))
    counter.append(box)
  }

  const renderAll = () => {
    el.replaceChildren(
      h('div', { class: 'topleft', style: 'flex-direction:column;align-items:flex-start' },
        backButton(isRandom ? t('common.back') : t('game.levels'), () => leave()),
        info),
      camTools, counter, banner, hintBar, toolbar, popLayer,
    )
    renderInfo(); renderToolbar(); renderCam(); renderHint(); renderBanner(); renderCounter()
  }

  /* ───── 擺放 ───── */
  const refresh = () => {
    stage.setDominoes(pl.all())
    stage.setHighlight(pl.selected >= 0 ? level.dominoes.length + pl.selected : -1)
    updateGhost()
    renderInfo()
    renderToolbar()
  }

  const updateGhost = () => {
    if (phase !== 'place' || pl.selected >= 0) {
      stage.showGhost(null)
      stage.showGuide(null)
      return
    }
    stage.showGhost(pl.ghost, pl.ghostValid)
    stage.showGuide(getSettings().reachGuide ? pl.guideFor() : null)
  }

  const reasonText = (r: string) => t((`place.${r}`) as Key)

  const commit = () => {
    const r = pl.commit()
    if (r.ok) {
      audio.place()
      buzz(6)
      refresh()
    } else {
      audio.invalid()
      toast(reasonText(r.reason), 'warn', 1800)
      updateGhost()
    }
  }

  const rotate = (deg: number) => {
    const r = pl.rotate(deg)
    if (!r.ok) { audio.invalid(); toast(reasonText(r.reason), 'warn', 1500) } else audio.click()
    refresh()
  }

  const taps = new PointerTaps(stage.renderer.domElement, {
    hover: (x, y) => {
      if (phase !== 'place' || pl.selected >= 0) return
      const p = stage.pick(x, y)
      if (!p) return
      pl.moveGhost(p.x, p.z, p.y)
      updateGhost()
    },
    tap: (x, y, kind) => {
      if (phase !== 'place') return
      const di = stage.pickDomino(x, y)
      const base = level.dominoes.length
      if (di >= base) {
        pl.selected = pl.selected === di - base ? -1 : di - base
        audio.click()
        refresh()
        return
      }
      if (di >= 0) { toast(t('place.fixed'), 'info', 1400); return }
      if (pl.selected >= 0) { pl.selected = -1; refresh() }
      const p = stage.pick(x, y)
      if (!p) return
      if (kind === 'mouse') {
        pl.moveGhost(p.x, p.z, p.y)
        commit()
        return
      }
      const g = pl.ghost
      if (g && Math.hypot(g.x - p.x, g.z - p.z) < 0.45 && (g.y ?? 0) === p.y) commit()
      else {
        pl.moveGhost(p.x, p.z, p.y)
        updateGhost()
        renderToolbar()
      }
    },
    leave: () => { if (phase === 'place' && pl.ghost && !matchMedia('(pointer: coarse)').matches) { /* 保留預覽 */ } },
  })

  /* ───── 推動與結算 ───── */
  const popup = (x: number, y: number, z: number, text: string) => {
    if (getSettings().reduceMotion) return
    const p = stage.project(x, y, z)
    if (!p.visible) return
    const n = h('div', { class: 'popup', text, style: `left:${p.x}px;top:${p.y}px` })
    popLayer.appendChild(n)
    setTimeout(() => n.remove(), 1000)
  }

  const doPush = () => {
    if (phase !== 'place') return
    audio.unlock()
    audio.push()
    buzz(15)
    phase = 'run'
    fallen = 0
    winTimer = -1
    winArmed = false
    slowTimer = 0
    pl.selected = -1
    stage.setDominoes(pl.all())
    stage.setHighlight(-1)
    stage.showGhost(null)
    stage.showGuide(null)
    hintOpen = false
    runner = new Runner(app.R, level, pl.placed, {
      onImpact: (i) => {
        audio.impact(i.force, i.kind)
        if (i.force > 25 && i.kind !== 'plank') stage.puff(i.x, 0.05, i.z, 2)
        if (i.force > 60) buzz(5)
      },
      onFall: (_i, x, y, z, target) => {
        fallen++
        const fc = counter.querySelector('.fc-n')
        if (fc) { fc.textContent = String(fallen); fc.parentElement!.classList.remove('bump'); void (fc.parentElement as HTMLElement).offsetWidth; fc.parentElement!.classList.add('bump') }
        if (target) { popup(x, y + 0.8, z, '★'); audio.star(0) }
        else if (runner && runner.combo > 0 && runner.combo % 10 === 0) { popup(x, y + 0.8, z, t('game.combo', { n: runner.combo })); audio.combo(runner.combo) }
      },
    })
    stage.attachSim(runner.sim)
    runner.push()
    renderAll()
  }

  const backToPlace = () => {
    runner?.dispose()
    runner = null
    stage.detachSim()
    phase = 'place'
    paused = false
    stage.setLevel(level, pl.placed)
    refresh()
    renderAll()
  }

  const finish = (win: boolean) => {
    if (!runner) return
    if (!win) {
      phase = 'fail'
      audio.fail()
      recordRun({ mode: isRandom ? 'random' : 'challenge', fallen, combo: runner.bestCombo, win: false })
      trackGameEnd('lose', { stars: 0 })
      renderAll()
      return
    }
    phase = 'win'
    audio.win()
    const used = pl.used
    const stars = starsFor(level, used)
    let newBest = false
    if (!isRandom) newBest = recordWin(loadProgress(), level.id, stars, used).newBest
    else { const p = loadProgress(); p.randomWins++; saveProgress(p) }
    recordRun({ mode: isRandom ? 'random' : 'challenge', fallen, combo: runner.bestCombo, win: true })
    trackGameEnd('win', { stars })
    renderAll()
    showResult(stars, used, newBest)
  }

  const showResult = (stars: number, used: number, newBest: boolean) => {
    const st = h('div', { class: 'result-stars', attrs: { role: 'img', 'aria-label': t('common.starsAria', { n: stars }) } })
    for (let i = 0; i < 3; i++) st.appendChild(icon('star'))
    const lit = () => st.querySelectorAll('svg').forEach((s, i) => { if (i < stars) { setTimeout(() => { s.classList.add('lit'); s.style.color = 'var(--gold)'; audio.star(i) }, getSettings().reduceMotion ? 0 : 250 + i * 280) } })
    const next = !isRandom ? levelByNo(level.no + 1) : undefined
    const card = h('div', { class: 'result-body', attrs: { 'data-result-share': '' } },
      h('p', { class: 'result-level', text: title() }),
      st,
      h('p', { class: 'result-msg', text: t(stars === 3 ? 'result.perfect' : stars === 2 ? 'result.great' : 'result.good') }),
      h('div', { class: 'result-table' },
        h('span', { text: t('result.used') }), h('b', { text: `${used} / ${level.limit}` }),
        h('span', { text: t('result.fallen') }), h('b', { text: String(fallen) }),
        h('span', { text: t('result.combo') }), h('b', { text: String(runner?.bestCombo ?? 0) }),
        h('span', { text: t('result.threshold') }), h('b', { text: `★★★ ≤ ${level.star3}` }),
      ),
      newBest ? h('span', { class: 'tag tag-ok', text: t('result.newBest') }) : null,
      stars < 3 ? h('p', { class: 'field-hint', text: t('result.tip3', { n: level.star3 }) }) : null,
    )
    const body = h('div', { class: 'result-body result-split' }, card)
    const actions = h('div', { class: 'result-actions' })
    if (next) actions.append(Button({ label: t('result.next'), icon: 'play', variant: 'primary', class: 'wide', onClick: () => { result?.close(); app.go({ to: 'game', level: next.no }) } }))
    if (isRandom) actions.append(Button({ label: t('result.nextRandom'), icon: 'dice', variant: 'gold', class: 'wide', onClick: () => { result?.close(); app.go({ to: 'random', seed: Math.floor(Math.random() * 900000) + 100000 }) } }))
    actions.append(
      Button({ label: t('result.again'), icon: 'refresh', onClick: () => { result?.close(); app.go(isRandom ? { to: 'random', seed: level.seed ?? 1 } : { to: 'game', level: level.no }) } }),
      Button({ label: t('result.toLevels'), icon: 'grid', onClick: () => { result?.close(); app.go({ to: 'levels', chapter: CHAPTERS.indexOf(level.theme) }) } }),
      Button({ label: t('common.home'), icon: 'home', class: 'wide', onClick: () => { result?.close(); app.go({ to: 'home' }) } }),
    )
    body.append(actions)
    result = openModal({ title: t('result.title'), body, width: 'sm', closeLabel: t('common.close'), dismissible: false })
    result.el.classList.add('result')
    lit()
  }

  const openPause = () => {
    if (pauseM || result) return
    paused = true
    const close = () => { pauseM?.close() }
    pauseM = openModal({
      title: t('pause.title'),
      width: 'sm',
      closeLabel: t('common.close'),
      body: h('div', { class: 'result-actions', style: 'grid-template-columns:1fr' },
        Button({ label: t('pause.resume'), icon: 'play', variant: 'primary', onClick: close }),
        Button({ label: t('pause.restart'), icon: 'refresh', onClick: () => { close(); app.go(isRandom ? { to: 'random', seed: level.seed ?? 1 } : { to: 'game', level: level.no }) } }),
        Button({ label: t('game.levels'), icon: 'grid', onClick: () => { close(); leave() } }),
      ),
      onClose: () => { pauseM = null; paused = false },
    })
  }

  const leave = () => {
    if (isRandom) app.go({ to: 'levels' })
    else app.go({ to: 'levels', chapter: CHAPTERS.indexOf(level.theme) })
  }

  const offSettings = onSettings((s) => { pl.autoAim = s.autoAim; updateGhost() })

  renderAll()
  refresh()
  // 開發與自動測試用：直接擺上標準解
  if (import.meta.env.DEV) { const w = window as unknown as { __dpSolve?: () => void; __dpResult?: (n: number) => void }; w.__dpSolve = () => { pl.load(level.solution.map((d) => ({ ...d }))); refresh() }; w.__dpResult = (n) => showResult(n, level.star3 + 3 - n, n === 3); (w as unknown as { __dpSolutionScreen?: () => { x: number; y: number }[] }).__dpSolutionScreen = () => level.solution.map((d) => stage.project(d.x, (d.y ?? 0) + 0.02, d.z)) }

  return {
    name: 'game',
    el,
    relabel: () => { renderAll(); if (result) { /* 結算視窗文字維持，關閉後即更新 */ } },
    onBack() { if (pauseM) return false; openPause(); return true },
    onKey(e) {
      const k = e.key
      if (k === 'Escape') { openPause(); return true }
      if (result) return false
      if (phase === 'place') {
        if (k === 'q' || k === 'Q' || k === 'ArrowLeft') { rotate(15); return true }
        if (k === 'e' || k === 'E' || k === 'ArrowRight') { rotate(-15); return true }
        if (k === 'Enter') { commit(); return true }
        if (k === 'Delete' || k === 'Backspace') { if (pl.removeSelected()) { audio.remove(); refresh() } return true }
        if ((k === 'z' || k === 'Z') && !e.shiftKey) { if (pl.undo()) refresh(); return true }
        if (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey)) { if (pl.redo()) refresh(); return true }
        if (k === ' ') { doPush(); return true }
      } else if (phase === 'run' || phase === 'fail') {
        if (k === ' ' || k === 'r' || k === 'R') { backToPlace(); return true }
      }
      if (k === 't' || k === 'T') { topView = !topView; stage.fitView(topView); renderCam(); return true }
      return false
    },
    update(dt) {
      if (!runner || paused) return
      if (phase === 'run' || phase === 'win' || phase === 'fail') {
        runner.timeScale = slowTimer > 0 ? 0.3 : 1
        if (slowTimer > 0) slowTimer -= dt
        runner.update(dt)
        stage.syncFrom()
        const sim = runner.sim
        if (getSettings().cameraFollow && phase === 'run' && sim.fallenCount > 0 && !topView) {
          const f = sim.lastFall
          stage.follow(f.x, f.z, Math.min(1, dt * 1.2))
        }
        if (phase === 'run') {
          const allDown = sim.targetsTotal > 0 && sim.targetsFallen === sim.targetsTotal
          if (allDown && !winArmed) {
            winTimer = 1.6
            winArmed = true
            if (!getSettings().reduceMotion) slowTimer = 1.0
          }
          if (winArmed) {
            winTimer -= dt
            if (winTimer <= 0 && (runner.settled || winTimer < -6)) finish(true)
          } else if (runner.settled) finish(false)
        }
      }
    },
    dispose() {
      taps.dispose()
      offSettings()
      runner?.dispose()
      stage.detachSim()
      stage.showGhost(null)
      stage.showGuide(null)
      result?.close()
      pauseM?.close()
      if (phase !== 'win') trackGameEnd('lose')
    },
  }
}

function starsMini(n: number): HTMLElement {
  const s = h('span', { attrs: { 'aria-hidden': 'true' } })
  for (let i = 0; i < n; i++) s.appendChild(icon('star'))
  return s
}

export { allLevels }
