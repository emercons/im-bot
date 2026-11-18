import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const leadUrl = 'https://www.linkedin.com/sales/lead/ACwAABvgm68BZ9ZWoplQWPGfwKFoUvsKgRekzUM,NAME_SEARCH,GPz2?_ntb=GkKTJUT4QXGIkxOsOSuIUg%3D%3D&lipi=urn%3Ali%3Apage%3Ad_sales2_search_people%3BY3GDh0E6TO2C59AphxgQxA%3D%3D&licu=urn%3Ali%3Acontrol%3Ad_sales2_search_people-view_lead_panel_via_search_lead_name&lici=%C2%91%C2%BF%C3%B1LU%C2%8EC%C2%91%C2%88%C3%AE%C3%B7%5D-%C2%B9%C2%AF%C3%9C&snfl=k4zhQDQ5QP%2B88koN0TUjmw%3D%3D';
const message = 'Здравствуйте, Виталий! Ищу IT-профессионалов из автомобильной сферы, чтобы расширить профессиональный круг общения. Буду рада познакомиться! Любовь';
const journal = path.resolve('data/linkedin_web_state/liubov-lukina/direct-invitations-2026-08-18.jsonl');
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
let result;
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/'));
  if (!page) throw new Error('Sales Navigator tab is not open');
  await page.bringToFront();
  await page.goto(leadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pause(page);
  const alert = (await page.locator('[role="alert"]:visible, [role="dialog"]:visible').allInnerTexts()).join(' ');
  if (/checkpoint|challenge|security verification|weekly invitation limit|wöchentliches limit/i.test(`${page.url()} ${alert}`)) throw new Error('LinkedIn restriction detected');

  const directConnect = page.getByText('Vernetzen', { exact: true });
  let connect;
  for (let index = 0; index < await directConnect.count(); index += 1) {
    if (await directConnect.nth(index).isVisible()) { connect = directConnect.nth(index); break; }
  }
  if (!connect) {
    const actions = page.getByRole('button', { name: 'Überlauf-Menü für Aktionen öffnen', exact: true });
    if (await actions.count() !== 1) throw new Error(`visible direct Vernetzen unavailable; actions=${await actions.count()}`);
    await actions.click();
    await pause(page);
    const menuConnect = page.getByText('Vernetzen', { exact: true });
    for (let index = 0; index < await menuConnect.count(); index += 1) {
      if (await menuConnect.nth(index).isVisible()) { connect = menuConnect.nth(index); break; }
    }
  }
  if (!connect) throw new Error('free Vernetzen action unavailable');
  await connect.click();
  await pause(page);
  const dialog = page.getByRole('dialog', { name: 'Einladung senden' });
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  await dialog.locator('textarea').fill(message);
  await pause(page);
  const send = dialog.getByRole('button', { name: /^(Einladung senden|Senden)$/ });
  if (await send.count() !== 1 || !await send.isEnabled()) throw new Error('invitation send button unavailable');
  await send.click();
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  result = { status: 'sent' };
} catch (error) {
  result = { status: 'blocked', detail: error.message };
} finally {
  await browser.close();
}
const entry = { type: 'direct_salesnav_invitation', name: 'Vitalii S.', sales_navigator_url: leadUrl, message, ...result, at: new Date().toISOString() };
await appendFile(journal, `${JSON.stringify(entry)}\n`);
process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
