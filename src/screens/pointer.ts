/**
 * 分辨畫布上的「點一下」與「拖曳轉鏡頭」：移動少於 8px 且單指才算點擊。
 * 滑鼠沒按下時的移動回報為 hover（擺放預覽跟著游標）。
 */
export class PointerTaps {
  private downs = new Map<number, { x: number; y: number; t: number; type: string }>()
  private multi = false
  private off: () => void

  constructor(el: HTMLElement, cb: { tap: (x: number, y: number, kind: 'mouse' | 'touch') => void; hover?: (x: number, y: number) => void; leave?: () => void; dragStart?: (x: number, y: number, kind: 'mouse' | 'touch') => boolean; dragMove?: (x: number, y: number) => void; dragEnd?: (moved: boolean) => void }) {
    // 拖曳骨牌：按在可拖的骨牌上時攔下事件，鏡頭就不會跟著轉
    let drag: { id: number; x: number; y: number; moved: boolean } | null = null
    const dragDown = (e: PointerEvent) => {
      if (drag || this.downs.size > 0 || (e.pointerType === 'mouse' && e.button !== 0)) return
      if (!cb.dragStart?.(e.clientX, e.clientY, e.pointerType === 'mouse' ? 'mouse' : 'touch')) return
      e.stopImmediatePropagation()
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
      try { el.setPointerCapture(e.pointerId) } catch { /* 合成事件沒有可捕捉的指標 */ }
    }
    const dragMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      e.stopImmediatePropagation()
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return
      drag.moved = true
      cb.dragMove?.(e.clientX, e.clientY)
    }
    const dragUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      e.stopImmediatePropagation()
      const moved = drag.moved
      drag = null
      cb.dragEnd?.(moved)
      if (!moved && e.type === 'pointerup') cb.tap(e.clientX, e.clientY, e.pointerType === 'mouse' ? 'mouse' : 'touch')
    }
    el.addEventListener('pointerdown', dragDown, true)
    el.addEventListener('pointermove', dragMove, true)
    el.addEventListener('pointerup', dragUp, true)
    el.addEventListener('pointercancel', dragUp, true)
    const down = (e: PointerEvent) => {
      this.downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType })
      if (this.downs.size > 1) this.multi = true
    }
    const move = (e: PointerEvent) => {
      const d = this.downs.get(e.pointerId)
      if (!d && e.pointerType === 'mouse' && e.buttons === 0) cb.hover?.(e.clientX, e.clientY)
    }
    const up = (e: PointerEvent) => {
      const d = this.downs.get(e.pointerId)
      this.downs.delete(e.pointerId)
      if (!d) return
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y)
      const wasMulti = this.multi
      if (this.downs.size === 0) this.multi = false
      if (wasMulti || moved > 8 || performance.now() - d.t > 600) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      cb.tap(e.clientX, e.clientY, e.pointerType === 'mouse' ? 'mouse' : 'touch')
    }
    const cancel = (e: PointerEvent) => { this.downs.delete(e.pointerId); if (this.downs.size === 0) this.multi = false }
    const leave = () => cb.leave?.()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    this.off = () => {
      el.removeEventListener('pointerdown', dragDown, true)
      el.removeEventListener('pointermove', dragMove, true)
      el.removeEventListener('pointerup', dragUp, true)
      el.removeEventListener('pointercancel', dragUp, true)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('pointerleave', leave)
    }
  }

  dispose(): void {
    this.off()
  }
}
