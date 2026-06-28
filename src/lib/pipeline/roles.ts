/**
 * Per-role model configuration. Each Presence role (referent/coder/guardian/
 * supervisor) can use a different provider+model+key. By default every role
 * inherits the app's base settings; the supervisor defaults to a stronger
 * cloud model for escalation. Roles persist to localStorage.
 */
import type { LlmSettings, ProviderKind } from '../llm/providers';
import { PROVIDERS } from '../llm/providers';
import type { RoleKey } from './types';

export interface RoleConfig {
  provider: ProviderKind;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export type RolesConfig = Record<RoleKey, RoleConfig>;

const ROLE_KEY = 'boltglm.roles';

export const ROLE_LABELS: Record<RoleKey, string> = {
  referent: 'Referent — brainstorm + PIF',
  coder: 'Coder — writes code',
  guardian: 'Guardian — reviews vs PIF',
  supervisor: 'Supervisor — escalation',
};

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  referent: 'Discusses the idea, asks clarifying questions, and authors the Project Instruction File.',
  coder: 'Writes code file-by-file inside the WebContainer sandbox.',
  guardian: 'Reviews every iteration against the PIF for semantic + architectural issues.',
  supervisor: 'A stronger model tasks can be escalated to with your approval.',
};

export function defaultRoles(base: LlmSettings): RolesConfig {
  const inherit = (): RoleConfig => ({
    provider: base.provider,
    model: base.model,
    apiKey: base.apiKey,
    baseUrl: base.baseUrl,
  });
  // Supervisor defaults to a capable cloud model (for escalation) unless base is local.
  const isLocal = base.provider === 'ollama' || base.provider === 'lmstudio';
  return {
    referent: inherit(),
    coder: inherit(),
    guardian: inherit(),
    supervisor: isLocal
      ? { provider: 'anthropic', model: PROVIDERS.anthropic.defaultModel, apiKey: '', baseUrl: PROVIDERS.anthropic.baseUrl }
      : inherit(),
  };
}

export function loadRoles(base: LlmSettings): RolesConfig {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RolesConfig>;
      return { ...defaultRoles(base), ...parsed } as RolesConfig;
    }
  } catch {
    /* ignore */
  }
  return defaultRoles(base);
}

export function saveRoles(roles: RolesConfig): void {
  localStorage.setItem(ROLE_KEY, JSON.stringify(roles));
}

/** Resolve the effective LlmSettings for a role: role override wins, base fills gaps. */
export function resolveSettings(
  role: RoleKey,
  roles: RolesConfig,
  base: LlmSettings,
): LlmSettings {
  const rc = roles[role];
  return {
    provider: rc.provider,
    model: rc.model || base.model,
    apiKey: rc.apiKey || base.apiKey,
    baseUrl: rc.baseUrl || base.baseUrl,
  };
}
