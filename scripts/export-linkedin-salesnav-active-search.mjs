import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';
import { isExcludedPerson, loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const endpoint = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9333';
const accountRef = 'liubov-lukina';
const exportRoot = path.resolve('data', 'linkedin_web_state', accountRef, 'salesnav_exports');
const exclusions = await loadSalesNavExclusions();

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function apiStart(rawUrl) {
  return Number(rawUrl.match(/[?&]start=(\d+)/)?.[1] ?? -1);
}

function leadIdentity(element) {
  const entityValue = clean(element.entityUrn).match(/fs_salesProfile:\(([^)]+)\)/)?.[1] ?? '';
  const leadId = entityValue.split(',')[0] ?? '';
  const memberId = clean(element.objectUrn).split(':').at(-1) ?? '';
  return {
    entityValue,
    leadId,
    memberId,
    salesNavigatorUrl: entityValue ? `https://www.linkedin.com/sales/lead/${entityValue}` : '',
  };
}

function positionRecord(position) {
  return {
    title: clean(position?.title),
    company: clean(position?.companyName),
    company_urn: clean(position?.companyUrn),
    company_industry: clean(position?.companyUrnResolutionResult?.industry),
    company_location: clean(position?.companyUrnResolutionResult?.location),
    current: Boolean(position?.current),
    started_on: position?.startedOn ?? null,
    ended_on: position?.endedOn ?? null,
    tenure_at_position: position?.tenureAtPosition ?? null,
    tenure_at_company: position?.tenureAtCompany ?? null,
  };
}

function normalizedRow(element, pageNumber, capturedAt) {
  const identity = leadIdentity(element);
  const currentPositions = (element.currentPositions ?? []).map(positionRecord);
  const pastPositions = (element.pastPositions ?? []).map(positionRecord);
  const primary = currentPositions.find((position) => position.current) ?? currentPositions[0] ?? {};
  const location = clean(element.geoRegion);
  return {
    full_name: clean(element.fullName),
    first_name: clean(element.firstName),
    last_name: clean(element.lastName),
    current_company: clean(primary.company),
    current_position: clean(primary.title),
    current_companies: currentPositions.map((position) => position.company).filter(Boolean).join('; '),
    current_positions: currentPositions.map((position) => position.title).filter(Boolean).join('; '),
    location,
    city: location.includes(',') ? location.split(',')[0].trim() : '',
    connection_degree: element.degree ?? '',
    about: clean(element.summary),
    current_positions_json: JSON.stringify(currentPositions),
    past_positions_json: JSON.stringify(pastPositions),
    spotlight_badges_json: JSON.stringify(element.spotlightBadges ?? []),
    pending_invitation: element.pendingInvitation ?? '',
    viewed: element.viewed ?? '',
    saved_as_lead: element.saved ?? '',
    premium: element.premium ?? '',
    open_link: element.openLink ?? '',
    sales_navigator_lead_id: identity.leadId,
    linkedin_member_id: identity.memberId,
    sales_navigator_url: identity.salesNavigatorUrl,
    result_page: pageNumber,
    captured_at_utc: capturedAt,
  };
}

async function captureLeadResponse(page, trigger, start) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/sales-api/salesApiLeadSearch')
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
  return { payload, apiUrl: response.url() };
}

const browser = await chromium.connectOverCDP(endpoint, {
  isLocal: true,
  noDefaults: true,
  timeout: 15_000,
});

