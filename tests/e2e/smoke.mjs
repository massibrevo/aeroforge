import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url))
const { chromium } = require('playwright')
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browserPath = process.env.AEROFORGE_CHROME || (existsSync(systemChrome) ? systemChrome : chromium.executablePath())
if (!existsSync(browserPath)) {
  console.log('SKIP Browser E2E: Chromium missing. Run npm exec --prefix apps/web -- playwright install chromium.')
  process.exit(77)
}
const browser = await chromium.launch({
  executablePath: browserPath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 990 }, reducedMotion: 'reduce',
    acceptDownloads: true })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text() + ' ' + message.location().url) })
  page.on('response', response => {
    if (response.status() >= 400) errors.push(response.status() + ' ' + response.url())
  })
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(request.url() + ' ' + request.failure()?.errorText)
  })
  const nav = page.getByRole('navigation', { name: 'Workspace' })
  const root = 'http://127.0.0.1:5173'
  await page.goto(root)
  await page.getByText('Local API online').waitFor()
  await page.locator('canvas').waitFor()
  await page.waitForTimeout(450)
  mkdirSync('artifacts', { recursive: true })
  await page.screenshot({ path: 'artifacts/aeroforge-overview.png', fullPage: true })
  await nav.getByRole('link', { name: 'Aircraft Studio' }).click()
  const aspect = page.locator('.stat').filter({ hasText: 'Aspect ratio' }).locator('strong')
  const before = await aspect.textContent()
  const span = page.getByRole('slider', { name: 'Wing span' })
  await span.press('ArrowRight')
  await span.press('ArrowRight')
  assert.notEqual(await aspect.textContent(), before)
  await page.getByText('28.1 m span · 78.0 m²').waitFor()
  await page.locator('canvas').waitFor()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  assert.equal((await download).suggestedFilename(), 'aeroforge-airframe-v1.json')
  const preset = page.getByRole('combobox', { name: 'Preset' })
  await preset.selectOption('Boeing 747-8 Intercontinental')
  await page.getByText('68.4 m span · 550.0 m²').waitFor()
  for (const view of ['Front', 'Side', 'Top']) {
    const button = page.getByRole('button', { name: view, exact: true })
    await button.click()
    assert.equal(await button.getAttribute('aria-pressed'), 'true')
  }
  const jumboExport = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const file = await (await jumboExport).path()
  await preset.selectOption('Regional')
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByText('68.4 m span · 550.0 m²').waitFor()
  assert.equal(await preset.inputValue(), 'Boeing 747-8 Intercontinental')
  await page.getByRole('button', { name: 'Reset preset' }).click()
  await page.getByRole('button', { name: 'Perspective', exact: true }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'artifacts/aeroforge-747.png', fullPage: true })
  for (const [name, spanText] of [
    ['Boeing 737-800', '35.8 m span · 125.0 m²'],
    ['Airbus A320neo', '35.8 m span · 123.0 m²'],
    ['Airbus A350-900', '64.8 m span · 443.0 m²'],
  ]) {
    await preset.selectOption(name)
    await page.getByText(spanText).waitFor()
  }
  await preset.selectOption('Regional')
  await nav.getByRole('link', { name: 'Flight Physics' }).click()
  const lift = page.locator('.stat').filter({ has: page.getByText('Lift', { exact: true }) }).locator('strong')
  await page.waitForFunction(() => ![...document.querySelectorAll('.stat')].find(e => e.innerText.startsWith('Lift\n'))?.innerText.includes('—'))
  const liftBefore = await lift.textContent()
  const changed = page.waitForResponse(response => response.url().endsWith('/api/physics/compute') && response.ok())
  await page.getByRole('slider', { name: 'Initial airspeed' }).press('ArrowRight')
  const computed = await (await changed).json()
  assert(computed.lift > 0)
  await page.waitForFunction(old => [...document.querySelectorAll('.stat')].find(e => e.innerText.startsWith('Lift\n'))?.querySelector('strong').textContent !== old, liftBefore)
  await page.getByRole('button', { name: 'Run simulation' }).click()
  await page.getByText(/CLIMB · Completed/).waitFor()
  await page.getByRole('img', { name: /Altitude \(m\) by Time/ }).waitFor()
  await page.getByRole('slider', { name: 'Trajectory playhead' }).press('End')
  await page.getByText(/90\.0 s ·/).waitFor()
  await page.getByRole('img', { name: 'Interactive 3D flight trajectory' }).locator('canvas').waitFor()
  await page.screenshot({ path: 'artifacts/aeroforge-flight.png', fullPage: true })
  await nav.getByRole('link', { name: 'Engine Health' }).click()
  await page.getByRole('img', { name: /Operating cycle.*SYNTHETIC/ }).waitFor()
  await page.getByLabel('Engine', { exact: true }).selectOption('2')
  await page.getByText('Engine 2', { exact: true }).waitFor()
  const actualStatus = await (await page.request.get(root + '/api/data/status')).json()
  if (actualStatus.available) {
    await page.getByLabel('Dataset', { exact: true }).selectOption('nasa')
    await page.getByRole('img', { name: /Operating cycle.*NASA C-MAPSS/ }).waitFor()
  }
  // Exercise the missing-cache UI on both fresh and research-enabled workspaces.
  await page.route('**/api/data/status', route => route.fulfill({ json: { available: false, detail: 'FD001 is missing.' } }))
  await page.reload()
  await page.getByLabel('Dataset', { exact: true }).selectOption('nasa')
  await page.getByText('FD001 is missing.', { exact: false }).waitFor()
  await nav.getByRole('link', { name: 'Experiments' }).click()
  await page.getByLabel('Dataset', { exact: true }).selectOption('demo')
  await page.getByLabel('Random seed').fill('73')
  await page.getByRole('button', { name: 'Run comparison' }).click()
  await page.getByText('Results saved').waitFor({ timeout: 24000 })
  await page.getByRole('table', { name: /validation endpoint results/ }).waitFor()
  await nav.getByRole('link', { name: 'Research & Sources' }).click()
  await page.getByRole('link', { name: 'NASA C-MAPSS catalogue' }).waitFor()
  await page.getByRole('button', { name: 'Download FD001' }).waitFor()
  await page.setViewportSize({ width: 390, height: 850 })
  await nav.getByRole('link', { name: 'Mission Control' }).click()
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  assert.deepEqual(errors, [])
  console.log('PASS Browser E2E: six routes, production presets, camera views, JSON round-trip, live physics, trajectory, fleets, comparison, sources, no runtime errors.')
} finally {
  await browser.close()
}
