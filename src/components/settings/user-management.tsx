
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Role, User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Pencil, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { updateUserRoles } from "@/app/settings/actions";

type UserWithRoles = User & {
    roles: Role[];
};

const userRolesSchema = z.object({
  roleIds: z.array(z.string()),
});

type UserRolesFormValues = z.infer<typeof userRolesSchema>;

export function UserManagement({ initialUsers, allRoles }: { initialUsers: UserWithRoles[], allRoles: Role[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);

  const form = useForm<UserRolesFormValues>({
    resolver: zodResolver(userRolesSchema),
    defaultValues: { roleIds: [] },
  });

  const handleEditUser = (user: UserWithRoles) => {
    setEditingUser(user);
    form.reset({
      roleIds: user.roles.map(role => role.id),
    });
  };
  
  const handleCloseDialog = () => {
    setEditingUser(null);
    form.reset({ roleIds: [] });
  };

  function onSubmit(data: UserRolesFormValues) {
    if (!editingUser) return;
    
    startTransition(async () => {
      const result = await updateUserRoles(editingUser.id, data.roleIds);
      if (result.success) {
        toast({
          title: "User Roles Updated",
          description: `Roles for ${editingUser.name} have been successfully updated.`,
        });
        handleCloseDialog();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Assign roles to users in your application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {initialUsers.map((user, index) => (
            <div key={user.id}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map(role => (
                          <Badge key={role.id} variant="secondary">{role.name}</Badge>
                        ))
                      ) : (
                        <Badge variant="outline">No Roles</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
              {index < initialUsers.length - 1 && <Separator className="my-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Roles for {editingUser?.name}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="roleIds"
                render={({ field }) => {
                   const selectedRoles = allRoles.filter(role => field.value?.includes(role.id));
                   return (
                    <FormItem>
                      <FormLabel>Roles</FormLabel>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className={cn("w-full justify-start", !field.value?.length && "text-muted-foreground")}>
                              {selectedRoles.length > 0
                                ? selectedRoles.map(r => r.name).join(', ')
                                : "Select roles..."}
                              <ChevronDown className="ml-auto h-4 w-4" />
                            </Button>
                          </FormControl>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                          {allRoles.map((role) => (
                            <DropdownMenuCheckboxItem
                              key={role.id}
                              checked={field.value?.includes(role.id)}
                              onCheckedChange={(checked) => {
                                const newValues = field.value ? [...field.value] : [];
                                if (checked) {
                                  newValues.push(role.id);
                                } else {
                                  const index = newValues.indexOf(role.id);
                                  if (index > -1) newValues.splice(index, 1);
                                }
                                field.onChange(newValues);
                              }}
                            >
                              {role.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <FormMessage />
                    </FormItem>
                   )
                }}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Roles"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
