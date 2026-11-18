import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const endpoint = 'http://127.0.0.1:9333';
const batchSize = Number(process.argv[2] ?? 5);
const exportDir = path.resolve(process.env.FDE_EXPORT_DIR ?? 'data/linkedin_web_state/liubov-lukina/salesnav_exports/active-search-4470915969-20260807T114608Z');
const draftFile = process.env.FDE_DRAFT_FILE ?? 'connection-drafts-second-degree.json';
const journal = path.join(exportDir, process.env.FDE_JOURNAL_FILE ?? 'outreach-fde-2026-08-07.jsonl');
const drafts = JSON.parse(await readFile(path.join(exportDir, draftFile), 'utf8'));
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > drafts.length) throw new Error(`Batch size must be 1..${drafts.length}`);
const manifest = JSON.parse(await readFile(path.join(exportDir, 'manifest.json'), 'utf8'));
const pageCount = Number(manifest.pages ?? Math.ceil(Number(manifest.expected_results ?? drafts.length) / 25));
const expectedRelationshipIds = (process.env.SALESNAV_RELATIONSHIP_IDS ?? 'F,S').split(',').map((x) => x.trim()).filter(Boolean);
const minActionPauseMs = Number(process.env.MIN_ACTION_PAUSE_MS ?? 1000);
const maxActionPauseMs = Number(process.env.MAX_ACTION_PAUSE_MS ?? 3000);
if (!Number.isFinite(minActionPauseMs) || !Number.isFinite(maxActionPauseMs)
    || minActionPauseMs < 0 || maxActionPauseMs < minActionPauseMs) {
  throw new Error('Invalid action pause range.');
}
await mkdir(exportDir, { recursive: true });
const exclusions = await loadSalesNavExclusions();

