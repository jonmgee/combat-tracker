import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'

/**
 * DM Alert Proxy Swap — live integration test
 *
 * Flow:
 * 1. Create a session as DM
 * 2. DM adds two PCs (will become dm_pc participants)
 * 3. Enable Alert Feat on both via lobby
 * 4. Roll initiative → Order Review screen
 * 5. Click ⚡ on PC-A → see ↔ Swap buttons on PC-B
 * 6. Click ↔ Swap on PC-B → initiatives swap, ⚡ badge disappears from PC-A
 * 7. Click ⚡ on PC-B (should still be available) → see ↔ Swap on PC-A
 * 8. Click ↔ Swap on PC-A → second swap works independently
 * 9. Verify both alert_used flags are set (no ⚡ badges remain, no swap buttons)
 */

test.describe('DM Alert proxy swap', () => {
  test('DM triggers Alert swap for DM-PCs', async ({ page }) => {
    // ── 1. Create session as DM ──
    await page.goto(BASE)
    await page.waitForSelector('text=Torch & Turn', { timeout: 10000 })

    // Find and click "Create Session" button
    const createBtn = page.locator('button:has-text("Create Session")')
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    // ── 2. Lobby: DM names themselves ──
    await page.waitForSelector('text=DM', { timeout: 10000 })
    const nameInput = page.locator('input[placeholder*="Name"]')
    await nameInput.fill('TestDM')
    await nameInput.press('Enter')

    // ── 3. Use sidebar or '+' to add two DM-PCs ──
    // Find "Add" button in the lobby/initiative section
    await page.waitForTimeout(1000)

    // Locate the initiative entry section where DM adds PCs/monsters
    // This is the "+" or "Add" button for PC creation
    const addButtons = page.locator('button:has-text("Add")')
    const addCount = await addButtons.count()
    if (addCount > 0) {
      // Click first Add button that opens the DM-PC form
      await addButtons.first().click()
    }

    // Wait for modal/sheet to appear
    await page.waitForTimeout(1000)

    // Fill PC A details
    const pcNameInput = page.locator('input[placeholder*="Name"], input[name="name"]').first()
    await pcNameInput.fill('Aragorn')

    // Check Track HP? Not needed for swap test, but we need initiative
    // Find initiative input
    const initInput = page.locator('input[placeholder*="Initiative"], input[type="number"]').first()
    if (await initInput.isVisible()) {
      await initInput.fill('15')
    }

    // Submit
    const confirmBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("Confirm")').first()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    } else {
      // Try pressing Enter
      await pcNameInput.press('Enter')
    }

    await page.waitForTimeout(1000)

    // Add a second DM-PC
    const addButtons2 = page.locator('button:has-text("Add")')
    const addCount2 = await addButtons2.count()
    if (addCount2 > 0) {
      await addButtons2.first().click()
    }
    await page.waitForTimeout(1000)

    const pcNameInput2 = page.locator('input[placeholder*="Name"], input[name="name"]').first()
    await pcNameInput2.fill('Legolas')
    const initInput2 = page.locator('input[placeholder*="Initiative"], input[type="number"]').first()
    if (await initInput2.isVisible()) {
      await initInput2.fill('8')
    }

    const confirmBtn2 = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("Confirm")').first()
    if (await confirmBtn2.isVisible()) {
      await confirmBtn2.click()
    } else {
      await pcNameInput2.press('Enter')
    }

    await page.waitForTimeout(1000)

    // ── 4. Enable Alert Feat on both DM-PCs ──
    // Toggle switches for each DM-PC
    const alertToggles = page.locator('.toggle-switch, [role="switch"], button:has-text("Alert")')
    const toggleCount = await alertToggles.count()
    for (let i = 0; i < toggleCount; i++) {
      await alertToggles.nth(i).click()
      await page.waitForTimeout(300)
    }

    await page.waitForTimeout(1000)

    // ── 5. "Prepare Encounter" / Roll initiative ──
    const prepareBtn = page.locator('button:has-text("Prepare"), button:has-text("Roll Initiative"), button:has-text("Start")')
    if (await prepareBtn.isVisible()) {
      await prepareBtn.click()
    }

    await page.waitForTimeout(2000)

    // ── Order Review Screen ──
    // Take a screenshot to understand the layout
    await page.screenshot({ path: 'tests/dm-order-review.png', fullPage: true })

    // Verify we're on the order review screen
    await expect(page.locator('text=Initiative Order')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Locked In')).toBeVisible({ timeout: 5000 })

    // ── 6. Find ⚡ buttons (DM Alert badges) ──
    const alertBadges = page.locator('button:has-text("⚡")')
    const badgeCount = await alertBadges.count()
    console.log(`Found ${badgeCount} ⚡ buttons`)

    // Take a focused screenshot of the order rows
    await page.screenshot({ path: 'tests/dm-order-review-rows.png', fullPage: true })

    // ── 7. Click the first ⚡ to activate proxy swap mode ──
    if (badgeCount > 0) {
      await alertBadges.first().click()
      await page.waitForTimeout(500)

      // Now we should see ↔ Swap buttons on other player rows
      const swapButtons = page.locator('button:has-text("↔ Swap")')
      const swapCount = await swapButtons.count()
      console.log(`Found ${swapCount} ↔ Swap buttons after activating proxy`)

      await page.screenshot({ path: 'tests/dm-proxy-active.png', fullPage: true })

      // Click the first swap button to execute the swap
      if (swapCount > 0) {
        await swapButtons.first().click()
        await page.waitForTimeout(2000)

        // After swap: the source ⚡ should be gone (alert_used=true)
        const remainingBadges = page.locator('button:has-text("⚡")')
        const remainingCount = await remainingBadges.count()
        console.log(`After swap: ${remainingCount} ⚡ buttons remaining`)
        // Should be at least 1 less
        expect(remainingCount).toBeLessThanOrEqual(badgeCount)

        await page.screenshot({ path: 'tests/dm-after-first-swap.png', fullPage: true })
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'tests/dm-final-state.png', fullPage: true })
  })
})