import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { dims, facing, pointInRect } from '../core/geom'
import type { DominoSpec, Piece, ThemeId, Zone } from '../core/types'
import type { Sim } from '../physics/sim'
import { buildDecor } from './decor'
import { clothTexture, dominoWood, skyTexture, symbolTexture, THEMES, woodTexture, zoneTexture } from './textures'

export const CAPACITY = 720

export interface SceneBase {
  dominoes: DominoSpec[]
  pieces: Piece[]
  zones: Zone[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

export type Quality = 'high' | 'medium' | 'low'

const BAND: Record<string, number> = { start: 0xe0453a, target: 0xf2b630, fixed: 0x6b4426 }
const TONES: Record<string, number> = { light: 0xe9c48e, dark: 0x9a6a3e, red: 0xd9584a, blue: 0x4f86c6, green: 0x67a95a, yellow: 0xf0c240, purple: 0x9a6cc8 }

type DynVisual = { kind: 'domino'; index: number } | { kind: 'mesh'; obj: THREE.Object3D }

const tmpM = new THREE.Matrix4()
const tmpM2 = new THREE.Matrix4()
const tmpP = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3()
const tmpC = new THREE.Color()
const RY90 = new THREE.Matrix4().makeRotationY(Math.PI / 2)
const RYm90 = new THREE.Matrix4().makeRotationY(-Math.PI / 2)
const RY180 = new THREE.Matrix4().makeRotationY(Math.PI)

/**
 * 3D 舞台：桌面、桌布主題、骨牌（InstancedMesh）、機關、可擺放區與擺放預覽。
 * 擺放階段由規格繪製；推動後由物理世界同步位置。
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  readonly el: HTMLElement
  private sun: THREE.DirectionalLight
  private hemi: THREE.HemisphereLight
  private woodTex = dominoWood()
  private dominoMesh: THREE.InstancedMesh
  private bandMesh: THREE.InstancedMesh
  private symMesh: Record<'arrow' | 'star' | 'lock', THREE.InstancedMesh>
  private levelGroup = new THREE.Group()
  private themeGroup = new THREE.Group()
  private ghost: THREE.Mesh
  private ghostMat: THREE.MeshStandardMaterial
  private ghosts: THREE.InstancedMesh
  private guide: THREE.Mesh
  private dyn: DynVisual[] = []
  private specs: DominoSpec[] = []
  private zones: Zone[] = []
  private highlight = -1
  private sim: Sim | null = null
  private dust: { mesh: THREE.InstancedMesh; life: Float32Array; vel: Float32Array; pos: Float32Array; next: number }
  private ro: ResizeObserver
  private theme: ThemeId | null = null
  quality: Quality = 'high'
  /** 色彩輔助：色帶與符號放大 */
  assist = false
  private camAnim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number; dur: number } | null = null
  bounds = { minX: -6, maxX: 6, minZ: -4, maxZ: 4 }

  constructor(el: HTMLElement) {
    this.el = el
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'stage-canvas'
    el.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400)
    this.camera.position.set(0, 9, 11)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.maxPolarAngle = 1.36
    this.controls.minDistance = 3
    this.controls.maxDistance = 60
    this.controls.screenSpacePanning = false
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    this.bindPanKeys()

