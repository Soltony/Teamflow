/**
 * What each figure on a dashboard actually means.
 *
 * A number a manager cannot interrogate does not get used twice. These strings
 * are the rules the metrics module implements, written for the person reading
 * the card rather than the person maintaining the code, and surfaced as
 * tooltips next to every KPI.
 *
 * If a definition here and the implementation in this folder ever disagree,
 * the implementation is wrong: these are the contract.
 */
export interface MetricDefinition {
  label: string;
  /** One sentence, shown on hover. */
  definition: string;
  /** The edge case people ask about, shown underneath. */
  note?: string;
}

export const METRIC_DEFINITIONS = {
  onTime: {
    label: 'On-Time Completion',
    definition:
      'Closed projects whose last task was completed on or before the deadline the project was originally committed to.',
    note: 'Measured against the original baseline, not against a deadline that has since been extended. A closed project with unfinished tasks does not count as on time.',
  },
  late: {
    label: 'Late Completion',
    definition: 'Closed projects delivered after the deadline they were originally committed to.',
    note: 'Every closed project is either on time or late; the two always add up to the number closed.',
  },
  overdue: {
    label: 'Overdue Projects',
    definition: 'Projects still running whose current deadline has passed.',
    note: 'Counted to the end of the due date, so a project due today is not overdue until tomorrow. Finished projects are never overdue — they are on time or late.',
  },
  blockers: {
    label: 'Active Blockers',
    definition: 'Open blockers across the projects in view.',
    note: 'This counts blockers, not projects; the drill-down lists the projects holding them, so the two figures differ by design.',
  },
  onTimeRate: {
    label: 'On-Time Completion Rate',
    definition: 'The share of closed projects that were delivered on or before their committed deadline.',
    note: 'Shown as N/A until at least one project has closed.',
  },
  progress: {
    label: 'Progress',
    definition:
      'Task completion weighted by each task’s weight within its milestone, and each milestone’s weight within the project.',
    note: 'Normalised by the weight actually present, so a project whose weights do not total 100 still reaches 100% when all its work is done.',
  },
  scheduleVariance: {
    label: 'Schedule Variance',
    definition: 'Days between the committed deadline and actual completion. Negative means early.',
    note: 'Only available once a project has closed.',
  },
  baselineSlip: {
    label: 'Baseline Slip',
    definition: 'Days the current plan has moved from the original commitment through approved extensions.',
    note: 'Zero for a project that has never been extended.',
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricKey = keyof typeof METRIC_DEFINITIONS;
