import { describe, expect, test } from 'vitest'
import { PointerTaps } from '../src/screens/pointer'

type Listener = EventListenerOrEventListenerObject
type PointerOptions = Omit<ConstructorParameters<typeof PointerTaps>[1], 'tap'>

class FakeCanvas {
  private listeners = new Map<string, { listener: Listener; capture: boolean }[]>()

  addEventListener(type: string, listener: Listener | null, options?: boolean | AddEventListenerOptions): void {
    if (!listener) return
    const entries = this.listeners.get(type) ?? []
    const capture = typeof options === 'boolean' ? options : options?.capture ?? false
    entries.push({ listener, capture })
    this.listeners.set(type, entries)
  }

  removeEventListener(type: string, listener: Listener | null, options?: boolean | EventListenerOptions): void {
    if (!listener) return
    const capture = typeof options === 'boolean' ? options : options?.capture ?? false
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((entry) => entry.listener !== listener || entry.capture !== capture),
    )
  }

  setPointerCapture(): void {}

  pointer(type: string, pointerId: number, x: number, y: number): void {
    let stopped = false
    const event = {
      type,
      pointerId,
      pointerType: 'touch',
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      stopImmediatePropagation: () => { stopped = true },
      preventDefault: () => {},
    } as unknown as PointerEvent
    const entries = this.listeners.get(type) ?? []
    const ordered = [...entries.filter((entry) => entry.capture), ...entries.filter((entry) => !entry.capture)]
    for (const { listener } of ordered) {
      if (stopped) break
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }
}

function setup(options: PointerOptions = {}) {
  const canvas = new FakeCanvas()
  const taps: { x: number; y: number; kind: 'mouse' | 'touch' }[] = []
  const pointerTaps = new PointerTaps(canvas as unknown as HTMLElement, {
    ...options,
    tap: (x, y, kind) => taps.push({ x, y, kind }),
  })
  return { canvas, taps, pointerTaps }
}

describe('畫布多指觸控', () => {
  test('兩指靜止點擊會各自回報一次', () => {
    const { canvas, taps, pointerTaps } = setup()

    canvas.pointer('pointerdown', 1, 20, 30)
    canvas.pointer('pointerdown', 2, 80, 90)
    canvas.pointer('pointerup', 1, 20, 30)
    expect(taps).toEqual([])

    canvas.pointer('pointerup', 2, 80, 90)
    expect(taps).toEqual([
      { x: 20, y: 30, kind: 'touch' },
      { x: 80, y: 90, kind: 'touch' },
    ])
    pointerTaps.dispose()
  })

  test('多指移動手勢不會被當成擺放點', () => {
    const { canvas, taps, pointerTaps } = setup()

    canvas.pointer('pointerdown', 1, 20, 30)
    canvas.pointer('pointerdown', 2, 80, 90)
    canvas.pointer('pointermove', 1, 35, 30)
    canvas.pointer('pointerup', 1, 35, 30)
    canvas.pointer('pointerup', 2, 80, 90)

    expect(taps).toEqual([])
    pointerTaps.dispose()
  })

  test('拖曳骨牌時第二指不會額外擺放', () => {
    const dragEnds: boolean[] = []
    const { canvas, taps, pointerTaps } = setup({
      dragStart: () => true,
      dragEnd: (moved) => dragEnds.push(moved),
    })

    canvas.pointer('pointerdown', 1, 20, 30)
    canvas.pointer('pointerdown', 2, 80, 90)
    canvas.pointer('pointerup', 1, 20, 30)
    canvas.pointer('pointerup', 2, 80, 90)

    expect(taps).toEqual([])
    expect(dragEnds).toEqual([false])
    pointerTaps.dispose()
  })
})
