/**
 * The single source of truth for every figure this system reports.
 *
 * Nothing outside this folder should compute progress, completion, or schedule
 * performance. If a screen needs a number that is not here, add it here — the
 * dashboard, the CEO report and the drill-downs previously each carried their
 * own arithmetic and disagreed with one another.
 *
 * Definitions are documented on each function and are what the UI tooltips
 * should quote.
 */
export {
  statusCategory,
  isClosedStatus,
  isArchivedStatus,
  isLiveStatus,
  type StatusCategory,
  type StatusLike,
} from './status';

export {
  milestoneProgress,
  projectProgress,
  displayProgress,
  checkWeights,
  type TaskLike,
  type MilestoneLike,
  type ProjectLike,
  type WeightCheck,
} from './progress';

export {
  endOfDay,
  deadlineFor,
  actualCompletionDate,
  isOnTime,
  isLate,
  isOverdue,
  scheduleVarianceDays,
  baselineSlipDays,
  daysRemaining,
  summarizeSchedule,
  type ProjectScheduleLike,
  type MilestoneScheduleLike,
  type TaskScheduleLike,
  type PortfolioScheduleSummary,
} from './schedule';

export {
  isActiveOn,
  totalAllocation,
  summarizeAllocation,
  remainingCapacity,
  type AssignmentLike,
  type AllocationSummary,
} from './allocation';

export {
  assessRag,
  summarizeRag,
  elapsedSchedulePercent,
  scheduleVariancePercent,
  budgetUsedPercent,
  budgetVariancePercent,
  committedSpend,
  RAG_AMBER_THRESHOLD,
  RAG_RED_THRESHOLD,
  type Rag,
  type RagAssessment,
  type PortfolioRag,
  type RagProjectLike,
} from './rag';
