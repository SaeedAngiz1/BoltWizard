/**
 * BoltWizard legal pages rendered via hash routes. App.tsx listens for
 * #/about, #/terms, #/privacy and swaps the workspace for <LegalView />.
 *
 * Three pages, real prose (no lorem). Designed to read like a solo/indie
 * product: clear, plain English, not lawyerly where it doesn't have to be.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';

export type LegalRoute = '/about' | '/terms' | '/privacy';

const ROUTES: readonly LegalRoute[] = ['/about', '/terms', '/privacy'] as const;

function isLegal(s: string): s is LegalRoute {
  return (ROUTES as readonly string[]).includes(s);
}

const TODAY = new Date().toISOString().slice(0, 10);

/** Small helper to keep prose headings consistent. */
function H({ children, level = 2 }: { children: React.ReactNode; level?: 2 | 3 }) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return <Tag className={level === 2 ? 'legal__h2' : 'legal__h3'}>{children}</Tag>;
}

/* ---------------- Pages ---------------------------------------------------- */

function AboutPage() {
  return (
    <article className="legal__doc" aria-label="About BoltWizard">
      <header className="legal-hero">
        <div className="legal-hero__mark" aria-hidden="true">
          <Sparkles size={28} />
        </div>
        <div className="legal-hero__title">
          BoltWizard
        </div>
        <div className="legal-hero__credit">
          Created by <strong>Mohammad Saeed Angiz</strong>.
        </div>
        <p className="legal-hero__lede">
          BoltWizard is a single-page AI dev agent that runs a real
          Linux-shaped sandbox — WebContainers — directly in your browser.
          You describe what you want, the agent plans, writes files, installs
          packages, runs a dev server, and shows the live preview — all on
          your machine, with your code never leaving it by default.
        </p>

        <div className="legal-pills" role="list">
          <div className="legal-pill" role="listitem">
            <div className="legal-pill__title">Local-first by default</div>
            <div className="legal-pill__body">
              Files, prompts, and runs stay in your browser. The cloud is opt-in,
              behind an explicit approval prompt.
            </div>
          </div>
          <div className="legal-pill" role="listitem">
            <div className="legal-pill__title">One tab to start</div>
            <div className="legal-pill__body">
              No install, no Docker, no auth. Open it in a modern browser and
              start typing an idea.
            </div>
          </div>
          <div className="legal-pill" role="listitem">
            <div className="legal-pill__title">Multi-provider LLM</div>
            <div className="legal-pill__body">
              Bring LM Studio, Ollama, or your favourite cloud model. Same UI,
              same agent loop.
            </div>
          </div>
          <div className="legal-pill" role="listitem">
            <div className="legal-pill__title">Open and inspectable</div>
            <div className="legal-pill__body">
              Every file write and shell command is shown to you before and
              after it runs.
            </div>
          </div>
        </div>
      </header>

      <H>The why</H>
      <p>
        Browser-based coding tools have a reputation for being toys. BoltWizard
        is an attempt to take the best parts — instant, local, shareable by a
        single URL — and combine them with the remarkable capability of large
        language models. The Linux-shaped sandbox runs Node.js, installs
        packages, and starts a dev server without leaving your page.
      </p>
      <p>
        Privacy isn't an afterthought here. When you choose a local LLM, your
        prompts and code never leave the device. When the agent wants to escalate
        to a stronger model, BoltWizard shows you exactly what's about to be
        sent — the provider, the payload, the cost — and asks for your approval.
      </p>

      <H>Get in touch</H>
      <p>
        Suggestions, bug reports, and kind critiques are welcome. Reach out at{' '}
        <a href="mailto:hello@boltwizard.app">hello@boltwizard.app</a> or open
        an issue on the project repository.
      </p>

      <p className="legal__signoff">
        — Built with care by <strong>Mohammad Saeed Angiz</strong>.
      </p>
    </article>
  );
}

