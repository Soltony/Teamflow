/**
 * Weighted completion.
 *
 * This replaces seven copy-pasted implementations that shared three defects:
 *
 *  1. They summed `progress × weight / 100` without dividing by the total
 *     weight, so the answer was only right when weights happened to add to
 *     exactly 100. A milestone whose tasks weigh 70 in total reported 70% with
 *     every task finished.
 *  2. They filtered to `weight > 0`, which silently discarded the auto-created
 *     "General Tasks" milestone whenever a project also had weighted ones — so
 *     project-level tasks contributed nothing at all.
 *  3. Milestones with no tasks were treated as 0% rather than as unstarted
 *     weight, which is the same number but for the wrong reason, and diverged
 *     as soon as anyone tried to fix (1).
 *
 * Everything here is pure so it can be unit tested and used identically on the
 * server and in a component.
 */

export interface TaskLike {
  weight?: number | null;
  progress?: number | null;
}

export interface MilestoneLike {
  weight?: number | null;
  tasks?: TaskLike[] | null;
}

export interface ProjectLike {
  milestones?: MilestoneLike[] | null;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/**
 * Weighted average of a set of {weight, value} pairs, normalised by the weight
 * actually present.
 *
 * Members with no declared weight share whatever weight is left over after the
 * declared ones, so nothing is silently excluded. When nothing declares a
 * weight, every member counts equally.
 */
function weightedAverage(members: { weight: number; value: number }[]): number {
  if (members.length === 0) return 0;

  const declared = members.filter((m) => m.weight > 0);
  const undeclared = members.filter((m) => !(m.weight > 0));

  if (declared.length === 0) {
    const total = members.reduce((sum, m) => sum + m.value, 0);
    return clampPercent(total / members.length);
  }

  const declaredWeight = declared.reduce((sum, m) => sum + m.weight, 0);

  // Weights are expressed as percentages. If they do not reach 100 and there
  // are unweighted members, the shortfall belongs to them.
  const shortfall = Math.max(0, 100 - declaredWeight);
  const perUndeclared = undeclared.length > 0 ? shortfall / undeclared.length : 0;

  const weighted = [
    ...declared.map((m) => ({ weight: m.weight, value: m.value })),
    ...undeclared.map((m) => ({ weight: perUndeclared, value: m.value })),
  ];

  const totalWeight = weighted.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight <= 0) {
    const total = members.reduce((sum, m) => sum + m.value, 0);
    return clampPercent(total / members.length);
  }

  const sum = weighted.reduce((acc, m) => acc + m.value * m.weight, 0);
  return clampPercent(sum / totalWeight);
}

/** Completion of one milestone, 0–100, from its tasks' weights and progress. */
export function milestoneProgress(milestone: MilestoneLike | null | undefined): number {
  const tasks = milestone?.tasks ?? [];
  if (tasks.length === 0) return 0;

  return weightedAverage(
    tasks.map((task) => ({
      weight: Number(task.weight ?? 0),
      value: clampPercent(Number(task.progress ?? 0)),
    })),
  );
}

/**
 * Completion of a project, 0–100.
 *
 * A milestone with no tasks counts as 0% against its weight rather than being
 * dropped: planned-but-unstarted work is not the same as work that does not
 * exist, and dropping it would let a project read 100% with milestones still
 * empty.
 */
export function projectProgress(project: ProjectLike | null | undefined): number {
  const milestones = project?.milestones ?? [];
  if (milestones.length === 0) return 0;

  return weightedAverage(
    milestones.map((milestone) => ({
      weight: Number(milestone.weight ?? 0),
      value: milestoneProgress(milestone),
    })),
  );
}

/** Progress rounded for display. Every screen should round the same way. */
export function displayProgress(value: number): number {
  return Math.round(clampPercent(value));
}

export interface WeightCheck {
  total: number;
  isComplete: boolean;
  remaining: number;
}

/**
 * Whether a set of weights adds up.
 *
 * Task weights were validated as "must not exceed 100" but never "must total
 * 100", which is what let a fully delivered milestone report 70%. Uses a small
 * tolerance because the weights are floats entered by hand.
 */
export function checkWeights(weights: (number | null | undefined)[]): WeightCheck {
  const total = weights.reduce<number>((sum, w) => sum + Number(w ?? 0), 0);
  const remaining = Math.round((100 - total) * 1000) / 1000;
  return {
    total: Math.round(total * 1000) / 1000,
    isComplete: Math.abs(100 - total) < 0.01,
    remaining,
  };
}
