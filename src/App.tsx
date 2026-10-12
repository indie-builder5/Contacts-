import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  FolderUp,
  Heart,
  LockKeyhole,
  Moon,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import type { Contact, ContactFilter, ImportResult, SortOrder } from './types/contact';
import { duplicateCandidates, filterContacts, updateSelection } from './features/contacts/logic';
import { exportVcard, parseVcard, propertyParts } from './lib/vcard';
import { Modal } from './components/Modal';
import { SocialLinks } from './components/SocialLinks';
import { clearSession, loadSession, saveSession } from './lib/session';
import demo from '../public/sample-contacts.vcf?raw';

const filters: [ContactFilter, string][] = [
  ['all', 'All contacts'],
  ['selected', 'Selected'],
  ['unselected', 'Not selected'],
  ['phone', 'With a phone'],
  ['no-phone', 'Missing phone'],
  ['email', 'With an email'],
  ['no-email', 'Missing email'],
  ['both', 'Phone & email'],
  ['duplicates', 'Duplicate review'],
];
const pageSize = 50;
function download(data: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'text/vcard;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export default function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<ContactFilter>('all');
  const [sort, setSort] = useState<SortOrder>('az');
  const [page, setPage] = useState(0);
  const [filename, setFilename] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [drag, setDrag] = useState(false);
  const [modal, setModal] = useState<'help' | 'export' | 'replace' | 'reset' | null>(null);
  const [detail, setDetail] = useState<Contact | null>(null);
  const [pending, setPending] = useState<File | 'demo' | null>(null);
  const [exportName, setExportName] = useState('My_Contacts');
  const [previous, setPrevious] = useState<Set<string> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const headerCheck = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const saveRevision = useRef(0);
  useEffect(() => {
    let active = true;
    loadSession()
      .then((saved) => {
        if (!active) return;
        if (saved) {
          setContacts(saved.contacts);
          setSelected(new Set(saved.selected));
          setFilename(saved.filename);
          setWarnings(saved.warnings);
          setNotice(
            'Welcome back. Your contacts and selections have been restored from this browser.',
          );
        }
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError(
            'Saved progress could not be restored. Browser storage may be disabled. You can still import and export contacts.',
          );
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const revision = ++saveRevision.current;
    setSaveStatus(contacts.length ? 'Saving locally…' : '');
    if (!contacts.length) return;
    const operation = saveSession({
      version: 1,
      contacts,
      selected: [...selected],
      filename,
      warnings,
      savedAt: Date.now(),
    });
    operation
      .then(() => {
        if (saveRevision.current === revision)
          setSaveStatus(contacts.length ? 'Progress saved on this browser' : '');
      })
      .catch(() => {
        if (saveRevision.current === revision)
          setSaveStatus('Could not save. Keep this tab open and export a backup.');
      });
  }, [ready, contacts, selected, filename, warnings]);
  async function saveProgress() {
    setSaveBusy(true);
    try {
      await saveSession({
        version: 1,
        contacts,
        selected: [...selected],
        filename,
        warnings,
        savedAt: Date.now(),
      });
      setNotice(
        'Progress saved on this browser. You can refresh or come back later on this device.',
      );
      setSaveStatus('Progress saved on this browser');
    } catch {
      setError(
        'Progress could not be saved. Your browser may have disabled storage or run out of space. Export your selection before closing.',
      );
    } finally {
      setSaveBusy(false);
    }
  }
  useEffect(() => () => workerRef.current?.terminate(), []);
  const close = useCallback(() => {
    setModal(null);
    setDetail(null);
    setPending(null);
  }, []);
  const duplicates = useMemo(() => duplicateCandidates(contacts), [contacts]);
  const matching = useMemo(
    () => filterContacts(contacts, deferredQuery, filter, selected, duplicates, sort),
    [contacts, deferredQuery, filter, selected, duplicates, sort],
  );
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selectedVisible = visible.filter((c) => selected.has(c.id)).length;
  useEffect(() => {
    if (headerCheck.current)
      headerCheck.current.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  }, [selectedVisible, visible.length]);
  const kept = useMemo(() => contacts.filter((c) => selected.has(c.id)), [contacts, selected]);
  function changeSelection(ids: string[], keep: boolean) {
    setPrevious(new Set(selected));
    setSelected(updateSelection(selected, ids, keep));
  }
  function accept(result: ImportResult, name: string) {
    setContacts(result.contacts);
    setSelected(new Set());
    setPrevious(null);
    setFilename(name);
    setWarnings(result.warnings);
    setQuery('');
    setFilter('all');
    setPage(0);
    setNotice(`Imported ${result.contacts.length.toLocaleString()} contacts. Choose who stays.`);
    setError('');
    setLoading(false);
  }
  async function importFile(file: File | 'demo') {
    setError('');
    setNotice('');
    setLoading(true);
    if (file === 'demo') {
      accept(parseVcard(demo), 'Sample contacts · fictional data');
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['vcf', 'vcard', 'csv'].includes(extension)) {
      setError('Choose a .vcf, .vcard or .csv contacts backup.');
      setLoading(false);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('This file exceeds 50 MB. Export a smaller backup or remove embedded photos first.');
      setLoading(false);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      if (
        buffer.byteLength >= 2 &&
        new Uint8Array(buffer)[0] === 255 &&
        new Uint8Array(buffer)[1] === 254
      )
        text = new TextDecoder('utf-16le', { fatal: true }).decode(buffer);
      else if (
        buffer.byteLength >= 2 &&
        new Uint8Array(buffer)[0] === 254 &&
        new Uint8Array(buffer)[1] === 255
      )
        text = new TextDecoder('utf-16be', { fatal: true }).decode(buffer);
      else text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      const worker = new Worker(new URL('./features/contacts/import.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ result?: ImportResult; error?: string }>) => {
        worker.terminate();
        workerRef.current = null;
        if (event.data.result) accept(event.data.result, file.name);
        else {
          setError(event.data.error || 'Unable to read this backup.');
          setLoading(false);
        }
      };
      worker.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        setLoading(false);
        setError('Import could not finish. Try again with a smaller UTF-8 contacts backup.');
      };
      worker.postMessage({ text, extension });
    } catch {
      setLoading(false);
      setError(
        'The file could not be read as UTF-8 or UTF-16. Export a fresh backup from your Contacts app.',
      );
    }
  }
  function requestImport(file: File | 'demo') {
    if (loading || !ready) return;
    if (contacts.length) {
      setPending(file);
      setModal('replace');
    } else void importFile(file);
  }
  async function reset() {
    setSaveBusy(true);
    try {
      await clearSession();
      workerRef.current?.terminate();
      workerRef.current = null;
      setContacts([]);
      setSelected(new Set());
      setPrevious(null);
      setFilename('');
      setWarnings([]);
      setQuery('');
      setFilter('all');
      setPage(0);
      setLoading(false);
      setNotice('Uploaded contacts and saved progress cleared. Your original backup is untouched.');
      setError('');
      close();
    } catch {
      close();
      setError(
        'Saved data could not be removed. Clear this site’s data in your browser settings to erase it. Your current contacts remain available.',
      );
    } finally {
      setSaveBusy(false);
    }
  }
  function exportSelected() {
    const safeName =
      exportName
        .trim()
        .replace(/\.vcf$/i, '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'My_Contacts';
    download(exportVcard(contacts, selected), `${safeName}.vcf`);
    close();
    setNotice(
      `Downloaded ${kept.length} selected contacts. Your phone contacts have not been changed.`,
    );
  }
  const stats = [
    {
      label: 'Imported contacts',
      value: contacts.length,
      icon: Users,
      caption: filename ? 'Your starting point' : 'Ready for a fresh start',
    },
    {
      label: 'Selected to keep',
      value: selected.size,
      icon: Heart,
      caption: 'The people who matter',
    },
    {
      label: 'Matching contacts',
      value: matching.length,
      icon: Search,
      caption: 'In your current view',
    },
  ];
  return (
    <div className={`app ${dark ? 'dark' : ''}`}>
      <header className="header">
        <a className="brand" href="#" aria-label="Contacts- home">
          <span className="brand-mark">
            <Users size={23} />
            <span>−</span>
          </span>
          Contacts<span className="brand-minus">−</span>
        </a>
        <span className="header-tag">A LITTLE LESS. A LOT MORE MEANING.</span>
        <div className="header-actions">
          <span className="privacy-pill">
            <LockKeyhole size={13} />
            Local & private
          </span>
          <button
            className="icon-button"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="icon-button"
            aria-label="Help and privacy"
            onClick={() => setModal('help')}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> YOUR CONTACTS, ON YOUR TERMS
            </div>
            <h1>
              Keep the people
              <br className="mobile-break" /> who <em>matter.</em>
            </h1>
            <p>A new phone. A fresh start. Bring only your people along.</p>
          </div>
          <div className="intro-note">
            <span className="note-icon">
              <Sparkles size={20} />
            </span>
            <p>
              1,000+ contacts.
              <br />
              <strong>Maybe 100 real connections.</strong>
              <br />
              <span>You decide who stays.</span>
            </p>
          </div>
        </section>
        <section className="workspace" aria-label="Contact workspace">
          <aside className="sidebar">
            <div className="sidebar-heading">YOUR FRESH START</div>
            <div className="steps">
              <div className="step">
                <span className={contacts.length ? 'step-number complete' : 'step-number active'}>
                  {contacts.length ? <Check size={14} /> : '1'}
                </span>
                <div>
                  <strong>Bring your contacts</strong>
                  <small>Import your existing backup</small>
                </div>
              </div>
              <div className="step">
                <span className={contacts.length ? 'step-number active' : 'step-number'}>2</span>
                <div>
                  <strong>Choose your people</strong>
                  <small>A little intention goes a long way</small>
                </div>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <div>
                  <strong>Take them with you</strong>
                  <small>Export a fresh contacts file</small>
                </div>
              </div>
            </div>
            <div
              className={`upload-zone ${drag ? 'dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                if (e.dataTransfer.files[0]) requestImport(e.dataTransfer.files[0]);
              }}
            >
              <span className="upload-icon">
                <FolderUp size={24} />
              </span>
              <strong>
                {loading
                  ? 'Reading your backup…'
                  : contacts.length
                    ? 'Import another backup'
                    : 'Drop your backup here'}
              </strong>
              <p>
                {loading
                  ? 'Processing locally on your device'
                  : 'or choose a file from your device'}
              </p>
              <button
                className="button primary"
                disabled={loading || !ready}
                onClick={() => input.current?.click()}
              >
                <FolderUp size={15} />
                {contacts.length ? 'Replace file' : 'Choose file'}
              </button>
              <small>VCF, vCard, CSV · up to 50 MB</small>
              <input
                ref={input}
                type="file"
                accept=".vcf,.vcard,.csv"
                aria-label="Import contacts file"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.[0]) requestImport(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </div>
            {filename && (
              <div className="file-summary">
                <FileText size={17} />
                <div>
                  <strong title={filename}>{filename}</strong>
                  <small>{contacts.length.toLocaleString()} contacts detected</small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Clear uploaded contacts"
                  onClick={() => setModal('reset')}
                  disabled={loading || !ready}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <div className="progress-card">
              <button
                className="button secondary"
                disabled={!contacts.length || saveBusy || !ready}
                onClick={() => void saveProgress()}
              >
                <Save size={15} />
                {saveBusy ? 'Saving…' : 'Save progress'}
              </button>
              <small role="status" aria-label="Save status">
                {ready
                  ? saveStatus || 'Progress saves automatically after import'
                  : 'Restoring saved progress…'}
              </small>
            </div>
            <div className="privacy-card">
              <ShieldCheck size={22} />
              <strong>Private by design.</strong>
              <p>
                Your contacts and progress are saved only in this browser. No account, no uploads,
                no tracking. Clear uploaded contacts to remove saved data.
              </p>
              <button className="text-button" onClick={() => setModal('help')}>
                How it works <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="sidebar-bottom">
              <Smartphone size={16} />
              <span>Made for your next fresh start.</span>
            </div>
          </aside>
          <div className="main-panel">
            <section className="stats" aria-label="Contact statistics">
              {stats.map((stat, i) => (
                <div className={`stat stat-${i}`} key={stat.label}>
                  <div className="stat-top">
                    <span>{stat.label}</span>
                    <stat.icon size={17} />
                  </div>
                  <strong>{stat.value.toLocaleString()}</strong>
                  <small>{stat.caption}</small>
                </div>
              ))}
            </section>
            {error && (
              <div className="message error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="message success" role="status">
                <Check size={16} />
                {notice}
              </div>
            )}
            {warnings.length > 0 && (
              <details className="import-warnings">
                <summary>
                  {warnings.length} import {warnings.length === 1 ? 'note' : 'notes'} · review
                  before exporting
                </summary>
                {warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </details>
            )}
            <section className="contacts-panel">
              <div className="section-heading">
                <div>
                  <h2>
                    Your people <span>{contacts.length.toLocaleString()}</span>
                  </h2>
                  <p>Choose who you want in your next chapter.</p>
                </div>
                {contacts.length > 0 && (
                  <button
                    className="text-button muted"
                    onClick={() => setModal('reset')}
                    disabled={loading || !ready}
                  >
                    Clear uploaded contacts
                  </button>
                )}
              </div>
              <div className="toolbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Search names, numbers, emails…"
                    aria-label="Search contacts"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <select
                  aria-label="Filter contacts"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value as ContactFilter);
                    setPage(0);
                  }}
                >
                  {filters.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sort contacts"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOrder)}
                >
                  <option value="az">Name A–Z</option>
                  <option value="za">Name Z–A</option>
                  <option value="company">Company</option>
                  <option value="phone">Phone number</option>
                </select>
              </div>
              {contacts.length > 0 ? (
                <>
                  <div className="selection-toolbar">
                    <span>
                      <strong>{selected.size}</strong> selected
                    </span>
                    <button
                      onClick={() =>
                        changeSelection(
                          matching.map((c) => c.id),
                          true,
                        )
                      }
                    >
                      Select all {matching.length} matching
                    </button>
                    <button
                      onClick={() =>
                        changeSelection(
                          contacts.map((c) => c.id),
                          true,
                        )
                      }
                    >
                      Select entire list
                    </button>
                    <button
                      onClick={() =>
                        changeSelection(
                          matching.map((c) => c.id),
                          false,
                        )
                      }
                    >
                      Deselect matching
                    </button>
                    <button
                      disabled={!selected.size}
                      onClick={() => changeSelection([...selected], false)}
                    >
                      Clear selection
                    </button>
                    <button
                      disabled={!previous}
                      onClick={() => {
                        if (previous) {
                          setSelected(previous);
                          setPrevious(null);
                        }
                      }}
                    >
                      <Undo2 size={13} />
                      Undo
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th className="check-cell">
                            <input
                              ref={headerCheck}
                              type="checkbox"
                              aria-label="Select visible contacts"
                              checked={visible.length > 0 && selectedVisible === visible.length}
                              disabled={!visible.length}
                              onChange={(e) =>
                                changeSelection(
                                  visible.map((c) => c.id),
                                  e.target.checked,
                                )
                              }
                            />
                          </th>
                          <th>
                            <button
                              className="column-sort"
                              onClick={() => setSort(sort === 'az' ? 'za' : 'az')}
                            >
                              Contact {sort === 'az' ? '↑' : sort === 'za' ? '↓' : ''}
                            </button>
                          </th>
                          <th>Phone & email</th>
                          <th>
                            <button className="column-sort" onClick={() => setSort('company')}>
                              Company
                            </button>
                          </th>
                          <th>
                            <span className="sr-only">Details</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((contact, i) => (
                          <tr
                            key={contact.id}
                            className={selected.has(contact.id) ? 'selected-row' : ''}
                          >
                            <td className="check-cell">
                              <input
                                type="checkbox"
                                aria-label={`Keep ${contact.name}`}
                                checked={selected.has(contact.id)}
                                onChange={(e) => changeSelection([contact.id], e.target.checked)}
                              />
                            </td>
                            <td>
                              <button className="person" onClick={() => setDetail(contact)}>
                                <span className={`avatar color-${i % 5}`}>
                                  {contact.name
                                    .split(/\s+/)
                                    .slice(0, 2)
                                    .map((n) => Array.from(n)[0])
                                    .join('')
                                    .toLocaleUpperCase()}
                                </span>
                                <span>
                                  <strong>{contact.name}</strong>
                                  <small>
                                    {duplicates.has(contact.id) ? (
                                      <span className="duplicate-tag">Review candidate</span>
                                    ) : (
                                      contact.title || 'Contact'
                                    )}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td className="contact-channels">
                              <span>
                                {contact.phones[0]?.value || 'No phone number'}
                                {contact.phones.length > 1 && (
                                  <small> +{contact.phones.length - 1}</small>
                                )}
                              </span>
                              <small>
                                {contact.emails[0]?.value || 'No email address'}
                                {contact.emails.length > 1 && ` +${contact.emails.length - 1}`}
                              </small>
                            </td>
                            <td className="company-cell">{contact.company || '—'}</td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`Details for ${contact.name}`}
                                onClick={() => setDetail(contact)}
                              >
                                <ArrowUpRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!visible.length && (
                    <div className="no-results">
                      <Search size={24} />
                      <h3>No contacts match this view.</h3>
                      <p>Try another search or filter. Your selections are saved.</p>
                    </div>
                  )}
                  <div className="pagination">
                    <span>
                      {matching.length ? currentPage * pageSize + 1 : 0}–
                      {Math.min((currentPage + 1) * pageSize, matching.length)} of{' '}
                      {matching.length.toLocaleString()} matching
                    </span>
                    <div>
                      <button
                        className="icon-button"
                        aria-label="Previous page"
                        disabled={!currentPage}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <span>
                        {currentPage + 1} / {totalPages}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Next page"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-illustration">
                    <span className="mini-card back-card">
                      <span className="mini-avatar" />
                      <span className="mini-lines" />
                    </span>
                    <span className="mini-card front-card">
                      <span className="mini-avatar green" />
                      <span className="mini-lines" />
                      <span className="mini-check">
                        <Check size={15} />
                      </span>
                    </span>
                    <span className="empty-spark">✦</span>
                  </div>
                  <h3>A lighter contact list starts here.</h3>
                  <p>
                    Import your backup, pick your people,
                    <br />
                    and leave the clutter behind.
                  </p>
                  <button
                    className="button primary"
                    disabled={loading || !ready}
                    onClick={() => input.current?.click()}
                  >
                    Import your contacts <ArrowRight size={16} />
                  </button>
                  <button
                    className="text-button"
                    disabled={loading || !ready}
                    onClick={() => requestImport('demo')}
                  >
                    Just exploring? Try fictional sample contacts <ArrowUpRight size={14} />
                  </button>
                  <span className="empty-privacy">
                    <LockKeyhole size={12} />
                    Only you see your contacts.
                  </span>
                </div>
              )}
              <div className="export-bar">
                <div>
                  <span className="export-icon">
                    <ArrowDownToLine size={21} />
                  </span>
                  <div>
                    <strong>
                      {selected.size
                        ? `${selected.size.toLocaleString()} contacts. A fresh start.`
                        : 'Your next chapter, ready to go.'}
                    </strong>
                    <small>
                      {selected.size
                        ? 'Download your selection as an Android-compatible VCF.'
                        : 'Select at least one contact to enable export.'}
                    </small>
                  </div>
                </div>
                <button
                  className="button primary"
                  disabled={!selected.size}
                  onClick={() => setModal('export')}
                >
                  <ArrowDownToLine size={16} />
                  Export selected <ArrowRight size={16} />
                </button>
              </div>
            </section>
            <div className="under-note">
              <ShieldCheck size={14} />
              <span>Your original backup stays untouched. Nothing is deleted from your phone.</span>
            </div>
          </div>
        </section>
      </main>
      <footer>
        <div className="footer-info">
          <span>
            Contacts− <span className="footer-divider">/</span> Less clutter. More connection.
          </span>
          <button className="text-button muted" onClick={() => setModal('help')}>
            Privacy & Android import <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="footer-creator">
          <span className="footer-credit" aria-label="Made with love in India">
            Made with <Heart size={12} aria-hidden="true" /> in India
          </span>
          <SocialLinks />
        </div>
      </footer>
      {modal === 'help' && (
        <Modal title="A fresh start, in three steps" close={close}>
          <ol className="help-steps">
            <li>
              <strong>Export a backup from your old phone.</strong>
              <p>
                In your Contacts app, look for export or download. Choose a VCF backup, or download
                a CSV from Google Contacts.
              </p>
            </li>
            <li>
              <strong>Import here and choose who stays.</strong>
              <p>
                Use search, filters and checkboxes. Your selections stay in place while you browse.
              </p>
            </li>
            <li>
              <strong>Download and import on Android.</strong>
              <p>
                Open your new phone’s Contacts app and look for Organize, Manage contacts, or
                Settings → Import from file. Choose your exported VCF. Menu labels vary by device.
              </p>
            </li>
          </ol>
          <div className="callout">
            <ShieldCheck size={20} />
            <p>
              Files are processed locally. Contacts and selections are automatically saved in
              IndexedDB on this browser so you can return after refreshing or closing. Use Save
              progress for confirmation. Use Clear selection to start choosing again, or Clear
              uploaded contacts to erase the saved list and selections. No contact uploads,
              analytics or accounts. The website host may receive ordinary page access metadata.
            </p>
          </div>
          <p className="important-note">
            Exporting and importing does not remove existing contacts from your phone. Importing
            into an account that already has them may create duplicates. Keep your original backup
            and review the destination account first.
          </p>
          <a className="text-button" href="./sample-contacts.vcf" download>
            Download fictional sample backup <ArrowDownToLine size={14} />
          </a>
        </Modal>
      )}
      {modal === 'replace' && (
        <Modal title="Replace this session?" close={close}>
          <p>
            You have {contacts.length} imported contacts and {selected.size} selections. A
            successful import will replace them. If the new file is invalid, your current session
            stays intact.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={close}>
              Keep current session
            </button>
            <button
              className="button primary"
              onClick={() => {
                const file = pending;
                close();
                if (file) void importFile(file);
              }}
            >
              Replace and import
            </button>
          </div>
        </Modal>
      )}
      {modal === 'reset' && (
        <Modal title="Clear uploaded contacts?" close={close}>
          <p>
            This removes the imported contacts, selections and saved progress from this browser, and
            clears undo history. Your original file and phone contacts stay untouched.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={close}>
              Keep working
            </button>
            <button className="button primary" disabled={saveBusy} onClick={() => void reset()}>
              {saveBusy ? 'Clearing…' : 'Clear uploaded contacts'}
            </button>
          </div>
        </Modal>
      )}
      {modal === 'export' && (
        <Modal title="Take your people with you" close={close}>
          <p>
            <strong>
              {selected.size} selected · {kept.length} contacts to export.
            </strong>{' '}
            Only these contacts will be included in your VCF.
          </p>
          <label className="filename-label">
            File name
            <div>
              <input
                aria-label="Export file name"
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                maxLength={100}
              />
              <span>.vcf</span>
            </div>
          </label>
          <div className="export-preview">
            {kept.slice(0, 8).map((c) => (
              <div key={c.id}>
                <Check size={14} />
                <span>{c.name}</span>
                <small>
                  {c.phones.length} phone · {c.emails.length} email
                </small>
              </div>
            ))}
            {kept.length > 8 && <p>And {kept.length - 8} more selected contacts.</p>}
          </div>
          {kept.some((c) => !c.phones.length && !c.emails.length) && (
            <p className="warning-text">
              Some selected contacts have neither a phone number nor an email. They will still
              export with their available fields.
            </p>
          )}
          {warnings.map((w) => (
            <p className="warning-text" key={w}>
              {w}
            </p>
          ))}
          <p className="important-note">
            Your backup is unchanged. Importing this file will not delete existing contacts on your
            phone.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={close}>
              Keep reviewing
            </button>
            <button className="button primary" onClick={exportSelected}>
              <ArrowDownToLine size={16} />
              Download VCF
            </button>
          </div>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.name} close={close}>
          {duplicates.has(detail.id) && (
            <div className="callout">
              <Users size={19} />
              <p>
                {duplicates.get(detail.id)?.join(' · ')}. This is a review suggestion; contacts are
                never merged automatically.
              </p>
            </div>
          )}
          <dl className="details-list">
            {detail.properties
              .filter(
                (line) =>
                  !/^(PHOTO|LOGO|SOUND|KEY)(;|:)|^[^.]+\.(PHOTO|LOGO|SOUND|KEY)(;|:)/i.test(line),
              )
              .map((line, i) => {
                const p = propertyParts(line);
                return (
                  <div key={i}>
                    <dt>{p.name}</dt>
                    <dd>{p.value}</dd>
                  </div>
                );
              })}
          </dl>
          <p className="important-note">
            Embedded photos and other binary properties are hidden here and preserved in VCF
            exports.
          </p>
          <button
            className="button primary"
            onClick={() => changeSelection([detail.id], !selected.has(detail.id))}
          >
            {selected.has(detail.id) ? 'Deselect this contact' : 'Keep this contact'}
          </button>
        </Modal>
      )}
    </div>
  );
}