    this.hemi = new THREE.HemisphereLight(0xfff6e8, 0x8a6a4a, 1.25)
    this.scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.2)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sun, this.sun.target)
    this.scene.add(this.themeGroup, this.levelGroup)

    // 骨牌本體：圓角木塊（單位尺寸，以矩陣縮放）
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.07)
    const mat = new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.62, metalness: 0 })
    this.dominoMesh = new THREE.InstancedMesh(geo, mat, CAPACITY)
    this.dominoMesh.castShadow = true
    this.dominoMesh.receiveShadow = true
    this.dominoMesh.count = 0
    this.dominoMesh.frustumCulled = false
    const bandMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 })
    this.bandMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bandMat, CAPACITY)
    this.bandMesh.count = 0
    this.bandMesh.frustumCulled = false
    this.bandMesh.castShadow = false
    this.symMesh = {
      arrow: this.makeSym('arrow'),
      star: this.makeSym('star'),
      lock: this.makeSym('lock'),
    }
    this.scene.add(this.dominoMesh, this.bandMesh, this.symMesh.arrow, this.symMesh.star, this.symMesh.lock)

    this.ghostMat = new THREE.MeshStandardMaterial({ color: 0x5fd07a, transparent: true, opacity: 0.55, depthWrite: false })
    this.ghost = new THREE.Mesh(geo, this.ghostMat)
    this.ghost.visible = false
    this.ghost.renderOrder = 5
    this.scene.add(this.ghost)
    this.ghosts = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }), 400)
    this.ghosts.count = 0
    this.ghosts.frustumCulled = false
    this.ghosts.renderOrder = 5
    this.scene.add(this.ghosts)
    // 可碰到範圍：骨牌前方的扇形
    const ring = new THREE.RingGeometry(0.42, 0.98, 24, 1, -0.5, 1.0)
    ring.rotateX(-Math.PI / 2)
    this.guide = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }))
    this.guide.visible = false
    this.guide.renderOrder = 3
    this.scene.add(this.guide)

    // 木屑粒子
    const dm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xd9b98a, transparent: true, opacity: 0.85 }), 160)
    dm.frustumCulled = false
    dm.count = 160
    for (let i = 0; i < 160; i++) { tmpM.makeScale(0, 0, 0); dm.setMatrixAt(i, tmpM) }
    this.scene.add(dm)
    this.dust = { mesh: dm, life: new Float32Array(160), vel: new Float32Array(480), pos: new Float32Array(480), next: 0 }

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(el)
    this.resize()
  }

  private makeSym(kind: 'arrow' | 'star' | 'lock'): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: symbolTexture(kind), transparent: true, depthWrite: false }), CAPACITY * 2)
    m.count = 0
    m.frustumCulled = false
    m.renderOrder = 2
    return m
  }

  resize(): void {
    const w = Math.max(1, this.el.clientWidth)
    const h = Math.max(1, this.el.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  setQuality(q: Quality): void {
    this.quality = q
    this.renderer.shadowMap.enabled = q !== 'low'
    this.sun.castShadow = q !== 'low'
    this.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024)
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      if (m) m.needsUpdate = true
    })
    this.resize()
  }

  /* ───── 主題 ───── */

  setTheme(theme: ThemeId): void {
    if (theme === this.theme) return
    this.theme = theme
    disposeGroup(this.themeGroup)
    const s = THEMES[theme]
    this.scene.background = skyTexture(theme)
    this.scene.fog = new THREE.Fog(new THREE.Color(s.sky), 40, 120)
    this.sun.color.setHex(s.light)
    this.hemi.color.setHex(s.light)
    // 木頭桌面
    const top = new THREE.Mesh(new THREE.BoxGeometry(120, 1, 120), new THREE.MeshStandardMaterial({ map: woodTexture('#b8834f', '#6e4424', 3, 14), roughness: 0.8 }))
    top.position.y = -0.52
    top.receiveShadow = true
    this.themeGroup.add(top)
    this.layoutCloth()
  }

  private layoutCloth(): void {
    if (!this.theme) return
    const old = this.themeGroup.getObjectByName('cloth')
    if (old) { this.themeGroup.remove(old); disposeObj(old) }
    const oldDecor = this.themeGroup.getObjectByName('decor')
    if (oldDecor) { this.themeGroup.remove(oldDecor); disposeObj(oldDecor) }
    const b = this.bounds
    const w = b.maxX - b.minX + 6
    const d = b.maxZ - b.minZ + 6
    const tx = clothTexture(this.theme)
    tx.repeat.set(w / 4, d / 4)
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95 }))
    cloth.name = 'cloth'
    cloth.rotation.x = -Math.PI / 2
    cloth.position.set((b.minX + b.maxX) / 2, -0.015, (b.minZ + b.maxZ) / 2)
    cloth.receiveShadow = true
    this.themeGroup.add(cloth)
    const decor = buildDecor(this.theme, { minX: b.minX - 3, maxX: b.maxX + 3, minZ: b.minZ - 3, maxZ: b.maxZ + 3 })
    decor.name = 'decor'
    this.themeGroup.add(decor)
  }

  /* ───── 關卡內容 ───── */

  /** 建立靜態機關、可動機關、擺放區 */
  setLevel(base: SceneBase, placed: DominoSpec[]): void {
    this.detachSim()
    disposeGroup(this.levelGroup)
    this.bounds = { ...base.bounds }
    this.zones = base.zones
    this.layoutCloth()
    this.dyn = []
    const zt = zoneTexture()
    for (const z of base.zones) {
      const g = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({ map: zt, roughness: 1, transparent: true, opacity: 0.9 })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.d), mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.receiveShadow = true
      g.add(mesh)
      // 縫線邊框
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(z.w - 0.1, z.d - 0.1)), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.85 }))
      edge.computeLineDistances()
      edge.rotation.x = -Math.PI / 2
      edge.position.y = 0.004
      g.add(edge)
      g.position.set(z.x, (z.y ?? 0) + 0.006, z.z)
      g.rotation.y = z.a ?? 0
      this.levelGroup.add(g)
    }
    for (const p of base.pieces) {
      const obj = pieceMesh(p)
      this.levelGroup.add(obj)
      if (p.type !== 'box') {
        const mover = obj.getObjectByName('mover') ?? obj
        this.dyn.push({ kind: 'mesh', obj: mover })
      }
    }
    this.setDominoes([...base.dominoes, ...placed])
  }

  /** 依規格重畫所有骨牌（擺放階段） */
  setDominoes(list: DominoSpec[]): void {
    this.specs = list
    const firstDomino = this.dyn.findIndex((d) => d.kind === 'domino')
    if (firstDomino >= 0) this.dyn.length = firstDomino
    list.forEach((_, i) => this.dyn.push({ kind: 'domino', index: i }))
    this.dominoMesh.count = Math.min(list.length, CAPACITY)
    for (let i = 0; i < this.dominoMesh.count; i++) {
      const d = list[i]
      const dm = dims(d.size)
      tmpP.set(d.x, (d.y ?? 0) + dm.h / 2, d.z)
      tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, d.a)
      this.writeDomino(i, tmpP, tmpQ)
      this.dominoMesh.setColorAt(i, this.colorOf(d, i === this.highlight))
    }
    this.dominoMesh.instanceMatrix.needsUpdate = true
    if (this.dominoMesh.instanceColor) this.dominoMesh.instanceColor.needsUpdate = true
    this.flushDecor()
    // 擺放階段把可動機關放回原位
    for (const v of this.dyn) if (v.kind === 'mesh') resetMover(v.obj)
  }

  private colorOf(d: DominoSpec, hi: boolean): THREE.Color {
    if (hi) return tmpC.setHex(0xff8f70)
    if (d.color !== undefined) return tmpC.setHex(d.color)
    if (d.kind === 'fixed') return tmpC.setHex(0xc79a6a)
    return tmpC.setHex(0xffffff)
  }

  private bandCount = 0
  private symCount = { arrow: 0, star: 0, lock: 0 }

  private writeDomino(i: number, pos: THREE.Vector3, q: THREE.Quaternion): void {
    const d = this.specs[i]
    const dm = dims(d.size)
    tmpS.set(dm.t, dm.h, dm.w)
    tmpM.compose(pos, q, tmpS)
    this.dominoMesh.setMatrixAt(i, tmpM)
  }

  /** 色帶與刻痕符號（依目前骨牌矩陣重算） */
  private flushDecor(): void {
    this.bandCount = 0
    this.symCount = { arrow: 0, star: 0, lock: 0 }
    const n = this.dominoMesh.count
    for (let i = 0; i < n; i++) {
      const d = this.specs[i]
      if (d.kind !== 'start' && d.kind !== 'target' && d.kind !== 'fixed') continue
      const dm = dims(d.size)
      this.dominoMesh.getMatrixAt(i, tmpM)
      tmpM.decompose(tmpP, tmpQ, tmpS)
      tmpM.compose(tmpP, tmpQ, tmpS.set(1, 1, 1))
      const by = dm.h * 0.14
      const bh = dm.h * (this.assist ? 0.34 : 0.24)
      // 色帶
      tmpM2.makeTranslation(0, by, 0).multiply(new THREE.Matrix4().makeScale(dm.t * 1.06, bh, dm.w * 1.04))
      const bi = this.bandCount++
      this.bandMesh.setMatrixAt(bi, tmpM2.premultiply(tmpM))
      this.bandMesh.setColorAt(bi, tmpC.setHex(BAND[d.kind]))
      // 符號：起點箭頭在兩側面（指向倒下方向）；目標星形、固定鎖在正反面
      const kind = d.kind === 'start' ? 'arrow' : d.kind === 'target' ? 'star' : 'lock'
      const mesh = this.symMesh[kind]
      const sz = Math.min(bh * 0.95, kind === 'arrow' ? dm.t * 1.15 : dm.w * 0.95)
      const place = (local: THREE.Matrix4) => {
        const k = this.symCount[kind]++
        mesh.setMatrixAt(k, local.premultiply(tmpM))
      }
      if (kind === 'arrow') {
        place(new THREE.Matrix4().makeTranslation(0, by, dm.w * 0.53).multiply(new THREE.Matrix4().makeScale(sz, sz, 1)))
        place(new THREE.Matrix4().makeTranslation(0, by, -dm.w * 0.53).multiply(RY180).multiply(new THREE.Matrix4().makeScale(-sz, sz, 1)))
      } else {
        place(new THREE.Matrix4().makeTranslation(dm.t * 0.54, by, 0).multiply(RY90).multiply(new THREE.Matrix4().makeScale(sz, sz, 1)))
        place(new THREE.Matrix4().makeTranslation(-dm.t * 0.54, by, 0).multiply(RYm90).multiply(new THREE.Matrix4().makeScale(sz, sz, 1)))
      }
    }
    this.bandMesh.count = this.bandCount
    this.bandMesh.instanceMatrix.needsUpdate = true
    if (this.bandMesh.instanceColor) this.bandMesh.instanceColor.needsUpdate = true
    for (const k of ['arrow', 'star', 'lock'] as const) {
      this.symMesh[k].count = this.symCount[k]
      this.symMesh[k].instanceMatrix.needsUpdate = true
    }
  }

  setAssist(on: boolean): void {
    if (this.assist === on) return
    this.assist = on
    this.flushDecor()
  }

  setHighlight(i: number): void {
    if (i === this.highlight) return
    const prev = this.highlight
    this.highlight = i
    for (const k of [prev, i]) {
      if (k >= 0 && k < this.dominoMesh.count) this.dominoMesh.setColorAt(k, this.colorOf(this.specs[k], k === i))
    }
    if (this.dominoMesh.instanceColor) this.dominoMesh.instanceColor.needsUpdate = true
  }

  /* ───── 物理同步 ───── */

  attachSim(sim: Sim): void {
    this.sim = sim
  }

  detachSim(): void {
    this.sim = null
  }

  /** 從物理世界（或重播快照）更新所有可動物件 */
  syncFrom(snap?: Float32Array): void {
    const sim = this.sim
    if (!sim && !snap) return
    const n = this.dyn.length
    for (let i = 0; i < n; i++) {
      const v = this.dyn[i]
      if (snap) {
        const o = i * 7
        tmpP.set(snap[o], snap[o + 1], snap[o + 2])
        tmpQ.set(snap[o + 3], snap[o + 4], snap[o + 5], snap[o + 6])
      } else {
        const b = sim!.bodies[i]
        if (!b) continue
        const p = b.translation()
        const q = b.rotation()
        tmpP.set(p.x, p.y, p.z)
        tmpQ.set(q.x, q.y, q.z, q.w)
      }
      if (v.kind === 'domino') this.writeDomino(v.index, tmpP, tmpQ)
      else {
        v.obj.position.copy(tmpP)
        v.obj.quaternion.copy(tmpQ)
      }
    }
    this.dominoMesh.instanceMatrix.needsUpdate = true
    this.flushDecor()
  }

  /* ───── 擺放預覽 ───── */

  showGhost(d: DominoSpec | null, valid = true): void {
    if (!d) { this.ghost.visible = false; return }
    const dm = dims(d.size)
    this.ghost.visible = true
    this.ghost.position.set(d.x, (d.y ?? 0) + dm.h / 2, d.z)
    this.ghost.rotation.set(0, d.a, 0)
    this.ghost.scale.set(dm.t, dm.h, dm.w)
    this.ghostMat.color.setHex(valid ? (d.color ?? 0x5fd07a) : 0xe0453a)
    this.ghostMat.opacity = valid ? 0.55 : 0.45
  }

  /** 預覽骨牌的透明度（幼兒園模式發光呼吸用） */
  ghostOpacity(v: number): void {
    ;(this.ghosts.material as THREE.MeshStandardMaterial).opacity = v
  }

  /** 多張預覽（沙盒圖形工具） */
  showGhosts(list: DominoSpec[], valid = true): void {
    const n = Math.min(list.length, 400)
    this.ghosts.count = n
    for (let i = 0; i < n; i++) {
      const d = list[i]
      const dm = dims(d.size)
      tmpP.set(d.x, (d.y ?? 0) + dm.h / 2, d.z)
      tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, d.a)
      tmpS.set(dm.t, dm.h, dm.w)
      this.ghosts.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS))
      this.ghosts.setColorAt(i, tmpC.setHex(valid ? (d.color ?? 0x5fd07a) : 0xe0453a))
    }
    this.ghosts.instanceMatrix.needsUpdate = true
    if (this.ghosts.instanceColor) this.ghosts.instanceColor.needsUpdate = true
  }

  /** 在骨牌前方畫出「下一張要放在這個範圍內」的扇形提示 */
  showGuide(d: DominoSpec | null): void {
    if (!d) { this.guide.visible = false; return }
    const dm = dims(d.size)
    this.guide.visible = true
    this.guide.position.set(d.x, (d.y ?? 0) + 0.012, d.z)
    this.guide.rotation.set(0, d.a, 0)
    this.guide.scale.setScalar(dm.h)
  }

  /** 螢幕座標轉成桌面上的點：優先命中擺放區（含高度），否則落在桌面 y=0 */
  pick(clientX: number, clientY: number): { x: number; z: number; y: number; zone: number } | null {
    const r = this.renderer.domElement.getBoundingClientRect()
    const nx = ((clientX - r.left) / r.width) * 2 - 1
    const ny = -((clientY - r.top) / r.height) * 2 + 1
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera)
    const o = ray.ray.origin, dir = ray.ray.direction
    if (Math.abs(dir.y) < 1e-4) return null
    let best: { x: number; z: number; y: number; zone: number; t: number } | null = null
    this.zones.forEach((z, zi) => {
      const y = z.y ?? 0
      const t = (y - o.y) / dir.y
      if (t <= 0) return
      const x = o.x + dir.x * t, zz = o.z + dir.z * t
      if (pointInRect(x, zz, z.x, z.z, z.w / 2, z.d / 2, z.a ?? 0) && (!best || t < best.t)) best = { x, z: zz, y, zone: zi, t }
    })
    if (best) { const b = best as { x: number; z: number; y: number; zone: number }; return { x: b.x, z: b.z, y: b.y, zone: b.zone } }
    const t = -o.y / dir.y
    if (t <= 0) return null
    return { x: o.x + dir.x * t, z: o.z + dir.z * t, y: 0, zone: -1 }
  }

  /** 由螢幕座標找最近的骨牌（擺放階段選取用），回傳規格索引或 −1 */
  pickDomino(clientX: number, clientY: number, tol = 0): number {
    const r = this.renderer.domElement.getBoundingClientRect()
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(v, this.camera)
    const hit = ray.intersectObject(this.dominoMesh, false)[0]
    if (hit?.instanceId !== undefined) return hit.instanceId
    if (tol <= 0) return -1
    // 骨牌很薄，手指不易點準：改找螢幕上最近的骨牌（容許半徑 tol px）
    const px = clientX - r.left, py = clientY - r.top
    const m = new THREE.Matrix4(), c = new THREE.Vector3(), top = new THREE.Vector3()
    let best = -1, bestD = tol * tol
    for (let i = 0; i < this.dominoMesh.count; i++) {
      this.dominoMesh.getMatrixAt(i, m)
      c.setFromMatrixPosition(m)
      if (m.determinant() < 1e-9) continue
      top.copy(c).project(this.camera)
      if (top.z > 1) continue
      const sx = (top.x * 0.5 + 0.5) * r.width, sy = (-top.y * 0.5 + 0.5) * r.height
      const d = (sx - px) * (sx - px) + (sy - py) * (sy - py)
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  }

  /** 螢幕座標（CSS px），供 DOM 彈出文字定位 */
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, visible: v.z < 1 && Math.abs(v.x) <= 1.1 && Math.abs(v.y) <= 1.1 }
  }

  /* ───── 粒子 ───── */

  puff(x: number, y: number, z: number, n = 6): void {
    if (this.quality === 'low') n = Math.min(n, 2)
    const d = this.dust
    for (let k = 0; k < n; k++) {
      const i = d.next
      d.next = (d.next + 1) % d.life.length
      d.life[i] = 0.6 + Math.random() * 0.4
      d.pos.set([x + (Math.random() - 0.5) * 0.3, y + 0.05, z + (Math.random() - 0.5) * 0.3], i * 3)
      d.vel.set([(Math.random() - 0.5) * 1.6, 1 + Math.random() * 1.6, (Math.random() - 0.5) * 1.6], i * 3)
    }
  }

  private stepDust(dt: number): void {
    const d = this.dust
    let any = false
    for (let i = 0; i < d.life.length; i++) {
      if (d.life[i] <= 0) continue
      any = true
      d.life[i] -= dt
      d.vel[i * 3 + 1] -= 6 * dt
      d.pos[i * 3] += d.vel[i * 3] * dt
      d.pos[i * 3 + 1] = Math.max(0.02, d.pos[i * 3 + 1] + d.vel[i * 3 + 1] * dt)
      d.pos[i * 3 + 2] += d.vel[i * 3 + 2] * dt
      const s = Math.max(0, d.life[i])
      tmpM.makeScale(s, s, s).setPosition(d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2])
      d.mesh.setMatrixAt(i, tmpM)
    }
    if (any) d.mesh.instanceMatrix.needsUpdate = true
  }

  /* ───── 鏡頭 ───── */

  center(): THREE.Vector3 {
    const b = this.bounds
    return new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2)
  }

  /** 依場景範圍與畫面比例，算出能看見整個關卡的鏡頭位置 */
  fitView(top = false, animate = true): void {
    const b = this.bounds
    const c = this.center()
    const fov = (this.camera.fov * Math.PI) / 180
    const aspect = this.camera.aspect
    // 直向窄螢幕而關卡是橫長形時，鏡頭轉 90° 從側面看，讓長邊變成畫面的上下方向
    const sideways = aspect < 0.85 && b.maxX - b.minX > (b.maxZ - b.minZ) * 1.15
    const w = (sideways ? b.maxZ - b.minZ : b.maxX - b.minX) + 1
    const d = (sideways ? b.maxX - b.minX : b.maxZ - b.minZ) + 1
    let dist: number
    let pos: THREE.Vector3
    if (top) {
      dist = Math.max(d / 2 / Math.tan(fov / 2), w / 2 / Math.tan(fov / 2) / aspect) * 1.08
      pos = sideways ? new THREE.Vector3(c.x - 0.01, dist, c.z) : new THREE.Vector3(c.x, dist, c.z + 0.01)
    } else {
      const elev = 0.95 // 約 54°
      const need = Math.max((d * 0.62) / Math.tan(fov / 2), (w * 0.47) / Math.tan(fov / 2) / aspect)
      dist = Math.max(5, need)
      const back = Math.cos(elev) * dist
      pos = sideways ? new THREE.Vector3(c.x - back, Math.sin(elev) * dist, c.z) : new THREE.Vector3(c.x, Math.sin(elev) * dist, c.z + back)
    }
    this.moveCamera(pos, c, animate ? 0.6 : 0)
    this.controls.maxDistance = Math.max(30, dist * 2.2)
  }

  /** 單指／左鍵拖曳的行為：旋轉或平移 */
  panMode = false
  setPanMode(on: boolean): void {
    this.panMode = on
    this.controls.mouseButtons = { LEFT: on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: on ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN }
    this.controls.touches = { ONE: on ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
  }

  private keys = new Set<string>()
  /** 鍵盤 WASD 平移（桌機）；輸入框內不處理 */
  private bindPanKeys(): void {
    const ok = (e: KeyboardEvent) => !(e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) && !e.ctrlKey && !e.metaKey && !e.altKey
    addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1 && ok(e)) this.keys.add(k) })
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    addEventListener('blur', () => this.keys.clear())
  }

  private stepPanKeys(dt: number): void {
    if (!this.keys.size || !this.controls.enabled) return
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
    fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0))
    const sp = Math.max(4, this.camera.position.distanceTo(this.controls.target)) * 0.9 * dt
    const mv = new THREE.Vector3()
    if (this.keys.has('w')) mv.add(fwd)
    if (this.keys.has('s')) mv.sub(fwd)
    if (this.keys.has('d')) mv.add(right)
    if (this.keys.has('a')) mv.sub(right)
    if (mv.lengthSq() === 0) return
    mv.normalize().multiplyScalar(sp)
    this.camera.position.add(mv)
    this.controls.target.add(mv)
  }

  moveCamera(pos: THREE.Vector3, target: THREE.Vector3, dur = 0.6): void {
    if (dur <= 0) {
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.controls.update()
      this.camAnim = null
      return
    }
    this.camAnim = { from: this.camera.position.clone(), to: pos, tFrom: this.controls.target.clone(), tTo: target.clone(), t: 0, dur }
  }

  /** 讓鏡頭目標平滑跟到某點（推倒時跟隨前線） */
  follow(x: number, z: number, k: number): void {
    if (this.camAnim) return
    const tg = this.controls.target
    const dx = (x - tg.x) * k, dz = (z - tg.z) * k
    tg.x += dx
    tg.z += dz
    this.camera.position.x += dx
    this.camera.position.z += dz
  }

  zoom(f: number): void {
    const off = this.camera.position.clone().sub(this.controls.target)
    const len = THREE.MathUtils.clamp(off.length() * f, this.controls.minDistance, this.controls.maxDistance)
    off.setLength(len)
    this.camera.position.copy(this.controls.target).add(off)
  }

  /* ───── 每幀 ───── */

  render(dt: number): void {
    if (this.camAnim) {
      const a = this.camAnim
      a.t += dt
      const k = Math.min(1, a.t / a.dur)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      this.camera.position.lerpVectors(a.from, a.to, e)
      this.controls.target.lerpVectors(a.tFrom, a.tTo, e)
      if (k >= 1) this.camAnim = null
    }
    this.stepPanKeys(dt)
    this.controls.update()
    // 陰影範圍跟著鏡頭目標
    const tg = this.controls.target
    this.sun.position.set(tg.x - 8, 18, tg.z + 10)
    this.sun.target.position.copy(tg)
    const span = Math.max(this.bounds.maxX - this.bounds.minX, this.bounds.maxZ - this.bounds.minZ) * 0.7 + 4
    const cam = this.sun.shadow.camera
    if (cam.right !== span) {
      cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span
      cam.far = 60
      cam.updateProjectionMatrix()
    }
    this.stepDust(dt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.ro.disconnect()
    this.controls.dispose()
    disposeGroup(this.levelGroup)
    disposeGroup(this.themeGroup)
    this.scene.traverse((o) => disposeObj(o))
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

/* ───── 機關模型 ───── */

const woodCache = new Map<string, THREE.Texture>()
function toneMat(tone: string | undefined): THREE.MeshStandardMaterial {
  const key = tone ?? 'light'
  let t = woodCache.get(key)
  if (!t) {
    t = woodTexture('#f2dcb6', '#9b6c3c', key.length * 13 + 3)
    woodCache.set(key, t)
  }
  return new THREE.MeshStandardMaterial({ map: t, color: TONES[key] ?? TONES.light, roughness: 0.65 })
}

function pieceMesh(p: Piece): THREE.Object3D {
  if (p.type === 'box') {
    const m = new THREE.Mesh(new RoundedBoxGeometry(p.sx, p.sy, p.sz, 2, Math.min(0.06, p.sy / 3, p.sx / 3, p.sz / 3)), toneMat(p.tone ?? 'dark'))
    m.position.set(p.x, p.y, p.z)
    m.rotation.set(0, p.a ?? 0, p.p ?? 0, 'YXZ')
    m.castShadow = m.receiveShadow = true
    return m
  }
  if (p.type === 'block') {
    const m = new THREE.Mesh(new RoundedBoxGeometry(p.sx, p.sy, p.sz, 2, 0.05), toneMat(p.target ? 'yellow' : p.tone))
    m.position.set(p.x, p.y, p.z)
    m.rotation.y = p.a ?? 0
    m.castShadow = m.receiveShadow = true
    m.userData.home = { p: m.position.clone(), q: m.quaternion.clone() }
    if (p.target) {
      const star = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(p.sx, p.sy) * 0.7, Math.min(p.sx, p.sy) * 0.7), new THREE.MeshBasicMaterial({ map: symbolTexture('star'), transparent: true, depthWrite: false }))
      star.position.z = p.sz / 2 + 0.004
      const star2 = star.clone()
      star2.position.z = -p.sz / 2 - 0.004
      star2.rotation.y = Math.PI
      m.add(star, star2)
    }
    return m
  }
  if (p.type === 'ball') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(p.r, 24, 16), new THREE.MeshStandardMaterial({ map: woodTexture('#d8574a', '#8b2a22', 21), roughness: 0.4 }))
    m.position.set(p.x, p.y, p.z)
    m.castShadow = true
    m.userData.home = { p: m.position.clone(), q: m.quaternion.clone() }
    return m
  }
  const g = new THREE.Group()
  if (p.type === 'lever') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, p.h - 0.08, 12), toneMat('dark'))
    post.position.set(p.x, (p.h - 0.08) / 2, p.z)
    post.castShadow = true
    g.add(post)
    const arm = new THREE.Mesh(new RoundedBoxGeometry(p.len, 0.14, 0.22, 2, 0.05), toneMat('green'))
    arm.name = 'mover'
    arm.position.set(p.x, p.h, p.z)
    arm.rotation.y = p.a
    arm.castShadow = arm.receiveShadow = true
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), toneMat('yellow'))
    cap.position.y = 0.1
    arm.add(cap)
    arm.userData.home = { p: arm.position.clone(), q: arm.quaternion.clone() }
    g.add(arm)
    return g
  }
  // 蹺蹺板：支點＋木板（木板是可動部分）
  const f = facing(p.a)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, p.h, 3), toneMat('dark'))
  base.position.set(p.x, p.h / 2, p.z)
  base.rotation.set(Math.PI / 2, 0, 0)
  base.rotation.y = p.a
  base.castShadow = true
  g.add(base)
  const plank = new THREE.Mesh(new RoundedBoxGeometry(p.len, 0.12, 0.64, 2, 0.04), toneMat('blue'))
  plank.name = 'mover'
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.a, -p.tilt, 'YXZ'))
  plank.position.set(p.x, p.h + 0.06, p.z)
  plank.quaternion.copy(q)
  plank.castShadow = plank.receiveShadow = true
  plank.userData.home = { p: plank.position.clone(), q: plank.quaternion.clone() }
  g.add(plank)
  void f
  return g
}

function resetMover(o: THREE.Object3D): void {
  const h = o.userData.home as { p: THREE.Vector3; q: THREE.Quaternion } | undefined
  if (!h) return
  o.position.copy(h.p)
  o.quaternion.copy(h.q)
}

function disposeObj(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
}

function disposeGroup(g: THREE.Group): void {
  for (const c of [...g.children]) {
    g.remove(c)
    disposeObj(c)
  }
}
