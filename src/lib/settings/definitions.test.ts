import { describe, expect, it } from 'vitest';

import {
  SETTING_CATEGORIES,
  SETTING_DEFINITIONS,
  SETTINGS_BY_KEY,
  CATEGORY_LABELS,
  clamp,
  coerce,
  defaultSettings,
  definitionsFor,
  validate,
} from './definitions';

const byKey = (key: string) => SETTINGS_BY_KEY.get(key)!;

describe('the registry', () => {
  it('has no duplicate keys', () => {
    const keys = SETTING_DEFINITIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every setting a label and a description', () => {
    for (const d of SETTING_DEFINITIONS) {
      expect(d.label.length, d.key).toBeGreaterThan(0);
      expect(d.description.length, d.key).toBeGreaterThan(10);
    }
  });

  it('files every setting under a category that has a label', () => {
    for (const d of SETTING_DEFINITIONS) {
      expect(SETTING_CATEGORIES as readonly string[], d.key).toContain(d.category);
      expect(CATEGORY_LABELS[d.category], d.key).toBeTruthy();
    }
  });

  it('gives every number setting bounds', () => {
    // A number with no bounds cannot be clamped, which is the whole safety net.
    for (const d of SETTING_DEFINITIONS.filter((x) => x.type === 'number')) {
      expect(d.min, d.key).toBeDefined();
      expect(d.max, d.key).toBeDefined();
      expect(d.max!, d.key).toBeGreaterThan(d.min!);
    }
  });

  it('gives every default a value inside its own bounds', () => {
    for (const d of SETTING_DEFINITIONS.filter((x) => x.type === 'number')) {
      expect(d.default as number, d.key).toBeGreaterThanOrEqual(d.min!);
      expect(d.default as number, d.key).toBeLessThanOrEqual(d.max!);
    }
  });

  it('marks the security controls as sensitive', () => {
    // These are the ones whose change has to be recorded and explained.
    for (const key of [
      'security.sessionIdleMinutes',
      'security.maxFailedLogins',
      'security.passwordMinLength',
    ]) {
      expect(byKey(key).sensitive, key).toBe(true);
    }
  });

  it('returns a default for every declared setting', () => {
    expect(Object.keys(defaultSettings())).toHaveLength(SETTING_DEFINITIONS.length);
  });

  it('groups settings by category', () => {
    expect(definitionsFor('security').every((d) => d.category === 'security')).toBe(true);
    expect(definitionsFor('security').length).toBeGreaterThan(0);
  });
});

describe('coerce', () => {
  it('turns stored text into a number', () => {
    expect(coerce(byKey('security.maxFailedLogins'), '7')).toBe(7);
  });

  it('falls back to the default when the text is not a number', () => {
    // Better a working default than NaN propagating into a session timeout.
    expect(coerce(byKey('security.sessionIdleMinutes'), 'fifteen')).toBe(15);
  });

  it('falls back when nothing is stored', () => {
    expect(coerce(byKey('security.sessionIdleMinutes'), null)).toBe(15);
    expect(coerce(byKey('security.sessionIdleMinutes'), '')).toBe(15);
  });

  it('reads a boolean', () => {
    const d = byKey('documents.requireVirusScan');
    expect(coerce(d, 'true')).toBe(true);
    expect(coerce(d, '1')).toBe(true);
    expect(coerce(d, 'false')).toBe(false);
    expect(coerce(d, 'nonsense')).toBe(false);
  });

  it('passes a string through', () => {
    expect(coerce(byKey('activeWorkingYear'), '2027/2028')).toBe('2027/2028');
  });
});

describe('clamping on read', () => {
  it('will not let a password minimum drop below the floor', () => {
    // The point of clamping on read: the form is not the only writer. A script
    // or a direct database edit must not be able to weaken this.
    const d = byKey('security.passwordMinLength');
    expect(coerce(d, '1')).toBe(8);
    expect(coerce(d, '0')).toBe(8);
    expect(coerce(d, '-5')).toBe(8);
  });

  it('will not let a session run forever', () => {
    expect(coerce(byKey('security.sessionAbsoluteHours'), '99999')).toBe(720);
  });

  it('will not let an idle timeout be zero', () => {
    expect(coerce(byKey('security.sessionIdleMinutes'), '0')).toBe(5);
  });

  it('will not let lockout be disabled by setting attempts very high', () => {
    expect(coerce(byKey('security.maxFailedLogins'), '1000')).toBe(10);
  });

  it('leaves a value inside its bounds alone', () => {
    expect(clamp(byKey('security.maxFailedLogins'), 7)).toBe(7);
  });
});

describe('validate', () => {
  it('accepts a value inside the bounds', () => {
    expect(validate(byKey('security.maxFailedLogins'), '5').ok).toBe(true);
  });

  it('explains what is wrong, quoting the limit', () => {
    const result = validate(byKey('security.passwordMinLength'), '4');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('8');
      expect(result.error).toContain('Minimum password length');
    }
  });

  it('rejects a value above the maximum', () => {
    const result = validate(byKey('security.sessionIdleMinutes'), '9999');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('240');
  });

  it('rejects text where a number belongs', () => {
    expect(validate(byKey('security.lockoutMinutes'), 'soon').ok).toBe(false);
  });

  it('rejects a boolean that is neither', () => {
    expect(validate(byKey('documents.requireVirusScan'), 'maybe').ok).toBe(false);
    expect(validate(byKey('documents.requireVirusScan'), 'true').ok).toBe(true);
  });

  it('rejects an over-long string', () => {
    expect(validate(byKey('general.organisationName'), 'x'.repeat(501)).ok).toBe(false);
  });
});