let collectorPage;
try {
  const context = browser.contexts()[0];
  const sourcePage = context.pages().find((page) => page.url().includes('/sales/search/people'));
  if (!sourcePage) throw new Error('Open the intended Sales Navigator people search first.');
  const sourceUrlObject = new URL(sourcePage.url());
  sourceUrlObject.searchParams.delete('page');
  const sourceUrl = sourceUrlObject.toString();
  if (/\/(checkpoint|challenge|login|authwall)\b/i.test(sourceUrl)) {
    throw new Error(`LinkedIn authentication or challenge page: ${sourceUrl}`);
  }

  collectorPage = await context.newPage();
  await sourcePage.bringToFront();
  const first = await captureLeadResponse(
    collectorPage,
    () => collectorPage.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }),
    0,
  );

  const total = Number(first.payload.paging.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / 25));
  const capturedAt = new Date().toISOString();
  const stamp = capturedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const decodedUrl = decodeURIComponent(sourceUrl);
  const recentSearchId = decodedUrl.match(/recentSearchParam:\(id:(\d+)/)?.[1] ?? '';
  const searchRef = recentSearchId || createHash('sha256').update(sourceUrl).digest('hex').slice(0, 12);
  const outputDirectory = path.join(exportRoot, `active-search-${searchRef}-${stamp}`);
  const rows = [];
  const rawElements = [];
  const seen = new Set();
  const excludedNames = new Set();

  const savePayload = (payload, pageNumber) => {
    for (const element of payload.elements) {
      const identity = leadIdentity(element);
      if (!identity.leadId || seen.has(identity.leadId)) continue;
      seen.add(identity.leadId);
      if (isExcludedPerson(exclusions, {
        full_name: element.fullName,
        sales_navigator_lead_id: identity.leadId,
        linkedin_member_id: identity.memberId,
      })) {
        excludedNames.add(clean(element.fullName));
        rawElements.push({
          result_page: pageNumber,
          captured_at_utc: capturedAt,
          excluded: true,
          exclusion_reason: 'Permanent user-requested exclusion.',
          element,
        });
        continue;
      }
      rawElements.push({ result_page: pageNumber, captured_at_utc: capturedAt, element });
      rows.push(normalizedRow(element, pageNumber, capturedAt));
    }
    process.stdout.write(`${JSON.stringify({ page: pageNumber, pages: pageCount, collected: rows.length, excluded: excludedNames.size, expected: total })}\n`);
  };

  savePayload(first.payload, 1);
  for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
    const pagination = collectorPage.locator(`[aria-label="Seite ${pageNumber}"]`).first();
    await pagination.waitFor({ state: 'attached', timeout: 30_000 });
    const start = (pageNumber - 1) * 25;
    const next = await captureLeadResponse(
      collectorPage,
      () => pagination.evaluate((element) => element.click()),
      start,
    );
    savePayload(next.payload, pageNumber);
    await collectorPage.waitForTimeout(900);
  }

  const columns = [
    'full_name', 'first_name', 'last_name', 'current_company', 'current_position',
    'current_companies', 'current_positions', 'location', 'city', 'connection_degree',
    'about', 'current_positions_json', 'past_positions_json', 'spotlight_badges_json',
    'pending_invitation', 'viewed', 'saved_as_lead', 'premium', 'open_link',
    'sales_navigator_lead_id', 'linkedin_member_id', 'sales_navigator_url',
    'result_page', 'captured_at_utc',
  ];
  const csv = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\r\n');
  const uniqueLeadCount = new Set(rows.map((row) => row.sales_navigator_lead_id)).size;
  const manifest = {
    account_ref: accountRef,
    source: 'linkedin_sales_navigator_active_search',
    source_url: sourceUrl,
    search_ref: searchRef,
    recent_search_id: recentSearchId || null,
    expected_results: total,
    collected_rows: rows.length,
    unique_leads: uniqueLeadCount,
    excluded_rows: excludedNames.size,
    excluded_names: [...excludedNames],
    pages: pageCount,
    missing_current_company: rows.filter((row) => !row.current_company).length,
    missing_current_position: rows.filter((row) => !row.current_position).length,
    missing_city: rows.filter((row) => !row.city).length,
    captured_at_utc: capturedAt,
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'candidates.csv'), `\uFEFF${csv}\r\n`, 'utf8');
  await writeFile(path.join(outputDirectory, 'candidates.json'), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  await writeFile(
    path.join(outputDirectory, 'raw-leads.jsonl'),
    `${rawElements.map((item) => JSON.stringify(item)).join('\n')}\n`,
    'utf8',
  );
  await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status: 'complete', output_directory: outputDirectory, ...manifest })}\n`);
} finally {
  if (collectorPage) await collectorPage.close().catch(() => {});
  await browser.close();
}
