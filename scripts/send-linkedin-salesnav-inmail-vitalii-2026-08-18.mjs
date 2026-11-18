import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const leadUrl = 'https://www.linkedin.com/sales/lead/ACwAABvgm68BZ9ZWoplQWPGfwKFoUvsKgRekzUM,NAME_SEARCH,GPz2?_ntb=GkKTJUT4QXGIkxOsOSuIUg%3D%3D&lipi=urn%3Ali%3Apage%3Ad_sales2_search_people%3BY3GDh0E6TO2C59AphxgQxA%3D%3D&licu=urn%3Ali%3Acontrol%3Ad_sales2_search_people-view_lead_panel_via_search_lead_name&lici=%C2%91%C2%BF%C3%B1LU%C2%8EC%C2%91%C2%88%C3%AE%C3%B7%5D-%C2%B9%C2%AF%C3%9C&snfl=k4zhQDQ5QP%2B88koN0TUjmw%3D%3D';
const message = 'Здравствуйте, Виталий! Ищу IT-профессионалов из автомобильной сферы, чтобы расширить профессиональный круг общения. Ваш опыт в BMW Group показался мне особенно интересным. Буду рада познакомиться! Любовь';
const journal = path.resolve('data/linkedin_web_state/liubov-lukina/direct-inmails-2026-08-18.jsonl');
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
let result;
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/'));
  if (!page) throw new Error('Sales Navigator tab is not open');
  await page.bringToFront();
  if (!page.url().startsWith(leadUrl.split('?')[0])) await page.goto(leadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pause(page);
  const messageButtons = page.getByRole('button', { name: 'Nachricht', exact: true });
  let messageButton;
  for (let index = 0; index < await messageButtons.count(); index += 1) {
    if (await messageButtons.nth(index).isVisible()) { messageButton = messageButtons.nth(index); break; }
  }
  if (!messageButton) throw new Error('InMail message control unavailable');
  await messageButton.click();
  await pause(page);
  const editors = page.locator('textarea:visible, [contenteditable="true"]:visible');
  if (await editors.count() !== 1) throw new Error(`visible InMail editors=${await editors.count()}`);
  await editors.first().fill(message);
  await pause(page);
  const buttons = page.locator('button');
  const send = [];
  for (let index = 0; index < await buttons.count(); index += 1) {
    const candidate = buttons.nth(index);
    const label = (await candidate.innerText().catch(() => '')).trim();
    if (await candidate.isVisible() && /^(Senden|Send|InMail senden)$/i.test(label)) send.push(candidate);
  }
  if (send.length !== 1 || !await send[0].isEnabled()) throw new Error(`enabled InMail send buttons=${send.length}`);
  await send[0].click();
  await pause(page);
  result = { status: 'sent' };
} catch (error) {
  result = { status: 'blocked', detail: error.message };
} finally {
  await browser.close();
}
const entry = { type: 'direct_salesnav_inmail', name: 'Vitalii S.', sales_navigator_url: leadUrl, message, ...result, at: new Date().toISOString() };
await appendFile(journal, `${JSON.stringify(entry)}\n`);
process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
