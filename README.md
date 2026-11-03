# 推骨牌 Domino Push

3D 木頭積木風推骨牌，純單機、純前端（Vite＋TypeScript＋Three.js＋Rapier 物理）。沒有線上對戰、沒有電腦對手、沒有後端。

## 玩法

- **挑戰模式**：30 個手設關卡（積木村／營地／小城／太空站／糖果屋各 6 關），依序解鎖。在綠色桌墊上擺骨牌，按「推！」讓紅帶起點一路推倒所有金色目標；用越少骨牌星越多。
- **隨機關**：輸入種子號碼產生關卡，同一個號碼永遠同一關；每個候選關卡都先用物理模擬驗證可解。
- **自由沙盒**：單張／直線／曲線／圓形／螺旋／分岔／橡皮擦工具，8 色 3 尺寸，慢動作、重播、10 格存檔與分數。
- **紀錄與成就**：個人統計與 26 個成就，只存在本機瀏覽器。挑戰結算、沙盒分數與紀錄頁可分享圖片（與其他遊戲共用 `public/result-share.js`）。
- 語言：繁體中文、簡體中文、English（右上角地球鈕，緊鄰設定）。

## 本機執行

```bash
npm install
npm run dev        # http://localhost:3110
```

Windows 可直接雙擊 `啟動遊戲.bat`（第一次會自動 `npm install`，並列出同一個 Wi-Fi 可連的區網網址）。

## 指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器（埠 3110） |
| `npm test` | Vitest：物理、30 關可解性、隨機關、規則、三語系、分數 |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm run build` | 正式建置到 `dist/` |
| `npm run seo` | 建置後注入 GA4 與 SEO、產生 sitemap（部署 workflow 會自動執行） |
| `npm run verify` | 型別檢查＋測試＋建置 |

開發用網址參數：`?turbo` 會加快物理模擬（自動化截圖用，只在 `npm run dev` 有效）。

## 部署（GitHub Pages）

`.github/workflows/deploy-pages.yml` 在推到 `main` 時建置並部署到 GitHub Pages，網址預設 `https://pjh-eric.github.io/domino-push/`。需要的 repository variable：

- `GA_MEASUREMENT_ID`（選填，未設定時使用與其他遊戲共用的衡量 ID）

這款沒有後端，不需要 `GAME_SERVER_URL` 或 Render。

## 專案結構

```
src/core       純規則：型別、幾何、擺放驗證、星等
src/physics    Rapier 物理世界（固定 1/120 秒步長、倒下判定、快照）
src/levels     關卡建構器、五章 30 關、隨機關生成器
src/game       擺放邏輯、推動與重播、沙盒圖形工具、設定
src/render     Three.js 舞台、程序木紋貼圖、桌布主題、裝飾
src/screens    首頁、選關、遊戲、沙盒、紀錄成就、怎麼玩、設定
src/storage    進度、沙盒存檔、紀錄與成就（localStorage，含壞檔防護）
src/ui         自訂元件（按鈕、開關、滑桿、選單、捲軸、彈窗）與樣式
tests          Vitest 測試
```

## 素材

所有圖形（木紋、桌布、骨牌、圖示）與音效、背景音樂都由程式即時產生，沒有外部授權素材；`public/vendor/html2canvas.min.js`（MIT）僅供分享圖片使用。
