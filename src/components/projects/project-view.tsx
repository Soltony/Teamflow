
"use client";

import { useState } from "react";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { ArrowLeft, Building, Calendar, Layers, UserCircle, ShieldAlert, ShieldCheck, PlusCircle, ExternalLink, Pencil } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import type { Blocker } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AddBlockerDialog } from "./add-blocker-dialog";
import { ResolveBlockerDialog } from "./resolve-blocker-dialog";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GanttChart } from "./gantt-chart";
import { addBlocker, resolveBlocker } from "@/app/projects/actions";
import { useAuth } from "@/context/auth-context";

type ProjectViewProps = {
  initialProject: any; // Using any because of complex nested types from prisma and normalization
}

export function ProjectView({ initialProject }: ProjectViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canUpdateProject = hasPermission('projects:update');

  const [addingBlocker, setAddingBlocker] = useState(false);
  const [resolvingBlocker, setResolvingBlocker] = useState<Blocker | null>(null);

  const weightedProgress = initialProject.milestones.reduce((progress: number, milestone: any) => {
    const completedTaskWeightInMilestone = milestone.tasks
      .filter((task: any) => task.status === 'DONE')
      .reduce((sum: number, task: any) => sum + task.weight, 0);
    
    const milestoneProgress = completedTaskWeightInMilestone / 100;

    return progress + (milestoneProgress * milestone.weight);
  }, 0);

  const handleBlockerAdd = async (data: { description: string }) => {
    setAddingBlocker(false);
    await addBlocker(initialProject.id, data.description);
    toast({
      title: "Blocker Added",
      description: "The project blocker has been recorded and is now visible to management.",
    });
    router.refresh();
  };

  const handleBlockerResolve = async (blockerId: string, resolution: string) => {
    setResolvingBlocker(null);
    await resolveBlocker(blockerId, resolution, initialProject.id);
    toast({
      title: "Blocker Resolved",
      description: "The blocker has been marked as resolved.",
    });
    router.refresh();
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
                <CardTitle className="text-3xl">{initialProject.name}</CardTitle>
                <CardDescription>{initialProject.description}</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {initialProject.status && <Badge className="text-base" variant="secondary">{initialProject.status.name}</Badge>}
                 {canUpdateProject && (
                  <>
                    <Button asChild variant="outline">
                      <Link href={`/projects/${initialProject.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Project
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href={`/projects/${initialProject.id}/milestones`}>
                            Manage Milestones
                            <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                  </>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{format(parseISO(initialProject.startDate), "MMM d, yyyy")} - {format(parseISO(initialProject.endDate), "MMM d, yyyy")}</span>
            </div>
             <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span>Owning PMO Division: {initialProject.owningDepartment?.name || 'N/A'}</span>
            </div>
             <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                <span>PM: {initialProject.projectManager?.name || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{initialProject.milestones.length} Milestones</span>
            </div>
             <div className="flex items-center gap-2">
              <span>{differenceInDays(parseISO(initialProject.endDate), new Date())} days left</span>
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
      
      <Tabs defaultValue="gantt" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="gantt">Gantt Chart</TabsTrigger>
            <TabsTrigger value="blockers">Blockers</TabsTrigger>
        </TabsList>
        <TabsContent value="gantt">
          <Card>
            <CardHeader>
                <CardTitle>Task Gantt Chart</CardTitle>
                <CardDescription>A timeline view of all tasks for this project, relative to the project start date.</CardDescription>
            </CardHeader>
            <CardContent>
                <GanttChart project={initialProject} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="blockers">
            <Card>
                <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Project Blockers</CardTitle>
                    {canUpdateProject && (
                      <Button onClick={() => setAddingBlocker(true)}>
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
                    {!initialProject.blockers || initialProject.blockers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No blockers have been reported for this project.</p>
                    ) : (
                    initialProject.blockers.map((blocker: any, index: number) => (
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
                            <div>
                            {blocker.status === 'OPEN' && canUpdateProject && (
                            <Button variant="outline" size="sm" onClick={() => setResolvingBlocker(blocker)}>
                                Resolve
                            </Button>
                            )}
                            </div>
                        </div>
                        {index < initialProject.blockers.length - 1 && <Separator className="my-4" />}
                        </div>
                    ))
                    )}
                </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>


      {addingBlocker && (
        <AddBlockerDialog
          isOpen={addingBlocker}
          onOpenChange={setAddingBlocker}
          onBlockerAdd={handleBlockerAdd}
        />
      )}
      
      {resolvingBlocker && (
        <ResolveBlockerDialog
          isOpen={!!resolvingBlocker}
          onOpenChange={(open) => !open && setResolvingBlocker(null)}
          blocker={resolvingBlocker}
          onBlockerResolve={handleBlockerResolve}
        />
      )}
    </div>
  );
}
