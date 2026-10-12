import type { Contact, Field, ImportResult } from '../../types/contact';

export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c.toLowerCase() === 'n' ? '\n' : c));
}
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
export function propertyParts(line: string) {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    if (line[i] === ':' && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 1)
    throw new Error('A vCard property is missing its value separator. Check the original backup.');
  const head = line.slice(0, colon);
  const name = head.split(';')[0].split('.').pop()!.toUpperCase();
  let value = line.slice(colon + 1);
  if (/ENCODING=QUOTED-PRINTABLE/i.test(head)) {
    const bytes: number[] = [];
    const encoder = new TextEncoder();
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '=' && /^[\da-f]{2}$/i.test(value.slice(i + 1, i + 3))) {
        bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        const cp = value.codePointAt(i)!;
        bytes.push(...encoder.encode(String.fromCodePoint(cp)));
        if (cp > 65535) i++;
      }
    }
    const charset = head.match(/CHARSET=([^;]+)/i)?.[1].replace(/"/g, '') || 'utf-8';
    try {
      value = new TextDecoder(charset, { fatal: true }).decode(new Uint8Array(bytes));
    } catch {
      throw new Error(
        'A contact uses an unsupported or invalid text encoding. Export your backup as UTF-8.',
      );
    }
  }
  return { name, head, value: unescapeText(value), rawValue: value };
}
export function unfold(record: string): string[] {
  const physical = record.replace(/\r\n|\r/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of physical) {
    if (
      lines.length &&
      /ENCODING=QUOTED-PRINTABLE/i.test(lines[lines.length - 1]) &&
      lines[lines.length - 1].endsWith('=')
    )
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + line.replace(/^[ \t]/, '');
    else if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1);
    else if (line) lines.push(line);
  }
  return lines;
}
export function contactFromProperties(properties: string[], id: string, version = '3.0'): Contact {
  const parsed = properties.map(propertyParts);
  const get = (key: string) => parsed.find((p) => p.name === key)?.value || '';
  const fields = (key: string): Field[] =>
    parsed
      .filter((p) => p.name === key && p.value.trim())
      .map((p) => {
        const group = p.head.split(';')[0].split('.').slice(0, -1).join('.');
        const custom = group
          ? properties.find((l) => l.toUpperCase().startsWith(`${group.toUpperCase()}.X-ABLABEL:`))
          : undefined;
        const label = custom
          ? propertyParts(custom).value.replace(/_\$!<|>!\$_/g, '')
          : p.head.match(/(?:;TYPE=)("[^"]+"|[^;]+)/i)?.[1].replace(/"/g, '') ||
            p.head
              .split(';')
              .slice(1)
              .filter((s) => !s.includes('='))
              .join(',') ||
            'Other';
        return { value: p.value.replace(/^tel:/i, key === 'TEL' ? '' : 'tel:'), label };
      });
  const splitComponents = (key: string) => {
    const raw = parsed.find((p) => p.name === key)?.rawValue || '';
    const result: string[] = [];
    let part = '';
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '\\' && i + 1 < raw.length) {
        part += raw[i] + raw[++i];
      } else if (raw[i] === ';') {
        result.push(unescapeText(part));
        part = '';
      } else part += raw[i];
    }
    result.push(unescapeText(part));
    return result;
  };
  const structured = splitComponents('N');
  const name =
    get('FN') ||
    [structured[3], structured[1], structured[2], structured[0], structured[4]]
      .filter(Boolean)
      .join(' ') ||
    fields('TEL')[0]?.value ||
    fields('EMAIL')[0]?.value ||
    get('ORG') ||
    'Unnamed contact';
  return {
    id,
    name,
    phones: fields('TEL'),
    emails: fields('EMAIL'),
    company: splitComponents('ORG').filter(Boolean).join(' · '),
    title: get('TITLE'),
    properties,
    version,
  };
}
export function parseVcard(text: string): ImportResult {
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n|\r/g, '\n')
    .trim();
  if (!clean)
    throw new Error('This file is empty. Choose a contacts backup with at least one contact.');
  const records: string[] = [];
  let current: string[] | null = null;
  for (const line of clean.split('\n')) {
    if (/^BEGIN:VCARD$/i.test(line)) {
      if (current)
        throw new Error('A vCard starts before the previous one ends. The backup is malformed.');
      current = [line];
    } else if (/^END:VCARD$/i.test(line)) {
      if (!current) throw new Error('The backup has an unexpected vCard ending.');
      current.push(line);
      records.push(current.join('\n'));
      current = null;
    } else if (current) current.push(line);
    else if (line.trim())
      throw new Error(
        'This file contains content outside a vCard record. Choose a valid VCF backup.',
      );
  }
  if (current || !records.length)
    throw new Error(
      'No complete vCards found. Check that every record has BEGIN:VCARD and END:VCARD.',
    );
  const warnings: string[] = [];
  const contacts: Contact[] = [];
  records.forEach((record, index) => {
    const lines = unfold(record);
    const version = lines.find((l) => /^VERSION:/i.test(l))?.split(':')[1];
    if (!version || !['2.1', '3.0', '4.0'].includes(version))
      throw new Error(
        'This backup has a missing or unsupported vCard version. Use vCard 2.1, 3.0 or 4.0.',
      );
    const properties = lines.filter((l) => !/^(BEGIN|END|VERSION):/i.test(l));
    // 2.1 permits unindented base64 continuations. Retain them verbatim for export.
    const displayProperties: string[] = [];
    let base64 = false;
    for (const line of properties) {
      if (!line.includes(':') && base64 && /^[A-Za-z0-9+/=]+$/.test(line)) continue;
      propertyParts(line);
      displayProperties.push(line);
      base64 = /ENCODING=(BASE64|B)/i.test(line);
    }
    const hasContent = displayProperties.some((l) => {
      const p = propertyParts(l);
      return p.value.trim() && !['UID', 'REV', 'PRODID'].includes(p.name);
    });
    if (!hasContent) {
      warnings.push(`Skipped empty record ${index + 1}.`);
      return;
    }
    const contact = contactFromProperties(displayProperties, `contact-${index}`, version);
    contact.original = record.replace(/\n/g, '\r\n');
    contacts.push(contact);
  });
  if (!contacts.length) throw new Error('No usable contacts found in this backup.');
  if (contacts.some((c) => c.version === '2.1'))
    warnings.push('Legacy vCard 2.1 records are preserved. Compatibility varies by Contacts app.');
  return { contacts, warnings };
}
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let output = '';
  let length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) {
      output += '\r\n ';
      length = 1;
    }
    output += char;
    length += bytes;
  }
  return output;
}
export function exportVcard(contacts: Contact[], selected: ReadonlySet<string>): string {
  const kept = contacts.filter((c) => selected.has(c.id));
  if (!kept.length) throw new Error('Select at least one contact before exporting.');
  return (
    kept
      .map((c) => {
        const additions: string[] = [];
        if (!c.properties.some((p) => propertyParts(p).name === 'FN'))
          additions.push(`FN${c.version === '2.1' ? ';CHARSET=UTF-8' : ''}:${escapeText(c.name)}`);
        if (c.version !== '4.0' && !c.properties.some((p) => propertyParts(p).name === 'N'))
          additions.push(
            `N${c.version === '2.1' ? ';CHARSET=UTF-8' : ''}:${escapeText(c.name)};;;;`,
          );
        if (!c.original)
          return ['BEGIN:VCARD', 'VERSION:3.0', ...c.properties, ...additions, 'END:VCARD']
            .map(foldLine)
            .join('\r\n');
        return additions.length
          ? c.original.replace(
              /END:VCARD$/i,
              `${additions.map(foldLine).join('\r\n')}\r\nEND:VCARD`,
            )
          : c.original;
      })
      .join('\r\n') + '\r\n'
  );
}
