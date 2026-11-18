import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/messaging/'));
  if (!page) throw new Error('LinkedIn messaging tab is not open');
  await page.bringToFront();
  await page.waitForTimeout(4000);
  const result = await page.evaluate(() => {
    const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const cards = [...document.querySelectorAll('li.msg-conversation-listitem')]
      .filter((el) => el.getBoundingClientRect().height > 0)
      .map((el) => ({
        text: clean(el.innerText).slice(0, 700),
        unread: el.className.includes('unread') || Boolean(el.querySelector('[class*="unread"], [aria-label*="unread" i], [aria-label*="ungelesen" i]')),
        href: el.querySelector('a[href*="/messaging/thread/"]')?.href || '',
      }));
    const thread = document.querySelector('.msg-s-message-list-content');
    return {
      url: location.href,
      cards,
      activeName: clean(document.querySelector('.msg-entity-lockup__entity-title')?.textContent),
      activeThread: clean(thread?.innerText).slice(-3500),
    };
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
