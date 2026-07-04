import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5174'

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', msg => console.log('[PAGE]', msg.text()))
  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message))

  console.log(`Testing against ${BASE}`)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  await page.screenshot({ path: '/tmp/01-home.png', fullPage: true })
  console.log('✅ Home loaded')

  // ── 1. Create session as DM ──
  // HomeScreen: click "Create Session" or similar
  const createBtn = page.locator('button').filter({ hasText: /Create/i }).first()
  await createBtn.waitFor({ timeout: 5000 })
  await createBtn.click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/02-lobby.png', fullPage: true })
  console.log('✅ Create clicked')

  // ── 2. DM names themselves ──
  // LobbyScreen: fill in DM name
  const dmNameInput = page.locator('input').filter({ has: page.locator('[placeholder*="Name" i]') }).first()
  // Try a more general approach
  const allInputs = page.locator('input')
  const inputCount = await allInputs.count()
  console.log(`Found ${inputCount} inputs`)

  // Find the name input - likely first visible input
  for (let i = 0; i < inputCount; i++) {
    const ph = await allInputs.nth(i).getAttribute('placeholder') || ''
    console.log(`  Input ${i}: placeholder="${ph}", value="${await allInputs.nth(i).inputValue()}"`)
  }

  // Just fill the first text input
  const textInput = page.locator('input[type="text"], input:not([type])').first()
  if (await textInput.isVisible()) {
    await textInput.fill('TestDM')
    await textInput.press('Enter')
    console.log('✅ DM name entered')
  }
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/03-dm-named.png', fullPage: true })

  // Log what buttons are visible
  const buttons = page.locator('button')
  const btnCount = await buttons.count()
  console.log(`\nButtons on page (${btnCount}):`)
  for (let i = 0; i < btnCount; i++) {
    const text = await buttons.nth(i).textContent()
    const visible = await buttons.nth(i).isVisible()
    console.log(`  ${i}: "${text?.trim()}" visible=${visible}`)
  }

  // ── 3. Find DM-PC add functionality ──
  // Look for "Add" buttons, + buttons, or the InitiativeEntry component
  const addBtn = page.locator('button').filter({ hasText: /\+|Add/i }).first()
  if (await addBtn.isVisible({ timeout: 2000 })) {
    console.log('Found Add button, clicking...')
    await addBtn.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: '/tmp/04-add-pc.png', fullPage: true })
  }

  // Check what's on screen now
  const allInputs2 = page.locator('input')
  const inputCount2 = await allInputs2.count()
  console.log(`\nInputs after Add click (${inputCount2}):`)
  for (let i = 0; i < inputCount2; i++) {
    const ph = await allInputs2.nth(i).getAttribute('placeholder') || ''
    console.log(`  ${i}: placeholder="${ph}"`)
  }

  await browser.close()
  console.log('\nDone')
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})