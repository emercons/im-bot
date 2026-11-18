import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const endpoint = 'http://127.0.0.1:9333';
const journal = path.resolve('data/linkedin_web_state/liubov-lukina/message-replies-referral-offers-2026-08-09.jsonl');
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const record = (item) => appendFile(journal, `${JSON.stringify({ ...item, at: new Date().toISOString() })}\n`);

const replies = [
  {
    name: 'Yan Hor',
    url: 'https://www.linkedin.com/messaging/thread/2-YWU5ODdkMjEtMjJjZi00MTI2LWJlZDUtYTM0YWVhYjNlNmNhXzEwMA==/',
    offer: 'Premium Business',
    message: 'Привет, Ян! Спасибо, что принял приглашение 🙂 Я сейчас предпочитаю общаться здесь, в LinkedIn, и личных встреч пока не планирую, но буду рада оставаться на связи. Кстати, у меня есть промо-приглашения на 2 бесплатных месяца LinkedIn Premium Business. Если интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.\n\nЛюбовь',
  },
  {
    name: 'Oleksandr Shuliak',
    url: 'https://www.linkedin.com/messaging/thread/2-OTJmMDJkMDQtZTY3Ni00NGY5LWJjMGMtYjI4ZjRlYmI1NmQzXzEwMA==/',
    offer: 'Sales Navigator Core',
    message: 'Александр, здравствуйте! Спасибо, что приняли приглашение, и простите за поздний ответ. Очень интересное направление у RABA — responsible AI и ответственность человека в AI-assisted decisions сейчас особенно актуальны. У меня есть несколько промо-приглашений на 2 бесплатных месяца Sales Navigator Core; для поиска партнёров, клиентов и нужных decision-makers это может быть полезно. Если интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.\n\nЛюбовь',
  },
  {
    name: 'Natalia Kniazeva',
    url: 'https://www.linkedin.com/messaging/thread/2-MmYzMWI5YmEtYTA5Mi00YzAxLTgxMmYtNzlhNDlhYmE3NDljXzEwMA==/',
    offer: 'Premium Business',
    message: 'Наталья, кстати, у Любови сейчас есть несколько промо-приглашений на 2 бесплатных месяца LinkedIn Premium Business. Если тебе это может пригодиться и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку. Ничего покупать у меня не нужно 🙂',
  },
  {
    name: 'Vadym Ponomarenko',
    url: 'https://www.linkedin.com/messaging/thread/2-NjdhZWRhOTktNTUxMi00OTA2LWIwZmQtODhiZTc0M2JjZjU0XzEwMA==/',
    offer: 'Sales Navigator Core',
    message: 'Вадим, здравствуйте! Спасибо за подробное сообщение, и извините, что отвечаю с опозданием. Идея партнёрства и The Harvest Studio звучат интересно; буду иметь в виду ваши услуги, когда появится подходящий запрос. У меня сейчас есть промо-приглашения на 2 бесплатных месяца Sales Navigator Core. Для поиска клиентов, партнёров и decision-makers это может быть полезно. Если вам интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.\n\nЛюбовь',
  },
];

let existingJournal = '';
try { existingJournal = await readFile(journal, 'utf8'); } catch {}

const browser = await chromium.connectOverCDP(endpoint, { isLocal: true, noDefaults: true, timeout: 15000 });
const results = [];
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/messaging/'));
  if (!page) throw new Error('LinkedIn messaging tab is not open');
  await page.bringToFront();

  for (const reply of replies) {
    let result;
    try {
      if (existingJournal.split(/\r?\n/).some((line) => line.includes(`\"name\":\"${reply.name}\"`) && line.includes('2026_current_year_referral_offer') && line.includes('\"status\":\"sent\"'))) {
        result = { status: 'already_journaled' };
      } else {
        const heading = page.locator('.msg-conversation-listitem__participant-names').filter({ hasText: reply.name }).first();
        await heading.scrollIntoViewIfNeeded({ timeout: 10000 });
        await pause(page);
        await heading.click();
        await page.waitForFunction((expected) => {
          const title = document.querySelector('.msg-entity-lockup__entity-title');
          return title?.textContent?.trim() === expected;
        }, reply.name, { timeout: 20000 });
        await pause(page);

        const alertText = (await page.locator('[role="alert"]:visible').allInnerTexts()).join(' ');
        if (/checkpoint|captcha|weekly limit|temporarily restricted/i.test(alertText)) throw new Error('restriction marker detected');
        const activeName = (await page.locator('.msg-entity-lockup__entity-title').first().innerText()).trim();
        if (activeName !== reply.name) throw new Error(`unexpected active conversation: ${activeName}`);
        const currentThread = await page.locator('.msg-s-message-list-content').first().innerText();
        if (currentThread.includes(reply.message.slice(0, 80))) {
          result = { status: 'already_present' };
        } else {
          const editors = page.locator('.msg-form__contenteditable[contenteditable="true"]:visible, [contenteditable="true"][role="textbox"]:visible');
          if (await editors.count() !== 1) throw new Error(`visible editors=${await editors.count()}`);
          await editors.first().fill(reply.message);
          await pause(page);

          const sendAll = page.getByRole('button', { name: /^(Senden|Send)$/ });
          const visible = [];
          for (let index = 0; index < await sendAll.count(); index += 1) if (await sendAll.nth(index).isVisible()) visible.push(sendAll.nth(index));
          if (visible.length !== 1 || !await visible[0].isEnabled()) throw new Error(`enabled send buttons=${visible.length}`);
          await visible[0].click();
          await pause(page);

          const updatedThread = await page.locator('.msg-s-message-list-content').first().innerText();
          if (!updatedThread.includes(reply.message.slice(0, 80))) throw new Error('sent text was not found in the thread');
          result = { status: 'sent' };
        }
      }
    } catch (error) {
      result = { status: 'blocked', detail: error.message };
    }
    const entry = { type: '2026_current_year_referral_offer', name: reply.name, offer: reply.offer, message: reply.message, ...result };
    await record(entry);
    results.push(entry);
    if (result.status === 'blocked') break;
  }
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
