import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the Sales Navigator export directory.');
const audience = process.argv[3] ?? 'second-degree';
if (!['second-degree', 'third-plus', 'not-pending'].includes(audience)) throw new Error('Audience must be second-degree, third-plus, or not-pending.');

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function short(value, maximum) {
  const text = clean(value);
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1).trimEnd()}…`;
}

const candidates = JSON.parse(await readFile(path.join(outputDirectory, 'candidates.json'), 'utf8'))
  .filter((row) => audience === 'second-degree'
    ? Number(row.connection_degree) === 2
    : audience === 'third-plus'
      ? [3, -1].includes(Number(row.connection_degree))
      : row.pending_invitation !== true);

const templates = [
  (row, first) => `Hi ${first}, I came across your profile while exploring Forward Deployed Engineering in Bavaria. Your work at ${short(row.current_company, 45)} caught my attention. I'd be glad to connect and exchange perspectives. Best, Liubov`,
  (row, first) => `Hello ${first}, I noticed your FDE experience at ${short(row.current_company, 50)} and would be happy to connect. I'm interested in exchanging perspectives on customer-facing engineering work. Best, Liubov`,
  (row, first) => `Hi ${first}, your work as ${short(row.current_position, 55)} stood out to me while I was researching FDE professionals in Bavaria. I'd be glad to connect and stay in touch. Best, Liubov`,
  (row, first) => `Hello ${first}, I found your profile through my research into Forward Deployed Engineering. Your experience at ${short(row.current_company, 50)} looks very interesting. I'd be pleased to connect. Best, Liubov`,
  (row, first) => `Hi ${first}, I'm expanding my professional network around Forward Deployed Engineering in Bavaria. Your role at ${short(row.current_company, 50)} caught my eye, and I'd be happy to connect. Best, Liubov`,
  (row, first) => `Hello ${first}, I came across your profile while learning more about the FDE community in Bavaria. I'd be glad to connect and exchange professional perspectives. Best regards, Liubov`,
];

const drafts = candidates.map((row, index) => {
  const first = clean(row.first_name).split(/\s+/)[0] || clean(row.full_name).split(/\s+/)[0] || 'there';
  const message = templates[index % templates.length](row, first);
  if (message.length > 300) throw new Error(`Connection note exceeds 300 characters for ${row.full_name}.`);
  return {
    full_name: clean(row.full_name),
    first_name: clean(row.first_name),
    current_position: clean(row.current_position),
    current_company: clean(row.current_company),
    location: clean(row.location),
    connection_degree: row.connection_degree,
    channel: 'free_connection_request_with_note',
    message,
    message_length: message.length,
    sales_navigator_lead_id: clean(row.sales_navigator_lead_id),
    sales_navigator_url: clean(row.sales_navigator_url),
    status: 'draft_only_not_sent',
  };
});

const columns = Object.keys(drafts[0] ?? {});
const csv = [
  columns.join(','),
  ...drafts.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
].join('\r\n');
const summary = {
  audience,
  eligible_profiles: drafts.length,
  maximum_message_length: Math.max(...drafts.map((draft) => draft.message_length), 0),
  sent: 0,
  generated_at_utc: new Date().toISOString(),
};

const stem = audience === 'second-degree'
  ? 'connection-drafts-second-degree'
  : audience === 'third-plus'
    ? 'connection-drafts-third-plus'
    : 'connection-drafts-not-pending';
await writeFile(path.join(outputDirectory, `${stem}.csv`), `\uFEFF${csv}\r\n`, 'utf8');
await writeFile(path.join(outputDirectory, `${stem}.json`), `${JSON.stringify(drafts, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDirectory, `${stem}-summary.json`), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(summary)}\n`);
