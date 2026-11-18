import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const journal = path.resolve('data/linkedin_web_state/liubov-lukina/message-replies-referral-offers-2026-08-10.jsonl');
const pause = (page) => page.waitForTimeout(4000 + Math.floor(Math.random() * 4001));
const record = (item) => appendFile(journal, `${JSON.stringify({ ...item, at: new Date().toISOString() })}\n`);
const replies = [
  {
    name: 'Valentina Savkova', offer: 'Sales Navigator Core', url: 'https://www.linkedin.com/sales/inbox/2-MzJlOGE2MGItNmE5MC00OGYxLWEyODYtYWZiN2VlZWY4Zjk4XzEwMA==?filter=UNREAD',
    message: 'Валентина, спасибо, взаимно! Ваш опыт работы с финансовой отраслью в EMEA показался мне особенно интересным. Кстати, у меня есть возможность поделиться пробной версией Sales Navigator Core на два месяца — она может пригодиться для исследования компаний и поиска нужных профессиональных контактов. Если вам актуально и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.',
  },
  {
    name: 'Artsiom Hud', offer: 'Premium Business', url: 'https://www.linkedin.com/sales/inbox/2-MmI1YzRkYzMtYTMxNS00NmRjLWExOTAtOTJmYjc2MmViZTg0XzEwMA==?filter=UNREAD',
    message: 'Артём, спасибо, взаимно! Буду рада оставаться на связи и обмениваться опытом по backend, data engineering и практическому применению AI. Кстати, у меня есть возможность поделиться пробной версией LinkedIn Premium Business на два месяца. Если вам интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.',
  },
  {
    name: 'Soham Bera', offer: 'Premium Business', url: 'https://www.linkedin.com/sales/inbox/2-OTc1ZDNhYjAtZjMyOC00Njg2LWJiM2QtNmEwZDRlMGU1YWEwXzEwMA==?filter=UNREAD',
    message: 'Thanks, Soham — likewise! Your work connecting AI capabilities with life-sciences outcomes is especially interesting. I also have an invitation for a two-month trial of LinkedIn Premium Business. If it would be useful and your account is eligible under LinkedIn’s terms, I’d be happy to send you a personal link.',
  },
  {
    name: 'Pablo Torres Robles', offer: 'Sales Navigator Core', url: 'https://www.linkedin.com/sales/inbox/2-NjM0MzE0ZGQtZWE2YS00NmZiLWIwZDktNTBkMzgzYzk0N2VlXzEwMA==?filter=UNREAD',
    message: 'Thanks, Pablo! I’m interested in how FDEs turn ambiguous customer needs and data into reliable production systems, especially in AI projects. I also have an invitation for a two-month trial of Sales Navigator Core, which may be useful for researching target companies and decision-makers. If relevant and your account is eligible, I’d be happy to send you a personal link.',
  },
  {
    name: 'Eli Leonid Polevoy', offer: 'Premium Business', url: 'https://www.linkedin.com/sales/inbox/2-OTlkYWMyNWMtODQ5OS00OWI3LWJmN2ItNzgxNjY2Y2Q2Njc2XzEwMA==?filter=UNREAD',
    message: 'Thanks, Eli — great to connect! Your experience leading AI projects across web and cloud systems caught my attention. I also have an invitation for a two-month trial of LinkedIn Premium Business. If it would be useful and your account is eligible under LinkedIn’s terms, I’d be happy to send you a personal link.',
  },
  {
    name: 'Jalal Tareen', offer: 'Sales Navigator Core', url: 'https://www.linkedin.com/sales/inbox/2-NWRiMjA2ZmQtZDdjOC00NWMwLWE1YmQtNjQ2ODM0Yzg3M2JlXzEwMA==?filter=UNREAD',
    message: 'Thanks, Jalal! I’m currently exploring practical AI and automation work and, in particular, how customer-facing engineers translate business needs into production systems. Your cloud-native and Kubernetes background seemed highly relevant to that intersection. I also have an invitation for a two-month trial of Sales Navigator Core; if it would help with company and decision-maker research and your account is eligible, I’d be happy to send a personal link.',
  },
  {
    name: 'Jasraj Singh', offer: 'Sales Navigator Core', url: 'https://www.linkedin.com/sales/inbox/2-NmE1YTgyOGYtOTI2NS00OTFmLWFhMWEtNGZhNTIzMThhZGNjXzEwMA==?filter=UNREAD',
    message: 'Thanks, Jasraj! Your work as an AI FDE is exactly the kind of hands-on, customer-facing engineering perspective I’m interested in. I also have an invitation for a two-month trial of Sales Navigator Core. If it would be useful for your work and your account is eligible, I’d be happy to send you a personal link.',
  },
  {
    name: 'Mikhail Azhyshchev', offer: 'Sales Navigator Core', url: 'https://www.linkedin.com/sales/inbox/2-ZTIwZmMzZjEtNGYyZS00YzkzLWE3YjItYTY0NmUwZjliMzQ1XzEwMA==?filter=UNREAD',
    message: 'Михаил, спасибо! Сейчас мне особенно интересны прикладные задачи вокруг RAG, агентных решений и автоматизации бизнес-процессов — прежде всего переход от прототипа к устойчивой системе, которая даёт измеримый результат. Ваш опыт на стыке AI и B2B здесь очень релевантен. Давайте пока продолжим общение здесь, в LinkedIn — мне так удобнее. Кстати, у меня есть возможность поделиться пробной версией Sales Navigator Core на два месяца. Если вам актуально и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.',
  },
  {
    name: 'Valeriia Liakhovetska', offer: 'Premium Business', url: 'https://www.linkedin.com/sales/inbox/2-ZjdjMmYwZjYtODkyMy00ZTQ4LWFmODMtZTJiZDU0NDM5NDQ0XzEwMA==?filter=UNREAD',
    message: 'Валерия, спасибо, взаимно! Буду рада оставаться на связи. Кстати, у меня есть возможность поделиться пробной версией LinkedIn Premium Business на два месяца — она может пригодиться для расширения профессиональной сети и поиска возможностей. Если вам интересно и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.',
  },
  {
    name: 'Natalia Morozova', offer: 'Sales Navigator Core', url: 'https://www.linkedin.com/sales/inbox/2-NGE2ZGYxOTMtMmU0ZS00OWY1LWIwMGUtMWE0NGJmNjc1ZjBmXzEwMA==?filter=UNREAD',
    message: 'Наталья, спасибо, взаимно! Ваш опыт в маркетинге, CRM и работе с данными показался мне особенно интересным — буду рада обмениваться наблюдениями об AI и автоматизации в бизнесе. Кстати, у меня есть возможность поделиться пробной версией Sales Navigator Core на два месяца; она может пригодиться для исследования компаний и поиска нужных профессиональных контактов. Если вам актуально и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.',
  },
  {
    name: 'Denis Shokhirev', offer: 'Sales Navigator Core', url: 'https://www.linkedin.com/sales/inbox/2-YjJiMGE5YjQtNTk0Yy00MjNjLWEzMDMtMDA3NzQ1NzgzZDUwXzEwMA==?filter=UNREAD',
    message: 'Денис, меня сейчас особенно интересуют прикладные AI-решения и автоматизация бизнес-процессов: как доводить агентные системы от демонстрации до надёжной эксплуатации и понятной ценности для клиента. Судя по вашему профилю, здесь у нас действительно есть о чём обменяться опытом. Кстати, у меня есть возможность поделиться пробной версией Sales Navigator Core на два месяца. Если вам актуально и аккаунт подходит под условия LinkedIn, могу прислать персональную ссылку.',
  },
  {
    name: 'Ivan Panov', offer: 'Premium Business', url: 'https://www.linkedin.com/sales/inbox/2-N2ExMTJlOTktOTAwYS00YTI0LWE4NDItMzhkNWRjZjA0MTFmXzEwMA==?filter=UNREAD',
    message: 'Thanks, Ivan! Your mix of people, agents, code, and product building is very much aligned with the topics I’m exploring. I also have an invitation for a two-month trial of LinkedIn Premium Business. If it would be useful and your account is eligible under LinkedIn’s terms, I’d be happy to send you a personal link.',
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
      if (existingJournal.split(/\r?\n/).some((line) => line.includes(`\"name\":\"${reply.name}\"`) && line.includes('\"status\":\"sent\"'))) {
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
        await pause(page);
        if (target) await target.click();
        else await page.goto(reply.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
        await editors.first().fill(reply.message);
        await pause(page);

        const buttons = thread.locator('button');
        const send = [];
        for (let index = 0; index < await buttons.count(); index += 1) {
          const candidate = buttons.nth(index);
          const label = (await candidate.innerText().catch(() => '')).trim();
          if (await candidate.isVisible() && /^(Senden|Send)$/.test(label)) send.push(candidate);
        }
        if (send.length !== 1 || !await send[0].isEnabled()) throw new Error(`enabled send buttons=${send.length}`);
        await send[0].click();
        await pause(page);

        const updated = (await thread.locator('li').allInnerTexts()).join('\n');
        if (!updated.includes(reply.message.slice(0, 80))) throw new Error('sent text was not found in the thread');
        result = { status: 'sent' };
      }
      }
    } catch (error) {
      result = { status: 'blocked', detail: error.message };
    }
    const entry = { type: 'salesnav_unread_reply', name: reply.name, offer: reply.offer, message: reply.message, ...result };
    await record(entry);
    results.push(entry);
    if (result.status === 'blocked') break;
  }
} finally {
  await browser.close();
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
