
"use client";

import { useState } from "react";
import Link from 'next/link';
import { ArrowLeft, Building, Calendar, Layers, UserCircle, ShieldAlert, ShieldCheck, PlusCircle, ExternalLink } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { departments, users, projectStatuses } from "@/lib/data";
import type { Project, Blocker } from "@/lib/types";
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

type ProjectViewProps = {
  initialProject: Project;
}

export function ProjectView({ initialProject }: ProjectViewProps) {
  const { toast } = useToast();
  const [project, setProject] = useState<Project>(initialProject);
  const [addingBlocker, setAddingBlocker] = useState(false);
  const [resolvingBlocker, setResolvingBlocker] = useState<Blocker | null>(null);


  const department = departments.find(d => d.id === project.departmentId);
  const projectManager = users.find(u => u.id === project.projectManagerId);
  const status = projectStatuses.find(s => s.id === project.statusId);

  const weightedProgress = project.milestones.reduce((progress, milestone) => {
    const completedTaskWeightInMilestone = milestone.tasks
      .filter(task => task.status === 'done')
      .reduce((sum, task) => sum + task.weight, 0);
    
    // Milestone progress is (completed weight / 100), as task weights are designed to sum to 100
    const milestoneProgress = completedTaskWeightInMilestone / 100;

    // Add this milestone's weighted contribution to the total project progress
    return progress + (milestoneProgress * milestone.weight);
  }, 0);

  const handleBlockerAdd = (data: { description: string }) => {
    const newBlocker: Blocker = {
      id: `blocker-${Date.now()}`,
      description: data.description,
      status: 'open',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setProject(prev => ({
      ...prev,
      blockers: [...(prev.blockers || []), newBlocker],
    }));
    toast({
      title: "Blocker Added",
      description: "The project blocker has been recorded and is now visible to management.",
    });
  };

  const handleBlockerResolve = (blockerId: string, resolution: string) => {
    setProject(prev => ({
      ...prev,
      blockers: (prev.blockers || []).map(b => 
        b.id === blockerId 
          ? { 
              ...b, 
              status: 'resolved', 
              resolution, 
              resolvedAt: new Date().toISOString().split('T')[0] 
            } 
          : b
      ),
    }));
    toast({
      title: "Blocker Resolved",
      description: "The blocker has been marked as resolved.",
    });
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
                {status && <Badge className="text-base" variant="secondary">{status.name}</Badge>}
                <Button asChild variant="outline">
                    <Link href={`/projects/${project.id}/milestones`}>
                        Manage Milestones
                        <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(project.startDate), "MMM d, yyyy")} - {format(new Date(project.endDate), "MMM d, yyyy")}</span>
            </div>
             <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span>Owning Dept: {department?.name || 'N/A'}</span>
            </div>
             <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                <span>PM: {projectManager?.name || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{project.milestones.length} Milestones</span>
            </div>
             <div className="flex items-center gap-2">
              <span>{differenceInDays(new Date(project.endDate), new Date())} days left</span>
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
                <GanttChart project={project} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="blockers">
            <Card>
                <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Project Blockers</CardTitle>
                    <Button onClick={() => setAddingBlocker(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Blocker
                    </Button>
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
                    project.blockers.map((blocker, index) => (
                        <div key={blocker.id}>
                        <div className="flex items-start gap-4">
                            <div>
                            {blocker.status === 'open' ? (
                                <ShieldAlert className="h-5 w-5 text-destructive mt-1" />
                            ) : (
                                <ShieldCheck className="h-5 w-5 text-green-600 mt-1" />
                            )}
                            </div>
                            <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold">{blocker.status === 'open' ? 'Open Blocker' : 'Resolved Blocker'}</p>
                                <p className="text-xs text-muted-foreground">
                                {blocker.status === 'open' ? 'Created: ' : 'Resolved: '} 
                                {format(parseISO(blocker.resolvedAt || blocker.createdAt), 'MMM dd, yyyy')}
                                </p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{blocker.description}</p>
                            {blocker.status === 'resolved' && (
                                <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md border">
                                    <p className="font-semibold text-xs">Resolution:</p>
                                    <p className="text-muted-foreground">{blocker.resolution}</p>
                                </div>
                            )}
                            </div>
                            <div>
                            {blocker.status === 'open' && (
                            <Button variant="outline" size="sm" onClick={() => setResolvingBlocker(blocker)}>
                                Resolve
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