function TermsPage() {
  return (
    <article className="legal__doc" aria-label="Terms of Service">
      <header className="legal__doc-head">
        <h1 className="legal__h1">Terms of Service</h1>
        <p className="muted small">Last updated {TODAY}.</p>
      </header>

      <p>
        These Terms of Service ("<strong>Terms</strong>") govern your use of
        BoltWizard ("<strong>we</strong>", "<strong>us</strong>",
        "<strong>the service</strong>"). By using the service you agree to
        these Terms. If you don't agree, don't use it.
      </p>

      <H>1. What BoltWizard is</H>
      <p>
        BoltWizard is a single-page web app that runs an in-browser sandbox
        (WebContainers) on your own device. It pairs that sandbox with local
        and third-party large language models to help you plan, generate, run,
        and preview full-stack applications — without sending your project off
        your machine by default.
      </p>

      <H>2. Eligibility</H>
      <p>
        You must be at least 13 years old. If you use BoltWizard on behalf of
        an organisation, you confirm you have authority to bind that
        organisation to these Terms.
      </p>

      <H>3. Acceptable use</H>
      <p>You agree not to use BoltWizard to:</p>
      <ul>
        <li>Produce or distribute malware, ransomware, phishing kits, or other malicious code.</li>
        <li>Violate any law or third-party right.</li>
        <li>Scrape, copy, or resell BoltWizard itself, its prompts, or its generated assets.</li>
        <li>Try to disrupt or reverse-engineer the service or its dependencies.</li>
      </ul>

      <H>4. Your content &amp; intellectual property</H>
      <p>
        You own everything you build in BoltWizard — files, prompts, generated
        code, designs, and any data you import. We claim no rights to your
        project. When you use a local LLM provider, we never see your content
        at all; the service only processes it on your device to operate the
        app.
      </p>

      <H>5. AI-generated output</H>
      <p>
        Code and other content produced by the model is provided
        "<strong>as is</strong>", without warranty of correctness, security,
        performance, or fitness for any particular purpose. You are
        responsible for reviewing, testing, and approving everything before
        you run or deploy it.
      </p>

      <H>6. Third-party providers</H>
      <p>
        <strong>Local LLMs (LM Studio, Ollama).</strong> When you choose a
        local provider, the model runs on your machine. The only network
        traffic is between your browser and your local model server.
      </p>
      <p>
        <strong>Cloud LLMs.</strong> If the agent asks to escalate to a cloud
        provider, BoltWizard shows you the payload, the provider, and an
        estimated cost. The call only proceeds after your explicit approval.
        Your data then travels to that provider under its own terms.
      </p>

      <H>7. No warranty</H>
      <p>
        BoltWizard is provided "<strong>as is</strong>" and
        "<strong>as available</strong>" without warranties of any kind, express
        or implied, including merchantability, fitness for a particular
        purpose, and non-infringement. We don't warrant that the service will
        be uninterrupted, error-free, or that generated code will be free of
        bugs or vulnerabilities.
      </p>

      <H>8. Limitation of liability</H>
      <p>
        To the maximum extent permitted by law, BoltWizard and its creator
        will not be liable for any indirect, incidental, special,
        consequential, or punitive damages, or any loss of profits, revenues,
        data, or goodwill, arising from your use of the service. Total
        liability for any claim will not exceed the amounts you paid us, if
        any, in the twelve months prior to the claim.
      </p>

      <H>9. Indemnity</H>
      <p>
        You agree to indemnify and hold BoltWizard harmless from claims,
        losses, and expenses (including reasonable legal fees) arising from
        your use of the service, your generated content, or your violation of
        these Terms or any third-party right.
      </p>

      <H>10. Paid tiers (if applicable)</H>
      <p>
        If BoltWizard offers paid features in the future, those features will
        be billed in advance. Refund, suspension, and cancellation terms will
        be stated at the point of purchase and incorporated into these Terms.
      </p>

      <H>11. Changes to these Terms</H>
      <p>
        We may update these Terms from time to time. The "Last updated" date
        at the top will reflect the change. Continued use of BoltWizard after
        a change means you accept the updated Terms.
      </p>

      <H>12. Termination</H>
      <p>
        You can stop using BoltWizard at any time by closing the page. We may
        suspend access to optional components (e.g. cloud escalation) for
        violations of these Terms or for operational reasons, with or without
        notice where reasonable.
      </p>

      <H>13. Governing law &amp; disputes</H>
      <p>
        These Terms are governed by the laws of your local jurisdiction,
        without regard to its conflict-of-laws rules. Any dispute will be
        resolved in the courts of your local jurisdiction.
      </p>

      <H>14. Contact</H>
      <p>
        Questions? Reach us at{' '}
        <a href="mailto:hello@boltwizard.app">hello@boltwizard.app</a>.
      </p>
    </article>
  );
}

