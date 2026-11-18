import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const outputDirectory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the Sales Navigator export directory.');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const exclusions = await loadSalesNavExclusions();
const dataRoot = path.resolve('data/linkedin_web_state/liubov-lukina');
const withdrawalJournal = path.join(dataRoot, 'withdrawn-invitations-two-weeks-2026-08-09.jsonl');
const knownNames = new Map(Object.entries({
  alexander: 'Александр', aleksandr: 'Александр', alexey: 'Алексей', aleksei: 'Алексей',
  andrei: 'Андрей', andrii: 'Андрей', anna: 'Анна', artem: 'Артём', artsiom: 'Артём',
  dmitry: 'Дмитрий', dmitrii: 'Дмитрий', elena: 'Елена', evgeniy: 'Евгений', evgenii: 'Евгений',
  irina: 'Ирина', ivan: 'Иван', kirill: 'Кирилл', konstantin: 'Константин', marina: 'Марина',
  maria: 'Мария', mariia: 'Мария', natalia: 'Наталья', nataliia: 'Наталья', natalya: 'Наталья',
  oleg: 'Олег', pavel: 'Павел', sergey: 'Сергей', sergei: 'Сергей', serhii: 'Сергей',
  tatiana: 'Татьяна', tatsiana: 'Татьяна', vladimir: 'Владимир', vladislav: 'Владислав',
  viktor: 'Виктор', yulia: 'Юлия', julia: 'Юлия', yan: 'Ян', yaroslav: 'Ярослав',
}));
function firstName(row) {
  const raw = clean(row.first_name).split(/\s+/)[0] || clean(row.full_name).split(/\s+/)[0] || 'коллега';
  return /\p{Script=Cyrillic}/u.test(raw) ? raw : (knownNames.get(raw.toLowerCase()) ?? raw);
}
let withdrawn = new Set();
try {
  withdrawn = new Set((await readFile(withdrawalJournal, 'utf8')).split(/\r?\n/).filter(Boolean)
    .map(JSON.parse).filter((row) => row.status === 'withdrawn').map((row) => clean(row.name).toLowerCase()));
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const all = JSON.parse(await readFile(path.join(outputDirectory, 'candidates.json'), 'utf8'));
const candidates = all.filter((row) => row.pending_invitation !== true
  && !withdrawn.has(clean(row.full_name).toLowerCase())
  && !exclusions.names.has(clean(row.full_name).toLowerCase()));
const templates = [
  (first) => `Здравствуйте, ${first}! Ничего не продаю — интересуюсь профессионалами страховой отрасли, особенно автострахованием и работой с лизинговыми компаниями. Буду рада познакомиться и поддерживать профессиональный контакт! Любовь`,
  (first) => `${first}, добрый день! Я не с предложением услуг. Расширяю круг профессиональных контактов в страховой сфере, в том числе вокруг автострахования и лизинга. Буду рада добавить вас в контакты! Любовь`,
  (first) => `Здравствуйте, ${first}! Интересуюсь страховым рынком, особенно решениями для автомобилей, автопарков и лизинговых компаний. Ничего не продаю — буду рада профессиональному знакомству. Любовь`,
  (first) => `${first}, здравствуйте! Хочу познакомиться с профессионалами страховой отрасли и лучше понять направления автострахования и взаимодействия с лизингом. Буду рада знакомству и профессиональному общению! Любовь`,
  (first) => `Добрый день, ${first}! Никаких продаж: просто ищу новые профессиональные контакты в страховой сфере, особенно связанные с автострахованием и лизинговыми компаниями. Буду рада познакомиться! Любовь`,
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
await writeFile(path.join(outputDirectory, 'connection-drafts-russian-insurance.json'), `${JSON.stringify(drafts, null, 2)}\n`);
const summary = { selection_total: all.length, eligible_profiles: drafts.length, exclusions: all.length - drafts.length, maximum_message_length: Math.max(0, ...drafts.map((draft) => draft.message_length)), generated_at_utc: new Date().toISOString() };
await writeFile(path.join(outputDirectory, 'connection-drafts-russian-insurance-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
