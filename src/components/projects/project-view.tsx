

"use client";

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building, Calendar, Layers, UserCircle, ShieldAlert, ShieldCheck, PlusCircle, ExternalLink, Pencil, Trash2, Library, CircleDot, AlertTriangle, ArrowRight } from "lucide-react";
import { format, differenceInDays, parseISO, isAfter, endOfDay } from "date-fns";
import type { Blocker, TaskStatus, Project } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AddBlockerDialog } from "./add-blocker-dialog";
import { ResolveBlockerDialog } from "./resolve-blocker-dialog";
import { EditBlockerDialog } from './edit-blocker-dialog';
import { EscalateBlockerDialog } from './escalate-blocker-dialog';
import { ProjectBlockers } from './project-blockers';
import type { OwnerOption } from './blocker-form-fields';
import type { CreateBlockerInput, EscalateBlockerInput } from '@/lib/validation/blocker';
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectDocuments } from "@/components/projects/project-documents";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  milestoneProgress as calculateMilestoneProgress,
  projectProgress as calculateProjectProgress,
  isArchivedStatus,
} from '@/lib/metrics';

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
}

const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
        case 'TODO':
            return <Badge variant="outline">To Do</Badge>;
        case 'IN_PROGRESS':
            return <Badge className="bg-blue-500 hover:bg-blue-500/90 text-primary-foreground">In Progress</Badge>;
        case 'PENDING_REVIEW':
            return <Badge className="bg-amber-500 hover:bg-amber-500/90 text-primary-foreground">Pending Review</Badge>;
        case 'DONE':
            return <Badge className="bg-green-600 hover:bg-green-600/90 text-primary-foreground">Done</Badge>;
        default:
            return <Badge variant="secondary">Unknown</Badge>;
    }
}

