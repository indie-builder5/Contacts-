import { Coffee } from 'lucide-react';

export function SocialLinks() {
  return (
    <nav className="social-links" aria-label="Creator links">
      <a
        href="https://github.com/paritoshpky5"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub profile"
        title="GitHub"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.64 1.23 3.28.94.1-.73.39-1.23.72-1.51-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.16a10.8 10.8 0 0 1 5.64 0c2.15-1.46 3.1-1.16 3.1-1.16.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" />
        </svg>
      </a>
      <a
        href="https://www.linkedin.com/in/paritoshpky/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn profile"
        title="LinkedIn"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.45 7.9a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.85H15.8V14.1c0-1.1-.02-2.53-1.54-2.53-1.54 0-1.77 1.2-1.77 2.45v4.73H9.54V9.2h2.83v1.3h.04c.39-.74 1.35-1.53 2.78-1.53 2.97 0 3.56 1.95 3.56 4.48v5.3Z" />
        </svg>
      </a>
      <a
        href="https://buymeachai.in/paritoshpky555"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy me a chai"
        title="Buy me a chai"
        className="chai-link"
      >
        <Coffee size={17} aria-hidden="true" />
      </a>
    </nav>
  );
}