function PrivacyPage() {
  return (
    <article className="legal__doc" aria-label="Privacy Policy">
      <header className="legal__doc-head">
        <h1 className="legal__h1">Privacy Policy</h1>
        <p className="muted small">Last updated {TODAY}.</p>
      </header>

      <div className="legal-pin">
        BoltWizard is local-first: <strong>by default, your code, prompts, and
        files never leave your device</strong>.
      </div>

      <H>1. The local-first promise</H>
      <p>
        The default mode runs your prompts, file writes, and command output
        entirely in your browser. With <strong>local LLM providers</strong>
        (LM Studio, Ollama), the language model also runs on your machine —
        no part of BoltWizard ever sees your prompts or code.
      </p>

      <H>2. WebContainer sandbox</H>
      <p>
        BoltWizard uses the in-browser WebContainer runtime to mount a
        virtual file system and execute Node.js processes. Everything the
        sandbox does — installs, dev servers, file edits — happens in your
        browser tab and disappears when you close it. Nothing is uploaded
        to us.
      </p>

      <H>3. Information we collect</H>
      <p>We collect the minimum to keep the app working:</p>
      <ul>
        <li>
          <strong>Local settings.</strong> Your provider, model, theme, and
          role configuration are stored in your browser's <code>localStorage</code>
          {' '}so the app remembers them between visits. You can clear this
          from your browser settings at any time.
        </li>
        <li>
          <strong>No account required.</strong> We don't require sign-up. If
          accounts are added later, the only required field will be an email
          address — used for sign-in and important security notices — never
          for marketing.
        </li>
        <li>
          <strong>No analytics on your code or files.</strong> We do not
          collect file names, file contents, prompts, or generated output —
          under any circumstances.
        </li>
      </ul>

      <H>4. Cloud LLM escalation (opt-in only)</H>
      <p>
        Sometimes the agent decides it needs a more capable model than what's
        running locally. In those moments, BoltWizard will:
      </p>
      <ol>
        <li>Show you exactly what will be sent (the prompt and any code context).</li>
        <li>Show you which provider will receive it and an estimate of cost.</li>
        <li>Ask for your explicit approval before the call goes out.</li>
      </ol>
      <p>
        If you approve, that data is transmitted to the chosen cloud provider
        under <strong>their</strong> terms and privacy policy. We display the
        recipient and payload before the call; the call only proceeds with
        your "yes".
      </p>

      <H>5. Local storage</H>
      <p>
        Your project state, chat transcript, in-flight files, and theme live
        in <code>localStorage</code> and the in-memory WebContainer on your
        device. You can clear them from the UI or your browser's site-data
        settings. Clearing is permanent and unrecoverable from our side,
        because we never received them in the first place.
      </p>

      <H>6. Cookies</H>
      <p>
        We use only the cookies / storages strictly required to keep the app
        working (your theme, your settings, and ephemeral session state). We
        do not use advertising cookies or third-party tracking cookies.
      </p>

      <H>7. Third parties</H>
      <p>
        Depending on what you choose to do in BoltWizard, the following
        third parties may receive data you choose to send:
      </p>
      <ul>
        <li>
          <strong>LM Studio</strong> and <strong>Ollama</strong> (local
          providers) — both run on your machine and receive no data from us.
        </li>
        <li>
          <strong>Cloud LLM providers</strong> of your choosing (e.g. OpenAI,
          Anthropic, Google). When you approve a cloud escalation, that
          provider receives your prompt and any code context, under their
          published privacy policy.
        </li>
        <li>
          <strong>No analytics providers</strong> receive per-event data
          tied to file or prompt content.
        </li>
      </ul>

      <H>8. Security</H>
      <ul>
        <li><strong>In transit:</strong> all cloud escalations are sent over HTTPS with TLS.</li>
        <li><strong>In the browser:</strong> the WebContainer runtime is
          sandboxed via cross-origin headers and operates in its own
          JavaScript realm.</li>
        <li><strong>In storage:</strong> localStorage keys are namespaced and
          transparently observable from the app's settings panel.</li>
      </ul>

      <H>9. Children</H>
      <p>
        BoltWizard is not directed to children under 13, and we do not
        knowingly collect personal information from anyone under 13. If you
        believe that's happened, contact{' '}
        <a href="mailto:hello@boltwizard.app">hello@boltwizard.app</a>.
      </p>

      <H>10. International transfers</H>
      <p>
        If you choose to escalate to a cloud provider, your data may be
        transferred to and processed in the country where that provider
        operates. Local-only mode never transfers anything off your device.
      </p>

      <H>11. Changes to this policy</H>
      <p>
        If we change this policy in a way that affects what we collect or how
        we use it, we'll update the "Last updated" date at the top and
        surface the change inside the app. Continued use of BoltWizard after
        a change means you accept it.
      </p>

      <H>12. Your rights</H>
      <p>
        Because BoltWizard is local-first, most of your data rights are
        exercised directly on your device:
      </p>
      <ul>
        <li><strong>Access</strong> — open BoltWizard; everything is right there.</li>
        <li><strong>Delete</strong> — clear site data in your browser, or via the in-app "Clear" action.</li>
        <li><strong>Export</strong> — copy your generated files from the editor or download them from the WebContainer.</li>
      </ul>

      <H>13. Contact</H>
      <p>
        Questions or concerns? Reach us at{' '}
        <a href="mailto:hello@boltwizard.app">hello@boltwizard.app</a>.
      </p>
    </article>
  );
}

