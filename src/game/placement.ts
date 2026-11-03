import { angleOf, dims, facing, wrapAngle } from '../core/geom'
import { canPlace, type PlaceError } from '../core/rules'
import type { DominoKind, DominoSpec, Piece, SizeId, Zone } from '../core/types'

export type Action =
  | { t: 'add'; list: DominoSpec[] }
  | { t: 'remove'; index: number; spec: DominoSpec }
  | { t: 'rotate'; index: number; from: number; to: number }
  | { t: 'clear'; list: DominoSpec[] }

export interface PlacementOpts {
  base: DominoSpec[]
  zones: Zone[] | null
  pieces: Piece[]
  kind: DominoKind
  limit: number
  /** 沒有擺放區時（沙盒）可擺放的桌面範圍 */
  area?: { minX: number; maxX: number; minZ: number; maxZ: number }
}

export type PlaceResult = { ok: true } | { ok: false; reason: PlaceError | 'area' }

/**
 * 擺放邏輯（不含畫面）：預覽骨牌位置與角度、驗證、加入與移除、復原／重做。
 * 挑戰與沙盒共用；所有骨牌座標都是桌面座標。
 */
export class Placement {
  placed: DominoSpec[] = []
  ghost: DominoSpec | null = null
  ghostValid = false
  ghostError: PlaceResult = { ok: true }
  selected = -1
  size: SizeId = 'm'
  color: number | undefined
  autoAim = true
  private manualAngle = false
  private lastAngle = 0
  private undoStack: Action[] = []
  private redoStack: Action[] = []

  constructor(public opts: PlacementOpts) {}

