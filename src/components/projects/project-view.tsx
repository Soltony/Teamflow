"use client";

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building,
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  Layers,
  Library,
  Pencil,
  ShieldAlert,
  Trash2,
  UserCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import type { Blocker, Project } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader, PageMeta, PageShell } from '@/components/ui/page-header';
import { SectionLayout, SectionNav, SectionPanel, type Section } from '@/components/ui/section-nav';
import { DecisionPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddBlockerDialog } from './add-blocker-dialog';
import { ResolveBlockerDialog } from './resolve-blocker-dialog';
import { EditBlockerDialog } from './edit-blocker-dialog';
import { EscalateBlockerDialog } from './escalate-blocker-dialog';
import { ProjectBlockers } from './project-blockers';
import { ProjectDocuments } from './project-documents';
import { ProjectMilestonesSection } from './project-milestones-section';
import { ProjectRiskPanel, ProjectSummaryCards } from './project-summary';
import type { OwnerOption } from './blocker-form-fields';
import type { CreateBlockerInput, EscalateBlockerInput } from '@/lib/validation/blocker';
import { isOpenBlocker } from '@/lib/validation/blocker';

/**
 * A project, in full.
 *
 * The screen this replaces opened with a single card carrying the name, the
 * description, six lines of grey metadata and one progress bar, then handed off
 * to four tabs in a `grid-cols-4` strip. Two problems followed from that:
 *
 *  - the header answered "what is this project" but never "how is it going",
 *    so the state of delivery had to be inferred from a percentage;
 *  - the tab strip could not say what was behind it. Finding out whether a
 *    project had open issues meant clicking Blockers and looking.
 *
 * Now: summary cards and a risk panel above the fold, and a section rail whose
 * entries carry their own counts. The `?tab=` parameter is unchanged, so every
 * existing deep link — the dashboard's blockers drill-down included — still
 * lands where it did.
 */

type ProjectViewProps = {
  project: any;
  canUpdateProject: boolean;
  canDeleteProject: boolean;
  onAddBlocker: () => void;
  onEscalateBlocker: (blocker: Blocker) => void;
  /** Who may be given an issue to own, or have one escalated to them. */
  blockerOwners: OwnerOption[];
  onResolveBlocker: (blocker: Blocker) => void;
  onEditBlocker: (blocker: Blocker) => void;
  onDeleteBlocker: (blocker: Blocker) => void;
  onDeleteProject: (project: Project) => void;
  isAddingBlocker: boolean;
  onAddBlockerOpenChange: (open: boolean) => void;
  onBlockerAddSubmit: (data: CreateBlockerInput) => void;
  resolvingBlocker: Blocker | null;
  onResolveBlockerOpenChange: (blocker: Blocker | null) => void;
  onBlockerResolveSubmit: (blockerId: string, resolution: string) => void;
  editingBlocker: Blocker | null;
  escalatingBlocker: Blocker | null;
  onEscalateBlockerOpenChange: (blocker: Blocker | null) => void;
  onBlockerEscalateSubmit: (blockerId: string, values: EscalateBlockerInput) => void;
  onEditBlockerOpenChange: (blocker: Blocker | null) => void;
  onBlockerUpdateSubmit: (blockerId: string, values: CreateBlockerInput) => void;
  blockerToDelete: Blocker | null;
  onDeleteBlockerOpenChange: (blocker: Blocker | null) => void;
  onBlockerDeleteSubmit: () => void;
  projectToDelete: Project | null;
  onDeleteProjectOpenChange: (project: Project | null) => void;
  onProjectDeleteSubmit: () => void;
};

/** The section ids double as `?tab=` values, so old links keep working. */
const SECTION_IDS = ['milestones', 'blockers', 'documents', 'timeline'] as const;

