export interface Field {
  value: string;
  label: string;
}
export interface Contact {
  id: string;
  name: string;
  phones: Field[];
  emails: Field[];
  company: string;
  title: string;
  properties: string[];
  original?: string;
  version: string;
}
export interface ImportResult {
  contacts: Contact[];
  warnings: string[];
}
export type ContactFilter =
  | 'all'
  | 'selected'
  | 'unselected'
  | 'phone'
  | 'no-phone'
  | 'email'
  | 'no-email'
  | 'both'
  | 'duplicates';
export type SortOrder = 'az' | 'za' | 'company' | 'phone';
