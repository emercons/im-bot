import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const names = [
  'Valentina Savkova', 'Artsiom Hud', 'Soham Bera', 'Pablo Torres Robles',
  'Eli Leonid Polevoy', 'Jalal Tareen', 'Jasraj Singh', 'Mikhail Azhyshchev',
  'Valeriia Liakhovetska', 'Natalia Morozova', 'Denis Shokhirev', 'Ivan Panov',
];
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/inbox'));
  if (!page) throw new Error('Sales Navigator inbox tab is not open');
  await page.bringToFront();
  const results = [];

  for (const name of names) {
    const matches = page.getByText(name, { exact: true });
    let target = null;
    for (let index = 0; index < await matches.count(); index += 1) {
      const candidate = matches.nth(index);
      if (await candidate.isVisible() && !await candidate.evaluate((element) => Boolean(element.closest('section.thread-container')))) {
        target = candidate;
        break;
      }
    }
    if (!target) {
      results.push({ name, status: 'not_visible' });
      continue;
    }
    await target.scrollIntoViewIfNeeded();
    await pause(page);
    await target.click();
    await page.waitForFunction((expected) => document.querySelector('section.thread-container h2')?.textContent?.trim() === expected, name, { timeout: 20000 });
    await pause(page);

    const context = await page.locator('section.thread-container').evaluate((thread) => {
      const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const items = [...thread.querySelectorAll('li')].map((item) => clean(item.innerText)).filter(Boolean);
      return {
        profile: (items.find((text) => /Anfang Ihrer Unterhaltung|beginning of your conversation/i.test(text)) || items[0] || '').slice(0, 700),
        latest: (items.at(-1) || '').slice(0, 1800),
      };
    });
    results.push({ name, status: 'captured', url: page.url(), ...context });
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  await browser.close();
}
