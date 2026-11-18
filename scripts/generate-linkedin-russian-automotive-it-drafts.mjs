import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const outputDirectory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the Sales Navigator export directory.');
const limit = Number(process.argv[3] ?? 2);
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const exclusions = await loadSalesNavExclusions();
const names = new Map([['nikita', 'Никита'], ['anastasia', 'Анастасия']]);
const candidates = JSON.parse(await readFile(path.join(outputDirectory, 'candidates.json'), 'utf8'));
const drafts = candidates
  .filter((row) => row.pending_invitation !== true && ['2', '3'].includes(String(row.connection_degree))
    && !exclusions.names.has(clean(row.full_name).toLowerCase()))
  .slice(0, limit)
  .map((row) => {
    const sourceFirst = clean(row.first_name).split(/\s+/)[0];
    const firstName = /\p{Script=Cyrillic}/u.test(sourceFirst) ? sourceFirst : (names.get(sourceFirst.toLowerCase()) ?? sourceFirst);
    const message = `Здравствуйте, ${firstName}! Ищу IT-профессионалов из автомобильной сферы, чтобы расширить профессиональный круг общения. Ваш профиль в mobile.de привлёк внимание — буду рада познакомиться! Любовь`;
    if (message.length > 300) throw new Error(`Message exceeds 300 characters for ${row.full_name}`);
    return {
      full_name: clean(row.full_name), first_name: firstName, current_position: clean(row.current_position),
      current_company: clean(row.current_company), location: clean(row.location), connection_degree: row.connection_degree,
      channel: 'free_connection_request_with_note', message, message_length: message.length,
      sales_navigator_lead_id: clean(row.sales_navigator_lead_id), sales_navigator_url: clean(row.sales_navigator_url), status: 'draft_only_not_sent',
    };
  });
await writeFile(path.join(outputDirectory, 'connection-drafts-russian-automotive-it.json'), `${JSON.stringify(drafts, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ selection_total: candidates.length, eligible_free: drafts.length, maximum_message_length: Math.max(0, ...drafts.map((draft) => draft.message_length)) })}\n`);
