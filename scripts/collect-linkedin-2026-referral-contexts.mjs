import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const endpoint = 'http://127.0.0.1:9333';
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const targets = [
  { name: 'Yan Hor', url: 'https://www.linkedin.com/messaging/thread/2-YWU5ODdkMjEtMjJjZi00MTI2LWJlZDUtYTM0YWVhYjNlNmNhXzEwMA==/' },
  { name: 'Oleksandr Shuliak' },
  { name: 'Natalia Kniazeva' },
  { name: 'Vadym Ponomarenko' },
];

const browser = await chromium.connectOverCDP(endpoint, { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/messaging/'));
  if (!page) throw new Error('LinkedIn messaging tab is not open');
  await page.bringToFront();
  await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.msg-conversation-listitem__participant-names', { timeout: 20000 });
  await pause(page);

  const results = [];
  for (const target of targets) {
    if (target.url) {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.msg-entity-lockup__entity-title', { timeout: 20000 });
      await pause(page);
    } else {
      const heading = page.locator('.msg-conversation-listitem__participant-names').filter({ hasText: target.name }).first();
      if (!await heading.isVisible().catch(() => false)) {
        results.push({ name: target.name, status: 'not_visible' });
        continue;
      }
      await heading.click();
      await pause(page);
    }

    const activeName = (await page.locator('.msg-entity-lockup__entity-title').first().innerText().catch(() => '')).trim();
    const thread = (await page.locator('.msg-s-message-list-content').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    results.push({
      name: target.name,
      status: activeName === target.name ? 'captured' : `unexpected:${activeName}`,
      url: page.url(),
      thread: thread.slice(0, 7000),
    });

    if (!target.url) {
      await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.msg-conversation-listitem__participant-names', { timeout: 20000 });
      await pause(page);
    }
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  await browser.close();
}
