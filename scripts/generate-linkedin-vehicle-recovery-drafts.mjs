import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const outputDirectory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the Sales Navigator export directory.');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const exclusions = await loadSalesNavExclusions();
const candidates = JSON.parse(await readFile(path.join(outputDirectory, 'candidates.json'), 'utf8'));

function languageFor(row) {
  const signal = [row.full_name, row.about, row.current_position, row.location].map(clean).join(' ');
  if (/[\u0400-\u04ff]/.test(signal)) return 'ru';
  const location = clean(row.location).toLowerCase();
  if (/(deutschland|berlin|brandenburg)/.test(location)) return 'de';
  if (/(frankreich|paris|tours)/.test(location)) return 'fr';
  if (/(belgien|flämische|antwerpen|gent|brügge|oudenaarde|heist-op-den-berg)/.test(location)) return 'nl';
  return 'en';
}

function messageFor(language, first, index) {
  const variants = {
    ru: [
      `Здравствуйте, ${first}! Устанавливаю профессиональные контакты для проекта по возврату украденных автомобилей обратно в ЕС. Ваш опыт в VCI мне очень интересен — буду рада познакомиться. Любовь`,
      `Здравствуйте, ${first}! Работаю над проектом по возврату украденных автомобилей в ЕС и расширяю круг профильных контактов. Буду рада связаться. Любовь`,
    ],
    de: [
      `Hallo ${first}, ich knüpfe Kontakte für ein Projekt, das gestohlene Fahrzeuge zurück in die EU bringt. Ihre Erfahrung bei der VCI ist für mich sehr interessant — ich würde mich über eine Vernetzung freuen. Viele Grüße, Liubov`,
      `Hallo ${first}, für ein Projekt zur Rückführung gestohlener Fahrzeuge in die EU erweitere ich mein fachliches Netzwerk. Ich würde mich freuen, mich zu vernetzen. Viele Grüße, Liubov`,
    ],
    fr: [
      `Bonjour ${first}, je prends contact dans le cadre d’un projet visant à ramener dans l’UE des véhicules volés. Votre expérience au sein de la VCI m’intéresse beaucoup ; je serais ravie d’échanger. Bien à vous, Liubov`,
      `Bonjour ${first}, je développe un réseau professionnel pour un projet de retour de véhicules volés vers l’UE. Je serais ravie de vous ajouter à mon réseau. Bien cordialement, Liubov`,
    ],
    nl: [
      `Hallo ${first}, ik leg professionele contacten voor een project dat gestolen voertuigen terug naar de EU helpt brengen. Uw ervaring bij de VCI interesseert mij zeer; ik zou graag verbinden. Met vriendelijke groet, Liubov`,
      `Hallo ${first}, voor een project rond de terugkeer van gestolen voertuigen naar de EU breid ik mijn netwerk uit. Ik zou graag met u in contact komen. Met vriendelijke groet, Liubov`,
    ],
    en: [
      `Hi ${first}, I’m building professional contacts for a project focused on returning stolen vehicles to the EU. Your experience with the VCI is particularly relevant, and I’d be glad to connect. Best, Liubov`,
      `Hello ${first}, I’m expanding my professional network for a project helping return stolen vehicles to the EU. I’d be pleased to connect and learn from your VCI experience. Best regards, Liubov`,
    ],
  };
  return variants[language][index % variants[language].length];
}

const drafts = candidates
  .filter((row) => row.pending_invitation !== true && [2, 3].includes(Number(row.connection_degree)))
  .filter((row) => !/(\bpolen\b|\bpoland\b|warszaw|danzig|stettin)/i.test(clean(row.location)))
  .filter((row) => !exclusions.names.has(clean(row.full_name).toLowerCase()))
  .map((row, index) => {
    const firstName = clean(row.first_name).split(/\s+/)[0] || clean(row.full_name).split(/\s+/)[0] || 'there';
    const language = languageFor(row);
    const message = messageFor(language, firstName, index);
    if (message.length > 300) throw new Error(`Message exceeds 300 characters for ${row.full_name}`);
    return { full_name: clean(row.full_name), first_name: firstName, current_position: clean(row.current_position), current_company: clean(row.current_company), location: clean(row.location), connection_degree: row.connection_degree, language, channel: 'free_connection_request_with_note', message, message_length: message.length, sales_navigator_lead_id: clean(row.sales_navigator_lead_id), sales_navigator_url: clean(row.sales_navigator_url), status: 'draft_only_not_sent' };
  });
await writeFile(path.join(outputDirectory, 'connection-drafts-vehicle-recovery.json'), `${JSON.stringify(drafts, null, 2)}\n`);
const summary = { selection_total: candidates.length, eligible_profiles: drafts.length, languages: Object.fromEntries(Object.entries(Object.groupBy(drafts, (draft) => draft.language)).map(([key, value]) => [key, value.length])), maximum_message_length: Math.max(0, ...drafts.map((draft) => draft.message_length)), generated_at_utc: new Date().toISOString() };
await writeFile(path.join(outputDirectory, 'connection-drafts-vehicle-recovery-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
