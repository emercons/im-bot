import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', {
  isLocal: true,
  noDefaults: true,
  timeout: 15000,
});

try {
  const pages = browser.contexts()[0]?.pages() ?? [];
  const page = pages.find((candidate) => candidate.url().includes('linkedin.com/messaging/'));
  if (!page) throw new Error('LinkedIn messaging tab is not open');

  await page.bringToFront();
  await page.waitForTimeout(4000);
  if ((await page.locator('body').innerText()).trim().length < 100) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(8000);
  }

  const summary = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
    };
    const clean = (value) => value.replace(/\s+/g, ' ').trim();
    const candidates = [...document.querySelectorAll('[role="listitem"], li')]
      .filter(visible)
      .map((element) => clean(element.innerText || ''))
      .filter((text) => text.length >= 3 && text.length <= 900);
    const unique = [...new Set(candidates)];
    const headings = [...document.querySelectorAll('h1,h2,h3')]
      .filter(visible)
      .map((element) => clean(element.innerText || ''))
      .filter(Boolean);
    const controls = [...document.querySelectorAll('button, a[role="button"]')]
      .filter(visible)
      .map((element) => clean(element.getAttribute('aria-label') || element.innerText || ''))
      .filter(Boolean);
    const targetNames = ['Yan Hor', 'Florian Berthold', 'Sergej Lechowski', 'Roman Koshcheev', 'Nina Hirchuk'];
    const nameNodes = [...document.querySelectorAll('body *')]
      .filter((element) => targetNames.includes(clean(element.textContent || '')))
      .slice(0, 30)
      .map((element) => ({
        text: clean(element.textContent || ''),
        tag: element.tagName,
        role: element.getAttribute('role'),
        className: typeof element.className === 'string' ? element.className.slice(0, 160) : '',
      }));
    const messageContainers = [...document.querySelectorAll('[class*="msg-s-message-list"], [class*="msg-thread"]')]
      .filter(visible)
      .map((element) => ({
        tag: element.tagName,
        className: typeof element.className === 'string' ? element.className.slice(0, 180) : '',
        text: clean(element.innerText || '').slice(0, 1800),
      }))
      .filter((item) => item.text.length > 20)
      .slice(0, 12);
    const activeName = document.querySelector('.msg-s-message-group__name');
    const activeAncestors = [];
    for (let element = activeName; element && activeAncestors.length < 9; element = element.parentElement) {
      activeAncestors.push({
        tag: element.tagName,
        className: typeof element.className === 'string' ? element.className.slice(0, 180) : '',
        textLength: clean(element.innerText || '').length,
        text: clean(element.innerText || '').slice(0, 1200),
      });
    }
    return {
      title: document.title,
      url: location.href,
      bodyTextLength: clean(document.body?.innerText || '').length,
      bodyText: clean(document.body?.innerText || '').slice(0, 6000),
      headings: [...new Set(headings)].slice(0, 20),
      listItems: unique.slice(0, 30),
      controls: [...new Set(controls)].slice(0, 40),
      nameNodes,
      messageContainers,
      activeAncestors,
    };
  });

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await browser.close();
}
