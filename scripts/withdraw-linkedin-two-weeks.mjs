import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const inspectOnly = process.argv.includes('--inspect');
const inspectDialog = process.argv.includes('--inspect-dialog');
const endpoint = 'http://127.0.0.1:9333';
const targetAge = 'Vor 2 Wochen gesendet';
const dataRoot = path.resolve('data/linkedin_web_state/liubov-lukina');
const runDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const journal = path.join(dataRoot, `withdrawn-invitations-two-weeks-${runDate}.jsonl`);
await mkdir(dataRoot, { recursive: true });
const pause = (page) => page.waitForTimeout(1000 + Math.floor(Math.random() * 2001));
const record = (item) => appendFile(journal, `${JSON.stringify({ ...item, at: new Date().toISOString() })}\n`);

async function matchingInvitations(page) {
  return page.evaluate((ageText) => {
    const results = new Map();
    const nodes = [...document.querySelectorAll('body *')].filter((node) =>
      node.children.length === 0 && node.textContent?.trim() === ageText);
    for (const node of nodes) {
      let current = node;
      for (let depth = 0; current && depth < 14; depth += 1, current = current.parentElement) {
        const link = current.querySelector?.('a[aria-label^="Einladung an "][aria-label$=" zurückziehen"]');
        if (!link) continue;
        const aria = link.getAttribute('aria-label') ?? '';
        const rect = link.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.set(aria, {
            aria,
            name: aria.replace(/^Einladung an /, '').replace(/ zurückziehen$/, ''),
          });
        }
        break;
      }
    }
    return [...results.values()];
  }, targetAge);
}

async function restriction(page) {
  if (/\/(checkpoint|challenge|login|authwall)\b/i.test(page.url())) return page.url();
  const text = (await page.locator('body').innerText().catch(() => '')).slice(0, 12000);
  return text.match(/temporarily restricted|security verification|ungewöhnliche aktivität/i)?.[0] ?? '';
}

async function loadMore(page) {
  const before = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, y: scrollY }));
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  for (const label of [/Mehr anzeigen/i, /Weitere anzeigen/i, /Show more/i]) {
    const buttons = page.getByRole('button', { name: label });
    for (let i = 0; i < await buttons.count(); i += 1) {
      if (await buttons.nth(i).isVisible()) {
        await pause(page);
        await buttons.nth(i).click();
        await page.waitForTimeout(1500);
        return true;
      }
    }
  }
  const after = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, y: scrollY }));
  return after.height > before.height || after.y > before.y;
}

const browser = await chromium.connectOverCDP(endpoint, { isLocal: true, noDefaults: true, timeout: 15000 });
let withdrawn = 0;
let stopReason = '';
try {
  const page = browser.contexts()[0].pages().find((candidate) =>
    candidate.url().includes('/mynetwork/invitation-manager/sent/'));
  if (!page) throw new Error('Outgoing invitation manager tab is not open');
  await page.bringToFront();
  await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });

  if (inspectDialog) {
    const dialogs = page.getByRole('dialog');
    const visible = [];
    for (let i = 0; i < await dialogs.count(); i += 1) if (await dialogs.nth(i).isVisible()) visible.push(dialogs.nth(i));
    const details = [];
    for (const dialog of visible) details.push({
      text: (await dialog.innerText()).replace(/\s+/g, ' ').trim().slice(0, 500),
      controls: await dialog.locator('button,a').evaluateAll((items) => items.map((item) => ({
        tag: item.tagName,
        text: item.textContent?.replace(/\s+/g, ' ').trim(),
        aria: item.getAttribute('aria-label'),
      })).slice(0, 10)),
    });
    process.stdout.write(`${JSON.stringify({ visible_dialogs: details })}\n`);
  } else if (inspectOnly) {
    for (let i = 0; i < 4; i += 1) if (!await loadMore(page)) break;
    const matches = await matchingInvitations(page);
    process.stdout.write(`${JSON.stringify({ matches: matches.length, sample_names: matches.slice(0, 3).map((x) => x.name), exact_age: targetAge })}\n`);
  } else {
    const attempted = new Set();
    let stagnant = 0;
    const initiallyOpen = page.getByRole('dialog');
    for (let i = 0; i < await initiallyOpen.count(); i += 1) {
      const dialog = initiallyOpen.nth(i);
      if (!await dialog.isVisible()) continue;
      const existingConfirm = dialog.locator('button[aria-label^="Einladung an "][aria-label$=" zurückziehen"]');
      if (await existingConfirm.count() !== 1) {
        stopReason = 'unexpected open dialog';
        break;
      }
      const aria = await existingConfirm.getAttribute('aria-label');
      const name = aria.replace(/^Einladung an /, '').replace(/ zurückziehen$/, '');
      await pause(page);
      await existingConfirm.click();
      await dialog.waitFor({ state: 'hidden', timeout: 10000 });
      withdrawn += 1;
      await record({ name, age: targetAge, status: 'withdrawn' });
      process.stdout.write(`${JSON.stringify({ name, status: 'withdrawn' })}\n`);
      await pause(page);
    }
    while (stagnant < 4 && !stopReason) {
      stopReason = await restriction(page);
      if (stopReason) break;
      const matches = await matchingInvitations(page);
      const target = matches.find((item) => !attempted.has(item.aria));
      if (!target) {
        stagnant = await loadMore(page) ? 0 : stagnant + 1;
        continue;
      }
      attempted.add(target.aria);
      const link = page.locator(`a[aria-label=${JSON.stringify(target.aria)}]`);
      if (await link.count() !== 1) {
        await record({ name: target.name, age: targetAge, status: 'skipped', detail: `link count ${await link.count()}` });
        continue;
      }
      await link.scrollIntoViewIfNeeded();
      await pause(page);
      await link.click();
      await pause(page);
      const dialogs = page.getByRole('dialog');
      const visibleDialogs = [];
      for (let i = 0; i < await dialogs.count(); i += 1) if (await dialogs.nth(i).isVisible()) visibleDialogs.push(dialogs.nth(i));
      if (visibleDialogs.length !== 1) {
        stopReason = `visible dialogs ${visibleDialogs.length}`;
        await record({ name: target.name, age: targetAge, status: 'blocked', detail: stopReason });
        break;
      }
      const dialog = visibleDialogs[0];
      const confirmAll = dialog.locator('button[aria-label^="Einladung an "][aria-label$=" zurückziehen"]');
      const confirm = [];
      for (let i = 0; i < await confirmAll.count(); i += 1) if (await confirmAll.nth(i).isVisible()) confirm.push(confirmAll.nth(i));
      if (confirm.length !== 1 || !await confirm[0].isEnabled()) {
        stopReason = `withdraw confirm buttons ${confirm.length}`;
        await record({ name: target.name, age: targetAge, status: 'blocked', detail: stopReason });
        break;
      }
      await pause(page);
      await confirm[0].click();
      await dialog.waitFor({ state: 'hidden', timeout: 10000 });
      withdrawn += 1;
      stagnant = 0;
      await record({ name: target.name, age: targetAge, status: 'withdrawn' });
      process.stdout.write(`${JSON.stringify({ name: target.name, status: 'withdrawn' })}\n`);
      await pause(page);
    }
  }
} finally {
  await browser.close();
}

if (!inspectOnly && !inspectDialog) process.stdout.write(`${JSON.stringify({ withdrawn, stop_reason: stopReason, journal })}\n`);
