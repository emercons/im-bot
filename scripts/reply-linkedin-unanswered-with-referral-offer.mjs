import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const endpoint = 'http://127.0.0.1:9333';
const journal = path.resolve('data/linkedin_web_state/liubov-lukina/message-replies-referral-offers-2026-08-09.jsonl');
const pause = (page) => page.waitForTimeout(1000 + Math.floor(Math.random() * 2001));
const record = (item) => appendFile(journal, `${JSON.stringify({ ...item, at: new Date().toISOString() })}\n`);

const replies = [
  {
    name: 'Nina Hirchuk',
    url: 'https://www.linkedin.com/messaging/thread/2-MDQyZjNhNDAtNThlZC00YzVhLTg4YWYtY2Q0ZGExNGU0OTZiXzEwMA==/',
    offer: 'Premium Business',
    message: 'Нина, спасибо, что приняли приглашение! Конечно, это актуально — буду рада оставаться на связи и обмениваться полезными контактами. И ещё: у меня есть несколько промо-приглашений на 2 бесплатных месяца LinkedIn Premium Business. Если вам интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.\n\nЛюбовь',
  },
  {
    name: 'Yan Hor',
    url: 'https://www.linkedin.com/messaging/thread/2-YWU5ODdkMjEtMjJjZi00MTI2LWJlZDUtYTM0YWVhYjNlNmNhXzEwMA==/',
    offer: 'Premium Business',
    message: 'Привет, Ян! Спасибо, что принял приглашение 🙂 Идея с пивом отличная — давай спишемся насчёт времени. Кстати, у меня есть промо-приглашения на 2 бесплатных месяца LinkedIn Premium Business. Если интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.\n\nЛюбовь',
  },
  {
    name: 'Florian Berthold',
    url: 'https://www.linkedin.com/messaging/thread/2-MTY1ZDA4Y2MtZjQ0OC00NGEyLWJlYWUtODFlZGZkZjVlNzE3XzEwMA==/',
    offer: 'Sales Navigator Core',
    message: 'Hi Florian, thanks for accepting my invitation. What interested me was the intersection of AI, process excellence, and hands-on implementation—especially how consulting teams turn ambiguous operational problems into deployed solutions. I also have a limited referral for two free months of Sales Navigator Core. If that could be useful for client or partnership research and your account is eligible, I’d be happy to send you a personal link.\n\nBest,\nLiubov',
  },
  {
    name: 'Sergej Lechowski',
    url: 'https://www.linkedin.com/messaging/thread/2-NDUxMGUzODEtNjI5NC00NmM2LThkNjUtNWM1MGU2YzM4NTQwXzEwMA==/',
    offer: 'Premium Business',
    message: 'Hallo Sergej, vielen Dank für Ihre Nachricht und fürs Vernetzen! Ich bin selbst noch auf der Suche nach einem passenden Praktikumsplatz und kann Ihnen daher leider noch keinen erprobten Weg empfehlen. Ich versuche es vor allem über direkte Kontakte zu IT-Teams und Unternehmen. Falls Sie inzwischen etwas gefunden haben, würde mich Ihr Weg ebenfalls interessieren. Übrigens habe ich einige Einladungen für zwei kostenlose Monate LinkedIn Premium Business. Wenn das für Ihre Suche hilfreich wäre und Ihr Konto die LinkedIn-Bedingungen erfüllt, kann ich Ihnen gern einen persönlichen Link schicken.\n\nViele Grüße\nLiubov',
  },
  {
    name: 'Roman Koshcheev',
    url: 'https://www.linkedin.com/messaging/thread/2-YmVmMzcxMmEtZGQ5YS00YTBhLWI2ZDAtOWI3Nzg2NzlkMmJjXzEwMA==/',
    offer: 'Premium Business',
    message: 'Роман, спасибо, что приняли приглашение! Взаимно, очень рада нашему контакту 🙂 Кстати, у меня есть промо-приглашения на 2 бесплатных месяца LinkedIn Premium Business. Если вам интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.\n\nЛюбовь',
  },
];

const browser = await chromium.connectOverCDP(endpoint, { isLocal: true, noDefaults: true, timeout: 15000 });
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

      const editors = page.locator('.msg-form__contenteditable[contenteditable="true"]:visible, [contenteditable="true"][role="textbox"]:visible');
      const editorCount = await editors.count();
      if (editorCount !== 1) throw new Error(`visible editors=${editorCount}`);
      await editors.first().fill(reply.message);
      await pause(page);

      const sendAll = page.getByRole('button', { name: /^(Senden|Send)$/ });
      const sendButtons = [];
      for (let index = 0; index < await sendAll.count(); index += 1) {
        if (await sendAll.nth(index).isVisible()) sendButtons.push(sendAll.nth(index));
      }
      if (sendButtons.length !== 1 || !await sendButtons[0].isEnabled()) throw new Error(`enabled send buttons=${sendButtons.length}`);
      await sendButtons[0].click();
      await pause(page);

      const threadText = await page.locator('.msg-s-message-list-content').first().innerText();
      if (!threadText.includes(reply.message.slice(0, 60))) throw new Error('sent text was not found in the thread');
      result = { status: 'sent' };
    } catch (error) {
      result = { status: 'blocked', detail: error.message };
    }
    const entry = { type: 'reply_with_referral_offer', name: reply.name, offer: reply.offer, message: reply.message, ...result };
    await record(entry);
    results.push(entry);
    if (result.status !== 'sent') break;
  }
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
