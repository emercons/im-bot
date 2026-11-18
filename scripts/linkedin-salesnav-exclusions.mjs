import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const exclusionsPath = path.resolve(
  'data',
  'linkedin_web_state',
  'liubov-lukina',
  'salesnav-exclusions.json',
);

export async function loadSalesNavExclusions() {
  const payload = JSON.parse(await readFile(exclusionsPath, 'utf8'));
  const people = Array.isArray(payload.excluded_people) ? payload.excluded_people : [];
  return {
    people,
    names: new Set(people.map((person) => String(person.full_name ?? '').trim().toLocaleLowerCase('en'))),
    leadIds: new Set(people.map((person) => String(person.sales_navigator_lead_id ?? '').trim()).filter(Boolean)),
    memberIds: new Set(people.map((person) => String(person.linkedin_member_id ?? '').trim()).filter(Boolean)),
  };
}

export function isExcludedPerson(exclusions, person) {
  const name = String(person.full_name ?? person.fullName ?? person.name ?? '').trim().toLocaleLowerCase('en');
  const leadId = String(person.sales_navigator_lead_id ?? person.leadId ?? '').trim();
  const memberId = String(person.linkedin_member_id ?? person.memberId ?? '').trim();
  return exclusions.names.has(name)
    || (leadId && exclusions.leadIds.has(leadId))
    || (memberId && exclusions.memberIds.has(memberId));
}
