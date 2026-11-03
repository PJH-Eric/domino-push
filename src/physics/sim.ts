import type RAPIER_NS from '@dimforge/rapier3d-compat'
import { dims, facing } from '../core/geom'
import type { BallPiece, BlockPiece, BoxPiece, DominoSpec, LeverPiece, Piece, SeesawPiece } from '../core/types'

type R = typeof RAPIER_NS
type Body = RAPIER_NS.RigidBody

/** 固定物理步長（秒）：畫面與物理解耦，重播與測試都能重現 */
export const STEP = 1 / 120
export const GRAVITY = -24
/** 推動後最長模擬時間（秒），超過就結算 */
export const TIMEOUT = 20

export type BodyKind = 'domino' | 'block' | 'ball' | 'plank'

export interface BodyInfo {
  kind: BodyKind
  /** 對應的骨牌規格（domino 才有） */
  spec?: DominoSpec
  piece?: Piece
  /** 物件高度（倒下判定用） */
  h: number
  y0: number
  target: boolean
  fallen: boolean
  /** 倒下狀態已持續的秒數（≥0.3 秒才算） */
  tilt: number
  /** 最後一次倒下時的時間（秒） */
  fallAt: number
  removed: boolean
}

export interface Impact {
  force: number
  x: number
  y: number
  z: number
  kind: BodyKind
}

const FALL_UP_Y = 0.5 // cos 60°
const FALL_HOLD = 0.3

function yawPitch(a: number, p = 0): { x: number; y: number; z: number; w: number } {
  // q = qY(a) * qZ(p)
  const cy = Math.cos(a / 2), sy = Math.sin(a / 2)
  const cz = Math.cos(p / 2), sz = Math.sin(p / 2)
  return { x: -sy * sz, y: sy * cz, z: cy * sz, w: cy * cz }
}

/**
 * 推骨牌的物理世界（Rapier）。瀏覽器與 Node 測試共用，固定步長、不依賴時間，
 * 因此同一份擺放在同一台裝置上必定得到相同結果。
 */
export class Sim {
  readonly R: R
  readonly world: RAPIER_NS.World
  readonly bodies: Body[] = []
  readonly info: BodyInfo[] = []
  readonly statics: BoxPiece[] = []
  private queue: RAPIER_NS.EventQueue
  private handleToIndex = new Map<number, number>()
  time = 0
  steps = 0
  pushed = false
  quiet = 0
  fallenCount = 0
  private lastFallX = 0
  private lastFallZ = 0

