'use server';

import { startOfWeek, endOfWeek } from 'date-fns';

import { requirePermission } from '@/lib/auth/guard';
import { getActivityForPeriod } from '@/lib/services/activity';

/**
 * This week's activity, Monday to Sunday.
 *
 * A thin wrapper over the shared implementation; see today/actions.ts.
 */
export async function getWeeklyTasks(_userId?: string, targetDate: Date = new Date()) {
  const user = await requirePermission('dashboard:view');

  return getActivityForPeriod(user, {
    start: startOfWeek(targetDate, { weekStartsOn: 1 }),
    end: endOfWeek(targetDate, { weekStartsOn: 1 }),
  });
}
