import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', {
  isLocal: true, noDefaults: true, timeout: 15000,
});
try {
  const page = browser.contexts()[0].pages().find((candidate) =>
    candidate.url().includes('/premium/referrals/'));
  if (!page) throw new Error('LinkedIn Premium referrals page is not open');
  await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });
  const result = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    return {
      title: document.title,
      url: location.href,
      visible_text: document.body.innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 30000),
      controls: [...document.querySelectorAll('button,a')].filter(visible).map((element) => ({
        tag: element.tagName,
        text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200),
        aria: element.getAttribute('aria-label'),
        href: element.tagName === 'A' ? element.href : null,
      })).filter((item) => item.text || item.aria).slice(0, 80),
      expandable: [...document.querySelectorAll('[role="button"],[aria-expanded],summary')].filter(visible).map((element) => ({
        tag: element.tagName,
        text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300),
        aria: element.getAttribute('aria-label'),
        expanded: element.getAttribute('aria-expanded'),
      })).filter((item) => item.text || item.aria).slice(0, 80),
    };
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
