/**
 * 分辨「點一下」與拖曳／多指鏡頭手勢；靜止的同時觸控在手勢結束後各回報一次點擊。
 * 滑鼠沒按下時的移動回報為 hover（擺放預覽跟著游標）。
 */
export class PointerTaps {
  private downs = new Map<number, { x: number; y: number; t: number }>()
  private multi = false
  private multiMoved = false
  private multiCancelled = false
  private multiDrag = false
  private multiTouchOnly = true
  private pendingTaps: { x: number; y: number; kind: 'mouse' | 'touch' }[] = []
  private off: () => void

  constructor(el: HTMLElement, cb: { tap: (x: number, y: number, kind: 'mouse' | 'touch') => void; hover?: (x: number, y: number) => void; leave?: () => void; dragStart?: (x: number, y: number, kind: 'mouse' | 'touch') => boolean; dragMove?: (x: number, y: number) => void; dragEnd?: (moved: boolean) => void }) {
    // 拖曳骨牌：按在可拖的骨牌上時攔下事件，鏡頭就不會跟著轉
    let drag: { id: number; x: number; y: number; moved: boolean } | null = null
    const resetGesture = () => {
      this.multi = false
      this.multiMoved = false
      this.multiCancelled = false
      this.multiDrag = false
      this.multiTouchOnly = true
      this.pendingTaps = []
    }
    const trackDown = (e: PointerEvent) => {
      if (this.downs.size === 0) resetGesture()
      this.downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() })
      if (this.downs.size > 1) this.multi = true
      if (e.pointerType !== 'touch') this.multiTouchOnly = false
    }
    const dragDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (drag) {
        trackDown(e)
        e.stopImmediatePropagation()
        return
      }
      if (this.downs.size > 0) return
      if (!cb.dragStart?.(e.clientX, e.clientY, e.pointerType === 'mouse' ? 'mouse' : 'touch')) return
      trackDown(e)
      this.multiDrag = true
      e.stopImmediatePropagation()
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
      try { el.setPointerCapture(e.pointerId) } catch { /* 合成事件沒有可捕捉的指標 */ }
    }
    const dragMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      e.stopImmediatePropagation()
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return
      drag.moved = true
      this.multiMoved = true
      cb.dragMove?.(e.clientX, e.clientY)
    }
    const dragUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      e.stopImmediatePropagation()
      const moved = drag.moved
      const wasMulti = this.multi
      drag = null
      this.downs.delete(e.pointerId)
      if (e.type !== 'pointerup') this.multiCancelled = true
      cb.dragEnd?.(moved)
      if (!moved && !wasMulti && e.type === 'pointerup') cb.tap(e.clientX, e.clientY, e.pointerType === 'mouse' ? 'mouse' : 'touch')
      if (this.downs.size === 0) resetGesture()
    }
    el.addEventListener('pointerdown', dragDown, true)
    el.addEventListener('pointermove', dragMove, true)
    el.addEventListener('pointerup', dragUp, true)
    el.addEventListener('pointercancel', dragUp, true)
    const down = (e: PointerEvent) => trackDown(e)
    const move = (e: PointerEvent) => {
      const d = this.downs.get(e.pointerId)
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 8) this.multiMoved = true
      else if (!d && e.pointerType === 'mouse' && e.buttons === 0) cb.hover?.(e.clientX, e.clientY)
    }
    const up = (e: PointerEvent) => {
      const d = this.downs.get(e.pointerId)
      this.downs.delete(e.pointerId)
      if (!d) return
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y)
      const wasMulti = this.multi
      const gestureMoved = this.multiMoved
      const gestureCancelled = this.multiCancelled
      const validTap =
        e.type === 'pointerup' &&
        moved <= 8 &&
        performance.now() - d.t <= 600 &&
        !(e.pointerType === 'mouse' && e.button !== 0)
      if (wasMulti) {
        if (validTap) {
          this.pendingTaps.push({
            x: e.clientX,
            y: e.clientY,
            kind: e.pointerType === 'mouse' ? 'mouse' : 'touch',
          })
        }
        if (this.downs.size === 0) {
          const taps = this.pendingTaps
          const deliver = !this.multiMoved && !this.multiCancelled && !this.multiDrag && this.multiTouchOnly
          resetGesture()
          if (deliver) {
            for (const tap of taps) cb.tap(tap.x, tap.y, tap.kind)
          }
        }
        return
      }
      if (this.downs.size === 0) resetGesture()
      if (!validTap || gestureMoved || gestureCancelled) return
      cb.tap(e.clientX, e.clientY, e.pointerType === 'mouse' ? 'mouse' : 'touch')
    }
    const cancel = (e: PointerEvent) => {
      this.downs.delete(e.pointerId)
      this.multiCancelled = true
      if (this.downs.size === 0) resetGesture()
    }
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
