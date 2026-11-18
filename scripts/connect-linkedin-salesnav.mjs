import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const endpoint = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9333';
const batchSize = Number(process.argv[2] ?? '5');
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10) {
  throw new Error('Batch size must be an integer from 1 to 10.');
}

const dataRoot = path.resolve('data', 'linkedin_web_state', 'liubov-lukina');
const journalPath = path.join(dataRoot, 'connection-invitations.jsonl');
await mkdir(dataRoot, { recursive: true });
const exclusions = await loadSalesNavExclusions();

const templates = [
  (first) => `${first}, здравствуйте! Увидела Ваш профиль среди специалистов по AI в Баварии. Буду рада познакомиться и добавить Вас в свою профессиональную сеть.`,
  (first) => `Здравствуйте, ${first}! Мне интересен Ваш профессиональный опыт в технологиях и AI. Буду рада быть на связи и обмениваться идеями.`,
  (first) => `${first}, добрый день! Рада видеть в LinkedIn русскоязычных специалистов из Баварии. Предлагаю познакомиться и оставаться на связи.`,
  (first) => `Здравствуйте, ${first}! Ваш профиль показался мне интересным. Буду рада расширить профессиональный круг общения и добавить Вас в контакты.`,
  (first) => `${first}, здравствуйте! Мы оба развиваем профессиональную сеть в Германии, и мне было бы приятно познакомиться и быть на связи.`,
  (first) => `Добрый день, ${first}! Интересно познакомиться с профессионалами из технологического сообщества Баварии. Буду рада добавить Вас в сеть.`,
  (first) => `${first}, приветствую! Увидела Ваш опыт в результатах по AI и технологиям. Буду рада профессиональному знакомству и общению.`,
  (first) => `Здравствуйте, ${first}! Хотела бы познакомиться и следить за Вашими профессиональными новостями. Буду рада быть на связи.`,
  (first) => `${first}, добрый день! Расширяю круг профессиональных знакомств в Германии и буду рада добавить Вас в свою сеть.`,
  (first) => `Здравствуйте, ${first}! Мне близка тема развития технологий и AI. Буду рада познакомиться и обмениваться полезными профессиональными находками.`,
];

async function priorNames() {
  try {
    const content = await readFile(journalPath, 'utf8');
    return new Set(
      content
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((item) => item.status === 'sent' || item.status === 'already_pending')
        .map((item) => item.name),
    );
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
}

async function record(payload) {
  await appendFile(
    journalPath,
    `${JSON.stringify({ ...payload, at: new Date().toISOString() })}\n`,
    'utf8',
  );
}

async function restriction(page) {
  if (/\/(checkpoint|challenge|login|authwall)\b/i.test(page.url())) return page.url();
  for (const marker of [
    /weekly invitation limit/i,
    /wöchentliches limit/i,
    /zu viele einladungen/i,
    /temporarily restricted/i,
    /security verification/i,
    /ungewöhnliche aktivität/i,
  ]) {
    if ((await page.getByText(marker).count()) > 0) return marker.source;
  }
  return null;
}

async function visibleExactText(page, text) {
  const locator = page.getByText(text, { exact: true });
  const matches = [];
  for (let index = 0; index < (await locator.count()); index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible()) matches.push(item);
  }
  return matches;
}

