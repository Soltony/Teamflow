import { describe, expect, it } from 'vitest';

import { createProjectSchema, formatValidationError, taskInputSchema } from './project';

const validProject = (over: Record<string, unknown> = {}) => ({
  name: 'Core Banking Upgrade',
  description: 'Replace the core banking platform.',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  workingYear: '2026/2027',
  statusId: 'st-1',
  pmoDivisionId: 'dv-1',
  projectManagerId: 'u-1',
  responsibleDepartmentIds: ['d-1'],
  hasMilestones: false,
  hasCost: false,
  currency: 'ETB',
  ...over,
});

const milestone = (over: Record<string, unknown> = {}) => ({
  title: 'Phase One',
  description: 'The first phase of delivery.',
  startDate: '2026-01-01',
  dueDate: '2026-06-30',
  weight: 100,
  ...over,
});

describe('createProjectSchema', () => {
  it('accepts a well-formed project', () => {
    expect(createProjectSchema.safeParse(validProject()).success).toBe(true);
  });

  it('parses ISO strings into dates, as a server action receives them', () => {
    const parsed = createProjectSchema.parse(validProject());
    expect(parsed.startDate).toBeInstanceOf(Date);
  });

  it('rejects an end date before the start date', () => {
    const result = createProjectSchema.safeParse(
      validProject({ startDate: '2026-12-31', endDate: '2026-01-01' }),
    );
    expect(result.success).toBe(false);
  });

  it('requires at least one responsible department', () => {
    expect(createProjectSchema.safeParse(validProject({ responsibleDepartmentIds: [] })).success).toBe(false);
  });

  describe('participating divisions', () => {
    it('defaults to none, since most projects are run by their owner alone', () => {
      const parsed = createProjectSchema.parse(validProject());
      expect(parsed.participatingDivisionIds).toEqual([]);
    });

    it('accepts other divisions delivering alongside the owner', () => {
      const result = createProjectSchema.safeParse(
        validProject({ participatingDivisionIds: ['dv-2', 'dv-3'] }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects the owning division listed again as a participant', () => {
      const result = createProjectSchema.safeParse(
        validProject({ pmoDivisionId: 'dv-1', participatingDivisionIds: ['dv-1'] }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects the same division listed twice', () => {
      const result = createProjectSchema.safeParse(
        validProject({ participatingDivisionIds: ['dv-2', 'dv-2'] }),
      );
      expect(result.success).toBe(false);
    });
  });

  it.each([['name', 'ab'], ['description', 'short']])(
    'rejects a too-short %s',
    (field, value) => {
      expect(createProjectSchema.safeParse(validProject({ [field]: value })).success).toBe(false);
    },
  );

  it('rejects a currency it does not support', () => {
    expect(createProjectSchema.safeParse(validProject({ currency: 'GBP' })).success).toBe(false);
  });

  describe('milestone weights', () => {
    it('accepts weights totalling exactly 100', () => {
      const result = createProjectSchema.safeParse(
        validProject({
          hasMilestones: true,
          milestones: [milestone({ weight: 40 }), milestone({ weight: 60 })],
        }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects weights totalling less than 100', () => {
      // The rule that was missing: "must not exceed 100" allowed 70, which is
      // what made a fully delivered project report 70%.
      const result = createProjectSchema.safeParse(
        validProject({
          hasMilestones: true,
          milestones: [milestone({ weight: 40 }), milestone({ weight: 30 })],
        }),
      );
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).toContain('must total exactly 100');
    });

    it('rejects weights totalling more than 100', () => {
      const result = createProjectSchema.safeParse(
        validProject({
          hasMilestones: true,
          milestones: [milestone({ weight: 70 }), milestone({ weight: 60 })],
        }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects a milestone due after the project ends', () => {
      const result = createProjectSchema.safeParse(
        validProject({
          hasMilestones: true,
          milestones: [milestone({ dueDate: '2027-06-30' })],
        }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects a milestone starting before the project does', () => {
      const result = createProjectSchema.safeParse(
        validProject({
          hasMilestones: true,
          milestones: [milestone({ startDate: '2025-06-30' })],
        }),
      );
      expect(result.success).toBe(false);
    });

    it('ignores milestone rules when the project has none', () => {
      expect(createProjectSchema.safeParse(validProject({ hasMilestones: false })).success).toBe(true);
    });
  });

  describe('cost', () => {
    it('accepts payments summing to the total cost', () => {
      const result = createProjectSchema.safeParse(
        validProject({
          hasCost: true,
          totalCost: 1000,
          payments: [
            { title: 'Deposit', amount: 400, paymentDate: '2026-02-01' },
            { title: 'Balance', amount: 600, paymentDate: '2026-11-01' },
          ],
        }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects payments that do not sum to the total cost', () => {
      const result = createProjectSchema.safeParse(
        validProject({
          hasCost: true,
          totalCost: 1000,
          payments: [{ title: 'Deposit', amount: 400, paymentDate: '2026-02-01' }],
        }),
      );
      expect(result.success).toBe(false);
    });

    it('tolerates rounding to the cent', () => {
      const result = createProjectSchema.safeParse(
        validProject({
          hasCost: true,
          totalCost: 100,
          payments: [
            { title: 'Instalment one', amount: 33.33, paymentDate: '2026-02-01' },
            { title: 'Instalment two', amount: 33.33, paymentDate: '2026-03-01' },
            { title: 'Instalment three', amount: 33.34, paymentDate: '2026-04-01' },
          ],
        }),
      );
      expect(result.success).toBe(true);
    });

    it('requires a total cost when the project is marked as having one', () => {
      expect(createProjectSchema.safeParse(validProject({ hasCost: true })).success).toBe(false);
    });

    it('rejects a payment with a non-positive amount', () => {
      const result = createProjectSchema.safeParse(
        validProject({
          hasCost: true,
          totalCost: 0,
          payments: [{ title: 'Zero instalment', amount: 0, paymentDate: '2026-02-01' }],
        }),
      );
      expect(result.success).toBe(false);
    });
  });

  it('strips fields the form never exposes', () => {
    const parsed = createProjectSchema.parse(
      validProject({ baselineEndDate: '1999-01-01', rebaselineCount: 99 } as Record<string, unknown>),
    );
    expect(parsed).not.toHaveProperty('baselineEndDate');
    expect(parsed).not.toHaveProperty('rebaselineCount');
  });
});

describe('taskInputSchema', () => {
  const validTask = (over: Record<string, unknown> = {}) => ({
    title: 'Write the migration',
    description: 'Add the new columns.',
    startDate: '2026-01-01',
    endDate: '2026-01-15',
    weight: 25,
    assignedUserIds: ['u-1'],
    ...over,
  });

  it('accepts a well-formed task', () => {
    expect(taskInputSchema.safeParse(validTask()).success).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    expect(taskInputSchema.safeParse(validTask({ endDate: '2025-12-01' })).success).toBe(false);
  });

  it('rejects a weight above 100', () => {
    expect(taskInputSchema.safeParse(validTask({ weight: 140 })).success).toBe(false);
  });

  it('rejects progress outside 0-100', () => {
    expect(taskInputSchema.safeParse(validTask({ progress: 140 })).success).toBe(false);
  });

  it('rejects a status it does not recognise', () => {
    expect(taskInputSchema.safeParse(validTask({ status: 'ALMOST' })).success).toBe(false);
  });
});

describe('formatValidationError', () => {
  it('names the offending field so the user knows what to fix', () => {
    const result = createProjectSchema.safeParse(validProject({ name: 'ab' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatValidationError(result.error)).toContain('name');
    }
  });

  it('summarises rather than listing every issue', () => {
    const result = createProjectSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = formatValidationError(result.error);
      expect(message).toContain('more');
      expect(message.length).toBeLessThan(400);
    }
  });
});
