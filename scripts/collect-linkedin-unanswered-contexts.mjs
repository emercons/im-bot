import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const endpoint = 'http://127.0.0.1:9333';
const names = ['Nina Hirchuk', 'Yan Hor', 'Florian Berthold', 'Sergej Lechowski', 'Roman Koshcheev'];
const pause = (page) => page.waitForTimeout(1000 + Math.floor(Math.random() * 2001));

const browser = await chromium.connectOverCDP(endpoint, { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/messaging/'));
  if (!page) throw new Error('LinkedIn messaging tab is not open');
  await page.bringToFront();

  const results = [];
  for (const name of names) {
    const activeName = (await page.locator('.msg-entity-lockup__entity-title').first().textContent().catch(() => ''))?.trim();
    if (activeName !== name) {
      const heading = page.locator('.msg-conversation-listitem__participant-names').filter({ hasText: name }).first();
      if (!await heading.isVisible().catch(() => false)) {
        results.push({ name, status: 'not_visible' });
        continue;
      }
      await heading.click();
      await pause(page);
    }

    const currentName = (await page.locator('.msg-entity-lockup__entity-title').first().textContent().catch(() => ''))?.trim();
    const thread = (await page.locator('.msg-s-message-list-content').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    results.push({
      name,
      status: currentName === name ? 'captured' : `unexpected:${currentName}`,
      url: page.url(),
      thread: thread.slice(0, 5000),
    });
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  await browser.close();
}
