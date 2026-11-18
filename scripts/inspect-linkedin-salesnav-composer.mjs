import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/inbox'));
  if (!page) throw new Error('Sales Navigator inbox tab is not open');
  await page.bringToFront();
  await page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
  const result = await page.locator('section.thread-container').evaluate((thread) => {
    const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    return {
      name: clean(thread.querySelector('h2')?.textContent),
      editors: [...thread.querySelectorAll('textarea, [contenteditable="true"]')].map((element) => ({
        tag: element.tagName,
        visible: visible(element),
        value: clean(element.value || element.innerText || element.textContent).slice(0, 500),
        ariaLabel: element.getAttribute('aria-label') || '',
      })),
      buttons: [...thread.querySelectorAll('button, [role="button"]')].map((element) => ({
        visible: visible(element),
        text: clean(element.innerText || element.textContent),
        ariaLabel: element.getAttribute('aria-label') || '',
        disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
        type: element.getAttribute('type') || '',
      })),
    };
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
