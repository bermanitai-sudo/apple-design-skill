// End-to-end smoke test against `vite preview`: node scripts/smoke.mjs [baseUrl] [shotDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] ?? 'http://localhost:4173';
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices['iPhone 15 Pro'],
  geolocation: { latitude: 32.08, longitude: 34.78 },
  permissions: ['geolocation'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on(
  'console',
  (m) => m.type() === 'error' && !/tile|cartocdn|Failed to load resource/.test(m.text()) && errors.push(`console: ${m.text()}`),
);
const shot = async (name) => shots && (await page.waitForTimeout(700), await page.screenshot({ path: `${shots}/${name}.png` }));
const step = (s) => console.log('·', s);
const expect = async (locator, what) => {
  await locator
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => {
      throw new Error(`Expected: ${what}`);
    });
};

await page.goto(base);
step('onboarding');
await page.getByPlaceholder('Your name').fill('Alex');
await shot('00-welcome');
await page.getByRole('button', { name: 'Explore with sample data' }).click();
await expect(page.getByText('Alex'), 'greeting with name');
await expect(page.getByText('Daily discipline'), 'discipline hero');
await shot('01-home');

step('toggle an assignment from home');
const firstTask = page.locator('main button[class*="tap flex w-full"]').first();
await firstTask.click();
await expect(page.getByText('2 to go'), 'one done');

step('daily');
await page.getByRole('link', { name: 'Daily' }).click();
await expect(page.getByRole('heading', { name: 'Daily' }), 'daily page');
await shot('02-daily');

step('health: manual food entry updates totals');
await page.getByRole('link', { name: 'Health' }).click();
await page.getByRole('button', { name: 'Add food manually' }).click();
await page.getByPlaceholder('e.g. Chicken rice bowl').fill('Eggs on toast');
await page.getByPlaceholder('0').nth(1).fill('420');
await page.getByPlaceholder('0').nth(2).fill('24');
await shot('03-food-sheet');
await page.getByRole('button', { name: 'Add to log' }).click();
await expect(page.getByText('Eggs on toast'), 'food entry listed');
await expect(page.getByText('420', { exact: true }), 'calorie total');
await shot('04-health');

step('health: scan sheet opens');
await page.getByRole('button', { name: 'Scan food' }).click();
await expect(page.getByText('Take a photo'), 'camera option');
await shot('05-scan');
await page.getByRole('button', { name: 'Close' }).click();

step('schedule: add event');
await page.getByRole('link', { name: 'Schedule' }).click();
await page.getByRole('button', { name: 'New event' }).click();
await page.getByPlaceholder('Gym, meeting, long run…').fill('Physio');
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByText('Physio'), 'event listed');
await page.getByRole('tab', { name: 'Week' }).click();
await shot('06-week');
await page.getByRole('tab', { name: 'Month' }).click();
await shot('07-month');

step('alarms: weekly plan');
await page.getByRole('tab', { name: 'Alarms' }).click();
await page.getByRole('button', { name: 'Weekly plan', exact: true }).click();
for (const d of ['Monday', 'Tuesday', 'Saturday']) await page.getByRole('switch', { name: d }).click();
await page.getByRole('button', { name: 'Save plan' }).click();
await expect(page.getByText('Wake up · Mon'), 'monday alarm');
await shot('08-alarms');

step('running: GPS run');
await page.getByRole('link', { name: 'Run' }).click();
await shot('09-running');
await page.getByRole('button', { name: 'Start run' }).click();
for (let i = 1; i <= 6; i++) {
  await page.waitForTimeout(1100);
  await ctx.setGeolocation({ latitude: 32.08 + i * 0.0004, longitude: 34.78 });
}
await page.waitForTimeout(800);
await shot('10-active-run');
await page.getByRole('button', { name: 'Pause' }).click();
await page.getByRole('button', { name: 'Resume' }).click();
await page.getByRole('button', { name: 'Finish' }).click();
await page.getByRole('button', { name: 'Save run' }).click();
await expect(page.getByText('GPS tracked'), 'run detail');
await shot('11-run-detail');

step('stats and settings');
await page.goto(`${base}/stats`);
await expect(page.getByRole('heading', { name: 'Statistics' }), 'stats');
await shot('12-stats');
await page.goto(`${base}/settings`);
await expect(page.getByRole('heading', { name: 'Settings' }), 'settings');
await shot('13-settings');

step('persistence across reload');
await page.goto(`${base}/health`);
await expect(page.getByText('Eggs on toast'), 'food persisted');
await page.goto(`${base}/schedule?tab=alarms`);
await expect(page.getByText('Wake up · Mon'), 'alarm persisted');

step('foreground alarm rings and starts the timer');
await page.evaluate(async () => {
  const req = indexedDB.open('form');
  await new Promise((r) => (req.onsuccess = r));
  const d = new Date(Date.now() + 2000);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const tx = req.result.transaction('alarms', 'readwrite');
  tx.objectStore('alarms').add({
    label: 'Test alarm',
    time,
    days: [],
    enabled: true,
    sound: 'pulse',
    timerMinutes: 15,
    createdAt: Date.now(),
  });
  await new Promise((r) => (tx.oncomplete = r));
});
await expect(page.getByRole('alertdialog', { name: /Test alarm/ }), 'ringing alarm');
await shot('14-ringing');
await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
await expect(page.getByRole('button', { name: 'Open timer' }), 'timer pill');
await page.getByRole('button', { name: 'Open timer' }).click();
await shot('15-timer');

await browser.close();
if (errors.length) {
  console.error('Errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('smoke passed');
