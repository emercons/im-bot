import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const journal = path.resolve('data/linkedin_web_state/liubov-lukina/message-replies-referral-offers-2026-08-10.jsonl');
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const replies = [
  {
    name: 'Natalia Kniazeva',
    url: 'https://www.linkedin.com/messaging/thread/2-MmYzMWI5YmEtYTA5Mi00YzAxLTgxMmYtNzlhNDlhYmE3NDljXzEwMA==/',
    message: "You're very welcome, Natalia! Then you're already well covered 😊 Enjoy your Premium year, and thank you for letting me know.",
  },
  {
    name: 'Oleksandr Shuliak',
    url: 'https://www.linkedin.com/messaging/thread/2-OTJmMDJkMDQtZTY3Ni00NGY5LWJjMGMtYjI4ZjRlYmI1NmQzXzEwMA==/',
    message: 'Александр, спасибо! Для ваших задач Sales Navigator действительно может быть полезен. Я вижу ваш запрос на ссылку и отдельно вернусь к нему после проверки доступности персонального приглашения для аккаунта. Буду рада оставаться на связи и следить за развитием ваших проектов вокруг responsible AI.',
  },
  {
    name: 'Yan Hor',
    url: 'https://www.linkedin.com/messaging/thread/2-YWU5ODdkMjEtMjJjZi00MTI2LWJlZDUtYTM0YWVhYjNlNmNhXzEwMA==/',
    message: 'Погоду видела 😄 Но купаться и встречаться пока не пойду — личные встречи сейчас не планирую. Давай лучше пока здесь общаться.',
  },
];

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
const results = [];
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/messaging/'));
  if (!page) throw new Error('LinkedIn messaging tab is not open');
  await page.bringToFront();
  for (const reply of replies) {
    let result;
    try {
      await page.goto(reply.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.msg-entity-lockup__entity-title', { timeout: 20000 });
      await pause(page);
      const activeName = (await page.locator('.msg-entity-lockup__entity-title').first().innerText()).trim();
      if (activeName !== reply.name) throw new Error(`unexpected active conversation: ${activeName}`);
      const thread = page.locator('.msg-s-message-list-content').first();
      if ((await thread.innerText()).includes(reply.message.slice(0, 60))) {
        result = { status: 'already_present' };
      } else {
        const editors = page.locator('.msg-form__contenteditable[contenteditable="true"]:visible, [contenteditable="true"][role="textbox"]:visible');
        if (await editors.count() !== 1) throw new Error(`visible editors=${await editors.count()}`);
        await editors.first().fill(reply.message);
        await pause(page);
        const candidates = page.getByRole('button', { name: /^(Senden|Send)$/ });
        const send = [];
        for (let index = 0; index < await candidates.count(); index += 1) if (await candidates.nth(index).isVisible()) send.push(candidates.nth(index));
        if (send.length !== 1 || !await send[0].isEnabled()) throw new Error(`enabled send buttons=${send.length}`);
        await send[0].click();
        await pause(page);
        if (!(await thread.innerText()).includes(reply.message.slice(0, 60))) throw new Error('sent text was not found in the thread');
        result = { status: 'sent' };
      }
    } catch (error) {
      result = { status: 'blocked', detail: error.message };
    }
    const entry = { type: 'regular_linkedin_unread_reply', name: reply.name, message: reply.message, ...result, at: new Date().toISOString() };
    await appendFile(journal, `${JSON.stringify(entry)}\n`);
    results.push(entry);
    if (result.status === 'blocked') break;
  }
} finally {
  await browser.close();
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
