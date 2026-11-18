import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const outputDirectory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the Sales Navigator export directory.');
const dataRoot = path.resolve('data/linkedin_web_state/liubov-lukina');
const withdrawalJournal = path.join(dataRoot, 'withdrawn-invitations-two-weeks-2026-08-09.jsonl');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const short = (value, maximum) => clean(value).slice(0, maximum).trim();
const exclusions = await loadSalesNavExclusions();

const manifest = JSON.parse(await readFile(path.join(outputDirectory, 'manifest.json'), 'utf8'));
let decodedSourceUrl = String(manifest.source_url ?? '');
for (let i = 0; i < 3; i += 1) {
  try {
    const decoded = decodeURIComponent(decodedSourceUrl);
    if (decoded === decodedSourceUrl) break;
    decodedSourceUrl = decoded;
  } catch {
    break;
  }
}
const hasRussianProfileLanguageFilter = /type:PROFILE_LANGUAGE[\s\S]*?id:ru\b/i.test(decodedSourceUrl);
if (!hasRussianProfileLanguageFilter && process.env.RUSSIAN_PROFILE_LANGUAGE_CONFIRMED !== '1') {
  throw new Error('Russian outreach is allowed only for a selection with PROFILE_LANGUAGE=ru. For a saved search whose URL hides filters, set RUSSIAN_PROFILE_LANGUAGE_CONFIRMED=1 only after the user explicitly confirms the Russian-language filter for this selection.');
}

const cyrillicFirstNames = new Map(Object.entries({
  dmitrii: 'Дмитрий', dmitry: 'Дмитрий', dmytro: 'Дмитрий', pavel: 'Павел',
  maksim: 'Максим', maksym: 'Максим', arseni: 'Арсений', artsiom: 'Артём',
  tatsiana: 'Татьяна', tatiana: 'Татьяна', tetiana: 'Татьяна', anna: 'Анна',
  konstantin: 'Константин', kostiantyn: 'Константин', nadezhda: 'Надежда',
  ekaterina: 'Екатерина', kateryna: 'Катерина', nina: 'Нина', vladislav: 'Владислав',
  evgeniia: 'Евгения', evgenii: 'Евгений', evgeniy: 'Евгений', yevhen: 'Евгений',
  vasily: 'Василий', vladimir: 'Владимир', volodymyr: 'Владимир', karyna: 'Карина',
  oleg: 'Олег', oleh: 'Олег', sergei: 'Сергей', sergey: 'Сергей', serhii: 'Сергей',
  ivan: 'Иван', yuna: 'Юна', kyrylo: 'Кирилл', kirill: 'Кирилл',
  krystyna: 'Кристина', khrystsina: 'Кристина', kristina: 'Кристина', timur: 'Тимур',
  alexander: 'Александр', aleksandr: 'Александр', yan: 'Ян', polina: 'Полина',
  gulden: 'Гульден', hovsep: 'Овсеп', gennadii: 'Геннадий', inga: 'Инга',
  daria: 'Дарья', darya: 'Дарья', aleksei: 'Алексей', alexey: 'Алексей',
  andrei: 'Андрей', andrii: 'Андрей', valentina: 'Валентина', leonid: 'Леонид',
  anastasiia: 'Анастасия', gozel: 'Гозель', taras: 'Тарас', marina: 'Марина',
  viktor: 'Виктор', maria: 'Мария', mariia: 'Мария', vanessa: 'Ванесса',
  oksana: 'Оксана', vadym: 'Вадим', vadim: 'Вадим', elena: 'Елена', olena: 'Елена',
  nataliia: 'Наталья', natalya: 'Наталья', bohdan: 'Богдан', vyacheslav: 'Вячеслав',
  artemy: 'Артемий', artem: 'Артём', nino: 'Нино', irina: 'Ирина', deniss: 'Денис',
  marianna: 'Марианна', jackson: 'Джексон', prokhor: 'Прохор', danil: 'Данил',
  stan: 'Стэн', david: 'Давид', mykhailo: 'Михаил', valeriy: 'Валерий', julia: 'Юлия',
}));

