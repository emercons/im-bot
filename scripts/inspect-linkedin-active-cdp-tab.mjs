import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const pages = browser.contexts()[0]?.pages() ?? [];
  const tabs = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    tabs.push({
      index,
      title: await page.title().catch(() => ''),
      url: page.url(),
      visibility: await page.evaluate(() => document.visibilityState).catch(() => 'unknown'),
      focused: await page.evaluate(() => document.hasFocus()).catch(() => false),
    });
  }
  process.stdout.write(`${JSON.stringify(tabs, null, 2)}\n`);
} finally {
  await browser.close();
}
