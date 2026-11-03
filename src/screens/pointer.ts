/**
 * 分辨畫布上的「點一下」與「拖曳轉鏡頭」：移動少於 8px 且單指才算點擊。
 * 滑鼠沒按下時的移動回報為 hover（擺放預覽跟著游標）。
 */
export class PointerTaps {
  private downs = new Map<number, { x: number; y: number; t: number; type: string }>()
  private multi = false
  private off: () => void

  constructor(el: HTMLElement, cb: { tap: (x: number, y: number, kind: 'mouse' | 'touch') => void; hover?: (x: number, y: number) => void; leave?: () => void }) {
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
