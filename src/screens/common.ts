import type { App } from '../app'
import { audio } from '../audio/engine'
import { t } from '../i18n'
import { h } from '../ui/dom'
import { Button, openModal } from '../ui/kit'

export const LOBBY_URL = 'https://pjh-eric.github.io/game-lobby/'

export function screenEl(name: string): HTMLElement {
  return h('div', { class: `screen ${name}` })
}

/** 手機收合鏡頭工具；畫布尺寸改變時重新取景並保留視角選擇。 */
export function mobilePlayLayout(app: App, el: HTMLElement, fit: () => void): () => void {
  const button = Button({
    icon: 'orbit', ariaLabel: t('game.cameraTools'), class: 'mobile-camera-toggle',
    onClick: () => {
      const open = el.classList.toggle('cam-open')
      button.setAttribute('aria-expanded', String(open))
    },
  })
  button.setAttribute('aria-expanded', 'false')
  el.append(button)
  // renderAll 會重建畫面；保留同一個入口與展開狀態。
  const children = new MutationObserver(() => {
    button.setAttribute('aria-label', t('game.cameraTools'))
    if (!el.contains(button)) el.append(button)
  })
  children.observe(el, { childList: true })
  const viewport = new ResizeObserver(() => { app.stage.resize(); fit() })
  viewport.observe(app.stage.renderer.domElement)
  return () => { children.disconnect(); viewport.disconnect() }
}

/** 左上角返回鈕 */
export function backButton(label: string, onClick: () => void): HTMLButtonElement {
  return Button({ icon: 'back', label, size: 'sm', class: 'back-btn', onClick: () => { audio.click(); onClick() } })
}

/** 確認視窗（自訂外觀） */
export function confirmBox(o: { title: string; text: string; ok: string; danger?: boolean; onOk: () => void }): void {
  const m = openModal({
    title: o.title,
    body: h('p', { text: o.text, style: 'font-weight:700' }),
    width: 'sm',
    closeLabel: t('common.close'),
    footer: h('div', { style: 'display:contents' },
      Button({ label: t('common.cancel'), size: 'sm', onClick: () => m.close() }),
      Button({ label: o.ok, size: 'sm', variant: o.danger ? 'danger' : 'primary', onClick: () => { m.close(); o.onOk() } }),
    ),
  })
}

export function starsEl(n: number, total = 3): HTMLElement {
  const el = h('span', { class: 'stars', attrs: { role: 'img', 'aria-label': t('common.starsAria', { n }) } })
  for (let i = 0; i < total; i++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    s.setAttribute('viewBox', '0 0 24 24')
    s.setAttribute('class', `icon ${i < n ? 'on' : 'off'}`)
    s.setAttribute('aria-hidden', 'true')
    s.innerHTML = '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" stroke="#4a2c17" stroke-width="1.2" stroke-linejoin="round"/>'
    el.appendChild(s)
  }
  return el
}

export type { App }
