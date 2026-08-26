'use server';

import { startOfDay, endOfDay } from 'date-fns';

import { requirePermission } from '@/lib/auth/guard';
import { getActivityForPeriod } from '@/lib/services/activity';

/**
 * Today's activity.
 *
 * A thin wrapper over the shared implementation; this file and its weekly twin
 * were previously identical 162-line copies differing only in the window.
 * Identity comes from the session — `_userId` is ignored, kept only so
 * existing call sites compile.
 */
export async function getTodaysTasks(_userId?: string, targetDate: Date = new Date()) {
  const user = await requirePermission('dashboard:view');

  return getActivityForPeriod(user, {
    start: startOfDay(targetDate),
    end: endOfDay(targetDate),
  });
}
