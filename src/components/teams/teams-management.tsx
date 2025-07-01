
"use client";

import { useState, useMemo } from "react";
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
import { teams as initialTeams, projects, users } from "@/lib/data";
import type { Team } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Phone, ChevronDown } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

const teamSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters."),
  projectId: z.string().nonempty("Please select a project."),
  teamLeadId: z.string().nonempty("Please select a team lead."),
  memberIds: z.array(z.string()).nonempty("A team must have at least one member."),
});

type TeamFormValues = z.infer<typeof teamSchema>;

export function TeamsManagement() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      projectId: "",
      teamLeadId: "",
      memberIds: [],
    },
  });

  const isEditing = editingTeamId !== null;

  const teamsByProject = useMemo(() => {
    return teams.reduce((acc, team) => {
      const projectName = projects.find(p => p.id === team.projectId)?.name || 'Unknown Project';
      if (!acc[projectName]) {
        acc[projectName] = [];
      }
      acc[projectName].push(team);
      return acc;
    }, {} as Record<string, Team[]>);
  }, [teams]);

  function onSubmit(data: TeamFormValues) {
    if (isEditing) {
      setTeams(
        teams.map((team) =>
          team.id === editingTeamId
            ? { ...team, ...data }
            : team
        )
      );
      toast({
        title: "Team Updated!",
        description: `The "${data.name}" team has been successfully updated.`,
      });
      setEditingTeamId(null);
    } else {
      const newTeam: Team = {
        id: `team-${Date.now()}`,
        ...data
      };
      setTeams([...teams, newTeam]);
      toast({
        title: "Team Added!",
        description: `The "${data.name}" team has been successfully created.`,
      });
    }
    form.reset({ name: "", projectId: "", teamLeadId: "", memberIds: [] });
  }

  function handleEdit(team: Team) {
    setEditingTeamId(team.id);
    form.reset(team);
  }

  function handleCancelEdit() {
    setEditingTeamId(null);
    form.reset({ name: "", projectId: "", teamLeadId: "", memberIds: [] });
  }

  function handleDeleteConfirm() {
    if (!teamToDelete) return;
    setTeams(teams.filter((team) => team.id !== teamToDelete.id));
    toast({
      title: "Team Deleted",
      description: `The "${teamToDelete.name}" team has been removed.`,
      variant: "destructive",
    });
    setTeamToDelete(null);
  }

  const selectedMembers = users.filter(user => form.watch('memberIds')?.includes(user.id));


  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? "Edit Team" : "Create New Team"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {projects.map(proj => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
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
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a team lead" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="memberIds"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Team Members</FormLabel>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full justify-start text-left h-auto min-h-10 py-2", !field.value?.length && "text-muted-foreground")}>
                                  <span className="truncate">
                                      {selectedMembers.length > 0
                                          ? selectedMembers.map(u => u.name).join(', ')
                                          : "Select members..."}
                                  </span>
                                <ChevronDown className="ml-auto h-4 w-4 shrink-0" />
                              </Button>
                            </FormControl>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                            {users.map((user) => (
                              <DropdownMenuCheckboxItem
                                key={user.id}
                                checked={field.value?.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  const newValues = field.value ? [...field.value] : [];
                                  if (checked) {
                                    newValues.push(user.id);
                                  } else {
                                    const index = newValues.indexOf(user.id);
                                    if (index > -1) {
                                      newValues.splice(index, 1);
                                    }
                                  }
                                  field.onChange(newValues);
                                }}
                              >
                                {user.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2 pt-2">
                    <Button type="submit" className="w-full">
                      {isEditing ? "Update Team" : "Create Team"}
                    </Button>
                    {isEditing && (
                      <Button type="button" variant="outline" className="w-full" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Existing Teams by Project</CardTitle>
              <CardDescription>Teams are grouped by the project they are assigned to.</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(teamsByProject).length === 0 ? (
                <p className="text-muted-foreground">No teams have been created yet.</p>
              ) : (
                <Accordion type="multiple" className="w-full" defaultValue={Object.keys(teamsByProject)}>
                  {Object.entries(teamsByProject).map(([projectName, projectTeams]) => (
                    <AccordionItem value={projectName} key={projectName}>
                      <AccordionTrigger className="font-semibold">{projectName}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pl-4 border-l-2 ml-2">
                          {projectTeams.map((team) => {
                             const teamLead = users.find(u => u.id === team.teamLeadId);
                             const teamMembers = users.filter(u => team.memberIds.includes(u.id));
                            return (
                                <div key={team.id} className="p-4 border rounded-md relative">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <h4 className="font-semibold">{team.name}</h4>
                                          {teamLead && (
                                              <div className="text-sm text-muted-foreground mt-1">
                                                  <p className="font-medium">Lead: {teamLead.name}</p>
                                                  {teamLead.phone && (
                                                      <a href={`tel:${teamLead.phone}`} className="flex items-center gap-1.5 hover:text-primary">
                                                          <Phone className="w-3 h-3"/>
                                                          {teamLead.phone}
                                                      </a>
                                                  )}
                                              </div>
                                          )}
                                          <div className="mt-2">
                                              <p className="text-sm font-medium">Members:</p>
                                              <p className="text-sm text-muted-foreground">{teamMembers.map(m => m.name).join(', ')}</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-1 absolute top-2 right-2">
                                          <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                                              <Pencil className="w-4 h-4" />
                                              <span className="sr-only">Edit</span>
                                          </Button>
                                          <Button
                                              variant="ghost"
                                              size="icon"
                                              className="text-destructive hover:text-destructive"
                                              onClick={() => setTeamToDelete(team)}
                                          >
                                              <Trash2 className="w-4 h-4" />
                                              <span className="sr-only">Delete</span>
                                          </Button>
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
        </div>
      </div>

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
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
