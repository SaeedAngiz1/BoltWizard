/**
 * App-wide footer: brand mark + BoltWizard wordmark + creator credit + the
 * three always-required legal links (About · Terms · Privacy).
 *
 * Hash links (#/about, #/terms, #/privacy) work without a router because they
 * are caught by App's hash listener and render the LegalView.
 */
/** Tiny inline copy of /public/icon.svg so the footer has no network deps. */
function BrandMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="BoltWizard"
    >
      <ellipse cx="32" cy="52" rx="28" ry="6" fill="#5B21B6" />
      <ellipse cx="32" cy="51" rx="26" ry="4.5" fill="#6D28D9" />
      <path d="M34 4 L54 50 L10 50 Z" fill="#7C3AED" />
      <path d="M38 9 L21 30 L31 30 L26 47 L43 22 L33 22 Z" fill="#FBBF24" />
    </svg>
  );
}

/**
 * App-wide footer. The "Created by" credit points at /about (per the prompt:
 * tasteful brand element, not fine print; pretty hard to miss).
 */
export function Footer() {
  return (
    <footer className="appfooter" aria-label="Site footer">
      <div className="appfooter__col appfooter__col--brand">
        <span className="appfooter__mark" aria-hidden="true">
          <BrandMark size={16} />
        </span>
        <span className="appfooter__name">
          <span className="appfooter__name-bolt">Bolt</span>
          <span className="appfooter__name-wizard">Wizard</span>
        </span>
        <span className="appfooter__sep" aria-hidden="true">
          ·
        </span>
        <span className="appfooter__credit">
          Created by{' '}
          <a className="appfooter__link" href="#/about">
            Mohammad Saeed Angiz
          </a>
          .
        </span>
      </div>

      <div className="appfooter__col appfooter__col--links">
        <a className="appfooter__link" href="#/about">About</a>
        <span className="appfooter__sep" aria-hidden="true">·</span>
        <a className="appfooter__link" href="#/terms">Terms</a>
        <span className="appfooter__sep" aria-hidden="true">·</span>
        <a className="appfooter__link" href="#/privacy">Privacy</a>
      </div>
    </footer>
  );
}