const getTimelineStatusBadge = (status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
    switch (status) {
        case 'PENDING':
            return <Badge variant="secondary" className="bg-amber-500/80 text-white">Pending</Badge>;
        case 'APPROVED':
            return <Badge variant="secondary" className="bg-green-600 text-white">Approved</Badge>;
        case 'REJECTED':
            return <Badge variant="destructive">Rejected</Badge>;
        default:
            return <Badge variant="outline">Unknown</Badge>;
    }
}

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
  const router = useRouter();
  const defaultTab = searchParams.get('tab') || 'milestones';
  
  

  const weightedProgress = calculateProjectProgress(project);

  const allResponsibleDepartments = project.responsibleDepartments?.map((d: any) => d.name) || [];

  const renderTimelineStatus = () => {
    const isProjectComplete = isArchivedStatus(project.status);
    const endDate = parseISO(project.endDate);
    
    if (isProjectComplete) {
      return (
        <>
          <ShieldCheck className="w-4 h-4 text-green-600" />
          <span>{project.status.name}: {format(endDate, "MMM d, yyyy")}</span>
        </>
      );
    }
    
    const isOverdue = isAfter(new Date(), endOfDay(endDate));
    if (isOverdue) {
      return (
        <>
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-destructive">Overdue</span>
        </>
      );
    }

    return (
      <>
        <CircleDot className="w-4 h-4" />
        <span>{differenceInDays(endDate, new Date())} days left</span>
      </>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </Link>
      
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <CardTitle className="text-3xl">{project.name}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {project.status && <Badge className="text-base" variant="secondary">{project.status.name}</Badge>}
                 {canUpdateProject && (
                  <>
                    <Button asChild variant="outline">
                      <Link href={`/projects/${project.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Project
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href={`/projects/${project.id}/milestones`}>
                            Manage Milestones
                            <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                  </>
                )}
                {canDeleteProject && (
                  <Button variant="destructive" onClick={() => onDeleteProject(project)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{format(parseISO(project.startDate), "MMM d, yyyy")} - {format(parseISO(project.endDate), "MMM d, yyyy")}</span>
            </div>
             <div className="flex items-center gap-2">
                <Library className="w-4 h-4" />
                <span>Owning EPMO Division: {project.pmoDivision?.name || 'N/A'}</span>
            </div>
             <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                <span>PM: {project.projectManager?.name || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              <span>For: {allResponsibleDepartments.join(', ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{project.milestones.length} Milestones</span>
            </div>
             <div className="flex items-center gap-2">
                {renderTimelineStatus()}
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-medium text-primary">{Math.round(weightedProgress)}%</span>
            </div>
            <Progress value={weightedProgress} className="h-2.5" />
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="milestones">Milestones & Tasks</TabsTrigger>
            <TabsTrigger value="blockers">Blockers</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="timeline">Timeline History</TabsTrigger>
        </TabsList>
        <TabsContent value="milestones">
            <Card>
                <CardHeader>
                    <CardTitle>Milestones & Tasks</CardTitle>
                    <CardDescription>A breakdown of all milestones and their associated tasks for this project.</CardDescription>
                </CardHeader>
                <CardContent>
                  {(!project.milestones || project.milestones.length === 0) ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No milestones have been created for this project yet.
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full space-y-2">
                        {project.milestones.map((milestone: any) => {
                            const milestoneProgress = calculateMilestoneProgress(milestone);
                            return (
                                <AccordionItem value={milestone.id} key={milestone.id} className="border rounded-md px-4">
                                    <AccordionTrigger className="hover:no-underline">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                                            <div className="flex-1 text-left">
                                                <p className="font-semibold text-base">{milestone.title}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>Due: {format(parseISO(milestone.dueDate), 'MMM dd, yyyy')}</span>
                                                    <span>&bull;</span>
                                                    <span>Weight: {milestone.weight}%</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 w-full md:w-auto">
                                                <Progress value={milestoneProgress} className="w-full md:w-32 h-2" />
                                                <span className="text-xs font-semibold">{Math.round(milestoneProgress)}%</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-4">
                                        {milestone.tasks.length > 0 ? (
                                            <Table scrollLabel="Milestones and tasks">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Task</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Progress</TableHead>
                                                        <TableHead>Due Date</TableHead>
                                                        <TableHead className="text-right">Weight</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {milestone.tasks.map((task: any) => (
                                                        <TableRow 
                                                            key={task.id} 
                                                            onClick={() => router.push(`/tasks/${task.id}`)}
                                                            className="cursor-pointer"
                                                        >
                                                            <TableCell className="font-medium">{task.title}</TableCell>
                                                            <TableCell>{getStatusBadge(task.status)}</TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Progress value={task.progress || 0} className="h-2 w-20" />
                                                                    <span>{task.progress || 0}%</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{format(parseISO(task.endDate), 'MMM dd, yyyy')}</TableCell>
                                                            <TableCell className="text-right">{task.weight}%</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        ) : (
                                            <p className="text-center text-sm text-muted-foreground py-4">No tasks in this milestone.</p>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="blockers">
            <ProjectBlockers
                blockers={(project.blockers ?? []) as Blocker[]}
                owners={blockerOwners}
                canUpdate={canUpdateProject}
                onAdd={onAddBlocker}
                onEdit={onEditBlocker}
                onResolve={onResolveBlocker}
                onEscalate={onEscalateBlocker}
                onDelete={onDeleteBlocker}
            />
        </TabsContent>
        <TabsContent value="documents">
            <ProjectDocuments projectId={project.id} />
        </TabsContent>
        <TabsContent value="timeline">
            <Card>
                 <CardHeader>
                    <CardTitle>Timeline Change History</CardTitle>
                    <CardDescription>A log of all requested and completed changes to the project deadline.</CardDescription>
                </CardHeader>
                <CardContent>
                     {project.timelineChangeRequests.length > 0 ? (
                        <Table scrollLabel="Timeline change requests">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Requested On</TableHead>
                                    <TableHead>Requested By</TableHead>
                                    <TableHead>Deadline Change</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reviewed By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {project.timelineChangeRequests.map((req: any) => (
                                    <TableRow key={req.id}>
                                        <TableCell>{format(parseISO(req.createdAt), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>{req.requestedBy?.name ?? 'N/A'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{format(parseISO(req.oldEndDate), 'MMM dd, yy')}</Badge>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                <Badge variant="default">{format(parseISO(req.newEndDate), 'MMM dd, yy')}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                                        <TableCell>{getTimelineStatusBadge(req.status)}</TableCell>
                                        <TableCell>{req.reviewedBy?.name ?? 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground py-8">No timeline change requests have been made for this project.</p>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

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
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the blocker.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onDeleteBlockerOpenChange(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={onBlockerDeleteSubmit}
                    >
                        Delete
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
                    <AlertDialogTitle>Are you sure you want to delete this project?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the project <span className="font-semibold">"{projectToDelete.name}"</span> and all of its associated milestones, tasks, and blockers.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onDeleteProjectOpenChange(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={onProjectDeleteSubmit}
                    >
                        Delete Project
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
