// 瀏覽器端到端煙霧測試：需先 npm run dev（埠 3110）並安裝 Playwright。
// 用法：node scripts/e2e-smoke.cjs
// 涵蓋：實際點擊擺放過關、語言切換不重置、結算與再來一局、空擺失敗與再試一次、解鎖、沙盒分數與慢動作重播、紀錄成就保存。
const { chromium } = require('playwright')
const assert = require('assert')
;(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto('http://localhost:3110/?turbo')
  await p.evaluate("localStorage.clear();localStorage.setItem('game-island-lang','zh-Hant');localStorage.setItem('domino-push.settings.v1', JSON.stringify({quality:'low',musicOn:false,reduceMotion:true}))")
  await p.reload(); await p.waitForTimeout(3500)
  const text = () => p.evaluate(() => document.body.innerText)
  const log = (m) => console.log('✓', m)
  // A：實際點擊擺放第 1 關並過關
  await p.click('.home-btns .btn >> nth=0', { force: true }); await p.waitForTimeout(1500)
  await p.click('.lv >> nth=0', { force: true }); await p.waitForTimeout(2500)
  const pts = await p.evaluate(() => window.__dpSolutionScreen())
  for (const pt of pts) { await p.mouse.move(pt.x, pt.y); await p.waitForTimeout(150); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(250) }
  const used = await p.evaluate(() => document.querySelector('.hud-count').textContent)
  console.log('used', used, 'expected', pts.length)
  assert.ok(used.startsWith(String(pts.length)), '真實點擊應放下全部標準解骨牌')
  log('實際點擊擺放 ' + used)
  // 語言切換不重置
  await p.click('.langbtn', { force: true }); await p.waitForTimeout(400)
  await p.click('.langopt >> nth=2', { force: true }); await p.waitForTimeout(800)
  const used2 = await p.evaluate(() => document.querySelector('.hud-count').textContent)
  assert.equal(used2, used); assert.ok((await text()).includes('Push!'))
  log('切換英文後擺放數不變：' + used2)
  await p.click('.langbtn', { force: true }); await p.waitForTimeout(400)
  await p.click('.langopt >> nth=0', { force: true }); await p.waitForTimeout(800)
  await p.keyboard.press('Space')
  let ok = false
  for (let i = 0; i < 40 && !ok; i++) { await p.waitForTimeout(1000); ok = (await text()).includes('過關！') }
  assert.ok(ok, '應出現結算'); log('推倒後出現結算疊加視窗')
  
  const prog = await p.evaluate(() => localStorage.getItem('domino-push.progress.v1'))
  assert.ok(prog.includes('L01')); log('進度已保存')
  await p.click('text=再來一局', { force: true }); await p.waitForTimeout(2500)
  assert.ok((await p.evaluate(() => document.querySelector('.hud-count').textContent)).startsWith('0')); log('再來一局重設擺放')
  // B：什麼都不擺直接推 → 失敗 → 再試一次
  await p.keyboard.press('Space')
  ok = false
  for (let i = 0; i < 40 && !ok; i++) { await p.waitForTimeout(1000); ok = (await text()).includes('再試一次') }
  assert.ok(ok, '空擺應失敗'); log('空擺推倒顯示失敗橫幅')
  await p.click('text=再試一次', { force: true }); await p.waitForTimeout(1500)
  assert.ok((await text()).includes('推！')); log('再試一次回到擺放')
  // 暫停 → 回選關 → 第 2 關已解鎖
  await p.keyboard.press('Escape'); await p.waitForTimeout(600)
  await p.click('.modal >> text=選關', { force: true }); await p.waitForTimeout(2000)
  const locked2 = await p.evaluate(() => document.querySelectorAll('.lv')[1].disabled)
  assert.equal(locked2, false); log('第 2 關已解鎖')
  // D：沙盒推倒 → 分數 → 慢動作重播
  await p.evaluate(() => window.__dpGo({ to: 'sandbox' })); await p.waitForTimeout(2500)
  await p.evaluate(() => window.__dpSandbox(1)); await p.waitForTimeout(800)
  await p.evaluate(() => window.__dpSandbox(-1))
  ok = false
  for (let i = 0; i < 60 && !ok; i++) { await p.waitForTimeout(1000); ok = (await text()).includes('骨牌秀分數') }
  assert.ok(ok, '沙盒應出現分數'); log('沙盒推完出現分數')
  
  await p.click('text=慢動作重播', { force: true }); await p.waitForTimeout(3000)
  assert.ok((await text()).includes('重播中')); log('慢動作重播中')
  const stats = await p.evaluate(() => JSON.parse(localStorage.getItem('domino-push.records.v1')))
  assert.ok(stats.pushes >= 3 && stats.sandboxRuns === 1 && stats.unlocked.first_push); log('紀錄與成就已保存：pushes=' + stats.pushes + ' 成就 ' + Object.keys(stats.unlocked).join(','))
  console.log('pageerrors', errs)
  await b.close()
})().catch((e) => { console.log('FAIL', e.message); process.exit(1) })
