import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/inbox'));
  if (!page) throw new Error('Sales Navigator inbox tab is not open');
  await page.bringToFront();
  await pause(page);
  const result = await page.evaluate(() => {
    const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
    };
    const take = (selector, limit, maxLength) => [...document.querySelectorAll(selector)]
      .filter(visible)
      .map((element) => clean(element.getAttribute('aria-label') || element.innerText || element.textContent))
      .filter((text) => text && text.length <= maxLength)
      .filter((text, index, all) => all.indexOf(text) === index)
      .slice(0, limit);
    const conversationCards = [...document.querySelectorAll('h3')]
      .filter(visible)
      .map((heading) => {
        const text = clean(heading.textContent);
        let item = heading;
        while (item && item !== document.body && !['LI', 'A', 'BUTTON'].includes(item.tagName)) item = item.parentElement;
        return {
          name: text,
          headingClass: typeof heading.className === 'string' ? heading.className.slice(0, 160) : '',
          itemTag: item?.tagName || '',
          itemClass: typeof item?.className === 'string' ? item.className.slice(0, 200) : '',
          ariaLabel: item?.getAttribute?.('aria-label') || '',
          text: clean(item?.innerText).slice(0, 1200),
        };
      })
      .filter((item) => item.text && !['Aktionsliste', 'Suche', 'Sales Navigator-Inbox', 'Inbox navigation menu', 'Liste der Nachrichtenverläufe durchsuchen', 'Liste mit Nachrichtenverläufen', 'Empfängerinformationen', 'Insgesamt 0 Mitteilungen'].includes(item.name))
      .slice(0, 40);
    const activeHeading = [...document.querySelectorAll('h1,h2,h3,[aria-label^="Unterhaltung mit"],[aria-label^="Conversation with"]')]
      .find((element) => clean(element.getAttribute('aria-label') || element.textContent).match(/^(Unterhaltung mit|Conversation with) /));
    const activeAncestors = [];
    for (let element = activeHeading; element && activeAncestors.length < 8; element = element.parentElement) {
      activeAncestors.push({
        tag: element.tagName,
        role: element.getAttribute('role') || '',
        className: typeof element.className === 'string' ? element.className.slice(0, 180) : '',
        textLength: clean(element.innerText).length,
        text: clean(element.innerText).slice(0, 1600),
      });
    }
    return {
      title: document.title,
      url: location.href,
      headings: take('h1,h2,h3', 30, 300),
      listItems: take('[role="listitem"], li', 30, 1000),
      controls: take('button, [role="button"]', 50, 300),
      conversationCards,
      activeAncestors,
    };
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
