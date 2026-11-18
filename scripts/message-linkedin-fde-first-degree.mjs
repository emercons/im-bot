import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const endpoint = 'http://127.0.0.1:9333';
const exportDir = path.resolve('data/linkedin_web_state/liubov-lukina/salesnav_exports/active-search-4470915969-20260807T114608Z');
const journal = path.join(exportDir, 'outreach-fde-2026-08-07.jsonl');
const leadUrl = 'https://www.linkedin.com/sales/lead/ACwAABV1MdMBl-qUXG-qEIopjzZihKNCisBIkMc,NAME_SEARCH,VcAC';
const message = "Hi Anna, I came across your profile while exploring Forward Deployed Engineering in Bavaria. Your work at Salesforce caught my attention, and I'd be glad to exchange perspectives. Best, Liubov";
const pause = (page) => page.waitForTimeout(1000 + Math.floor(Math.random() * 2001));
const record = (item) => appendFile(journal, `${JSON.stringify({ ...item, at: new Date().toISOString() })}\n`);

const browser = await chromium.connectOverCDP(endpoint, { isLocal: true, noDefaults: true, timeout: 15000 });
let result = { status: 'blocked', detail: 'not attempted' };
try {
  const page = browser.contexts()[0].pages().find((p) => p.url().includes('linkedin.com/sales/'));
  if (!page) throw new Error('Sales Navigator tab is not open');
  await page.goto(leadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => document.title.includes('Anna Popova'), null, { timeout: 20000 });
  if (!page.url().includes('ACwAABV1MdMBl-qUXG-qEIopjzZihKNCisBIkMc')) throw new Error('Unexpected lead page');
  const buttons = page.getByRole('button', { name: /Nachricht/ });
  const visible = [];
  for (let i = 0; i < await buttons.count(); i += 1) if (await buttons.nth(i).isVisible()) visible.push(buttons.nth(i));
  if (visible.length < 1) throw new Error('visible Nachricht buttons=0');
  await pause(page);
  await visible[0].click();
  await pause(page);
  const bodyText = (await page.locator('body').innerText()).slice(-15000);
  if (/InMail|Guthaben verwenden/i.test(bodyText)) throw new Error('InMail marker detected; message not sent');
  const editors = page.locator('textarea:visible, [contenteditable="true"]:visible');
  if (await editors.count() !== 1) throw new Error(`visible message editors=${await editors.count()}`);
  const editor = editors.first();
  if (await editor.evaluate((e) => e.tagName === 'TEXTAREA')) await editor.fill(message);
  else await editor.fill(message);
  await pause(page);
  const sendAll = page.getByRole('button', { name: /^(Senden|Send)$/ });
  const send = [];
  for (let i = 0; i < await sendAll.count(); i += 1) if (await sendAll.nth(i).isVisible()) send.push(sendAll.nth(i));
  if (send.length !== 1 || !await send[0].isEnabled()) throw new Error(`enabled send buttons=${send.length}`);
  await pause(page);
  await send[0].click();
  await pause(page);
  result = { status: 'sent' };
} catch (error) {
  result = { status: 'blocked', detail: error.message };
} finally {
  await record({ type: 'first_degree_message', full_name: 'Anna Popova', sales_navigator_lead_id: 'ACwAABV1MdMBl-qUXG-qEIopjzZihKNCisBIkMc', message, ...result });
  await browser.close();
}
process.stdout.write(`${JSON.stringify(result)}\n`);
