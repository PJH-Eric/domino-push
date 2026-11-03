import RAPIER from '@dimforge/rapier3d-compat'
import './ui/style.css'
import { Stage } from './render/stage'
import { buildSim, STEP, type Sim } from './physics/sim'
import type { DominoSpec } from './core/types'

/* M0 薄切：一排骨牌、按「推！」看它們倒下 */
async function boot(): Promise<void> {
  await RAPIER.init()
  const app = document.getElementById('app')!
  const host = document.createElement('div')
  host.className = 'stage-host'
  app.appendChild(host)
  const stage = new Stage(host)
  stage.setTheme('village')
  const dominoes: DominoSpec[] = []
  for (let i = 0; i < 24; i++) {
    const t = i / 23
    dominoes.push({ x: -6 + i * 0.55, z: Math.sin(t * Math.PI * 2) * 1.6, a: 0, kind: i === 0 ? 'start' : i === 23 ? 'target' : 'fixed' })
  }
  for (let i = 1; i < dominoes.length; i++) {
    const p = dominoes[i - 1], c = dominoes[i]
    const n = dominoes[i + 1] ?? c
    c.a = Math.atan2(-(n.z - p.z), n.x - p.x)
  }
  dominoes[0].a = Math.atan2(-(dominoes[1].z - dominoes[0].z), dominoes[1].x - dominoes[0].x)
  const base = { dominoes, pieces: [], zones: [], bounds: { minX: -6, maxX: 6, minZ: -3, maxZ: 3 } }
  stage.setLevel(base, [])
  stage.fitView(false, false)
  let sim: Sim | null = null
  const btn = document.createElement('button')
  btn.className = 'btn btn-primary btn-lg m0-push'
  btn.textContent = '推！'
  btn.onclick = () => {
    sim?.dispose()
    const b = buildSim(RAPIER, base, [])
    sim = b.sim
    stage.setLevel(base, [])
    stage.attachSim(sim)
    sim.push(b.startIdx)
  }
  app.appendChild(btn)
  let last = performance.now()
  let acc = 0
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (sim) {
      acc += dt
      while (acc >= STEP) { sim.step((i) => { if (i.force > 30) stage.puff(i.x, 0.05, i.z, 3) }); acc -= STEP }
      stage.syncFrom()
    }
    stage.render(dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
boot()
