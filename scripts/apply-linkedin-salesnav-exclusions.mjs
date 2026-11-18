import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isExcludedPerson, loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const exportsRoot = path.resolve('data', 'linkedin_web_state', 'liubov-lukina', 'salesnav_exports');
const exclusions = await loadSalesNavExclusions();

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function filesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesRecursively(absolute));
    else files.push(absolute);
  }
  return files;
}

async function updateManifest(jsonPath, beforeRows, afterRows, excludedNames) {
  const directory = path.dirname(jsonPath);
  const base = path.basename(jsonPath, '.json');
  const candidates = base === 'candidates'
    ? [path.join(directory, 'manifest.json')]
    : [path.join(directory, `${base}.manifest.json`)];
  for (const manifestPath of candidates) {
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.source_rows = manifest.source_rows
        ?? manifest.collected_rows
        ?? manifest.total_rows
        ?? beforeRows.length;
      if ('collected_rows' in manifest) manifest.collected_rows = afterRows.length;
      if ('total_rows' in manifest) manifest.total_rows = afterRows.length;
      if ('unique_leads' in manifest) {
        manifest.unique_leads = new Set(afterRows.map((row) => row.sales_navigator_lead_id).filter(Boolean)).size;
      }
      manifest.excluded_rows = beforeRows.length - afterRows.length;
      manifest.excluded_names = excludedNames;
      if (Array.isArray(manifest.searches)) {
        const counts = new Map();
        for (const row of afterRows) counts.set(row.search_name, (counts.get(row.search_name) ?? 0) + 1);
        manifest.searches = manifest.searches.map((search) => ({
          ...search,
          source_collected: search.source_collected ?? search.collected,
          collected: counts.get(search.name) ?? 0,
        }));
      }
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

const changed = [];
for (const jsonPath of (await filesRecursively(exportsRoot)).filter((file) => {
  const name = path.basename(file);
  return name.endsWith('.json') && name !== 'manifest.json' && !name.endsWith('.manifest.json');
})) {
  const payload = JSON.parse(await readFile(jsonPath, 'utf8'));
  if (!Array.isArray(payload)) continue;
  const excludedRows = payload.filter((row) => isExcludedPerson(exclusions, row));
  if (excludedRows.length === 0) continue;
  const filtered = payload.filter((row) => !isExcludedPerson(exclusions, row));
  await writeFile(jsonPath, `${JSON.stringify(filtered, null, 2)}\n`, 'utf8');
  const csvPath = `${jsonPath.slice(0, -'.json'.length)}.csv`;
  try {
    await readFile(csvPath, 'utf8');
    const columns = Object.keys(filtered[0] ?? payload[0] ?? {});
    const csv = [
      columns.join(','),
      ...filtered.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
    ].join('\r\n');
    await writeFile(csvPath, `\uFEFF${csv}\r\n`, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const excludedNames = [...new Set(excludedRows.map((row) => row.full_name ?? row.fullName ?? row.name))];
  await updateManifest(jsonPath, payload, filtered, excludedNames);
  changed.push({ json: jsonPath, before: payload.length, after: filtered.length, excluded: excludedNames });
}

for (const rawPath of (await filesRecursively(exportsRoot)).filter((file) => path.basename(file) === 'raw-leads.jsonl')) {
  const lines = (await readFile(rawPath, 'utf8')).split(/\r?\n/).filter(Boolean);
  let tagged = 0;
  const rewritten = lines.map((line) => {
    const item = JSON.parse(line);
    if (!isExcludedPerson(exclusions, item.element ?? item)) return JSON.stringify(item);
    tagged += 1;
    return JSON.stringify({ ...item, excluded: true, exclusion_reason: 'Permanent user-requested exclusion.' });
  });
  if (tagged > 0) await writeFile(rawPath, `${rewritten.join('\n')}\n`, 'utf8');
}

process.stdout.write(`${JSON.stringify({ status: 'complete', changed })}\n`);
