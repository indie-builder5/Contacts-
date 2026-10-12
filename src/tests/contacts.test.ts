import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseVcard, exportVcard, foldLine } from '../lib/vcard';
import { parseCsv } from '../lib/csv';
import { duplicateCandidates, filterContacts, updateSelection } from '../features/contacts/logic';
const sample = readFileSync('public/sample-contacts.vcf', 'utf8');
const card = (properties: string, version = '3.0') =>
  `BEGIN:VCARD\nVERSION:${version}\n${properties}\nEND:VCARD`;
describe('vCard import and export', () => {
  it('respects escaped structured-name separators and indented quoted-printable breaks', () => {
    const contacts = parseVcard(
      card(
        'N:Family\\;Name;Given;;;\nORG:Studio\\;Partners;Design\nNOTE;ENCODING=QUOTED-PRINTABLE:Hello=\n World',
      ),
    ).contacts;
    expect(contacts[0].name).toBe('Given Family;Name');
    expect(contacts[0].company).toBe('Studio;Partners · Design');
    expect(contacts[0].properties).toContain('NOTE;ENCODING=QUOTED-PRINTABLE:HelloWorld');
  });
  it('reads multiple records, Unicode, multiple numbers and custom labels', () => {
    const { contacts } = parseVcard(sample);
    expect(contacts).toHaveLength(8);
    expect(contacts[1].name).toBe('अनन्या शर्मा');
    expect(contacts[1].phones).toHaveLength(2);
    expect(contacts[1].phones[0].label).toBe('Personal');
  });
  it('handles folded lines, escapes, and UTF-8 quoted printable', () => {
    const { contacts } = parseVcard(
      card(
        'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=E0=A4=85=\n=E0=A4=A8\nNOTE:Hello\\, friend\\nNext\n line\nEMAIL:a@example.com\nEMAIL:b@example.com',
        '2.1',
      ),
    );
    expect(contacts[0].name).toBe('अन');
    expect(contacts[0].emails).toHaveLength(2);
    expect(contacts[0].properties).toContain('NOTE:Hello\\, friend\\nNextline');
  });
  it('retains unknown properties, photos, postal addresses, categories and labels', () => {
    const original = card(
      'FN:Test\nN:Test;;;;\nitem1.TEL:1234567\nitem1.X-ABLabel:School\nPHOTO;ENCODING=b:YWJj\nADR;TYPE=HOME:;;A\\; B;Delhi;;;India\nBDAY:1990-01-01\nCATEGORIES:Friends\nX-UNKNOWN:Keep me',
    );
    const { contacts } = parseVcard(original);
    const output = exportVcard(contacts, new Set([contacts[0].id]));
    expect(output).toBe(original.replace(/\n/g, '\r\n') + '\r\n');
    expect(parseVcard(output).contacts[0].properties).toEqual(contacts[0].properties);
  });
  it('handles v4 URI phones and legacy base64 continuations', () => {
    expect(
      parseVcard(card('FN:Test\nTEL;VALUE=uri:tel:+919000000001', '4.0')).contacts[0].phones[0]
        .value,
    ).toBe('+919000000001');
    const original = card('FN:Old\nPHOTO;ENCODING=BASE64:YWJj\nYWJj\n\nTEL:1234567', '2.1');
    const { contacts } = parseVcard(original);
    expect(exportVcard(contacts, new Set([contacts[0].id]))).toContain('YWJj\r\nYWJj');
  });
  it.each([
    '',
    'junk',
    'BEGIN:VCARD\nVERSION:3.0',
    'END:VCARD',
    card('FN:Test', '5.0'),
    card('FN Test'),
    'BEGIN:VCARD\nBEGIN:VCARD\nEND:VCARD',
  ])('rejects malformed or empty input %s', (text) => expect(() => parseVcard(text)).toThrow());
  it('skips empty cards and fills required names at export without losing fields', () => {
    const { contacts, warnings } = parseVcard(card('') + '\n' + card('TEL:1234567'));
    expect(contacts).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    const output = exportVcard(contacts, new Set([contacts[0].id]));
    expect(output).toContain('FN:1234567');
    expect(output).toContain('N:1234567;;;;');
  });
  it('exports exactly the selection and refuses zero selected records', () => {
    const { contacts } = parseVcard(sample);
    const output = exportVcard(contacts, new Set([contacts[1].id, contacts[5].id]));
    const again = parseVcard(output).contacts;
    expect(again.map((c) => c.name)).toEqual([contacts[1].name, contacts[5].name]);
    expect(again[0].phones).toEqual(contacts[1].phones);
    expect(output.replace(/\r\n/g, '')).not.toContain('\n');
    expect(() => exportVcard(contacts, new Set())).toThrow();
  });
  it('folds to 75 UTF-8 bytes without splitting code points', () => {
    const folded = foldLine(`NOTE:${'अनन्या🙂'.repeat(40)}`);
    for (const line of folded.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(`NOTE:${'अनन्या🙂'.repeat(40)}`);
  });
});
describe('CSV conversion', () => {
  it('adds a required structured name for CSVs with only a display name', () => {
    const { contacts } = parseCsv('Name,Phone\nTest,1234567');
    const output = exportVcard(contacts, new Set([contacts[0].id]));
    expect(output).toContain('FN:Test\r\n');
    expect(output).toContain('N:Test;;;;\r\n');
    expect(parseVcard(output).contacts[0].phones).toEqual(contacts[0].phones);
  });
  it('parses Google exports including quoted commas, escaped quotes, multiline and Unicode', () => {
    const { contacts } = parseCsv(readFileSync('public/sample-contacts.csv', 'utf8'));
    expect(contacts).toHaveLength(2);
    expect(contacts[0].company).toBe('Paper, Pine');
    expect(contacts[1].name).toBe('अनन्या शर्मा');
    const output = exportVcard(contacts, new Set(contacts.map((c) => c.id)));
    const again = parseVcard(output).contacts;
    expect(again[0].properties).toContain(
      'NOTE:Fictional contact only.\\nMultiline notes are supported.',
    );
    expect(again[0].phones[0].label).toBe('Mobile');
    expect(parseCsv('Name,Notes\nTest,"He said ""hello"""').contacts[0].properties).toContain(
      'NOTE:He said "hello"',
    );
  });
  it('supports multiple channels and preserves unmapped columns', () => {
    const { contacts, warnings } = parseCsv(
      'Name,Phone 1 - Value,Phone 2 - Value,E-mail 1 - Value,E-mail 2 - Value,Favorite Color\nTest,111,222,a@example.com,b@example.com,Blue',
    );
    expect(contacts[0].phones).toHaveLength(2);
    expect(contacts[0].emails).toHaveLength(2);
    expect(contacts[0].properties).toContain('X-CONTACTS-CSV-FAVORITECOLOR:Blue');
    expect(warnings.length).toBeGreaterThan(0);
  });
  it.each(['', 'a,b\n1,2', 'Name,Phone\nTest,1,Extra', 'Name,Phone\n"Broken,1'])(
    'rejects uncertain CSV %s',
    (text) => expect(() => parseCsv(text)).toThrow(),
  );
});
describe('search and selection', () => {
  const contacts = parseVcard(sample).contacts;
  it('searches names, normalized numbers, email, company and job title', () => {
    for (const q of [
      'aarav',
      'AARAV',
      '  aarav   mehta ',
      '9000000001',
      'aarav@example.com',
      'paper & pine',
      'designer',
    ])
      expect(filterContacts(contacts, q, 'all', new Set()).map((c) => c.id)).toContain(
        contacts[0].id,
      );
  });
  it('keeps hidden selections when selecting/deselecting filtered results', () => {
    let selected = new Set([contacts[0].id]);
    const visible = filterContacts(contacts, '', 'no-phone', selected);
    selected = updateSelection(
      selected,
      visible.map((c) => c.id),
      true,
    );
    expect(selected.has(contacts[0].id)).toBe(true);
    expect(selected.has(visible[0].id)).toBe(true);
    selected = updateSelection(
      selected,
      visible.map((c) => c.id),
      false,
    );
    expect([...selected]).toEqual([contacts[0].id]);
    expect(filterContacts(contacts, '', 'selected', selected)).toHaveLength(1);
  });
  it('flags shared numbers without merging or matching short numbers', () => {
    const duplicates = duplicateCandidates(contacts);
    expect(duplicates.get(contacts[2].id)).toContain('Shared phone ending 0003');
    expect(contacts).toHaveLength(8);
  });
  it('handles 10,000 records and bulk operations', () => {
    const big = Array.from({ length: 10000 }, (_, i) => ({
      ...contacts[0],
      id: `id-${i}`,
      name: `Person ${i}`,
    }));
    const matches = filterContacts(big, 'Person 9999', 'all', new Set());
    expect(matches).toHaveLength(1);
    expect(
      updateSelection(
        new Set(),
        big.map((c) => c.id),
        true,
      ).size,
    ).toBe(10000);
  });
});
