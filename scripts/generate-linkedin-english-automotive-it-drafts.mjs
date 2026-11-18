import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const outputDirectory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the Sales Navigator export directory.');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const exclusions = await loadSalesNavExclusions();
const candidates = JSON.parse(await readFile(path.join(outputDirectory, 'candidates.json'), 'utf8'));
const templates = [
  (first) => `Hi ${first}, I’m expanding my professional network with people working at the intersection of IT and the automotive industry. Your work at CARFAX Europe caught my attention — I’d be glad to connect. Best, Liubov`,
  (first) => `Hello ${first}, I’m looking to connect with professionals at the intersection of IT and the automotive industry. I came across your profile at CARFAX Europe and would be happy to connect. Best regards, Liubov`,
  (first) => `Hi ${first}, I’m building new professional connections around IT and automotive. Your profile at CARFAX Europe stood out to me, so I’d be pleased to connect. Best, Liubov`,
  (first) => `Hello ${first}, I’m interested in meeting people who work where IT and the automotive industry meet. I’d be happy to add you to my professional network. Best regards, Liubov`,
];
const drafts = candidates
  .filter((row) => row.pending_invitation !== true && !exclusions.names.has(clean(row.full_name).toLowerCase()))
  .map((row, index) => {
    const firstName = clean(row.first_name).split(/\s+/)[0] || clean(row.full_name).split(/\s+/)[0] || 'there';
    const message = templates[index % templates.length](firstName);
    if (message.length > 300) throw new Error(`Message exceeds 300 characters for ${row.full_name}`);
    return {
      full_name: clean(row.full_name), first_name: firstName, current_position: clean(row.current_position),
      current_company: clean(row.current_company), location: clean(row.location), connection_degree: row.connection_degree,
      channel: 'free_connection_request_with_note', message, message_length: message.length,
      sales_navigator_lead_id: clean(row.sales_navigator_lead_id), sales_navigator_url: clean(row.sales_navigator_url), status: 'draft_only_not_sent',
    };
  });
await writeFile(path.join(outputDirectory, 'connection-drafts-english-automotive-it.json'), `${JSON.stringify(drafts, null, 2)}\n`);
const summary = { selection_total: candidates.length, eligible_profiles: drafts.length, maximum_message_length: Math.max(0, ...drafts.map((draft) => draft.message_length)), generated_at_utc: new Date().toISOString() };
await writeFile(path.join(outputDirectory, 'connection-drafts-english-automotive-it-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