export function ProjectView({
  project,
  canUpdateProject,
  canDeleteProject,
  onAddBlocker,
  onEscalateBlocker,
  blockerOwners,
  onResolveBlocker,
  onEditBlocker,
  onDeleteBlocker,
  onDeleteProject,
  isAddingBlocker,
  onAddBlockerOpenChange,
  onBlockerAddSubmit,
  resolvingBlocker,
  onResolveBlockerOpenChange,
  onBlockerResolveSubmit,
  editingBlocker,
  escalatingBlocker,
  onEscalateBlockerOpenChange,
  onBlockerEscalateSubmit,
  onEditBlockerOpenChange,
  onBlockerUpdateSubmit,
  blockerToDelete,
  onDeleteBlockerOpenChange,
  onBlockerDeleteSubmit,
  projectToDelete,
  onDeleteProjectOpenChange,
  onProjectDeleteSubmit,
}: ProjectViewProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const requested = searchParams.get('tab');
  const [section, setSection] = React.useState<string>(
    SECTION_IDS.includes(requested as never) ? requested! : 'milestones',
  );

  /**
   * The section lives in the URL, so a reader can send somebody "look at the
   * issues on this project" and have it open there. `replace` rather than
   * `push`: flicking between sections should not fill the back button with
   * steps out of a single page.
   */
  const selectSection = React.useCallback(
    (next: string) => {
      setSection(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const blockers: any[] = project.blockers ?? [];
  const openBlockers = blockers.filter((b: any) => isOpenBlocker(b.status));
  const timelineRequests: any[] = project.timelineChangeRequests ?? [];
  const pendingTimeline = timelineRequests.filter((r: any) => r.status === 'PENDING');
  const departments = (project.responsibleDepartments ?? []).map((d: any) => d.name);

  const sections: Section[] = [
    {
      id: 'milestones',
      label: 'Milestones and tasks',
      icon: Layers,
      count: project.milestones?.length ?? 0,
      description: 'The plan and how far through it we are',
    },
    {
      id: 'blockers',
      label: 'Issue register',
      icon: ShieldAlert,
      count: openBlockers.length,
      attention: openBlockers.length > 0,
      description: 'What is holding the project up',
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      description: 'Charters, reports and sign-offs',
    },
    {
      id: 'timeline',
      label: 'Timeline changes',
      icon: Clock,
      count: pendingTimeline.length,
      attention: pendingTimeline.length > 0,
      description: 'Requested and approved deadline moves',
    },
  ];

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
        title={project.name}
        description={project.description}
        meta={
          <>
            {project.status && (
              <Badge variant="secondary" className="font-medium">
                {project.status.name}
              </Badge>
            )}
            <PageMeta icon={CalendarDays}>
              {format(parseISO(project.startDate), 'd MMM yyyy')} –{' '}
              {format(parseISO(project.endDate), 'd MMM yyyy')}
            </PageMeta>
            <PageMeta icon={UserCircle} label="Manager">
              {project.projectManager?.name || 'Unassigned'}
            </PageMeta>
            <PageMeta icon={Library} label="EPMO division">
              {project.pmoDivision?.name || 'None'}
            </PageMeta>
            {departments.length > 0 && (
              <PageMeta icon={Building} label="For">
                {departments.join(', ')}
              </PageMeta>
            )}
          </>
        }
        actions={
          <>
            {canUpdateProject && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/projects/${project.id}/edit`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit project
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/projects/${project.id}/milestones`}>
                    Manage milestones
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </>
            )}
            {canDeleteProject && (
              <Button variant="destructive" onClick={() => onDeleteProject(project)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            )}
          </>
        }
      />

      <ProjectSummaryCards project={project} />

      <ProjectRiskPanel project={project} onNavigate={selectSection} />

      <SectionLayout
        nav={
          <SectionNav
            sections={sections}
            value={section}
            onValueChange={selectSection}
            label="Project sections"
          />
        }
      >
        <SectionPanel id="milestones" active={section === 'milestones'}>
          <ProjectMilestonesSection project={project} />
        </SectionPanel>

        <SectionPanel id="blockers" active={section === 'blockers'}>
          <ProjectBlockers
            blockers={blockers as Blocker[]}
            owners={blockerOwners}
            canUpdate={canUpdateProject}
            onAdd={onAddBlocker}
            onEdit={onEditBlocker}
            onResolve={onResolveBlocker}
            onEscalate={onEscalateBlocker}
            onDelete={onDeleteBlocker}
          />
        </SectionPanel>

        <SectionPanel id="documents" active={section === 'documents'}>
          <ProjectDocuments projectId={project.id} />
        </SectionPanel>

        <SectionPanel id="timeline" active={section === 'timeline'}>
          <TimelineHistory requests={timelineRequests} />
        </SectionPanel>
      </SectionLayout>

      {isAddingBlocker && (
        <AddBlockerDialog
          isOpen={isAddingBlocker}
          onOpenChange={onAddBlockerOpenChange}
          onBlockerAdd={onBlockerAddSubmit}
          owners={blockerOwners}
        />
      )}

      {resolvingBlocker && (
        <ResolveBlockerDialog
          isOpen={!!resolvingBlocker}
          onOpenChange={(open) => !open && onResolveBlockerOpenChange(null)}
          blocker={resolvingBlocker}
          onBlockerResolve={onBlockerResolveSubmit}
        />
      )}

      {editingBlocker && (
        <EditBlockerDialog
          isOpen={!!editingBlocker}
          onOpenChange={(open) => !open && onEditBlockerOpenChange(null)}
          blocker={editingBlocker}
          onBlockerUpdate={onBlockerUpdateSubmit}
          owners={blockerOwners}
        />
      )}

      {escalatingBlocker && (
        <EscalateBlockerDialog
          isOpen={!!escalatingBlocker}
          onOpenChange={(open) => !open && onEscalateBlockerOpenChange(null)}
          blocker={escalatingBlocker}
          onEscalate={onBlockerEscalateSubmit}
          recipients={blockerOwners}
        />
      )}

      {blockerToDelete && (
        <AlertDialog
          open={!!blockerToDelete}
          onOpenChange={(open) => !open && onDeleteBlockerOpenChange(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this issue?</AlertDialogTitle>
              <AlertDialogDescription>
                {/* Naming the thing beats "are you absolutely sure": the reader
                    can check they are deleting what they meant to. */}
                &ldquo;{blockerToDelete.title}&rdquo; will be removed permanently, along with its
                history. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => onDeleteBlockerOpenChange(null)}>
                Keep it
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onBlockerDeleteSubmit}
              >
                Delete issue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {projectToDelete && (
        <AlertDialog
          open={!!projectToDelete}
          onOpenChange={(open) => !open && onDeleteProjectOpenChange(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{projectToDelete.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the project and everything under it —{' '}
                {project.milestones?.length ?? 0} milestone
                {(project.milestones?.length ?? 0) === 1 ? '' : 's'}, all of their tasks, and{' '}
                {blockers.length} issue{blockers.length === 1 ? '' : 's'}. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => onDeleteProjectOpenChange(null)}>
                Keep it
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onProjectDeleteSubmit}
              >
                Delete project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </PageShell>
  );
}

/** Every deadline move that has been asked for, and what came of it. */
function TimelineHistory({ requests }: { requests: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline changes</CardTitle>
        <CardDescription>
          Every request to move this project&rsquo;s deadline, who asked, why, and what was
          decided.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState
            title="The deadline has never been moved"
            description="Requests to change the project end date will be listed here once one is made."
            compact
          />
        ) : (
          <Table scrollLabel="Timeline change requests">
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Deadline change</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Reviewed by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req: any) => (
                <TableRow key={req.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(parseISO(req.createdAt), 'd MMM yyyy')}
                  </TableCell>
                  <TableCell>{req.requestedBy?.name ?? 'Unknown'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-muted-foreground line-through">
                        {format(parseISO(req.oldEndDate), 'd MMM yy')}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium">
                        {format(parseISO(req.newEndDate), 'd MMM yy')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="line-clamp-2">{req.reason}</span>
                  </TableCell>
                  <TableCell>
                    <DecisionPill status={req.status} />
                  </TableCell>
                  <TableCell>{req.reviewedBy?.name ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
