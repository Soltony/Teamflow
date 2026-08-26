/**
 * Every value the bank can change without a redeploy.
 *
 * The system had exactly one setting — the active working year — and everything
 * else was a constant in a source file: how long a session lasts, how many
 * failed sign-ins lock an account, how short a password may be, how large an
 * upload may be. Each of those is a policy decision that belongs to the bank's
 * security and governance people, and each needed a developer and a deployment
 * to change.
 *
 * Declaring them here once means the Settings page renders itself from this
 * list and the rest of the code reads values through `getSetting`. Adding a
 * setting is one entry, not a form field plus a migration plus a reader.
 *
 * Pure: no Prisma, no React, so the definitions and their bounds can be tested
 * directly.
 */

export type SettingType = 'number' | 'string' | 'boolean' | 'select';

export const SETTING_CATEGORIES = [
  'general',
  'security',
  'documents',
  'governance',
] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SettingCategory, string> = {
  general: 'General',
  security: 'Security and sign-in',
  documents: 'Documents',
  governance: 'Governance',
};

export const CATEGORY_DESCRIPTIONS: Record<SettingCategory, string> = {
  general: 'Values that affect the whole system.',
  security: 'How sign-in, sessions and passwords behave. Changes here are recorded.',
  documents: 'Limits on what may be uploaded to a project.',
  governance: 'The approvals and controls a project has to pass through.',
};

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  type: SettingType;
  default: string | number | boolean;
  /**
   * Hard bounds, enforced when the value is read — not only in the form.
   *
   * The form is not the only way a row can change: a migration, a support
   * script or a direct database edit can all write one. Clamping on read means
   * a value outside these bounds cannot weaken the system, it can only fail to
   * take effect.
   */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  /**
   * A security control. Changing one is written to the audit trail with the
   * old and new values, and the UI says so before you change it.
   */
  sensitive?: boolean;
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  // ------------------------------------------------------------- general
  {
    // Unprefixed because four existing call sites already read this key.
    key: 'activeWorkingYear',
    label: 'Active working year',
    description:
      'The year new projects default to, and the one the dashboard reports on.',
    category: 'general',
    type: 'string',
    default: '2026/2027',
  },
  {
    key: 'general.organisationName',
    label: 'Organisation name',
    description: 'Shown in page titles, reports and notification messages.',
    category: 'general',
    type: 'string',
    default: 'NIB Bank',
  },

  // ------------------------------------------------------------ security
  {
    key: 'security.sessionIdleMinutes',
    label: 'Sign out after inactivity',
    description:
      'How long a session may sit idle before the person has to sign in again. Shorter is safer on a shared machine; too short and people lose work.',
    category: 'security',
    type: 'number',
    default: 15,
    min: 5,
    max: 240,
    step: 5,
    unit: 'minutes',
    sensitive: true,
  },
  {
    key: 'security.sessionAbsoluteHours',
    label: 'Maximum session length',
    description:
      'A session is ended after this long no matter how active it has been, so a stolen cookie cannot be used indefinitely.',
    category: 'security',
    type: 'number',
    default: 168,
    min: 1,
    max: 720,
    step: 1,
    unit: 'hours',
    sensitive: true,
  },
  {
    key: 'security.maxFailedLogins',
    label: 'Failed sign-ins before lock',
    description:
      'How many wrong passwords in a row lock an account. Low enough to stop guessing, high enough that a typo is not a support call.',
    category: 'security',
    type: 'number',
    default: 5,
    min: 3,
    max: 10,
    step: 1,
    unit: 'attempts',
    sensitive: true,
  },
  {
    key: 'security.lockoutMinutes',
    label: 'Lock lasts for',
    description: 'How long an account stays locked after too many failed sign-ins.',
    category: 'security',
    type: 'number',
    default: 15,
    min: 5,
    max: 1440,
    step: 5,
    unit: 'minutes',
    sensitive: true,
  },
  {
    key: 'security.passwordMinLength',
    label: 'Minimum password length',
    description:
      'The shortest password the system will accept. It cannot be set below eight, whatever is written to the database.',
    category: 'security',
    type: 'number',
    default: 8,
    min: 8,
    max: 64,
    step: 1,
    unit: 'characters',
    sensitive: true,
  },

  // ----------------------------------------------------------- documents
  {
    key: 'documents.maxUploadMb',
    label: 'Largest file that may be uploaded',
    description:
      'Applies to every document attached to a project. Larger files are refused before they reach storage.',
    category: 'documents',
    type: 'number',
    default: 25,
    min: 1,
    max: 200,
    step: 1,
    unit: 'MB',
  },
  {
    key: 'documents.requireVirusScan',
    label: 'Refuse uploads when no scanner is available',
    description:
      'There is no malware scanner configured. Turn this on to reject every upload rather than store an unscanned file — a deployment that cannot accept that risk should have this on.',
    category: 'documents',
    type: 'boolean',
    default: false,
    sensitive: true,
  },

  // ---------------------------------------------------------- governance
  {
    key: 'governance.projectsOverdueWarningDays',
    label: 'Warn this long before a deadline',
    description:
      'How many days ahead the dashboard starts flagging a project or milestone as approaching its date.',
    category: 'governance',
    type: 'number',
    default: 7,
    min: 1,
    max: 90,
    step: 1,
    unit: 'days',
  },
  {
    key: 'governance.blockerEscalationDays',
    label: 'Escalate an unresolved issue after',
    description:
      'How long a high or critical issue may sit open before the register flags it as needing escalation.',
    category: 'governance',
    type: 'number',
    default: 5,
    min: 1,
    max: 60,
    step: 1,
    unit: 'days',
  },
];