/* ---------------- View shell with tab nav --------------------------------- */

/**
 * Renders the legal page selected by `route`. Hash navigation links to other
 * legal pages; "Back to app" returns to the workspace.
 */
export function LegalView({ route }: { route: LegalRoute }) {
  const close = () => {
    // Replace (don't push) the current history entry so the URL drops the
    // hash. pushState on its own does NOT fire `hashchange`, so dispatch the
    // event synthetically — that lets useLegalRoute flip back to `null` and
    // App.tsx re-renders the workspace. Browser back/forward lands on the
    // previous legal page (if any) instead of a duplicate empty-hash entry.
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  // Make sure the back/forward buttons don't get stuck on a stale hash when the
  // user expects to leave the legal page.
  useEffect(() => {
    const h = window.location.hash;
    if (isLegal(h.slice(1))) window.history.replaceState(null, '', `#${route}`);
  }, [route]);

  const Page = useMemo(() => {
    if (route === '/about') return <AboutPage />;
    if (route === '/terms') return <TermsPage />;
    return <PrivacyPage />;
  }, [route]);

  return (
    <main className="legal" aria-label="Legal and about pages">
      <div className="legal__bar">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={close}
          aria-label="Back to app"
        >
          <ArrowLeft size={14} />
          <span>Back to app</span>
        </button>
        <nav className="legal__nav" aria-label="Legal pages">
          {ROUTES.map((r) => (
            <a
              key={r}
              href={`#${r}`}
              className={
                'legal__navlink' + (r === route ? ' legal__navlink--active' : '')
              }
              aria-current={r === route ? 'page' : undefined}
            >
              {r === '/about' ? 'About' : r === '/terms' ? 'Terms' : 'Privacy'}
            </a>
          ))}
        </nav>
      </div>

      <div className="legal__body">
        {Page}
      </div>
    </main>
  );
}

/**
 * Reactive hash-route hook used by App.tsx to know whether to render the
 * workspace or the legal view.
 *
 * Returns one of:
 *   - `null`  → workspace (no hash, or hash not a legal route)
 *   - a `LegalRoute` → render <LegalView />
 */
export function useLegalRoute(): LegalRoute | null {
  // Lazy initialiser covers the very first paint (avoids a flash of the
  // workspace when reloading directly on /#/about).
  const read = (): LegalRoute | null => {
    const h = window.location.hash;
    const stripped = h.startsWith('#') ? h.slice(1) : h;
    return isLegal(stripped) ? stripped : null;
  };

  const [route, setRoute] = useState<LegalRoute | null>(read);

  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return route;
}
