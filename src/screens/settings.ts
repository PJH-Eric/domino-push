import type { App } from '../app'
import { audio } from '../audio/engine'
import { getSettings, resetSettings, updateSettings, type QualitySetting } from '../game/settings'
import { LANG_NAMES, LANGS, onLangChange, t } from '../i18n'
import { h } from '../ui/dom'
import { Button, openModal, Segmented, Slider, Toggle, type ModalHandle } from '../ui/kit'

let open: ModalHandle | null = null

/** 右上角設定彈窗：設定立即套用並保存；語言切換時內容即時更新 */
export function openSettings(app: App): void {
  if (open) return
  void app
  const body = h('div', { class: 'settings-body' })
  const render = () => {
    const s = getSettings()
    body.replaceChildren(
      h('h3', { class: 'panel-title', text: t('settings.sound') }),
      Toggle({ label: t('settings.music'), value: s.musicOn, onChange: (v) => { updateSettings({ musicOn: v }); audio.unlock() } }),
      Slider({ label: t('settings.musicVol'), value: s.musicVol, onChange: (v) => updateSettings({ musicVol: v }), format: (v) => `${Math.round(v)}%` }),
      Toggle({ label: t('settings.sfx'), value: s.sfxOn, onChange: (v) => { updateSettings({ sfxOn: v }); audio.click() } }),
      Slider({ label: t('settings.sfxVol'), value: s.sfxVol, onChange: (v) => updateSettings({ sfxVol: v }), format: (v) => `${Math.round(v)}%` }),
      Toggle({ label: t('settings.haptics'), hint: t('settings.hapticsHint'), value: s.haptics, onChange: (v) => updateSettings({ haptics: v }) }),
      h('h3', { class: 'panel-title', text: t('settings.play') }),
      Toggle({ label: t('settings.autoAim'), hint: t('settings.autoAimHint'), value: s.autoAim, onChange: (v) => updateSettings({ autoAim: v }) }),
      Toggle({ label: t('settings.reach'), hint: t('settings.reachHint'), value: s.reachGuide, onChange: (v) => updateSettings({ reachGuide: v }) }),
      Toggle({ label: t('settings.follow'), hint: t('settings.followHint'), value: s.cameraFollow, onChange: (v) => updateSettings({ cameraFollow: v }) }),
      h('h3', { class: 'panel-title', text: t('settings.display') }),
      Segmented<QualitySetting>({
        label: t('settings.quality'),
        value: s.quality,
        options: [
          { value: 'auto', label: t('settings.q.auto') },
          { value: 'high', label: t('settings.q.high') },
          { value: 'medium', label: t('settings.q.medium') },
          { value: 'low', label: t('settings.q.low') },
        ],
        onChange: (v) => updateSettings({ quality: v }),
      }),
      Toggle({ label: t('settings.reduceMotion'), hint: t('settings.reduceMotionHint'), value: s.reduceMotion, onChange: (v) => updateSettings({ reduceMotion: v }) }),
      Toggle({ label: t('settings.colorAssist'), hint: t('settings.colorAssistHint'), value: s.colorAssist, onChange: (v) => updateSettings({ colorAssist: v }) }),
      Segmented({
        label: t('settings.lang'),
        value: s.lang,
        options: LANGS.map((l) => ({ value: l, label: LANG_NAMES[l] })),
        onChange: (v) => updateSettings({ lang: v }),
      }),
    )
  }
  render()
  const reset = Button({ label: t('settings.reset'), icon: 'refresh', size: 'sm', onClick: () => { resetSettings(); render() } })
  const done = Button({ label: t('common.done'), icon: 'check', variant: 'success', size: 'sm', onClick: () => open?.close() })
  const off = onLangChange(() => {
    render()
    reset.querySelector('.btn-label')!.textContent = t('settings.reset')
    done.querySelector('.btn-label')!.textContent = t('common.done')
    open?.el.querySelector('h2')?.replaceChildren(t('settings.title'))
  })
  open = openModal({
    title: t('settings.title'),
    body,
    footer: h('div', { class: 'modal-foot-inner', style: 'display:contents' }, reset, done),
    closeLabel: t('common.close'),
    onClose: () => { off(); open = null },
  })
}