async function invitationButton(dialog, page) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const buttons = dialog.locator('button');
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      const text = (await button.innerText()).trim();
      if (/^(Einladung senden|Senden)$/i.test(text) && (await button.isEnabled())) return button;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function invite(page, name, message) {
  const blocked = await restriction(page);
  if (blocked) return { status: 'blocked', detail: blocked };

  await page.keyboard.press('Escape').catch(() => {});
  const trigger = page.getByRole('button', {
    name: `Weitere Aktionen für ${name} anzeigen`,
  });
  if ((await trigger.count()) !== 1) {
    return { status: 'skipped', detail: `menu trigger count ${await trigger.count()}` };
  }
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await trigger.evaluate((element) => element.click());
  await page.waitForTimeout(500);

  const connectItems = await visibleExactText(page, 'Vernetzen');
  if (connectItems.length !== 1) {
    const withdraw = await visibleExactText(page, 'Einladung zurückziehen');
    await page.keyboard.press('Escape').catch(() => {});
    if (withdraw.length > 0) return { status: 'already_pending' };
    return { status: 'skipped', detail: `visible Vernetzen count ${connectItems.length}` };
  }
  await connectItems[0].evaluate((element) => element.click());

  const dialog = page.getByRole('dialog', { name: 'Einladung senden' });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  const textarea = dialog.locator('textarea');
  await textarea.waitFor({ state: 'visible', timeout: 40_000 });
  await textarea.fill(message);

  const saveLead = dialog.locator('input[type="checkbox"]');
  if ((await saveLead.count()) === 1 && (await saveLead.isChecked())) {
    await saveLead.evaluate((element) => element.click());
  }

  const send = await invitationButton(dialog, page);
  if (!send) {
    await page.keyboard.press('Escape').catch(() => {});
    return { status: 'blocked', detail: 'enabled invitation button did not appear' };
  }
  await send.click({ force: true, timeout: 5_000 });
  await page.waitForTimeout(1_500);
  if (await dialog.isVisible().catch(() => false)) {
    return { status: 'blocked', detail: 'invitation dialog remained open after submit' };
  }
  const after = await restriction(page);
  if (after) return { status: 'blocked', detail: after };
  return { status: 'sent' };
}

const browser = await chromium.connectOverCDP(endpoint, {
  isLocal: true,
  noDefaults: true,
  timeout: 15_000,
});

let sentThisRun = 0;
let stopReason = '';
try {
  const page = browser
    .contexts()[0]
    .pages()
    .find((candidate) => candidate.url().includes('/sales/search/people'));
  if (!page) throw new Error('Open the Sales Navigator people search in operator Chrome first.');

  const completed = await priorNames();
  const attempted = new Set();
  const resultsScroller = page.locator(
    'div.overflow-y-auto.p4:has(button[aria-label^="Weitere Aktionen für "])',
  );
  if ((await resultsScroller.count()) !== 1) {
    throw new Error(`Expected one results scroller, found ${await resultsScroller.count()}`);
  }

  while (sentThisRun < batchSize && !stopReason) {
    const menuAria = await page
      .locator('button[aria-label^="Weitere Aktionen für "]')
      .evaluateAll((buttons) =>
        buttons
          .map((button) => button.getAttribute('aria-label') ?? '')
          .filter(Boolean),
      );
    const names = [
      ...new Set(
        menuAria.map((aria) =>
          aria.replace(/^Weitere Aktionen für /, '').replace(/ anzeigen$/, '').trim(),
        ),
      ),
    ];
    const name = names.find((candidate) =>
      !exclusions.names.has(candidate.trim().toLocaleLowerCase('en'))
      && !completed.has(candidate)
      && !attempted.has(candidate));
    if (!name) {
      const scroll = await resultsScroller.evaluate((element) => {
        const before = element.scrollTop;
        const bottomBefore = before + element.clientHeight >= element.scrollHeight - 8;
        element.scrollTop = Math.min(
          before + Math.max(500, element.clientHeight * 0.8),
          element.scrollHeight - element.clientHeight,
        );
        return {
          before,
          after: element.scrollTop,
          bottomBefore,
        };
      });
      await page.waitForTimeout(800);
      if (scroll.bottomBefore || scroll.after === scroll.before) break;
      continue;
    }
    attempted.add(name);
    const first = name.split(/\s+/)[0];
    const message = templates[completed.size % templates.length](first);
    const result = await invite(page, name, message);
    await record({ name, message, ...result, page_url: page.url() });
    process.stdout.write(`${JSON.stringify({ name, ...result })}\n`);

    if (result.status === 'sent') {
      sentThisRun += 1;
      completed.add(name);
      const delay = 6_000 + Math.floor(Math.random() * 5_000);
      await page.waitForTimeout(delay);
    } else if (result.status === 'already_pending') {
      completed.add(name);
    } else if (result.status === 'blocked') {
      stopReason = result.detail ?? 'blocked';
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(
  `${JSON.stringify({ sent_this_run: sentThisRun, stop_reason: stopReason, journal: journalPath })}\n`,
);
