import { Suspense } from 'react';

import { ReportsClient } from '@/components/reports/reports-client';
import { PageShell } from '@/components/ui/page-header';
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import prisma from '@/lib/db';
import { requirePermissionOrRedirect } from '@/lib/auth/guard';
import { isLate, isOnTime, isOverdue } from '@/lib/metrics';
import { serialize } from '@/lib/serialize';
import { isOpenBlocker } from '@/lib/validation/blocker';

// Reads the session, so it must never be prerendered.
export const dynamic = 'force-dynamic';

type ReportSearchParams = { type?: string; year?: string; division?: string };

const REPORT_COPY: Record<string, { title: string; description: string }> = {
  'on-time': {
    title: 'Completed on time',
    description:
      'Closed projects whose last task finished on or before the deadline they were originally committed to.',
  },
  late: {
    title: 'Completed late',
    description:
      'Closed projects delivered after the deadline they were originally committed to. Measured against the baseline, not against an extension.',
  },
  overdue: {
    title: 'Overdue projects',
    description:
      'Projects still running whose current deadline has passed. A finished project is never overdue — it is on time or late.',
  },
  'active-blockers': {
    title: 'Projects with open issues',
    description: 'Projects carrying unresolved issues that are holding delivery up.',
  },
  all: {
    title: 'All projects',
    description: 'Every project in the selected working year and EPMO division.',
  },
};

async function ReportsContent({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
    // This page previously read every project in the portfolio with no
    // permission check of any kind.
    await requirePermissionOrRedirect('reports:view');

    // Next 15 hands these over as a promise.
    const params = await searchParams;
    const type = params?.type && REPORT_COPY[params.type] ? params.type : 'all';
    const year = params?.year ?? 'all';
    const division = params?.division ?? 'all';

    const [allProjects, pmoDivisions, distinctYears] = await Promise.all([
      prisma.project.findMany({
        // Both filters, because the dashboard cards were counted under both.
        // Honouring only the year is what made a card read 7 and its list 19.
        where: {
            ...(year && year !== 'all' ? { workingYear: year } : {}),
            ...(division && division !== 'all' ? { pmoDivisionId: division } : {}),
        },
        include: {
            status: true,
            milestones: { include: { tasks: true } },
            blockers: true,
        },
      }),
      // The filter controls need these; the page previously had no controls at
      // all, so the only way to change a report was to go back and re-click a
      // dashboard card.
      prisma.pmoDivision.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.project.findMany({
        select: { workingYear: true },
        distinct: ['workingYear'],
        orderBy: { workingYear: 'desc' },
      }),
    ]);

    // Same predicates the dashboard and CEO report use, so a drill-down always
    // lists exactly the projects the card counted. These filters previously
    // used planned task dates while the cards used actual completion, so the
    // number and the list disagreed.
    const hasOpenBlocker = (p: (typeof allProjects)[number]) =>
      p.blockers?.some((b) => isOpenBlocker(b.status)) ?? false;

    const byType: Record<string, typeof allProjects> = {
      'on-time': allProjects.filter(isOnTime),
      late: allProjects.filter(isLate),
      overdue: allProjects.filter((p) => isOverdue(p)),
      'active-blockers': allProjects.filter(hasOpenBlocker),
      all: allProjects,
    };

    const copy = REPORT_COPY[type];

    return (
      <ReportsClient
        projects={serialize(byType[type])}
        counts={{
          onTime: byType['on-time'].length,
          late: byType.late.length,
          overdue: byType.overdue.length,
          blockers: byType['active-blockers'].length,
          all: allProjects.length,
        }}
        pmoDivisions={pmoDivisions}
        workingYears={distinctYears.map((p) => p.workingYear)}
        type={type}
        year={year}
        division={division}
        title={copy.title}
        description={copy.description}
      />
    );
}

/** Matches the shape of the report, so nothing jumps when the data lands. */
function ReportsSkeleton() {
    return (
        <LoadingRegion label="Loading report">
          <PageShell>
            <Skeleton className="h-4 w-48" />
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </PageShell>
        </LoadingRegion>
    );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
    return (
        <Suspense fallback={<ReportsSkeleton />}>
            <ReportsContent searchParams={searchParams} />
        </Suspense>
    );
}
