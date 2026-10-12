import type { Contact, ContactFilter, SortOrder } from '../../types/contact';
const normalize = (s: string) => s.toLocaleLowerCase().trim().replace(/\s+/g, ' ');
export function duplicateCandidates(contacts: Contact[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const result = new Map<string, string[]>();
  for (const c of contacts) {
    const keys = [
      ...c.phones.map((p) => {
        const digits = p.value.replace(/\D/g, '').replace(/^00/, '');
        return digits.length >= 7 ? `phone:${digits}` : '';
      }),
      ...c.emails.map((e) => `email:${normalize(e.value)}`),
    ];
    if (c.name !== 'Unnamed contact' && /\p{L}/u.test(c.name))
      keys.push(`name:${normalize(c.name)}`);
    for (const key of new Set(keys.filter(Boolean)))
      index.set(key, [...(index.get(key) || []), c.id]);
  }
  for (const [key, ids] of index)
    if (ids.length > 1) {
      const reason = key.startsWith('name:')
        ? 'Same name · review only'
        : key.startsWith('phone:')
          ? `Shared phone ending ${key.slice(-4)}`
          : 'Shared email address';
      for (const id of ids) result.set(id, [...(result.get(id) || []), reason]);
    }
  return result;
}
export function filterContacts(
  contacts: Contact[],
  query: string,
  filter: ContactFilter,
  selected: ReadonlySet<string>,
  duplicates: Map<string, string[]> = new Map(),
  sort: SortOrder = 'az',
): Contact[] {
  const q = normalize(query);
  const digits = q.replace(/\D/g, '');
  return contacts
    .filter((c) => {
      const match = {
        all: true,
        selected: selected.has(c.id),
        unselected: !selected.has(c.id),
        phone: !!c.phones.length,
        'no-phone': !c.phones.length,
        email: !!c.emails.length,
        'no-email': !c.emails.length,
        both: !!c.phones.length && !!c.emails.length,
        duplicates: duplicates.has(c.id),
      }[filter];
      const haystack = normalize(
        [
          c.name,
          c.company,
          c.title,
          ...c.phones.map((p) => p.value),
          ...c.emails.map((e) => e.value),
        ].join(' '),
      );
      return (
        match &&
        (!q ||
          haystack.includes(q) ||
          (!!digits &&
            /^[+\d\s().-]+$/.test(q) &&
            c.phones.some((p) => p.value.replace(/\D/g, '').includes(digits))))
      );
    })
    .sort((a, b) =>
      sort === 'za'
        ? b.name.localeCompare(a.name)
        : sort === 'company'
          ? a.company.localeCompare(b.company) || a.name.localeCompare(b.name)
          : sort === 'phone'
            ? (a.phones[0]?.value || '').localeCompare(b.phones[0]?.value || '')
            : a.name.localeCompare(b.name),
    );
}
export function updateSelection(
  selected: ReadonlySet<string>,
  ids: string[],
  keep: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const id of ids)
    if (keep) next.add(id);
    else next.delete(id);
  return next;
}
