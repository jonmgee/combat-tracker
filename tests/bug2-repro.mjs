/**
 * Bug 2 reproduction: player taps SWAP on DM-PC, nothing happens.
 * Two-browser flow: DM creates session with DM-PCs, player joins.
 * Captures console.debug output from the DEBUG instrumentation.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5175'
const CHROME = '/Users/jongallop/Library/Caches/ms-playwright/chromium-1091/chrome-mac/Chromium.app/Contents/MacOS/Chromium'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
  })

  // ──────────────────────────────────────
  // DM BROWSER
  // ──────────────────────────────────────
  const dmPage = await browser.newPage()
  dmPage.setViewportSize({ width: 1280, height: 900 })
  dmPage.on('console', msg => {
    if (msg.text().includes('[DEBUG') || msg.text().includes('[OrderReview]') || msg.text().includes('[InitiativeEntry]')) {
      console.log('[DM-PAGE]', msg.text())
    }
  })
  dmPage.on('pageerror', err => console.error('[DM ERROR]', err.message))

  console.log('=== 1. DM: navigate and create session ===')
  await dmPage.goto(BASE, { waitUntil: 'networkidle' })
  await sleep(2000)

  // Create session
  const createBtn = dmPage.locator('button').filter({ hasText: /Create/i })
  await createBtn.waitFor({ timeout: 5000 })
  await createBtn.click()
  await sleep(2000)

  // Name the DM
  const nameInput = dmPage.locator('input').filter({ has: dmPage.locator('[placeholder*="Name" i]') }).first()
  // Broader: find the first visible text input
  const allInputs = dmPage.locator('input')
  const inpCount = await allInputs.count()
  console.log(`Found ${inpCount} inputs`)
  let dmInput = null
  for (let i = 0; i < inpCount; i++) {
    const ph = await allInputs.nth(i).getAttribute('placeholder') || '(none)'
    const vis = await allInputs.nth(i).isVisible()
    console.log(`  Input ${i}: placeholder="${ph}" visible=${vis}`)
    if (vis && (ph.toLowerCase().includes('name') || ph === '(none)' || ph === '')) {
      dmInput = allInputs.nth(i)
    }
  }
  if (!dmInput) dmInput = allInputs.first()
  await dmInput.fill('TestDM')
  await dmInput.press('Enter')
  await sleep(2000)

  // Check what page looks like now
  const bodyText = await dmPage.locator('body').innerText()
  console.log('\n=== PAGE TEXT (first 1500) ===')
  console.log(bodyText.substring(0, 1500))

  // List all buttons with their full text
  const btns = dmPage.locator('button')
  const btnCount = await btns.count()
  console.log(`\n=== ${btnCount} BUTTONS ===`)
  for (let i = 0; i < btnCount; i++) {
    const txt = await btns.nth(i).innerText()
    console.log(`  [${i}] "${txt?.trim().replace(/\n/g, ' | ')}"`)
  }

  // Check if there's a session code / join URL
  const joinSection = dmPage.locator('text=/Join|Room|Code/i').first()
  if (await joinSection.isVisible({ timeout: 2000 })) {
    const joinText = await joinSection.innerText()
    console.log(`\nJoin info: "${joinText}"`)
  }

  await browser.close()
  console.log('\n=== Done ===')
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})