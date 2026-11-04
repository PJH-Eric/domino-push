import type { App, Screen } from '../app'
import { trackGameEnd, trackGameStart } from '../analytics'
import { audio, buzz } from '../audio/engine'
import type { DominoSpec, ThemeId } from '../core/types'
import { Placement } from '../game/placement'
import { Replay, Runner } from '../game/runner'
import { buildShape, PAINTS, POINTS_NEEDED, type ShapeTool } from '../game/shapes'
import { getSettings, onSettings } from '../game/settings'
import { loadSlots, SAVE_VERSION, SLOT_COUNT, writeSlot } from '../storage/progress'
import { loadStats, recordPlaced, recordRun, recordSave, recordShape, sandboxScore } from '../storage/records'
import { t, type Key } from '../i18n'
import { h } from '../ui/dom'
import { icon, type IconName } from '../ui/icons'
import { Button, IconButton, openModal, ScrollArea, Segmented, TextField, toast, type ModalHandle } from '../ui/kit'
import { backButton, confirmBox, screenEl } from './common'
import { CHAPTERS } from './levels'
import { PointerTaps } from './pointer'

type Phase = 'build' | 'pick' | 'run' | 'done' | 'replay'

const AREA = { minX: -12, maxX: 12, minZ: -8, maxZ: 8 }
const TOOLS: { id: ShapeTool; icon: IconName }[] = [
  { id: 'single', icon: 'single' },
  { id: 'line', icon: 'line' },
  { id: 'curve', icon: 'curve' },
  { id: 'circle', icon: 'circle' },
  { id: 'spiral', icon: 'spiral' },
  { id: 'fork', icon: 'fork' },
  { id: 'eraser', icon: 'eraser' },
]
const SPACINGS = [0.56, 0.66, 0.8]
const SPEEDS = [1, 0.5, 0.25, 0.1]

