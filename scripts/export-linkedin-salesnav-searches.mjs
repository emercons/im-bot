import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';
import { isExcludedPerson, loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const endpoint = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9333';
const accountRef = 'liubov-lukina';
const searches = [
  { name: 'Bildungszentren Dortmund', id: '2002876234' },
  { name: 'Bildungszentren NRW außer Dortmund', id: '2002876242' },
];
const outputRoot = path.resolve('data', 'linkedin_web_state', accountRef, 'salesnav_exports');
const outputBase = path.join(outputRoot, `education-centers-nrw-${new Date().toISOString().slice(0, 10)}`);
const exclusions = await loadSalesNavExclusions();

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function apiStart(rawUrl) {
  const match = rawUrl.match(/[?&]start=(\d+)/);
  return match ? Number(match[1]) : -1;
}

function searchIdFromApi(rawUrl) {
  return new URL(rawUrl).searchParams.get('savedSearchId') ?? '';
}

function restrictionReason(page) {
  if (/\/(checkpoint|challenge|login|authwall)\b/i.test(page.url())) return page.url();
  return null;
}

async function leadSearchResponse(page, trigger, searchId, start) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/sales-api/salesApiLeadSearch')
      && searchIdFromApi(response.url()) === searchId
      && apiStart(response.url()) === start,
    { timeout: 45_000 },
  );
  await trigger();
  const response = await responsePromise;
  if (response.status() !== 200) throw new Error(`Lead search returned HTTP ${response.status()}.`);
  const payload = await response.json();
  if (!Array.isArray(payload.elements) || !payload.paging) {
    throw new Error('Unexpected Sales Navigator lead search response.');
  }
  return payload;
}

function rowFromElement(element, search, pageNumber, capturedAt) {
  const current = element.currentPositions?.find((position) => position.current) ?? element.currentPositions?.[0] ?? {};
  const entityValue = clean(element.entityUrn).match(/fs_salesProfile:\(([^)]+)\)/)?.[1] ?? '';
  const leadId = entityValue.split(',')[0] ?? '';
  const memberId = clean(element.objectUrn).split(':').at(-1) ?? '';
  const location = clean(element.geoRegion);
  return {
    search_name: search.name,
    saved_search_id: search.id,
    full_name: clean(element.fullName),
    first_name: clean(element.firstName),
    last_name: clean(element.lastName),
    job_title: clean(current.title),
    company: clean(current.companyName),
    location,
    city: location.split(',')[0] ?? '',
    connection_degree: element.degree ?? '',
    sales_navigator_lead_id: leadId,
    linkedin_member_id: memberId,
    sales_navigator_url: entityValue ? `https://www.linkedin.com/sales/lead/${entityValue}` : '',
    result_page: pageNumber,
    captured_at_utc: capturedAt,
  };
}

const browser = await chromium.connectOverCDP(endpoint, {
  isLocal: true,
  noDefaults: true,
  timeout: 15_000,
});

const rows = [];
const summaries = [];
try {
  const page = browser.contexts()[0].pages().find((candidate) => candidate.url().includes('/sales/search/people'));
  if (!page) throw new Error('Open a Sales Navigator people search in the operator Chrome first.');

  for (const search of searches) {
    const currentUrl = new URL(page.url());
    const sessionId = currentUrl.searchParams.get('sessionId');
    const targetUrl = new URL('https://www.linkedin.com/sales/search/people');
    targetUrl.searchParams.set('savedSearchId', search.id);
    if (sessionId) targetUrl.searchParams.set('sessionId', sessionId);

    const firstPayload = await leadSearchResponse(
      page,
      () => page.goto(targetUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 }),
      search.id,
      0,
    );
    const total = Number(firstPayload.paging.total ?? 0);
    const expectedPages = Math.max(1, Math.ceil(total / 25));
    const seen = new Set();
    const capturedAt = new Date().toISOString();
    const excludedNames = new Set();

    const savePayload = (payload, pageNumber) => {
      for (const element of payload.elements) {
        const row = rowFromElement(element, search, pageNumber, capturedAt);
        if (!row.sales_navigator_lead_id || seen.has(row.sales_navigator_lead_id)) continue;
        if (isExcludedPerson(exclusions, row)) {
          excludedNames.add(row.full_name);
          continue;
        }
        seen.add(row.sales_navigator_lead_id);
        rows.push(row);
      }
      process.stdout.write(`${JSON.stringify({ search: search.name, page: pageNumber, pages: expectedPages, collected: seen.size, expected: total })}\n`);
    };

    savePayload(firstPayload, 1);
    for (let pageNumber = 2; pageNumber <= expectedPages; pageNumber += 1) {
      const blocked = restrictionReason(page);
      if (blocked) throw new Error(`LinkedIn blocked collection: ${blocked}`);
      const pagination = page.locator(`[aria-label="Seite ${pageNumber}"]`).first();
      await pagination.waitFor({ state: 'attached', timeout: 30_000 });
      const start = (pageNumber - 1) * 25;
      const payload = await leadSearchResponse(
        page,
        () => pagination.evaluate((element) => element.click()),
        search.id,
        start,
      );
      savePayload(payload, pageNumber);
      await page.waitForTimeout(900);
    }

    summaries.push({
      name: search.name,
      saved_search_id: search.id,
      expected: total,
      collected: seen.size,
      pages: expectedPages,
      excluded: excludedNames.size,
      excluded_names: [...excludedNames],
    });
  }
} finally {
  await browser.close();
}

await mkdir(outputRoot, { recursive: true });
const columns = [
  'search_name',
  'saved_search_id',
  'full_name',
  'first_name',
  'last_name',
  'job_title',
  'company',
  'location',
  'city',
  'connection_degree',
  'sales_navigator_lead_id',
  'linkedin_member_id',
  'sales_navigator_url',
  'result_page',
  'captured_at_utc',
];
const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\r\n');
const manifest = {
  account_ref: accountRef,
  source: 'linkedin_sales_navigator_saved_search',
  searches: summaries,
  total_rows: rows.length,
  captured_at_utc: new Date().toISOString(),
};
await writeFile(`${outputBase}.csv`, `\uFEFF${csv}\r\n`, 'utf8');
await writeFile(`${outputBase}.json`, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
await writeFile(`${outputBase}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.stdout.write(`${JSON.stringify({ status: 'complete', ...manifest, csv: `${outputBase}.csv`, json: `${outputBase}.json`, manifest: `${outputBase}.manifest.json` })}\n`);
