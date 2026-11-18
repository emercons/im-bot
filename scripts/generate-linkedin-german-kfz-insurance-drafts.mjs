import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const outputDirectory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the Sales Navigator export directory.');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const exclusions = await loadSalesNavExclusions();
const all = JSON.parse(await readFile(path.join(outputDirectory, 'candidates.json'), 'utf8'));
const candidates = all.filter((row) => row.pending_invitation !== true && !exclusions.names.has(clean(row.full_name).toLowerCase()));
const firstName = (row) => clean(row.first_name).split(/\s+/)[0] || clean(row.full_name).split(/\s+/)[0] || 'Guten Tag';
const templates = [
  (first) => `Hallo ${first}, ich verkaufe nichts. Ich interessiere mich für Fachleute aus der Versicherungsbranche, besonders für Kfz-Versicherung und die Zusammenarbeit mit Leasinggesellschaften. Ich würde mich über eine Vernetzung freuen. Viele Grüße, Liubov`,
  (first) => `Guten Tag ${first}, ich melde mich nicht mit einem Angebot. Ich möchte mein berufliches Netzwerk im Bereich Kfz-Versicherung und Leasing erweitern und würde mich über eine Vernetzung freuen. Viele Grüße, Liubov`,
  (first) => `Hallo ${first}, Ihr beruflicher Hintergrund im Versicherungsumfeld ist für mich interessant. Ich beschäftige mich besonders mit Kfz-Versicherung und Lösungen für Leasinggesellschaften. Gern würde ich mich vernetzen. Viele Grüße, Liubov`,
  (first) => `Guten Tag ${first}, ich suche den fachlichen Austausch mit Menschen aus der Versicherungsbranche, insbesondere rund um Kfz, Flotten und Leasing. Kein Verkauf — ich würde mich einfach über eine Vernetzung freuen. Viele Grüße, Liubov`,
  (first) => `Hallo ${first}, ich interessiere mich für die Schnittstelle von Kfz-Versicherung und Leasing. Da Ihr Profil dazu passt, würde ich mich gern mit Ihnen vernetzen — ganz ohne Verkaufsabsicht. Viele Grüße, Liubov`,
];
const drafts = candidates.map((row, index) => {
  const message = templates[index % templates.length](firstName(row));
  if (message.length > 300) throw new Error(`Message exceeds 300 characters for ${row.full_name}`);
  return {
    full_name: clean(row.full_name), first_name: firstName(row), source_first_name: clean(row.first_name),
    current_position: clean(row.current_position), current_company: clean(row.current_company), location: clean(row.location),
    connection_degree: row.connection_degree, channel: 'free_connection_request_with_note', message, message_length: message.length,
    sales_navigator_lead_id: clean(row.sales_navigator_lead_id), sales_navigator_url: clean(row.sales_navigator_url), status: 'draft_only_not_sent',
  };
});
await writeFile(path.join(outputDirectory, 'connection-drafts-german-kfz-insurance.json'), `${JSON.stringify(drafts, null, 2)}\n`);
const summary = { selection_total: all.length, eligible_profiles: drafts.length, exclusions: all.length - drafts.length, maximum_message_length: Math.max(0, ...drafts.map((draft) => draft.message_length)), generated_at_utc: new Date().toISOString() };
await writeFile(path.join(outputDirectory, 'connection-drafts-german-kfz-insurance-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
