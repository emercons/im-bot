import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const journal = path.resolve('data/linkedin_web_state/liubov-lukina/message-replies-referral-offers-2026-08-09.jsonl');
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const record = (item) => appendFile(journal, `${JSON.stringify({ ...item, at: new Date().toISOString() })}\n`);
const replies = [
  {
    name: 'Julia Kiryushina',
    offer: 'Premium Business',
    message: 'Юлия, взаимно! Спасибо за ответ. Гамбург — тоже отличный город; буду рада оставаться на связи, особенно с учётом вашего переезда осенью. Кстати, у меня есть промо-приглашения на два бесплатных месяца LinkedIn Premium Business. Это может пригодиться для расширения сети и поиска возможностей после переезда. Если интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.',
  },
  {
    name: 'Júlio Arend',
    offer: 'Premium Business',
    message: 'Thanks, Júlio! Great to connect. I’m especially curious about how Physical AI work at CoreWeave overlaps with customer-facing deployment and FDE-style problem solving. I also have a few referrals for two free months of LinkedIn Premium Business. If that would be useful and your account is eligible, I’d be happy to send a personal link.',
  },
  {
    name: 'Saraswathy Kalaiselvan',
    offer: 'Sales Navigator Core',
    message: 'Thanks, Saraswathy — great to connect! Your Senior FDE role at Rasa is exactly the kind of customer-facing engineering background I’m exploring. I also have a few referrals for two free months of Sales Navigator Core; it can be useful for researching target companies, decision-makers, and partnerships. If that’s relevant and your account is eligible, I’d be happy to send a personal link.',
  },
  {
    name: 'Hossein Hashemi',
    offer: 'Sales Navigator Core',
    message: 'Thanks, Hossein — great to have you in my network too. I’m particularly interested in your perspective on forward-deployed engineering and enterprise AI at BCG. I also have a few referrals for two free months of Sales Navigator Core; given your enterprise-facing work, it may be useful for researching companies and decision-makers. If relevant and your account is eligible, I’d be happy to send a personal link.',
  },
];

let existingJournal = '';
try { existingJournal = await readFile(journal, 'utf8'); } catch {}

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
const results = [];
try {
  const page = browser.contexts()[0]?.pages().find((candidate) => candidate.url().includes('linkedin.com/sales/inbox'));
  if (!page) throw new Error('Sales Navigator inbox tab is not open');
  await page.bringToFront();

  for (const reply of replies) {
    let result;
    try {
      if (existingJournal.split(/\r?\n/).some((line) => line.includes(`\"name\":\"${reply.name}\"`) && line.includes('salesnav_inbox_referral_offer') && line.includes('\"status\":\"sent\"'))) {
        result = { status: 'already_journaled' };
      } else {
        const activeName = (await page.locator('section.thread-container h2').textContent().catch(() => ''))?.trim();
        if (activeName !== reply.name) {
          const matches = page.getByText(reply.name, { exact: true });
          let target = null;
          for (let index = 0; index < await matches.count(); index += 1) {
            const candidate = matches.nth(index);
            if (await candidate.isVisible() && !await candidate.evaluate((element) => Boolean(element.closest('section.thread-container')))) {
              target = candidate;
              break;
            }
          }
          if (!target) throw new Error('conversation card is not visible');
          await target.scrollIntoViewIfNeeded();
          await pause(page);
          await target.click();
          await page.waitForFunction((expected) => document.querySelector('section.thread-container h2')?.textContent?.trim() === expected, reply.name, { timeout: 20000 });
          await pause(page);
        }

        const thread = page.locator('section.thread-container');
        const sentItemsText = (await thread.locator('li').allInnerTexts()).join('\n');
        if (sentItemsText.includes(reply.message.slice(0, 80))) {
          result = { status: 'already_present' };
        } else {
          const editors = thread.locator('textarea:visible, [contenteditable="true"]:visible');
          if (await editors.count() !== 1) throw new Error(`visible editors=${await editors.count()}`);
          const currentDraft = await editors.first().inputValue().catch(async () => await editors.first().innerText());
          if (currentDraft !== reply.message) await editors.first().fill(reply.message);
          await pause(page);

          const sendAll = thread.locator('button');
          const visible = [];
          for (let index = 0; index < await sendAll.count(); index += 1) {
            const candidate = sendAll.nth(index);
            const label = (await candidate.innerText().catch(() => '')).trim();
            if (await candidate.isVisible() && /^(Senden|Send)$/.test(label)) visible.push(candidate);
          }
          if (visible.length !== 1 || !await visible[0].isEnabled()) throw new Error(`enabled send buttons=${visible.length}`);
          await visible[0].click();
          await pause(page);

          const updatedItemsText = (await thread.locator('li').allInnerTexts()).join('\n');
          if (!updatedItemsText.includes(reply.message.slice(0, 80))) throw new Error('sent text was not found in the thread');
          result = { status: 'sent' };
        }
      }
    } catch (error) {
      result = { status: 'blocked', detail: error.message };
    }
    const entry = { type: 'salesnav_inbox_referral_offer', name: reply.name, offer: reply.offer, message: reply.message, ...result };
    await record(entry);
    results.push(entry);
    if (result.status === 'blocked') break;
  }
} finally {
  await browser.close();
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
