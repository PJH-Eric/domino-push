import { svg } from './dom'

const wrap = (inner: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`

/** 自繪線條圖示（木刻風：粗線、圓頭） */
export const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor"/>',
  starO: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  cw: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
  ccw: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".8" fill="currentColor"/>',
  push: '<path d="M4 20h16"/><rect x="6" y="6" width="4" height="12" rx="1"/><path d="M13 12h7M17 9l3 3-3 3"/>',
  domino: '<rect x="8" y="3" width="8" height="18" rx="1.5"/><path d="M8 12h8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  top: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
  orbit: '<ellipse cx="12" cy="12" rx="9" ry="4"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M10.5 7.5v6M7.5 10.5h6"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M7.5 10.5h6"/>',
  line: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5l11-11"/>',
  curve: '<circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/><path d="M5 17C8 4 16 4 19 17"/>',
  circle: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  spiral: '<path d="M12 12c0-1 1-2 2-1.5s1 2.5-.5 3.2-3.7-.2-4-2.2 1.5-4.4 4-4.5 5 2 5 5-3 6-6.5 6S5 15.5 5 12s3-8 8-8"/>',
  fork: '<path d="M12 21v-8M12 13L5 4M12 13l7-9"/>',
  single: '<rect x="9" y="4" width="6" height="16" rx="1.5"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v7M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7s-5-2-6.5-5L3 12.5a1.6 1.6 0 0 1 2.6-1.8L8 13"/>',
  eraser: '<path d="M4 16l9-9 7 7-6 6H8z"/><path d="M9 11l7 7M8 20h12"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  slow: '<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
  rewind: '<path d="M11 6L4 12l7 6zM20 6l-7 6 7 6z" fill="currentColor"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>',
  grid: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
  sandbox: '<path d="M3 20h18"/><rect x="5" y="9" width="3" height="11"/><rect x="10.5" y="6" width="3" height="14" transform="rotate(12 12 13)"/><rect x="16" y="10" width="3" height="10"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1.2 1.8 2.5 2.5 4 2.5s2.8-.7 4-2.5"/><circle cx="9" cy="10" r=".9" fill="currentColor"/><circle cx="15" cy="10" r=".9" fill="currentColor"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
} as const

export type IconName = keyof typeof ICONS

export function icon(name: IconName, cls = 'icon'): SVGSVGElement {
  return svg(wrap(ICONS[name]), cls)
}
