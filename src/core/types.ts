/** 推骨牌的純資料型別：關卡、骨牌、機關。所有座標單位為「格」（中型骨牌高 1）。 */

/** 骨牌功能：起點（紅帶）、目標（金帶）、固定（深木帶，不可移除）、玩家擺放（無帶）、沙盒自由擺放 */
export type DominoKind = 'start' | 'target' | 'fixed' | 'player' | 'free'
export type SizeId = 's' | 'm' | 'l'

/**
 * 一張骨牌。a 為繞 Y 軸的角度（弧度），骨牌「面向」a 方向倒下：方向向量 (cos a, 0, −sin a)。
 * y 為底面高度（預設 0＝桌面）。
 */
export interface DominoSpec {
  x: number
  z: number
  a: number
  y?: number
  size?: SizeId
  kind: DominoKind
  /** 沙盒彩漆顏色（0xRRGGBB）；未指定＝原木色 */
  color?: number
}

/** 靜態木塊（平台、階梯、牆、斜坡）。p＝繞 Z 軸傾角（斜坡用）；a＝繞 Y 軸角度 */
export interface BoxPiece {
  type: 'box'
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  a?: number
  p?: number
  tone?: 'light' | 'dark' | 'red' | 'blue' | 'green' | 'yellow'
}

/** 會動的積木塊（積木塔、牆）；target＝金色目標積木 */
export interface BlockPiece {
  type: 'block'
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  a?: number
  target?: boolean
  tone?: 'light' | 'red' | 'blue' | 'green' | 'yellow' | 'purple'
}

/** 木頭彈珠 */
export interface BallPiece {
  type: 'ball'
  x: number
  y: number
  z: number
  r: number
}

/** 蹺蹺板／槓桿：長木板中央以支點固定（繞水平軸轉動）。a＝木板長邊方向；tilt＝初始傾角（正＝+方向那端朝下） */
export interface SeesawPiece {
  type: 'seesaw'
  x: number
  z: number
  len: number
  a: number
  h: number
  tilt: number
}

/** 旋轉槓桿：直立支柱上的水平橫桿，繞垂直軸轉動（a＝橫桿方向，h＝橫桿高度） */
export interface LeverPiece {
  type: 'lever'
  x: number
  z: number
  len: number
  a: number
  h: number
}

export type Piece = BoxPiece | BlockPiece | BallPiece | SeesawPiece | LeverPiece

/** 可擺放區（綠色桌墊）。a 為旋轉角，y 為表面高度 */
export interface Zone {
  x: number
  z: number
  w: number
  d: number
  y?: number
  a?: number
}

export type ThemeId = 'village' | 'camp' | 'town' | 'space' | 'candy'

export interface Level {
  id: string
  /** 關卡序號（1 起算）；隨機關為 0 */
  no: number
  theme: ThemeId
  /** 關卡名稱的 i18n key；隨機關用 seed 顯示 */
  nameKey?: string
  /** 第一次進入顯示的提示 i18n key */
  hintKey?: string
  dominoes: DominoSpec[]
  pieces: Piece[]
  zones: Zone[]
  limit: number
  star3: number
  star2: number
  /** 標準解：玩家要擺放的骨牌（測試驗證可三星過關） */
  solution: DominoSpec[]
  /** 場景範圍（相機與桌面大小） */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  seed?: number
}