async function prior() {
  try {
    return (await readFile(journal, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
async function record(item) {
  await appendFile(journal, `${JSON.stringify({ ...item, at: new Date().toISOString() })}\n`);
}
async function humanPause(page) {
  await page.waitForTimeout(minActionPauseMs + Math.floor(Math.random() * (maxActionPauseMs - minActionPauseMs + 1)));
}
async function restriction(page) {
  if (/\/(checkpoint|challenge|login|authwall)\b/i.test(page.url())) return page.url();
  const statusText = (await page.locator('[role="alert"]:visible, [role="dialog"]:visible').allInnerTexts().catch(() => []))
    .join(' ').slice(0, 4000);
  const hit = statusText.match(/weekly invitation limit|wöchentliches limit|zu viele einladungen|temporarily restricted|security verification|ungewöhnliche aktivität/i);
  return hit?.[0] ?? '';
}
async function visibleExact(page, text) {
  const all = page.getByText(text, { exact: true });
  const visible = [];
  for (let i = 0; i < await all.count(); i += 1) if (await all.nth(i).isVisible()) visible.push(all.nth(i));
  return visible;
}
function isCurrentResultsPage(currentUrl, targetUrl) {
  const current = new URL(currentUrl);
  const target = new URL(targetUrl);
  const currentPage = current.searchParams.get('page') ?? '1';
  const targetPage = target.searchParams.get('page') ?? '1';
  current.searchParams.delete('page');
  target.searchParams.delete('page');
  return currentPage === targetPage && current.toString() === target.toString();
}
async function invite(page, draft) {
  const trigger = page.getByRole('button', { name: `Weitere Aktionen für ${draft.full_name} anzeigen` });
  if (await trigger.count() !== 1) return { status: 'not_rendered' };
  try {
    await trigger.scrollIntoViewIfNeeded({ timeout: 8000 });
  } catch {
    // Virtualized Sales Navigator cards can be replaced while scrolling. This
    // is not a send failure; let the worker advance and revisit the card.
    return { status: 'not_rendered' };
  }
  await humanPause(page);
  await trigger.click();
  await humanPause(page);
  const connect = await visibleExact(page, 'Vernetzen');
  if (connect.length !== 1) {
    const pending = (await visibleExact(page, 'Einladung zurückziehen')).length > 0;
    await page.keyboard.press('Escape').catch(() => {});
    return { status: pending ? 'already_pending' : 'skipped', detail: `Vernetzen=${connect.length}` };
  }
  await connect[0].click();
  await humanPause(page);
  const dialog = page.getByRole('dialog', { name: 'Einladung senden' });
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  await dialog.locator('textarea').fill(draft.message);
  await humanPause(page);
  const checkbox = dialog.locator('input[type="checkbox"]');
  if (await checkbox.count() === 1 && await checkbox.isChecked()) {
    await checkbox.click();
    await humanPause(page);
  }
  const send = dialog.getByRole('button', { name: /^(Einladung senden|Senden)$/ });
  await send.waitFor({ state: 'visible', timeout: 10000 });
  if (!await send.isEnabled()) return { status: 'blocked', detail: 'send disabled' };
  await humanPause(page);
  // Sales Navigator occasionally keeps the enabled button in a moving form
  // container. After the normal human pause, force only the final visible,
  // enabled click so a transient animation does not abort the whole journaled
  // batch.
  await send.click({ force: true });
  await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  const blocked = await restriction(page);
  return blocked ? { status: 'blocked', detail: blocked } : { status: 'sent' };
}

const browser = await chromium.connectOverCDP(endpoint, { isLocal: true, noDefaults: true, timeout: 15000 });
let sent = 0;
let stopReason = '';
try {
  const page = browser.contexts()[0].pages().find((p) => p.url().includes('/sales/search/people'));
  if (!page) throw new Error('Sales Navigator people search is not open');
  // A previously interrupted send can leave an unsent dialog above the result
  // list. Dismiss it; its lead is absent from the append-only journal and will
  // be reached again through the normal per-card flow.
  await page.keyboard.press('Escape').catch(() => {});
  const savedSearchId = new URL(manifest.source_url).searchParams.get('savedSearchId');
  // `search_ref` is a local export hash, not a value that Sales Navigator
  // preserves in its live URL. Validate only an actual saved-search or recent-
  // search identifier; otherwise the freshly exported active query is the
  // authoritative selection.
  const expectedSearchToken = manifest.recent_search_id ?? savedSearchId ?? '';
  if ((expectedSearchToken && !page.url().includes(String(expectedSearchToken)))
      || expectedRelationshipIds.some((id) => !page.url().includes(`id%3A${id}`))) throw new Error('Unexpected search or relationship filters');
  const done = new Set((await prior()).filter((x) => ['sent', 'already_pending', 'skipped'].includes(x.status)).map((x) => x.sales_navigator_lead_id));
  const targets = new Map(drafts.filter((d) => !done.has(d.sales_navigator_lead_id) && !exclusions.names.has(d.full_name.toLowerCase())).map((d) => [d.full_name, d]));
  const baseUrl = new URL(page.url());

  for (let pageNo = 1; pageNo <= pageCount && sent < batchSize && !stopReason; pageNo += 1) {
    baseUrl.searchParams.set('page', String(pageNo));
    const targetUrl = baseUrl.toString();
    // Refresh once at the beginning of a worker run to recover from an
    // interrupted virtualized card; subsequent pages are navigated only once.
    if (pageNo === 1 || !isCurrentResultsPage(page.url(), targetUrl)) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.locator('div.overflow-y-auto').first().waitFor({ state: 'visible', timeout: 20000 });
    const scroller = page.locator('div.overflow-y-auto');
    if (await scroller.count() !== 1) throw new Error(`results scroller count=${await scroller.count()}`);
    await scroller.evaluate((el) => { el.scrollTop = 0; });
    // On a recovered Sales Navigator page the visible cards can remain as
    // placeholders until this list receives an intersection-triggering scroll.
    await scroller.evaluate((el) => { el.scrollTop = Math.min(240, el.scrollHeight - el.clientHeight); });
    await page.waitForTimeout(750);
    await scroller.evaluate((el) => { el.scrollTop = 0; });
    await page.locator('button[aria-label^="Weitere Aktionen für "]').first().waitFor({ state: 'visible', timeout: 20000 });
    let stagnant = 0;
    while (sent < batchSize && stagnant < 3 && !stopReason) {
      const names = await page.locator('button[aria-label^="Weitere Aktionen für "]').evaluateAll((els) => [...new Set(els.map((e) => (e.getAttribute('aria-label') ?? '').replace(/^Weitere Aktionen für /, '').replace(/ anzeigen$/, '').trim()))]);
      let progressed = false;
      for (const name of names) {
        const draft = targets.get(name);
        if (!draft || sent >= batchSize) continue;
        const result = await invite(page, draft);
        if (result.status === 'not_rendered') continue;
        await record({ type: 'connection_invitation', full_name: name, sales_navigator_lead_id: draft.sales_navigator_lead_id, message: draft.message, page: pageNo, ...result });
        process.stdout.write(`${JSON.stringify({ name, ...result })}\n`);
        progressed = true;
        if (result.status === 'sent') sent += 1;
        if (result.status !== 'not_rendered') targets.delete(name);
        if (result.status === 'blocked') stopReason = result.detail ?? 'blocked';
        if (sent < batchSize && !stopReason) await humanPause(page);
      }
      if (sent >= batchSize || stopReason) break;
      const scroll = await scroller.evaluate((el) => { const before = el.scrollTop; el.scrollTop = Math.min(el.scrollTop + Math.max(600, el.clientHeight * .85), el.scrollHeight - el.clientHeight); return { before, after: el.scrollTop }; });
      stagnant = (!progressed && scroll.after === scroll.before) ? stagnant + 1 : 0;
      await page.waitForTimeout(1000);
    }
  }
} finally {
  await browser.close();
}
process.stdout.write(`${JSON.stringify({ sent_this_run: sent, stop_reason: stopReason, journal })}\n`);