  constructor(R: R) {
    this.R = R
    this.world = new R.World({ x: 0, y: GRAVITY, z: 0 })
    this.world.timestep = STEP
    this.queue = new R.EventQueue(true)
    // 桌面：一大塊靜態地板（上表面 y = 0）
    const ground = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0))
    this.world.createCollider(R.ColliderDesc.cuboid(200, 0.5, 200).setFriction(1.0), ground)
  }

  /* ───── 建立物件 ───── */

  addStatic(b: BoxPiece): void {
    const R = this.R
    const q = yawPitch(b.a ?? 0, b.p ?? 0)
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(b.x, b.y, b.z).setRotation(q))
    this.world.createCollider(R.ColliderDesc.cuboid(b.sx / 2, b.sy / 2, b.sz / 2).setFriction(0.6), body)
    this.statics.push(b)
  }

  addDomino(spec: DominoSpec): number {
    const R = this.R
    const d = dims(spec.size)
    const y = (spec.y ?? 0) + d.h / 2
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(spec.x, y, spec.z)
      .setRotation(yawPitch(spec.a))
      .setLinearDamping(0.02)
      .setAngularDamping(0.08)
      .setCanSleep(true)
    const body = this.world.createRigidBody(desc)
    const col = R.ColliderDesc.cuboid(d.t / 2, d.h / 2, d.w / 2)
      .setDensity(1)
      .setFriction(0.55)
      .setRestitution(0.02)
      .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(0.4)
    const c = this.world.createCollider(col, body)
    return this.register(body, c, { kind: 'domino', spec, h: d.h, y0: y, target: spec.kind === 'target' })
  }

  addPiece(p: Piece): number {
    switch (p.type) {
      case 'box':
        this.addStatic(p)
        return -1
      case 'block':
        return this.addBlock(p)
      case 'ball':
        return this.addBall(p)
      case 'seesaw':
        return this.addSeesaw(p)
      case 'lever':
        return this.addLever(p)
    }
  }

  private addBlock(p: BlockPiece): number {
    const R = this.R
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(yawPitch(p.a ?? 0)).setAngularDamping(0.1).setCanSleep(true),
    )
    const c = this.world.createCollider(
      R.ColliderDesc.cuboid(p.sx / 2, p.sy / 2, p.sz / 2).setDensity(0.35).setFriction(0.6).setRestitution(0.02)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0.6),
      body,
    )
    // 積木塔一開始休眠，被撞到才醒，避免堆疊自己抖動
    body.sleep()
    return this.register(body, c, { kind: 'block', piece: p, h: p.sy, y0: p.y, target: !!p.target })
  }

  private addBall(p: BallPiece): number {
    const R = this.R
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setAngularDamping(0.05).setLinearDamping(0.02).setCanSleep(true).setCcdEnabled(true),
    )
    const c = this.world.createCollider(
      R.ColliderDesc.ball(p.r).setDensity(1.4).setFriction(0.5).setRestitution(0.1)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0.6),
      body,
    )
    body.sleep()
    return this.register(body, c, { kind: 'ball', piece: p, h: p.r * 2, y0: p.y, target: false })
  }

  private addSeesaw(p: SeesawPiece): number {
    const R = this.R
    // 支點：靜態三角柱以小方塊近似
    const pivotH = p.h
    const base = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x, pivotH / 2, p.z).setRotation(yawPitch(p.a)))
    this.world.createCollider(R.ColliderDesc.cuboid(0.12, pivotH / 2, 0.3).setFriction(0.6), base)
    const plankT = 0.12
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(p.x, pivotH + plankT / 2, p.z).setRotation(yawPitch(p.a, -p.tilt)).setAngularDamping(0.3).setCanSleep(true),
    )
    const c = this.world.createCollider(
      R.ColliderDesc.cuboid(p.len / 2, plankT / 2, 0.32).setDensity(0.6).setFriction(0.7)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0.6),
      body,
    )
    // 繞木板寬度方向（本地 Z）轉動
    // 轉軸在兩個物件的本地座標系都是 Z（木板寬度方向）
    const jd = R.JointData.revolute({ x: 0, y: pivotH / 2, z: 0 }, { x: 0, y: -plankT / 2, z: 0 }, { x: 0, y: 0, z: 1 })
    this.world.createImpulseJoint(jd, base, body, true)
    body.sleep()
    return this.register(body, c, { kind: 'plank', piece: p, h: plankT, y0: pivotH, target: false })
  }

  private addLever(p: LeverPiece): number {
    const R = this.R
    const post = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.x, (p.h - 0.08) / 2, p.z))
    this.world.createCollider(R.ColliderDesc.cylinder((p.h - 0.08) / 2, 0.09).setFriction(0.5), post)
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(p.x, p.h, p.z).setRotation(yawPitch(p.a)).setAngularDamping(2.0).setCanSleep(true),
    )
    const c = this.world.createCollider(
      R.ColliderDesc.cuboid(p.len / 2, 0.07, 0.11).setDensity(0.5).setFriction(0.4)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0.6),
      body,
    )
    // 繞垂直軸轉動：橫桿只能水平旋轉
    const jd = R.JointData.revolute({ x: 0, y: p.h - (p.h - 0.08) / 2, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })
    this.world.createImpulseJoint(jd, post, body, true)
    body.sleep()
    return this.register(body, c, { kind: 'plank', piece: p, h: 0.14, y0: p.h, target: false })
  }

  private register(body: Body, c: RAPIER_NS.Collider, i: Omit<BodyInfo, 'fallen' | 'tilt' | 'fallAt' | 'removed'>): number {
    const idx = this.bodies.length
    this.bodies.push(body)
    this.info.push({ ...i, fallen: false, tilt: 0, fallAt: 0, removed: false })
    this.handleToIndex.set(c.handle, idx)
    return idx
  }

  /* ───── 推動與模擬 ───── */

  /** 在骨牌上方施一次衝量，使它往面向方向倒下 */
  push(idx: number, strength = 1): void {
    const b = this.bodies[idx]
    const inf = this.info[idx]
    if (!b || inf.kind !== 'domino' || !inf.spec) return
    const f = facing(inf.spec.a)
    const m = b.mass()
    const p = b.translation()
    const k = m * 1.1 * strength
    b.wakeUp()
    b.applyImpulseAtPoint({ x: f.x * k, y: 0, z: f.z * k }, { x: p.x, y: p.y + inf.h * 0.38, z: p.z }, true)
    this.pushed = true
  }

  /** 前進一個固定步；onImpact 收到碰撞力道（音效與震動用） */
  step(onImpact?: (i: Impact) => void): void {
    this.world.step(this.queue)
    this.time += STEP
    this.steps++
    if (onImpact) {
      this.queue.drainContactForceEvents((e) => {
        const i1 = this.handleToIndex.get(e.collider1())
        const i2 = this.handleToIndex.get(e.collider2())
        const idx = i1 ?? i2
        if (idx === undefined) return
        const p = this.bodies[idx].translation()
        onImpact({ force: e.totalForceMagnitude(), x: p.x, y: p.y, z: p.z, kind: this.info[idx].kind })
      })
    } else {
      this.queue.clear()
    }
    this.updateFallen()
    if ((this.steps & 7) === 0) this.updateQuiet()
  }

  private updateFallen(): void {
    for (let i = 0; i < this.bodies.length; i++) {
      const inf = this.info[i]
      if (inf.fallen || inf.removed || (inf.kind !== 'domino' && inf.kind !== 'block')) continue
      const b = this.bodies[i]
      if (b.isSleeping()) { inf.tilt = 0; continue }
      const q = b.rotation()
      const upY = 1 - 2 * (q.x * q.x + q.z * q.z)
      const y = b.translation().y
      const down = upY < FALL_UP_Y || y < inf.y0 - inf.h * 0.5
      if (down) {
        inf.tilt += STEP
        if (inf.tilt >= FALL_HOLD) {
          inf.fallen = true
          inf.fallAt = this.time
          this.fallenCount++
          const p = b.translation()
          this.lastFallX = p.x
          this.lastFallZ = p.z
        }
      } else inf.tilt = 0
      // 掉出桌面：停用以省效能
      if (y < -6) {
        b.setEnabled(false)
        inf.removed = true
      }
    }
  }

  private updateQuiet(): void {
    let moving = false
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i]
      if (this.info[i].removed || b.isSleeping()) continue
      const v = b.linvel()
      const w = b.angvel()
      if (v.x * v.x + v.y * v.y + v.z * v.z > 0.0025 || w.x * w.x + w.y * w.y + w.z * w.z > 0.0049) {
        moving = true
        break
      }
    }
    this.quiet = moving ? 0 : this.quiet + STEP * 8
  }

  /** 推動後全部靜止（或超時）＝可以結算 */
  get settled(): boolean {
    return this.pushed && (this.quiet >= 0.8 || this.time >= TIMEOUT)
  }

  get targetsTotal(): number {
    return this.info.reduce((n, i) => n + (i.target ? 1 : 0), 0)
  }

  get targetsFallen(): number {
    return this.info.reduce((n, i) => n + (i.target && i.fallen ? 1 : 0), 0)
  }

  get lastFall(): { x: number; z: number } {
    return { x: this.lastFallX, z: this.lastFallZ }
  }

  /** 所有動態物件的位置與旋轉（每物件 7 個數） */
  snapshot(out?: Float32Array): Float32Array {
    const n = this.bodies.length
    const a = out && out.length === n * 7 ? out : new Float32Array(n * 7)
    for (let i = 0; i < n; i++) {
      const p = this.bodies[i].translation()
      const q = this.bodies[i].rotation()
      a.set([p.x, p.y, p.z, q.x, q.y, q.z, q.w], i * 7)
    }
    return a
  }

  dispose(): void {
    this.world.free()
    this.queue.free()
  }
}

