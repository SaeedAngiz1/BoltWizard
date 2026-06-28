/**
 * Settings — LLM provider + key/model/baseUrl configuration modal.
 *
 * Keys persist to localStorage in this browser only (see lib/llm/providers.ts).
 * Includes a "Test connection" probe that fires a tiny one-shot message through
 * streamChat and reports success/failure as a toast.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Wand2,
  X,
  ScanSearch,
} from 'lucide-react';
import { useStore } from '../store';
import { PROVIDERS, type ProviderKind } from '../lib/llm/providers';
import { streamChat, listLocalModels } from '../lib/llm/client';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type RolesConfig,
} from '../lib/pipeline/roles';
import type { RoleKey } from '../lib/pipeline/types';

const ROLE_ORDER: RoleKey[] = ['referent', 'coder', 'guardian', 'supervisor'];

export function Settings() {
  const open = useStore((s) => s.settingsOpen);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const toggle = useStore((s) => s.toggleSettings);
  const pushToast = useStore((s) => s.pushToast);
  const roles = useStore((s) => s.roles);
  const setRole = useStore((s) => s.setRole);
  const maxIterations = useStore((s) => s.maxIterations);
  const setMaxIterations = useStore((s) => s.setMaxIterations);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  /** Auto-detect the loaded model for a local server (LM Studio / Ollama) by
   *  querying its /v1/models endpoint through the same-origin proxy. Picks the
   *  first chat-capable model and writes it into settings. Returns true on hit. */
  const detectModel = async (id: ProviderKind, baseUrl: string): Promise<boolean> => {
    setDetecting(true);
    try {
      const models = await listLocalModels({ provider: id, apiKey: '', model: '', baseUrl });
      if (models.length) {
        useStore.getState().setSettings({ model: models[0] });
        pushToast('success', `Detected model: ${models[0]}`);
        return true;
      }
      pushToast('error', `No models found on ${id}. Start the server and load a model.`);
      return false;
    } catch {
      pushToast('error', `Could not reach ${id} server at ${baseUrl}.`);
      return false;
    } finally {
      setDetecting(false);
    }
  };

  // Focus the modal container on open for keyboard users; reset transient UI.
  useEffect(() => {
    if (open) {
      setShowKey(false);
      setTesting(false);
      // Defer to next frame so the element is mounted.
      requestAnimationFrame(() => dialogRef.current?.focus());
    }
  }, [open]);

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggle(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, toggle]);

  if (!open) return null;

  const provider = PROVIDERS[settings.provider];
  const keyMissing = provider.needsKey && !settings.apiKey.trim();

  const close = () => toggle(false);

  const testConnection = async () => {
    if (testing) return;
    if (keyMissing) {
      pushToast('error', `Enter your ${provider.label} API key first.`);
      return;
    }
    setTesting(true);
    try {
      await streamChat(
        settings,
        [{ role: 'user', content: 'Reply with the single word: ok' }],
        () => {
          /* ignore streaming tokens for a connection probe */
        },
      );
      pushToast('success', `${provider.label} connection working.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast('error', `Connection failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={close}
      role="presentation"
    >
      <div
        className="modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="LLM settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3>LLM settings</h3>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close settings"
            onClick={close}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="modal__row">
          <div className="field">
            <label className="field__label" htmlFor="set-provider">Provider</label>
            <select
              id="set-provider"
              className="select"
              value={settings.provider}
              onChange={(e) => {
                const id = e.target.value as ProviderKind;
                const def = PROVIDERS[id];
                setSettings({
                  provider: id,
                  baseUrl: def.baseUrl,
                  model: def.defaultModel,
                  apiKey: '',
                });
                setShowKey(false);
                // For local servers, auto-detect the actually-loaded model
                // instead of leaving the unusable "local-model" placeholder.
                if (id === 'lmstudio' || id === 'ollama') {
                  void detectModel(id, def.baseUrl);
                }
              }}
            >
              {Object.values(PROVIDERS).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="faint">
              {provider.needsKey
                ? 'Cloud model — your API key is sent directly to the provider from this tab.'
                : 'Local model — start the server, then ensure CORS allows this origin.'}
            </p>
          </div>
        </div>

        {provider.needsKey && (
          <div className="modal__row">
            <div className="field">
              <label className="field__label" htmlFor="set-key">
                API key
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  id="set-key"
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  placeholder="sk-…"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setSettings({ apiKey: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  title={showKey ? 'Hide API key' : 'Show API key'}
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              <p className="faint">Stored in this browser only (localStorage). Visible in DevTools.</p>
            </div>
          </div>
        )}

        <div className="modal__row">
          <div className="field">
            <label className="field__label" htmlFor="set-model">Model</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="set-model"
                className="input"
                value={settings.model}
                placeholder={provider.defaultModel}
                spellCheck={false}
                onChange={(e) => setSettings({ model: e.target.value })}
              />
              {(settings.provider === 'lmstudio' || settings.provider === 'ollama') && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Detect loaded model"
                  title="Detect loaded model from server"
                  disabled={detecting}
                  onClick={() => void detectModel(settings.provider, settings.baseUrl)}
                >
                  {detecting ? (
                    <Loader2 size={16} aria-hidden="true" className="icon-spin" />
                  ) : (
                    <ScanSearch size={16} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
            {(settings.provider === 'lmstudio' || settings.provider === 'ollama') && (
              <p className="faint">
                Must match a loaded model id (e.g. <code>meta-llama-3.1-8b-instruct</code>).
                Use the detect button if unsure.
              </p>
            )}
          </div>
        </div>

        <div className="modal__row">
          <div className="field">
            <label className="field__label" htmlFor="set-baseurl">Base URL</label>
            <input
              id="set-baseurl"
              className="input"
              value={settings.baseUrl}
              spellCheck={false}
              onChange={(e) => setSettings({ baseUrl: e.target.value })}
            />
          </div>
        </div>

        <div className="modal__row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          {(() => {
            // provider.docs may embed a human hint after a space/paren
            // (e.g. "https://ollama.com/download  (set OLLAMA_ORIGINS=*)").
            // Strip from the first whitespace so the href stays valid; only
            // treat it as an external link when it begins with http(s)://.
            const docsUrl = provider.docs.split(/\s/)[0] ?? '';
            const isLink = /^https?:\/\//.test(docsUrl);
            return (
              <a
                className="muted"
                href={isLink ? docsUrl : undefined}
                target={isLink ? '_blank' : undefined}
                rel="noreferrer noopener"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {isLink ? docsUrl : provider.docs}
              </a>
            );
          })()}

          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={testConnection}
            disabled={testing || keyMissing}
          >
            {testing ? (
              <Loader2 size={14} aria-hidden="true" className="icon-spin" />
            ) : (
              <Wand2 size={14} aria-hidden="true" />
            )}
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>

        <div className="modal__row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn--primary" onClick={close}>
            Done
          </button>
        </div>

        {/* ---- Roles: per-Presence-role provider/model/key ---- */}
        <div className="modal__section">
          <div className="modal__section-head">
            <h4>Roles</h4>
            <p className="faint">
              Local-first: choose Ollama/LM Studio for any role to keep code on your machine.
            </p>
          </div>

          <div className="modal__row">
            <div className="field">
              <label className="field__label" htmlFor="set-max-iter">Max iterations</label>
              <input
                id="set-max-iter"
                className="input"
                type="number"
                min={1}
                max={10}
                step={1}
                value={maxIterations}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) setMaxIterations(n);
                }}
              />
              <p className="faint">
                How many coder→guardian loops a task may run before escalation.
              </p>
            </div>
          </div>

          {ROLE_ORDER.map((role) => {
            const rc: RolesConfig[RoleKey] = roles[role];
            const rp = PROVIDERS[rc.provider];
            const roleNeedsKey = rp.needsKey && !rc.apiKey.trim();
            return (
              <div className="modal__row role-row" key={role}>
                <div className="role-row__head">
                  <span className="role-row__label">{ROLE_LABELS[role]}</span>
                  <span className="faint">{ROLE_DESCRIPTIONS[role]}</span>
                </div>
                <div className="role-row__fields">
                  <div className="field">
                    <label className="field__label" htmlFor={`role-${role}-provider`}>
                      Provider
                    </label>
                    <select
                      id={`role-${role}-provider`}
                      className="select"
                      value={rc.provider}
                      onChange={(e) => {
                        const id = e.target.value as ProviderKind;
                        const def = PROVIDERS[id];
                        setRole(role, {
                          provider: id,
                          baseUrl: def.baseUrl,
                          model: def.defaultModel,
                          apiKey: '',
                        });
                      }}
                    >
                      {Object.values(PROVIDERS).map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor={`role-${role}-model`}>
                      Model
                    </label>
                    <input
                      id={`role-${role}-model`}
                      className="input"
                      value={rc.model}
                      placeholder={rp.defaultModel}
                      spellCheck={false}
                      onChange={(e) => setRole(role, { model: e.target.value })}
                    />
                  </div>

                  {rp.needsKey && (
                    <div className="field">
                      <label className="field__label" htmlFor={`role-${role}-key`}>
                        API key
                      </label>
                      <input
                        id={`role-${role}-key`}
                        className="input"
                        type="password"
                        value={rc.apiKey}
                        placeholder="sk-…"
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={roleNeedsKey}
                        onChange={(e) => setRole(role, { apiKey: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Settings;
