import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSalesNavExclusions } from './linkedin-salesnav-exclusions.mjs';

const outputDirectory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the Sales Navigator export directory.');
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const exclusions = await loadSalesNavExclusions();
const selectionExclusions = new Set((process.env.SELECTION_EXCLUDED_NAMES ?? '').split('|').map((name) => clean(name).toLocaleLowerCase('en')).filter(Boolean));
const candidates = JSON.parse(await readFile(path.join(outputDirectory, 'candidates.json'), 'utf8'));

function languageFor(row) {
  const signal = [row.full_name, row.about, row.current_position, row.location].map(clean).join(' ');
  if (/[\u0400-\u04ff]/.test(signal)) return 'ru';
  const location = clean(row.location).toLowerCase();
  if (/(deutschland|frankfurt)/.test(location)) return 'de';
  if (/(frankreich|marseille|suresnes|genf)/.test(location)) return 'fr';
  if (/(belgien|flämische|gent|antwerpen|beringen)/.test(location)) return 'nl';
  if (/(niederlande|renkum|beilen|breda|hoofddorp|zoetermeer)/.test(location)) return 'nl';
  if (/(spanien|logroño|castellón)/.test(location)) return 'es';
  if (/norwegen/.test(location)) return 'no';
  if (/(dänemark|kopenhagen|mitteljütland)/.test(location)) return 'da';
  if (/(schweden|malmö)/.test(location)) return 'sv';
  if (/finnland/.test(location)) return 'fi';
  if (/(tschechien|lázně)/.test(location)) return 'cs';
  return 'en';
}

function messageFor(language, first, index) {
  const variants = {
    ru: [`Здравствуйте, ${first}! Устанавливаю профессиональные контакты для проекта по возврату украденных автомобилей обратно в ЕС. Буду рада познакомиться. Любовь`, `Здравствуйте, ${first}! Работаю над проектом по возврату украденных автомобилей в ЕС и расширяю круг профильных контактов. Буду рада связаться. Любовь`],
    de: [`Hallo ${first}, ich knüpfe Kontakte für ein Projekt, das gestohlene Fahrzeuge zurück in die EU bringt. Ihr beruflicher Hintergrund ist für mich sehr interessant — ich würde mich über eine Vernetzung freuen. Viele Grüße, Liubov`, `Hallo ${first}, für ein Projekt zur Rückführung gestohlener Fahrzeuge in die EU erweitere ich mein fachliches Netzwerk. Ich würde mich freuen, mich zu vernetzen. Viele Grüße, Liubov`],
    fr: [`Bonjour ${first}, je prends contact dans le cadre d’un projet visant à ramener dans l’UE des véhicules volés. Votre expérience m’intéresse beaucoup ; je serais ravie d’échanger. Bien à vous, Liubov`, `Bonjour ${first}, je développe un réseau professionnel pour un projet de retour de véhicules volés vers l’UE. Je serais ravie de vous ajouter à mon réseau. Bien cordialement, Liubov`],
    nl: [`Hallo ${first}, ik leg professionele contacten voor een project dat gestolen voertuigen terug naar de EU helpt brengen. Uw ervaring interesseert mij zeer; ik zou graag verbinden. Met vriendelijke groet, Liubov`, `Hallo ${first}, voor een project rond de terugkeer van gestolen voertuigen naar de EU breid ik mijn netwerk uit. Ik zou graag met u in contact komen. Met vriendelijke groet, Liubov`],
    es: [`Hola ${first}, estoy creando contactos profesionales para un proyecto centrado en devolver vehículos robados a la UE. Tu experiencia me parece muy relevante; me encantaría conectar. Un saludo, Liubov`, `Hola ${first}, amplío mi red profesional para un proyecto de retorno de vehículos robados a la UE. Estaré encantada de conectar. Saludos, Liubov`],
    no: [`Hei ${first}, jeg bygger faglige kontakter for et prosjekt som skal bidra til å returnere stjålne kjøretøy til EU. Din erfaring er svært interessant for meg; jeg vil gjerne knytte kontakt. Vennlig hilsen, Liubov`, `Hei ${first}, jeg utvider mitt faglige nettverk for et prosjekt om retur av stjålne kjøretøy til EU. Jeg håper vi kan knytte kontakt. Vennlig hilsen, Liubov`],
    da: [`Hej ${first}, jeg opbygger faglige kontakter til et projekt, der hjælper med at bringe stjålne køretøjer tilbage til EU. Din erfaring er meget relevant; jeg vil gerne connecte. Venlig hilsen, Liubov`, `Hej ${first}, jeg udvider mit faglige netværk for et projekt om tilbageførsel af stjålne køretøjer til EU. Jeg vil gerne forbinde. Venlig hilsen, Liubov`],
    sv: [`Hej ${first}, jag bygger professionella kontakter för ett projekt som hjälper till att återföra stulna fordon till EU. Din erfarenhet är mycket relevant; jag skulle gärna vilja connecta. Hälsningar, Liubov`, `Hej ${first}, jag utökar mitt nätverk för ett projekt om återföring av stulna fordon till EU. Jag skulle gärna vilja få kontakt. Hälsningar, Liubov`],
    fi: [`Hei ${first}, rakennan ammatillisia kontakteja hankkeelle, joka auttaa palauttamaan varastettuja ajoneuvoja EU:hun. Kokemuksesi on minulle erittäin kiinnostava; yhdistytään mielelläni. Ystävällisin terveisin, Liubov`, `Hei ${first}, laajennan ammatillista verkostoani hankkeeseen, joka koskee varastettujen ajoneuvojen palauttamista EU:hun. Olisi ilo verkostoitua. Ystävällisin terveisin, Liubov`],
    cs: [`Dobrý den, ${first}, navazuji profesní kontakty pro projekt zaměřený na návrat odcizených vozidel do EU. Vaše zkušenosti jsou pro mě velmi zajímavé; ráda se propojím. S pozdravem, Liubov`, `Dobrý den, ${first}, rozšiřuji profesní síť pro projekt návratu odcizených vozidel do EU. Ráda se s vámi spojím. S pozdravem, Liubov`],
    en: [`Hi ${first}, I’m building professional contacts for a project focused on returning stolen vehicles to the EU. Your background is particularly relevant, and I’d be glad to connect. Best, Liubov`, `Hello ${first}, I’m expanding my professional network for a project helping return stolen vehicles to the EU. I’d be pleased to connect and learn from your experience. Best regards, Liubov`],
  };
  return variants[language][index % variants[language].length];
}

