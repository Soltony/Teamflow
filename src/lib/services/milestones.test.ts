import { describe, expect, it } from 'vitest';

import { GENERAL_TASKS_TITLE, isGeneralTasksMilestone, residualWeight } from './milestones';
import { projectProgress } from '@/lib/metrics';

describe('residualWeight', () => {
  it('gives the holding milestone whatever the named ones have left', () => {
    expect(residualWeight([30, 50])).toBe(20);
  });

  it('gives it the whole 100 when nothing else is weighted', () => {
    expect(residualWeight([])).toBe(100);
    expect(residualWeight([0, 0])).toBe(100);
  });

  it('never goes negative when the named milestones already overshoot', () => {
    expect(residualWeight([70, 60])).toBe(0);
  });

  it('is exactly 0 when the named milestones already total 100', () => {
    expect(residualWeight([40, 60])).toBe(0);
  });

  it('tolerates floating point weights', () => {
    expect(residualWeight([33.33, 33.33])).toBeCloseTo(33.34, 2);
  });

  it('treats missing weights as zero', () => {
    expect(residualWeight([50, NaN as unknown as number])).toBe(50);
  });
});

describe('isGeneralTasksMilestone', () => {
  it('recognises the holding milestone', () => {
    expect(isGeneralTasksMilestone({ title: GENERAL_TASKS_TITLE })).toBe(true);
  });

  it('does not match a real milestone', () => {
    expect(isGeneralTasksMilestone({ title: 'Phase 1' })).toBe(false);
    expect(isGeneralTasksMilestone(null)).toBe(false);
    expect(isGeneralTasksMilestone({})).toBe(false);
  });
});

describe('project-level tasks and progress', () => {
  it('counts project-level work when the holding milestone carries the residual', () => {
    // Named milestone weighs 60, so the holding milestone gets 40. A project
    // with the named half done and the project-level half untouched is 60%
    // of 60 = 36... and with 0% on the other 40, exactly 60 * 1.0 = 60.
    const project = {
      milestones: [
        { weight: 60, tasks: [{ weight: 100, progress: 100 }] },
        { weight: residualWeight([60]), tasks: [{ weight: 100, progress: 0 }] },
      ],
    };
    expect(projectProgress(project)).toBe(60);
  });

  it('would have excluded that work entirely at the old weight of 0', () => {
    // The bug this helper fixes: addTask created the holding milestone with
    // weight 0, so project-level tasks contributed nothing at all and the
    // project read 100% with half its work untouched.
    const withOldWeight = {
      milestones: [
        { weight: 60, tasks: [{ weight: 100, progress: 100 }] },
        { weight: 0, tasks: [{ weight: 100, progress: 0 }] },
      ],
    };
    // Normalisation in the metrics module now rescues the common case, but
    // only because 60 leaves a shortfall for the unweighted milestone to take.
    expect(projectProgress(withOldWeight)).toBe(60);

    // Where the named milestones already total 100 there is no shortfall, and
    // a zero-weight holding milestone really is invisible — which is why the
    // weight has to be maintained rather than guessed at read time.
    const noShortfall = {
      milestones: [
        { weight: 100, tasks: [{ weight: 100, progress: 100 }] },
        { weight: 0, tasks: [{ weight: 100, progress: 0 }] },
      ],
    };
    expect(projectProgress(noShortfall)).toBe(100);
  });

  it('reaches 100 only when both the named and project-level work are done', () => {
    const project = {
      milestones: [
        { weight: 60, tasks: [{ weight: 100, progress: 100 }] },
        { weight: residualWeight([60]), tasks: [{ weight: 100, progress: 100 }] },
      ],
    };
    expect(projectProgress(project)).toBe(100);
  });
});