  all(): DominoSpec[] {
    return [...this.opts.base, ...this.placed]
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get used(): number {
    return this.placed.length
  }

  /** 檢查某張骨牌能否放下（skip＝忽略 placed 裡的第幾張，旋轉用） */
  check(d: DominoSpec, skip = -1): PlaceResult {
    const a = this.opts.area
    if (a && (d.x < a.minX || d.x > a.maxX || d.z < a.minZ || d.z > a.maxZ)) return { ok: false, reason: 'area' }
    const err = canPlace(d, this.all(), this.opts.zones, this.opts.pieces, skip >= 0 ? this.opts.base.length + skip : -1)
    if (err) return { ok: false, reason: err }
    if (skip < 0 && this.placed.length >= this.opts.limit) return { ok: false, reason: 'limit' }
    return { ok: true }
  }

  /** 找出離某點最近、而且面向這個點的骨牌（自動對準用） */
  private aimFrom(x: number, z: number, y: number): DominoSpec | null {
    let best: DominoSpec | null = null
    let bd = 1.9
    for (const d of this.all()) {
      if (Math.abs((d.y ?? 0) - y) > 0.9) continue
      const dx = x - d.x, dz = z - d.z
      const dist = Math.hypot(dx, dz)
      if (dist < 0.2 || dist > bd) continue
      const f = facing(d.a)
      const cos = (dx * f.x + dz * f.z) / dist
      if (cos < 0.35) continue
      best = d
      bd = dist
    }
    return best
  }

  /** 移動預覽到桌面上的一點（y＝擺放區高度） */
  moveGhost(x: number, z: number, y = 0): void {
    let a = this.ghost?.a ?? this.lastAngle
    let ref: DominoSpec | null = null
    if (this.autoAim && !this.manualAngle) {
      ref = this.aimFrom(x, z, y)
      if (ref) a = angleOf(x - ref.x, z - ref.z)
    }
    this.ghost = { x, z, a, kind: this.opts.kind, size: this.size }
    if (y) this.ghost.y = y
    if (this.color !== undefined) this.ghost.color = this.color
    this.validate()
  }

  /** 參考骨牌（畫出前方可碰到範圍）：預覽附近最近的那張 */
  guideFor(): DominoSpec | null {
    if (!this.ghost) return null
    return this.aimFrom(this.ghost.x, this.ghost.z, this.ghost.y ?? 0)
  }

  hideGhost(): void {
    this.ghost = null
  }

  private validate(): void {
    if (!this.ghost) return
    this.ghostError = this.check(this.ghost)
    this.ghostValid = this.ghostError.ok
  }

  /** 旋轉：有選取的骨牌就轉它，否則轉預覽 */
  rotate(deg: number): PlaceResult {
    const da = (deg * Math.PI) / 180
    if (this.selected >= 0) {
      const d = this.placed[this.selected]
      const to = wrapAngle(d.a + da)
      const test = { ...d, a: to }
      const r = this.check(test, this.selected)
      if (!r.ok) return r
      this.apply({ t: 'rotate', index: this.selected, from: d.a, to })
      return { ok: true }
    }
    if (this.ghost) {
      this.ghost.a = wrapAngle(this.ghost.a + da)
      this.manualAngle = true
      this.lastAngle = this.ghost.a
      this.validate()
    } else {
      this.lastAngle = wrapAngle(this.lastAngle + da)
      this.manualAngle = true
    }
    return { ok: true }
  }

  /** 把預覽放下 */
  commit(): PlaceResult {
    if (!this.ghost) return { ok: false, reason: 'outside' }
    this.validate()
    if (!this.ghostValid) return this.ghostError
    const d = { ...this.ghost }
    this.lastAngle = d.a
    this.manualAngle = false
    this.apply({ t: 'add', list: [d] })
    // 下一張預覽往前推一格，方便連續擺放
    const f = facing(d.a)
    const gap = dims(d.size).h * 0.62
    this.ghost = { ...d, x: d.x + f.x * gap, z: d.z + f.z * gap }
    this.validate()
    return { ok: true }
  }

  /** 一次加入多張（沙盒圖形工具）；回傳實際加入張數 */
  addMany(list: DominoSpec[]): number {
    const ok: DominoSpec[] = []
    for (const d of list) {
      if (this.placed.length + ok.length >= this.opts.limit) break
      const saved = this.placed
      this.placed = [...saved, ...ok]
      const r = this.check(d)
      this.placed = saved
      if (r.ok) ok.push(d)
    }
    if (ok.length) this.apply({ t: 'add', list: ok })
    return ok.length
  }

  removeSelected(): boolean {
    if (this.selected < 0) return false
    const i = this.selected
    this.apply({ t: 'remove', index: i, spec: this.placed[i] })
    this.selected = -1
    return true
  }

  removeAt(i: number): void {
    if (i < 0 || i >= this.placed.length) return
    this.apply({ t: 'remove', index: i, spec: this.placed[i] })
    if (this.selected === i) this.selected = -1
  }

  clear(): void {
    if (!this.placed.length) return
    this.apply({ t: 'clear', list: this.placed })
    this.selected = -1
  }

  /** 直接設定（載入存檔）：清空復原紀錄 */
  load(list: DominoSpec[]): void {
    this.placed = list.slice(0, this.opts.limit)
    this.undoStack = []
    this.redoStack = []
    this.selected = -1
  }

  private apply(a: Action, record = true): void {
    switch (a.t) {
      case 'add':
        this.placed = [...this.placed, ...a.list]
        break
      case 'remove':
        this.placed = this.placed.filter((_, i) => i !== a.index)
        break
      case 'rotate':
        this.placed = this.placed.map((d, i) => (i === a.index ? { ...d, a: a.to } : d))
        break
      case 'clear':
        this.placed = []
        break
    }
    if (record) {
      this.undoStack.push(a)
      if (this.undoStack.length > 200) this.undoStack.shift()
      this.redoStack = []
    }
    this.validate()
  }

  undo(): boolean {
    const a = this.undoStack.pop()
    if (!a) return false
    switch (a.t) {
      case 'add':
        this.placed = this.placed.slice(0, this.placed.length - a.list.length)
        break
      case 'remove':
        this.placed = [...this.placed.slice(0, a.index), a.spec, ...this.placed.slice(a.index)]
        break
      case 'rotate':
        this.placed = this.placed.map((d, i) => (i === a.index ? { ...d, a: a.from } : d))
        break
      case 'clear':
        this.placed = a.list
        break
    }
    this.redoStack.push(a)
    this.selected = -1
    this.validate()
    return true
  }

  redo(): boolean {
    const a = this.redoStack.pop()
    if (!a) return false
    this.apply(a, false)
    this.undoStack.push(a)
    this.selected = -1
    return true
  }
}
