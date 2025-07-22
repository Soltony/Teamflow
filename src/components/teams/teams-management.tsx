
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
import { Pencil, Trash2, Phone, PlusCircle, ChevronDown, Check } from "lucide-react";
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { createTeam, updateTeam, deleteTeam } from "@/app/teams/actions";
import type { Project as PrismaProject, Team as PrismaTeam, User as PrismaUser } from '@prisma/client';
import { useAuth } from "@/context/auth-context";

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
  onDataChange: () => void;
}

export function TeamsManagement({ initialTeams, allProjects, allUsers, onDataChange }: TeamsManagementProps) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [editingTeam, setEditingTeam] = useState<TeamWithRelations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<TeamWithRelations | null>(null);
  
  const [openLead, setOpenLead] = useState(false);
  const [openMembers, setOpenMembers] = useState(false);

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

  const teamsByProject = useMemo(() => {
    return initialTeams.reduce((acc, team) => {
      const projectName = team.project.name || 'Unknown Project';
      if (!acc[projectName]) {
        acc[projectName] = [];
      }
      acc[projectName].push(team);
      return acc;
    }, {} as Record<string, TeamWithRelations[]>);
  }, [initialTeams]);

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
            onDataChange();
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
            onDataChange();
            setTeamToDelete(null);
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
                        <FormItem className="flex flex-col">
                            <FormLabel>Team Lead</FormLabel>
                            <Popover open={openLead} onOpenChange={setOpenLead}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                            {field.value ? availableLeads.find((user) => user.id === field.value)?.name : "Select team lead"}
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search users..." />
                                        <CommandEmpty>No user found.</CommandEmpty>
                                        <CommandGroup>
                                            {availableLeads.map((user) => (
                                                <CommandItem
                                                    value={user.name}
                                                    key={user.id}
                                                    onSelect={() => {
                                                        form.setValue("teamLeadId", user.id);
                                                        setOpenLead(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")} />
                                                    {user.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="memberIds"
                    render={({ field }) => {
                        const selectedMembers = availableMembers.filter(m => field.value?.includes(m.id));
                        return (
                            <FormItem className="flex flex-col">
                                <FormLabel>Team Members</FormLabel>
                                <Popover open={openMembers} onOpenChange={setOpenMembers}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                <span className="truncate">
                                                    {selectedMembers.length > 0 ? selectedMembers.map(m => m.name).join(', ') : "Select members..."}
                                                </span>
                                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search members..." />
                                            <CommandEmpty>No members found.</CommandEmpty>
                                            <CommandGroup>
                                                {availableMembers.map((user) => {
                                                    const isSelected = field.value?.includes(user.id);
                                                    return (
                                                        <CommandItem
                                                            value={user.name}
                                                            key={user.id}
                                                            onSelect={() => {
                                                                const newValues = field.value ? [...field.value] : [];
                                                                if (isSelected) {
                                                                    const index = newValues.indexOf(user.id);
                                                                    if (index > -1) {
                                                                        newValues.splice(index, 1);
                                                                    }
                                                                } else {
                                                                    newValues.push(user.id);
                                                                }
                                                                field.onChange(newValues);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                                            {user.name}
                                                        </CommandItem>
                                                    )
                                                })}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
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
