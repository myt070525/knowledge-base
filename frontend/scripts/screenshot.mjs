#!/usr/bin/env node
/**
 * 页面渲染验证 + 截图
 *
 * 为什么需要？—— `npm run build` 只能证明"能编译"，不能证明"页面真的画出来了"。
 * ECharts 图表空白、容器高度为 0、控制台报错，这些构建阶段都发现不了。
 * 这个脚本用真实浏览器打开页面，检查 DOM 和 canvas，并截图存证。
 *
 * 运行：node scripts/screenshot.mjs [baseUrl]
 */
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../screenshots')
const baseUrl = process.argv[2] || 'http://127.0.0.1:5173'

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME_CANDIDATES.find((p) => existsSync(p)),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1680,1400'],
})

let hasError = false

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1680, height: 1400, deviceScaleFactor: 1 })

  // 收集浏览器控制台错误
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

  // ---------------- 评测看板 ----------------
  console.log('打开 /dashboard ...')
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForSelector('canvas', { timeout: 30000 })
  // 等图表动画画完
  await new Promise((r) => setTimeout(r, 1500))

  const dashboardStats = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')]
    return {
      title: document.title,
      canvasCount: canvases.length,
      // 有实际像素的 canvas 才算真的画出来了
      nonEmptyCanvas: canvases.filter((c) => c.width > 0 && c.height > 0).length,
      sectionCount: document.querySelectorAll('.section').length,
      tableRows: document.querySelectorAll('.el-table__row').length,
      bodyText: document.body.innerText.slice(0, 200),
    }
  })

  console.log('  标题:', dashboardStats.title)
  console.log('  canvas 数量:', dashboardStats.canvasCount)
  console.log('  区块数量:', dashboardStats.sectionCount)
  console.log('  表格行数:', dashboardStats.tableRows)

  await page.screenshot({ path: resolve(outDir, 'dashboard-full.png'), fullPage: true })
  console.log('  截图: screenshots/dashboard-full.png')

  // 只截首屏（用于快速预览）
  await page.screenshot({ path: resolve(outDir, 'dashboard-top.png') })

  // ---------------- 问答界面 ----------------
  console.log('打开 /chat ...')
  await page.goto(`${baseUrl}/chat`, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForSelector('.chat-input textarea', { timeout: 30000 })

  // 真实模拟一次提问，验证打字机效果
  await page.type('.chat-input textarea', '水稻的需水临界期是什么时候')
  await page.click('.chat-input__actions button')
  await new Promise((r) => setTimeout(r, 2500))

  const chatStats = await page.evaluate(() => ({
    bubbles: document.querySelectorAll('.chat-bubble').length,
    sources: document.querySelectorAll('.chat-source').length,
    lastAnswer: [...document.querySelectorAll('.chat-bubble')].pop()?.innerText || '',
  }))

  console.log('  消息气泡:', chatStats.bubbles)
  console.log('  引用来源卡片:', chatStats.sources)
  console.log('  末条回答前 60 字:', chatStats.lastAnswer.slice(0, 60).replace(/\n/g, ' '))

  await page.screenshot({ path: resolve(outDir, 'chat.png'), fullPage: true })
  console.log('  截图: screenshots/chat.png')

  // ---------------- 断言 ----------------
  console.log('\n验证结果：')
  const checks = [
    ['看板页面标题正确', dashboardStats.title.includes('评测可视化看板')],
    ['看板渲染出 canvas 图表', dashboardStats.nonEmptyCanvas >= 6],
    ['看板有内容区块', dashboardStats.sectionCount >= 5],
    ['看板表格有数据行', dashboardStats.tableRows > 0],
    ['问答页面有 2 条以上消息', chatStats.bubbles >= 2],
    ['问答返回了引用来源', chatStats.sources >= 1],
    ['模型答案包含关键内容', chatStats.lastAnswer.includes('孕穗期')],
  ]
  checks.forEach(([name, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${name}`))
  if (checks.some(([, ok]) => !ok)) hasError = true

  if (consoleErrors.length) {
    console.log('\n浏览器控制台错误：')
    consoleErrors.slice(0, 10).forEach((e) => console.log('  !', e))
    hasError = true
  } else {
    console.log('\n无浏览器控制台错误。')
  }
} finally {
  await browser.close()
}

process.exit(hasError ? 1 : 0)