export const SETTINGS_BY_KEY = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]));

export function definitionsFor(category: SettingCategory): SettingDefinition[] {
  return SETTING_DEFINITIONS.filter((d) => d.category === category);
}

/** The value every setting takes when nothing has been saved. */
export function defaultSettings(): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const d of SETTING_DEFINITIONS) out[d.key] = d.default;
  return out;
}

/**
 * Turns whatever is stored into the type the definition promises.
 *
 * Everything is written to the database as text, and a row can be written by
 * something other than the form. A value that will not parse falls back to the
 * default rather than propagating `NaN` into a session timeout.
 */
export function coerce(
  definition: SettingDefinition,
  raw: string | null | undefined,
): string | number | boolean {
  if (raw === null || raw === undefined || raw === '') return definition.default;

  switch (definition.type) {
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return definition.default;
      return clamp(definition, n);
    }
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'select':
      return definition.options?.some((o) => o.value === raw) ? raw : definition.default;
    default:
      return raw;
  }
}

/**
 * Holds a number inside the definition's bounds.
 *
 * Applied on read, not just on write. A password minimum of one, or a session
 * timeout of zero, must not take effect however it got into the table.
 */
export function clamp(definition: SettingDefinition, value: number): number {
  let out = value;
  if (definition.min !== undefined) out = Math.max(definition.min, out);
  if (definition.max !== undefined) out = Math.min(definition.max, out);
  return out;
}

/** Validates a value on its way in, so the form can say what is wrong. */
export function validate(
  definition: SettingDefinition,
  raw: string,
): { ok: true } | { ok: false; error: string } {
  if (definition.type === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: `${definition.label} must be a number.` };
    if (definition.min !== undefined && n < definition.min) {
      return {
        ok: false,
        error: `${definition.label} cannot be below ${definition.min}${
          definition.unit ? ` ${definition.unit}` : ''
        }.`,
      };
    }
    if (definition.max !== undefined && n > definition.max) {
      return {
        ok: false,
        error: `${definition.label} cannot be above ${definition.max}${
          definition.unit ? ` ${definition.unit}` : ''
        }.`,
      };
    }
    return { ok: true };
  }

  if (definition.type === 'boolean') {
    return raw === 'true' || raw === 'false'
      ? { ok: true }
      : { ok: false, error: `${definition.label} must be true or false.` };
  }

  if (definition.type === 'select') {
    return definition.options?.some((o) => o.value === raw)
      ? { ok: true }
      : { ok: false, error: `${raw} is not one of the choices for ${definition.label}.` };
  }

  if (raw.length > 500) {
    return { ok: false, error: `${definition.label} is too long.` };
  }
  return { ok: true };
}
