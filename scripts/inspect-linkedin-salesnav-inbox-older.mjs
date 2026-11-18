import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/inbox'));
  if (!page) throw new Error('Sales Navigator inbox tab is not open');
  await page.bringToFront();
  const loadOlder = page.getByRole('button', { name: /Ältere Unterhaltungen laden|Load older conversations/i });
  if (await loadOlder.isVisible().catch(() => false)) {
    await pause(page);
    await loadOlder.click();
    await pause(page);
  }
  const items = await page.evaluate(() => {
    const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    return [...document.querySelectorAll('[role="listitem"], li')]
      .filter(visible)
      .map((element) => clean(element.innerText))
      .filter((text) => text.length > 15 && text.length < 1400)
      .filter((text, index, all) => all.indexOf(text) === index)
      .slice(0, 80);
  });
  process.stdout.write(`${JSON.stringify({ count: items.length, items }, null, 2)}\n`);
} finally {
  await browser.close();
}
