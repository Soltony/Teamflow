import { describe, expect, it } from 'vitest';

import {
  canTransition,
  checkCharter,
  checkClosure,
  isInPortfolio,
  transitionError,
} from './lifecycle';

describe('stage transitions', () => {
  it('walks a project through the normal sequence', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransition('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'CLOSING')).toBe(true);
    expect(canTransition('CLOSING', 'CLOSED')).toBe(true);
  });

  it('refuses to skip the approval gate', () => {
    // The behaviour this whole gate exists to prevent: work entering the
    // portfolio without anyone agreeing to it.
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false);
    expect(canTransition('DRAFT', 'CLOSED')).toBe(false);
  });

  it('refuses to close a project that never started', () => {
    expect(canTransition('SUBMITTED', 'CLOSED')).toBe(false);
    expect(canTransition('APPROVED', 'CLOSED')).toBe(false);
  });

  it('lets a sponsor send a submission back', () => {
    expect(canTransition('SUBMITTED', 'DRAFT')).toBe(true);
  });

  it('lets closure be abandoned and delivery resumed', () => {
    expect(canTransition('CLOSING', 'APPROVED')).toBe(true);
  });

  it('treats closed and cancelled as terminal', () => {
    for (const target of ['DRAFT', 'SUBMITTED', 'APPROVED', 'CLOSING'] as const) {
      expect(canTransition('CLOSED', target), `CLOSED -> ${target}`).toBe(false);
      expect(canTransition('CANCELLED', target), `CANCELLED -> ${target}`).toBe(false);
    }
  });

  it('can be cancelled from any live stage', () => {
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransition('SUBMITTED', 'CANCELLED')).toBe(true);
    expect(canTransition('APPROVED', 'CANCELLED')).toBe(true);
  });

  it('explains a refusal in terms of what is allowed', () => {
    expect(transitionError('DRAFT', 'APPROVED')).toContain('submitted');
    expect(transitionError('CLOSED', 'APPROVED')).toContain('cannot change stage');
  });
});

describe('isInPortfolio', () => {
  it('counts only work that has been approved and is not yet closed', () => {
    expect(isInPortfolio('APPROVED')).toBe(true);
    expect(isInPortfolio('CLOSING')).toBe(true);
    expect(isInPortfolio('DRAFT')).toBe(false);
    expect(isInPortfolio('SUBMITTED')).toBe(false);
    expect(isInPortfolio('CLOSED')).toBe(false);
    expect(isInPortfolio('CANCELLED')).toBe(false);
  });
});

describe('checkCharter', () => {
  const complete = {
    charter: 'Replace the core banking interface.',
    businessCase: 'Reduces manual reconciliation by 30%.',
    projectManagerId: 'u1',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };

  it('accepts a complete charter', () => {
    expect(checkCharter(complete)).toEqual({ ok: true, missing: [] });
  });

  it('names what is missing rather than just refusing', () => {
    const result = checkCharter({ ...complete, charter: '', businessCase: null });
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(2);
    expect(result.missing.join(' ')).toContain('charter');
    expect(result.missing.join(' ')).toContain('business case');
  });

  it('does not accept whitespace as a charter', () => {
    expect(checkCharter({ ...complete, charter: '   ' }).ok).toBe(false);
  });

  it('requires a named project manager and dates', () => {
    expect(checkCharter({ ...complete, projectManagerId: null }).ok).toBe(false);
    expect(checkCharter({ ...complete, endDate: null }).ok).toBe(false);
  });
});

describe('checkClosure', () => {
  const complete = {
    deliverablesAccepted: true,
    paymentsSettled: true,
    blockersClosed: true,
    handoverAcknowledged: true,
    lessonsLearned: 'Estimates for integration work were consistently optimistic.',
  };

  it('accepts a complete checklist', () => {
    expect(checkClosure(complete)).toEqual({ ok: true, outstanding: [] });
  });

  it('refuses closure with anything outstanding, and says what', () => {
    const result = checkClosure({ ...complete, paymentsSettled: false, blockersClosed: false });
    expect(result.ok).toBe(false);
    expect(result.outstanding).toEqual(['payments settled', 'blockers closed']);
  });

  it('requires lessons learned, which is the point of closing properly', () => {
    expect(checkClosure({ ...complete, lessonsLearned: '' }).ok).toBe(false);
    expect(checkClosure({ ...complete, lessonsLearned: '   ' }).ok).toBe(false);
    expect(checkClosure({ ...complete, lessonsLearned: null }).outstanding).toContain(
      'lessons learned recorded',
    );
  });
});
