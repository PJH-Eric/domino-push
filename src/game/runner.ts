import type RAPIER_NS from '@dimforge/rapier3d-compat'
import type { DominoSpec, Piece } from '../core/types'
import { buildSim, STEP, type Impact, type Sim } from '../physics/sim'

type R = typeof RAPIER_NS

export interface RunEvents {
  onImpact?: (i: Impact) => void
  /** 某物件被判定倒下（index＝物理物件索引） */
  onFall?: (index: number, x: number, y: number, z: number, target: boolean) => void
}

/** 每幾個物理步記錄一張重播快照（120 Hz / 4 ＝ 30 張每秒） */
const SNAP_EVERY = 4
/** 每幀最多跑幾步，避免慢裝置卡死（不足的部分自動變慢動作） */
let MAX_STEPS = 6
/** 自動測試用：允許每幀跑更多步（慢速模擬環境） */
export function setMaxSteps(n: number): void {
  MAX_STEPS = n
  devScale = 8
}
/** 自動測試用的時間倍率（正式環境固定為 1） */
let devScale = 1

/**
 * 推動後的物理執行：固定步長、時間倍率（慢動作）、快照重播。
 */
export class Runner {
  readonly sim: Sim
  readonly startIdx: number
  timeScale = 1
  private acc = 0
  private reported: Uint8Array
  readonly frames: Float32Array[] = []
  private lastFallAt = -1
  combo = 0
  bestCombo = 0
  /** 物理實際落後真實時間的比例（效能監控用） */
  lag = 0

  constructor(R: R, base: { dominoes: DominoSpec[]; pieces: Piece[] }, placed: DominoSpec[], private ev: RunEvents = {}, private record = true) {
    const b = buildSim(R, base, placed)
    this.sim = b.sim
    this.startIdx = b.startIdx
    this.reported = new Uint8Array(this.sim.bodies.length)
    if (record) this.frames.push(this.sim.snapshot())
  }

  push(idx = this.startIdx): void {
    this.sim.push(idx)
  }

  get settled(): boolean {
    return this.sim.settled
  }

  /** 依真實經過時間前進；回傳本幀跑了幾步 */
  update(dt: number): number {
    this.acc += dt * this.timeScale * devScale
    let n = 0
    while (this.acc >= STEP && n < MAX_STEPS) {
      this.stepOnce()
      this.acc -= STEP
      n++
    }
    if (this.acc > STEP * MAX_STEPS) {
      this.lag = Math.min(1, this.lag * 0.9 + 0.1)
      this.acc = 0
    } else this.lag *= 0.95
    return n
  }

  private stepOnce(): void {
    const sim = this.sim
    sim.step(this.ev.onImpact)
    if (this.record && sim.steps % SNAP_EVERY === 0 && this.frames.length < 30 * 40) this.frames.push(sim.snapshot())
    // 新倒下的物件
    const info = sim.info
    for (let i = 0; i < info.length; i++) {
      if (info[i].fallen && !this.reported[i]) {
        this.reported[i] = 1
        if (info[i].kind === 'domino' || info[i].kind === 'block') {
          const t = sim.time
          this.combo = this.lastFallAt >= 0 && t - this.lastFallAt < 0.8 ? this.combo + 1 : 1
          this.bestCombo = Math.max(this.bestCombo, this.combo)
          this.lastFallAt = t
        }
        const p = sim.bodies[i].translation()
        this.ev.onFall?.(i, p.x, p.y, p.z, info[i].target)
      }
    }
  }

  dispose(): void {
    this.sim.dispose()
  }
}

/** 快照重播器：依時間倍率播放已記錄的影格 */
export class Replay {
  private t = 0
  timeScale = 1
  constructor(readonly frames: Float32Array[]) {}
  get done(): boolean {
    return this.t >= this.frames.length - 1
  }
  /** 回傳目前影格 */
  update(dt: number): Float32Array {
    this.t = Math.min(this.frames.length - 1, this.t + dt * 30 * this.timeScale)
    return this.frames[Math.floor(this.t)]
  }
  get progress(): number {
    return this.frames.length > 1 ? this.t / (this.frames.length - 1) : 1
  }
}
