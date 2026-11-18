import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const endpoint = 'http://127.0.0.1:9333';
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const browser = await chromium.connectOverCDP(endpoint, { isLocal: true, noDefaults: true, timeout: 15000 });

try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/messaging/'));
  if (!page) throw new Error('LinkedIn messaging tab is not open');
  await page.bringToFront();
  await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.msg-conversation-listitem__participant-names', { timeout: 20000 });
  await pause(page);

  const collected = new Map();
  let reachedPreviousYear = false;
  let unchangedRounds = 0;

  for (let round = 0; round < 30 && !reachedPreviousYear && unchangedRounds < 3; round += 1) {
    const before = collected.size;
    const batch = await page.evaluate(() => {
      const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
      return [...document.querySelectorAll('.msg-conversation-listitem__participant-names')].map((heading) => {
        const item = heading.closest('li') || heading.parentElement;
        const link = item?.querySelector('a[href*="/messaging/thread/"]');
        const time = item?.querySelector('time, .msg-conversation-listitem__time-stamp');
        const snippet = item?.querySelector('.msg-conversation-card__message-snippet, .msg-conversation-listitem__message-snippet');
        return {
          name: clean(heading.textContent),
          date: clean(time?.textContent),
          preview: clean(snippet?.textContent),
          href: link?.href || '',
          itemText: clean(item?.innerText).slice(0, 1000),
        };
      }).filter((item) => item.name);
    });

    for (const item of batch) {
      const key = item.href || `${item.name}|${item.date}|${item.preview}`;
      if (!collected.has(key)) collected.set(key, item);
      if (/\b20(?:2[0-5]|1\d)\b/.test(item.date) || /\b20(?:2[0-5]|1\d)\b/.test(item.itemText)) reachedPreviousYear = true;
    }

    unchangedRounds = collected.size === before ? unchangedRounds + 1 : 0;
    if (reachedPreviousYear) break;

    const scrolled = await page.evaluate(() => {
      const heading = document.querySelector('.msg-conversation-listitem__participant-names');
      let element = heading;
      while (element && element !== document.body) {
        if (element.scrollHeight > element.clientHeight + 20) {
          const previous = element.scrollTop;
          element.scrollTop = Math.min(element.scrollHeight, previous + Math.max(300, element.clientHeight * 0.75));
          element.dispatchEvent(new Event('scroll', { bubbles: true }));
          return { previous, current: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
        }
        element = element.parentElement;
      }
      return null;
    });
    if (!scrolled || scrolled.current === scrolled.previous) unchangedRounds += 1;
    await pause(page);
  }

  const items = [...collected.values()];
  process.stdout.write(`${JSON.stringify({
    account: 'Liubov Lukina',
    url: page.url(),
    totalCaptured: items.length,
    reachedPreviousYear,
    items,
  }, null, 2)}\n`);
} finally {
  await browser.close();
}
