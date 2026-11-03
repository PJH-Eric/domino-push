/** 繁體中文（預設語系）。新增字串時三個語系都要補，tests/i18n.test.ts 會檢查。 */
export const zh = {
  'app.title': '推骨牌',
  'lang.switch': '切換語言',
  'btn.push': '推！',
} as const

export type Dict = { [K in keyof typeof zh]: string }
