import * as THREE from 'three'
import type { ThemeId } from '../core/types'

type B = { minX: number; maxX: number; minZ: number; maxZ: number }

const mats = new Map<number, THREE.MeshStandardMaterial>()
function mat(c: number): THREE.MeshStandardMaterial {
  let m = mats.get(c)
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }); mats.set(c, m) }
  return m.clone()
}

function mesh(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color))
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function rng(seed: number): () => number {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

/** 主題裝飾：沿著場景外圍擺幾件木頭玩具，不進入遊戲區 */
export function buildDecor(theme: ThemeId, b: B): THREE.Group {
  const g = new THREE.Group()
  const r = rng(theme.length * 977 + 13)
  const spots: [number, number][] = []
  const per = 4
  for (let i = 0; i < per; i++) {
    const t = (i + 0.5) / per
    spots.push([b.minX + (b.maxX - b.minX) * t, b.minZ - 1.4 - r() * 1.2])
    spots.push([b.minX + (b.maxX - b.minX) * t, b.maxZ + 1.6 + r() * 1.2])
  }
  spots.push([b.minX - 1.6, (b.minZ + b.maxZ) / 2], [b.maxX + 1.6, (b.minZ + b.maxZ) / 2])
  spots.forEach(([x, z], i) => {
    const toy = makeToy(theme, i, r)
    toy.position.set(x, 0, z)
    toy.rotation.y = r() * Math.PI * 2
    g.add(toy)
  })
  return g
}

function makeToy(theme: ThemeId, i: number, r: () => number): THREE.Group {
  const g = new THREE.Group()
  const k = i % 3
  if (theme === 'village') {
    if (k === 0) { // 小房子
      g.add(mesh(new THREE.BoxGeometry(1, 0.8, 0.9), 0xf6e3c0, 0, 0.4, 0))
      const roof = mesh(new THREE.CylinderGeometry(0, 0.82, 0.6, 4), 0xe2647a, 0, 1.1, 0)
      roof.rotation.y = Math.PI / 4
      g.add(roof)
      g.add(mesh(new THREE.BoxGeometry(0.25, 0.4, 0.02), 0x8a5a3a, 0, 0.2, 0.46))
    } else if (k === 1) { // 樹
      g.add(mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.6, 8), 0x8a5a3a, 0, 0.3, 0))
      g.add(mesh(new THREE.SphereGeometry(0.45, 12, 10), 0x6fbf6a, 0, 0.9, 0))
    } else { // 積木堆
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0x4f86c6, 0, 0.25, 0))
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xf0c240, 0.55, 0.25, 0.1))
      const tri = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 3), 0xd9584a, 0.25, 0.72, 0.05)
      tri.rotation.z = Math.PI / 2
      g.add(tri)
    }
  } else if (theme === 'camp') {
    if (k === 0) { // 帳篷
      const tent = mesh(new THREE.CylinderGeometry(0, 0.85, 1.1, 4), 0xc8622a, 0, 0.55, 0)
      tent.rotation.y = Math.PI / 4
      g.add(tent)
    } else if (k === 1) { // 松樹
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), 0x7a4a2a, 0, 0.2, 0))
      g.add(mesh(new THREE.ConeGeometry(0.5, 0.8, 8), 0x4f7f45, 0, 0.75, 0))
      g.add(mesh(new THREE.ConeGeometry(0.38, 0.6, 8), 0x5c9150, 0, 1.15, 0))
    } else { // 營火木頭
      for (let j = 0; j < 3; j++) {
        const log = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), 0x8a5a3a, 0, 0.1 + j * 0.02, 0)
        log.rotation.set(Math.PI / 2, 0, (j * Math.PI) / 3)
        g.add(log)
      }
      g.add(mesh(new THREE.ConeGeometry(0.18, 0.4, 6), 0xf2a33a, 0, 0.35, 0))
    }
  } else if (theme === 'town') {
    if (k === 0) { // 大樓
      const h = 1.2 + r() * 1.2
      g.add(mesh(new THREE.BoxGeometry(0.8, h, 0.8), 0x9fb6d3, 0, h / 2, 0))
      for (let y = 0.3; y < h - 0.2; y += 0.35) g.add(mesh(new THREE.BoxGeometry(0.82, 0.08, 0.82), 0x6b84a6, 0, y, 0))
    } else if (k === 1) { // 小汽車
      g.add(mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), 0xd9584a, 0, 0.25, 0))
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.25, 0.46), 0xf3f3f3, -0.05, 0.52, 0))
      for (const [x, z] of [[-0.3, 0.26], [0.3, 0.26], [-0.3, -0.26], [0.3, -0.26]]) {
        const w = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), 0x333333, x, 0.12, z)
        w.rotation.x = Math.PI / 2
        g.add(w)
      }
    } else { // 紅綠燈
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), 0x555b66, 0, 0.6, 0))
      g.add(mesh(new THREE.BoxGeometry(0.22, 0.5, 0.18), 0x3d4450, 0, 1.3, 0))
      g.add(mesh(new THREE.SphereGeometry(0.06, 8, 8), 0xff5a4a, 0, 1.45, 0.1))
      g.add(mesh(new THREE.SphereGeometry(0.06, 8, 8), 0x56d36b, 0, 1.17, 0.1))
    }
  } else if (theme === 'space') {
    if (k === 0) { // 火箭
      g.add(mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.1, 12), 0xf3f3f8, 0, 0.75, 0))
      g.add(mesh(new THREE.ConeGeometry(0.22, 0.45, 12), 0xd9584a, 0, 1.52, 0))
      for (let j = 0; j < 3; j++) {
        const fin = mesh(new THREE.BoxGeometry(0.04, 0.4, 0.3), 0xd9584a, Math.cos(j * 2.1) * 0.25, 0.3, Math.sin(j * 2.1) * 0.25)
        fin.rotation.y = -j * 2.1
        g.add(fin)
      }
    } else if (k === 1) { // 行星
      g.add(mesh(new THREE.SphereGeometry(0.45, 18, 14), 0x8a7cf0, 0, 0.45, 0))
      const ring = mesh(new THREE.TorusGeometry(0.68, 0.05, 8, 32), 0xf4e3a1, 0, 0.45, 0)
      ring.rotation.x = 1.2
      g.add(ring)
    } else { // 衛星天線
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 8), 0xaab0c0, 0, 0.35, 0))
      const dish = mesh(new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, 1.0), 0xe6e8f0, 0, 0.9, 0)
      dish.rotation.x = 0.8
      g.add(dish)
    }
  } else {
    if (k === 0) { // 棒棒糖
      g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), 0xffffff, 0, 0.5, 0))
      const c = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24), 0xff5fa2, 0, 1.2, 0)
      c.rotation.x = Math.PI / 2
      g.add(c)
    } else if (k === 1) { // 杯子蛋糕
      g.add(mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.45, 12), 0xf2b5cf, 0, 0.22, 0))
      g.add(mesh(new THREE.SphereGeometry(0.42, 16, 10), 0xfff3f8, 0, 0.5, 0))
      g.add(mesh(new THREE.SphereGeometry(0.1, 8, 8), 0xe23b3b, 0, 0.92, 0))
    } else { // 糖果積木
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0x9be3d0, 0, 0.25, 0))
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xffd36b, 0.1, 0.75, 0))
    }
  }
  return g
}
