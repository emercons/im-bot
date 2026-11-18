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
  if (/(deutschland|münchen|bayern|nürnberg|hamburg|fürstenfeldbruck)/.test(location)) return 'de';
  if (/österreich/.test(location)) return 'de';
  if (/(spanien|barcelona|madrid|cordoba|coruña)/.test(location)) return 'es';
  if (/italien/.test(location)) return 'it';
  if (/niederlande|den haag/.test(location)) return 'nl';
  if (/schweden|gamlestaden/.test(location)) return 'sv';
  return 'en';
}

function messageFor(language, first) {
  const messages = {
    ru: `Здравствуйте, ${first}! Расширяю профессиональный круг общения с людьми на стыке ИТ и автомобильной индустрии. Ваш профиль в CARFAX Europe привлёк моё внимание — буду рада познакомиться. Любовь`,
    de: `Hallo ${first}, ich erweitere mein berufliches Netzwerk mit Menschen an der Schnittstelle von IT und Automobilbranche. Ihr Profil bei CARFAX Europe ist mir aufgefallen — ich würde mich über eine Vernetzung freuen. Viele Grüße, Liubov`,
    es: `Hola ${first}, estoy ampliando mi red profesional con personas que trabajan en la intersección entre TI y la industria automotriz. Tu perfil en CARFAX Europe me llamó la atención; me encantaría conectar. Un saludo, Liubov`,
    it: `Ciao ${first}, sto ampliando la mia rete professionale con persone che lavorano all'incrocio tra IT e settore automobilistico. Ho notato il tuo profilo in CARFAX Europe e mi farebbe piacere collegarmi. Un saluto, Liubov`,
    nl: `Hallo ${first}, ik breid mijn professionele netwerk uit met mensen op het snijvlak van IT en de auto-industrie. Je profiel bij CARFAX Europe viel me op; ik zou graag verbinden. Groet, Liubov`,
    sv: `Hej ${first}, jag utökar mitt professionella nätverk med personer i gränslandet mellan IT och fordonsbranschen. Din profil på CARFAX Europe fångade mitt intresse; jag skulle gärna vilja connecta. Hälsningar, Liubov`,
    en: `Hi ${first}, I’m expanding my professional network with people working at the intersection of IT and the automotive industry. Your work at CARFAX Europe caught my attention — I’d be glad to connect. Best, Liubov`,
  };
  return messages[language];
}

const drafts = candidates
  .filter((row) => row.pending_invitation !== true && [2, 3].includes(Number(row.connection_degree)))
  .filter((row) => !/(\bpolen\b|\bpoland\b|warszaw|danzig|stettin)/i.test(clean(row.location)))
  .filter((row) => !exclusions.names.has(clean(row.full_name).toLowerCase()))
  .map((row) => {
    const firstName = clean(row.first_name).split(/\s+/)[0] || clean(row.full_name).split(/\s+/)[0] || 'there';
    const language = languageFor(row);
    const message = messageFor(language, firstName);
    if (message.length > 300) throw new Error(`Message exceeds 300 characters for ${row.full_name}`);
    return {
      full_name: clean(row.full_name), first_name: firstName, current_position: clean(row.current_position),
      current_company: clean(row.current_company), location: clean(row.location), connection_degree: row.connection_degree,
      language, channel: 'free_connection_request_with_note', message, message_length: message.length,
      sales_navigator_lead_id: clean(row.sales_navigator_lead_id), sales_navigator_url: clean(row.sales_navigator_url), status: 'draft_only_not_sent',
    };
  });
await writeFile(path.join(outputDirectory, 'connection-drafts-country-language-automotive-it.json'), `${JSON.stringify(drafts, null, 2)}\n`);
const summary = { selection_total: candidates.length, eligible_profiles: drafts.length, excluded_poland: candidates.filter((row) => /(\bpolen\b|\bpoland\b|warszaw|danzig|stettin)/i.test(clean(row.location))).length, languages: Object.fromEntries(Object.entries(Object.groupBy(drafts, (draft) => draft.language)).map(([key, value]) => [key, value.length])), generated_at_utc: new Date().toISOString() };
await writeFile(path.join(outputDirectory, 'connection-drafts-country-language-automotive-it-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