function localizedFirstName(row) {
  if (clean(row.full_name).toLowerCase() === 'kumaev vasily') return 'Василий';
  const raw = clean(row.first_name).split(/\s+/)[0] || clean(row.full_name).split(/\s+/)[0] || 'коллега';
  if (/\p{Script=Cyrillic}/u.test(raw)) return raw;
  return cyrillicFirstNames.get(raw.toLowerCase()) ?? raw;
}

let withdrawnNames = new Set();
try {
  withdrawnNames = new Set((await readFile(withdrawalJournal, 'utf8')).split(/\r?\n/).filter(Boolean)
    .map(JSON.parse).filter((row) => row.status === 'withdrawn').map((row) => clean(row.name).toLowerCase()));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const all = JSON.parse(await readFile(path.join(outputDirectory, 'candidates.json'), 'utf8'));
const candidates = all.filter((row) => row.pending_invitation !== true
  && !withdrawnNames.has(clean(row.full_name).toLowerCase())
  && !exclusions.names.has(clean(row.full_name).toLowerCase()));

const templates = [
  (row, first) => `Здравствуйте, ${first}! Ничего не продаю — просто хочу расширить круг знакомств среди русскоязычных IT-специалистов в Мюнхене. Буду рада добавить вас в контакты! Любовь`,
  (row, first) => `${first}, добрый день! Я не с предложением услуг и ничего не продаю. Ищу новые профессиональные контакты среди русскоязычных айтишников в Мюнхене. Буду рада познакомиться! Любовь`,
  (row, first) => `Здравствуйте, ${first}! Ваш опыт в ${short(row.current_company || 'IT', 45)} привлёк моё внимание. Ничего не продаю, просто знакомлюсь с русскоязычными IT-специалистами в Мюнхене. Буду рада быть на связи! Любовь`,
  (row, first) => `${first}, здравствуйте! Расширяю профессиональный круг общения среди русскоязычных специалистов в IT в Мюнхене. Никаких продаж — просто буду рада познакомиться и оставаться на связи. Любовь`,
  (row, first) => `Добрый день, ${first}! Я ищу новые знакомства с русскоязычными айтишниками в Мюнхене. Сразу уточню: ничего не продаю. Буду рада добавить вас в профессиональную сеть! Любовь`,
];

const drafts = candidates.map((row, index) => {
  const first = localizedFirstName(row);
  const message = templates[index % templates.length](row, first);
  if (message.length > 300) throw new Error(`Message exceeds 300 characters for ${row.full_name}`);
  return {
    full_name: clean(row.full_name), first_name: first, source_first_name: clean(row.first_name),
    current_position: clean(row.current_position), current_company: clean(row.current_company),
    location: clean(row.location), connection_degree: row.connection_degree,
    channel: 'free_connection_request_with_note', message, message_length: message.length,
    sales_navigator_lead_id: clean(row.sales_navigator_lead_id),
    sales_navigator_url: clean(row.sales_navigator_url), status: 'draft_only_not_sent',
  };
});

await writeFile(path.join(outputDirectory, 'connection-drafts-russian-munich.json'), `${JSON.stringify(drafts, null, 2)}\n`);
const summary = {
  selection_total: all.length, excluded_recently_withdrawn: all.length - candidates.length,
  eligible_profiles: drafts.length,
  russian_profile_language_verified: hasRussianProfileLanguageFilter || process.env.RUSSIAN_PROFILE_LANGUAGE_CONFIRMED === '1',
  maximum_message_length: Math.max(0, ...drafts.map((row) => row.message_length)),
  generated_at_utc: new Date().toISOString(),
};
await writeFile(path.join(outputDirectory, 'connection-drafts-russian-munich-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
