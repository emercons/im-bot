import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const name = 'Oleksandr Shuliak';
const url = 'https://www.linkedin.com/messaging/thread/2-OTJmMDJkMDQtZTY3Ni00NGY5LWJjMGMtYjI4ZjRlYmI1NmQzXzEwMA==/';
const referral = 'https://www.linkedin.com/premium/redeem/?upsellOrderOrigin=sn_referral_promotion&coupon=x7Siyjaen&customKey=ref_s&redeemTypeV2=REFERRAL_COUPON';
const message = `Александр, вот персональная ссылка на пробную версию Sales Navigator Core:\n${referral}\n\nНадеюсь, инструмент окажется полезным для поиска профессиональных и исследовательских контактов. Условия доступности определяет LinkedIn.`;
const journal = path.resolve('data/linkedin_web_state/liubov-lukina/message-replies-referral-offers-2026-08-10.jsonl');
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
let result;
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/messaging/'));
  if (!page) throw new Error('LinkedIn messaging tab is not open');
  await page.bringToFront();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.msg-entity-lockup__entity-title', { timeout: 20000 });
  await pause(page);
  const activeName = (await page.locator('.msg-entity-lockup__entity-title').first().innerText()).trim();
  if (activeName !== name) throw new Error(`unexpected active conversation: ${activeName}`);
  const thread = page.locator('.msg-s-message-list-content').first();
  if ((await thread.innerText()).includes(referral)) {
    result = { status: 'already_present' };
  } else {
    const editors = page.locator('.msg-form__contenteditable[contenteditable="true"]:visible, [contenteditable="true"][role="textbox"]:visible');
    if (await editors.count() !== 1) throw new Error(`visible editors=${await editors.count()}`);
    await editors.first().fill(message);
    await pause(page);
    const candidates = page.getByRole('button', { name: /^(Senden|Send)$/ });
    const send = [];
    for (let index = 0; index < await candidates.count(); index += 1) if (await candidates.nth(index).isVisible()) send.push(candidates.nth(index));
    if (send.length !== 1 || !await send[0].isEnabled()) throw new Error(`enabled send buttons=${send.length}`);
    await send[0].click();
    await pause(page);
    if (!(await thread.innerText()).includes(referral)) throw new Error('referral link was not found in the thread');
    result = { status: 'sent' };
  }
} catch (error) {
  result = { status: 'blocked', detail: error.message };
} finally {
  await browser.close();
}
const entry = { type: 'salesnav_referral_link', name, referral, message, ...result, at: new Date().toISOString() };
await appendFile(journal, `${JSON.stringify(entry)}\n`);
process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
