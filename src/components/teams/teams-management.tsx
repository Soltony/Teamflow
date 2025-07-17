
"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Phone, PlusCircle, ChevronDown } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { createTeam, updateTeam, deleteTeam } from "@/app/teams/actions";
import type { Project as PrismaProject, Team as PrismaTeam, User as PrismaUser } from '@prisma/client';
import { useAuth } from "@/context/auth-context";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";


const teamSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters."),
  projectId: z.string().nonempty("Please select a project."),
  teamLeadId: z.string().nonempty("Please select a team lead."),
  memberIds: z.array(z.string()).nonempty("A team must have at least one member."),
});

type TeamFormValues = z.infer<typeof teamSchema>;

type UserWithRoles = PrismaUser & { pmoDivisionId?: string | null, roles: { name: string }[] };

type TeamWithRelations = PrismaTeam & {
    project: PrismaProject;
    teamLead: UserWithRoles;
    members: UserWithRoles[];
    memberIds: string[];
};

type TeamsManagementProps = {
  initialTeams: TeamWithRelations[];
  allProjects: PrismaProject[];
  allUsers: UserWithRoles[];
}

export function TeamsManagement({ initialTeams, allProjects, allUsers }: TeamsManagementProps) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [teams, setTeams] = useState<TeamWithRelations[]>(initialTeams);
  const [editingTeam, setEditingTeam] = useState<TeamWithRelations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<TeamWithRelations | null>(null);

  const canCreate = hasPermission('teams:create');
  const canUpdate = hasPermission('teams:update');
  const canDelete = hasPermission('teams:delete');
  
  const nonAdminUsers = useMemo(() => {
    return allUsers.filter(user => !user.roles.some(role => role.name === 'Admin'));
  }, [allUsers]);

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      projectId: "",
      teamLeadId: "",
      memberIds: [],
    },
  });

  const isEditing = editingTeam !== null;

  const selectedProjectId = form.watch("projectId");

  const { availableLeads, availableMembers } = useMemo(() => {
    const usersToFilter = nonAdminUsers;
    if (!selectedProjectId) {
        return { availableLeads: usersToFilter, availableMembers: usersToFilter };
    }
    const project = allProjects.find(p => p.id === selectedProjectId);
    if (!project?.pmoDivisionId) {
        return { availableLeads: usersToFilter, availableMembers: usersToFilter };
    }
    const filteredUsers = usersToFilter.filter(u => u.pmoDivisionId === project.pmoDivisionId);
    return { availableLeads: filteredUsers, availableMembers: filteredUsers };
  }, [selectedProjectId, allProjects, nonAdminUsers]);

  useEffect(() => {
    if (isDialogOpen) {
      if (editingTeam) {
        form.reset({
            name: editingTeam.name,
            projectId: editingTeam.projectId,
            teamLeadId: editingTeam.teamLeadId,
            memberIds: editingTeam.memberIds,
        });
      } else {
        form.reset({ name: "", projectId: "", teamLeadId: "", memberIds: [] });
      }
    }
  }, [isDialogOpen, editingTeam, form]);
  
  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  const teamsByProject = useMemo(() => {
    return teams.reduce((acc, team) => {
      const projectName = team.project.name || 'Unknown Project';
      if (!acc[projectName]) {
        acc[projectName] = [];
      }
      acc[projectName].push(team);
      return acc;
    }, {} as Record<string, TeamWithRelations[]>);
  }, [teams]);

  function onSubmit(data: TeamFormValues) {
    startTransition(async () => {
        const result = isEditing && editingTeam
        ? await updateTeam(editingTeam.id, data)
        : await createTeam(data);
    
        if (result.success) {
            toast({
                title: isEditing ? "Team Updated!" : "Team Created!",
                description: `The "${data.name}" team has been successfully saved.`,
            });
            setIsDialogOpen(false);
            router.refresh();
        } else {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive",
            });
        }
    });
  }

  function handleEdit(team: TeamWithRelations) {
    setEditingTeam(team);
    setIsDialogOpen(true);
  }
  
  function handleAddNew() {
    setEditingTeam(null);
    setIsDialogOpen(true);
  }

  function handleDeleteConfirm() {
    if (!teamToDelete) return;
    startTransition(async () => {
        const result = await deleteTeam(teamToDelete.id);
        if (result.success) {
            toast({
                title: "Team Deleted",
                description: `The "${teamToDelete.name}" team has been removed.`,
            });
            setTeams(currentTeams => currentTeams.filter(t => t.id !== teamToDelete.id));
            setTeamToDelete(null);
            router.refresh();
        } else {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive",
            });
             setTeamToDelete(null);
        }
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Team Management</CardTitle>
            <CardDescription>Create and manage project-specific teams, assign leads, and add members.</CardDescription>
          </div>
          {canCreate && (
            <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Team
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {Object.keys(teamsByProject).length === 0 ? (
             <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <p>No teams have been created yet.</p>
                <p className="text-sm">Click "Add New Team" to get started.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full" defaultValue={Object.keys(teamsByProject)}>
              {Object.entries(teamsByProject).map(([projectName, projectTeams]) => (
                <AccordionItem value={projectName} key={projectName}>
                  <AccordionTrigger className="font-semibold">{projectName}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pl-4 border-l-2 ml-2">
                      {projectTeams.map((team) => {
                        return (
                            <div key={team.id} className="p-4 border rounded-md relative">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <h4 className="font-semibold">{team.name}</h4>
                                      {team.teamLead && (
                                          <div className="text-sm text-muted-foreground mt-1">
                                              <p className="font-medium">Lead: {team.teamLead.name}</p>
                                              {team.teamLead.phoneNumber && (
                                                  <a href={`tel:${team.teamLead.phoneNumber}`} className="flex items-center gap-1.5 hover:text-primary">
                                                      <Phone className="w-3 h-3"/>
                                                      {team.teamLead.phoneNumber}
                                                  </a>
                                              )}
                                          </div>
                                      )}
                                      <div className="mt-2">
                                          <p className="text-sm font-medium">Members:</p>
                                          <p className="text-sm text-muted-foreground">{team.members.map(m => m.name).join(', ')}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-1 absolute top-2 right-2">
                                      {canUpdate && (
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                                            <Pencil className="w-4 h-4" />
                                            <span className="sr-only">Edit</span>
                                        </Button>
                                      )}
                                      {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => setTeamToDelete(team)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span className="sr-only">Delete</span>
                                        </Button>
                                      )}
                                  </div>
                              </div>
                            </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Team" : "Create New Team"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {allProjects.map(proj => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Frontend Wizards" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teamLeadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Lead</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select a team lead" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {availableLeads.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="memberIds"
                  render={({ field }) => {
                    const selectedMemberCount = field.value?.length || 0;
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Team Members</FormLabel>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start",
                                  !field.value?.length && "text-muted-foreground"
                                )}
                              >
                                {selectedMemberCount > 0
                                  ? `${selectedMemberCount} member(s) selected`
                                  : "Select members..."}
                                <ChevronDown className="ml-auto h-4 w-4" />
                              </Button>
                            </FormControl>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                            {availableMembers.map((user) => (
                              <DropdownMenuCheckboxItem
                                key={user.id}
                                checked={field.value?.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  const selected = field.value || [];
                                  if (checked) {
                                    field.onChange([...selected, user.id]);
                                  } else {
                                    field.onChange(
                                      selected.filter((id) => id !== user.id)
                                    );
                                  }
                                }}
                                onSelect={(e) => e.preventDefault()}
                              >
                                {user.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update Team" : "Create Team")}
                    </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
      </Dialog>


      <AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              <span className="font-semibold">{teamToDelete?.name}</span> team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTeamToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
