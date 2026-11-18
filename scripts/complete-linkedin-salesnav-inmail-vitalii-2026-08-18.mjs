import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const subject = 'Знакомство: IT и автомобильная сфера';
const journal = path.resolve('data/linkedin_web_state/liubov-lukina/direct-inmails-2026-08-18.jsonl');
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
let result;
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/lead/'));
  if (!page) throw new Error('Vitalii Sales Navigator tab is not open');
  await page.bringToFront();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Neue Nachricht an Vitalii S.' });
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  const subjectField = dialog.getByPlaceholder('Betreff (erforderlich)', { exact: true });
  if (await subjectField.count() !== 1) throw new Error('required InMail subject field unavailable');
  await subjectField.fill(subject);
  await pause(page);
  const send = dialog.getByRole('button', { name: /^(Senden|Send)$/ });
  if (await send.count() !== 1 || !await send.isEnabled()) throw new Error('InMail send button remains disabled');
  await send.click();
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  result = { status: 'sent' };
} catch (error) {
  result = { status: 'blocked', detail: error.message };
} finally {
  await browser.close();
}
const entry = { type: 'direct_salesnav_inmail_completion', name: 'Vitalii S.', subject, ...result, at: new Date().toISOString() };
await appendFile(journal, `${JSON.stringify(entry)}\n`);
process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
