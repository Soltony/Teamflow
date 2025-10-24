

"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, Team, User, Role } from "@/lib/types";

const teamSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters."),
  projectId: z.string(),
  teamLeadId: z.string().nonempty("Please select a team lead."),
  memberIds: z.array(z.string()).nonempty("A team must have at least one member."),
});

type TeamFormValues = z.infer<typeof teamSchema>;
type UserWithRoles = User & { roles: Role[] };

type TeamDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team;
  project: Project;
  allUsers: UserWithRoles[];
  onSubmit: (data: TeamFormValues) => void;
};

export function TeamDialog({ isOpen, onOpenChange, team, project, allUsers, onSubmit }: TeamDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!team;
  
  const nonAdminUsers = useMemo(() => {
    return allUsers.filter(user => user.roles && !user.roles.some(role => role.name === 'Admin'));
  }, [allUsers]);

  const { availableLeads, availableMembers } = useMemo(() => {
    const usersToFilter = nonAdminUsers;
    if (!project?.pmoDivisionId) {
        return { availableLeads: usersToFilter, availableMembers: usersToFilter };
    }
    const filteredUsers = usersToFilter.filter(u => u.pmoDivisionId === project.pmoDivisionId);
    return { availableLeads: filteredUsers, availableMembers: filteredUsers };
  }, [project, nonAdminUsers]);

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
  });
  
  useEffect(() => {
    if (isOpen) {
        if (team) {
            form.reset({
                name: team.name,
                projectId: project.id,
                teamLeadId: team.teamLeadId,
                memberIds: (team as any).members?.map((m: User) => m.id) || team.memberIds || [],
            });
        } else {
            form.reset({
                name: "",
                projectId: project.id,
                teamLeadId: "",
                memberIds: [],
            });
        }
    }
  }, [isOpen, team, project, form]);

  const handleSubmit = (data: TeamFormValues) => {
    startTransition(() => {
        onSubmit(data);
    });
  };

  const selectedMemberNames = useMemo(() => {
    const selectedIds = form.watch('memberIds') || [];
    return allUsers.filter(u => selectedIds.includes(u.id)).map(u => u.name).join(', ');
  }, [form.watch('memberIds'), allUsers]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit Team: ${team?.name}` : `Add Team to ${project.name}`}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the team's details." : "Create a new team for this project."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="team-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
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
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a team lead" /></SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-60 overflow-y-auto">
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
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Team Members</FormLabel>
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <FormControl>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-auto min-h-10 whitespace-normal", !field.value?.length && "text-muted-foreground")}>
                            <span className="truncate">
                                {selectedMemberNames || "Select members..."}
                            </span>
                            <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                        </FormControl>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                        {availableMembers.map((user) => (
                        <DropdownMenuCheckboxItem
                            key={user.id}
                            checked={field.value?.includes(user.id)}
                            onCheckedChange={(checked) => {
                                const newValues = field.value ? [...field.value] : [];
                                if (checked) { newValues.push(user.id); } 
                                else {
                                    const index = newValues.indexOf(user.id);
                                    if (index > -1) newValues.splice(index, 1);
                                }
                                field.onChange(newValues);
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
                )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button type="submit" form="team-form" disabled={isPending}>
            {isPending ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Team' : 'Create Team')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
