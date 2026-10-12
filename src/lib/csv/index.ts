import Papa from 'papaparse';
import { contactFromProperties, escapeText } from '../vcard';
import type { ImportResult } from '../../types/contact';
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function parseCsv(text: string): ImportResult {
  if (!text.trim()) throw new Error('This file is empty. Choose a contacts backup.');
  const result = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length)
    throw new Error(
      'The CSV has inconsistent columns or broken quotes. Export it again from your Contacts app.',
    );
  const headers = result.meta.fields || [];
  if (new Set(headers.map(norm)).size !== headers.length)
    throw new Error('CSV column names must be unique.');
  if (
    !headers.some((h) =>
      /^(name|fullname|firstname|givenname|phone\d*(value)?|mobile|email\d*(value)?)$/.test(
        norm(h),
      ),
    )
  )
    throw new Error(
      'Contact columns were not recognized. Use a Google Contacts CSV with Name, Phone or Email columns.',
    );
  const warnings = new Set<string>();
  const contacts = result.data.flatMap((row, index) => {
    const get = (...keys: string[]) =>
      headers
        .map((h) => ({ h, n: norm(h) }))
        .filter((v) => keys.includes(v.n))
        .map((v) => row[v.h]?.trim())
        .find(Boolean) || '';
    const properties: string[] = [];
    const handled = new Set<string>();
    const first = get('firstname', 'givenname');
    const last = get('lastname', 'familyname');
    const middle = get('middlename', 'additionalname');
    const name =
      get('name', 'fullname', 'fileas') || [first, middle, last].filter(Boolean).join(' ');
    const add = (key: string, value: string) => {
      if (value) properties.push(`${key}:${escapeText(value)}`);
    };
    if (name) add('FN', name);
    if (first || last || middle)
      properties.push(
        `N:${[last, first, middle, get('nameprefix'), get('namesuffix')].map(escapeText).join(';')}`,
      );
    const company = get('organization1name', 'organizationname', 'company', 'organization');
    add('ORG', company);
    add('TITLE', get('organization1title', 'jobtitle', 'title'));
    add('NOTE', get('notes', 'note'));
    add('BDAY', get('birthday', 'birthdate'));
    add('CATEGORIES', get('groupmembership', 'labels', 'groups'));
    for (const h of headers) {
      const n = norm(h);
      const value = row[h]?.trim();
      if (!value) continue;
      if (
        /(phone|email|website|address)\d*(value|formatted)?$/.test(n) ||
        ['phone', 'mobile', 'email', 'website', 'address'].includes(n)
      ) {
        const kind = /phone|mobile/.test(n)
          ? 'TEL'
          : /email/.test(n)
            ? 'EMAIL'
            : /website/.test(n)
              ? 'URL'
              : 'ADR';
        const stem = n.replace(/value|formatted/g, '');
        const labelHeader = headers.find(
          (k) => norm(k) === `${stem}label` || norm(k) === `${stem}type`,
        );
        const label = labelHeader ? row[labelHeader]?.trim() : '';
        const group = `item${properties.length + 1}`;
        for (const part of value.split(/\s+:::?\s+/)) {
          if (kind === 'ADR') properties.push(`${group}.ADR:;;${escapeText(part)};;;;`);
          else add(`${group}.${kind}`, part);
        }
        if (label) add(`${group}.X-ABLabel`, label);
        handled.add(n);
        if (labelHeader) handled.add(norm(labelHeader));
      }
    }
    if (!properties.length) {
      warnings.add('Rows without usable contact fields were skipped.');
      return [];
    }
    const contact = contactFromProperties(properties, `contact-${index}`);
    if (!name) contact.properties.unshift(`FN:${escapeText(contact.name)}`);
    const mapped =
      /^(name|fullname|fileas|firstname|givenname|lastname|familyname|middlename|additionalname|nameprefix|namesuffix|company|organization|organizationname|organization1name|organization1title|jobtitle|title|notes|note|birthday|birthdate|groupmembership|labels|groups)$/;
    for (const h of headers)
      if (row[h]?.trim() && !mapped.test(norm(h)) && !handled.has(norm(h))) {
        // Store unmapped CSV columns as private extension properties instead of dropping them.
        add(`X-CONTACTS-CSV-${norm(h).toUpperCase()}`, row[h]);
        warnings.add(
          'Additional CSV columns are preserved as extension fields; some phone apps may not display them.',
        );
      }
    return [contact];
  });
  if (!contacts.length) throw new Error('No usable contact rows found.');
  return { contacts, warnings: [...warnings] };
}