const drafts = candidates
  .filter((row) => row.pending_invitation !== true && [2, 3].includes(Number(row.connection_degree)))
  .filter((row) => !/(\bpolen\b|\bpoland\b|warszaw|danzig|stettin)/i.test(clean(row.location)))
  .filter((row) => !exclusions.names.has(clean(row.full_name).toLowerCase()))
  .filter((row) => !selectionExclusions.has(clean(row.full_name).toLocaleLowerCase('en')))
  .map((row, index) => {
    const firstName = clean(row.first_name).split(/\s+/)[0] || clean(row.full_name).split(/\s+/)[0] || 'there';
    const language = languageFor(row);
    const message = messageFor(language, firstName, index);
    if (message.length > 300) throw new Error(`Message exceeds 300 characters for ${row.full_name}`);
    return { full_name: clean(row.full_name), first_name: firstName, current_position: clean(row.current_position), current_company: clean(row.current_company), location: clean(row.location), connection_degree: row.connection_degree, language, channel: 'free_connection_request_with_note', message, message_length: message.length, sales_navigator_lead_id: clean(row.sales_navigator_lead_id), sales_navigator_url: clean(row.sales_navigator_url), status: 'draft_only_not_sent' };
  });
await writeFile(path.join(outputDirectory, 'connection-drafts-vehicle-recovery-europe.json'), `${JSON.stringify(drafts, null, 2)}\n`);
const summary = { selection_total: candidates.length, eligible_profiles: drafts.length, languages: Object.fromEntries(Object.entries(Object.groupBy(drafts, (draft) => draft.language)).map(([key, value]) => [key, value.length])), maximum_message_length: Math.max(0, ...drafts.map((draft) => draft.message_length)), generated_at_utc: new Date().toISOString() };
await writeFile(path.join(outputDirectory, 'connection-drafts-vehicle-recovery-europe-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