/** 自由沙盒：自由擺放、圖形工具、存檔、慢動作、重播與分數 */
export function sandboxScreen(app: App): Screen {
  const stage = app.stage
  const el = screenEl('sandbox')
  const base = { dominoes: [] as DominoSpec[], pieces: [], zones: [], bounds: { minX: -8, maxX: 8, minZ: -5, maxZ: 5 } }
  const pl = new Placement({ base: [], zones: null, pieces: [], kind: 'free', limit: 600, area: AREA })
  pl.autoAim = getSettings().autoAim
  let phase: Phase = 'build'
  let tool: ShapeTool = 'single'
  let pts: { x: number; z: number }[] = []
  let hoverPt: { x: number; z: number } | null = null
  let spacing = 1
  let theme: ThemeId = 'village'
  let speed = 0
  let runner: Runner | null = null
  let replay: Replay | null = null
  let frames: Float32Array[] = []
  let fallen = 0
  let scoreM: ModalHandle | null = null
  let pauseM: ModalHandle | null = null
  let topView = false
  let lastScore: ReturnType<typeof sandboxScore> | null = null
  let toolsOpen = window.innerWidth >= 700 && window.innerHeight >= 520

  stage.setTheme(theme)
  audio.setTheme(theme)
  stage.setLevel(base, [])
  stage.fitView(false, false)
  trackGameStart({ mode: 'sandbox' })

  const info = h('div', { class: 'panel hud-info', attrs: { role: 'status', 'aria-live': 'polite' } })
  const left = h('div', { class: 'sb-left' })
  const toolbar = h('div', { class: 'toolbar' })
  const camTools = h('div', { class: 'cam-tools' })
  const banner = h('div', { class: 'pass' })
  const counter = h('div', { class: 'pass' })

  const shapeOpts = () => ({ size: pl.size, color: pl.color, spacing: SPACINGS[spacing] })
  const shapePreview = (): DominoSpec[] => {
    if (tool === 'single' || tool === 'eraser') return []
    const need = POINTS_NEEDED[tool]
    const p = pts.length < need && hoverPt ? [...pts, hoverPt] : pts
    return buildShape(tool, p, shapeOpts())
  }

  const stepHint = (): string => {
    if (phase === 'pick') return t('sb.pickHint')
    if (tool === 'single') return t('sb.h.single')
    if (tool === 'eraser') return t('sb.h.eraser')
    const need = POINTS_NEEDED[tool]
    if (pts.length >= need) return t('sb.h.confirm', { n: shapePreview().length })
    return t((`sb.h.${tool}${pts.length}`) as Key)
  }

  const renderInfo = () => {
    const best = loadStats().sandboxBest
    info.replaceChildren(...[
      h('div', { class: 'hud-title', text: t('home.sandbox') }),
      h('div', { class: 'hud-row' }, icon('domino'), h('span', { class: `hud-count${pl.used >= 600 ? ' warn' : ''}`, text: `${pl.used} / 600` })),
      h('div', { class: 'hud-row' }, icon('target'), h('span', { text: t('sb.best', { n: best }) })),
      phase === 'build' || phase === 'pick' ? h('div', { class: 'field-hint', style: 'font-weight:700;color:var(--ink)', text: stepHint() }) : null,
    ].filter((x): x is HTMLDivElement => !!x))
  }

  const renderLeft = () => {
    left.replaceChildren()
    if (phase !== 'build') return
    const list = h('div', { class: 'sb-list' })
    list.append(h('div', { class: 'sb-section-title', text: t('sb.tools') }))
    for (const tl of TOOLS) {
      const b = Button({ label: t((`sb.tool.${tl.id}`) as Key), icon: tl.icon, size: 'sm', class: `sb-tool${tool === tl.id ? ' on' : ''}`, onClick: () => { tool = tl.id; pts = []; pl.selected = -1; audio.click(); refreshAll() } })
      b.setAttribute('aria-pressed', String(tool === tl.id))
      list.append(b)
    }
    list.append(h('div', { class: 'sb-section-title', text: t('sb.color') }))
    const colors = h('div', { class: 'sb-colors', attrs: { role: 'radiogroup', 'aria-label': t('sb.color') } })
    PAINTS.forEach((c, i) => {
      const on = pl.color === c
      const dot = h('button', { class: `color-dot${on ? ' on' : ''}`, style: `background:${c === undefined ? '#f0d3a0' : '#' + c.toString(16).padStart(6, '0')}`, attrs: { type: 'button', role: 'radio', 'aria-checked': String(on), 'aria-label': t((`sb.c${i}`) as Key) } })
      dot.addEventListener('click', () => { pl.color = c; audio.click(); refreshAll() })
      colors.append(dot)
    })
    list.append(colors)
    list.append(h('div', { class: 'sb-section-title', text: t('sb.size') }))
    const sizes = Segmented({ value: pl.size, options: [{ value: 's', label: t('sb.s') }, { value: 'm', label: t('sb.m') }, { value: 'l', label: t('sb.l') }], onChange: (v) => { pl.size = v; refreshAll() } })
    sizes.classList.add('sb-sizes-f')
    list.append(sizes)
    list.append(h('div', { class: 'sb-section-title', text: t('sb.spacing') }))
    list.append(Segmented({ value: spacing, options: [{ value: 0, label: t('sb.sp0') }, { value: 1, label: t('sb.sp1') }, { value: 2, label: t('sb.sp2') }], onChange: (v) => { spacing = v; refreshAll() } }))
    list.append(h('div', { class: 'sb-section-title', text: t('sb.theme') }))
    list.append(Button({ label: t((`chapter.${theme}`) as Key), icon: 'palette', size: 'sm', class: 'sb-tool', onClick: () => {
      theme = CHAPTERS[(CHAPTERS.indexOf(theme) + 1) % CHAPTERS.length]
      stage.setTheme(theme)
      audio.setTheme(theme)
      stage.setLevel(base, pl.placed)
      refreshAll()
    } }))
    const toggle = Button({ label: t(toolsOpen ? 'sb.hideTools' : 'sb.showTools'), icon: TOOLS.find((x) => x.id === tool)!.icon, size: 'sm', class: 'sb-toggle', onClick: () => { toolsOpen = !toolsOpen; renderLeft() } })
    toggle.setAttribute('aria-expanded', String(toolsOpen))
    left.append(toggle)
    if (!toolsOpen) return
    const sa = ScrollArea({ class: 'sb-scroll', label: t('sb.tools') }, list)
    left.append(h('div', { class: 'sb-tools' }, sa.el))
  }

  const renderToolbar = () => {
    toolbar.replaceChildren()
    if (phase === 'build') {
      const g = h('div', { class: 'tool-group', attrs: { role: 'toolbar', 'aria-label': t('game.tools') } },
        IconButton('ccw', t('game.rotL'), () => rotate(15)),
        IconButton('cw', t('game.rotR'), () => rotate(-15)),
        IconButton('undo', t('game.undo'), () => { if (pl.undo()) { audio.remove(); refresh() } }),
        IconButton('redo', t('game.redo'), () => { if (pl.redo()) { audio.place(); refresh() } }),
        IconButton('trash', t('game.delete'), () => { if (pl.removeSelected()) { audio.remove(); refresh() } }),
        IconButton('check', t('sb.confirm'), () => confirm()),
        IconButton('folder', t('sb.saveLoad'), () => openSlots()),
        IconButton('eraser', t('sb.clear'), () => { if (pl.used) confirmBox({ title: t('sb.clear'), text: t('sb.clearConfirm'), ok: t('sb.clear'), danger: true, onOk: () => { pl.clear(); refresh() } }) }),
      )
      const btns = g.querySelectorAll('button')
      btns[2].disabled = !pl.canUndo
      btns[3].disabled = !pl.canRedo
      btns[4].disabled = pl.selected < 0
      btns[5].disabled = tool === 'single' ? !pl.ghost : pts.length < POINTS_NEEDED[tool]
      btns[7].disabled = !pl.used
      toolbar.append(g, Button({ label: t('btn.push'), icon: 'push', variant: 'primary', class: 'push-btn', onClick: () => startPick() }))
    } else if (phase === 'pick') {
      toolbar.append(h('div', { class: 'tool-group' }, Button({ label: t('common.cancel'), icon: 'close', onClick: () => { phase = 'build'; refreshAll() } })))
    } else {
      const sp = Segmented({ value: speed, options: SPEEDS.map((v, i) => ({ value: i, label: v === 1 ? '1×' : `${v}×` })), onChange: (v) => { speed = v; if (runner) runner.timeScale = SPEEDS[v]; if (replay) replay.timeScale = SPEEDS[v] } })
      sp.classList.add('sb-time-f')
      sp.setAttribute('aria-label', t('sb.speed'))
      const g = h('div', { class: 'tool-group', style: 'align-items:center' }, h('span', { class: 'sb-count', text: t('sb.speed') }), sp)
      const actions = h('div', { class: 'tool-group' })
      if (phase === 'done' && frames.length > 1) actions.append(Button({ label: t('sb.replay'), icon: 'replay', onClick: () => startReplay() }))
      if (phase === 'done' && lastScore) actions.append(Button({ label: t('sb.score'), icon: 'target', onClick: () => showScore() }))
      actions.append(Button({ label: t('game.stop'), icon: 'rewind', variant: 'gold', onClick: () => backToBuild() }))
      toolbar.append(g, actions)
    }
  }

  const panBtn = () => {
    const b = IconButton('move', t('game.panMode'), () => { stage.setPanMode(!stage.panMode); renderCam() })
    if (stage.panMode) b.classList.add('on')
    return b
  }

  const renderCam = () => {
    const top = IconButton('top', t(topView ? 'game.view3d' : 'game.viewTop'), () => { topView = !topView; stage.fitView(topView); renderCam() })
    if (topView) top.classList.add('on')
    camTools.replaceChildren(
      IconButton('zoomIn', t('game.zoomIn'), () => stage.zoom(0.8)),
      IconButton('zoomOut', t('game.zoomOut'), () => stage.zoom(1.25)),
      top,
      panBtn(),
      IconButton('orbit', t('game.resetView'), () => { topView = false; stage.fitView(false); renderCam() }),
      IconButton('pause', t('game.pause'), () => openPause()),
    )
  }

  const renderBanner = () => {
    banner.replaceChildren()
    if (phase !== 'pick') return
    banner.append(h('div', { class: 'panel status-banner', attrs: { role: 'alert' } }, icon('hand'), h('p', { text: t('sb.pickHint') })))
  }

  const renderCounter = () => {
    counter.replaceChildren()
    if (phase !== 'run' && phase !== 'done' && phase !== 'replay') return
    counter.append(h('div', { class: 'panel fall-counter' }, h('small', { text: t(phase === 'replay' ? 'sb.replaying' : 'game.fallen') }), h('span', { class: 'fc-n', text: String(fallen) })))
  }

  const refreshAll = () => {
    el.replaceChildren(
      h('div', { class: 'sb-col' }, backButton(t('common.home'), () => leave()), info, left),
      camTools, counter, banner, toolbar,
    )
    renderInfo(); renderLeft(); renderToolbar(); renderCam(); renderBanner(); renderCounter()
    updatePreview()
  }

  const refresh = () => {
    stage.setDominoes(pl.all())
    stage.setHighlight(pl.selected)
    renderInfo()
    renderToolbar()
    updatePreview()
  }

  const updatePreview = () => {
    if (phase !== 'build') {
      stage.showGhost(null); stage.showGhosts([]); stage.showGuide(null)
      return
    }
    if (tool === 'single' && pl.selected < 0) {
      stage.showGhost(pl.ghost, pl.ghostValid)
      stage.showGuide(getSettings().reachGuide ? pl.guideFor() : null)
    } else {
      stage.showGhost(null)
      stage.showGuide(null)
    }
    stage.showGhosts(shapePreview())
  }

  const reason = (r: string) => t((`place.${r}`) as Key)

  const confirm = () => {
    if (tool === 'single') {
      const r = pl.commit()
      if (r.ok) { audio.place(); recordPlaced(1); refresh() } else { audio.invalid(); toast(reason(r.reason), 'warn', 1600) }
      return
    }
    if (pts.length < POINTS_NEEDED[tool]) return
    const list = shapePreview()
    const n = pl.addMany(list)
    if (n > 0) {
      audio.place()
      buzz(10)
      recordPlaced(n)
      recordShape(tool)
      if (n < list.length) toast(t('sb.partial', { n, m: list.length }), 'warn')
    } else { audio.invalid(); toast(t('sb.none'), 'warn') }
    pts = []
    refresh()
    renderInfo()
  }

  const rotate = (deg: number) => {
    const r = pl.rotate(deg)
    if (!r.ok) { audio.invalid(); toast(reason(r.reason), 'warn', 1500) } else audio.click()
    refresh()
  }

  const taps = new PointerTaps(stage.renderer.domElement, {
    hover: (x, y) => {
      if (phase !== 'build') return
      const p = stage.pick(x, y)
      if (!p) return
      if (tool === 'single') { if (pl.selected < 0) { pl.moveGhost(p.x, p.z, 0); updatePreview() } }
      else if (tool !== 'eraser' && pts.length < POINTS_NEEDED[tool]) { hoverPt = { x: p.x, z: p.z }; updatePreview() }
    },
    tap: (x, y, kind) => {
      if (phase === 'pick') {
        const di = stage.pickDomino(x, y, kind === 'touch' ? 40 : 28)
        if (di >= 0) doPush(di)
        return
      }
      if (phase !== 'build') return
      const di = stage.pickDomino(x, y, tool === 'eraser' || tool === 'single' ? (kind === 'touch' ? 22 : 10) : 0)
      if (tool === 'eraser') {
        if (di >= 0) { pl.removeAt(di); audio.remove(); refresh() }
        return
      }
      if (tool === 'single' && di >= 0) {
        pl.selected = pl.selected === di ? -1 : di
        audio.click()
        refresh()
        return
      }
      if (pl.selected >= 0) { pl.selected = -1; refresh() }
      const p = stage.pick(x, y)
      if (!p) return
      if (tool === 'single') {
        if (kind === 'mouse') { pl.moveGhost(p.x, p.z, 0); confirm(); return }
        const g = pl.ghost
        if (g && Math.hypot(g.x - p.x, g.z - p.z) < 0.45) confirm()
        else { pl.moveGhost(p.x, p.z, 0); updatePreview(); renderToolbar() }
        return
      }
      if (pts.length >= POINTS_NEEDED[tool]) pts = []
      pts.push({ x: p.x, z: p.z })
      hoverPt = null
      audio.click()
      renderInfo()
      renderToolbar()
      updatePreview()
    },
  })

  /* ───── 推動、計分、重播 ───── */
  const startPick = () => {
    if (!pl.used) { toast(t('sb.empty'), 'warn'); return }
    if (pl.selected >= 0) { doPush(pl.selected); return }
    phase = 'pick'
    pts = []
    refreshAll()
  }

  const doPush = (idx: number) => {
    audio.unlock()
    audio.push()
    buzz(15)
    phase = 'run'
    fallen = 0
    pl.selected = -1
    stage.setDominoes(pl.all())
    stage.setHighlight(-1)
    runner = new Runner(app.R, base, pl.placed, {
      onImpact: (i) => {
        audio.impact(i.force, i.kind)
        if (i.force > 25) stage.puff(i.x, 0.05, i.z, 2)
        if (i.force > 60) buzz(5)
      },
      onFall: () => {
        fallen++
        const fc = counter.querySelector('.fc-n')
        if (fc) fc.textContent = String(fallen)
        if (runner && runner.combo > 0 && runner.combo % 25 === 0) audio.combo(runner.combo)
      },
    })
    runner.timeScale = SPEEDS[speed]
    stage.attachSim(runner.sim)
    runner.push(idx)
    refreshAll()
  }

  const finishRun = () => {
    if (!runner) return
    const sim = runner.sim
    const colors = new Set<string>()
    let lastFall = 0
    sim.info.forEach((inf) => {
      if (!inf.fallen) return
      colors.add(String(inf.spec?.color ?? 'wood'))
      lastFall = Math.max(lastFall, inf.fallAt)
    })
    lastScore = sandboxScore({ fallen: sim.fallenCount, combo: runner.bestCombo, colors: colors.size, time: lastFall, allFell: sim.fallenCount === pl.used, total: pl.used })
    const prevBest = loadStats().sandboxBest
    recordRun({ mode: 'sandbox', fallen: sim.fallenCount, combo: runner.bestCombo, colors: colors.size, allFell: sim.fallenCount === pl.used, total: pl.used, score: lastScore.total })
    frames = runner.frames
    phase = 'done'
    audio.win()
    trackGameEnd('complete')
    refreshAll()
    showScore(lastScore.total > prevBest)
  }

  const showScore = (newBest = false) => {
    if (!lastScore) return
    const sc = lastScore
    const rows = sc.lines.flatMap(([k, v]) => [h('span', { text: t((`sb.sc.${k}`) as Key) }), h('b', { text: `+${v}` })])
    const body = h('div', { class: 'result-body', attrs: { 'data-result-share': '' } },
      h('p', { class: 'result-msg', text: t('sb.scoreTitle') }),
      h('div', { class: 'score-big', text: String(sc.total) }),
      newBest ? h('span', { class: 'tag tag-ok', text: t('result.newBest') }) : h('span', { class: 'tag', text: t('sb.best', { n: loadStats().sandboxBest }) }),
      h('div', { class: 'result-table' }, rows, h('span', { text: t('sb.usedDominoes') }), h('b', { text: String(pl.used) })),
    )
    const actions = h('div', { class: 'result-actions' },
      frames.length > 1 ? Button({ label: t('sb.replaySlow'), icon: 'replay', variant: 'primary', class: 'wide', onClick: () => { scoreM?.close(); speed = 2; startReplay() } }) : null,
      Button({ label: t('sb.again'), icon: 'refresh', onClick: () => { scoreM?.close(); backToBuild() } }),
      Button({ label: t('sb.toRecords'), icon: 'star', onClick: () => { scoreM?.close(); app.go({ to: 'records' }) } }),
      Button({ label: t('common.home'), icon: 'home', class: 'wide', onClick: () => { scoreM?.close(); app.go({ to: 'home' }) } }),
    )
    scoreM = openModal({ title: t('sb.score'), body: h('div', { class: 'result-body result-split' }, body, actions), width: 'sm', closeLabel: t('common.close'), onClose: () => { scoreM = null } })
    scoreM.el.classList.add('result')
  }

  const startReplay = () => {
    if (frames.length < 2) return
    runner?.dispose()
    runner = null
    replay = new Replay(frames)
    replay.timeScale = SPEEDS[speed]
    stage.detachSim()
    stage.setDominoes(pl.all())
    fallen = 0
    phase = 'replay'
    refreshAll()
  }

  const backToBuild = () => {
    runner?.dispose()
    runner = null
    replay = null
    stage.detachSim()
    stage.setLevel(base, pl.placed)
    phase = 'build'
    refreshAll()
    refresh()
  }

  /* ───── 存檔 ───── */
  const openSlots = () => {
    const body = h('div', { class: 'slot-list' })
    let name = t('sb.defaultName', { n: new Date().toLocaleDateString(document.documentElement.lang || undefined) })
    const nameField = TextField({ label: t('sb.saveName'), value: name, maxLength: 24, onInput: (v) => { name = v } })
    let m: ModalHandle | null = null
    const render = () => {
      const slots = loadSlots()
      body.replaceChildren(nameField.el, ...slots.map((s, i) => h('div', { class: 'slot' },
        h('div', {},
          h('div', { class: 'slot-name', text: s ? s.name || t('sb.slotN', { n: i + 1 }) : t('sb.slotEmpty', { n: i + 1 }) }),
          s ? h('div', { class: 'slot-meta', text: t('sb.slotMeta', { n: s.dominoes.length, d: new Date(s.at).toLocaleString(document.documentElement.lang || undefined) }) }) : null),
        h('div', { class: 'slot-btns' },
          Button({ label: t('sb.saveHere'), icon: 'save', size: 'sm', disabled: !pl.used, onClick: () => {
            const doSave = () => {
              const ok = writeSlot(i, { v: SAVE_VERSION, name: name.trim().slice(0, 24) || t('sb.slotN', { n: i + 1 }), at: Date.now(), theme, dominoes: pl.placed.map(({ x, z, a, size, color }) => ({ x: Math.round(x * 1000) / 1000, z: Math.round(z * 1000) / 1000, a: Math.round(a * 1000) / 1000, kind: 'free' as const, size, color })) })
              if (ok) { toast(t('sb.saved'), 'ok'); recordSave() } else toast(t('sb.saveFail'), 'warn')
              render()
            }
            if (s) confirmBox({ title: t('sb.overwrite'), text: t('sb.overwriteText'), ok: t('sb.saveHere'), onOk: doSave })
            else doSave()
          } }),
          s ? Button({ label: t('sb.load'), icon: 'folder', size: 'sm', variant: 'blue', onClick: () => {
            const doLoad = () => {
              pl.load(s.dominoes)
              if (CHAPTERS.includes(s.theme as ThemeId)) { theme = s.theme as ThemeId; stage.setTheme(theme); audio.setTheme(theme) }
              stage.setLevel(base, pl.placed)
              m?.close()
              refreshAll()
              refresh()
              toast(t('sb.loaded'), 'ok')
            }
            if (pl.used) confirmBox({ title: t('sb.load'), text: t('sb.loadConfirm'), ok: t('sb.load'), onOk: doLoad })
            else doLoad()
          } }) : null,
          s ? IconButton('trash', t('sb.deleteSlot'), () => confirmBox({ title: t('sb.deleteSlot'), text: t('sb.deleteConfirm'), ok: t('sb.deleteSlot'), danger: true, onOk: () => { writeSlot(i, null); render() } })) : null,
        ))))
    }
    render()
    m = openModal({ title: t('sb.saveLoad'), body, closeLabel: t('common.close') })
    void SLOT_COUNT
  }

  const openPause = () => {
    if (pauseM) return
    const close = () => pauseM?.close()
    pauseM = openModal({
      title: t('pause.title'), width: 'sm', closeLabel: t('common.close'),
      body: h('div', { class: 'result-actions', style: 'grid-template-columns:1fr' },
        Button({ label: t('pause.resume'), icon: 'play', variant: 'primary', onClick: close }),
        Button({ label: t('sb.clear'), icon: 'eraser', onClick: () => { close(); backToBuild(); pl.clear(); refresh() } }),
        Button({ label: t('common.home'), icon: 'home', onClick: () => { close(); leave() } }),
      ),
      onClose: () => { pauseM = null },
    })
  }

  const leave = () => app.go({ to: 'home' })
  const offSettings = onSettings((s) => { pl.autoAim = s.autoAim; updatePreview() })
  if (import.meta.env.DEV) (window as unknown as { __dpSandbox?: (n: number) => void }).__dpSandbox = (n) => { if (n === -2) { lastScore = sandboxScore({ fallen: 180, combo: 120, colors: 6, time: 14.2, allFell: true, total: 180 }); showScore(true); return } if (n < 0) { doPush(0); return } PAINTS.forEach((c, i) => { pl.color = c; pl.addMany(buildShape('line', [{ x: -9, z: -6 + i * 1.6 }, { x: 9, z: -6 + i * 1.6 }], shapeOpts())) }); pl.color = undefined; void n; refresh() }

  refreshAll()

  return {
    name: 'sandbox',
    el,
    relabel: refreshAll,
    onBack() { if (pauseM) return false; openPause(); return true },
    onKey(e) {
      const k = e.key
      if (k === 'Escape') {
        if (phase === 'pick') { phase = 'build'; refreshAll(); return true }
        if (pts.length) { pts = []; refreshAll(); return true }
        openPause()
        return true
      }
      if (scoreM) return false
      if (phase === 'build') {
        if (k === 'q' || k === 'Q') { rotate(15); return true }
        if (k === 'e' || k === 'E') { rotate(-15); return true }
        if (k === 'Enter') { confirm(); return true }
        if (k === 'Delete' || k === 'Backspace') { if (pl.removeSelected()) { audio.remove(); refresh() } return true }
        if ((k === 'z' || k === 'Z') && !e.shiftKey) { if (pl.undo()) refresh(); return true }
        if (k === 'y' || k === 'Y') { if (pl.redo()) refresh(); return true }
        if (k === ' ') { startPick(); return true }
        const n = Number(k)
        if (n >= 1 && n <= TOOLS.length) { tool = TOOLS[n - 1].id; pts = []; refreshAll(); return true }
      } else if (phase !== 'pick' && (k === ' ' || k === 'r' || k === 'R')) { backToBuild(); return true }
      if (k === 't' || k === 'T') { topView = !topView; stage.fitView(topView); renderCam(); return true }
      return false
    },
    update(dt) {
      if (pauseM) return
      if (runner && phase === 'run') {
        runner.update(dt)
        stage.syncFrom()
        if (getSettings().cameraFollow && runner.sim.fallenCount > 0 && !topView) {
          const f = runner.sim.lastFall
          stage.follow(f.x, f.z, Math.min(1, dt * 1.0))
        }
        if (runner.settled) finishRun()
      } else if (replay && phase === 'replay') {
        stage.syncFrom(replay.update(dt))
        const fc = counter.querySelector('.fc-n')
        if (fc) fc.textContent = `${Math.round(replay.progress * 100)}%`
        if (replay.done) { phase = 'done'; replay = null; refreshAll() }
      }
    },
    dispose() {
      stage.setPanMode(false)
      taps.dispose()
      offSettings()
      runner?.dispose()
      stage.detachSim()
      stage.showGhost(null)
      stage.showGhosts([])
      stage.showGuide(null)
      scoreM?.close()
      pauseM?.close()
      if (phase === 'build') trackGameEnd('complete')
    },
  }
}
