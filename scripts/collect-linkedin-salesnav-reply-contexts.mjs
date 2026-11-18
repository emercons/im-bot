import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const names = ['Julia Kiryushina', 'Júlio Arend', 'Saraswathy Kalaiselvan', 'Hossein Hashemi'];
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/inbox'));
  if (!page) throw new Error('Sales Navigator inbox tab is not open');
  await page.bringToFront();
  const results = [];

  for (const name of names) {
    const nameMatches = page.getByText(name, { exact: true });
    let target = null;
    for (let index = 0; index < await nameMatches.count(); index += 1) {
      const candidate = nameMatches.nth(index);
      if (await candidate.isVisible()) {
        const insideThread = await candidate.evaluate((element) => Boolean(element.closest('section.thread-container')));
        if (!insideThread) { target = candidate; break; }
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
    const thread = (await page.locator('section.thread-container').innerText()).replace(/\s+/g, ' ').trim();
    results.push({ name, status: 'captured', url: page.url(), thread: thread.slice(0, 5000) });
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  await browser.close();
}
