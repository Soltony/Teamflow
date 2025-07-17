

"use client";

import Link from 'next/link';
import { ArrowLeft, Building, Calendar, Layers, UserCircle, ShieldAlert, ShieldCheck, PlusCircle, ExternalLink, Pencil, Trash2, Library, CircleDot } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import type { Blocker, TaskStatus, Project } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AddBlockerDialog } from "./add-blocker-dialog";
import { ResolveBlockerDialog } from "./resolve-blocker-dialog";
import { EditBlockerDialog } from './edit-blocker-dialog';
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type ProjectViewProps = {
  project: any;
  canUpdateProject: boolean;
  canDeleteProject: boolean;
  onAddBlocker: () => void;
  onResolveBlocker: (blocker: Blocker) => void;
  onEditBlocker: (blocker: Blocker) => void;
  onDeleteBlocker: (blocker: Blocker) => void;
  onDeleteProject: (project: Project) => void;
  isAddingBlocker: boolean;
  onAddBlockerOpenChange: (open: boolean) => void;
  onBlockerAddSubmit: (data: { description: string }) => void;
  resolvingBlocker: Blocker | null;
  onResolveBlockerOpenChange: (blocker: Blocker | null) => void;
  onBlockerResolveSubmit: (blockerId: string, resolution: string) => void;
  editingBlocker: Blocker | null;
  onEditBlockerOpenChange: (blocker: Blocker | null) => void;
  onBlockerUpdateSubmit: (blockerId: string, description: string) => void;
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

export function ProjectView({ 
    project, 
    canUpdateProject,
    canDeleteProject,
    onAddBlocker,
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
    onEditBlockerOpenChange,
    onBlockerUpdateSubmit,
    blockerToDelete,
    onDeleteBlockerOpenChange,
    onBlockerDeleteSubmit,
    projectToDelete,
    onDeleteProjectOpenChange,
    onProjectDeleteSubmit,
}: ProjectViewProps) {
  
  const weightedProgress = project.milestones.reduce((progress: number, milestone: any) => {
    const completedTaskWeightInMilestone = milestone.tasks
      .filter((task: any) => task.status === 'DONE')
      .reduce((sum: number, task: any) => sum + task.weight, 0);
    
    const milestoneProgress = completedTaskWeightInMilestone / 100;

    return progress + (milestoneProgress * milestone.weight);
  }, 0);

  const allResponsibleDepartments = project.responsibleDepartments?.map((d: any) => d.name) || [];

  const calculateMilestoneProgress = (milestone: any) => {
    return milestone.tasks
      .filter((t: any) => t.status === 'DONE')
      .reduce((sum: number, task: any) => sum + task.weight, 0);
  };


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
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
                <span>Owning PMO Division: {project.pmoDivision?.name || 'N/A'}</span>
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
              <CircleDot className="w-4 h-4" />
              <span>{differenceInDays(parseISO(project.endDate), new Date())} days left</span>
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
      
      <Tabs defaultValue="milestones" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="milestones">Milestones & Tasks</TabsTrigger>
            <TabsTrigger value="blockers">Blockers</TabsTrigger>
        </TabsList>
        <TabsContent value="milestones">
            <Card>
                <CardHeader>
                    <CardTitle>Milestones & Tasks</CardTitle>
                    <CardDescription>A breakdown of all milestones and their associated tasks for this project.</CardDescription>
                </CardHeader>
                <CardContent>
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
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Task</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Due Date</TableHead>
                                                        <TableHead className="text-right">Weight</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {milestone.tasks.map((task: any) => (
                                                        <TableRow key={task.id}>
                                                            <TableCell className="font-medium">{task.title}</TableCell>
                                                            <TableCell>{getStatusBadge(task.status)}</TableCell>
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
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="blockers">
            <Card>
                <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Project Blockers</CardTitle>
                    {canUpdateProject && (
                      <Button onClick={onAddBlocker}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Blocker
                      </Button>
                    )}
                </div>
                <CardDescription>
                    Issues that are impeding progress and require higher management attention.
                </CardDescription>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                    {!project.blockers || project.blockers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No blockers have been reported for this project.</p>
                    ) : (
                    project.blockers.map((blocker: any, index: number) => (
                        <div key={blocker.id}>
                        <div className="flex items-start gap-4">
                            <div>
                            {blocker.status === 'OPEN' ? (
                                <ShieldAlert className="h-5 w-5 text-destructive mt-1" />
                            ) : (
                                <ShieldCheck className="h-5 w-5 text-green-600 mt-1" />
                            )}
                            </div>
                            <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold">{blocker.status === 'OPEN' ? 'Open Blocker' : 'Resolved Blocker'}</p>
                                <p className="text-xs text-muted-foreground">
                                {blocker.status === 'OPEN' ? 'Created: ' : 'Resolved: '} 
                                {format(parseISO(blocker.resolvedAt || blocker.createdAt), 'MMM dd, yyyy')}
                                </p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{blocker.description}</p>
                            {blocker.status === 'RESOLVED' && (
                                <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md border">
                                    <p className="font-semibold text-xs">Resolution:</p>
                                    <p className="text-muted-foreground">{blocker.resolution}</p>
                                </div>
                            )}
                            </div>
                            <div className="flex items-center gap-1">
                                {blocker.status === 'OPEN' && canUpdateProject && (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => onEditBlocker(blocker)}>
                                        <Pencil className="w-4 h-4" />
                                        <span className="sr-only">Edit Blocker</span>
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => onResolveBlocker(blocker)}>
                                        Resolve
                                    </Button>
                                  </>
                                )}
                                {canUpdateProject && (
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDeleteBlocker(blocker)}>
                                        <Trash2 className="w-4 h-4" />
                                        <span className="sr-only">Delete Blocker</span>
                                    </Button>
                                )}
                            </div>
                        </div>
                        {index < project.blockers.length - 1 && <Separator className="my-4" />}
                        </div>
                    ))
                    )}
                </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>


      {isAddingBlocker && (
        <AddBlockerDialog
          isOpen={isAddingBlocker}
          onOpenChange={onAddBlockerOpenChange}
          onBlockerAdd={onBlockerAddSubmit}
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
