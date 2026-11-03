import type { App, Screen } from '../app'
import { t } from '../i18n'
import { h } from '../ui/dom'
import { backButton, screenEl } from './common'

/** 沙盒（M4 實作） */
export function sandboxScreen(app: App): Screen {
  const el = screenEl('sandbox')
  el.append(h('div', { class: 'topleft' }, backButton(t('common.home'), () => app.go({ to: 'home' }))))
  return { name: 'sandbox', el, dispose() {} }
}