/** 從關卡資料建立物理世界（固定骨牌、起點、目標、機關＋玩家擺放） */
export function buildSim(R: R, base: { dominoes: DominoSpec[]; pieces: Piece[] }, placed: DominoSpec[]): { sim: Sim; startIdx: number } {
  const sim = new Sim(R)
  for (const p of base.pieces) sim.addPiece(p)
  let startIdx = -1
  for (const d of base.dominoes) {
    const i = sim.addDomino(d)
    if (d.kind === 'start' && startIdx < 0) startIdx = i
  }
  for (const d of placed) sim.addDomino(d)
  return { sim, startIdx }
}

/** 無頭模擬：推起點直到結算。回傳是否全部目標倒下（測試、隨機關驗證用） */
export function simulate(R: R, base: { dominoes: DominoSpec[]; pieces: Piece[] }, placed: DominoSpec[]): { win: boolean; fallen: number; time: number; targets: number; targetsFallen: number } {
  const { sim, startIdx } = buildSim(R, base, placed)
  sim.push(startIdx)
  while (!sim.settled) {
    sim.step()
    if (sim.targetsTotal > 0 && sim.targetsFallen === sim.targetsTotal && sim.quiet > 0.3) break
  }
  const r = { win: sim.targetsFallen === sim.targetsTotal && sim.targetsTotal > 0, fallen: sim.fallenCount, time: sim.time, targets: sim.targetsTotal, targetsFallen: sim.targetsFallen }
  sim.dispose()
  return r
}
